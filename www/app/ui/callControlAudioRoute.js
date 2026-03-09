const STORAGE_KEY = "audioRouteMode";

const state = {
  mode: "earpiece",
  listenersBound: false,
};

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
  
  // On Android, we need to manipulate the audio element attributes
  // to trigger the correct routing behavior.
  audioEl.muted = false;
  audioEl.volume = 1.0;
  
  // Force the browser to reconsider audio routing by toggling play state
  if (audioEl.srcObject) {
    const stream = audioEl.srcObject;
    const audioTracks = stream.getAudioTracks();
    
    if (audioTracks.length > 0) {
      const track = audioTracks[0];
      console.log(`[audio-route] Android: applying ${mode} route to track`, track.label);
      
      // On Android Chrome, the speakerphone mode is influenced by
      // the echoCancellation and noiseSuppression constraints.
      // For speaker mode, we want lower processing; for earpiece, higher processing.
      const constraints = {
        echoCancellation: mode === "earpiece",
        noiseSuppression: mode === "earpiece",
        autoGainControl: mode === "earpiece"
      };
      
      track.applyConstraints(constraints).then(() => {
        console.log(`[audio-route] Android constraints applied:`, constraints);
      }).catch(err => {
        console.warn(`[audio-route] Android constraints failed:`, err?.message || err);
      });
    }
    
    // Additional Android-specific hint: pause and play to trigger routing refresh
    if (!audioEl.paused) {
      audioEl.pause();
      setTimeout(() => {
        audioEl.play().catch(e => console.warn("[audio-route] play() after pause failed:", e));
      }, 50);
    }
  }
  
  console.log(`[audio-route] Android: ${mode} mode applied`);
}

function applyVolumeFallback(audioEl, mode) {
  if (!audioEl) return;
  audioEl.muted = false;

  // Mobile browsers often do not expose output route APIs.
  // Keep a stronger gain difference so the mode toggle is meaningful.
  audioEl.volume = mode === "speaker" ? 1.0 : 0.35;
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
  const mode = state.mode || readMode();
  state.mode = mode;

  const isAndroid = /Android/i.test(navigator.userAgent || "");
  const sinkSupported = !!(audioEl && typeof audioEl.setSinkId === "function");
  
  let usedSink = false;
  
  if (isAndroid) {
    // Android-specific audio routing using track constraints
    console.log(`[audio-route] Applying Android-specific routing for ${mode}`);
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
  audioEl.addEventListener("play", replay);
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
  });

  enforceCurrentAudioRoute(audioEl).catch(() => {});
}
