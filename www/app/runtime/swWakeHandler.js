export function setupServiceWorkerWakeHandler({
  st,
  ui,
  SIP,
  startAndRegister,
  hydratePasswordInput,
  passInput,
  acquireWakeLock,
  logLine,
  nowISO,
}) {
  function hasPersistedEnable() {
    try {
      return localStorage.getItem('webrtc_calls_enabled') === '1';
    } catch {
      return false;
    }
  }

  function allowRecoveryStart() {
    try {
      return !!(st && st._callsEnabled);
    } catch {
      return false;
    }
  }

  function allowRecoveryReregister() {
    try {
      return !!(st && st.ua) && hasPersistedEnable();
    } catch {
      return false;
    }
  }

  navigator.serviceWorker?.addEventListener("message", (event) => {
    logLine(`[${nowISO()}] [SW] Message received:`, JSON.stringify(event.data));

    if (event.data?.type !== "incoming-call-action" || !event.data?.wakeup) return;

    // If this client never enabled calls in this tab/session, do not start registration from scratch.
    if (!allowRecoveryReregister() && !allowRecoveryStart()) {
      logLine(`[${nowISO()}] [SW] Calls not enabled - skipping wake auto-registration`);
      return;
    }

    logLine(`[${nowISO()}] [SW] Wakeup signal from push notification`);

    if (st.ua) {
      const transportState = st.ua?.transport?.state;
      logLine(`[${nowISO()}] [SW] Transport state: ${transportState}, Registered: ${st.registered}`);

      if (!st.registered || transportState === "Disconnected" || transportState === "Disconnecting") {
        logLine(`[${nowISO()}] [SW] Reconnecting for incoming call...`);

        if (st.reg && transportState === "Connected") {
          try {
            console.log('AUTOLOGIN_TRIGGER sw-wake-reregister');
          } catch {}
          st.reg.register().catch((err) => {
            logLine(`[${nowISO()}] [SW] Quick re-register failed: ${err?.message || err}`);
          });
        } else if (st.reg) {
          st.reg.register().catch(() => {
            logLine(`[${nowISO()}] [SW] Full restart for incoming call`);
            hydratePasswordInput(passInput, logLine);
            try {
              console.log('AUTOLOGIN_TRIGGER sw-wake-fullrestart');
            } catch {}
            startAndRegister(SIP, st, ui);
          });
        } else {
          logLine(`[${nowISO()}] [SW] Missing registerer - starting full restart`);
          hydratePasswordInput(passInput, logLine);
          try {
            console.log('AUTOLOGIN_TRIGGER sw-wake-start-missing-reg');
          } catch {}
          startAndRegister(SIP, st, ui);
        }
      }
    } else {
      // Never start a brand-new UA from SW wake unless user explicitly enabled calls in this tab/session.
      if (!allowRecoveryStart()) {
        logLine(`[${nowISO()}] [SW] No UA and calls not enabled in this session - skipping registration`);
        return;
      }
      logLine(`[${nowISO()}] [SW] No UA - starting registration`);
      hydratePasswordInput(passInput, logLine);
      try {
        console.log('AUTOLOGIN_TRIGGER sw-wake-start');
      } catch {}
      startAndRegister(SIP, st, ui);
    }

    if (st.registered) acquireWakeLock();
  });
}
