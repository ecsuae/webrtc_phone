import { nowISO } from "../../config.js";
import { logLine } from "../../log.js";
import { state } from "./state.js";
import { ensureIncomingBanner } from "./banner.js";
import { primeIncomingRingtone, startRingtone, stopRingtone } from "./ringtone.js";

export { primeIncomingRingtone };

export function focusDialTabForIncoming() {
  const dialBtn = document.querySelector('.tab-btn[data-tab="dial-tab"]');
  const allBtns = document.querySelectorAll(".tab-btn");
  const allTabs = document.querySelectorAll(".tab-content");
  const dialTab = document.getElementById("dial-tab");

  allBtns.forEach((btn) => btn.classList.remove("active"));
  allTabs.forEach((tab) => tab.classList.remove("active"));
  if (dialBtn) dialBtn.classList.add("active");
  if (dialTab) dialTab.classList.add("active");
}

export function startIncomingAlert(callerDisplay, options = {}) {
  const { showBanner = true } = options;

  const timeSinceLoad = Date.now() - (state.pageLoadTime || 0);
  if (timeSinceLoad < 5000) {
    logLine(`[${nowISO()}] [incoming] ⚠️ BLOCKED phantom call ${timeSinceLoad}ms after load (${callerDisplay})`);
    return;
  }

  logLine(`[${nowISO()}] [incoming] Accepting call ${timeSinceLoad}ms after load`);

  stopIncomingAlert();
  state.isIncomingCallActive = true;

  if (showBanner) {
    const banner = ensureIncomingBanner();
    const title = document.getElementById("incomingAlertTitle");
    if (title) title.textContent = `Incoming call: ${callerDisplay}`;
    banner.style.display = "block";
  }

  startRingtone();

  if (navigator.vibrate) {
    navigator.vibrate([250, 150, 250, 800]);
    state.vibrationTimer = setInterval(() => navigator.vibrate([250, 150, 250, 800]), 1700);
  }

  if (window.Notification && Notification.permission === "granted") {
    try {
      new Notification("Incoming call", { body: callerDisplay });
    } catch {}
  }

  state.autoStopTimer = setTimeout(() => {
    stopIncomingAlert();
    logLine(`[${nowISO()}] [incoming] Failsafe stop: incoming alert auto-stopped after timeout`);
  }, 60000);
}

export function stopIncomingAlert() {
  state.isIncomingCallActive = false;
  stopRingtone();

  const banner = document.getElementById("incomingAlertBanner");
  if (banner) banner.style.display = "none";

  if (state.vibrationTimer) clearInterval(state.vibrationTimer);
  if (state.autoStopTimer) clearTimeout(state.autoStopTimer);

  state.vibrationTimer = null;
  state.autoStopTimer = null;

  if (navigator.vibrate) navigator.vibrate(0);
}
