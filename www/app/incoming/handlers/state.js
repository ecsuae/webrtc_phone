import { nowISO } from "../../config.js";
import { logLine } from "../../log.js";
import { stopIncomingAlert } from "../alert.js";
import { stopIncomingEarlyMediaLoop } from "../media.js?v=1773032001";
import { stopLocalAudioStream } from "../../media.js";

export const pageLoadTimeForIncoming = Date.now();
let lastRegistrationCompleteTime = null;

export function getLastRegistrationCompleteTime() {
  return lastRegistrationCompleteTime;
}

export function setLastRegistrationCompleteTime(t) {
  lastRegistrationCompleteTime = t;
}

export function cleanupIncomingState(st, ui) {
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

export function endIncomingAlert(st, ui, reason = "unknown") {
  logLine(`[${nowISO()}] [incoming] Ending incoming alert (${reason})`);
  stopIncomingAlert();
  stopIncomingEarlyMediaLoop(st.incomingInvitation || st.session);
  st.incomingInvitation = null;
  ui.setButtons();
  ui.setStatus("Idle");
}
