import { bindDesktopControlHandlers } from "../../desktop/bindings/desktopControlBindings.js";
import { bindDesktopAudioUnlock } from "./audioUnlockDesktop.js";

export function setupDesktopCallFlow({
  el,
  st,
  ui,
  SIP,
  callHistory,
  runOneTapEnableFlow,
  startAndRegister,
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
    startAndRegister,
    stopAndUnregister,
    releaseWakeLock,
  });

  bindDesktopAudioUnlock();
}
