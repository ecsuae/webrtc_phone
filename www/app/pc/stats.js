import { nowISO } from "../config.js";
import { logLine } from "../log.js";
import { sendCallMediaEvent } from "../features/callMediaLog.js";

function bindOutboundReceiveLegObservers(pc, base) {
  try {
    if (!pc || pc.__outboundReceiveLegObserversBound) return;
    if ((base?.dir || '') !== 'outbound') return;
    pc.__outboundReceiveLegObserversBound = true;

    const emitConn = () => {
      try {
        sendCallMediaEvent({
          type: 'outbound-connection-state',
          ...base,
          connectionState: pc.connectionState,
          msg: `pc.connectionState=${pc.connectionState || ''}`,
        });
      } catch {}
    };
    const emitIceConn = () => {
      try {
        sendCallMediaEvent({
          type: 'outbound-ice-connection-state',
          ...base,
          iceConnectionState: pc.iceConnectionState,
          msg: `pc.iceConnectionState=${pc.iceConnectionState || ''}`,
        });
      } catch {}
    };

    try { pc.addEventListener('connectionstatechange', emitConn); } catch {}
    try { pc.addEventListener('iceconnectionstatechange', emitIceConn); } catch {}

    emitConn();
    emitIceConn();
  } catch {
    // ignore
  }
}

export async function logSelectedPair(pc, label) {
  try {
    const stats = await pc.getStats();
    let selectedPair = null;

    stats.forEach((r) => {
      if (r.type === "transport" && r.selectedCandidatePairId) selectedPair = stats.get(r.selectedCandidatePairId);
      if (!selectedPair && r.type === "candidate-pair" && r.selected === true) selectedPair = r;
    });

    if (!selectedPair) {
      stats.forEach((r) => {
        if (r.type === "candidate-pair" && r.state === "succeeded" && (r.nominated === true || r.writable === true)) {
          selectedPair = r;
        }
      });
    }

    if (!selectedPair) return;
    const local = selectedPair.localCandidateId ? stats.get(selectedPair.localCandidateId) : null;
    const remote = selectedPair.remoteCandidateId ? stats.get(selectedPair.remoteCandidateId) : null;

    const lp = local ? `${local.candidateType || "?"} ${local.address || local.ip || "?"}:${local.port || "?"}` : "unknown";
    const rp = remote ? `${remote.candidateType || "?"} ${remote.address || remote.ip || "?"}:${remote.port || "?"}` : "unknown";
    logLine(`[${nowISO()}] [pc:${label}] selected-pair ${selectedPair.state || "?"} local=${lp} remote=${rp}`);
  } catch (e) {
    logLine(`[${nowISO()}] [pc:${label}] selected-pair error ${e?.message || e}`);
  }
}

export function startRtpStats(pc, label) {
  if (pc.__rtpTimer) return;
  pc.__rtpTimer = setInterval(async () => {
    try {
      if (!pc || pc.connectionState === "closed") return;
      const stats = await pc.getStats();
      let sent = 0;
      let recv = 0;
      let packetsLost = 0;
      let jitter = null;
      let rtt = null;

      stats.forEach((r) => {
        if (r.type === "outbound-rtp" && r.kind === "audio") sent += r.bytesSent || 0;
        if (r.type === "inbound-rtp" && r.kind === "audio") {
          recv += r.bytesReceived || 0;
          packetsLost += r.packetsLost || 0;
          if (typeof r.jitter === "number") jitter = r.jitter;
        }
        if (r.type === "candidate-pair" && (r.selected === true || r.nominated === true)) {
          if (typeof r.currentRoundTripTime === "number") rtt = r.currentRoundTripTime;
        }
      });

      const j = jitter === null ? "?" : jitter.toFixed(4);
      const t = rtt === null ? "?" : rtt.toFixed(4);
      logLine(`[${nowISO()}] [pc:${label}] rtp sent=${sent} recv=${recv} lost=${packetsLost} jitter=${j} rtt=${t}`);
    } catch (e) {
      logLine(`[${nowISO()}] [pc:${label}] rtp-stats error ${e?.message || e}`);
    }
  }, 2000);
}

async function readAudioStatsSnapshot(pc) {
  const stats = await pc.getStats();
  let inPackets = 0;
  let inBytes = 0;
  let inLost = 0;
  let inJitter = null;

  let outPackets = 0;
  let outBytes = 0;

  let selectedPair = null;
  let localCand = null;
  let remoteCand = null;
  let rtt = null;
  let nominated = null;
  let dtlsState = null;

  stats.forEach((r) => {
    if (r.type === 'inbound-rtp' && r.kind === 'audio') {
      inPackets += r.packetsReceived || 0;
      inBytes += r.bytesReceived || 0;
      inLost += r.packetsLost || 0;
      if (typeof r.jitter === 'number') inJitter = r.jitter;
    }
    if (r.type === 'outbound-rtp' && r.kind === 'audio') {
      outPackets += r.packetsSent || 0;
      outBytes += r.bytesSent || 0;
    }
    if (r.type === 'transport') {
      if (r.dtlsState) dtlsState = r.dtlsState;
      if (r.selectedCandidatePairId) selectedPair = stats.get(r.selectedCandidatePairId);
    }
  });

  if (!selectedPair) {
    stats.forEach((r) => {
      if (r.type === 'candidate-pair' && (r.selected === true || r.nominated === true)) {
        selectedPair = r;
      }
    });
  }

  if (selectedPair) {
    nominated = selectedPair.nominated === true || selectedPair.selected === true;
    if (typeof selectedPair.currentRoundTripTime === 'number') rtt = selectedPair.currentRoundTripTime;
    localCand = selectedPair.localCandidateId ? stats.get(selectedPair.localCandidateId) : null;
    remoteCand = selectedPair.remoteCandidateId ? stats.get(selectedPair.remoteCandidateId) : null;
  }

  const selectedPairText = (() => {
    if (!selectedPair) return undefined;
    const lp = localCand
      ? `${localCand.candidateType || '?'} ${localCand.address || localCand.ip || '?'}:${localCand.port || '?'}`
      : 'unknown';
    const rp = remoteCand
      ? `${remoteCand.candidateType || '?'} ${remoteCand.address || remoteCand.ip || '?'}:${remoteCand.port || '?'}`
      : 'unknown';
    return `local=${lp} remote=${rp}`;
  })();

  return {
    inPackets,
    inBytes,
    inLost,
    inJitter,
    outPackets,
    outBytes,
    selectedPair: selectedPairText,
    localCandidateType: localCand?.candidateType,
    remoteCandidateType: remoteCand?.candidateType,
    nominated: nominated ?? undefined,
    currentRoundTripTime: rtt ?? undefined,
    dtlsState: dtlsState ?? undefined,
  };
}

function tryGetRemoteAudioTrackCount(pc) {
  try {
    const receivers = typeof pc.getReceivers === 'function' ? pc.getReceivers() : [];
    const tracks = (receivers || [])
      .map((r) => r && r.track)
      .filter((t) => t && t.kind === 'audio');
    return tracks.length;
  } catch {
    return undefined;
  }
}

function emitAnomaliesFromSnapshot(snapshot, base) {
  if (!snapshot) return;
  const { inPackets, outPackets, dtlsState, localCandidateType, remoteCandidateType } = snapshot;

  if (typeof outPackets === 'number' && outPackets > 0 && typeof inPackets === 'number' && inPackets === 0) {
    sendCallMediaEvent({
      type: 'no-inbound-rtp',
      ...base,
      msg: 'Outbound RTP present but inbound RTP is zero',
    });

    sendCallMediaEvent({
      type: 'one-way-audio-suspected',
      ...base,
      msg: 'One-way audio suspected: sent RTP > 0, received RTP = 0',
    });
  }
  if (typeof inPackets === 'number' && inPackets > 0 && typeof outPackets === 'number' && outPackets === 0) {
    sendCallMediaEvent({
      type: 'no-outbound-rtp',
      ...base,
      msg: 'Inbound RTP present but outbound RTP is zero',
    });

    sendCallMediaEvent({
      type: 'one-way-audio-suspected',
      ...base,
      msg: 'One-way audio suspected: received RTP > 0, sent RTP = 0',
    });
  }
  if (dtlsState === 'connected' && inPackets === 0 && outPackets === 0) {
    sendCallMediaEvent({
      type: 'dtls-connected-but-no-rtp',
      ...base,
      msg: 'DTLS connected but no RTP packets seen yet',
    });
  }

  if (base?.icePolicy === 'relay') {
    if (localCandidateType && localCandidateType !== 'relay') {
      sendCallMediaEvent({
        type: 'selected-pair-relay-mismatch',
        ...base,
        msg: `ICE policy relay but selected local candidate type is ${localCandidateType || '?'}`,
      });
    }
  }
}

export function scheduleMediaStatsSnapshots(pc, label, diagCtx = {}) {
  if (!pc || pc.__mediaStatsScheduled) return;
  pc.__mediaStatsScheduled = true;

  const base = {
    ...diagCtx,
    dir: diagCtx.dir || label,
  };

  bindOutboundReceiveLegObservers(pc, base);

  // Guaranteed chain marker for outbound caller leg.
  if (base.dir === 'outbound') {
    try {
      sendCallMediaEvent({
        type: 'outbound-stats-scheduled',
        ...base,
        msg: 'Outbound stats snapshots scheduled',
      });
    } catch {}

    try {
      if (!pc.__missingOutboundStatsTimer) {
        pc.__missingOutboundStatsTimer = setTimeout(() => {
          try {
            if (pc.__outboundStats2sEmitted) return;
            sendCallMediaEvent({
              type: 'missing-outbound-stats',
              ...base,
              msg: 'Outbound call established but outbound-stats-2s did not fire (hook failure or no pc/stats)',
            });
          } catch {}
        }, 4000);
      }
    } catch {}
  }

  const schedule = (ms, type) => {
    setTimeout(async () => {
      try {
        if (!pc || pc.connectionState === 'closed') return;
        const snap = await readAudioStatsSnapshot(pc);

        if (base.dir === 'outbound') {
          try {
            const trackCount = tryGetRemoteAudioTrackCount(pc);
            if (typeof trackCount === 'number') {
              if (!pc.__outboundRemoteTrackAddedEmitted && trackCount > 0) {
                pc.__outboundRemoteTrackAddedEmitted = true;
                sendCallMediaEvent({
                  type: 'outbound-remote-track-added',
                  ...base,
                  remoteAudioTrackCount: trackCount,
                  msg: `remote audio track(s) observed: ${trackCount}`,
                });
              }
            }
          } catch {}
        }

        const outboundAlias = (base.dir === 'outbound')
          ? (type === 'media-stats-2s' ? 'outbound-stats-2s' : (type === 'media-stats-5s' ? 'outbound-stats-5s' : (type === 'media-stats-10s' ? 'outbound-stats-10s' : null)))
          : null;

        sendCallMediaEvent({
          type,
          ...base,
          inboundAudioPacketsReceived: snap.inPackets,
          inboundAudioBytesReceived: snap.inBytes,
          inboundAudioPacketsLost: snap.inLost,
          inboundAudioJitter: snap.inJitter ?? undefined,
          outboundAudioPacketsSent: snap.outPackets,
          outboundAudioBytesSent: snap.outBytes,
          selectedPair: snap.selectedPair,
          localCandidateType: snap.localCandidateType,
          remoteCandidateType: snap.remoteCandidateType,
          nominated: snap.nominated,
          currentRoundTripTime: snap.currentRoundTripTime,
          dtlsState: snap.dtlsState,
          msg: 'WebRTC audio stats snapshot',
        });

        if (base.dir === 'outbound') {
          try {
            if (snap.selectedPair || snap.localCandidateType || snap.remoteCandidateType) {
              sendCallMediaEvent({
                type: 'outbound-selected-pair-details',
                ...base,
                selectedPair: snap.selectedPair,
                localCandidateType: snap.localCandidateType,
                remoteCandidateType: snap.remoteCandidateType,
                nominated: snap.nominated,
                currentRoundTripTime: snap.currentRoundTripTime,
                msg: 'Outbound selected pair details',
              });
            }
          } catch {}

          try {
            if (snap.dtlsState && snap.dtlsState !== pc.__lastOutboundDtlsState) {
              pc.__lastOutboundDtlsState = snap.dtlsState;
              sendCallMediaEvent({
                type: 'outbound-dtls-state',
                ...base,
                dtlsState: snap.dtlsState,
                msg: `DTLS state: ${snap.dtlsState}`,
              });
            }
          } catch {}

          try {
            const inPkts = snap.inPackets;
            if (typeof inPkts === 'number') {
              if (inPkts > 0) {
                if (!pc.__outboundInboundRtpPresentEmitted) {
                  pc.__outboundInboundRtpPresentEmitted = true;
                  sendCallMediaEvent({
                    type: 'outbound-inbound-rtp-present',
                    ...base,
                    inboundAudioPacketsReceived: inPkts,
                    msg: 'Inbound RTP present on outbound leg',
                  });
                }
              } else {
                if (!pc.__outboundInboundRtpZeroEmitted) {
                  pc.__outboundInboundRtpZeroEmitted = true;
                  sendCallMediaEvent({
                    type: 'outbound-inbound-rtp-zero',
                    ...base,
                    inboundAudioPacketsReceived: inPkts,
                    msg: 'Inbound RTP is zero on outbound leg',
                  });
                }
              }
            }
          } catch {}
        }

        if (outboundAlias) {
          if (outboundAlias === 'outbound-stats-2s') {
            pc.__outboundStats2sEmitted = true;
            try {
              const callId = base.callId;
              if (callId) {
                window.__callMediaOutboundStats2sByCallId = window.__callMediaOutboundStats2sByCallId || {};
                window.__callMediaOutboundStats2sByCallId[callId] = true;
              }
            } catch {}
          }
          sendCallMediaEvent({
            type: outboundAlias,
            ...base,
            inboundAudioPacketsReceived: snap.inPackets,
            inboundAudioBytesReceived: snap.inBytes,
            inboundAudioPacketsLost: snap.inLost,
            inboundAudioJitter: snap.inJitter ?? undefined,
            outboundAudioPacketsSent: snap.outPackets,
            outboundAudioBytesSent: snap.outBytes,
            selectedPair: snap.selectedPair,
            localCandidateType: snap.localCandidateType,
            remoteCandidateType: snap.remoteCandidateType,
            nominated: snap.nominated,
            currentRoundTripTime: snap.currentRoundTripTime,
            dtlsState: snap.dtlsState,
            msg: 'Outbound caller stats snapshot',
          });
        }

        emitAnomaliesFromSnapshot(snap, base);
      } catch (e) {
        logLine(`[${nowISO()}] [pc:${label}] media-stats snapshot error ${e?.message || e}`);
      }
    }, ms);
  };

  schedule(2000, 'media-stats-2s');
  schedule(5000, 'media-stats-5s');
  schedule(10000, 'media-stats-10s');
}

export function stopRtpStats(pc) {
  if (!pc?.__rtpTimer) return;
  clearInterval(pc.__rtpTimer);
  pc.__rtpTimer = null;
}
