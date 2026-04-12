import { bootLog, logLine, nowISO } from "./desktopLogging.js";
import { startDesktopRemoteLogging } from "./desktopRemoteLogs.js";
import { hydratePasswordInput } from "./desktopRecoverySession.js";

import { setupDesktopRecoveryHooks } from "./runtime/desktopRecoveryHooks.js";
import { setupDesktopServiceWorkerWakeHandler } from "./runtime/desktopServiceWorkerWakeHandler.js";
import { setupDesktopCacheActions } from "./runtime/desktopCacheActions.js?v=1773033002";

import { renderDesktopAppLayout } from "./ui/desktopAppLayout.js";
import { desktopEl, refreshDesktopEl } from "./ui/desktopDomRefs.js";

import { createDesktopAppState, createDesktopRegistration } from "./registration/desktopRegistration.js";
import { setupDesktopCallFlow } from "../runtime/desktop/callFlowDesktop.js?v=1773032001";
import { setupDesktopPush } from "../runtime/desktop/pushDesktop.js";
import { setupDesktopCallControls } from "../runtime/desktop/callControlsDesktop.js";

import { setDesktopPlatformAdapter } from "./runtime/platformAdapterRegistry.js";
import { createPlatformAdapterDesktop } from "../runtime/desktop/platformAdapterDesktop.js";

import { createDesktopUi } from "./ui/desktopAppUi.js";
import { createDesktopCallTimer, createDesktopHistoryActivity } from "./ui/desktopUiSupport.js";
import { initDesktopDialpadInput, initDesktopKeyboardToggle } from "./ui/desktopDialpadInput.js";

export function bootstrapDesktopApp(SIP = window.SIP) {
  // NOTE: This is a desktop-owned bootstrap entrypoint.
  // Behavior is intentionally kept identical to the previous desktop bootstrap.
  bootLog();

  renderDesktopAppLayout();

  refreshDesktopEl();

  initDesktopDialpadInput();
  initDesktopKeyboardToggle();

  setupDesktopCacheActions();

  setDesktopPlatformAdapter(createPlatformAdapterDesktop());

  const st = createDesktopAppState();
  const ui = createDesktopUi(st);

  const registration = createDesktopRegistration({
    SIP,
    st,
    ui,
    logLine,
    nowISO,
  });

  const callHistory = createDesktopHistoryActivity({
    historyDays: 10,
    onDial: (number) => {
      if (!number || !desktopEl.dial) return;
      desktopEl.dial.value = number;
      desktopEl.btnCall?.click();
    },
  });

  const callTimer = createDesktopCallTimer();
  window.callHistory = callHistory;
  window.callTimer = callTimer;

  setupDesktopPush({ el: desktopEl, logLine, nowISO });

  if (!SIP) ui.setStatus("SIP.js not loaded");

  setupDesktopCallFlow({
    el: desktopEl,
    st,
    ui,
    SIP,
    callHistory,
    runOneTapEnableFlow: registration.runOneTapEnableFlow,
    stopAndUnregister: registration.stopAndUnregister,
    releaseWakeLock: registration.releaseWakeLock,
  });

  setupDesktopCallControls({ SIP, st, ui });

  setupDesktopRecoveryHooks({
    st,
    ui,
    SIP,
    startAndRegister: registration.startAndRegister,
    hydratePasswordInput,
    passInput: desktopEl.pass,
    logLine,
    nowISO,
    acquireWakeLock: registration.acquireWakeLock,
    releaseWakeLock: registration.releaseWakeLock,
  });

  setupDesktopServiceWorkerWakeHandler({
    st,
    ui,
    SIP,
    startAndRegister: registration.startAndRegister,
    hydratePasswordInput,
    passInput: desktopEl.pass,
    acquireWakeLock: registration.acquireWakeLock,
    logLine,
    nowISO,
  });

  try {
    startDesktopRemoteLogging();
  } catch (err) {
    console.error("[RemoteLogs] Failed to start remote logging:", err);
  }

  return { st, ui, callHistory, callTimer };
}
