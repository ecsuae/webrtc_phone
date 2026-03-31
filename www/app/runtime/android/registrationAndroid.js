import { startAndRegister, stopAndUnregister } from "../../sipRegister.js";
import { createWakeLockManager } from "../wakeLockManager.js";

let _registrationActions = null;
let _registrationActionsImport = null;

function getRuntimeCb() {
  try {
    const fromGlobal = (typeof window !== 'undefined' && window.__BUILD_CB) ? String(window.__BUILD_CB) : '';
    if (fromGlobal) return fromGlobal;
  } catch {}
  try {
    const u = new URL(import.meta.url);
    return (u.searchParams.get('cb') || '').trim();
  } catch {
    return '';
  }
}

function loadRegisterFlow() {
  if (_registrationActions) return Promise.resolve(_registrationActions);
  if (_registrationActionsImport) return _registrationActionsImport;

  const cb = getRuntimeCb();
  const url = cb
    ? `../../registration/registrationActions.js?cb=${encodeURIComponent(cb)}`
    : "../../registration/registrationActions.js";
  _registrationActionsImport = import(url)
    .then((m) => {
      _registrationActions = m;
      return m;
    })
    .catch((err) => {
      _registrationActionsImport = null;
      throw err;
    });
  return _registrationActionsImport;
}

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

  function callsEnabledInThisSession() {
    try {
      return !!st?._callsEnabled;
    } catch {
      return false;
    }
  }

  function callsEnabledPreviously() {
    try {
      return localStorage.getItem('webrtc_calls_enabled') === '1';
    } catch {
      return false;
    }
  }

  function allowFirstRegistration() {
    // Strict: first-ever registration must only be started by explicit Enable Calls click
    // which sets st._callsEnabled in registerFlow.
    return callsEnabledInThisSession();
  }

  function allowRecoveryRegistration() {
    // If UA already exists in memory, we can allow recovery/re-register based on prior enablement.
    // (Prevents background/random input from starting a brand-new UA.)
    try {
      return !!st?.ua && callsEnabledPreviously();
    } catch {
      return false;
    }
  }

  async function guardedStartAndRegister(SIPArg, stateArg, uiArg, marker) {
    const _st = stateArg ?? st;
    const _ui = uiArg ?? ui;
    const _SIP = SIPArg ?? SIP;

    try {
      console.log(`AUTOLOGIN_ANDROID ${marker} enter enabled_session=${!!_st?._callsEnabled} enabled_prev=${callsEnabledPreviously()} hasUA=${!!_st?.ua}`);
    } catch {}

    // If there is no UA yet, only allow if user explicitly enabled calls in this tab.
    if (!_st?.ua && !allowFirstRegistration()) {
      try {
        console.log(`AUTOLOGIN_ANDROID ${marker} wrapper-skip noUA_noExplicitEnable`);
        console.trace(`AUTOLOGIN_ANDROID ${marker} stack`);
      } catch {}
      try {
        logLine?.(`[${nowISO()}] [androidReg] Blocked startAndRegister (no UA, not explicitly enabled)`);
      } catch {}
      return null;
    }

    // If UA exists, allow only if calls were enabled previously (recovery behavior).
    if (_st?.ua && !allowRecoveryRegistration() && !allowFirstRegistration()) {
      try {
        console.log(`AUTOLOGIN_ANDROID ${marker} wrapper-skip hasUA_noEnable`);
        console.trace(`AUTOLOGIN_ANDROID ${marker} stack`);
      } catch {}
      try {
        logLine?.(`[${nowISO()}] [androidReg] Blocked startAndRegister (UA exists but calls not enabled)`);
      } catch {}
      return null;
    }

    const result = await startAndRegister(_SIP, _st, _ui);
    const ext = _st?.account?.username || _ui?.ext?.();
    if (ext) startPeriodicReregistration({ st: _st, ext, logLine, nowISO });
    return result;
  }

  async function runOneTapEnableFlow() {
    const { createRegistrationActions } = await loadRegisterFlow();
    const actions = createRegistrationActions({
      SIP,
      st,
      ui,
      startAndRegister: async (SIPArg, stateArg, uiArg) => {
        return guardedStartAndRegister(SIPArg, stateArg, uiArg, 'direct-call-1');
      },
      acquireWakeLock,
      releaseWakeLock,
      logLine,
      stopAndUnregister,
    });
    return actions.enableCalls();
  }

  async function start() {
    try {
      console.log('AUTOLOGIN_ANDROID wrapper-enter start()');
    } catch {}
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
      return guardedStartAndRegister(SIPArg, stateArg, uiArg, 'direct-call-2');
    },
    stopAndUnregister: (stateArg, uiArg, silentArg = false) =>
      stopAndUnregister(stateArg ?? st, uiArg ?? ui, silentArg),
    start,
    stop,
  };
}
