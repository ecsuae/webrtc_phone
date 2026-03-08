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

export function createRegisterFlow({ SIP, st, ui, startAndRegister, acquireWakeLock, logLine }) {
  async function runOneTapEnableFlow() {
    // Do not trigger notification permission prompts on login.
    // Permission is handled from the initial page-level flow.
    logLine("[Push] Login flow: skip notification prompt");

    await startAndRegister(SIP, st, ui);
    if (!st.registered) {
      const ok = await waitForRegistration(st);
      if (!ok) return;
    }

    acquireWakeLock();
  }

  return {
    runOneTapEnableFlow,
  };
}
