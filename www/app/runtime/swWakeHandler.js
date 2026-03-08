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
  navigator.serviceWorker?.addEventListener("message", (event) => {
    logLine(`[${nowISO()}] [SW] Message received:`, JSON.stringify(event.data));

    if (event.data?.type !== "incoming-call-action" || !event.data?.wakeup) return;

    logLine(`[${nowISO()}] [SW] Wakeup signal from push notification`);

    if (st.ua) {
      const transportState = st.ua?.transport?.state;
      logLine(`[${nowISO()}] [SW] Transport state: ${transportState}, Registered: ${st.registered}`);

      if (!st.registered || transportState === "Disconnected" || transportState === "Disconnecting") {
        logLine(`[${nowISO()}] [SW] Reconnecting for incoming call...`);

        if (st.reg && transportState === "Connected") {
          st.reg.register().catch((err) => {
            logLine(`[${nowISO()}] [SW] Quick re-register failed: ${err?.message || err}`);
          });
        } else if (st.reg) {
          st.reg.register().catch(() => {
            logLine(`[${nowISO()}] [SW] Full restart for incoming call`);
            hydratePasswordInput(passInput, logLine);
            startAndRegister(SIP, st, ui);
          });
        } else {
          logLine(`[${nowISO()}] [SW] Missing registerer - starting full restart`);
          hydratePasswordInput(passInput, logLine);
          startAndRegister(SIP, st, ui);
        }
      }
    } else {
      logLine(`[${nowISO()}] [SW] No UA - starting registration`);
      hydratePasswordInput(passInput, logLine);
      startAndRegister(SIP, st, ui);
    }

    if (st.registered) acquireWakeLock();
  });
}
