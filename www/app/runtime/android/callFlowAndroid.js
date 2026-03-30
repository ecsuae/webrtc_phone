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
  const cb = (() => {
    try {
      return String(window.__BUILD_CB || "");
    } catch {
      return "";
    }
  })();

  const controlUrl = cb
    ? `../controlBindings.js?cb=${encodeURIComponent(cb)}`
    : "../controlBindings.js";

  import(controlUrl)
    .then(({ bindAndroidAudioUnlock, bindControlHandlers }) => {
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
    })
    .catch((err) => {
      try {
        console.error("[boot] Failed to load controlBindings:", err);
      } catch {}
    });
}
