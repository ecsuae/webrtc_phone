import { nowISO } from "../../../config.js";
import { logLine } from "../../../log.js";
import { sendCallMediaEvent } from "../../../features/callMediaLog.js";
import { readAudioStatsSnapshot } from "../audioSnapshot.js";
import {
  emitAnomaliesFromSnapshot,
  enableReceiveRenderProofFollowup,
  tryGetRemoteAudioTrackCount,
} from "./helpers.js";
import { emitOutboundTickExtras } from "./tickOutbound.js";

export async function runMediaStatsTick({ pc, label, base, type }) {
  try {
    if (!pc || pc.connectionState === "closed") return;
    const snap = await readAudioStatsSnapshot(pc);

    try {
      const wants5s = type === "media-stats-5s";
      const wants10s = type === "media-stats-10s";
      const allow = enableReceiveRenderProofFollowup(base) && (wants5s || wants10s);
      const already = wants5s
        ? !!pc.__receiveRenderProof5sEmitted
        : (wants10s ? !!pc.__receiveRenderProof10sEmitted : true);
      if (allow && !already) {
        if (wants5s) pc.__receiveRenderProof5sEmitted = true;
        if (wants10s) pc.__receiveRenderProof10sEmitted = true;
        const audioEl = (() => {
          try {
            return window.__callMediaRemoteAudioEl || null;
          } catch {
            return null;
          }
        })();
        const track = (() => {
          try {
            const receiver = pc.getReceivers?.().find((r) => r.track && r.track.kind === "audio") || null;
            return receiver?.track || null;
          } catch {
            return null;
          }
        })();
        sendCallMediaEvent({
          type: "receive-render-proof",
          ...base,
          audioElPaused: typeof audioEl?.paused === "boolean" ? audioEl.paused : undefined,
          audioElMuted: typeof audioEl?.muted === "boolean" ? audioEl.muted : undefined,
          audioElVolume: typeof audioEl?.volume === "number" ? audioEl.volume : undefined,
          audioElCurrentTime: typeof audioEl?.currentTime === "number" ? audioEl.currentTime : undefined,
          audioElReadyState: typeof audioEl?.readyState === "number" ? audioEl.readyState : undefined,
          trackEnabled: typeof track?.enabled === "boolean" ? track.enabled : undefined,
          trackMuted: typeof track?.muted === "boolean" ? track.muted : undefined,
          trackReadyState: typeof track?.readyState === "string" ? track.readyState : undefined,
          inboundAudioPacketsReceived: snap.inPackets,
          outboundAudioPacketsSent: snap.outPackets,
          audioLevel: snap.inAudioLevel,
          totalAudioEnergy: snap.inTotalAudioEnergy,
          inboundCodecMimeType: snap.inboundCodecMimeType,
          inboundCodecPayloadType: snap.inboundCodecPayloadType,
          decoderImplementation: snap.decoderImplementation,
          packetsDiscarded: snap.packetsDiscarded,
          packetsRepaired: snap.packetsRepaired,
          concealedSamples: snap.concealedSamples,
          silentConcealedSamples: snap.silentConcealedSamples,
          totalSamplesDecoded: snap.totalSamplesDecoded,
          jitterBufferDelay: snap.jitterBufferDelay,
          jitterBufferEmittedCount: snap.jitterBufferEmittedCount,
          msg: wants10s ? "Receive render proof (10s after stats)" : "Receive render proof (5s after stats)",
        });
      }
    } catch {}

    if (base.dir === "outbound") {
      try {
        const trackCount = tryGetRemoteAudioTrackCount(pc);
        if (typeof trackCount === "number") {
          if (!pc.__outboundRemoteTrackAddedEmitted && trackCount > 0) {
            pc.__outboundRemoteTrackAddedEmitted = true;
            sendCallMediaEvent({
              type: "outbound-remote-track-added",
              ...base,
              remoteAudioTrackCount: trackCount,
              msg: `remote audio track(s) observed: ${trackCount}`,
            });
          }
        }
      } catch {}
    }

    const outboundAlias = base.dir === "outbound"
      ? (type === "media-stats-2s"
        ? "outbound-stats-2s"
        : (type === "media-stats-5s" ? "outbound-stats-5s" : (type === "media-stats-10s" ? "outbound-stats-10s" : null)))
      : null;

    const localMicTrackId = base.localMicTrackId;
    const localMicStreamId = base.localMicStreamId;
    const senderTrackId0 = snap.senderTrackId;
    const sameAsLocalMicTrack = !!(senderTrackId0 && localMicTrackId && senderTrackId0 === localMicTrackId);

    sendCallMediaEvent({
      type,
      ...base,
      localMicTrackId,
      localMicStreamId,
      sameAsLocalMicTrack,
      senderTrackId: senderTrackId0,
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
      msg: "WebRTC audio stats snapshot",
    });

    if (base.dir === "outbound") {
      emitOutboundTickExtras({ pc, base, snap, outboundAlias });
    }

    emitAnomaliesFromSnapshot(snap, base);
  } catch (e) {
    logLine(`[${nowISO()}] [pc:${label}] media-stats snapshot error ${e?.message || e}`);
  }
}
