function waitForRegistration(st, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (st.registered) {
        clearInterval(timer);
        resolve(true);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, 250);
  });
}

export function createRegistrationActions({ SIP, st, ui, startAndRegister, acquireWakeLock, releaseWakeLock, logLine, stopAndUnregister }) {
  function persistEnableFlag(enabled) {
    try {
      if (enabled) localStorage.setItem('webrtc_calls_enabled', '1');
      else localStorage.removeItem('webrtc_calls_enabled');
    } catch {}
  }

  async function enableCalls() {
    // Do not trigger notification permission prompts on login.
    // Permission is handled from the initial page-level flow.
    logLine("[Push] Login flow: skip notification prompt");

    try {
      st._callsEnabled = true;
      persistEnableFlag(true);
    } catch {}

    await startAndRegister(SIP, st, ui);
    if (!st.registered) {
      const ok = await waitForRegistration(st);
      if (!ok) return;
    }

    acquireWakeLock();
  }

  async function disableCalls() {
    try {
      st._callsEnabled = false;
      persistEnableFlag(false);
    } catch {}

    try {
      releaseWakeLock?.();
    } catch {}

    if (typeof stopAndUnregister === 'function') {
      try {
        await stopAndUnregister(st, ui, false);
      } catch {}
    }
  }

  return {
    enableCalls,
    disableCalls,
  };
}
