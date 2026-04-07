import { bindDesktopAudioUnlock } from "./audioUnlockDesktop.js";
import { enforceDesktopAudioRoute } from "./audioRouteDesktop.js";
import { primeDesktopRingbackContext, startDesktopRingback, stopDesktopRingback } from "./ringbackDesktop.js";

export function createPlatformAdapterDesktop() {
  return {
    id: "desktop",
    audioUnlock: {
      bind: bindDesktopAudioUnlock,
    },
    audioRoute: {
      enforce: enforceDesktopAudioRoute,
      enforceOnIncoming: true,
    },
    ringback: {
      prime: primeDesktopRingbackContext,
      start: startDesktopRingback,
      stop: stopDesktopRingback,
    },
    callPolicy: {
      shouldStartLocalRingbackOn180: ({ hasSdp } = {}) => !hasSdp,
    },
    mediaDiag: {
      enableInboundAudioStats: false,
      enableAudioOutputRouteDiag: false,
      enableRenderDiag: false,
    },
    ui: {
      isMobile: false,
      showSpeakerButton: false,
    },
  };
}
