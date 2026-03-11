import { bindControlHandlers, bindIosAudioUnlock } from "../controlBindings.js";

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
