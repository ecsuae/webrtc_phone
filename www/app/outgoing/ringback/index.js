import { nowISO } from "../../config.js";
import { logLine } from "../../log.js";
import { requirePlatformAdapter } from "../../runtime/shared/platformAdapter.js";
import { emitRingbackEvent, emitRingbackOutputSnapshot, startRingbackDiag, stopRingbackDiag } from "./diag.js";

let ringbackRunning = false;
let ringbackLastStartTrigger = null;
let ringbackLastStopTrigger = null;

export function primeOutboundRingbackContext() {
  const a = requirePlatformAdapter();
  const fn = a?.ringback?.prime;
  if (typeof fn === "function") fn();
}

export function startRingbackTone(meta = {}) {
  if (ringbackRunning) return;

  const a = requirePlatformAdapter();
  const fn = a?.ringback?.start;
  if (typeof fn !== "function") return;

  ringbackLastStartTrigger = meta && typeof meta.trigger === "string" ? meta.trigger : null;
  ringbackLastStopTrigger = null;

  ringbackRunning = true;
  logLine(`[${nowISO()}] [ringback] start ringback tone (UK cadence 0.4/0.2/0.4/2.0)`);

  emitRingbackEvent({
    type: "ringback-start",
    dir: "outbound",
    ringbackCtx: null,
    ringbackRunning,
    trigger: ringbackLastStartTrigger || undefined,
    reason: meta && typeof meta.reason === "string" ? meta.reason : undefined,
    msg: "Ringback started",
  });

  emitRingbackOutputSnapshot({
    dir: "outbound",
    getCtx: () => null,
    getRunning: () => ringbackRunning,
    trigger: ringbackLastStartTrigger || undefined,
    reason: meta && typeof meta.reason === "string" ? meta.reason : undefined,
  });

  startRingbackDiag({
    dir: "outbound",
    getCtx: () => null,
    getRunning: () => ringbackRunning,
    getTrigger: () => ringbackLastStartTrigger,
  });

  const mode = (() => {
    try {
      const v = localStorage.getItem("audioRouteMode");
      return v === "speaker" || v === "earpiece" ? v : "earpiece";
    } catch {
      return "earpiece";
    }
  })();

  const ok = fn({ ...meta, mode });
  if (!ok) {
    ringbackRunning = false;
    stopRingbackDiag();
  }
}

export function stopRingbackTone(meta = {}) {
  ringbackLastStopTrigger = meta && typeof meta.trigger === "string" ? meta.trigger : null;

  emitRingbackEvent({
    type: "ringback-stop",
    dir: "outbound",
    ringbackCtx: null,
    ringbackRunning,
    trigger: ringbackLastStopTrigger || undefined,
    reason: meta && typeof meta.reason === "string" ? meta.reason : undefined,
    msg: "Ringback stopped",
  });

  stopRingbackDiag();

  const a = requirePlatformAdapter();
  const fn = a?.ringback?.stop;
  if (typeof fn === "function") fn();

  ringbackRunning = false;
  logLine(`[${nowISO()}] [ringback] stop ringback tone`);
}
