import { nowISO } from "../config.js";
import { logLine } from "../log.js";

let ringbackCtx = null;
let ringbackGain = null;
let ringbackOscA = null;
let ringbackOscB = null;
let ringbackCadenceTimer = null;
let ringbackRunning = false;

// UK-style ringback profile:
// 0.4s ON, 0.2s OFF, 0.4s ON, 2.0s OFF
const RINGBACK_FREQ_A = 400;
const RINGBACK_FREQ_B = 450;
const RINGBACK_VOLUME = 0.14;
const RINGBACK_SEGMENTS = [
  { on: 0.4, off: 0.2 },
  { on: 0.4, off: 2.0 },
];
const RINGBACK_CYCLE_SEC = RINGBACK_SEGMENTS.reduce((sum, seg) => sum + seg.on + seg.off, 0);
const RINGBACK_CYCLE_MS = Math.round(RINGBACK_CYCLE_SEC * 1000);

function ensureContext() {
  if (!window.AudioContext && !window.webkitAudioContext) {
    console.error("[ringback] AudioContext not available");
    return null;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!ringbackCtx) {
    ringbackCtx = new Ctx();
  }
  return ringbackCtx;
}

export function primeOutboundRingbackContext() {
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

function applyCadenceCycle(ctx, startAt) {
  if (!ringbackGain) return;

  ringbackGain.gain.cancelScheduledValues(startAt);

  let cursor = startAt;
  ringbackGain.gain.setValueAtTime(0.0001, cursor);

  for (const seg of RINGBACK_SEGMENTS) {
    const attackEnd = cursor + 0.02;
    const holdEnd = Math.max(cursor + seg.on - 0.02, attackEnd);
    const releaseEnd = cursor + seg.on;

    ringbackGain.gain.exponentialRampToValueAtTime(RINGBACK_VOLUME, attackEnd);
    ringbackGain.gain.setValueAtTime(RINGBACK_VOLUME, holdEnd);
    ringbackGain.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);

    cursor = releaseEnd + seg.off;
    ringbackGain.gain.setValueAtTime(0.0001, cursor);
  }

  ringbackGain.gain.setValueAtTime(0.0001, startAt + RINGBACK_CYCLE_SEC);
}

function createToneGraph(ctx) {
  if (ringbackGain || ringbackOscA || ringbackOscB) return;

  ringbackGain = ctx.createGain();
  ringbackGain.gain.value = 0.0001;
  ringbackGain.connect(ctx.destination);

  ringbackOscA = ctx.createOscillator();
  ringbackOscA.type = "sine";
  ringbackOscA.frequency.setValueAtTime(RINGBACK_FREQ_A, ctx.currentTime);
  ringbackOscA.connect(ringbackGain);

  ringbackOscB = ctx.createOscillator();
  ringbackOscB.type = "sine";
  ringbackOscB.frequency.setValueAtTime(RINGBACK_FREQ_B, ctx.currentTime);
  ringbackOscB.connect(ringbackGain);

  ringbackOscA.start();
  ringbackOscB.start();
}

export function startRingbackTone() {
  if (ringbackRunning) return;

  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  createToneGraph(ctx);
  ringbackRunning = true;

  const startAt = ctx.currentTime;
  applyCadenceCycle(ctx, startAt);
  ringbackCadenceTimer = window.setInterval(() => {
    if (!ringbackCtx || !ringbackGain) return;
    applyCadenceCycle(ringbackCtx, ringbackCtx.currentTime);
  }, RINGBACK_CYCLE_MS);

  logLine(`[${nowISO()}] [ringback] start ringback tone (UK cadence 0.4/0.2/0.4/2.0)`);
}

export function stopRingbackTone() {
  if (!ringbackRunning && !ringbackCadenceTimer && !ringbackOscA && !ringbackOscB) {
    return;
  }

  if (ringbackCadenceTimer) {
    clearInterval(ringbackCadenceTimer);
    ringbackCadenceTimer = null;
  }

  if (ringbackCtx && ringbackGain) {
    const now = ringbackCtx.currentTime;
    ringbackGain.gain.cancelScheduledValues(now);
    ringbackGain.gain.setValueAtTime(Math.max(ringbackGain.gain.value, 0.0001), now);
    ringbackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
  }

  // Stop and release graph nodes so repeated calls do not leak oscillators.
  if (ringbackOscA) {
    try {
      ringbackOscA.stop();
    } catch {}
    ringbackOscA.disconnect();
    ringbackOscA = null;
  }

  if (ringbackOscB) {
    try {
      ringbackOscB.stop();
    } catch {}
    ringbackOscB.disconnect();
    ringbackOscB = null;
  }

  if (ringbackGain) {
    ringbackGain.disconnect();
    ringbackGain = null;
  }

  ringbackRunning = false;
  logLine(`[${nowISO()}] [ringback] stop ringback tone`);
}

// Backward-compatible aliases used by older modules.
export function startOutboundRingbackIfNeeded() {
  startRingbackTone();
}

export function stopOutboundRingback() {
  stopRingbackTone();
}

// Debug helper: call window.testRingback() in console.
window.testRingback = function () {
  console.warn("[ringback] manual test for 12 seconds");
  startRingbackTone();
  setTimeout(() => {
    stopRingbackTone();
    console.warn("[ringback] manual test complete");
  }, 12000);
};
