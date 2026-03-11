import { startAndRegister, stopAndUnregister } from "../../sipRegister.js";
import { createRegisterFlow } from "../registerFlow.js";
import { createWakeLockManager } from "../wakeLockManager.js";

function isAndroidClient() {
  return /Android/i.test(navigator.userAgent || "");
}

function startPeriodicReregistration({ st, ext, logLine, nowISO }) {
  if (!isAndroidClient()) return;

  if (st._reregTimer) {
    clearInterval(st._reregTimer);
    st._reregTimer = null;
  }

  const reregInterval = 60 * 1000;

  const reregTimer = setInterval(() => {
    if (st.reg && st.registered) {
      logLine(`[${nowISO()}] [registerer] Periodic re-registration for ${ext}`);
      st.reg.register().catch((err) => {
        logLine(`[${nowISO()}] [registerer] Periodic re-reg failed: ${err?.message || err}`);
      });
      return;
    }

    if (st.reg && !st.registered) {
      logLine(`[${nowISO()}] [registerer] Not registered, attempting registration`);
      st.reg.register().catch((err) => {
        logLine(`[${nowISO()}] [registerer] Registration attempt failed: ${err?.message || err}`);
      });
      return;
    }

    clearInterval(reregTimer);
    if (st._reregTimer === reregTimer) st._reregTimer = null;
    logLine(`[${nowISO()}] [registerer] No registerer, stopping periodic re-registration`);
  }, reregInterval);

  st._reregTimer = reregTimer;
  logLine(`[${nowISO()}] [registerer] Started aggressive 60s periodic re-registration for ${ext}`);
}

export function createAndroidRegistration({ SIP, st, ui, logLine, nowISO }) {
  const { acquireWakeLock, releaseWakeLock } = createWakeLockManager({ st, logLine, nowISO });

  const { runOneTapEnableFlow } = createRegisterFlow({
    SIP,
    st,
    ui,
    startAndRegister: async (SIPArg, stateArg, uiArg) => {
      const result = await startAndRegister(SIPArg ?? SIP, stateArg ?? st, uiArg ?? ui);
      const ext = (stateArg ?? st)?.account?.username || (uiArg ?? ui)?.ext?.();
      if (ext) startPeriodicReregistration({ st: stateArg ?? st, ext, logLine, nowISO });
      return result;
    },
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
    startAndRegister: async (SIPArg, stateArg, uiArg) => {
      const result = await startAndRegister(SIPArg ?? SIP, stateArg ?? st, uiArg ?? ui);
      const ext = (stateArg ?? st)?.account?.username || (uiArg ?? ui)?.ext?.();
      if (ext) startPeriodicReregistration({ st: stateArg ?? st, ext, logLine, nowISO });
      return result;
    },
    stopAndUnregister: (stateArg, uiArg, silentArg = false) =>
      stopAndUnregister(stateArg ?? st, uiArg ?? ui, silentArg),
    start,
    stop,
  };
}
