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