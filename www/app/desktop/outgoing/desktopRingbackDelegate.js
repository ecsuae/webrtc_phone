import { nowISO, logLine, formatSipResponse } from "../desktopLogging.js";
import { attachRemoteAudio, startEarlyMediaAttachLoop } from "./desktopOutgoingMedia.js";
import { emitRingbackEvent, emitRingbackOutputSnapshot, startRingbackDiag, stopRingbackDiag } from "../../outgoing/ringback/diag.js";
import { getDesktopPlatformAdapter } from "../runtime/platformAdapterRegistry.js";
import {
  emitDesktopExtAccept,
  emitDesktopExtProgress,
  emitDesktopExtReject,
  getDesktopExtAcceptMeta,
  getDesktopExtProgressMeta,
  getDesktopExtRejectMeta,
} from "./ext/desktopExtSipResponses.js";

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
      const info = getDesktopExtProgressMeta(resp)?.info || "";
      if (info) logLine(`[${nowISO()}] [call] trying ${info}`);
    },
    onProgress: async (resp) => {
      const meta = getDesktopExtProgressMeta(resp);
      if (meta?.info) logLine(`[${nowISO()}] [call] progress ${meta.info}`);

      if (meta?.isProvisional) {
        logLine(`[${nowISO()}] [call] provisional ${meta.code} (hasSdp=${meta.hasSdp})`);

        try {
          emitDesktopExtProgress(inviter, st, target, {
            code: meta.code,
            hasSdp: meta.hasSdp,
            source: "desktopRingbackDelegate.onProgress",
          });
        } catch {}

        if (meta.code === 180) {
          ui.setStatus("Ringing...");
          try {
            const a = getDesktopPlatformAdapter();
            const fn = a?.callPolicy?.shouldStartLocalRingbackOn180;
            const allow = typeof fn === "function" ? !!fn({ hasSdp: meta.hasSdp }) : !meta.hasSdp;
            if (allow) startRingbackTone({ trigger: "sip-180", reason: "sip-180-ringing" });
          } catch {
            if (!meta.hasSdp) startRingbackTone({ trigger: "sip-180", reason: "sip-180-ringing" });
          }
        }

        if (meta.code === 183) {
          if (meta.hasSdp) {
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
      const meta = getDesktopExtAcceptMeta(resp);

      try {
        emitDesktopExtAccept(inviter, st, target, {
          details: meta?.details,
          hasSdp: meta?.hasSdp,
          source: "desktopRingbackDelegate.onAccept",
        });
      } catch {}

      window.callHistory?.addCall?.(target, "outgoing", 0, {
        sipCode: meta?.details?.code || 200,
        sipReason: meta?.details?.reason || "OK",
      });
      ui.setStatus(meta?.info ? `Call established (${meta.info})` : "Call established");
    },
    onRedirect: async (resp) => {
      stopRingbackTone({ trigger: "sip-3xx", reason: "redirect" });
      const info = formatSipResponse(resp);
      ui.setStatus(info ? `Call redirected (${info})` : "Call redirected");
    },
    onReject: async (resp) => {
      stopRingbackTone({ trigger: "sip-reject", reason: "reject" });
      const meta = getDesktopExtRejectMeta(resp);
      logLine(`[${nowISO()}] [call] rejected ${meta?.info || "unknown"}${meta?.q850 || ""}`);

      try {
        emitDesktopExtReject(inviter, st, target, {
          details: meta?.details,
          source: "desktopRingbackDelegate.onReject",
        });
      } catch {}

      window.callHistory?.addCall?.(target, "rejected", 0, {
        sipCode: meta?.details?.code || "",
        sipReason: meta?.details?.reason || "",
        q850Cause: meta?.details?.q850Cause || "",
        q850Text: meta?.details?.q850Text || "",
      });
      ui.setStatus(meta?.info ? `${meta?.human || "Call failed"} (${meta.info})` : (meta?.human || "Call failed"));
    },
  };
}
