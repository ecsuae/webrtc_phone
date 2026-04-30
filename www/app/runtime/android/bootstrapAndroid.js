import { bootLog, logLine } from "../../log.js";
import { el } from "../../dom.js";
import { nowISO } from "../../config.js";
import { createUi } from "../../ui/appUi.js";
import { createHistoryActivity } from "../../ui/historyActivity.js";
import { createCallTimer } from "../../ui/callTimer.js";
import { startRemoteLogging } from "../../remoteLogs.js";
import { hydratePasswordInput } from "../../push/recoverySession.js";
import { setupMobileRecovery } from "../mobileRecovery.js";
import { setupServiceWorkerWakeHandler } from "../swWakeHandler.js";
import { createAppState } from "../../sipRegister.js";
import { createAndroidRegistration } from "./registrationAndroid.js";
import { setupAndroidPush } from "./pushAndroid.js";
import { setupAndroidCallControls } from "./callControlsAndroid.js";
import { setPlatformAdapter } from "../shared/platformAdapter.js";
import { createPlatformAdapterAndroid } from "./platformAdapterAndroid.js";

export function bootstrapAndroidApp(SIP = window.SIP) {
  try {
    const build = String(window.__APP_BUILD__ || '');
    const cb = String(window.__BUILD_CB || '');
    console.log(`[BOOT_MARKER_BOOTSTRAP_ANDROID] build=${build} cb=${cb} ts=${Date.now()} url=${import.meta.url}`);
  } catch {}
  try {
    const url = new URL(window.location.href);
    const hr = url.searchParams.get('hr') || '';
    const enabled = (() => {
      try { return localStorage.getItem('webrtc_calls_enabled'); } catch { return null; }
    })();
    const lastReg = (() => {
      try { return localStorage.getItem('webrtc_last_registration'); } catch { return null; }
    })();
    const lastPass = (() => {
      try { return sessionStorage.getItem('webrtc_last_pass'); } catch { return null; }
    })();
    console.log(`[POST_REFRESH_BOOT_ANDROID] hr=${hr} build=${String(window.__APP_BUILD__ || '')} cb=${String(window.__BUILD_CB || '')} enabled=${enabled} lastReg=${lastReg ? 'present' : 'null'} lastPass=${lastPass ? 'present' : 'null'} href=${window.location.href}`);
  } catch {}
  bootLog();

  setPlatformAdapter(createPlatformAdapterAndroid());

  const st = createAppState();
  const ui = createUi(st);

  // Startup safety: on a fresh login-screen boot (no UA yet), ignore stale calls-enabled flags
  // that Chrome-family browsers may preserve across old sessions/tabs.
  try {
    const enabled = localStorage.getItem('webrtc_calls_enabled') === '1';
    if (enabled && !st.ua && !st.registered) {
      // Strict: do NOT allow a persisted enable flag to cause registration after reload/hard refresh.
      // Persisted enable is only meaningful for recovery within a live runtime that already has a UA.
      localStorage.removeItem('webrtc_calls_enabled');
    }
  } catch {}

  // Support diagnostics
  try {
    const diag = {
      build: String(window.__APP_BUILD__ || ''),
      cb: String(window.__BUILD_CB || ''),
      enabled: (() => {
        try { return localStorage.getItem('webrtc_calls_enabled') === '1'; } catch { return false; }
      })(),
      hasUA: !!st.ua,
      registered: !!st.registered,
      mode: (!st.ua && !st.registered) ? 'fresh_login' : 'recovery',
    };
    window.__APP_RUNTIME_DIAG__ = diag;
    const elDiag = document.getElementById('buildIndicator');
    if (elDiag) {
      elDiag.textContent = `build=${diag.build || 'unk'} cb=${diag.cb || 'unk'} br=Android enabled=${diag.enabled ? 1 : 0} hasUA=${diag.hasUA ? 1 : 0} reg=${diag.registered ? 1 : 0} mode=${diag.mode}`;
    }
  } catch {}

  const registration = createAndroidRegistration({
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

  setupAndroidPush({ el, logLine, nowISO });

  if (!SIP) ui.setStatus("SIP.js not loaded");

  // IMPORTANT: avoid pinning an older module graph in Chrome-family browsers.
  // Dynamically import the Android call flow using the current runtime cb token.
  try {
    const cb = typeof window !== 'undefined' ? (window.__BUILD_CB || '') : '';
    const callFlowUrl = cb ? `./callFlowAndroid.js?cb=${encodeURIComponent(cb)}` : "./callFlowAndroid.js";
    import(callFlowUrl)
      .then((m) => m.setupAndroidCallFlow({
        el,
        st,
        ui,
        SIP,
        callHistory,
        runOneTapEnableFlow: registration.runOneTapEnableFlow,
        stopAndUnregister: registration.stopAndUnregister,
        releaseWakeLock: registration.releaseWakeLock,
      }))
      .catch((err) => {
        try {
          console.error("[boot] Failed to load Android call flow:", err);
        } catch {}
      });
  } catch {}

  setupAndroidCallControls({ SIP, st, ui });

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
