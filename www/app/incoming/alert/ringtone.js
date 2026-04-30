import { nowISO } from "../../config.js";
import { logLine } from "../../log.js";
import { requirePlatformAdapter } from "../../runtime/shared/platformAdapter.js";
import { state, RINGTONE_URL } from "./state.js";

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
  if (timeSinceLoad < 5000) return;
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

export function startRingtone() {
  if (state.ringtoneRunning || !state.isIncomingCallActive) return;
  state.ringtoneRunning = true;

  const a = ensureRingtoneAudio();

  const platformId = (() => {
    try {
      return String(requirePlatformAdapter()?.id || "");
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

export function stopRingtone() {
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
