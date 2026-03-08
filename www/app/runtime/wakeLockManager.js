export function createWakeLockManager({ st, logLine, nowISO }) {
  let wakeLock = null;

  async function acquireWakeLock() {
    if (!("wakeLock" in navigator)) return;
    try {
      if (wakeLock !== null) {
        try {
          await wakeLock.release();
        } catch {}
      }

      wakeLock = await navigator.wakeLock.request("screen");
      logLine(`[${nowISO()}] [WakeLock] Screen wake lock acquired`);

      wakeLock.addEventListener("release", () => {
        logLine(`[${nowISO()}] [WakeLock] Released`);
        wakeLock = null;

        if (st.registered && document.visibilityState === "visible") {
          setTimeout(() => {
            if (st.registered && wakeLock === null) {
              logLine(`[${nowISO()}] [WakeLock] Auto-reacquiring after release`);
              acquireWakeLock();
            }
          }, 500);
        }
      });
    } catch (err) {
      logLine(`[${nowISO()}] [WakeLock] Failed: ${err.name}`);
    }
  }

  function releaseWakeLock() {
    if (wakeLock === null) return;
    wakeLock.release().then(() => {
      logLine(`[${nowISO()}] [WakeLock] Released`);
      wakeLock = null;
    }).catch((err) => {
      logLine(`[${nowISO()}] [WakeLock] Release error: ${err.name}`);
      wakeLock = null;
    });
  }

  return {
    acquireWakeLock,
    releaseWakeLock,
  };
}
