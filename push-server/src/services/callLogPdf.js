'use strict';

const PDFDocument = require('pdfkit');

const { inferCallClass } = require('./callClassification');

const {
  canonicalType,
  getLatestMediaStatsByDir,
  buildCallDiagnosis,
  computeMissingLeg,
  computeProbableLteReceiveFailure,
} = require('./callDiagnosis');

function pickTs(ev) {
  return (ev && (ev.ts || ev._serverTs)) || '';
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
  const t = (ev && ev.type) || '';
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
  for (const k of ['code', 'url', 'transport', 'error', 'errorText']) {
    if (out[k] === undefined && ev[k] !== undefined) out[k] = ev[k];
  }
  return out;
}

const ADMIN_TIMEZONE = 'Asia/Karachi';
const ADMIN_TZ_LABEL = 'PKT';

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

const SESSION_EVENT_TYPES = new Set([
  'profile-selected',
  'ua-ice-policy',
  'profile-badge-rendered',
  'profile-toggle-changed',
]);

function parseTsMs(ts) {
  const d = new Date(ts);
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
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

function stageLabel(ev) {
  if (((ev && ev.code) || '').startsWith('MEDIA-E')) return 'Error';
  const t = canonicalType(ev);
  switch (t) {
    case 'profile-selected': return 'Profile selected';
    case 'ua-ice-policy': return 'ICE policy';
    case 'outbound-preflight-result': return 'Preflight result';
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
    case 'one-way-audio-suspected': return 'PROBLEM: one-way audio';
    case 'incomplete-observability': return 'PROBLEM: missing leg';
    case 'probable-lte-receive-path-failure': return 'PROBLEM: LTE no receive';
    default: return 'Event';
  }
}

function modeLabel(ev) {
  if (ev && ev.selectedProfile) return String(ev.selectedProfile);
  if (ev && ev.mode) return String(ev.mode);
  if (ev && ev.lteMode === true) return 'lte';
  if (ev && ev.lteMode === false) return 'wifi';
  return '';
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

function corrKey(ev) {
  return (ev && (ev.corrId || ev.callId)) || '';
}

function buildHumanSummaryEvents(events) {
  const input0 = Array.isArray(events) ? events : [];
  const input = input0.filter((ev) => (ev && typeof ev === 'object') ? ((ev.type || '') !== 'call-log-post-flush-ok') : false);

  // Build per-corrKey groups for derived rows.
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

  // Preflight canonical row per corrKey+dir
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

  // Aggregate preflight icecandidateerror spam into 5s buckets
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

  // Emit derived PROBLEM rows
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
        peerAor: rep.peerAor,
        lteMode: rep.lteMode,
        mode: rep.mode,
        selectedProfile: rep.selectedProfile,
        icePolicy: rep.icePolicy,
        msg: 'PROBLEM: probable LTE receive-path failure (opposite leg logs missing)',
      });
    }
  }

  for (const key of callMissingLeg) {
    if (callProblem.has(key)) continue;
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
    if (isSession) continue;

    const isMediaError = (ev.code || '').startsWith('MEDIA-E');
    if (!isMediaError) {
      if (ev.type.startsWith('media-stats-')) {
        if (!isSuspiciousStatsEvent(ev)) continue;
      } else if (!SUMMARY_MILESTONE_TYPES.has(ev.type)) {
        continue;
      }
    }

    if (!key && !isMediaError) continue;

    // Replace preflight-family with canonical preflight row (once per key+dir)
    if (key && ev.type === 'outbound-preflight-result' && isPreflightFamily(ev0)) {
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

    // Attach aggregated count + best msg to representative rows
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

    // Collapse duplicates: one per key+dir+type/code
    if (key) {
      const k = `${key}|${ev.dir || ''}|${isMediaError ? (ev.code || '') : ev.type}`;
      if (seenMilestone.has(k)) continue;
      seenMilestone.add(k);
    }

    out.push(ev);
  }

  return out;
}

function deriveCandSummary(ev) {
  if (!ev || typeof ev !== 'object') return '';
  if (typeof ev.candSummary === 'string' && ev.candSummary) return ev.candSummary;
  if (ev.relay !== undefined) {
    const relay = ev.relay ?? '?';
    const host = ev.host ?? '?';
    const srflx = ev.srflx ?? '?';
    const total = ev.total ?? '?';
    return `relay=${relay} host=${host} srflx=${srflx} total=${total}`;
  }
  return '';
}

function safeStr(v) {
  if (v === undefined || v === null) return '';
  return String(v);
}

function buildCallHeader(events) {
  const corrIds = [...new Set((events || []).map((e) => e.corrId).filter(Boolean))];
  const callIds = [...new Set((events || []).map((e) => e.callId).filter(Boolean))];
  const users = [...new Set((events || []).map((e) => e.username || (e.aor ? String(e.aor).split('@')[0] : '')).filter(Boolean))];
  const aors = [...new Set((events || []).map((e) => e.aor).filter(Boolean))];
  return {
    corrIds,
    callIds,
    users,
    aors,
  };
}

function renderCallPdfToStream({ title, events, filters, stream, viewMode }) {
  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  doc.pipe(stream);

  const isHuman = String(viewMode || 'human') !== 'raw';
  const chosen = isHuman ? buildHumanSummaryEvents(events) : (Array.isArray(events) ? [...events] : []);

  const evs = chosen.sort((a, b) => {
    const am = Date.parse(String(pickTs(a) || ''));
    const bm = Date.parse(String(pickTs(b) || ''));
    const aOk = Number.isFinite(am);
    const bOk = Number.isFinite(bm);
    if (!aOk && !bOk) return 0;
    if (!aOk) return 1;
    if (!bOk) return -1;
    return bm - am;
  });

  const exportedAt = new Date().toISOString();
  const hdr = buildCallHeader(evs);
  const evCount = evs.length;

  doc.fontSize(16).font('Helvetica-Bold').text(title || 'Call Log Export', { align: 'left' });
  doc.moveDown(0.5);
  doc.fontSize(9).font('Helvetica').fillColor('#555');
  doc.text(`exportedAt: ${exportedAt}`);
  doc.text(`eventCount: ${evCount}`);
  if (filters && Object.keys(filters).length) {
    doc.text(`filters: ${safeStr(JSON.stringify(filters))}`);
  }
  if (hdr.corrIds.length) doc.text(`corrId: ${hdr.corrIds.join(', ')}`);
  if (hdr.callIds.length) doc.text(`sipCallIds: ${hdr.callIds.join(', ')}`);
  if (hdr.users.length) doc.text(`users: ${hdr.users.join(', ')}`);
  if (hdr.aors.length) doc.text(`aors: ${hdr.aors.join(', ')}`);

  doc.moveDown(1);
  doc.fillColor('#000');

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottomY = () => doc.page.height - doc.page.margins.bottom;

  const baseCols = [
    { key: 'ts', title: 'Timestamp', w: 78 },
    { key: 'stage', title: 'Stage', w: 70 },
    { key: 'username', title: 'User', w: 42 },
    { key: 'aor', title: 'AOR', w: 88 },
    { key: 'dir', title: 'Dir', w: 40 },
    { key: 'peer', title: 'Peer', w: 88 },
    { key: 'event', title: 'Event', w: 90 },
    { key: 'profile', title: 'Profile', w: 44 },
    { key: 'callId', title: 'Call-ID', w: 76 },
    { key: 'cand', title: 'Cand', w: 92 },
  ];

  const fixedW = baseCols.reduce((sum, c) => sum + c.w, 0);
  const msgW = Math.max(140, pageWidth - fixedW);
  const cols = [...baseCols, { key: 'msg', title: 'Message', w: msgW }];

  function colXs() {
    const xs = [];
    let x = doc.page.margins.left;
    for (const c of cols) {
      xs.push(x);
      x += c.w;
    }
    return xs;
  }

  function cellHeight(text, w, fontSize) {
    const s = safeStr(text);
    if (!s) return doc.currentLineHeight(true);
    return doc.heightOfString(s, { width: w, lineGap: 2 });
  }

  function ensureSpace(rowH) {
    if (doc.y + rowH > bottomY() - 12) {
      doc.addPage();
      tableHeader();
    }
  }

  function tableHeader() {
    const xs = colXs();
    const y0 = doc.y;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#000');
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      doc.text(c.title, xs[i] + 2, y0, { width: c.w - 4, lineBreak: false });
    }
    doc.moveDown(0.8);
    const y1 = doc.y;
    doc.save();
    doc.lineWidth(0.5).strokeColor('#999');
    doc.moveTo(doc.page.margins.left, y1).lineTo(doc.page.width - doc.page.margins.right, y1).stroke();
    doc.restore();
    doc.moveDown(0.4);
  }

  tableHeader();

  doc.font('Helvetica').fontSize(8).fillColor('#000');

  for (const ev of evs) {
    const rawTs = ev.ts || ev._serverTs || '';
    const ts = safeStr(formatTs(rawTs));
    const stage = safeStr(stageLabel(ev));
    const username = safeStr(ev.username || (ev.aor ? String(ev.aor).split('@')[0] : ''));
    const domain = safeStr(ev.domain || (ev.aor ? String(ev.aor).split('@')[1] : ''));
    const aor = safeStr(ev.aor || (username && domain ? `${username}@${domain}` : ''));
    const dir = safeStr(ev.dir || '');
    const peer = safeStr(ev.peerAor || ev.peer || '');
    const eventLabel = safeStr(((ev.code || '').startsWith('MEDIA-E') ? ev.code : (ev.type || '')));
    const profile = safeStr(modeLabel(ev));

    const corrShort = ev.corrId ? safeStr(ev.corrId).slice(0, 10) : '';
    const callShort = ev.callId ? safeStr(ev.callId).slice(0, 10) : '';
    const callIdCell = (corrShort && callShort)
      ? `${corrShort}|${callShort}`
      : (corrShort || callShort || '');

    const cand0 = deriveCandSummary(ev);
    const sel = ev.selectedPair ? ` sel=${safeStr(ev.selectedPair)}` : '';
    const cand = safeStr((cand0 + sel).trim());
    const msg = safeStr(ev.msg || '').replace(/[\r\n]+/g, ' ').slice(0, 1200);

    const row = {
      ts,
      stage,
      username,
      aor,
      dir,
      peer,
      event: eventLabel,
      profile,
      callId: callIdCell,
      cand,
      msg,
    };

    const rowH = Math.max(
      ...cols.map((c) => cellHeight(row[c.key], c.w - 4, 8)),
      doc.currentLineHeight(true)
    );

    ensureSpace(rowH);

    const xs = colXs();
    const y0 = doc.y;
    doc.font('Helvetica').fontSize(8).fillColor('#000');
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      doc.text(row[c.key], xs[i] + 2, y0, { width: c.w - 4, lineGap: 2 });
    }

    doc.y = y0 + rowH + 2;
  }

  doc.end();
}

module.exports = { renderCallPdfToStream };
