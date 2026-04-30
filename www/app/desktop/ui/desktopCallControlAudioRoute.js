import { getDesktopPlatformAdapter } from "../runtime/platformAdapterRegistry.js";
import { getAudioRouteState, readMode, saveMode, readAppAudioRouteDiagSnapshot } from "../../ui/audioRoute/state.js";

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

export async function enforceCurrentAudioRouteDesktop(audioEl = document.getElementById("remoteAudio")) {
  const st = getAudioRouteState();
  const now = Date.now();
  if (now - (st.lastEnforceAt || 0) < 500) return;
  st.lastEnforceAt = now;

  const mode = st.mode || readMode();
  st.mode = mode;

  const sinkSupported = !!(audioEl && typeof audioEl.setSinkId === "function");

  try {
    const adapter = getDesktopPlatformAdapter();
    const fn = adapter?.audioRoute?.enforce;
    if (typeof fn === "function") {
      await fn(audioEl, mode);
    }
  } catch {}

  const btn = document.getElementById("btnSpeaker");
  updateButtonUi(btn, mode, sinkSupported);
}

export function bindAudioRoutePersistenceDesktop(audioEl = document.getElementById("remoteAudio")) {
  const st = getAudioRouteState();
  if (!audioEl || st.listenersBound) return;
  st.listenersBound = true;

  const replay = () => {
    enforceCurrentAudioRouteDesktop(audioEl).catch(() => {});
  };

  audioEl.addEventListener("loadedmetadata", replay);
}

export function initializeAudioRouteButtonDesktop(button) {
  if (!button) return;

  const st = getAudioRouteState();
  st.mode = readMode();
  const audioEl = document.getElementById("remoteAudio");
  bindAudioRoutePersistenceDesktop(audioEl);

  button.addEventListener("click", async () => {
    st.mode = st.mode === "speaker" ? "earpiece" : "speaker";
    saveMode(st.mode);
    await enforceCurrentAudioRouteDesktop(audioEl);

    try {
      const diag = readAppAudioRouteDiagSnapshot();
      import("../../features/callMediaLog.js")
        .then((m) => {
          const fn = m?.sendCallMediaEvent;
          if (typeof fn !== "function") return;
          fn({
            type: "app-audio-route-snapshot",
            dir: "outbound",
            trigger: "ui-toggle",
            reason: "speaker-button-click",
            ...diag,
            msg: "App audio route snapshot (UI toggle)",
          });
        })
        .catch(() => {});
    } catch {}
  });

  enforceCurrentAudioRouteDesktop(audioEl).catch(() => {});
}
