export function setupMobileRecovery({
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
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible") {
      logLine(`[${nowISO()}] [mobile] App hidden - will rely on periodic re-registration`);
      return;
    }

    logLine(`[${nowISO()}] [mobile] App visible - checking registration`);

    if (!st.ua) {
      logLine(`[${nowISO()}] [mobile] No UserAgent - attempting full restart`);
      if (!ui.ext()) return;
      try {
        hydratePasswordInput(passInput, logLine);
        await startAndRegister(SIP, st, ui);
        logLine(`[${nowISO()}] [mobile] UserAgent restarted successfully`);
      } catch (err) {
        logLine(`[${nowISO()}] [mobile] Restart failed: ${err?.message || err}`);
      }
      return;
    }

    const transportState = st.ua?.transport?.state;
    logLine(`[${nowISO()}] [mobile] Transport state: ${transportState}`);

    if (transportState === "Disconnected" || transportState === undefined) {
      logLine(`[${nowISO()}] [mobile] Transport dead - restarting UserAgent`);
      if (!ui.ext()) return;
      try {
        try {
          await st.ua.stop();
        } catch (err) {
          logLine(`[${nowISO()}] [mobile] Error stopping old UA: ${err?.message || err}`);
        }
        hydratePasswordInput(passInput, logLine);
        await startAndRegister(SIP, st, ui);
        logLine(`[${nowISO()}] [mobile] UserAgent restarted successfully`);
      } catch (err) {
        logLine(`[${nowISO()}] [mobile] Failed to restart: ${err?.message || err}`);
      }
      return;
    }

    if (st.reg) {
      logLine(`[${nowISO()}] [mobile] App visible - IMMEDIATE re-registration attempt`);
      st.reg.register().catch((err) => {
        logLine(`[${nowISO()}] [mobile] Immediate re-register failed: ${err?.message || err}`);
        setTimeout(() => {
          if (!st.reg) return;
          st.reg.register().catch((err2) => {
            logLine(`[${nowISO()}] [mobile] Delayed re-register also failed: ${err2?.message || err2}`);
            if (!ui.ext()) return;
            logLine(`[${nowISO()}] [mobile] All retries failed - attempting full restart`);
            hydratePasswordInput(passInput, logLine);
            startAndRegister(SIP, st, ui).catch((err3) => {
              logLine(`[${nowISO()}] [mobile] Full restart failed: ${err3?.message || err3}`);
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
      logLine(`[${nowISO()}] [mobile] Focus re-register failed`);
    });
  });

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted || !st.registered || !st.reg) return;
    st.reg.register().catch((err) => {
      logLine(`[${nowISO()}] [mobile] bfcache re-register failed: ${err?.message || err}`);
    });
  });

  window.addEventListener("beforeunload", () => {
    releaseWakeLock();
  });

  window.addEventListener("online", () => {
    logLine(`[${nowISO()}] [mobile] Network online - checking connection`);
    if (!st.ua || st.registered || !st.reg) return;
    setTimeout(() => {
      logLine(`[${nowISO()}] [mobile] Attempting re-registration after network recovery`);
      st.reg.register().catch((err) => {
        logLine(`[${nowISO()}] [mobile] Network recovery re-register failed: ${err?.message || err}`);
        hydratePasswordInput(passInput, logLine);
        startAndRegister(SIP, st, ui);
      });
    }, 1000);
  });

  window.addEventListener("offline", () => {
    logLine(`[${nowISO()}] [mobile] Network offline detected`);
  });
}
