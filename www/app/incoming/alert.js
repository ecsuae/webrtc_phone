import { nowISO } from "../config.js";
import { logLine } from "../log.js";

let ringtoneTimer = null;
let ringtoneCtx = null;
let vibrationTimer = null;
let autoStopTimer = null;

function ensureIncomingBanner() {
  let banner = document.getElementById("incomingAlertBanner");
  if (banner) return banner;

  banner = document.createElement("div");
  banner.id = "incomingAlertBanner";
  banner.style.position = "fixed";
  banner.style.left = "12px";
  banner.style.right = "12px";
  banner.style.top = "12px";
  banner.style.zIndex = "9999";
  banner.style.padding = "12px 14px";
  banner.style.borderRadius = "10px";
  banner.style.background = "#16a34a";
  banner.style.color = "#ffffff";
  banner.style.fontWeight = "700";
  banner.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)";
  banner.style.display = "none";
  banner.style.textAlign = "center";

  const title = document.createElement("div");
  title.id = "incomingAlertTitle";
  title.style.marginBottom = "10px";
  banner.appendChild(title);

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";
  actions.style.justifyContent = "center";

  const answerBtn = document.createElement("button");
  answerBtn.type = "button";
  answerBtn.textContent = "Answer";
  answerBtn.id = "incomingBannerAnswer";
  answerBtn.style.border = "none";
  answerBtn.style.borderRadius = "8px";
  answerBtn.style.padding = "8px 14px";
  answerBtn.style.fontWeight = "700";
  answerBtn.style.cursor = "pointer";
  answerBtn.style.background = "#ffffff";
  answerBtn.style.color = "#0f766e";
  answerBtn.addEventListener("click", () => document.getElementById("btnAnswer")?.click());

  const rejectBtn = document.createElement("button");
  rejectBtn.type = "button";
  rejectBtn.textContent = "Reject";
  rejectBtn.id = "incomingBannerReject";
  rejectBtn.style.border = "1px solid #ffffff";
  rejectBtn.style.borderRadius = "8px";
  rejectBtn.style.padding = "8px 14px";
  rejectBtn.style.fontWeight = "700";
  rejectBtn.style.cursor = "pointer";
  rejectBtn.style.background = "transparent";
  rejectBtn.style.color = "#ffffff";
  rejectBtn.addEventListener("click", () => document.getElementById("btnReject")?.click());

  actions.appendChild(answerBtn);
  actions.appendChild(rejectBtn);
  banner.appendChild(actions);
  document.body.appendChild(banner);
  return banner;
}

function ringOnce() {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!ringtoneCtx) ringtoneCtx = new Ctx();
  if (ringtoneCtx.state === "suspended") ringtoneCtx.resume().catch(() => {});

  const now = ringtoneCtx.currentTime;
  const gain = ringtoneCtx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
  gain.connect(ringtoneCtx.destination);

  const osc = ringtoneCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, now);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.38);
}

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

export function startIncomingAlert(callerDisplay) {
  stopIncomingAlert();
  const banner = ensureIncomingBanner();
  const title = document.getElementById("incomingAlertTitle");
  if (title) title.textContent = `Incoming call: ${callerDisplay}`;
  banner.style.display = "block";

  ringOnce();
  ringtoneTimer = setInterval(ringOnce, 1200);

  if (navigator.vibrate) {
    navigator.vibrate([250, 150, 250, 800]);
    vibrationTimer = setInterval(() => navigator.vibrate([250, 150, 250, 800]), 1700);
  }

  if (window.Notification && Notification.permission === "granted") {
    try {
      new Notification("Incoming call", { body: callerDisplay });
    } catch {
      // ignore notification failures
    }
  }

  autoStopTimer = setTimeout(() => {
    stopIncomingAlert();
    logLine(`[${nowISO()}] [incoming] Failsafe stop: incoming alert auto-stopped after timeout`);
  }, 60000);
}

export function stopIncomingAlert() {
  const banner = document.getElementById("incomingAlertBanner");
  if (banner) banner.style.display = "none";
  if (ringtoneTimer) clearInterval(ringtoneTimer);
  if (vibrationTimer) clearInterval(vibrationTimer);
  if (autoStopTimer) clearTimeout(autoStopTimer);
  ringtoneTimer = null;
  vibrationTimer = null;
  autoStopTimer = null;
  if (navigator.vibrate) navigator.vibrate(0);
}
