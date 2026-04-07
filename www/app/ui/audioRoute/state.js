const STORAGE_KEY = "audioRouteMode";

const state = {
  mode: "earpiece",
  listenersBound: false,
  lastEnforceAt: 0,
};

function readSpeakerButtonActive() {
  try {
    const btn = document.getElementById("btnSpeaker");
    if (!btn) return null;
    return btn.classList.contains("active");
  } catch {
    return null;
  }
}

function readStorageModeRaw() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "speaker" || saved === "earpiece") return saved;
  } catch {}
  return null;
}

export function readMode() {
  return readStorageModeRaw() || "earpiece";
}

export function saveMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {}
}

export function getAudioRouteState() {
  return state;
}

export function readAppAudioRouteDiagSnapshot() {
  const ts = (() => {
    try {
      return new Date().toISOString();
    } catch {
      return undefined;
    }
  })();

  const mem = state.mode === "speaker" || state.mode === "earpiece" ? state.mode : null;
  const ls = readStorageModeRaw();
  const speakerBtnActive = readSpeakerButtonActive();
  const uiMode = typeof speakerBtnActive === "boolean" ? (speakerBtnActive ? "speaker" : "earpiece") : null;

  const mode = mem || ls || uiMode || "unknown";
  const source = mem ? "memory" : ls ? "localStorage" : uiMode ? "ui-state" : "none";
  const detail = mem
    ? "callControlAudioRoute.state.mode"
    : ls
      ? `localStorage.${STORAGE_KEY}`
      : uiMode
        ? "#btnSpeaker.active"
        : "none";

  const speakerButtonActive = typeof speakerBtnActive === "boolean" ? speakerBtnActive : false;
  const earpieceButtonActive = typeof speakerBtnActive === "boolean" ? !speakerBtnActive : false;
  const audioRouteStateAvailable = mode === "speaker" || mode === "earpiece";

  return {
    appAudioRouteMode: mode,
    appAudioRouteSource: source,
    appAudioRouteDetail: detail,
    speakerButtonActive,
    earpieceButtonActive,
    audioRouteStateAvailable,
    audioRouteSnapshotTs: ts,
  };
}
