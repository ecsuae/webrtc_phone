export function bindRegistrationUiHandlers({
  el,
  st,
  ui,
  runOneTapEnableFlow,
  stopAndUnregister,
  releaseWakeLock,
  primeIncomingRingtone,
}) {
  if (el.btnStart && el.btnStop) {
    el.btnStart.addEventListener("click", async () => {
      primeIncomingRingtone();
      await runOneTapEnableFlow();
    });

    el.btnStop.addEventListener("click", () => {
      releaseWakeLock();
      stopAndUnregister(st, ui, false);
    });
    return;
  }

  if (el.btnStart) {
    el.btnStart.addEventListener("click", async () => {
      primeIncomingRingtone();
      if (st.registered) {
        releaseWakeLock();
        stopAndUnregister(st, ui, false);
      } else {
        await runOneTapEnableFlow();
      }
    });
  }
}
