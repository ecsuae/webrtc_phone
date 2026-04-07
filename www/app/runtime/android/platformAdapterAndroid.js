import { applyAndroidAudioRoute, startAndroidRingback, stopAndroidRingback } from "./audioPlaybackAndroid.js";
import { bindAndroidAudioUnlock } from "./audioUnlockAndroid.js";

function isAndroidLocalRingbackEnabled() {
  try {
    return localStorage.getItem("android_local_ringback") === "1";
  } catch {
    return false;
  }
}

export function createPlatformAdapterAndroid() {
  return {
    id: "android",
    audioUnlock: {
      bind: bindAndroidAudioUnlock,
    },
    audioRoute: {
      enforce: (audioEl, mode) => applyAndroidAudioRoute(audioEl, mode),
      enforceOnIncoming: false,
    },
    ringback: {
      prime: () => {},
      start: (meta) => startAndroidRingback({ mode: meta?.mode, preferredAudioEl: null }),
      stop: () => stopAndroidRingback(),
    },
    callPolicy: {
      shouldStartLocalRingbackOn180: () => isAndroidLocalRingbackEnabled(),
    },
    mediaDiag: {
      enableInboundAudioStats: true,
      enableAudioOutputRouteDiag: true,
      enableRenderDiag: true,
    },
    ui: {
      isMobile: true,
      showSpeakerButton: true,
    },
  };
}
