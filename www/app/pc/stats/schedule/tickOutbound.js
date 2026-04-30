import { sendCallMediaEvent } from "../../../features/callMediaLog.js";

export function emitOutboundTickExtras({ pc, base, snap, outboundAlias }) {
  try {
    if (snap.selectedPair || snap.localCandidateType || snap.remoteCandidateType) {
      sendCallMediaEvent({
        type: "outbound-selected-pair-details",
        ...base,
        selectedPair: snap.selectedPair,
        localCandidateType: snap.localCandidateType,
        remoteCandidateType: snap.remoteCandidateType,
        nominated: snap.nominated,
        currentRoundTripTime: snap.currentRoundTripTime,
        msg: "Outbound selected pair details",
      });
    }
  } catch {}

  try {
    if (snap.dtlsState && snap.dtlsState !== pc.__lastOutboundDtlsState) {
      pc.__lastOutboundDtlsState = snap.dtlsState;
      sendCallMediaEvent({ type: "outbound-dtls-state", ...base, dtlsState: snap.dtlsState, msg: `DTLS state: ${snap.dtlsState}` });
    }
  } catch {}

  try {
    const inPkts = snap.inPackets;
    if (typeof inPkts === "number") {
      if (inPkts > 0) {
        if (!pc.__outboundInboundRtpPresentEmitted) {
          pc.__outboundInboundRtpPresentEmitted = true;
          sendCallMediaEvent({ type: "outbound-inbound-rtp-present", ...base, inboundAudioPacketsReceived: inPkts, msg: "Inbound RTP present on outbound leg" });
        }
      } else {
        if (!pc.__outboundInboundRtpZeroEmitted) {
          pc.__outboundInboundRtpZeroEmitted = true;
          sendCallMediaEvent({ type: "outbound-inbound-rtp-zero", ...base, inboundAudioPacketsReceived: inPkts, msg: "Inbound RTP is zero on outbound leg" });
        }
      }
    }
  } catch {}

  if (!outboundAlias) return;

  if (outboundAlias === "outbound-stats-2s") {
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
    localMicTrackId: base.localMicTrackId,
    localMicStreamId: base.localMicStreamId,
    sameAsLocalMicTrack: !!(snap.senderTrackId && base.localMicTrackId && snap.senderTrackId === base.localMicTrackId),
    senderTrackId: snap.senderTrackId,
    senderTrackEnabled: snap.senderTrackEnabled,
    senderTrackReadyState: snap.senderTrackReadyState,
    inboundAudioPacketsReceived: snap.inPackets,
    inboundAudioBytesReceived: snap.inBytes,
    inboundAudioPacketsLost: snap.inLost,
    inboundAudioJitter: snap.inJitter ?? undefined,
    outboundAudioPacketsSent: snap.outPackets,
    outboundAudioBytesSent: snap.outBytes,
    outboundAudioLevel: snap.outAudioLevel,
    outboundTotalAudioEnergy: snap.outTotalAudioEnergy,
    audioLevel: snap.inAudioLevel,
    totalAudioEnergy: snap.inTotalAudioEnergy,
    inboundCodecMimeType: snap.inboundCodecMimeType,
    inboundCodecPayloadType: snap.inboundCodecPayloadType,
    inboundCodecClockRate: snap.inboundCodecClockRate,
    inboundCodecChannels: snap.inboundCodecChannels,
    outboundCodecMimeType: snap.outboundCodecMimeType,
    outboundCodecPayloadType: snap.outboundCodecPayloadType,
    outboundCodecClockRate: snap.outboundCodecClockRate,
    outboundCodecChannels: snap.outboundCodecChannels,
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
    msg: "Outbound caller stats snapshot",
  });
}
