import { requirePlatformAdapter } from "../../runtime/shared/platformAdapter.js";
import { getAudioRouteState, readMode } from "./state.js";

function updateButtonUi(button, mode, sinkSupported) {
  if (!button) return;
  const speakerOn = mode === "speaker";
  button.classList.toggle("active", speakerOn);
  button.innerHTML = speakerOn
    ? '<i class="fas fa-volume-up"></i> Speaker'
    : '<i class="fas fa-volume-down"></i> Earpiece';
  button.title = sinkSupported
    ? "Switch audio output route"
    : "Switch volume profile (output route control is limited on this browser)";
}

export async function enforceCurrentAudioRoute(audioEl = document.getElementById("remoteAudio")) {
  const st = getAudioRouteState();
  const now = Date.now();
  if (now - (st.lastEnforceAt || 0) < 500) return;
  st.lastEnforceAt = now;

  const mode = st.mode || readMode();
  st.mode = mode;

  const sinkSupported = !!(audioEl && typeof audioEl.setSinkId === "function");

  try {
    const adapter = requirePlatformAdapter();
    const fn = adapter?.audioRoute?.enforce;
    if (typeof fn === "function") {
      await fn(audioEl, mode);
    }
  } catch {}

  const btn = document.getElementById("btnSpeaker");
  updateButtonUi(btn, mode, sinkSupported);
}
