import { nowISO, logLine } from "../../desktopLogging.js";
import { sendCallMediaEvent } from "../../../features/callMediaLog.js";

import { guardDesktopLteRelayReadiness } from "../../desktopLteCallGuard.js";
import { releaseDesktopCallAudio } from "../../media/desktopCallAudioRuntime.js";
import { getDesktopOutboundDiagContext } from "../desktopStartCallSupport.js";
import { getLocalStream } from "../../../media.js";
import { stopRingbackTone } from "../desktopRingbackDelegate.js";

export function runDesktopExtPostInviteFlow(SIP, st, ui, inviter, {
  target,
  corrId,
  t_callStart,
  aor,
  micId,
} = {}) {
  try {
    const pc = inviter?.sessionDescriptionHandler?.peerConnection || null;
    const stream = (() => {
      try {
        return pc ? (getLocalStream() || null) : (getLocalStream() || null);
      } catch {
        return null;
      }
    })();
    const localMicTrackId = inviter?.__desktopMicTrackId || st?.__desktopMicTrackId || undefined;
    const localMicStreamId = inviter?.__desktopMicStreamId || st?.__desktopMicStreamId || stream?.id || (() => {
      try {
        return getLocalStream()?.id || undefined;
      } catch {
        return undefined;
      }
    })();
    const pcSignalingState = pc?.signalingState || undefined;

    const senderTrack = (() => {
      try {
        const senders = pc?.getSenders?.() || [];
        const a = senders.find((sd) => sd?.track?.kind === "audio") || null;
        return a?.track || null;
      } catch {
        return null;
      }
    })();

    const senderStreamIds = (() => {
      try {
        const senders = pc?.getSenders?.() || [];
        const a = senders.find((sd) => sd?.track?.kind === "audio") || null;
        const ss = a?.getStreams?.() || [];
        return ss.map((s) => s?.id || null).filter(Boolean);
      } catch {
        return undefined;
      }
    })();

    const senderTrackId = senderTrack?.id || undefined;
    const senderTrackReadyState = senderTrack?.readyState || undefined;
    const senderTrackEnabled = (typeof senderTrack?.enabled === "boolean") ? senderTrack.enabled : undefined;
    const senderTrackMuted = (typeof senderTrack?.muted === "boolean") ? senderTrack.muted : undefined;
    const sameAsLocalMicTrack = !!(senderTrackId && localMicTrackId && senderTrackId === localMicTrackId);

    sendCallMediaEvent({
      type: "desktop-sender-track-observed",
      ...getDesktopOutboundDiagContext(st, target, inviter),
      checkpoint: "post-local-description",
      senderTrackId,
      senderTrackReadyState,
      senderTrackEnabled,
      senderTrackMuted,
      localMicTrackId,
      localMicStreamId,
      senderStreamIds,
      sameAsLocalMicTrack,
      pcSignalingState,
      msg: "Desktop sender audio track observed",
    });

    try {
      const trs = pc?.getTransceivers?.() || [];
      const t = trs.find((tr) => tr?.sender?.track?.kind === "audio") || null;
      const codecs = t?.sender?.getParameters?.()?.codecs || [];
      const c0 = Array.isArray(codecs) ? codecs[0] : null;
      if (c0 && c0.mimeType) {
        sendCallMediaEvent({
          type: "desktop-outbound-codec-observed",
          ...getDesktopOutboundDiagContext(st, target, inviter),
          checkpoint: "post-local-description",
          outboundCodecMimeType: c0.mimeType || undefined,
          outboundCodecPayloadType: (typeof c0.payloadType === "number") ? c0.payloadType : undefined,
          outboundCodecClockRate: (typeof c0.clockRate === "number") ? c0.clockRate : undefined,
          outboundCodecChannels: (typeof c0.channels === "number") ? c0.channels : undefined,
          msg: "Desktop outbound codec observed",
        });
      }
    } catch {}
  } catch {}

  const callId = inviter.outgoingRequestMessage?.callId || null;
  guardDesktopLteRelayReadiness(inviter, {
    aor,
    callId,
    dir: "outbound",
    onFail: (code, userMessage) => {
      logLine(`[${nowISO()}] [call] ${code} — aborting call: ${userMessage}`);
      ui.setStatus(userMessage);

      try {
        sendCallMediaEvent({
          type: "desktop-local-terminate-request",
          corrId,
          callId: callId || undefined,
          dir: "outbound",
          peer: target,
          reason: "lte-guard-fail",
          code,
          sessionState: String(inviter?.state || ""),
          stSessionMatches: !!(st?.session && st.session === inviter),
          source: "desktopStartCall.guardDesktopLteRelayReadiness.onFail",
          msg: "Desktop requested local cancel/terminate during outbound setup",
        });
      } catch {}

      try {
        if (inviter.state === SIP.SessionState.Established) inviter.bye();
        else inviter.cancel();
      } catch {}
      releaseDesktopCallAudio("outbound-lte-guard-fail", { session: inviter, corrId, callId, micId });
      st.session = null;
      ui.setButtons();
      stopRingbackTone({ trigger: "hangup", reason: "hangup" });
    },
  });

  sendCallMediaEvent({
    type: "call-start",
    ...getDesktopOutboundDiagContext(st, target, inviter),
    t_callStart,
    msg: "Outbound call active (invite initiated)",
  });
}
