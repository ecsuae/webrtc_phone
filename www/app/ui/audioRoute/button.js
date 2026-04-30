import { enforceCurrentAudioRoute } from "./enforce.js";
import { getAudioRouteState, readMode, saveMode, readAppAudioRouteDiagSnapshot } from "./state.js";

export function bindAudioRoutePersistence(audioEl = document.getElementById("remoteAudio")) {
  const st = getAudioRouteState();
  if (!audioEl || st.listenersBound) return;
  st.listenersBound = true;

  const replay = () => {
    enforceCurrentAudioRoute(audioEl).catch(() => {});
  };

  audioEl.addEventListener("loadedmetadata", replay);
}

export function initializeAudioRouteButton(button) {
  if (!button) return;

  const st = getAudioRouteState();
  st.mode = readMode();
  const audioEl = document.getElementById("remoteAudio");
  bindAudioRoutePersistence(audioEl);

  button.addEventListener("click", async () => {
    st.mode = st.mode === "speaker" ? "earpiece" : "speaker";
    saveMode(st.mode);
    await enforceCurrentAudioRoute(audioEl);

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

  enforceCurrentAudioRoute(audioEl).catch(() => {});
}
