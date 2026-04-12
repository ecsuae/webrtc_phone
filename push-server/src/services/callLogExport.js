'use strict';

function safeStr(v) {
  if (v === undefined || v === null) return '';
  return String(v);
}

function corrKey(ev) {
  return (ev && (ev.corrId || ev.callId)) || '';
}

function parseTsMs(ts) {
  if (!ts) return null;
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? ms : null;
}

function pickTs(ev) {
  return ev.ts || ev._serverTs || null;
}

function groupCalls(events) {
  const byKey = new Map();
  for (const ev of Array.isArray(events) ? events : []) {
    const k = corrKey(ev);
    if (!k) continue;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(ev);
  }
  return byKey;
}

function buildCallSummary(events) {
  const evs = Array.isArray(events) ? events : [];
  const types = new Set(evs.map((e) => e.type).filter(Boolean));
  const codes = new Set(evs.map((e) => e.code).filter(Boolean));
  const dirs = new Set(evs.map((e) => e.dir).filter(Boolean));

  const milestones = {
    hasInvite: types.has('invite-sent') || types.has('outbound-invite-sent') || types.has('incoming-call') || types.has('media-offer-incoming'),
    hasEstablished: types.has('call-established') || types.has('outbound-call-established') || types.has('inbound-call-established'),
    hasEnded: types.has('call-ended') || types.has('outbound-call-end') || types.has('inbound-call-end'),
  };

  const problems = {
    oneWayAudioSuspected: types.has('one-way-audio-suspected'),
    noInboundRtp: types.has('no-inbound-rtp') || types.has('outbound-inbound-rtp-zero') || types.has('inbound-inbound-rtp-zero'),
    missingRemoteAudioPlayOk: !types.has('remote-audio-play-ok') && (types.has('call-established') || types.has('outbound-call-established') || types.has('inbound-call-established')),
    probableLteReceivePathFailure: types.has('probable-lte-receive-path-failure'),
  };

  const mediaErrors = [...codes].filter((c) => safeStr(c).startsWith('MEDIA-E'));

  return {
    directionsPresent: [...dirs],
    milestones,
    problems,
    mediaErrors,
  };
}

function buildExportBundle({ events, filters, viewMode }) {
  const exportedAt = new Date().toISOString();
  const byKey = groupCalls(events);

  const calls = [];
  for (const [key, evs0] of byKey.entries()) {
    const evs = [...evs0].sort((a, b) => {
      const am = parseTsMs(pickTs(a));
      const bm = parseTsMs(pickTs(b));
      if (am === null && bm === null) return 0;
      if (am === null) return 1;
      if (bm === null) return -1;
      return am - bm;
    });

    const corrId = evs.find((e) => e.corrId)?.corrId || undefined;
    const sipCallIds = [...new Set(evs.map((e) => e.callId).filter(Boolean))];
    const users = [...new Set(evs.map((e) => e.username || (e.aor ? String(e.aor).split('@')[0] : '')).filter(Boolean))];
    const aors = [...new Set(evs.map((e) => e.aor).filter(Boolean))];
    const profiles = [...new Set(evs.map((e) => e.selectedProfile || e.mode).filter(Boolean))];
    const dirs = [...new Set(evs.map((e) => e.dir).filter(Boolean))];

    const startTs = (() => {
      for (const e of evs) {
        const t = pickTs(e);
        if (t) return t;
      }
      return null;
    })();

    const endTs = (() => {
      for (let i = evs.length - 1; i >= 0; i--) {
        const t = pickTs(evs[i]);
        if (t) return t;
      }
      return null;
    })();

    calls.push({
      corrKey: key,
      corrId,
      sipCallIds,
      users,
      aors,
      profiles,
      directionsPresent: dirs,
      startTs,
      endTs,
      summary: buildCallSummary(evs),
      events: evs,
    });
  }

  calls.sort((a, b) => {
    const am = parseTsMs(a.startTs);
    const bm = parseTsMs(b.startTs);
    if (am === null && bm === null) return 0;
    if (am === null) return 1;
    if (bm === null) return -1;
    return bm - am;
  });

  return {
    exportedAt,
    filters: filters || {},
    viewMode: viewMode || 'raw',
    callCount: calls.length,
    calls,
  };
}

function csvEscape(v) {
  const s = safeStr(v);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function renderEventsCsv(events) {
  const cols = [
    'ts', '_serverTs',
    'username', 'domain', 'aor', 'dir', 'peer', 'peerAor',
    'mode', 'selectedProfile', 'icePolicy',
    'corrId', 'callId', 'sessionId',
    'type', 'code',
    'localMicTrackId',
    'senderTrackId', 'senderTrackReadyState', 'senderTrackEnabled',
    'candSummary', 'selectedPair',
    'localCandidateType', 'remoteCandidateType',
    'dtlsState', 'connectionState', 'iceConnectionState',
    'inboundAudioPacketsReceived', 'inboundAudioBytesReceived', 'inboundAudioPacketsLost', 'inboundAudioJitter',
    'outboundAudioPacketsSent', 'outboundAudioBytesSent',
    'outboundAudioLevel', 'outboundTotalAudioEnergy',
    'packetsReceived', 'bytesReceived', 'packetsSent', 'bytesSent',
    'msg',
  ];

  const lines = [];
  lines.push(cols.join(','));
  for (const ev of Array.isArray(events) ? events : []) {
    const row = cols.map((c) => csvEscape(ev[c]));
    lines.push(row.join(','));
  }
  return lines.join('\n') + '\n';
}

module.exports = {
  corrKey,
  buildExportBundle,
  renderEventsCsv,
  groupCalls,
};
