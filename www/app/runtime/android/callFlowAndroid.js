import { bindAndroidAudioUnlock, bindControlHandlers } from "../controlBindings.js?v=1773032001";

export function setupAndroidCallFlow({
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

  bindAndroidAudioUnlock();
}
