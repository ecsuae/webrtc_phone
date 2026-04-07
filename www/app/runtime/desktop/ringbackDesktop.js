let ringbackCtx = null;
let ringbackGain = null;
let ringbackOscA = null;
let ringbackOscB = null;
let ringbackCadenceTimer = null;

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
  if (!window.AudioContext && !window.webkitAudioContext) return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!ringbackCtx) ringbackCtx = new Ctx();
  return ringbackCtx;
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

export function primeDesktopRingbackContext() {
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

export function startDesktopRingback() {
  const ctx = ensureContext();
  if (!ctx) return false;

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  createToneGraph(ctx);

  const startAt = ctx.currentTime;
  applyCadenceCycle(ctx, startAt);

  if (!ringbackCadenceTimer) {
    ringbackCadenceTimer = window.setInterval(() => {
      if (!ringbackCtx || !ringbackGain) return;
      applyCadenceCycle(ringbackCtx, ringbackCtx.currentTime);
    }, RINGBACK_CYCLE_MS);
  }

  return true;
}

export function stopDesktopRingback() {
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
}
