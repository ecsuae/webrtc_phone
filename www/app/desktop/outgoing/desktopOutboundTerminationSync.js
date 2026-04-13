import { nowISO, logLine } from "../desktopLogging.js";
import { stopRingbackTone } from "./desktopRingbackDelegate.js";
import { clearEarlyMediaAttachLoop } from "./desktopOutgoingMedia.js";
import { releaseDesktopCallAudio } from "../media/desktopCallAudioRuntime.js";
import { endDesktopCallUiState } from "../calls/desktopCallEndSync.js";

export function syncDesktopOutboundTerminated(SIP, inviter, st, ui, {
  peer = undefined,
  reason = "outbound-state-terminated",
  trigger = "stateChange:Terminated",
} = {}) {
  try {
    logLine(`[${nowISO()}] [desktop-remote-hangup-detected] dir=outbound trigger=SessionState.Terminated`);
  } catch {}

  try {
    inviter.__desktopTermDiagApi?.captureSync?.("terminated");
  } catch {}

  try {
    clearEarlyMediaAttachLoop(inviter);
  } catch {}

  try {
    stopRingbackTone({ trigger: "terminated", reason: "session-terminated" });
  } catch {}

  try {
    const pc = inviter?.sessionDescriptionHandler?.peerConnection;
    if (pc && typeof pc.close === "function" && pc.signalingState !== "closed") {
      pc.close();
    }
  } catch {}

  try {
    releaseDesktopCallAudio(reason, {
      session: inviter,
      corrId: inviter?.__webrtcCorrId || st?.__webrtcCorrId || null,
      callId: inviter?.outgoingRequestMessage?.callId || null,
      micId: inviter?.__desktopMicId || null,
      dir: "outbound",
      peer,
    });
  } catch {}

  try {
    logLine(`[${nowISO()}] [desktop-session-terminated] dir=outbound reason=session-terminated`);
  } catch {}

  try {
    endDesktopCallUiState(st, ui, inviter, {
      reason,
      dir: "outbound",
      corrId: inviter?.__webrtcCorrId || st?.__webrtcCorrId || undefined,
      callId: inviter?.outgoingRequestMessage?.callId || undefined,
      peer,
      trigger,
    });
  } catch {}
}
