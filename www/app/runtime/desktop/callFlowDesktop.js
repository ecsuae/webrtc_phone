import { bindDesktopControlHandlers } from "../../desktop/bindings/desktopControlBindings.js";
import { bindDesktopAudioUnlock } from "./audioUnlockDesktop.js";

export function setupDesktopCallFlow({
  el,
  st,
  ui,
  SIP,
  callHistory,
  runOneTapEnableFlow,
  stopAndUnregister,
  releaseWakeLock,
}) {
  bindDesktopControlHandlers({
    el,
    st,
    ui,
    SIP,
    callHistory,
    runOneTapEnableFlow,
    stopAndUnregister,
    releaseWakeLock,
  });

  bindDesktopAudioUnlock();
}
