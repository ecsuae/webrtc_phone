import { bootLog, logLine } from "./log.js";
import { el } from "./dom.js";
import { nowISO } from "./config.js";
import { createAppState, startAndRegister, stopAndUnregister } from "./sipRegister.js";
import { startCall, hangupCall } from "./sipCall.js";
import { answerIncomingCallIsolated, rejectIncomingCallIsolated } from "./sipCallIncoming.js";
import { primeIncomingRingtone } from "./incoming/alert.js";
import * as Push from "./push.js";
import { createUi } from "./ui/appUi.js";
import { createCallHistory } from "./ui/callHistoryLocal.js";
import { createCallTimer } from "./ui/callTimer.js";
import { setupTabNavigation } from "./ui/tabNavigation.js";
import { setupCallControls } from "./ui/callControls.js";
import { startRemoteLogging } from "./remoteLogs.js?v=20260307-r4";

bootLog();

const SIP = window.SIP;
const st = createAppState();
const ui = createUi(st);
const callHistory = createCallHistory();
const callTimer = createCallTimer();

window.callHistory = callHistory;
window.callTimer = callTimer;

Push.init().catch((err) => console.warn("Push notifications not available:", err));

if (!SIP) {
  ui.setStatus("SIP.js not loaded");
}

// Wake Lock API to keep Android device awake while registered
let wakeLock = null;

async function acquireWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    logLine(`[${nowISO()}] [WakeLock] Screen wake lock acquired`);
    wakeLock.addEventListener('release', () => {
      logLine(`[${nowISO()}] [WakeLock] Released`);
    });
  } catch (err) {
    logLine(`[${nowISO()}] [WakeLock] Failed: ${err.name}`);
  }
}

function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release().then(() => {
      logLine(`[${nowISO()}] [WakeLock] Released`);
      wakeLock = null;
    }).catch((err) => {
      logLine(`[${nowISO()}] [WakeLock] Release error: ${err.name}`);
      wakeLock = null;
    });
  }
}

// Event handlers with Wake Lock management
if (el.btnStart && el.btnStop) {
  el.btnStart.addEventListener("click", () => {
    primeIncomingRingtone();
    startAndRegister(SIP, st, ui).then(() => {
      if (st.registered) acquireWakeLock();
    });
  });
  el.btnStop.addEventListener("click", () => {
    releaseWakeLock();
    stopAndUnregister(st, ui, false);
  });
} else if (el.btnStart) {
  el.btnStart.addEventListener("click", () => {
    primeIncomingRingtone();
    if (st.registered) {
      releaseWakeLock();
      stopAndUnregister(st, ui, false);
    } else {
      startAndRegister(SIP, st, ui).then(() => {
        if (st.registered) acquireWakeLock();
      });
    }
  });
}

el.btnCall?.addEventListener("click", () => {
  primeIncomingRingtone();
  const number = ui.dial();
  if (number) callHistory.addCall(number, "outgoing");
  startCall(SIP, st, ui);
});

el.btnHangup?.addEventListener("click", () => hangupCall(st, ui, false));
el.btnAnswer?.addEventListener("click", () => answerIncomingCallIsolated(SIP, st, ui));
el.btnReject?.addEventListener("click", () => rejectIncomingCallIsolated(st, ui));

el.dial?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  primeIncomingRingtone();
  el.btnCall?.click();
});

el.pass?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  primeIncomingRingtone();
  if (!st.registered) startAndRegister(SIP, st, ui).then(() => {
    if (st.registered) acquireWakeLock();
  });
});

setupTabNavigation();
setupCallControls(st);

// iOS audio unlock - prime on first user interaction
if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
  const unlockOnInteraction = () => {
    primeIncomingRingtone();
    document.removeEventListener("touchstart", unlockOnInteraction);
    document.removeEventListener("click", unlockOnInteraction);
  };
  document.addEventListener("touchstart", unlockOnInteraction, { once: true });
  document.addEventListener("click", unlockOnInteraction, { once: true });
}

// Mobile screen lock/unlock handling
function setupScreenLockRecovery() {
  // Visibility change (tab/app hidden/shown)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      logLine(`[${nowISO()}] [mobile] App visible - checking registration`);
      if (st.ua && st.registered) {
        const transportState = st.ua?.transport?.state;
        if (transportState === "Disconnected" || transportState === "Disconnecting") {
          logLine(`[${nowISO()}] [mobile] Reconnecting after visibility change`);
          if (st.reg) {
            st.reg.register().catch((err) => {
              logLine(`[${nowISO()}] [mobile] Re-register failed, restarting`);
              startAndRegister(SIP, st, ui);
            });
          }
        }
      }
      if (st.registered) {
        acquireWakeLock();
      }
    } else {
      logLine(`[${nowISO()}] [mobile] App hidden`);
    }
  });
  
  // Window focus
  window.addEventListener("focus", () => {
    if (st.ua && st.registered) {
      const transportState = st.ua?.transport?.state;
      if (transportState === "Disconnected" || transportState === "Disconnecting") {
        if (st.reg) {
          st.reg.register().catch(() => {
            logLine(`[${nowISO()}] [mobile] Focus re-register failed`);
          });
        }
      }
    }
  });

  // Page show (iOS bfcache restore)
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && st.registered && st.reg) {
      st.reg.register().catch((err) => {
        logLine(`[${nowISO()}] [mobile] bfcache re-register failed: ${err?.message || err}`);
      });
    }
  });

  // Before unload
  window.addEventListener("beforeunload", () => {
    releaseWakeLock();
  });
}

setupScreenLockRecovery();

// Start remote logging for mobile debugging
try {
  startRemoteLogging();
} catch (err) {
  console.error('[RemoteLogs] Failed to start remote logging:', err);
}

// iOS: push notification setup
if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
  window.addEventListener("load", () => {
    logLine(`[${nowISO()}] [iOS] Push initialization`);
    Push.init().catch(() => {});
  });
}
