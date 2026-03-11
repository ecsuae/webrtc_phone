import { startAndRegister, stopAndUnregister } from "../../sipRegister.js";
import { createRegisterFlow } from "../registerFlow.js";
import { createWakeLockManager } from "../wakeLockManager.js";

export function createDesktopRegistration({ SIP, st, ui, logLine, nowISO }) {
  const { acquireWakeLock, releaseWakeLock } = createWakeLockManager({ st, logLine, nowISO });

  const { runOneTapEnableFlow } = createRegisterFlow({
    SIP,
    st,
    ui,
    startAndRegister,
    acquireWakeLock,
    logLine,
  });

  async function start() {
    await runOneTapEnableFlow();
  }

  function stop() {
    releaseWakeLock();
    stopAndUnregister(st, ui, false);
  }

  return {
    st,
    acquireWakeLock,
    releaseWakeLock,
    runOneTapEnableFlow,
    startAndRegister: (SIPArg, stateArg, uiArg) =>
      startAndRegister(SIPArg ?? SIP, stateArg ?? st, uiArg ?? ui),
    stopAndUnregister: (stateArg, uiArg, silentArg = false) =>
      stopAndUnregister(stateArg ?? st, uiArg ?? ui, silentArg),
    start,
    stop,
  };
}
