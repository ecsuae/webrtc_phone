import { sendCallMediaEvent } from "../../features/callMediaLog.js";
import { dualSessionManager } from "../../features/dualSessionManager.js";

import { stopRingbackTone } from "./desktopRingbackDelegate.js";
import { getOutboundDiagContext } from "../../outgoing/call/diagContext.js";

async function emitDesktopOutboundReceiveRenderProof(inviter, st, ui, { t_callStart, peer, checkpoint } = {}) {
  try {
    const pc = inviter?.sessionDescriptionHandler?.peerConnection || null;
    if (!pc) return;

    const ctx = getOutboundDiagContext(st, peer, inviter);
    const audioEl = ui?.remoteAudio?.() || null;
    const track = (() => {
      try {
        const receiver = pc.getReceivers?.().find((r) => r?.track?.kind === "audio") || null;
        return receiver?.track || null;
      } catch {
        return null;
      }
    })();

    const stats = await pc.getStats();
    const byId = new Map();
    try {
      stats.forEach((r) => {
        if (r?.id) byId.set(r.id, r);
      });
    } catch {}

    let inboundPk = null;
    let outboundPk = null;
    let inAudioLevel = null;
    let inTotalEnergy = null;
    let inboundCodecMimeType = null;
    let inboundCodecPayloadType = null;
    let inboundCodecClockRate = null;
    let inboundCodecChannels = null;

    try {
      stats.forEach((r) => {
        if (r?.type !== "inbound-rtp") return;
        if (r.kind !== "audio" && r.mediaType !== "audio") return;
        if (typeof r.packetsReceived === "number") inboundPk = r.packetsReceived;
        if (typeof r.audioLevel === "number") inAudioLevel = r.audioLevel;
        if (typeof r.totalAudioEnergy === "number") inTotalEnergy = r.totalAudioEnergy;

        const codecId = (typeof r.codecId === "string") ? r.codecId : null;
        const codec = codecId ? byId.get(codecId) : null;
        if (codec && typeof codec.mimeType === "string") inboundCodecMimeType = codec.mimeType;
        if (codec && typeof codec.payloadType === "number") inboundCodecPayloadType = codec.payloadType;
        if (codec && typeof codec.clockRate === "number") inboundCodecClockRate = codec.clockRate;
        if (codec && typeof codec.channels === "number") inboundCodecChannels = codec.channels;
      });
    } catch {}

    try {
      stats.forEach((r) => {
        if (r?.type !== "outbound-rtp") return;
        if (r.kind !== "audio" && r.mediaType !== "audio") return;
        if (typeof r.packetsSent === "number") outboundPk = r.packetsSent;
      });
    } catch {}

    sendCallMediaEvent({
      type: "receive-render-proof",
      ...ctx,
      dir: "outbound",
      checkpoint: checkpoint || "desktop-outbound",
      t_callStart,
      audioElPaused: typeof audioEl?.paused === "boolean" ? audioEl.paused : undefined,
      audioElMuted: typeof audioEl?.muted === "boolean" ? audioEl.muted : undefined,
      audioElVolume: typeof audioEl?.volume === "number" ? audioEl.volume : undefined,
      audioElCurrentTime: typeof audioEl?.currentTime === "number" ? audioEl.currentTime : undefined,
      audioElReadyState: typeof audioEl?.readyState === "number" ? audioEl.readyState : undefined,
      trackEnabled: typeof track?.enabled === "boolean" ? track.enabled : undefined,
      trackMuted: typeof track?.muted === "boolean" ? track.muted : undefined,
      trackReadyState: typeof track?.readyState === "string" ? track.readyState : undefined,
      inboundAudioPacketsReceived: inboundPk ?? undefined,
      outboundAudioPacketsSent: outboundPk ?? undefined,
      audioLevel: inAudioLevel ?? undefined,
      totalAudioEnergy: inTotalEnergy ?? undefined,
      inboundCodecMimeType: inboundCodecMimeType || undefined,
      inboundCodecPayloadType: inboundCodecPayloadType ?? undefined,
      inboundCodecClockRate: inboundCodecClockRate ?? undefined,
      inboundCodecChannels: inboundCodecChannels ?? undefined,
      msg: "Receive render proof (desktop outbound)"
    });
  } catch {}
}

export function handleOutboundEstablishedDesktop(inviter, st, ui, { t_callStart, peer } = {}) {
  stopRingbackTone({ trigger: "established", reason: "session-established" });

  try {
    if (window.callTimer) window.callTimer.start();
  } catch {}

  try {
    sendCallMediaEvent({
      type: "outbound-call-established",
      ...getOutboundDiagContext(st, peer, inviter),
      t_callStart,
      t_established: new Date().toISOString(),
      msg: "Call established (outbound)",
    });
  } catch {}

  try {
    sendCallMediaEvent({
      type: "media-answer-outgoing",
      ...getOutboundDiagContext(st, peer, inviter),
      t_callStart,
      t_established: new Date().toISOString(),
      msg: "Call established (answer received)",
    });
  } catch {}

  try {
    sendCallMediaEvent({
      type: "call-established",
      ...getOutboundDiagContext(st, peer, inviter),
      t_callStart,
      t_established: new Date().toISOString(),
      msg: "Call established",
    });
  } catch {}

  try {
    if (!inviter.__desktopOutboundReceiveRenderProofScheduled) {
      inviter.__desktopOutboundReceiveRenderProofScheduled = true;
      setTimeout(() => {
        void emitDesktopOutboundReceiveRenderProof(inviter, st, ui, { t_callStart, peer, checkpoint: "outbound-5s" });
      }, 5000);
      setTimeout(() => {
        void emitDesktopOutboundReceiveRenderProof(inviter, st, ui, { t_callStart, peer, checkpoint: "outbound-10s" });
      }, 10000);
    }
  } catch {}

  try {
    if (!dualSessionManager.primary) {
      dualSessionManager.setPrimary(st);
    }
  } catch {}
}
