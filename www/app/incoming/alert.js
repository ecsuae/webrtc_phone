import { nowISO } from "../config.js";
import { logLine } from "../log.js";

let ringtoneAudio = null;
let ringtoneRunning = false;
let ringtoneUnlocked = false;
let vibrationTimer = null;
let autoStopTimer = null;
let isIncomingCallActive = false;
let pageLoadTime = Date.now();  // Prevent ghost calls in first 2 seconds

// Classic old-style telephone bell ringtone - custom MP3
const RINGTONE_URL = "/ringing_old_phone.mp3";

// Prime/unlock audio for iOS - must be called during user interaction
export function primeIncomingRingtone() {
  // Skip priming in first 5 seconds to avoid interfering with page load
  const timeSinceLoad = Date.now() - pageLoadTime;
  if (timeSinceLoad < 5000) {
    return;  // Too early, skip priming
  }

  if (ringtoneUnlocked) return;
  
  try {
    if (!ringtoneAudio) {
      ringtoneAudio = new Audio();
      ringtoneAudio.src = RINGTONE_URL;
      ringtoneAudio.type = "audio/mpeg";
      ringtoneAudio.loop = false;  // Don't loop during priming
      ringtoneAudio.volume = 0;     // SILENT during priming
      ringtoneAudio.preload = "auto";
      ringtoneAudio.setAttribute("playsinline", "true");
      ringtoneAudio.setAttribute("webkit-playsinline", "true");
    }
    
    // Only prime if no active incoming call (prevent false ringing)
    if (isIncomingCallActive) {
      logLine(`[${nowISO()}] [incoming] Skipped priming - incoming call already active`);
      return;
    }
    
    // Ensure audio is in safe state before priming
    ringtoneAudio.volume = 0;
    ringtoneAudio.loop = false;
    ringtoneAudio.currentTime = 0;
    
    const playPromise = ringtoneAudio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          // After priming play, immediately pause and reset
          ringtoneAudio.pause();
          ringtoneAudio.currentTime = 0;
          ringtoneAudio.loop = false;  // Ensure loop stays OFF after priming
          ringtoneAudio.volume = 0;    // Return to silent state
          ringtoneUnlocked = true;
          logLine(`[${nowISO()}] [incoming] Audio unlocked for incoming calls (iOS)`);
        })
        .catch(() => {
          // Expected to fail sometimes, will retry on next user interaction
          ringtoneUnlocked = false;
        });
    }
  } catch (err) {
    // Ignore errors during priming
    ringtoneUnlocked = false;
  }
}

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

function startRingtone() {
  if (ringtoneRunning || !isIncomingCallActive) return;
  ringtoneRunning = true;

  if (!ringtoneAudio) {
    ringtoneAudio = new Audio();
    ringtoneAudio.src = RINGTONE_URL;
    ringtoneAudio.type = "audio/mpeg";
    ringtoneAudio.preload = "auto";
    ringtoneAudio.setAttribute("playsinline", "true");
    ringtoneAudio.setAttribute("webkit-playsinline", "true");
    ringtoneAudio.setAttribute("x-webkit-airplay", "deny");
  }

  // Configure for actual playback (restore volume and enable loop)
  ringtoneAudio.loop = true;
  ringtoneAudio.volume = 0.8;
  ringtoneAudio.currentTime = 0;
  
  const playPromise = ringtoneAudio.play();
  if (playPromise !== undefined) {
    playPromise
      .then(() => {
        logLine(`[${nowISO()}] [incoming] ringtone playing on ${getDeviceType()}`);
      })
      .catch((err) => {
        console.error("[incoming] Failed to play ringtone:", err);
        logLine(`[${nowISO()}] [incoming] ERROR: Failed to play ringtone - ${err.message}`);
        ringtoneRunning = false;
      });
  }

  logLine(`[${nowISO()}] [incoming] start ring tone (classic telephone bell)`);
}

function getDeviceType() {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad")) return "iOS";
  if (ua.includes("android")) return "Android";
  return "Desktop";
}

function stopRingtone() {
  if (!ringtoneRunning && !ringtoneAudio) return;

  if (ringtoneAudio) {
    try {
      ringtoneAudio.pause();
      ringtoneAudio.currentTime = 0;
      ringtoneAudio.loop = false;  // Disable loop after stopping
    } catch (err) {
      console.error("[incoming] Error stopping ringtone:", err);
    }
  }

  ringtoneRunning = false;
  logLine(`[${nowISO()}] [incoming] stop ring tone`);
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
  // Prevent ghost notifications in first 5 seconds of page load
  const timeSinceLoad = Date.now() - pageLoadTime;
  if (timeSinceLoad < 5000) {
    logLine(`[${nowISO()}] [incoming] ⚠️ BLOCKED phantom call ${timeSinceLoad}ms after load (${callerDisplay})`);
    return;
  }

  logLine(`[${nowISO()}] [incoming] Accepting call ${timeSinceLoad}ms after load`);
  stopIncomingAlert();
  isIncomingCallActive = true;  // Mark that incoming call is now active
  const banner = ensureIncomingBanner();
  const title = document.getElementById("incomingAlertTitle");
  if (title) title.textContent = `Incoming call: ${callerDisplay}`;
  banner.style.display = "block";

  startRingtone();

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
  isIncomingCallActive = false;  // Mark incoming call as inactive
  stopRingtone();
  const banner = document.getElementById("incomingAlertBanner");
  if (banner) banner.style.display = "none";
  if (vibrationTimer) clearInterval(vibrationTimer);
  if (autoStopTimer) clearTimeout(autoStopTimer);
  vibrationTimer = null;
  autoStopTimer = null;
  if (navigator.vibrate) navigator.vibrate(0);
}
