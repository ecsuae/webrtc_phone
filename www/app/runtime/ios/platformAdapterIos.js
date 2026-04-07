import { bindIosAudioUnlock } from "./audioUnlockIos.js";
import { enforceDesktopAudioRoute } from "../desktop/audioRouteDesktop.js";
import { primeDesktopRingbackContext, startDesktopRingback, stopDesktopRingback } from "../desktop/ringbackDesktop.js";

export function createPlatformAdapterIos() {
  return {
    id: "ios",
    audioUnlock: {
      bind: bindIosAudioUnlock,
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
      isMobile: true,
      showSpeakerButton: true,
    },
  };
}
