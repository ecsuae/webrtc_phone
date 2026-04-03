import { nowISO } from "../config.js";
import { logLine } from "../log.js";
import { sendCallMediaEvent } from "../features/callMediaLog.js";
import { readAppAudioRouteDiagSnapshot } from "../ui/callControlAudioRoute.js";

let ringbackCtx = null;
let ringbackGain = null;
let ringbackOscA = null;
let ringbackOscB = null;
let ringbackCadenceTimer = null;
let ringbackRunning = false;
let ringbackDiagTimer = null;
let ringbackDeviceChangeHandler = null;
let ringbackLastStartTrigger = null;
let ringbackLastStopTrigger = null;

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

function readDesiredModeRaw() {
  try {
    const v = localStorage.getItem('audioRouteMode');
    return (v === 'speaker' || v === 'earpiece') ? v : undefined;
  } catch {
    return undefined;
  }
}

function readDesiredMode() {
  return readDesiredModeRaw() || 'unknown';
}

function readRouteAvailability() {
  const enumerateDevicesAvailable = !!navigator.mediaDevices?.enumerateDevices;
  // Ringback is WebAudio; there is no sink selection for this path.
  const setSinkIdAvailable = false;
  const routeInfoUnavailable = !enumerateDevicesAvailable;
  return {
    enumerateDevicesAvailable,
    setSinkIdAvailable,
    routeInfoUnavailable,
    routeInfoSource: routeInfoUnavailable ? 'web-runtime-limited' : 'web-runtime',
  };
}

async function readAudioOutputs() {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return undefined;
    const devices = await navigator.mediaDevices.enumerateDevices();
    return (devices || [])
      .filter((d) => d && d.kind === 'audiooutput')
      .map((d) => ({ deviceId: d.deviceId, label: d.label }));
  } catch {
    return undefined;
  }
}

function emitRingbackEvent(type, extra) {
  try {
    const avail = readRouteAvailability();
    const desiredModeRaw = readDesiredModeRaw();
    const desiredMode = desiredModeRaw || 'unknown';

    const appRoute = (() => {
      try {
        const d = readAppAudioRouteDiagSnapshot?.();
        return d && typeof d === 'object' ? d : null;
      } catch {
        return null;
      }
    })();

    const audioRouteMismatch = (() => {
      try {
        const appMode = appRoute?.appAudioRouteMode;
        const wants = (appMode === 'speaker' || appMode === 'earpiece');
        const limited = (extra?.routeDecision === 'web-cannot-determine-android-route') || (extra?.effectiveOutput === 'default-only');
        return !!(wants && limited);
      } catch {
        return false;
      }
    })();

    sendCallMediaEvent({
      type,
      dir: 'outbound',
      audioElPaused: undefined,
      audioElMuted: undefined,
      audioElVolume: undefined,
      audioElCurrentTime: undefined,
      audioElReadyState: undefined,
      desiredMode,
      routedTo: desiredModeRaw || 'unknown',
      sinkSupported: false,
      sinkId: 'unsupported',
      enumerateDevicesAvailable: avail.enumerateDevicesAvailable,
      setSinkIdAvailable: avail.setSinkIdAvailable,
      routeInfoUnavailable: avail.routeInfoUnavailable,
      routeInfoSource: avail.routeInfoSource,
      androidRouteControlAvailable: (/Android/i.test(navigator.userAgent || '') ? false : undefined),
      effectiveOutput: (() => {
        try {
          const list = Array.isArray(extra?.audioOutputs) ? extra.audioOutputs : [];
          const defaultOnly = list.length === 1
            && String(list[0]?.deviceId || '') === 'default'
            && String(list[0]?.label || '').toLowerCase().includes('default');
          return (/Android/i.test(navigator.userAgent || '') && defaultOnly && !avail.setSinkIdAvailable) ? 'default-only' : undefined;
        } catch {
          return undefined;
        }
      })(),
      routeDecision: (/Android/i.test(navigator.userAgent || '') && !avail.setSinkIdAvailable) ? 'web-cannot-determine-android-route' : undefined,
      routeDecisionReason: (() => {
        try {
          const isAndroid = /Android/i.test(navigator.userAgent || '');
          if (!isAndroid || avail.setSinkIdAvailable) return undefined;
          const list = Array.isArray(extra?.audioOutputs) ? extra.audioOutputs : [];
          const defaultOnly = list.length === 1
            && String(list[0]?.deviceId || '') === 'default'
            && String(list[0]?.label || '').toLowerCase().includes('default');
          if (defaultOnly) return 'enumerateDevices only exposes Default and setSinkId unsupported';
          return 'setSinkId unsupported on this runtime';
        } catch {
          return undefined;
        }
      })(),
      ringbackRunning,
      ringbackCtxState: ringbackCtx?.state,
      ringbackCtxCurrentTime: typeof ringbackCtx?.currentTime === 'number' ? ringbackCtx.currentTime : undefined,

      appAudioRouteMode: appRoute?.appAudioRouteMode || 'unknown',
      appAudioRouteSource: appRoute?.appAudioRouteSource || 'none',
      appAudioRouteDetail: appRoute?.appAudioRouteDetail || 'none',
      speakerButtonActive: typeof appRoute?.speakerButtonActive === 'boolean' ? appRoute.speakerButtonActive : false,
      earpieceButtonActive: typeof appRoute?.earpieceButtonActive === 'boolean' ? appRoute.earpieceButtonActive : false,
      audioRouteStateAvailable: typeof appRoute?.audioRouteStateAvailable === 'boolean' ? appRoute.audioRouteStateAvailable : false,
      audioRouteSnapshotTs: appRoute?.audioRouteSnapshotTs || undefined,
      audioRouteMismatch,

      ...extra,
    });
  } catch {
    // ignore
  }
}

function startRingbackDiag() {
  try {
    if (ringbackDiagTimer) return;
    ringbackDiagTimer = window.setInterval(() => {
      try {
        if (!ringbackRunning) return;
        readAudioOutputs().then((audioOutputs) => {
          emitRingbackEvent('ringback-diag', {
            sinkSupported: false,
            sinkId: undefined,
            audioOutputs,
            trigger: ringbackLastStartTrigger || undefined,
            reason: undefined,
            msg: 'Ringback diag snapshot',
          });
        });
      } catch {
        // ignore
      }
    }, 2500);
  } catch {
    // ignore
  }

  try {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.addEventListener !== 'function') return;
    if (ringbackDeviceChangeHandler) return;
    ringbackDeviceChangeHandler = () => {
      try {
        if (!ringbackRunning) return;
        readAudioOutputs().then((audioOutputs) => {
          emitRingbackEvent('ringback-output-route', {
            sinkSupported: false,
            sinkId: undefined,
            audioOutputs,
            trigger: 'devicechange',
            reason: undefined,
            msg: 'Ringback output route devicechange observed',
          });
        });
      } catch {
        // ignore
      }
    };
    navigator.mediaDevices.addEventListener('devicechange', ringbackDeviceChangeHandler);
  } catch {
    // ignore
  }
}

function stopRingbackDiag() {
  try {
    if (ringbackDiagTimer) {
      clearInterval(ringbackDiagTimer);
      ringbackDiagTimer = null;
    }
  } catch {}
  try {
    if (ringbackDeviceChangeHandler && navigator.mediaDevices && typeof navigator.mediaDevices.removeEventListener === 'function') {
      navigator.mediaDevices.removeEventListener('devicechange', ringbackDeviceChangeHandler);
    }
    ringbackDeviceChangeHandler = null;
  } catch {}
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

export function startRingbackTone(meta = {}) {
  if (ringbackRunning) return;

  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  createToneGraph(ctx);
  ringbackRunning = true;

  ringbackLastStartTrigger = (meta && typeof meta.trigger === 'string') ? meta.trigger : null;
  ringbackLastStopTrigger = null;

  const startAt = ctx.currentTime;
  applyCadenceCycle(ctx, startAt);
  ringbackCadenceTimer = window.setInterval(() => {
    if (!ringbackCtx || !ringbackGain) return;
    applyCadenceCycle(ringbackCtx, ringbackCtx.currentTime);
  }, RINGBACK_CYCLE_MS);

  logLine(`[${nowISO()}] [ringback] start ringback tone (UK cadence 0.4/0.2/0.4/2.0)`);

  emitRingbackEvent('ringback-start', {
    sinkSupported: false,
    sinkId: undefined,
    trigger: ringbackLastStartTrigger || undefined,
    reason: (meta && typeof meta.reason === 'string') ? meta.reason : undefined,
    msg: 'Ringback started',
  });

  try {
    readAudioOutputs().then((audioOutputs) => {
      emitRingbackEvent('ringback-output-route', {
        sinkSupported: false,
        sinkId: undefined,
        audioOutputs,
        trigger: ringbackLastStartTrigger || undefined,
        reason: (meta && typeof meta.reason === 'string') ? meta.reason : undefined,
        msg: 'Ringback output route snapshot',
      });
    });
  } catch {}

  startRingbackDiag();
}

export function stopRingbackTone(meta = {}) {
  if (!ringbackRunning && !ringbackCadenceTimer && !ringbackOscA && !ringbackOscB) {
    return;
  }

  ringbackLastStopTrigger = (meta && typeof meta.trigger === 'string') ? meta.trigger : null;
  emitRingbackEvent('ringback-stop', {
    sinkSupported: false,
    sinkId: undefined,
    trigger: ringbackLastStopTrigger || undefined,
    reason: (meta && typeof meta.reason === 'string') ? meta.reason : undefined,
    msg: 'Ringback stopped',
  });

  stopRingbackDiag();

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
