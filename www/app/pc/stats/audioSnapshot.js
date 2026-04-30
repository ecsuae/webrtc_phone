import { nowISO } from "../../config.js";
import { logLine } from "../../log.js";

export async function readAudioStatsSnapshot(pc) {
  const stats = await pc.getStats();
  let inPackets = 0;
  let inBytes = 0;
  let inLost = 0;
  let inJitter = null;
  let inAudioLevel = null;
  let inTotalAudioEnergy = null;
  let inCodecId = null;
  let outCodecId = null;
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
  let outAudioLevel = null;
  let outTotalAudioEnergy = null;

  let senderTrackId = null;
  let senderTrackEnabled = null;
  let senderTrackReadyState = null;

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
      if (r.codecId && !outCodecId) outCodecId = r.codecId;
      if (typeof r.audioLevel === 'number' && Number.isFinite(r.audioLevel)) {
        outAudioLevel = (typeof outAudioLevel === 'number') ? Math.max(outAudioLevel, r.audioLevel) : r.audioLevel;
      }
      if (typeof r.totalAudioEnergy === 'number' && Number.isFinite(r.totalAudioEnergy)) {
        outTotalAudioEnergy = (typeof outTotalAudioEnergy === 'number') ? Math.max(outTotalAudioEnergy, r.totalAudioEnergy) : r.totalAudioEnergy;
      }
    }
    if (r.type === 'transport') {
      if (r.dtlsState) dtlsState = r.dtlsState;
      if (r.selectedCandidatePairId) selectedPair = stats.get(r.selectedCandidatePairId);
    }
  });

  try {
    const senders = pc.getSenders?.() || [];
    const audioSender = senders.find((s) => s?.track?.kind === "audio") || null;
    const t = audioSender?.track || null;
    senderTrackId = t?.id || null;
    senderTrackEnabled = typeof t?.enabled === "boolean" ? t.enabled : null;
    senderTrackReadyState = typeof t?.readyState === "string" ? t.readyState : null;
  } catch {}

  if (!selectedPair) {
    stats.forEach((r) => {
      if (r.type === 'candidate-pair' && (r.selected === true || r.nominated === true)) selectedPair = r;
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

  const outCodec = (() => {
    try {
      if (!outCodecId) return null;
      const c = stats.get(outCodecId);
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
    outboundCodecMimeType: outCodec?.mimeType,
    outboundCodecPayloadType: outCodec?.payloadType,
    outboundCodecClockRate: outCodec?.clockRate,
    outboundCodecChannels: outCodec?.channels,
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
    outAudioLevel: outAudioLevel ?? undefined,
    outTotalAudioEnergy: outTotalAudioEnergy ?? undefined,
    senderTrackId: senderTrackId ?? undefined,
    senderTrackEnabled: senderTrackEnabled ?? undefined,
    senderTrackReadyState: senderTrackReadyState ?? undefined,
    selectedPair: selectedPairText,
    localCandidateType: localCand?.candidateType,
    remoteCandidateType: remoteCand?.candidateType,
    nominated: nominated ?? undefined,
    currentRoundTripTime: rtt ?? undefined,
    dtlsState: dtlsState ?? undefined,
  };
}

export async function readAudioStatsSnapshotForDiag(pc) {
  if (!pc) return null;
  try {
    return await readAudioStatsSnapshot(pc);
  } catch {
    return null;
  }
}

export async function logSelectedPair(pc, label) {
  try {
    const stats = await pc.getStats();
    let selectedPair = null;

    stats.forEach((r) => {
      if (r.type === 'transport' && r.selectedCandidatePairId) selectedPair = stats.get(r.selectedCandidatePairId);
      if (!selectedPair && r.type === 'candidate-pair' && r.selected === true) selectedPair = r;
    });

    if (!selectedPair) {
      stats.forEach((r) => {
        if (r.type === 'candidate-pair' && r.state === 'succeeded' && (r.nominated === true || r.writable === true)) {
          selectedPair = r;
        }
      });
    }

    if (!selectedPair) return;
    const local = selectedPair.localCandidateId ? stats.get(selectedPair.localCandidateId) : null;
    const remote = selectedPair.remoteCandidateId ? stats.get(selectedPair.remoteCandidateId) : null;

    const lp = local ? `${local.candidateType || '?'} ${local.address || local.ip || '?'}:${local.port || '?'}` : 'unknown';
    const rp = remote ? `${remote.candidateType || '?'} ${remote.address || remote.ip || '?'}:${remote.port || '?'}` : 'unknown';
    logLine(`[${nowISO()}] [pc:${label}] selected-pair ${selectedPair.state || '?'} local=${lp} remote=${rp}`);
  } catch (e) {
    logLine(`[${nowISO()}] [pc:${label}] selected-pair error ${e?.message || e}`);
  }
}
