import { sendCallMediaEvent } from "../../../features/callMediaLog.js";
import { readAppAudioRouteDiagSnapshot } from "../../../ui/callControlAudioRoute.js";
import { loadPcStatsForDiag } from "../statsImports.js";

export function startOutboundRenderDiagInternal(audioEl, ctx) {
  const startedAt = Date.now();
  audioEl.__callMediaRenderDiagTimer = setInterval(() => {
    try {
      const now = Date.now();
      if ((now - startedAt) > 30000) {
        clearInterval(audioEl.__callMediaRenderDiagTimer);
        audioEl.__callMediaRenderDiagTimer = null;
        return;
      }

      const track = (() => {
        try {
          return audioEl?.srcObject?.getAudioTracks?.()?.[0] || null;
        } catch {
          return null;
        }
      })();

      const appRoute = (() => {
        try {
          const d = readAppAudioRouteDiagSnapshot?.();
          return d && typeof d === "object" ? d : null;
        } catch {
          return null;
        }
      })();

      const baseEv = {
        type: "outbound-render-diag",
        ...ctx,
        dir: "outbound",
        audioElCurrentTime: typeof audioEl.currentTime === "number" ? audioEl.currentTime : undefined,
        audioElPaused: typeof audioEl.paused === "boolean" ? audioEl.paused : undefined,
        audioElMuted: typeof audioEl.muted === "boolean" ? audioEl.muted : undefined,
        audioElVolume: typeof audioEl.volume === "number" ? audioEl.volume : undefined,
        audioElReadyState: typeof audioEl.readyState === "number" ? audioEl.readyState : undefined,
        trackMuted: typeof track?.muted === "boolean" ? track.muted : undefined,
        trackEnabled: typeof track?.enabled === "boolean" ? track.enabled : undefined,
        trackReadyState: typeof track?.readyState === "string" ? track.readyState : undefined,
        appAudioRouteMode: appRoute?.appAudioRouteMode || "unknown",
        appAudioRouteSource: appRoute?.appAudioRouteSource || "none",
        appAudioRouteDetail: appRoute?.appAudioRouteDetail || "none",
        speakerButtonActive: typeof appRoute?.speakerButtonActive === "boolean" ? appRoute.speakerButtonActive : false,
        earpieceButtonActive: typeof appRoute?.earpieceButtonActive === "boolean" ? appRoute.earpieceButtonActive : false,
        audioRouteStateAvailable: typeof appRoute?.audioRouteStateAvailable === "boolean" ? appRoute.audioRouteStateAvailable : false,
        audioRouteSnapshotTs: appRoute?.audioRouteSnapshotTs || undefined,
        audioRouteMismatch: false,
        msg: "Outbound render progress snapshot",
      };

      const pc = (() => {
        try {
          return audioEl.__callMediaPc || null;
        } catch {
          return null;
        }
      })();

      if (!pc) {
        sendCallMediaEvent(baseEv);
        return;
      }

      loadPcStatsForDiag().then(async (m) => {
        try {
          const fn = m?.readAudioStatsSnapshotForDiag;
          if (typeof fn !== "function") {
            sendCallMediaEvent(baseEv);
            return;
          }
          const snap = await fn(pc);
          if (!snap) {
            sendCallMediaEvent(baseEv);
            return;
          }
          sendCallMediaEvent({
            ...baseEv,
            decoderImplementation: snap.decoderImplementation,
            totalSamplesDecoded: snap.totalSamplesDecoded,
            packetsRepaired: snap.packetsRepaired,
            jitterBufferDelay: snap.jitterBufferDelay,
            jitterBufferEmittedCount: snap.jitterBufferEmittedCount,
            concealedSamples: snap.concealedSamples,
            silentConcealedSamples: snap.silentConcealedSamples,
            packetsDiscarded: snap.packetsDiscarded,
            audioLevel: snap.inAudioLevel,
            totalAudioEnergy: snap.inTotalAudioEnergy,
            inboundAudioPacketsReceived: snap.inPackets,
            outboundAudioPacketsSent: snap.outPackets,
            inboundCodecMimeType: snap.inboundCodecMimeType,
            inboundCodecPayloadType: snap.inboundCodecPayloadType,
            msg: "Outbound render+decode snapshot",
          });
        } catch {
          sendCallMediaEvent(baseEv);
        }
      });
    } catch {}
  }, 3000);
}
