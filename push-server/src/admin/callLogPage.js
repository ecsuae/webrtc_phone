'use strict';

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
  const caller = buildLegSummary(events, 'outbound');
  const callee = buildLegSummary(events, 'inbound');

  const boolCell = (v) => {
    if (v === true) return 'yes';
    if (v === false) return 'no';
    return 'unknown';
  };

  const warn = (!caller.any || !callee.any)
    ? `<div class="legend" style="margin-top: 0; margin-bottom: 12px; border-color: rgba(224,90,90,.45);">
  <h3 style="color: var(--red);">WARNING: ${!caller.any ? 'caller leg logs missing' : ''}${(!caller.any && !callee.any) ? ' and ' : ''}${!callee.any ? 'callee leg logs missing' : ''}</h3>
  <div style="margin-top: 6px;">PROBLEM: incomplete observability for ${!caller.any ? 'caller' : 'callee'} leg</div>
</div>`
    : '';

  const asym = deriveAsymmetricDirectionDiagnosis(events);
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

function canonicalType(ev) {
  const t = ev.type || '';
  if (!t) return '';

  if (t === 'outbound-invite-sent') return 'invite-sent';
  if (t === 'outbound-remote-audio-attached') return 'remote-audio-attached';
  if (t === 'outbound-call-established') return 'call-established';
  if (t === 'call-established') return 'call-established';
  if (t === 'media-answer-outgoing') return 'call-established';
  if (t === 'outbound-preflight-complete') return 'outbound-preflight-result';
  if (t === 'outbound-preflight-result') return 'outbound-preflight-result';
  if (t === 'preflight-complete') return 'outbound-preflight-result';
  if (t === 'outbound-preflight-start') return 'outbound-preflight-result';
  if (t === 'preflight-ok') return 'outbound-preflight-result';
  if (t === 'preflight-fail') return 'outbound-preflight-result';

  if (t === 'outbound-preflight-icecandidateerror') return 'preflight-icecandidateerror';

  if (t === 'outbound-remote-audio-play-ok') return 'remote-audio-play-ok';
  if (t === 'outbound-remote-audio-play-failed') return 'remote-audio-play-failed';

  if (t === 'outbound-remote-track-added') return 'remote-audio-track-added';

  return t;
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

function getLatestMediaStatsByDir(events) {
  const byDir = { inbound: null, outbound: null };
  const rank = (t) => {
    if (t === 'media-stats-10s') return 3;
    if (t === 'media-stats-5s') return 2;
    if (t === 'media-stats-2s') return 1;
    return 0;
  };
  for (const ev of events || []) {
    const t = ev.type || '';
    if (!t.startsWith('media-stats-')) continue;
    const dir = ev.dir === 'inbound' ? 'inbound' : (ev.dir === 'outbound' ? 'outbound' : null);
    if (!dir) continue;
    const prev = byDir[dir];
    if (!prev || rank(t) > rank(prev.type || '')) byDir[dir] = ev;
  }
  return byDir;
}

function buildCallDiagnosis(events) {
  const evs = Array.isArray(events) ? events : [];
  const hasEstablished = evs.some((e) => canonicalType(e) === 'call-established');
  const hasIceComplete = evs.some((e) => canonicalType(e) === 'ice-complete');
  const hasMediaError = evs.some((e) => (e.code || '').startsWith('MEDIA-E'));
  const hasPlayOk = evs.some((e) => canonicalType(e) === 'remote-audio-play-ok');
  const hasPlayFail = evs.some((e) => canonicalType(e) === 'remote-audio-play-failed');
  const hasNoPlay = evs.some((e) => canonicalType(e) === 'no-remote-audio-play');
  const hasRelayMismatch = evs.some((e) => canonicalType(e) === 'selected-pair-relay-mismatch');

  const stats = getLatestMediaStatsByDir(evs);
  const o = stats.outbound;
  const i = stats.inbound;

  const outboundOut = o?.outboundAudioPacketsSent;
  const outboundIn = o?.inboundAudioPacketsReceived;
  const inboundOut = i?.outboundAudioPacketsSent;
  const inboundIn = i?.inboundAudioPacketsReceived;

  const oneWaySuspected = Boolean(
    hasEstablished
    && (
      (typeof outboundOut === 'number' && outboundOut > 0 && typeof outboundIn === 'number' && outboundIn === 0)
      || (typeof inboundOut === 'number' && inboundOut > 0 && typeof inboundIn === 'number' && inboundIn === 0)
      || (hasEstablished && !hasPlayOk)
      || hasPlayFail
      || hasNoPlay
      || hasRelayMismatch
    )
  );

  const suspectedMsg = (() => {
    const parts = [];
    if (typeof outboundOut === 'number' || typeof outboundIn === 'number') {
      parts.push(`caller(outbound) sent=${outboundOut ?? '?'} recv=${outboundIn ?? '?'}`);
    }
    if (typeof inboundOut === 'number' || typeof inboundIn === 'number') {
      parts.push(`callee(inbound) sent=${inboundOut ?? '?'} recv=${inboundIn ?? '?'}`);
    }
    if (!hasPlayOk) parts.push('missing remote-audio-play-ok');
    if (hasPlayFail) parts.push('remote-audio-play-failed');
    if (hasNoPlay) parts.push('no-remote-audio-play');
    if (hasRelayMismatch) parts.push('selected-pair-relay-mismatch');
    return parts.join(' | ');
  })();

  return {
    hasEstablished,
    hasIceComplete,
    hasMediaError,
    hasPlayOk,
    oneWaySuspected,
    suspectedMsg,
    stats,
  };
}

function renderMediaDiagnosisBlock(events) {
  const diag = buildCallDiagnosis(events);
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
  const byCallId = new Map();
  for (const ev of input) {
    if (!ev.callId) continue;
    if (!byCallId.has(ev.callId)) byCallId.set(ev.callId, []);
    byCallId.get(ev.callId).push(ev);
  }
  const callProblem = new Map();
  for (const [callId, evs] of byCallId.entries()) {
    const d = buildCallDiagnosis(evs);
    if (d.oneWaySuspected) callProblem.set(callId, d);
  }

  const callMissingLeg = new Set();
  for (const [callId, evs] of byCallId.entries()) {
    const dirs = new Set(evs.map((e) => e.dir).filter(Boolean));
    if (dirs.size === 1) callMissingLeg.add(callId);
  }

  // 0) Build one canonical preflight row per callId+dir
  const preflightByKey = new Map();
  for (const ev of input) {
    if (!ev.callId) continue;
    if (!isPreflightFamily(ev)) continue;
    const dir = ev.dir || '';
    const k = `${ev.callId}|${dir}`;
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
    if (!ev.callId) continue;
    const ts = ev.ts || ev._serverTs;
    const ms = parseTsMs(ts);
    if (ms === null) continue;
    const bucket = Math.floor(ms / bucketMs);
    const k = `${ev.callId}|${t}|${bucket}`;

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
  for (const [callId, d] of callProblem.entries()) {
    const rep = (byCallId.get(callId) || [])[0] || {};
    out.push({
      _seq: rep._seq,
      ts: rep.ts,
      _serverTs: rep._serverTs,
      type: 'one-way-audio-suspected',
      callId,
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

    if (callMissingLeg.has(callId)) {
      out.push({
        _seq: rep._seq,
        ts: rep.ts,
        _serverTs: rep._serverTs,
        type: 'probable-lte-receive-path-failure',
        callId,
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
  for (const callId of callMissingLeg) {
    if (callProblem.has(callId)) continue; // already covered above
    const evs = byCallId.get(callId) || [];
    const rep = evs[0] || {};
    const dirs = [...new Set(evs.map((e) => e.dir).filter(Boolean))];
    out.push({
      _seq: rep._seq,
      ts: rep.ts,
      _serverTs: rep._serverTs,
      type: 'incomplete-observability',
      callId,
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

    const isSession = SESSION_EVENT_TYPES.has(ev.type) || (!ev.callId && !((ev.code || '').startsWith('MEDIA-E')));
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
    if (!ev.callId && !isMediaError) {
      if (!(includeSession && SESSION_EVENT_TYPES.has(ev.type))) continue;
    }

    // Replace any preflight-family row with the canonical preflight-result for this callId+dir (emitted once)
    if (ev.callId && (ev.type === 'outbound-preflight-result') && isPreflightFamily(ev0)) {
      const k = `${ev.callId}|${ev.dir || ''}`;
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
    if (ev.type === 'preflight-icecandidateerror' && ev.callId) {
      const ts = ev.ts || ev._serverTs;
      const ms = parseTsMs(ts);
      if (ms !== null) {
        const bucket = Math.floor(ms / bucketMs);
        const k = `${ev.callId}|${ev.type}|${bucket}`;
        const n = aggCounts.get(k) || 1;
        if (n > 1) ev._aggCount = n;

        const best = aggBest.get(k);
        if (best && best.msg) ev.msg = best.msg;
      }
    }

    // 2) Collapse duplicates: only one canonical row per milestone per callId+dir
    if (ev.callId) {
      const k = `${ev.callId}|${ev.dir || ''}|${isMediaError ? (ev.code || '') : ev.type}`;
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

  const callIdShort = ev.callId
    ? (ev.callId.slice(0, 18) + (ev.callId.length > 18 ? '…' : ''))
    : '—';
  const traceLink = ev.callId
    ? `<a class="trace-link" href="/admin/calllogs${buildQueryString({ callId: ev.callId, view: 'raw' })}">trace</a>`
    : '';

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

  return `<tr${rowClass}>
    <td class="ts-cell" title="UTC ${escHtml(rawTs || '')}">${escHtml(ts)}</td>
    ${viewMode === 'summary' ? `<td class="stage-cell">${escHtml(stage)}</td>` : ''}
    <td>${escHtml(username)}</td>
    ${viewMode === 'summary' ? '' : `<td>${escHtml(domain)}</td>`}
    <td>${escHtml(aor)}</td>
    <td>${escHtml(direction)}</td>
    <td class="peer-cell">${escHtml(peer)}</td>
    ${eventCell}
    ${modeCell}
    <td class="callid-cell" title="${escHtml(ev.callId || '')}">${escHtml(callIdShort)} ${traceLink}</td>
    <td class="cand-cell" title="${escHtml(selectedPairCell)}">${candCell}</td>
    <td class="msg-cell">${msgCellHtml}</td>
  </tr>`;
}

function renderCallLogPage(events, stats, filter) {
  const isTraceView = !!(filter && filter.callId);
  const viewMode = isTraceView
    ? 'raw'
    : ((filter && String(filter.view).toLowerCase() === 'raw') ? 'raw' : 'summary');

  const includeSession = !!(filter && filter.includeSession);

  const traceDiagHtml = isTraceView ? (renderLegSummaryBlock(events) + renderMediaDiagnosisBlock(events)) : '';

  const pageEvents = viewMode === 'summary'
    ? applySummaryTransforms(events, { includeSession })
    : (Array.isArray(events) ? events : []);

  const rows = pageEvents.length > 0
    ? pageEvents.map((ev) => renderEventRow(ev, viewMode)).join('\n')
    : '<tr><td colspan="11" class="no-results">No events match the current filter.</td></tr>';

  const toggleQsBase = {
    ...filter,
    view: undefined,
    includeSession: includeSession ? '1' : undefined,
  };
  const summaryHref = `/admin/calllogs${buildQueryString({ ...toggleQsBase, view: 'summary' })}`;
  const rawHref = `/admin/calllogs${buildQueryString({ ...toggleQsBase, view: 'raw' })}`;

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
</script>
</body>
</html>`;
}

module.exports = { renderCallLogPage };
