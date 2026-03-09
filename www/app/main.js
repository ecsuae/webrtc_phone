import { bootLog, logLine } from "./log.js";
import { el } from "./dom.js";
import { nowISO } from "./config.js";
import { createAppState, startAndRegister, stopAndUnregister } from "./sipRegister.js";
import * as Push from "./push.js";
import { createUi } from "./ui/appUi.js";
import { createHistoryActivity } from "./ui/historyActivity.js";
import { createCallTimer } from "./ui/callTimer.js";
import { startRemoteLogging } from "./remoteLogs.js?v=20260307-r4";
import { checkIOSInstallation } from "./ui/iosInstallPrompt.js";
import { setupInstallShortcut } from "./push/installShortcut.js";
import { hydratePasswordInput } from "./push/recoverySession.js";
import { createWakeLockManager } from "./runtime/wakeLockManager.js";
import { createRegisterFlow } from "./runtime/registerFlow.js";
import { bindControlHandlers, bindIosAudioUnlock } from "./runtime/controlBindings.js";
import { setupMobileRecovery } from "./runtime/mobileRecovery.js";
import { setupServiceWorkerWakeHandler } from "./runtime/swWakeHandler.js";

bootLog();

const SIP = window.SIP;
const st = createAppState();
const ui = createUi(st);
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

// Initialize push notifications and check iOS installation
Push.init().catch((err) => console.warn("Push notifications not available:", err));

// Check if iOS and prompt for PWA installation if needed
setTimeout(() => {
  checkIOSInstallation();
}, 2000); // Delay to let page fully load

setupInstallShortcut({ button: el.btnInstallApp, logLine });

if (!SIP) {
  ui.setStatus("SIP.js not loaded");
}

const { acquireWakeLock, releaseWakeLock } = createWakeLockManager({ st, logLine, nowISO });
const { runOneTapEnableFlow } = createRegisterFlow({
  SIP,
  st,
  ui,
  startAndRegister,
  acquireWakeLock,
  logLine,
});

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

setupMobileRecovery({
  st,
  ui,
  SIP,
  startAndRegister,
  hydratePasswordInput,
  passInput: el.pass,
  logLine,
  nowISO,
  acquireWakeLock,
  releaseWakeLock,
});

setupServiceWorkerWakeHandler({
  st,
  ui,
  SIP,
  startAndRegister,
  hydratePasswordInput,
  passInput: el.pass,
  acquireWakeLock,
  logLine,
  nowISO,
});

// Start remote logging for mobile debugging
try {
  startRemoteLogging();
} catch (err) {
  console.error('[RemoteLogs] Failed to start remote logging:', err);
}

// iOS: push notification setup
if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
  window.addEventListener("load", () => {
    logLine(`[${nowISO()}] [iOS] Push initialization`);
    Push.init().catch(() => {});
  });
}
