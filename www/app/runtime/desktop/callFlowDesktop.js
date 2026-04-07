import { bindControlHandlers } from "../shared/controlBindingsCore.js";
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
  bindControlHandlers({
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
