import { nowISO, logLine } from "../desktopLogging.js";
import { getDesktopPlatformAdapter } from "../runtime/platformAdapterRegistry.js";

const state = {
  ringtoneAudio: null,
  ringtoneRunning: false,
  ringtoneUnlocked: false,
  vibrationTimer: null,
  autoStopTimer: null,
  isIncomingCallActive: false,
  pageLoadTime: Date.now(),
  installBanner: null,
};

const RINGTONE_URL = "/ringing_old_phone.mp3";

function ensureIncomingBanner() {
  return document.getElementById("incomingAlertBanner");
}

function ensureRingtoneAudio() {
  if (state.ringtoneAudio) return state.ringtoneAudio;
  const a = new Audio();
  a.src = RINGTONE_URL;
  a.type = "audio/mpeg";
  a.preload = "auto";
  a.setAttribute("playsinline", "true");
  a.setAttribute("webkit-playsinline", "true");
  a.setAttribute("x-webkit-airplay", "deny");
  state.ringtoneAudio = a;
  return a;
}

export function primeIncomingRingtone() {
  const timeSinceLoad = Date.now() - (state.pageLoadTime || 0);
  if (timeSinceLoad < 500) return;
  if (state.ringtoneUnlocked) return;

  try {
    const a = ensureRingtoneAudio();

    if (state.isIncomingCallActive) {
      logLine(`[${nowISO()}] [incoming] Skipped priming - incoming call already active`);
      return;
    }

    a.muted = true;
    a.volume = 0;
    a.loop = false;
    a.currentTime = 0;

    const p = a.play();
    if (p !== undefined) {
      p.then(() => {
        a.pause();
        a.currentTime = 0;
        a.loop = false;
        a.volume = 0;
        a.muted = true;
        state.ringtoneUnlocked = true;
        logLine(`[${nowISO()}] [incoming] Audio unlocked for incoming calls (iOS)`);
      }).catch(() => {
        state.ringtoneUnlocked = false;
      });
    }
  } catch {
    state.ringtoneUnlocked = false;
  }
}

function startRingtone() {
  if (state.ringtoneRunning || !state.isIncomingCallActive) return;
  state.ringtoneRunning = true;

  const a = ensureRingtoneAudio();

  const platformId = (() => {
    try {
      return String(getDesktopPlatformAdapter()?.id || "");
    } catch {
      return "";
    }
  })();

  const shouldLoop = !(platformId === "ios" && document.visibilityState !== "visible");

  a.muted = false;
  a.loop = shouldLoop;
  a.volume = 0.8;
  a.currentTime = 0;

  const p = a.play();
  if (p !== undefined) {
    p.then(() => {
      logLine(`[${nowISO()}] [incoming] ringtone playing on ${platformId || "unknown"}`);
    }).catch((err) => {
      logLine(`[${nowISO()}] [incoming] ERROR: Failed to play ringtone - ${err?.message || err}`);
      state.ringtoneRunning = false;
    });
  }

  logLine(`[${nowISO()}] [incoming] start ring tone (classic telephone bell, loop=${shouldLoop})`);
}

function stopRingtone() {
  if (!state.ringtoneRunning && !state.ringtoneAudio) return;

  const a = state.ringtoneAudio;
  if (a) {
    try {
      a.pause();
      a.currentTime = 0;
      a.loop = false;
    } catch {}
  }

  state.ringtoneRunning = false;
  logLine(`[${nowISO()}] [incoming] stop ring tone`);
}

export function startIncomingAlert(callerDisplay, options = {}) {
  const { showBanner = true } = options;

  const timeSinceLoad = Date.now() - (state.pageLoadTime || 0);
  if (timeSinceLoad < 500) {
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
    if (banner) banner.style.display = "block";
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
