function applyVolumeFallback(audioEl, mode) {
  if (!audioEl) return;
  try {
    audioEl.muted = false;
  } catch {}

  try {
    audioEl.volume = mode === "speaker" ? 1.0 : 0.85;
  } catch {}
}

export function applyAndroidAudioRoute(audioEl, mode) {
  if (!audioEl) return;

  // On Android web runtimes, reliable programmatic routing between earpiece/speaker
  // is typically not exposed to web apps. Keep this logic Android-isolated.
  applyVolumeFallback(audioEl, mode);

  try {
    audioEl.autoplay = true;
    audioEl.playsInline = true;
  } catch {}

  try {
    if (audioEl.srcObject && audioEl.paused) {
      audioEl.play().catch(() => {});
    }
  } catch {}
}

let _ringbackEl = null;
let _ringbackTargetEl = null;
let _saved = null;

function getRingbackAssetUrl() {
  // Static asset already present in /www
  return "/ringing_old_phone.mp3";
}

function createRingbackElement() {
  const el = document.createElement("audio");
  el.autoplay = true;
  el.loop = true;
  el.playsInline = true;
  el.muted = false;
  el.preload = "auto";
  el.volume = 0.9;
  el.src = getRingbackAssetUrl();
  el.style.display = "none";
  el.setAttribute("aria-hidden", "true");
  document.body.appendChild(el);
  return el;
}

function pickTargetAudioEl(preferredAudioEl) {
  try {
    const el = preferredAudioEl || document.getElementById("remoteAudio");
    return el || null;
  } catch {
    return null;
  }
}

export function startAndroidRingback({ mode, preferredAudioEl } = {}) {
  const target = pickTargetAudioEl(preferredAudioEl);
  const safeToReuseTarget = !!(target && !target.srcObject && !(target.getAttribute("src") || target.src));

  // Prefer reusing the real remoteAudio element when it is still idle.
  // This keeps ringback and later call audio on the same media element.
  if (safeToReuseTarget) {
    _ringbackTargetEl = target;
    _saved = {
      srcObject: null,
      src: "",
      loop: target.loop,
      muted: target.muted,
      volume: target.volume,
      autoplay: target.autoplay,
      playsInline: target.playsInline,
    };

    try {
      target.src = getRingbackAssetUrl();
      target.loop = true;
      target.muted = false;
      target.autoplay = true;
      target.playsInline = true;
      applyVolumeFallback(target, mode || "earpiece");
      target.play?.().catch(() => {});
      return true;
    } catch {
      // Fall through to dedicated element
    }
  }

  if (!_ringbackEl) {
    _ringbackEl = createRingbackElement();
  }

  applyVolumeFallback(_ringbackEl, mode || "earpiece");
  try {
    _ringbackEl.currentTime = 0;
  } catch {}
  _ringbackEl.play?.().catch(() => {});
  return true;
}

export function stopAndroidRingback() {
  if (_ringbackTargetEl) {
    const el = _ringbackTargetEl;
    try {
      el.pause?.();
    } catch {}
    try {
      el.removeAttribute("src");
      el.load?.();
    } catch {}

    if (_saved) {
      try {
        el.loop = _saved.loop;
        el.muted = _saved.muted;
        el.volume = _saved.volume;
        el.autoplay = _saved.autoplay;
        el.playsInline = _saved.playsInline;
      } catch {}
    }

    _ringbackTargetEl = null;
    _saved = null;
    return;
  }

  if (_ringbackEl) {
    try {
      _ringbackEl.pause?.();
    } catch {}
  }
}
