import { nowISO, logLine } from "../desktopLogging.js";
import { stopIncomingAlert } from "../incoming/desktopIncomingAlert.js";
import { stopLocalAudioStream } from "../../media.js";

export function cleanupDesktopIncomingState(st, ui) {
  st.session = null;
  st.incomingInvitation = null;
  stopLocalAudioStream();
  ui.setButtons();
  ui.setStatus("Idle");
  if (window.callTimer) window.callTimer.stop();
  try {
    const audioEl = ui?.remoteAudio?.();
    if (audioEl?.__callMediaNoPlayTimer) {
      clearTimeout(audioEl.__callMediaNoPlayTimer);
      audioEl.__callMediaNoPlayTimer = null;
    }
  } catch {}
}

export async function rejectDesktopIncomingCall(st, ui) {
  const invitation = st.incomingInvitation;
  if (!invitation) return;

  const caller = invitation.remoteIdentity?.uri?.user || "Unknown";

  stopIncomingAlert();
  try {
    invitation.reject({ statusCode: 603 });
    window.callHistory?.addCall?.(caller, "rejected", 0, {
      sipCode: 603,
      sipReason: "Decline",
    });
  } catch (err) {
    logLine(`[${nowISO()}] [incoming:reject] ERROR rejecting: ${err?.message || err}`);
  }
  cleanupDesktopIncomingState(st, ui);
}