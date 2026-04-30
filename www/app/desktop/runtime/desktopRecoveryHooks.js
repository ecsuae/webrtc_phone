export function setupDesktopRecoveryHooks({
  st,
  ui,
  SIP,
  startAndRegister,
  hydratePasswordInput,
  passInput,
  logLine,
  nowISO,
  acquireWakeLock,
  releaseWakeLock,
}) {
  function hasPersistedEnable() {
    try {
      return localStorage.getItem("webrtc_calls_enabled") === "1";
    } catch {
      return false;
    }
  }

  function allowRecoveryStart() {
    // Strict: never start a brand-new registration just because localStorage says it was enabled.
    // Only allow auto-start if the user enabled calls in THIS tab/session.
    try {
      return !!(st && st._callsEnabled);
    } catch {
      return false;
    }
  }

  function allowRecoveryReregister() {
    // Allow background recovery only after the app has an active UA in memory.
    try {
      return !!(st && st.ua) && hasPersistedEnable();
    } catch {
      return false;
    }
  }

  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible") {
      logLine(`[${nowISO()}] [desktop] App hidden - will rely on periodic re-registration`);
      return;
    }

    logLine(`[${nowISO()}] [desktop] App visible - checking registration`);

    if (!st.ua) {
      logLine(`[${nowISO()}] [desktop] No UserAgent - attempting full restart`);
      if (!allowRecoveryStart()) {
        logLine(`[${nowISO()}] [desktop] Calls not enabled in this session - skipping UA start`);
        return;
      }
      if (!ui.ext()) return;
      try {
        hydratePasswordInput(passInput, logLine);
        await startAndRegister(SIP, st, ui);
        logLine(`[${nowISO()}] [desktop] UserAgent restarted successfully`);
      } catch (err) {
        logLine(`[${nowISO()}] [desktop] Restart failed: ${err?.message || err}`);
      }
      return;
    }

    const transportState = st.ua?.transport?.state;
    logLine(`[${nowISO()}] [desktop] Transport state: ${transportState}`);

    if (transportState === "Disconnected" || transportState === undefined) {
      logLine(`[${nowISO()}] [desktop] Transport dead - restarting UserAgent`);
      if (!allowRecoveryReregister() && !allowRecoveryStart()) {
        logLine(`[${nowISO()}] [desktop] Calls not enabled - skipping transport recovery`);
        return;
      }
      if (!ui.ext()) return;
      try {
        try {
          await st.ua.stop();
        } catch (err) {
          logLine(`[${nowISO()}] [desktop] Error stopping old UA: ${err?.message || err}`);
        }
        hydratePasswordInput(passInput, logLine);
        await startAndRegister(SIP, st, ui);
        logLine(`[${nowISO()}] [desktop] UserAgent restarted successfully`);
      } catch (err) {
        logLine(`[${nowISO()}] [desktop] Failed to restart: ${err?.message || err}`);
      }
      return;
    }

    if (st.reg) {
      if (!allowRecoveryReregister()) {
        logLine(`[${nowISO()}] [desktop] Calls not enabled - skipping re-register`);
        return;
      }
      logLine(`[${nowISO()}] [desktop] App visible - IMMEDIATE re-registration attempt`);
      st.reg.register().catch((err) => {
        logLine(`[${nowISO()}] [desktop] Immediate re-register failed: ${err?.message || err}`);
        setTimeout(() => {
          if (!st.reg) return;
          st.reg.register().catch((err2) => {
            logLine(`[${nowISO()}] [desktop] Delayed re-register also failed: ${err2?.message || err2}`);
            if (!ui.ext()) return;
            logLine(`[${nowISO()}] [desktop] All retries failed - attempting full restart`);
            hydratePasswordInput(passInput, logLine);
            startAndRegister(SIP, st, ui).catch((err3) => {
              logLine(`[${nowISO()}] [desktop] Full restart failed: ${err3?.message || err3}`);
            });
          });
        }, 2000);
      });
    }

    if (st.registered) acquireWakeLock();
  });

  window.addEventListener("focus", () => {
    if (!st.ua || !st.registered) return;
    const transportState = st.ua?.transport?.state;
    if (transportState !== "Disconnected" && transportState !== "Disconnecting") return;
    if (!st.reg) return;
    st.reg.register().catch(() => {
      logLine(`[${nowISO()}] [desktop] Focus re-register failed`);
    });
  });

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted || !st.registered || !st.reg) return;
    st.reg.register().catch((err) => {
      logLine(`[${nowISO()}] [desktop] bfcache re-register failed: ${err?.message || err}`);
    });
  });

  window.addEventListener("beforeunload", () => {
    releaseWakeLock();
  });

  window.addEventListener("online", () => {
    logLine(`[${nowISO()}] [desktop] Network online - checking connection`);
    if (!allowRecoveryReregister()) {
      logLine(`[${nowISO()}] [desktop] Calls not enabled - skipping network recovery registration`);
      return;
    }
    if (!st.ua || st.registered || !st.reg) return;
    setTimeout(() => {
      logLine(`[${nowISO()}] [desktop] Attempting re-registration after network recovery`);
      st.reg.register().catch((err) => {
        logLine(`[${nowISO()}] [desktop] Network recovery re-register failed: ${err?.message || err}`);
        hydratePasswordInput(passInput, logLine);
        startAndRegister(SIP, st, ui);
      });
    }, 1000);
  });

  window.addEventListener("offline", () => {
    logLine(`[${nowISO()}] [desktop] Network offline detected`);
  });
}
