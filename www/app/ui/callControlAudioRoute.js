const STORAGE_KEY = "audioRouteMode";

try {
  console.log("[audio-route] module=v1773034001");
} catch {}

const state = {
  mode: "earpiece",
  listenersBound: false,
  lastEnforceAt: 0,
};

function _readSpeakerButtonActive() {
  try {
    const btn = document.getElementById('btnSpeaker');
    if (!btn) return null;
    return btn.classList.contains('active');
  } catch {
    return null;
  }
}

function _readStorageModeRaw() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'speaker' || saved === 'earpiece') return saved;
  } catch {}
  return null;
}

export function readAppAudioRouteDiagSnapshot() {
  const ts = (() => {
    try { return new Date().toISOString(); } catch { return undefined; }
  })();

  const mem = (state.mode === 'speaker' || state.mode === 'earpiece') ? state.mode : null;
  const ls = _readStorageModeRaw();
  const speakerBtnActive = _readSpeakerButtonActive();
  const uiMode = (typeof speakerBtnActive === 'boolean') ? (speakerBtnActive ? 'speaker' : 'earpiece') : null;

  const mode = mem || ls || uiMode || 'unknown';
  const source = mem ? 'memory' : (ls ? 'localStorage' : (uiMode ? 'ui-state' : 'none'));
  const detail = mem ? 'callControlAudioRoute.state.mode'
    : (ls ? `localStorage.${STORAGE_KEY}`
      : (uiMode ? '#btnSpeaker.active' : 'none'));

  const speakerButtonActive = (typeof speakerBtnActive === 'boolean') ? speakerBtnActive : false;
  const earpieceButtonActive = (typeof speakerBtnActive === 'boolean') ? !speakerBtnActive : false;
  const audioRouteStateAvailable = (mode === 'speaker' || mode === 'earpiece');

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

function isMobileClient() {
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

function readMode() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "speaker" || saved === "earpiece") return saved;
  } catch {}
  return "earpiece";
}

function saveMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {}
}

function findOutputDevice(devices, mode) {
  const labels = devices
    .filter((d) => d.kind === "audiooutput")
    .map((d) => ({ id: d.deviceId, label: (d.label || "").toLowerCase() }));

  if (!labels.length) return null;

  const speakerHints = ["speaker", "loud", "handsfree", "default"];
  const earpieceHints = ["earpiece", "receiver", "phone", "communications", "default"];
  const hints = mode === "speaker" ? speakerHints : earpieceHints;

  for (const hint of hints) {
    const found = labels.find((d) => d.label.includes(hint));
    if (found) return found.id;
  }

  return labels[0].id;
}

async function trySetSink(audioEl, mode) {
  if (!audioEl || typeof audioEl.setSinkId !== "function") return false;
  if (!navigator.mediaDevices?.enumerateDevices) return false;

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const deviceId = findOutputDevice(devices, mode);
    if (!deviceId) return false;

    await audioEl.setSinkId(deviceId);
    console.log(`[audio-route] setSinkId success mode=${mode} device=${deviceId}`);
    return true;
  } catch (err) {
    console.warn("[audio-route] setSinkId failed:", err?.name, err?.message || err);
    return false;
  }
}

function applyAndroidAudioRoute(audioEl, mode) {
  if (!audioEl) return;

  // On Android web browsers, programmatic routing between earpiece/speaker is
  // generally not reliably exposed to web apps.
  // Avoid pause/play tricks (can lead to play() being blocked and cause no-audio).
  // Instead, keep playback active and apply a safe volume profile.
  applyVolumeFallback(audioEl, mode);

  if (audioEl.srcObject && audioEl.paused) {
    audioEl.play().catch((e) => console.warn("[audio-route] Android play() failed:", e));
  }
}

function applyVolumeFallback(audioEl, mode) {
  if (!audioEl) return;
  audioEl.muted = false;

  // Mobile browsers often do not expose output route APIs.
  // Do not drop earpiece volume too low (can sound like one-way/no audio).
  audioEl.volume = mode === "speaker" ? 1.0 : 0.85;
}

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
  const now = Date.now();
  // Avoid re-entrant enforcement loops (e.g. play->enforce->play->play event...).
  if (now - (state.lastEnforceAt || 0) < 500) return;
  state.lastEnforceAt = now;

  const mode = state.mode || readMode();
  state.mode = mode;

  const isAndroid = /Android/i.test(navigator.userAgent || "");
  const sinkSupported = !!(audioEl && typeof audioEl.setSinkId === "function");
  
  let usedSink = false;
  
  if (isAndroid) {
    // Android web browsers generally do not expose reliable output routing APIs.
    applyAndroidAudioRoute(audioEl, mode);
  } else {
    // Try standard setSinkId for other platforms
    usedSink = await trySetSink(audioEl, mode);
    if (!usedSink) applyVolumeFallback(audioEl, mode);
  }

  const btn = document.getElementById("btnSpeaker");
  updateButtonUi(btn, mode, sinkSupported);
}

export function bindAudioRoutePersistence(audioEl = document.getElementById("remoteAudio")) {
  if (!audioEl || state.listenersBound) return;
  state.listenersBound = true;

  const replay = () => {
    enforceCurrentAudioRoute(audioEl).catch((err) => {
      console.warn("[audio-route] replay apply failed:", err?.message || err);
    });
  };

  audioEl.addEventListener("loadedmetadata", replay);
  // On Android, "play" can be noisy and re-entrant (and can destabilize call UX).
  // Only re-apply on metadata changes.
  if (!/Android/i.test(navigator.userAgent || "")) {
    audioEl.addEventListener("play", replay);
  }
}

export function initializeAudioRouteButton(button) {
  if (!button) return;

  // Hide desktop-only: browser desktop output routing for this control is not needed.
  if (!isMobileClient()) {
    button.style.display = "none";
    return;
  }

  state.mode = readMode();
  const audioEl = document.getElementById("remoteAudio");
  bindAudioRoutePersistence(audioEl);

  button.addEventListener("click", async () => {
    state.mode = state.mode === "speaker" ? "earpiece" : "speaker";
    saveMode(state.mode);
    await enforceCurrentAudioRoute(audioEl);

    try {
      const diag = readAppAudioRouteDiagSnapshot();
      import('../features/callMediaLog.js')
        .then((m) => {
          const fn = m?.sendCallMediaEvent;
          if (typeof fn !== 'function') return;
          fn({
            type: 'app-audio-route-snapshot',
            dir: 'outbound',
            trigger: 'ui-toggle',
            reason: 'speaker-button-click',
            ...diag,
            msg: 'App audio route snapshot (UI toggle)',
          });
        })
        .catch(() => {});
    } catch {}
  });

  enforceCurrentAudioRoute(audioEl).catch(() => {});
}
