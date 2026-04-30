'use strict';

const { corrKey } = require('./callLogCoreUtils');
const { canonicalType } = require('../services/callDiagnosis');

function synthesizeMediaVerdictRows(eventsByCorr, { callProblem } = {}) {
  const out = [];

  const asNum = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const asStr = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

  const getLegEvidence = (evs, dir) => {
    const e = {
      dir,
      signaling: { conn: null, ice: null, dtls: null },
      selectedPair: null,
      trackAttached: false,
      playOk: false,
      recvRtp: null,
      sentRtp: null,
      audioEnergy: false,
      codec: null,
    };

    for (const ev0 of evs) {
      if ((ev0.dir || '') !== dir) continue;
      const t = canonicalType(ev0);

      if (t === 'outbound-selected-pair-details') {
        e.selectedPair = asStr(ev0.candSummary) || asStr(ev0.selectedPair) || e.selectedPair;
      }

      if (t === 'outbound-connection-state') e.signaling.conn = asStr(ev0.connectionState) || e.signaling.conn;
      if (t === 'outbound-ice-connection-state') e.signaling.ice = asStr(ev0.iceConnectionState) || e.signaling.ice;
      if (t === 'outbound-dtls-state') e.signaling.dtls = asStr(ev0.dtlsState) || e.signaling.dtls;

      if (t === 'remote-audio-attached' || t === 'remote-audio-track-added') e.trackAttached = true;
      if (t === 'remote-audio-play-ok') e.playOk = true;

      const recv = asNum(ev0.inboundAudioPacketsReceived);
      const sent = asNum(ev0.outboundAudioPacketsSent);
      if (recv !== null) e.recvRtp = (e.recvRtp === null) ? recv : Math.max(e.recvRtp, recv);
      if (sent !== null) e.sentRtp = (e.sentRtp === null) ? sent : Math.max(e.sentRtp, sent);

      const audioLevel = asNum(ev0.audioLevel);
      const totalAudioEnergy = asNum(ev0.totalAudioEnergy);
      if ((audioLevel !== null && audioLevel > 0) || (totalAudioEnergy !== null && totalAudioEnergy > 0)) e.audioEnergy = true;

      const codec = asStr(ev0.inboundCodecMimeType);
      if (codec) e.codec = codec;
    }

    return e;
  };

  const confidenceFor = (leg) => {
    const hasRtp = (leg.recvRtp !== null && leg.recvRtp > 0) || (leg.sentRtp !== null && leg.sentRtp > 0);
    if (hasRtp && (leg.playOk || leg.audioEnergy)) return 'high';
    if (hasRtp || leg.trackAttached || leg.playOk) return 'medium';
    return 'low';
  };

  const legVerdictFor = (leg) => {
    const hasRecv = (leg.recvRtp !== null && leg.recvRtp > 0);
    const hasSent = (leg.sentRtp !== null && leg.sentRtp > 0);
    if (leg.playOk && hasRecv) return 'receive+render-ok';
    if (hasRecv && leg.playOk && !leg.audioEnergy) return 'rtp-present-render-suspect';
    if (hasRecv && !leg.playOk) return 'rtp-present-playback-unknown';
    if (!hasRecv && hasSent) return 'sending-only';
    if (!hasRecv && !hasSent && (leg.signaling.ice || leg.signaling.dtls)) return 'connected-but-no-rtp';
    return 'insufficient-proof';
  };

  const hasType = (evs, type, dir) => {
    for (const ev of evs) {
      if (dir && (ev.dir || '') !== dir) continue;
      if (canonicalType(ev) === type) return true;
    }
    return false;
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

  for (const [key, evs] of eventsByCorr.entries()) {
    const rep = evs[0] || {};
    const ts = rep.ts || rep._serverTs;

    const inbound = getLegEvidence(evs, 'inbound');
    const outbound = getLegEvidence(evs, 'outbound');

    const inConf = confidenceFor(inbound);
    const outConf = confidenceFor(outbound);

    const inVerdict = legVerdictFor(inbound);
    const outVerdict = legVerdictFor(outbound);

    const diag = oneWayDiagnosisFor({ inbound, outbound });

    const inboundTransportComplete = hasType(evs, 'call-established', 'inbound') && hasType(evs, 'ice-complete', 'inbound');
    const outboundTransportComplete = hasType(evs, 'call-established', 'outbound') && hasType(evs, 'ice-complete', 'outbound');
    const inboundHasRenderProof = hasType(evs, 'receive-render-proof', 'inbound');
    const outboundHasRenderProof = hasType(evs, 'receive-render-proof', 'outbound');

    const hasRtpEvidence = (leg) => {
      const recv = (leg.recvRtp !== null && leg.recvRtp > 0);
      const sent = (leg.sentRtp !== null && leg.sentRtp > 0);
      return recv || sent;
    };

    const diagnosticsIncompleteFor = (leg, { transportComplete, hasRenderProof } = {}) => {
      // Explicitly detect the parity gap: transport + RTP are proven but render-proof rows are missing.
      // This should NOT be treated as a likely media failure.
      const transportOk = !!transportComplete;
      const rtpOk = hasRtpEvidence(leg);
      const dtlsOk = String(leg?.signaling?.dtls || '').toLowerCase() === 'connected';
      return transportOk && rtpOk && dtlsOk && !hasRenderProof;
    };

    const verdictEnum = (() => {
      const outboundProven = (outVerdict === 'receive+render-ok') && (outConf === 'high');
      const inboundProven = (inVerdict === 'receive+render-ok') && (inConf === 'high');
      const reciprocalProven = outboundProven && inboundProven;
      const reciprocalPlayOk = inbound.playOk && outbound.playOk;

      const inboundMediaArrived = inbound.trackAttached && ((inbound.recvRtp !== null && inbound.recvRtp > 0) || inbound.audioEnergy);
      const outboundMediaArrived = outbound.trackAttached && ((outbound.recvRtp !== null && outbound.recvRtp > 0) || outbound.audioEnergy);
      const inboundPlaybackMissing = inboundMediaArrived && !inbound.playOk;
      const outboundPlaybackMissing = outboundMediaArrived && !outbound.playOk;

      const inboundPlaybackProofMissing = inbound.trackAttached && inboundTransportComplete && !inbound.playOk && !inboundHasRenderProof;
      const outboundPlaybackProofMissing = outbound.trackAttached && outboundTransportComplete && !outbound.playOk && !outboundHasRenderProof;

      const inboundDiagIncomplete = diagnosticsIncompleteFor(inbound, { transportComplete: inboundTransportComplete, hasRenderProof: inboundHasRenderProof });
      const outboundDiagIncomplete = diagnosticsIncompleteFor(outbound, { transportComplete: outboundTransportComplete, hasRenderProof: outboundHasRenderProof });

      if (reciprocalProven || reciprocalPlayOk) return 'two-way-audio-proven';
      if ((outboundProven && inboundPlaybackMissing) || (inboundProven && outboundPlaybackMissing)) return 'possible-playback-path-issue';
      if ((outboundProven && inboundPlaybackProofMissing) || (inboundProven && outboundPlaybackProofMissing)) return 'possible-playback-path-issue';
      // If reciprocal proof is missing but transport+RTP are already proven, classify as observability gap.
      if ((outboundProven || inboundProven) && (inboundDiagIncomplete || outboundDiagIncomplete)) return 'incomplete-observability';
      if (outboundProven || inboundProven) return 'asymmetric-media-proof';
      if (inboundDiagIncomplete || outboundDiagIncomplete) return 'incomplete-observability';
      if (diag === 'insufficient-proof') return 'insufficient-proof';
      return diag;
    })();

    const inboundMediaArrived = inbound.trackAttached && ((inbound.recvRtp !== null && inbound.recvRtp > 0) || inbound.audioEnergy);
    const outboundMediaArrived = outbound.trackAttached && ((outbound.recvRtp !== null && outbound.recvRtp > 0) || outbound.audioEnergy);
    const inboundPlaybackMissing = inboundMediaArrived && !inbound.playOk;
    const outboundPlaybackMissing = outboundMediaArrived && !outbound.playOk;

    const legSummary = (leg, verdict, conf) => {
      const rtp = (leg.recvRtp !== null && leg.recvRtp > 0) ? 'rtp' : '';
      const track = leg.trackAttached ? 'track' : '';
      const energy = leg.audioEnergy ? 'energy' : '';
      const arrivedBits = [track, rtp, energy].filter(Boolean).join('+') || 'no-evidence';
      const playback = leg.playOk ? 'play-ok' : 'no-play-ok';
      return `${verdict} (${conf}) [${arrivedBits}; ${playback}]`;
    };

    const conclusion = (() => {
      if (verdictEnum === 'two-way-audio-proven') return 'reciprocal strong receive+render proof on both legs';
      if (verdictEnum === 'incomplete-observability') return 'diagnostics incomplete: transport+RTP are present but receive/render proof is missing on one or both legs (parity gap)';
      if (verdictEnum === 'possible-playback-path-issue') {
        const inboundPlaybackProofMissing = inbound.trackAttached && inboundTransportComplete && !inbound.playOk && !inboundHasRenderProof;
        const outboundPlaybackProofMissing = outbound.trackAttached && outboundTransportComplete && !outbound.playOk && !outboundHasRenderProof;
        if (inboundPlaybackProofMissing && outboundMediaArrived) return 'call established and transport completed, but playback proof is missing on inbound leg (no play-ok and no receive-render-proof); outbound has strong render proof';
        if (outboundPlaybackProofMissing && inboundMediaArrived) return 'call established and transport completed, but playback proof is missing on outbound leg (no play-ok and no receive-render-proof); inbound has strong render proof';
        if (inboundPlaybackMissing && outboundMediaArrived) return 'media arrived on inbound leg but playback proof missing (no play-ok); outbound has strong render proof';
        if (outboundPlaybackMissing && inboundMediaArrived) return 'media arrived on outbound leg but playback proof missing (no play-ok); inbound has strong render proof';
        return 'playback proof missing on one leg despite evidence of media arrival';
      }
      if (verdictEnum === 'asymmetric-media-proof') return 'strong render proof present on only one leg (reciprocal proof missing)';
      if (verdictEnum === 'insufficient-proof') return 'insufficient media proof (missing RTP/render evidence)';
      if (verdictEnum === 'playback-path-suspect') return 'suspected playback/output path issue (RTP received but render/playback evidence missing)';
      if (verdictEnum === 'capture-path-suspect') return 'suspected capture/input path issue (RTP received on one leg but render evidence missing)';
      if (verdictEnum === 'far-end-to-local-missing') return 'local did not receive inbound RTP (far-end to local missing)';
      if (verdictEnum === 'local-to-far-end-missing') return 'far-end did not receive outbound RTP (local to far-end missing)';
      return 'see per-leg evidence';
    })();

    const topVerdict = (() => {
      const d = callProblem && callProblem.get(key);
      if (d && d.oneWaySuspected) return `PROBLEM: one-way-audio-suspected (stats-derived) | verdict=${verdictEnum}`;
      if (verdictEnum === 'two-way-audio-proven') return 'OK: two-way-audio-proven';
      if (verdictEnum === 'insufficient-proof') return 'WARN: insufficient-proof';
      return `WARN: ${verdictEnum}`;
    })();

    const base = { _seq: rep._seq, ts, _serverTs: rep._serverTs, callId: rep.callId, corrId: rep.corrId, username: rep.username, domain: rep.domain, aor: rep.aor, peer: rep.peer, peerDomain: rep.peerDomain, peerAor: rep.peerAor, lteMode: rep.lteMode, mode: rep.mode, selectedProfile: rep.selectedProfile, icePolicy: rep.icePolicy };

    out.push({
      ...base,
      type: 'call-media-verdict',
      dir: rep.dir,
      msg: `${topVerdict}`,
    });

    out.push({
      ...base,
      type: 'call-troubleshooting-conclusion',
      dir: rep.dir,
      msg: (() => {
        const inboundPlaybackProofMissing = inbound.trackAttached && inboundTransportComplete && !inbound.playOk && !inboundHasRenderProof;
        const outboundPlaybackProofMissing = outbound.trackAttached && outboundTransportComplete && !outbound.playOk && !outboundHasRenderProof;

        if (verdictEnum === 'possible-playback-path-issue' && inboundPlaybackProofMissing) {
          return 'Likely Android playback/output path issue on inbound leg: call established and transport completed, but playback proof is missing on the inbound leg while the opposite leg has strong media/render proof.';
        }
        if (verdictEnum === 'possible-playback-path-issue' && outboundPlaybackProofMissing) {
          return 'Likely playback/output path issue on outbound leg: call established and transport completed, but playback proof is missing on the outbound leg while the opposite leg has strong media/render proof.';
        }
        if (verdictEnum === 'possible-playback-path-issue' && inboundPlaybackMissing) {
          return 'Likely Android playback/output path issue on inbound leg: media appears to arrive (track+RTP/energy), but no playback confirmation on that leg; outbound leg has strong receive/render proof.';
        }
        if (verdictEnum === 'possible-playback-path-issue' && outboundPlaybackMissing) {
          return 'Likely playback/output path issue on outbound leg: media appears to arrive (track+RTP/energy), but no playback confirmation on that leg; inbound leg has strong receive/render proof.';
        }
        if (verdictEnum === 'asymmetric-media-proof') return 'Asymmetric media proof: one leg has strong receive/render proof, but the opposite direction lacks equivalent proof; inspect per-leg media verdict rows.';
        if (verdictEnum === 'two-way-audio-proven') return 'Two-way audio proven: both legs show strong receive+render proof.';
        return `Media proof insufficient or ambiguous: ${conclusion}.`;
      })(),
    });

    const inboundPlaybackProofMissing = inbound.trackAttached && inboundTransportComplete && !inbound.playOk && !inboundHasRenderProof;
    if (verdictEnum === 'possible-playback-path-issue' && inboundPlaybackProofMissing) {
      out.push({
        ...base,
        type: 'inbound-playback-proof-missing',
        dir: 'inbound',
        synthVerdict: verdictEnum,
        msg: 'Inbound playback proof missing: inbound has remote-audio-attached but no remote-audio-play-ok and no receive-render-proof (call established + ICE complete); opposite leg has strong receive/render proof.',
      });
    }

    for (const leg of [outbound, inbound]) {
      const conf = (leg.dir === 'inbound') ? inConf : outConf;
      const verdict = (leg.dir === 'inbound') ? inVerdict : outVerdict;
      const sig = `sig(conn=${leg.signaling.conn || '?'}, ice=${leg.signaling.ice || '?'}, dtls=${leg.signaling.dtls || '?'})`;
      const pair = leg.selectedPair ? `pair=${leg.selectedPair}` : 'pair=?';
      const rtp = `rtp(recv=${leg.recvRtp !== null ? leg.recvRtp : '?'}, sent=${leg.sentRtp !== null ? leg.sentRtp : '?'})`;
      const media = `track=${leg.trackAttached ? 'yes' : 'no'} playOk=${leg.playOk ? 'yes' : 'no'} energy=${leg.audioEnergy ? 'yes' : 'no'}`;
      const codec = leg.codec ? `codec=${leg.codec}` : 'codec=?';

      out.push({
        ...base,
        type: 'media-leg-verdict',
        dir: leg.dir,
        candSummary: leg.selectedPair || '',
        synthConf: conf,
        synthVerdict: verdict,
        msg: `${verdict} | conf=${conf} | ${sig} | ${pair} | ${media} | ${rtp} | ${codec}`,
      });

      out.push({
        ...base,
        type: 'media-proof-confidence',
        dir: leg.dir,
        candSummary: leg.selectedPair || '',
        synthConf: conf,
        synthVerdict: verdict,
        msg: `confidence=${conf} | verdict=${verdict}`,
      });

    }

    out.push({
      ...base,
      type: 'one-way-audio-diagnosis',
      dir: rep.dir,
      msg: `verdict=${verdictEnum} | outbound=${legSummary(outbound, outVerdict, outConf)} | inbound=${legSummary(inbound, inVerdict, inConf)} | conclusion=${conclusion}`,
    });
  }

  return out;
}

function buildMediaVerdictSummaryRows(events, { callProblem } = {}) {
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

  return synthesizeMediaVerdictRows(byCorr, { callProblem });
}

module.exports = { buildMediaVerdictSummaryRows };
