import { nowISO, formatSipResponse, getSipRejectDetails, logLine, mapSipFailureToMessage } from "../desktopLogging.js";
import { attachRemoteAudio, startEarlyMediaAttachLoop } from "./desktopOutgoingMedia.js";
import { emitRingbackEvent, emitRingbackOutputSnapshot, startRingbackDiag, stopRingbackDiag } from "../../outgoing/ringback/diag.js";
import { getDesktopPlatformAdapter } from "../runtime/platformAdapterRegistry.js";

let ringbackRunning = false;
let ringbackLastStartTrigger = null;
let ringbackLastStopTrigger = null;

export function primeOutboundRingbackContext() {
  const a = getDesktopPlatformAdapter();
  const fn = a?.ringback?.prime;
  if (typeof fn === "function") fn();
}

export function startRingbackTone(meta = {}) {
  if (ringbackRunning) return;

  const a = getDesktopPlatformAdapter();
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

  const a = getDesktopPlatformAdapter();
  const fn = a?.ringback?.stop;
  if (typeof fn === "function") fn();

  ringbackRunning = false;
  logLine(`[${nowISO()}] [ringback] stop ringback tone`);
}

export function createOutboundRequestDelegateDesktop({ SIP, st, ui, inviter, target }) {
  return {
    onTrying: async (resp) => {
      const info = formatSipResponse(resp);
      if (info) logLine(`[${nowISO()}] [call] trying ${info}`);
    },
    onProgress: async (resp) => {
      const info = formatSipResponse(resp);
      if (info) logLine(`[${nowISO()}] [call] progress ${info}`);

      const code = resp?.message?.statusCode || resp?.statusCode || resp?.message?.status;
      const body = resp?.message?.body || "";
      const hasSdp = body.includes("v=") && body.includes("m=audio");

      if (code === 180 || code === 183) {
        logLine(`[${nowISO()}] [call] provisional ${code} (hasSdp=${hasSdp})`);

        if (code === 180) {
          ui.setStatus("Ringing...");
          try {
            const a = getDesktopPlatformAdapter();
            const fn = a?.callPolicy?.shouldStartLocalRingbackOn180;
            const allow = typeof fn === "function" ? !!fn({ hasSdp }) : !hasSdp;
            if (allow) startRingbackTone({ trigger: "sip-180", reason: "sip-180-ringing" });
          } catch {
            if (!hasSdp) startRingbackTone({ trigger: "sip-180", reason: "sip-180-ringing" });
          }
        }

        if (code === 183) {
          if (hasSdp) {
            stopRingbackTone({ trigger: "sip-183", reason: "early-media-sdp" });
            ui.setStatus("Early media...");
          } else {
            ui.setStatus("Progress...");
          }
        }

        attachRemoteAudio(inviter, ui);
        startEarlyMediaAttachLoop(inviter, ui);
      }
    },
    onAccept: async (resp) => {
      stopRingbackTone({ trigger: "sip-200", reason: "call-answered" });
      const info = formatSipResponse(resp);
      const details = getSipRejectDetails(resp);
      window.callHistory?.addCall?.(target, "outgoing", 0, {
        sipCode: details?.code || 200,
        sipReason: details?.reason || "OK",
      });
      ui.setStatus(info ? `Call established (${info})` : "Call established");
    },
    onRedirect: async (resp) => {
      stopRingbackTone({ trigger: "sip-3xx", reason: "redirect" });
      const info = formatSipResponse(resp);
      ui.setStatus(info ? `Call redirected (${info})` : "Call redirected");
    },
    onReject: async (resp) => {
      stopRingbackTone({ trigger: "sip-reject", reason: "reject" });
      const info = formatSipResponse(resp);
      const details = getSipRejectDetails(resp);
      const human = mapSipFailureToMessage(details);
      const q850 = details.q850Cause
        ? `; Q.850 cause=${details.q850Cause}${details.q850Text ? ` (${details.q850Text})` : ""}`
        : "";
      logLine(`[${nowISO()}] [call] rejected ${info || "unknown"}${q850}`);
      window.callHistory?.addCall?.(target, "rejected", 0, {
        sipCode: details?.code || "",
        sipReason: details?.reason || "",
        q850Cause: details?.q850Cause || "",
        q850Text: details?.q850Text || "",
      });
      ui.setStatus(info ? `${human} (${info})` : human);
    },
  };
}
