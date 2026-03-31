'use strict';

const {
  inferCallClass,
  callClassAllowsMissingLeg,
} = require('../services/callClassification');

const {
  canonicalType,
  getLatestMediaStatsByDir,
  buildCallDiagnosis,
  computeMissingLeg,
  computeProbableLteReceiveFailure,
} = require('../services/callDiagnosis');

/**
 * callLogPage.js
 *
 * WireGuard-only admin page for call/media diagnostic event filtering.
 * URL: /admin/calllogs
 *
 * Features:
 * - Filter by AOR (account@domain), call-id, event type, LTE mode, errors only
 * - Table shows all event fields relevant for LTE media diagnosis
 * - Refresh button reloads without clearing filters
 * - MEDIA error codes highlighted in red
 */

const MEDIA_ERROR_DESCRIPTIONS = {
  'MEDIA-E001': 'Relay not found — TURN unreachable in relay-only mode',
  'MEDIA-E002': 'ICE timeout — gathering timed out before relay candidate found',
  'MEDIA-E003': 'Secure media failed — DTLS/SRTP negotiation did not complete',
  'MEDIA-E004': 'No audio received — zero RTP packets on browser leg',
};

const ADMIN_TIMEZONE = 'Asia/Karachi';
const ADMIN_TZ_LABEL = 'PKT';

const SESSION_EVENT_TYPES = new Set([
  'profile-selected',
  'ua-ice-policy',
  'profile-badge-rendered',
  'profile-toggle-changed',
]);

const SUMMARY_MILESTONE_TYPES = new Set([
  'outbound-preflight-result',
  'invite-sent',
  'ice-complete',
  'remote-audio-attached',
  'remote-audio-play-ok',
  'remote-audio-play-failed',
  'no-remote-audio-play',
  'call-established',
  'call-ended',
  'call-log-post-failed',
  'preflight-icecandidateerror',
  'no-inbound-rtp',
  'no-outbound-rtp',
  'dtls-connected-but-no-rtp',
  'selected-pair-relay-mismatch',
  'one-way-audio-suspected',
  'incomplete-observability',
  'outbound-post-establish-probe',
  'outbound-receive-health-2s',
  'outbound-receive-health-5s',
  'outbound-receive-health-10s',
  'outbound-inbound-rtp-zero',
  'outbound-inbound-rtp-present',
  'outbound-selected-pair-details',
  'outbound-dtls-state',
  'outbound-connection-state',
  'outbound-ice-connection-state',
  'probable-lte-receive-path-failure',
]);

function escHtml(v) {
  if (v === undefined || v === null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function corrKey(ev) {
  return ev?.corrId || ev?.callId || '';
}

function buildLegSummary(events, dir) {
  const evs = Array.isArray(events) ? events : [];
  const leg = evs.filter((e) => (e.dir || '') === dir);
  const any = leg.length > 0;
  const established = leg.some((e) => canonicalType(e) === 'call-established');
  const remoteTrack = leg.some((e) => canonicalType(e) === 'remote-audio-track-added');
  const remoteAudioPlayOk = leg.some((e) => canonicalType(e) === 'remote-audio-play-ok');
  const remoteAudioPlayFail = leg.some((e) => canonicalType(e) === 'remote-audio-play-failed');

  const latestStats = (() => {
    const stats = getLatestMediaStatsByDir(leg);
    return dir === 'outbound' ? stats.outbound : stats.inbound;
  })();

  const inboundRtp = typeof latestStats?.inboundAudioPacketsReceived === 'number'
    ? latestStats.inboundAudioPacketsReceived > 0
    : null;
  const outboundRtp = typeof latestStats?.outboundAudioPacketsSent === 'number'
    ? latestStats.outboundAudioPacketsSent > 0
    : null;
  const latestStatsTs = latestStats?.ts || latestStats?._serverTs || null;

  return {
    any,
    username: leg[0]?.username,
    aor: leg[0]?.aor,
    established,
    remoteTrack,
    remoteAudioPlayOk,
    remoteAudioPlayFail,
    inboundRtp,
    outboundRtp,
    latestStatsTs,
  };
}

function renderLegSummaryBlock(events) {
  const callClass = inferCallClass(events).class;
  const caller = buildLegSummary(events, 'outbound');
  const callee = buildLegSummary(events, 'inbound');

  const boolCell = (v) => {
    if (v === true) return 'yes';
    if (v === false) return 'no';
    return 'unknown';
  };

  const shouldWarnMissingLeg = callClassAllowsMissingLeg(callClass);
  const warn = shouldWarnMissingLeg && (!caller.any || !callee.any)
    ? `<div class="legend" style="margin-top: 0; margin-bottom: 12px; border-color: rgba(224,90,90,.45);">
  <h3 style="color: var(--red);">WARNING: ${!caller.any ? 'caller leg logs missing' : ''}${(!caller.any && !callee.any) ? ' and ' : ''}${!callee.any ? 'callee leg logs missing' : ''}</h3>
  <div style="margin-top: 6px;">PROBLEM: incomplete observability for ${!caller.any ? 'caller' : 'callee'} leg</div>
</div>`
    : '';

  const asym = shouldWarnMissingLeg ? deriveAsymmetricDirectionDiagnosis(events) : null;
  const asymHtml = asym
    ? `<div class="legend" style="margin-top: 0; margin-bottom: 12px; border-color: rgba(224,90,90,.45);">
  <h3 style="color: var(--red);">${escHtml(asym.problem)}</h3>
  <pre style="white-space: pre-wrap; font-family: var(--mono); color: var(--dim); font-size: 12px; line-height: 1.4;">${escHtml(asym.lines.join('\n'))}</pre>
</div>`
    : '';

  const row = (title, s) => {
    return `<div class="legend" style="margin-top: 0; margin-bottom: 12px;">
  <h3>${escHtml(title)}</h3>
  <pre style="white-space: pre-wrap; font-family: var(--mono); color: var(--dim); font-size: 12px; line-height: 1.4;">${escHtml(
    `established: ${boolCell(s.established)}\n`
    + `remote track: ${boolCell(s.remoteTrack)}\n`
    + `remote audio play: ${s.remoteAudioPlayOk ? 'yes' : (s.remoteAudioPlayFail ? 'failed' : 'no/unknown')}\n`
    + `inbound RTP: ${boolCell(s.inboundRtp)}\n`
    + `outbound RTP: ${boolCell(s.outboundRtp)}\n`
    + `latest stats ts: ${s.latestStatsTs ? formatTs(s.latestStatsTs) : '—'}`
  )}</pre>
</div>`;
  };

  return `${asymHtml}${warn}${row(`Caller leg (outbound)${caller.username ? ` — ${caller.username}` : ''}`, caller)}${row(`Callee leg (inbound)${callee.username ? ` — ${callee.username}` : ''}`, callee)}`;
}

function buildQueryString(params) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null) continue;
    const s = String(v);
    if (!s) continue;
    usp.set(k, s);
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

function buildExportLinks(filter, { isTraceView } = {}) {
  const base = { ...(filter || {}) };
  const viewMode = String(base.view || 'raw');

  const qsFiltered = buildQueryString({
    ...base,
    limit: 1000,
  });

  const filteredJson = `/admin/calllogs/export.json${qsFiltered}`;
  const filteredCsv = `/admin/calllogs/export.csv${qsFiltered}`;

  const traceKeyQs = (() => {
    if (!isTraceView) return '';
    const corrId = base.corrId || '';
    const callId = base.callId || '';
    return buildQueryString({ corrId: corrId || undefined, callId: (!corrId && callId) ? callId : undefined });
  })();

  const traceJson = isTraceView ? `/admin/calllogs/trace/export.json${traceKeyQs}` : '';
  const traceCsv = isTraceView ? `/admin/calllogs/trace/export.csv${traceKeyQs}` : '';

  const latestByCallerQs = (() => {
    const username = base.username || '';
    if (!username) return '';
    return buildQueryString({ username });
  })();
  const latestByCallerJson = latestByCallerQs ? `/admin/calllogs/latest/export.json${latestByCallerQs}` : '';
  const latestByCallerCsv = latestByCallerQs ? `/admin/calllogs/latest/export.csv${latestByCallerQs}` : '';

  const exportCaller = base.exportCaller || '';
  const exportReceiver = base.exportReceiver || '';

  const latestCallerQs = exportCaller ? buildQueryString({ caller: exportCaller }) : '';
  const latestCallerJson = latestCallerQs ? `/admin/calllogs/latest-caller/export.json${latestCallerQs}` : '';
  const latestCallerCsv = latestCallerQs ? `/admin/calllogs/latest-caller/export.csv${latestCallerQs}` : '';
  const latestCallerPdf = latestCallerQs ? `/admin/calllogs/latest-caller/export.pdf${latestCallerQs}` : '';

  const latestReceiverQs = exportReceiver ? buildQueryString({ receiver: exportReceiver }) : '';
  const latestReceiverJson = latestReceiverQs ? `/admin/calllogs/latest-receiver/export.json${latestReceiverQs}` : '';
  const latestReceiverCsv = latestReceiverQs ? `/admin/calllogs/latest-receiver/export.csv${latestReceiverQs}` : '';
  const latestReceiverPdf = latestReceiverQs ? `/admin/calllogs/latest-receiver/export.pdf${latestReceiverQs}` : '';

  const latestPairQs = (exportCaller && exportReceiver) ? buildQueryString({ caller: exportCaller, receiver: exportReceiver }) : '';
  const latestPairJson = latestPairQs ? `/admin/calllogs/latest-pair/export.json${latestPairQs}` : '';
  const latestPairCsv = latestPairQs ? `/admin/calllogs/latest-pair/export.csv${latestPairQs}` : '';
  const latestPairPdf = latestPairQs ? `/admin/calllogs/latest-pair/export.pdf${latestPairQs}` : '';

  return {
    viewMode,
    filteredJson,
    filteredCsv,
    traceJson,
    traceCsv,
    latestByCallerJson,
    latestByCallerCsv,
    latestCallerJson,
    latestCallerCsv,
    latestCallerPdf,
    latestReceiverJson,
    latestReceiverCsv,
    latestReceiverPdf,
    latestPairJson,
    latestPairCsv,
    latestPairPdf,
  };
}

function modeLabel(ev) {
  if (ev.selectedProfile) return String(ev.selectedProfile);
  if (ev.mode) return String(ev.mode);
  if (ev.lteMode === true) return 'lte';
  if (ev.lteMode === false) return 'wifi';
  return '';
}

function formatTs(ts) {
  const v = ts || '';
  if (!v) return '';
  try {
    const d = new Date(v);
    if (!Number.isFinite(d.getTime())) throw new Error('invalid-date');
    const s = new Intl.DateTimeFormat('sv-SE', {
      timeZone: ADMIN_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(d);
    return `${s} ${ADMIN_TZ_LABEL}`;
  } catch {
    return String(v).replace('T', ' ').slice(0, 19);
  }
}

function parseTsMs(ts) {
  const d = new Date(ts);
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

function stageLabel(ev) {
  if ((ev.code || '').startsWith('MEDIA-E')) return 'Error';

  const t = canonicalType(ev);
  switch (t) {
    case 'profile-selected': return 'Profile selected';
    case 'ua-ice-policy': return 'ICE policy';
    case 'outbound-preflight-start': return 'Preflight';
    case 'outbound-preflight-result': {
      if (typeof ev.relay === 'number') return ev.relay > 0 ? 'Preflight OK' : 'Preflight FAIL';
      return 'Preflight result';
    }
    case 'invite-sent': return 'INVITE sent';
    case 'ice-complete': return 'ICE complete';
    case 'remote-audio-attached': return 'Remote audio attached';
    case 'remote-audio-play-ok': return 'Remote audio play';
    case 'remote-audio-play-failed': return 'Remote audio play';
    case 'no-remote-audio-play': return 'Remote audio play';
    case 'call-established': return 'Established';
    case 'call-ended': return 'Ended';
    case 'call-log-post-failed': return 'POST failed';
    case 'no-inbound-rtp': return 'No inbound RTP';
    case 'no-outbound-rtp': return 'No outbound RTP';
    case 'dtls-connected-but-no-rtp': return 'DTLS ok / no RTP';
    case 'selected-pair-relay-mismatch': return 'ICE mismatch';
    case 'remote-audio-play-failed': return 'Audio play failed';
    case 'no-remote-audio-play': return 'No audio play';
    case 'one-way-audio-suspected': return 'PROBLEM: one-way audio';
    case 'incomplete-observability': return 'PROBLEM: missing leg';
    case 'probable-lte-receive-path-failure': return 'PROBLEM: LTE no receive';
    case 'preflight-icecandidateerror': return (ev._aggCount > 1)
      ? `Preflight ICE error x${ev._aggCount}`
      : 'Preflight ICE error';
    default: return 'Event';
  }
}

function deriveAsymmetricDirectionDiagnosis(events) {
  const caller = buildLegSummary(events, 'outbound');
  const callee = buildLegSummary(events, 'inbound');

  const wifi = callee;
  const lteMissing = !caller.any;

  const wifiSendingOk = wifi.any && wifi.outboundRtp === true;
  const wifiReceivingNo = wifi.any && wifi.inboundRtp === false;

  if (wifiSendingOk && wifiReceivingNo && lteMissing) {
    return {
      lines: [
        'Wi-Fi leg sending OK',
        'Wi-Fi leg receiving NO',
        'LTE leg logs missing',
      ],
      problem: 'PROBLEM: LTE receive-leg observability missing; current evidence suggests LTE is not receiving RTP',
    };
  }

  return null;
}

function shouldShowCandSummary(ev, viewMode) {
  if (viewMode !== 'summary') return true;
  if ((ev.code || '').startsWith('MEDIA-E')) return false;
  const t = canonicalType(ev);
  return t === 'outbound-preflight-result'
    || t === 'ice-complete'
    || t === 'preflight-icecandidateerror'
    || t.startsWith('media-stats-');
}

function isSuspiciousStatsEvent(ev) {
  if (!ev || typeof ev !== 'object') return false;
  const inP = typeof ev.inboundAudioPacketsReceived === 'number' ? ev.inboundAudioPacketsReceived : null;
  const outP = typeof ev.outboundAudioPacketsSent === 'number' ? ev.outboundAudioPacketsSent : null;
  if (inP === null && outP === null) return false;
  if (inP === 0 && outP > 0) return true;
  if (outP === 0 && inP > 0) return true;
  return false;
}

function renderMediaDiagnosisBlock(events) {
  const callClass = inferCallClass(events).class;
  const diag = buildCallDiagnosis(events, callClass);
  const setup = diag.hasEstablished ? 'OK' : 'UNKNOWN';
  const ice = diag.hasIceComplete ? 'OK' : 'UNKNOWN';
  const dtls = (diag.stats.outbound?.dtlsState || diag.stats.inbound?.dtlsState) ? 'OK' : 'UNKNOWN';

  const lines = [
    `setup: ${setup}`,
    `ICE: ${ice}`,
    `DTLS: ${dtls}`,
    `caller outbound RTP: ${typeof diag.stats.outbound?.outboundAudioPacketsSent === 'number' ? (diag.stats.outbound.outboundAudioPacketsSent > 0 ? 'yes' : 'no') : 'unknown'}`,
    `caller inbound RTP: ${typeof diag.stats.outbound?.inboundAudioPacketsReceived === 'number' ? (diag.stats.outbound.inboundAudioPacketsReceived > 0 ? 'yes' : 'no') : 'unknown'}`,
    `callee outbound RTP: ${typeof diag.stats.inbound?.outboundAudioPacketsSent === 'number' ? (diag.stats.inbound.outboundAudioPacketsSent > 0 ? 'yes' : 'no') : 'unknown'}`,
    `callee inbound RTP: ${typeof diag.stats.inbound?.inboundAudioPacketsReceived === 'number' ? (diag.stats.inbound.inboundAudioPacketsReceived > 0 ? 'yes' : 'no') : 'unknown'}`,
    `suspected issue: ${diag.oneWaySuspected ? 'one-way audio' : 'none detected'}`,
  ];

  const details = diag.oneWaySuspected ? `\n${escHtml(diag.suspectedMsg)}` : '';

  return `<div class="legend" style="margin-top: 0; margin-bottom: 16px;">
  <h3>Media diagnosis (derived)</h3>
  <pre style="white-space: pre-wrap; font-family: var(--mono); color: var(--dim); font-size: 12px; line-height: 1.4;">${escHtml(lines.join('\n'))}${details}</pre>
</div>`;
}

function isConcreteCount(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function pickBetterCounts(best, ev) {
  const next = { ...best };
  for (const k of ['relay', 'host', 'srflx', 'total']) {
    const cur = next[k];
    const cand = ev[k];
    if (!isConcreteCount(cur) && isConcreteCount(cand)) next[k] = cand;
    if (isConcreteCount(cur) && isConcreteCount(cand) && cand > cur) next[k] = cand;
  }
  if (next.icePolicy === undefined && typeof ev.icePolicy === 'string') next.icePolicy = ev.icePolicy;
  if (next.timedOut === undefined && typeof ev.timedOut === 'boolean') next.timedOut = ev.timedOut;
  if (next.selectedPair === undefined && typeof ev.selectedPair === 'string') next.selectedPair = ev.selectedPair;
  if (next.candSummary === undefined && typeof ev.candSummary === 'string') next.candSummary = ev.candSummary;
  return next;
}

function isPreflightFamily(ev) {
  const t = (ev.type || '');
  return t === 'outbound-preflight-start'
    || t === 'outbound-preflight-complete'
    || t === 'outbound-preflight-result'
    || t === 'preflight-complete'
    || t === 'preflight-ok'
    || t === 'preflight-fail';
}

function preflightOkFromCounts(ev) {
  if (typeof ev.relay === 'number') return ev.relay > 0;
  if (typeof ev.total === 'number') return ev.total > 0;
  return null;
}

function mergeIceErrorDetail(best, ev) {
  const out = { ...best };
  const msg = ev.msg || '';
  if (!out.msg && msg) out.msg = msg;
  if (out.msg && msg && msg.length > out.msg.length) out.msg = msg;

  // Try to preserve useful single-line details if present
  for (const k of ['code', 'url', 'transport', 'error', 'errorText']) {
    if (out[k] === undefined && ev[k] !== undefined) out[k] = ev[k];
  }

  return out;
}

function applySummaryTransforms(events, { includeSession } = {}) {
  const input = Array.isArray(events) ? events : [];

  // Pre-compute call-level diagnosis for synthetic PROBLEM rows.
  const byCorr = new Map();
  for (const ev of input) {
    const k = corrKey(ev);
    if (!k) continue;
    if (!byCorr.has(k)) byCorr.set(k, []);
    byCorr.get(k).push(ev);
  }

  const callClassByKey = new Map();
  for (const [key, evs] of byCorr.entries()) {
    callClassByKey.set(key, inferCallClass(evs).class);
  }

  const callProblem = new Map();
  for (const [key, evs] of byCorr.entries()) {
    const callClass = callClassByKey.get(key) || 'pbx/unknown';
    const d = buildCallDiagnosis(evs, callClass);
    if (d.oneWaySuspected) callProblem.set(key, d);
  }

  const callMissingLeg = new Set();
  for (const [key, evs] of byCorr.entries()) {
    const callClass = callClassByKey.get(key) || 'pbx/unknown';
    if (computeMissingLeg(evs, callClass)) callMissingLeg.add(key);
  }

  // 0) Build one canonical preflight row per callId+dir
  const preflightByKey = new Map();
  for (const ev of input) {
    const key = corrKey(ev);
    if (!key) continue;
    if (!isPreflightFamily(ev)) continue;
    const dir = ev.dir || '';
    const k = `${key}|${dir}`;
    const prev = preflightByKey.get(k);
    const ts = ev.ts || ev._serverTs;

    const okFromCounts = preflightOkFromCounts(ev);
    const ok = (ev.type === 'preflight-ok')
      ? true
      : (ev.type === 'preflight-fail' ? false : okFromCounts);

    if (!prev) {
      preflightByKey.set(k, {
        base: ev,
        ts,
        ok,
        counts: pickBetterCounts({}, ev),
      });
      continue;
    }

    const mergedCounts = pickBetterCounts(prev.counts, ev);
    const mergedOk = (prev.ok === true || ok === true)
      ? true
      : ((prev.ok === false || ok === false) ? false : null);

    preflightByKey.set(k, {
      base: prev.base,
      ts: ts || prev.ts,
      ok: mergedOk,
      counts: mergedCounts,
    });
  }

  // 1) Aggregate repeated preflight icecandidateerror spam into buckets
  // Bucket window: 5s. Group by callId+dir+bucket.
  const bucketMs = 5000;
  const aggCounts = new Map();
  const aggSkipSeq = new Set();
  const aggBest = new Map();
  const aggRepSeq = new Map();

  for (const ev of input) {
    const t = canonicalType(ev);
    if (t !== 'preflight-icecandidateerror') continue;
    const key = corrKey(ev);
    if (!key) continue;
    const ts = ev.ts || ev._serverTs;
    const ms = parseTsMs(ts);
    if (ms === null) continue;
    const bucket = Math.floor(ms / bucketMs);
    const k = `${key}|${t}|${bucket}`;

    aggCounts.set(k, (aggCounts.get(k) || 0) + 1);
    const best = aggBest.get(k) || {};
    aggBest.set(k, mergeIceErrorDetail(best, ev));

    // Keep exactly one representative row per bucket; skip the rest.
    if (ev._seq !== undefined) {
      if (!aggRepSeq.has(k)) {
        aggRepSeq.set(k, ev._seq);
      } else if (aggRepSeq.get(k) !== ev._seq) {
        aggSkipSeq.add(ev._seq);
      }
    }
  }

  const out = [];
  const seenMilestone = new Set();
  const emittedPreflight = new Set();

  // Emit one synthetic PROBLEM row per callId (newest-first ordering).
  for (const [key, d] of callProblem.entries()) {
    const rep = (byCorr.get(key) || [])[0] || {};
    out.push({
      _seq: rep._seq,
      ts: rep.ts,
      _serverTs: rep._serverTs,
      type: 'one-way-audio-suspected',
      callId: rep.callId,
      corrId: rep.corrId,
      dir: rep.dir,
      username: rep.username,
      domain: rep.domain,
      aor: rep.aor,
      peer: rep.peer,
      peerDomain: rep.peerDomain,
      peerAor: rep.peerAor,
      lteMode: rep.lteMode,
      mode: rep.mode,
      selectedProfile: rep.selectedProfile,
      icePolicy: rep.icePolicy,
      msg: d.suspectedMsg || 'One-way audio suspected (derived from stats)',
    });

    const callClass = callClassByKey.get(key) || 'pbx/unknown';
    const shouldEmitProbableLte = computeProbableLteReceiveFailure({
      isMissingLeg: callMissingLeg.has(key),
      callClass,
      diagnosis: d,
    });

    if (shouldEmitProbableLte) {
      out.push({
        _seq: rep._seq,
        ts: rep.ts,
        _serverTs: rep._serverTs,
        type: 'probable-lte-receive-path-failure',
        callId: rep.callId,
        corrId: rep.corrId,
        dir: rep.dir,
        username: rep.username,
        domain: rep.domain,
        aor: rep.aor,
        peer: rep.peer,
        peerDomain: rep.peerDomain,
        peerAor: rep.peerAor,
        lteMode: rep.lteMode,
        mode: rep.mode,
        selectedProfile: rep.selectedProfile,
        icePolicy: rep.icePolicy,
        msg: 'PROBLEM: probable LTE receive-path failure (opposite leg logs missing)',
      });
    }
  }

  // Emit incomplete-observability row for calls with only one leg present
  // (even when one-way audio is not yet diagnosed — the missing leg is itself a problem).
  for (const key of callMissingLeg) {
    if (callProblem.has(key)) continue; // already covered above
    const callClass = callClassByKey.get(key) || 'pbx/unknown';
    if (!callClassAllowsMissingLeg(callClass)) continue;
    const evs = byCorr.get(key) || [];
    const rep = evs[0] || {};
    const dirs = [...new Set(evs.map((e) => e.dir).filter(Boolean))];
    out.push({
      _seq: rep._seq,
      ts: rep.ts,
      _serverTs: rep._serverTs,
      type: 'incomplete-observability',
      callId: rep.callId,
      corrId: rep.corrId,
      dir: rep.dir,
      username: rep.username,
      domain: rep.domain,
      aor: rep.aor,
      peer: rep.peer,
      peerDomain: rep.peerDomain,
      peerAor: rep.peerAor,
      lteMode: rep.lteMode,
      mode: rep.mode,
      selectedProfile: rep.selectedProfile,
      icePolicy: rep.icePolicy,
      msg: `PROBLEM: incomplete observability — only ${dirs[0] || 'one'} leg logs present for this call`,
    });
  }

  for (const ev0 of input) {
    if (ev0._seq !== undefined && aggSkipSeq.has(ev0._seq)) continue;

    const ev = { ...ev0 };
    ev.type = canonicalType(ev);

    const key = corrKey(ev);

    const isSession = SESSION_EVENT_TYPES.has(ev.type) || (!key && !((ev.code || '').startsWith('MEDIA-E')));
    if (isSession && !includeSession) {
      continue;
    }

    const isMediaError = (ev.code || '').startsWith('MEDIA-E');
    if (!isMediaError) {
      const allowSession = includeSession && SESSION_EVENT_TYPES.has(ev.type);
      if (!allowSession) {
        if (ev.type.startsWith('media-stats-')) {
          if (!isSuspiciousStatsEvent(ev)) continue;
        } else if (!SUMMARY_MILESTONE_TYPES.has(ev.type)) {
          continue;
        }
      }
    }

    // Prefer call-linked events in main summary (unless session is explicitly included)
    if (!key && !isMediaError) {
      if (!(includeSession && SESSION_EVENT_TYPES.has(ev.type))) continue;
    }

    // Replace any preflight-family row with the canonical preflight-result for this callId+dir (emitted once)
    if (key && (ev.type === 'outbound-preflight-result') && isPreflightFamily(ev0)) {
      const k = `${key}|${ev.dir || ''}`;
      if (emittedPreflight.has(k)) continue;

      const pf = preflightByKey.get(k);
      if (pf) {
        emittedPreflight.add(k);
        const ok = pf.ok;
        ev.type = 'outbound-preflight-result';
        ev.relay = pf.counts.relay;
        ev.host = pf.counts.host;
        ev.srflx = pf.counts.srflx;
        ev.total = pf.counts.total;
        ev.timedOut = pf.counts.timedOut;
        ev.icePolicy = pf.counts.icePolicy;
        ev.candSummary = pf.counts.candSummary;
        ev.selectedPair = pf.counts.selectedPair;
        ev.msg = ok === false ? 'LTE preflight FAIL' : 'LTE preflight OK';
      }
    }

    // Attach aggregated count to representative rows
    if (ev.type === 'preflight-icecandidateerror' && key) {
      const ts = ev.ts || ev._serverTs;
      const ms = parseTsMs(ts);
      if (ms !== null) {
        const bucket = Math.floor(ms / bucketMs);
        const k = `${key}|${ev.type}|${bucket}`;
        const n = aggCounts.get(k) || 1;
        if (n > 1) ev._aggCount = n;

        const best = aggBest.get(k);
        if (best && best.msg) ev.msg = best.msg;
      }
    }

    // 2) Collapse duplicates: only one canonical row per milestone per callId+dir
    if (key) {
      const k = `${key}|${ev.dir || ''}|${isMediaError ? (ev.code || '') : ev.type}`;
      if (seenMilestone.has(k)) continue;
      seenMilestone.add(k);
    }

    out.push(ev);
  }

  return out;
}

const PROBLEM_ROW_TYPES = new Set([
  'one-way-audio-suspected',
  'probable-lte-receive-path-failure',
  'incomplete-observability',
]);

const WARN_ROW_TYPES = new Set([
  'no-inbound-rtp',
  'no-outbound-rtp',
  'dtls-connected-but-no-rtp',
  'remote-audio-play-failed',
  'no-remote-audio-play',
  'selected-pair-relay-mismatch',
]);

function renderEventRow(ev, viewMode) {
  const isError = (ev.code || '').startsWith('MEDIA-E');
  const ct = canonicalType(ev);
  const isProblemRow = !isError && PROBLEM_ROW_TYPES.has(ct);
  const isWarnRow = !isError && !isProblemRow && WARN_ROW_TYPES.has(ct);
  const rowClass = isError
    ? ' class="error-row"'
    : (isProblemRow ? ' class="problem-row"' : (isWarnRow ? ' class="warn-row"' : ''));

  const codeOrType = isError ? ev.code : (ev.type || '');
  const stage = viewMode === 'summary' ? stageLabel(ev) : '';
  const eventLabel = (!isError && viewMode === 'summary' && ev._aggCount > 1)
    ? `${codeOrType} x${ev._aggCount}`
    : codeOrType;
  const eventCell = isError
    ? `<td class="code-error" title="${escHtml(MEDIA_ERROR_DESCRIPTIONS[ev.code] || ev.msg)}">${escHtml(eventLabel)}</td>`
    : `<td class="type-cell">${escHtml(eventLabel)}</td>`;

  const candSummary = (ev.relay !== undefined)
    ? `relay=${ev.relay} host=${ev.host ?? '?'} srflx=${ev.srflx ?? '?'} total=${ev.total ?? '?'}`
    : '';
  const selectedPairCell = escHtml(ev.selectedPair || '');

  const profile = modeLabel(ev);
  const modeCell = profile === 'lte'
    ? '<td class="badge-lte">LTE</td>'
    : (profile === 'wifi' ? '<td class="badge-wifi">Wi-Fi</td>' : '<td>—</td>');

  const username = ev.username || (ev.aor ? String(ev.aor).split('@')[0] : '') || '—';
  const domain = ev.domain || (ev.aor ? String(ev.aor).split('@')[1] : '') || '—';
  const aor = ev.aor || (username !== '—' && domain !== '—' ? `${username}@${domain}` : '—');

  const corrIdShort = ev.corrId
    ? (ev.corrId.slice(0, 18) + (ev.corrId.length > 18 ? '…' : ''))
    : '';
  const callIdShort = ev.callId
    ? (ev.callId.slice(0, 18) + (ev.callId.length > 18 ? '…' : ''))
    : '';
  const idCell = (() => {
    if (corrIdShort && callIdShort) return `${corrIdShort} | ${callIdShort}`;
    if (corrIdShort) return corrIdShort;
    if (callIdShort) return callIdShort;
    return '—';
  })();
  const traceLink = ev.corrId
    ? `<a class="trace-link" href="/admin/calllogs${buildQueryString({ corrId: ev.corrId, view: 'raw' })}">trace</a>`
    : (ev.callId
      ? `<a class="trace-link" href="/admin/calllogs${buildQueryString({ callId: ev.callId, view: 'raw' })}">trace</a>`
      : '');

  const peer = ev.peerAor || ev.peer || '—';
  const direction = ev.dir || '—';
  const rawTs = ev.ts || ev._serverTs;
  const ts = formatTs(rawTs);

  const candCell = shouldShowCandSummary(ev, viewMode)
    ? escHtml(ev.candSummary || candSummary || '—')
    : '—';

  const msgMain = isProblemRow
    ? `<span class="rtp-problem">${escHtml(ev.msg || '—')}</span>`
    : escHtml(ev.msg || '—');

  // For stats rows in summary, annotate zero RTP counts inline so they stand out.
  const statsAnnotation = (() => {
    if (viewMode !== 'summary') return '';
    const inP = ev.inboundAudioPacketsReceived;
    const outP = ev.outboundAudioPacketsSent;
    if (typeof inP !== 'number' && typeof outP !== 'number') return '';
    const fmt = (label, v) => {
      if (typeof v !== 'number') return `${label}: ?`;
      const cls = v === 0 ? ' class="rtp-problem"' : '';
      return `${label}: <span${cls}>${v}</span>`;
    };
    return `<br><span style="font-family: var(--mono); font-size: 11px;">${fmt('recv', inP)} | ${fmt('sent', outP)}</span>`;
  })();

  const msgProof = (viewMode === 'raw')
    ? (() => {
      const parts = [];
      if (ev.sourceBuildId) parts.push(`sourceBuildId=${String(ev.sourceBuildId)}`);
      if (ev.postAttemptId) parts.push(`postAttemptId=${String(ev.postAttemptId)}`);
      if (ev.postStatus !== undefined) parts.push(`postStatus=${String(ev.postStatus)}`);
      if (ev.postError) parts.push(`postError=${String(ev.postError)}`);
      return parts.length ? escHtml(parts.join(' ')) : '';
    })()
    : '';

  const msgCellHtml = [
    msgMain,
    statsAnnotation,
    msgProof ? `<br><span style="color: var(--dim); font-family: var(--mono); font-size: 11px;">${msgProof}</span>` : '',
  ].join('');

  const rowKey = ev.corrId || ev.callId || '';
  const selectCell = viewMode === 'summary'
    ? `<td class="sel-cell"><input class="row-sel" type="checkbox" data-key="${escHtml(rowKey)}" ${rowKey ? '' : 'disabled'}></td>`
    : '';

  return `<tr${rowClass}>
    ${selectCell}
    <td class="ts-cell" title="UTC ${escHtml(rawTs || '')}">${escHtml(ts)}</td>
    ${viewMode === 'summary' ? `<td class="stage-cell">${escHtml(stage)}</td>` : ''}
    <td>${escHtml(username)}</td>
    ${viewMode === 'summary' ? '' : `<td>${escHtml(domain)}</td>`}
    <td>${escHtml(aor)}</td>
    <td>${escHtml(direction)}</td>
    <td class="peer-cell">${escHtml(peer)}</td>
    ${eventCell}
    ${modeCell}
    <td class="callid-cell" title="${escHtml(`corrId=${ev.corrId || ''} callId=${ev.callId || ''}`.trim())}">${escHtml(idCell)} ${traceLink}</td>
    <td class="cand-cell" title="${escHtml(selectedPairCell)}">${candCell}</td>
    <td class="msg-cell">${msgCellHtml}</td>
  </tr>`;
}

function renderCallLogPage(events, stats, filter) {
  const isTraceView = !!(filter && (filter.callId || filter.corrId));
  const viewMode = isTraceView
    ? 'raw'
    : ((filter && String(filter.view).toLowerCase() === 'raw') ? 'raw' : 'summary');

  const includeSession = !!(filter && filter.includeSession);

  const traceDiagHtml = isTraceView ? (renderLegSummaryBlock(events) + renderMediaDiagnosisBlock(events)) : '';

  const pageEvents = viewMode === 'summary'
    ? applySummaryTransforms(events, { includeSession })
    : (Array.isArray(events) ? events : []);

  const emptyColspan = viewMode === 'summary' ? 12 : 11;
  const rows = pageEvents.length > 0
    ? pageEvents.map((ev) => renderEventRow(ev, viewMode)).join('\n')
    : `<tr><td colspan="${emptyColspan}" class="no-results">No events match the current filter.</td></tr>`;

  const toggleQsBase = {
    ...filter,
    view: undefined,
    includeSession: includeSession ? '1' : undefined,
  };
  const summaryHref = `/admin/calllogs${buildQueryString({ ...toggleQsBase, view: 'summary' })}`;
  const rawHref = `/admin/calllogs${buildQueryString({ ...toggleQsBase, view: 'raw' })}`;

  const exportLinks = buildExportLinks(filter, { isTraceView });

  const exportBar = isTraceView
    ? `<div class="export-bar">
  <div class="export-left"><span style="color: var(--dim); font-family: var(--mono); font-size: 11px;">Export trace</span></div>
  <div class="export-right">
    <a class="btn btn-clear" href="${escHtml(exportLinks.traceJson)}">Export this trace (JSON)</a>
    <a class="btn btn-clear" href="${escHtml(exportLinks.traceCsv)}">Export this trace (CSV)</a>
  </div>
</div>`
    : `<div class="export-bar">
  <div class="export-left"><span style="color: var(--dim); font-family: var(--mono); font-size: 11px;">Export list</span></div>
  <div class="export-right">
    <a class="btn btn-clear" href="${escHtml(exportLinks.filteredJson)}">Export filtered (JSON)</a>
    <a class="btn btn-clear" href="${escHtml(exportLinks.filteredCsv)}">Export filtered (CSV)</a>
    <button type="button" class="btn btn-clear" id="exportSelectedJson">Export selected (JSON)</button>
    <button type="button" class="btn btn-clear" id="exportSelectedCsv">Export selected (CSV)</button>
  </div>
</div>`;

  const exportSection = isTraceView ? '' : (() => {
    const c = (filter && filter.exportCaller) ? String(filter.exportCaller) : '';
    const r = (filter && filter.exportReceiver) ? String(filter.exportReceiver) : '';

    const callerJson0 = exportLinks.latestCallerJson || '';
    const callerCsv0 = exportLinks.latestCallerCsv || '';
    const callerPdf0 = exportLinks.latestCallerPdf || '';
    const receiverJson0 = exportLinks.latestReceiverJson || '';
    const receiverCsv0 = exportLinks.latestReceiverCsv || '';
    const receiverPdf0 = exportLinks.latestReceiverPdf || '';
    const pairJson0 = exportLinks.latestPairJson || '';
    const pairCsv0 = exportLinks.latestPairCsv || '';
    const pairPdf0 = exportLinks.latestPairPdf || '';

    return `<div class="export-panel" style="background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; margin-bottom: 16px;">
  <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap;">
    <div>
      <div style="font-size: 11px; color: var(--dim); text-transform: uppercase; letter-spacing: .05em;">Export latest correlated call</div>
      <div style="font-size: 12px; color: var(--dim); margin-top: 4px;">Export-only lookup controls (do not filter the visible list)</div>
    </div>
  </div>

  <div class="export-form" style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end; margin-top: 12px;">
    <div class="filter-group">
      <label>Caller (export)</label>
      <input type="text" id="exportCaller" value="${escHtml(c)}" placeholder="e.g. 900900">
    </div>
    <div class="filter-group">
      <label>Receiver (export)</label>
      <input type="text" id="exportReceiver" value="${escHtml(r)}" placeholder="e.g. 600600">
    </div>
    <button type="button" class="btn btn-clear" id="updateExportFields">Update export fields</button>
  </div>

  <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top: 12px;">
    <div id="exportScopeCaller" data-show="flex" style="display:flex; gap:8px; align-items:center; ${c ? '' : 'display:none;'}">
      <select id="exportFormatCaller" class="btn btn-clear" style="padding: 7px 10px;">
        <option value="json">JSON</option>
        <option value="csv">CSV</option>
        <option value="pdf">PDF</option>
      </select>
      <button type="button" class="btn btn-clear" id="exportLatestCaller">Export latest for caller</button>
      <span style="display:none;" id="exportLatestCallerJson0">${escHtml(callerJson0)}</span>
      <span style="display:none;" id="exportLatestCallerCsv0">${escHtml(callerCsv0)}</span>
      <span style="display:none;" id="exportLatestCallerPdf0">${escHtml(callerPdf0)}</span>
    </div>

    <div id="exportScopeReceiver" data-show="flex" style="display:flex; gap:8px; align-items:center; ${r ? '' : 'display:none;'}">
      <select id="exportFormatReceiver" class="btn btn-clear" style="padding: 7px 10px;">
        <option value="json">JSON</option>
        <option value="csv">CSV</option>
        <option value="pdf">PDF</option>
      </select>
      <button type="button" class="btn btn-clear" id="exportLatestReceiver">Export latest for receiver</button>
      <span style="display:none;" id="exportLatestReceiverJson0">${escHtml(receiverJson0)}</span>
      <span style="display:none;" id="exportLatestReceiverCsv0">${escHtml(receiverCsv0)}</span>
      <span style="display:none;" id="exportLatestReceiverPdf0">${escHtml(receiverPdf0)}</span>
    </div>

    <div id="exportScopePair" data-show="flex" style="display:flex; gap:8px; align-items:center; ${(c && r) ? '' : 'display:none;'}">
      <select id="exportFormatPair" class="btn btn-clear" style="padding: 7px 10px;">
        <option value="json">JSON</option>
        <option value="csv">CSV</option>
        <option value="pdf">PDF</option>
      </select>
      <button type="button" class="btn btn-clear" id="exportLatestPair">Export latest for caller+receiver</button>
      <span style="display:none;" id="exportLatestPairJson0">${escHtml(pairJson0)}</span>
      <span style="display:none;" id="exportLatestPairCsv0">${escHtml(pairCsv0)}</span>
      <span style="display:none;" id="exportLatestPairPdf0">${escHtml(pairPdf0)}</span>
    </div>
  </div>
</div>`;
  })();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Call Media Logs — WebRTC SBC Admin</title>
<style>
  :root {
    --bg: #0f1117; --bg2: #1a1d27; --bg3: #22263a;
    --border: #2e3350; --text: #c8cde4; --dim: #6b7399;
    --accent: #4f8ef7; --red: #e05a5a; --green: #4caf80; --yellow: #e0a84a;
    --lte: #e06a20; --wifi: #4caf80;
    --font: 'Segoe UI', system-ui, sans-serif; --mono: 'Cascadia Code', 'Fira Mono', monospace;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: var(--font); font-size: 14px; padding: 24px; }
  h1 { color: var(--accent); font-size: 20px; margin-bottom: 4px; }
  .subtitle { color: var(--dim); font-size: 12px; margin-bottom: 20px; }
  .stats-bar { display: flex; gap: 24px; margin-bottom: 20px; }
  .stat { background: var(--bg2); border: 1px solid var(--border); border-radius: 6px; padding: 10px 18px; }
  .stat-label { font-size: 11px; color: var(--dim); text-transform: uppercase; letter-spacing: .05em; }
  .stat-val { font-size: 22px; font-weight: 600; color: var(--accent); }
  .stat-val.red { color: var(--red); }
  .filter-form { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
  .filter-group { display: flex; flex-direction: column; gap: 4px; }
  .filter-group label { font-size: 11px; color: var(--dim); text-transform: uppercase; letter-spacing: .05em; }
  .filter-group input, .filter-group select { background: var(--bg3); border: 1px solid var(--border); color: var(--text); border-radius: 4px; padding: 6px 10px; font-size: 13px; min-width: 160px; }
  .filter-group input:focus, .filter-group select:focus { outline: 2px solid var(--accent); }
  .btn { background: var(--accent); color: #fff; border: none; border-radius: 4px; padding: 7px 18px; font-size: 13px; cursor: pointer; align-self: flex-end; }
  .btn:hover { opacity: .85; }
  .btn-clear { background: var(--bg3); color: var(--dim); border: 1px solid var(--border); }
  .export-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
  .export-right { display: flex; gap: 10px; flex-wrap: wrap; }
  .sel-cell { width: 32px; }
  .row-sel { transform: translateY(1px); }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: var(--bg3); color: var(--dim); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; }
  td { padding: 7px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
  tr:hover td { background: var(--bg2); }
  .error-row td { background: rgba(224,90,90,.07); }
  .code-error { color: var(--red); font-weight: 600; font-family: var(--mono); font-size: 12px; white-space: nowrap; cursor: help; }
  .badge-lte { color: var(--lte); font-weight: 600; font-size: 12px; }
  .badge-wifi { color: var(--wifi); font-size: 12px; }
  .ts-cell { color: var(--dim); font-family: var(--mono); font-size: 12px; white-space: nowrap; }
  .stage-cell { font-size: 12px; font-weight: 600; white-space: nowrap; }
  .callid-cell { font-family: var(--mono); font-size: 11px; color: var(--dim); }
  .trace-link { color: var(--accent); text-decoration: none; margin-left: 8px; font-size: 11px; }
  .trace-link:hover { text-decoration: underline; }
  .msg-cell { color: var(--dim); max-width: 320px; word-break: break-word; }
  .peer-cell { max-width: 220px; word-break: break-word; }
  .cand-cell { max-width: 260px; word-break: break-word; }
  .type-cell { font-family: var(--mono); font-size: 12px; white-space: nowrap; }
  .no-results { text-align: center; color: var(--dim); padding: 32px; }
  .problem-row td { background: rgba(224,90,90,.12); }
  .problem-row .stage-cell { color: var(--red) !important; font-weight: 700; }
  .warn-row td { background: rgba(224,168,74,.07); }
  .warn-row .stage-cell { color: var(--yellow) !important; font-weight: 700; }
  .rtp-problem { color: var(--red); font-weight: 700; }
  .legend { margin-top: 20px; padding: 14px 18px; background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; font-size: 12px; color: var(--dim); }
  .legend h3 { color: var(--text); font-size: 13px; margin-bottom: 8px; }
  .legend-item { display: flex; gap: 10px; margin-bottom: 4px; }
  .legend-code { color: var(--red); font-family: var(--mono); font-weight: 600; min-width: 90px; }
  .legend-ok { color: var(--green); font-family: var(--mono); font-weight: 600; min-width: 90px; }
  .nav-links { margin-bottom: 16px; font-size: 12px; }
  .nav-links a { color: var(--accent); text-decoration: none; margin-right: 16px; }
  .nav-links a:hover { text-decoration: underline; }
</style>
</head>
<body>
<div class="nav-links">
  <a href="/dashboard">← Dashboard</a>
  <a href="/admin/calllogs">Call Logs</a>
  <a href="/admin/routing">Routing Config</a>
  <a href="/diagnostics/errors">Diagnostics</a>
</div>
<div class="nav-links">
  <span style="color: var(--dim); margin-right: 10px;">View:</span>
  <a href="${escHtml(summaryHref)}"${viewMode === 'summary' ? ' style="font-weight: 700;"' : ''}>Summary</a>
  <a href="${escHtml(rawHref)}"${viewMode === 'raw' ? ' style="font-weight: 700;"' : ''}>Raw</a>
  ${isTraceView ? '<span style="color: var(--dim); margin-left: 14px;">(per-call trace defaults to Raw)</span>' : ''}
</div>
<h1>Call Media Logs</h1>
<p class="subtitle">Real-time call/media diagnostic events from browser clients — in-memory, not persisted across restarts</p>
<p style="font-size: 11px; color: var(--dim); font-family: var(--mono); margin-bottom: 4px;">CALLLOGS_BUILD_MARKER: 2026-03-29-fix2</p>

${traceDiagHtml}

${exportSection}

${exportBar}

<div class="stats-bar">
  <div class="stat">
    <div class="stat-label">Total events</div>
    <div class="stat-val">${stats.total}</div>
  </div>
  <div class="stat">
    <div class="stat-label">Media errors</div>
    <div class="stat-val red">${stats.errors}</div>
  </div>
  <div class="stat">
    <div class="stat-label">LTE events</div>
    <div class="stat-val">${stats.lte}</div>
  </div>
  <div class="stat">
    <div class="stat-label">Buffer capacity</div>
    <div class="stat-val">${stats.total} / ${stats.capacity}</div>
  </div>
</div>

<form class="filter-form" method="get" action="/admin/calllogs">
  <input type="hidden" name="view" value="${escHtml(viewMode)}">
  <input type="hidden" name="exportCaller" value="${escHtml(filter.exportCaller || '')}">
  <input type="hidden" name="exportReceiver" value="${escHtml(filter.exportReceiver || '')}">
  <div class="filter-group">
    <label>Caller</label>
    <input type="text" name="caller" value="${escHtml(filter.caller || '')}" placeholder="e.g. 900900">
  </div>
  <div class="filter-group">
    <label>Receiver</label>
    <input type="text" name="receiver" value="${escHtml(filter.receiver || '')}" placeholder="e.g. 600600">
  </div>
  <div class="filter-group">
    <label>Username / Ext</label>
    <input type="text" name="username" value="${escHtml(filter.username || '')}" placeholder="e.g. 900900">
  </div>
  <div class="filter-group">
    <label>Domain</label>
    <input type="text" name="domain" value="${escHtml(filter.domain || '')}" placeholder="e.g. fusn01.srve.cc">
  </div>
  <div class="filter-group">
    <label>AOR / Account</label>
    <input type="text" name="aor" value="${escHtml(filter.aor || '')}" placeholder="e.g. 900900@fusn01.srve.cc">
  </div>
  <div class="filter-group">
    <label>Direction</label>
    <select name="dir">
      <option value="">All</option>
      <option value="inbound"${filter.dir === 'inbound' ? ' selected' : ''}>Inbound</option>
      <option value="outbound"${filter.dir === 'outbound' ? ' selected' : ''}>Outbound</option>
    </select>
  </div>
  <div class="filter-group">
    <label>Profile</label>
    <select name="profile">
      <option value="">All</option>
      <option value="wifi"${(filter.profile || filter.mode) === 'wifi' ? ' selected' : ''}>Wi-Fi</option>
      <option value="lte"${(filter.profile || filter.mode) === 'lte' ? ' selected' : ''}>LTE</option>
    </select>
  </div>
  <div class="filter-group">
    <label>Call-ID</label>
    <input type="text" name="callId" value="${escHtml(filter.callId || '')}" placeholder="SIP Call-ID substring">
  </div>
  <div class="filter-group">
    <label>Corr ID</label>
    <input type="text" name="corrId" value="${escHtml(filter.corrId || '')}" placeholder="X-WebRTC-CorrId">
  </div>
  <div class="filter-group">
    <label>Event type</label>
    <input type="text" name="type" value="${escHtml(filter.type || '')}" placeholder="e.g. MEDIA-E001">
  </div>
  <div class="filter-group">
    <label>Show</label>
    <select name="errorsOnly">
      <option value="">All events</option>
      <option value="1"${filter.errorsOnly ? ' selected' : ''}>Errors only (MEDIA-E*)</option>
    </select>
  </div>
  <div class="filter-group">
    <label>Session</label>
    <select name="includeSession">
      <option value=""${includeSession ? '' : ' selected'}>Hide session events</option>
      <option value="1"${includeSession ? ' selected' : ''}>Include session events</option>
    </select>
  </div>
  <button type="submit" class="btn">Filter</button>
  <a href="/admin/calllogs" class="btn btn-clear">Clear</a>
</form>

<div class="table-wrap">
<table>
  <thead>
    <tr>
      ${viewMode === 'summary' ? '<th></th>' : ''}
      <th>Timestamp</th>
      ${viewMode === 'summary' ? '<th>Stage</th>' : ''}
      <th>Username</th>
      ${viewMode === 'summary' ? '' : '<th>Domain</th>'}
      <th>AOR</th>
      <th>Direction</th>
      <th>Peer</th>
      <th>Event</th>
      <th>Profile</th>
      <th>Call-ID</th>
      <th>Candidate summary</th>
      <th>Message</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>
</div>

<div class="legend">
  <h3>Event types reference</h3>
  <div class="legend-item"><span class="legend-code">MEDIA-E001</span><span>Relay not found — TURN unreachable in relay-only mode (zero relay candidates gathered)</span></div>
  <div class="legend-item"><span class="legend-code">MEDIA-E002</span><span>ICE timeout — gathering timed out, no candidates found in time</span></div>
  <div class="legend-item"><span class="legend-code">MEDIA-E003</span><span>Secure media failed — DTLS/SRTP did not complete (server-side only, not client-reported)</span></div>
  <div class="legend-item"><span class="legend-code">MEDIA-E004</span><span>No audio — call established but zero RTP packets on browser leg</span></div>
  <div class="legend-item"><span class="legend-ok">ice-relay-ok</span><span>LTE mode — relay candidates found, media path should be viable</span></div>
  <div class="legend-item"><span class="legend-ok">ua-ice-policy</span><span>UA built — ICE policy logged (relay = LTE mode active)</span></div>
  <div class="legend-item"><span class="legend-ok">ice-complete</span><span>ICE gathering completed — candidate summary</span></div>
</div>

<script>
  // No auto-refresh. Manual reload only (prevents log jumping while reading).

  (function() {
    function buildQs(params) {
      const usp = new URLSearchParams();
      for (const k in params) {
        if (!Object.prototype.hasOwnProperty.call(params, k)) continue;
        const v = params[k];
        if (v === undefined || v === null) continue;
        const s = String(v);
        if (!s) continue;
        usp.set(k, s);
      }
      const q = usp.toString();
      return q ? ('?' + q) : '';
    }

    function selectedKeys() {
      const nodes = document.querySelectorAll('input.row-sel:checked');
      const out = [];
      nodes.forEach((n) => {
        const k = n.getAttribute('data-key') || '';
        if (k) out.push(k);
      });
      return out;
    }

    function currentFilters() {
      const f = document.querySelector('form.filter-form');
      if (!f) return {};
      const fd = new FormData(f);
      const o = {};
      fd.forEach((v, k) => { o[k] = String(v); });
      return o;
    }

    function setDisplay(node, show) {
      if (!node) return;
      const d = node.getAttribute('data-show') || '';
      node.style.display = show ? d : 'none';
    }

    function updateLatestExportLinks() {
      const callerEl = document.getElementById('exportCaller');
      const receiverEl = document.getElementById('exportReceiver');
      const caller = callerEl ? String(callerEl.value || '').trim() : '';
      const receiver = receiverEl ? String(receiverEl.value || '').trim() : '';

      const filterForm = document.querySelector('form.filter-form');
      if (filterForm) {
        const hc = filterForm.querySelector('input[name="exportCaller"]');
        const hr = filterForm.querySelector('input[name="exportReceiver"]');
        if (hc) hc.value = caller;
        if (hr) hr.value = receiver;
      }

      const callerJson = caller ? ('/admin/calllogs/latest-caller/export.json?caller=' + encodeURIComponent(caller)) : '';
      const callerCsv = caller ? ('/admin/calllogs/latest-caller/export.csv?caller=' + encodeURIComponent(caller)) : '';
      const callerPdf = caller ? ('/admin/calllogs/latest-caller/export.pdf?caller=' + encodeURIComponent(caller)) : '';
      const receiverJson = receiver ? ('/admin/calllogs/latest-receiver/export.json?receiver=' + encodeURIComponent(receiver)) : '';
      const receiverCsv = receiver ? ('/admin/calllogs/latest-receiver/export.csv?receiver=' + encodeURIComponent(receiver)) : '';
      const receiverPdf = receiver ? ('/admin/calllogs/latest-receiver/export.pdf?receiver=' + encodeURIComponent(receiver)) : '';
      const pairJson = (caller && receiver)
        ? ('/admin/calllogs/latest-pair/export.json?caller=' + encodeURIComponent(caller) + '&receiver=' + encodeURIComponent(receiver))
        : '';
      const pairCsv = (caller && receiver)
        ? ('/admin/calllogs/latest-pair/export.csv?caller=' + encodeURIComponent(caller) + '&receiver=' + encodeURIComponent(receiver))
        : '';
      const pairPdf = (caller && receiver)
        ? ('/admin/calllogs/latest-pair/export.pdf?caller=' + encodeURIComponent(caller) + '&receiver=' + encodeURIComponent(receiver))
        : '';

      const scopeCaller = document.getElementById('exportScopeCaller');
      const scopeReceiver = document.getElementById('exportScopeReceiver');
      const scopePair = document.getElementById('exportScopePair');

      const cJson0 = document.getElementById('exportLatestCallerJson0');
      const cCsv0 = document.getElementById('exportLatestCallerCsv0');
      const cPdf0 = document.getElementById('exportLatestCallerPdf0');
      const rJson0 = document.getElementById('exportLatestReceiverJson0');
      const rCsv0 = document.getElementById('exportLatestReceiverCsv0');
      const rPdf0 = document.getElementById('exportLatestReceiverPdf0');
      const pJson0 = document.getElementById('exportLatestPairJson0');
      const pCsv0 = document.getElementById('exportLatestPairCsv0');
      const pPdf0 = document.getElementById('exportLatestPairPdf0');

      if (cJson0) cJson0.textContent = callerJson;
      if (cCsv0) cCsv0.textContent = callerCsv;
      if (cPdf0) cPdf0.textContent = callerPdf;
      if (rJson0) rJson0.textContent = receiverJson;
      if (rCsv0) rCsv0.textContent = receiverCsv;
      if (rPdf0) rPdf0.textContent = receiverPdf;
      if (pJson0) pJson0.textContent = pairJson;
      if (pCsv0) pCsv0.textContent = pairCsv;
      if (pPdf0) pPdf0.textContent = pairPdf;

      setDisplay(scopeCaller, !!caller);
      setDisplay(scopeReceiver, !!receiver);
      setDisplay(scopePair, !!(caller && receiver));
    }

    function readUrlFromSpan(id) {
      const el = document.getElementById(id);
      return el ? String(el.textContent || '').trim() : '';
    }

    function wireLatest(scopeBtnId, formatSelId, urls) {
      const btn = document.getElementById(scopeBtnId);
      const sel = document.getElementById(formatSelId);
      if (!btn || !sel) return;
      btn.addEventListener('click', () => {
        const fmt = String(sel.value || 'json');
        const url = (fmt === 'csv') ? readUrlFromSpan(urls.csv)
          : (fmt === 'pdf') ? readUrlFromSpan(urls.pdf)
            : readUrlFromSpan(urls.json);
        if (url) window.location.href = url;
      });
    }

    function wire(btnId, path) {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      btn.addEventListener('click', () => {
        const keys = selectedKeys();
        const filters = currentFilters();
        const url = path + buildQs({ ...filters, keys: keys.join(',') });
        window.location.href = url;
      });
    }

    const updateBtn = document.getElementById('updateExportFields');
    if (updateBtn) {
      updateBtn.addEventListener('click', (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        updateLatestExportLinks();
      });
    }

    updateLatestExportLinks();
    wireLatest('exportLatestCaller', 'exportFormatCaller', { json: 'exportLatestCallerJson0', csv: 'exportLatestCallerCsv0', pdf: 'exportLatestCallerPdf0' });
    wireLatest('exportLatestReceiver', 'exportFormatReceiver', { json: 'exportLatestReceiverJson0', csv: 'exportLatestReceiverCsv0', pdf: 'exportLatestReceiverPdf0' });
    wireLatest('exportLatestPair', 'exportFormatPair', { json: 'exportLatestPairJson0', csv: 'exportLatestPairCsv0', pdf: 'exportLatestPairPdf0' });
    wire('exportSelectedJson', '/admin/calllogs/export.json');
    wire('exportSelectedCsv', '/admin/calllogs/export.csv');
  })();
</script>
</body>
</html>`;
}

module.exports = { renderCallLogPage };
