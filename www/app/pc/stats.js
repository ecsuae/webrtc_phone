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

  let inAudioLevel = null;
  let inTotalAudioEnergy = null;

  let inCodecId = null;
  let inDecoderImplementation = null;
  let inPacketsDiscarded = null;
  let inPacketsRepaired = null;
  let inConcealedSamples = null;
  let inSilentConcealedSamples = null;
  let inTotalSamplesDecoded = null;
  let inJitterBufferDelay = null;
  let inJitterBufferEmittedCount = null;

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
      if (r.codecId && !inCodecId) inCodecId = r.codecId;
      if (typeof r.decoderImplementation === 'string' && !inDecoderImplementation) inDecoderImplementation = r.decoderImplementation;
      if (typeof r.packetsDiscarded === 'number' && Number.isFinite(r.packetsDiscarded)) {
        inPacketsDiscarded = (typeof inPacketsDiscarded === 'number') ? Math.max(inPacketsDiscarded, r.packetsDiscarded) : r.packetsDiscarded;
      }
      if (typeof r.packetsRepaired === 'number' && Number.isFinite(r.packetsRepaired)) {
        inPacketsRepaired = (typeof inPacketsRepaired === 'number') ? Math.max(inPacketsRepaired, r.packetsRepaired) : r.packetsRepaired;
      }
      if (typeof r.concealedSamples === 'number' && Number.isFinite(r.concealedSamples)) {
        inConcealedSamples = (typeof inConcealedSamples === 'number') ? Math.max(inConcealedSamples, r.concealedSamples) : r.concealedSamples;
      }
      if (typeof r.silentConcealedSamples === 'number' && Number.isFinite(r.silentConcealedSamples)) {
        inSilentConcealedSamples = (typeof inSilentConcealedSamples === 'number') ? Math.max(inSilentConcealedSamples, r.silentConcealedSamples) : r.silentConcealedSamples;
      }
      if (typeof r.totalSamplesDecoded === 'number' && Number.isFinite(r.totalSamplesDecoded)) {
        inTotalSamplesDecoded = (typeof inTotalSamplesDecoded === 'number') ? Math.max(inTotalSamplesDecoded, r.totalSamplesDecoded) : r.totalSamplesDecoded;
      }
      if (typeof r.jitterBufferDelay === 'number' && Number.isFinite(r.jitterBufferDelay)) {
        inJitterBufferDelay = (typeof inJitterBufferDelay === 'number') ? Math.max(inJitterBufferDelay, r.jitterBufferDelay) : r.jitterBufferDelay;
      }
      if (typeof r.jitterBufferEmittedCount === 'number' && Number.isFinite(r.jitterBufferEmittedCount)) {
        inJitterBufferEmittedCount = (typeof inJitterBufferEmittedCount === 'number') ? Math.max(inJitterBufferEmittedCount, r.jitterBufferEmittedCount) : r.jitterBufferEmittedCount;
      }
      if (typeof r.audioLevel === 'number' && Number.isFinite(r.audioLevel)) {
        inAudioLevel = (typeof inAudioLevel === 'number') ? Math.max(inAudioLevel, r.audioLevel) : r.audioLevel;
      }
      if (typeof r.totalAudioEnergy === 'number' && Number.isFinite(r.totalAudioEnergy)) {
        inTotalAudioEnergy = (typeof inTotalAudioEnergy === 'number') ? Math.max(inTotalAudioEnergy, r.totalAudioEnergy) : r.totalAudioEnergy;
      }
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

  const codec = (() => {
    try {
      if (!inCodecId) return null;
      const c = stats.get(inCodecId);
      if (!c || c.type !== 'codec') return null;
      return c;
    } catch {
      return null;
    }
  })();

  return {
    inPackets,
    inBytes,
    inLost,
    inJitter,
    inAudioLevel: inAudioLevel ?? undefined,
    inTotalAudioEnergy: inTotalAudioEnergy ?? undefined,
    inboundCodecMimeType: codec?.mimeType,
    inboundCodecPayloadType: codec?.payloadType,
    inboundCodecClockRate: codec?.clockRate,
    inboundCodecChannels: codec?.channels,
    decoderImplementation: inDecoderImplementation ?? undefined,
    packetsDiscarded: inPacketsDiscarded ?? undefined,
    packetsRepaired: inPacketsRepaired ?? undefined,
    concealedSamples: inConcealedSamples ?? undefined,
    silentConcealedSamples: inSilentConcealedSamples ?? undefined,
    totalSamplesDecoded: inTotalSamplesDecoded ?? undefined,
    jitterBufferDelay: inJitterBufferDelay ?? undefined,
    jitterBufferEmittedCount: inJitterBufferEmittedCount ?? undefined,
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

        // Logging-only: follow-up receive render proof after stats settle (Android outbound).
        try {
          const isAndroid = /Android/i.test(navigator.userAgent || '');
          const wants5s = (type === 'media-stats-5s');
          const wants10s = (type === 'media-stats-10s');
          const allow = isAndroid && base.dir === 'outbound' && (wants5s || wants10s);
          const already = wants5s ? !!pc.__receiveRenderProof5sEmitted : (wants10s ? !!pc.__receiveRenderProof10sEmitted : true);
          if (allow && !already) {
            if (wants5s) pc.__receiveRenderProof5sEmitted = true;
            if (wants10s) pc.__receiveRenderProof10sEmitted = true;
            const audioEl = (() => {
              try { return window.__callMediaRemoteAudioEl || null; } catch { return null; }
            })();
            const track = (() => {
              try {
                const receiver = pc.getReceivers?.().find((r) => r.track && r.track.kind === 'audio') || null;
                return receiver?.track || null;
              } catch {
                return null;
              }
            })();
            sendCallMediaEvent({
              type: 'receive-render-proof',
              ...base,
              audioElPaused: typeof audioEl?.paused === 'boolean' ? audioEl.paused : undefined,
              audioElMuted: typeof audioEl?.muted === 'boolean' ? audioEl.muted : undefined,
              audioElVolume: typeof audioEl?.volume === 'number' ? audioEl.volume : undefined,
              audioElCurrentTime: typeof audioEl?.currentTime === 'number' ? audioEl.currentTime : undefined,
              audioElReadyState: typeof audioEl?.readyState === 'number' ? audioEl.readyState : undefined,
              trackEnabled: typeof track?.enabled === 'boolean' ? track.enabled : undefined,
              trackMuted: typeof track?.muted === 'boolean' ? track.muted : undefined,
              trackReadyState: typeof track?.readyState === 'string' ? track.readyState : undefined,
              inboundAudioPacketsReceived: snap.inPackets,
              outboundAudioPacketsSent: snap.outPackets,
              audioLevel: snap.inAudioLevel,
              totalAudioEnergy: snap.inTotalAudioEnergy,
              inboundCodecMimeType: snap.inboundCodecMimeType,
              inboundCodecPayloadType: snap.inboundCodecPayloadType,
              decoderImplementation: snap.decoderImplementation,
              packetsDiscarded: snap.packetsDiscarded,
              concealedSamples: snap.concealedSamples,
              silentConcealedSamples: snap.silentConcealedSamples,
              totalSamplesDecoded: snap.totalSamplesDecoded,
              msg: wants10s ? 'Receive render proof (10s after stats)' : 'Receive render proof (5s after stats)',
            });
          }
        } catch {}

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
          audioLevel: snap.inAudioLevel,
          totalAudioEnergy: snap.inTotalAudioEnergy,
          inboundCodecMimeType: snap.inboundCodecMimeType,
          inboundCodecPayloadType: snap.inboundCodecPayloadType,
          inboundCodecClockRate: snap.inboundCodecClockRate,
          inboundCodecChannels: snap.inboundCodecChannels,
          decoderImplementation: snap.decoderImplementation,
          packetsDiscarded: snap.packetsDiscarded,
          packetsRepaired: snap.packetsRepaired,
          concealedSamples: snap.concealedSamples,
          silentConcealedSamples: snap.silentConcealedSamples,
          totalSamplesDecoded: snap.totalSamplesDecoded,
          jitterBufferDelay: snap.jitterBufferDelay,
          jitterBufferEmittedCount: snap.jitterBufferEmittedCount,
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
            audioLevel: snap.inAudioLevel,
            totalAudioEnergy: snap.inTotalAudioEnergy,
            inboundCodecMimeType: snap.inboundCodecMimeType,
            inboundCodecPayloadType: snap.inboundCodecPayloadType,
            inboundCodecClockRate: snap.inboundCodecClockRate,
            inboundCodecChannels: snap.inboundCodecChannels,
            decoderImplementation: snap.decoderImplementation,
            packetsDiscarded: snap.packetsDiscarded,
            packetsRepaired: snap.packetsRepaired,
            concealedSamples: snap.concealedSamples,
            silentConcealedSamples: snap.silentConcealedSamples,
            totalSamplesDecoded: snap.totalSamplesDecoded,
            jitterBufferDelay: snap.jitterBufferDelay,
            jitterBufferEmittedCount: snap.jitterBufferEmittedCount,
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
