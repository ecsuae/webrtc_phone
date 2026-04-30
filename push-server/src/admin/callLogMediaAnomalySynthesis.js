'use strict';

const { corrKey } = require('./callLogCoreUtils');
const { canonicalType } = require('../services/callDiagnosis');

function buildMediaAnomalySummaryRows(events) {
  const input = Array.isArray(events) ? events : [];

  const primaryCorrIdByCallId = (() => {
    const out = new Map();
    for (const ev of input) {
      const callId = ev && ev.callId;
      const corrId = ev && ev.corrId;
      if (!callId || !corrId) continue;
      if (!out.has(callId)) out.set(callId, corrId);
    }
    return out;
  })();

  const byCorr = new Map();
  for (const ev of input) {
    const callId = ev && ev.callId;
    const primaryCorrId = callId ? primaryCorrIdByCallId.get(callId) : '';
    const k = primaryCorrId || corrKey(ev);
    if (!k) continue;
    if (!byCorr.has(k)) byCorr.set(k, []);
    byCorr.get(k).push(ev);
  }

  const out = [];

  const asNum = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const asStr = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

  const getBase = (evs) => {
    const rep = evs[0] || {};
    return {
      _seq: rep._seq,
      ts: rep.ts || rep._serverTs,
      _serverTs: rep._serverTs,
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
    };
  };

  const computeQualityWarn = (evs, dir) => {
    let best = null;
    for (const ev0 of evs) {
      if ((ev0.dir || '') !== dir) continue;
      const t = canonicalType(ev0);
      if (t !== 'receive-render-proof' && t !== 'outbound-inbound-rtp-present' && !t.startsWith('media-stats-')) continue;

      const concealed = asNum(ev0.concealedSamples);
      const decoded = asNum(ev0.totalSamplesDecoded);
      if (concealed === null || decoded === null || decoded <= 0) continue;

      const frac = concealed / decoded;
      const warn = (concealed > 5000) || (frac > 0.08);
      if (!warn) continue;

      const msg = `audio-quality-anomaly concealed=${concealed} decoded=${decoded} (${String(frac).slice(0, 6)})`;
      best = best ? best : msg;
    }
    return best;
  };

  const getLegEvidence = (evs, dir) => {
    const leg = {
      dir,
      signaling: { conn: null, ice: null, dtls: null },
      playOk: false,
      trackAttached: false,
      recvRtp: null,
      sentRtp: null,
      audioEnergy: false,
      codec: null,
    };
    for (const ev0 of evs) {
      if ((ev0.dir || '') !== dir) continue;
      const t = canonicalType(ev0);
      if (t === 'outbound-connection-state') leg.signaling.conn = asStr(ev0.connectionState) || leg.signaling.conn;
      if (t === 'outbound-ice-connection-state') leg.signaling.ice = asStr(ev0.iceConnectionState) || leg.signaling.ice;
      if (t === 'outbound-dtls-state') leg.signaling.dtls = asStr(ev0.dtlsState) || leg.signaling.dtls;
      if (t === 'remote-audio-attached' || t === 'remote-audio-track-added') leg.trackAttached = true;
      if (t === 'remote-audio-play-ok') leg.playOk = true;

      const recv = asNum(ev0.inboundAudioPacketsReceived);
      const sent = asNum(ev0.outboundAudioPacketsSent);
      if (recv !== null) leg.recvRtp = (leg.recvRtp === null) ? recv : Math.max(leg.recvRtp, recv);
      if (sent !== null) leg.sentRtp = (leg.sentRtp === null) ? sent : Math.max(leg.sentRtp, sent);

      const audioLevel = asNum(ev0.audioLevel);
      const totalAudioEnergy = asNum(ev0.totalAudioEnergy);
      if ((audioLevel !== null && audioLevel > 0) || (totalAudioEnergy !== null && totalAudioEnergy > 0)) leg.audioEnergy = true;

      const codec = asStr(ev0.inboundCodecMimeType);
      if (codec) leg.codec = codec;
    }
    return leg;
  };

  const confidenceFor = (leg) => {
    const hasRtp = (leg.recvRtp !== null && leg.recvRtp > 0) || (leg.sentRtp !== null && leg.sentRtp > 0);
    if (hasRtp && (leg.playOk || leg.audioEnergy)) return 'high';
    if (hasRtp || leg.trackAttached || leg.playOk) return 'medium';
    return 'low';
  };

  const oneWayDiagnosisFor = ({ inbound, outbound }) => {
    const inRecv = (inbound.recvRtp !== null && inbound.recvRtp > 0);
    const outRecv = (outbound.recvRtp !== null && outbound.recvRtp > 0);
    const inRender = inbound.playOk || inbound.audioEnergy;
    const outRender = outbound.playOk || outbound.audioEnergy;
    if ((inRecv && inRender) && (outRecv && outRender)) return 'two-way-audio-proven';
    if ((outbound.sentRtp || 0) > 0 && !inRecv) return 'far-end-to-local-missing';
    if ((inbound.sentRtp || 0) > 0 && !outRecv) return 'local-to-far-end-missing';
    if (inRecv && !inRender) return 'playback-path-suspect';
    if (outRecv && !outRender) return 'capture-path-suspect';
    return 'insufficient-proof';
  };

  for (const [key, evs] of byCorr.entries()) {
    const base = getBase(evs);

    const inbound = getLegEvidence(evs, 'inbound');
    const outbound = getLegEvidence(evs, 'outbound');
    const inConf = confidenceFor(inbound);
    const outConf = confidenceFor(outbound);
    const diag = oneWayDiagnosisFor({ inbound, outbound });

    const inboundMediaArrived = inbound.trackAttached && ((inbound.recvRtp !== null && inbound.recvRtp > 0) || inbound.audioEnergy);
    const outboundMediaArrived = outbound.trackAttached && ((outbound.recvRtp !== null && outbound.recvRtp > 0) || outbound.audioEnergy);
    const inboundPlaybackMissing = inboundMediaArrived && !inbound.playOk;
    const outboundPlaybackMissing = outboundMediaArrived && !outbound.playOk;

    const verdictEnum = (() => {
      const outboundProven = (outConf === 'high') && outbound.playOk && (outbound.recvRtp !== null && outbound.recvRtp > 0);
      const inboundProven = (inConf === 'high') && inbound.playOk && (inbound.recvRtp !== null && inbound.recvRtp > 0);
      if (outboundProven && inboundProven) return 'two-way-audio-proven';
      if ((outboundProven && inboundPlaybackMissing) || (inboundProven && outboundPlaybackMissing)) return 'possible-playback-path-issue';
      if (outboundProven || inboundProven) return 'asymmetric-media-proof';
      if (diag === 'insufficient-proof') return 'insufficient-proof';
      return diag;
    })();

    const inQ = computeQualityWarn(evs, 'inbound');
    const outQ = computeQualityWarn(evs, 'outbound');
    if (inQ) out.push({ ...base, type: 'audio-quality-anomaly', dir: 'inbound', msg: inQ });
    if (outQ) out.push({ ...base, type: 'audio-quality-anomaly', dir: 'outbound', msg: outQ });

    const reciprocalMissing = verdictEnum === 'asymmetric-media-proof' || verdictEnum === 'possible-playback-path-issue';
    if (reciprocalMissing) {
      const outboundStrongRender = outbound.playOk && (outbound.recvRtp !== null && outbound.recvRtp > 0) && (outConf === 'high');
      const inboundStrongRender = inbound.playOk && (inbound.recvRtp !== null && inbound.recvRtp > 0) && (inConf === 'high');
      const inboundArrivedNoPlay = inboundPlaybackMissing;
      const outboundArrivedNoPlay = outboundPlaybackMissing;

      const parts = [];
      if (outboundStrongRender) parts.push('outbound has strong receive+render proof');
      if (inboundStrongRender) parts.push('inbound has strong receive+render proof');
      if (inboundArrivedNoPlay) parts.push('inbound shows media arrival (track+RTP/energy) but missing play-ok');
      if (outboundArrivedNoPlay) parts.push('outbound shows media arrival (track+RTP/energy) but missing play-ok');
      if (!parts.length) parts.push('reciprocal proof missing (see per-leg media verdict evidence)');

      out.push({
        ...base,
        type: 'reciprocal-proof-missing',
        dir: base.dir,
        synthVerdict: verdictEnum,
        msg: `verdict=${verdictEnum} | ${parts.join('; ')}`,
      });
    }

    const outboundStrongRender = outbound.playOk && (outbound.recvRtp !== null && outbound.recvRtp > 0) && (outConf === 'high');
    const inboundPartial = inbound.trackAttached && (inbound.recvRtp !== null && inbound.recvRtp > 0) && !inbound.playOk;

    if (outboundStrongRender && inboundPartial) {
      out.push({
        ...base,
        type: 'android-playback-path-suspect',
        dir: 'inbound',
        synthVerdict: 'possible-playback-path-issue',
        msg: `verdict=possible-playback-path-issue | media likely arrived on inbound leg (track+RTP present) but playback proof is incomplete (missing play-ok); check Android audio output/routing`,
      });
    }
  }

  return out;
}

module.exports = { buildMediaAnomalySummaryRows };
