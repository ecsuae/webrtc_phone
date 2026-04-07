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
  import("../shared/controlBindingsCore.js")
    .then(({ bindControlHandlers }) => {
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
    })
    .catch(() => {});

  import("./audioUnlockAndroid.js")
    .then(({ bindAndroidAudioUnlock }) => {
      if (typeof bindAndroidAudioUnlock === "function") bindAndroidAudioUnlock();
    })
    .catch(() => {});
}
