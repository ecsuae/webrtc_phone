import { bootLog, logLine } from "../../log.js";
import { el } from "../../dom.js";
import { nowISO } from "../../config.js";
import { createUi } from "../../ui/appUi.js";
import { createHistoryActivity } from "../../ui/historyActivity.js";
import { createCallTimer } from "../../ui/callTimer.js";
import { startRemoteLogging } from "../../remoteLogs.js?v=20260310-r1";
import { hydratePasswordInput } from "../../push/recoverySession.js";
import { setupMobileRecovery } from "../mobileRecovery.js";
import { setupServiceWorkerWakeHandler } from "../swWakeHandler.js";
import { createAppState } from "../../sipRegister.js";
import { createIosRegistration } from "./registrationIos.js";
import { setupIosCallFlow } from "./callFlowIos.js";
import { setupIosPush } from "./pushIos.js";
import { setupIosCallControls } from "./callControlsIos.js";

export function bootstrapIosApp(SIP = window.SIP) {
  bootLog();

  const st = createAppState();
  const ui = createUi(st);

  const registration = createIosRegistration({
    SIP,
    st,
    ui,
    logLine,
    nowISO,
  });

  const callHistory = createHistoryActivity({
    historyDays: 10,
    onDial: (number) => {
      if (!number || !el.dial) return;
      el.dial.value = number;
      el.btnCall?.click();
    },
  });

  const callTimer = createCallTimer();
  window.callHistory = callHistory;
  window.callTimer = callTimer;

  setupIosPush({ el, logLine, nowISO });

  if (!SIP) ui.setStatus("SIP.js not loaded");

  setupIosCallFlow({
    el,
    st,
    ui,
    SIP,
    callHistory,
    runOneTapEnableFlow: registration.runOneTapEnableFlow,
    stopAndUnregister: registration.stopAndUnregister,
    releaseWakeLock: registration.releaseWakeLock,
  });

  setupIosCallControls({ SIP, st, ui });

  setupMobileRecovery({
    st,
    ui,
    SIP,
    startAndRegister: registration.startAndRegister,
    hydratePasswordInput,
    passInput: el.pass,
    logLine,
    nowISO,
    acquireWakeLock: registration.acquireWakeLock,
    releaseWakeLock: registration.releaseWakeLock,
  });

  setupServiceWorkerWakeHandler({
    st,
    ui,
    SIP,
    startAndRegister: registration.startAndRegister,
    hydratePasswordInput,
    passInput: el.pass,
    acquireWakeLock: registration.acquireWakeLock,
    logLine,
    nowISO,
  });

  try {
    startRemoteLogging();
  } catch (err) {
    console.error("[RemoteLogs] Failed to start remote logging:", err);
  }

  return { st, ui, callHistory, callTimer };
}
