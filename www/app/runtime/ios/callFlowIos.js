import { bindControlHandlers } from "../shared/controlBindingsCore.js";
import { bindIosAudioUnlock } from "./audioUnlockIos.js";

export function setupIosCallFlow({
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

  bindIosAudioUnlock();
}
