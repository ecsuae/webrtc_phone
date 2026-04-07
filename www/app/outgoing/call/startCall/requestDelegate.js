import { nowISO } from "../../../config.js";
import { formatSipResponse, getSipRejectDetails, mapSipFailureToMessage, logLine } from "../../../log.js";
import { attachRemoteAudio, startEarlyMediaAttachLoop } from "../../media.js?v=1773032001";
import { startRingbackTone, stopRingbackTone } from "../../ringback.js";
import { requirePlatformAdapter } from "../../../runtime/shared/platformAdapter.js";

export function createOutboundRequestDelegate({ st, ui, inviter, target }) {
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
            const a = requirePlatformAdapter();
            const fn = a?.callPolicy?.shouldStartLocalRingbackOn180;
            const allow = (typeof fn === 'function') ? !!fn({ hasSdp }) : (!hasSdp);
            if (allow) startRingbackTone({ trigger: 'sip-180', reason: 'sip-180-ringing' });
          } catch {
            if (!hasSdp) startRingbackTone({ trigger: 'sip-180', reason: 'sip-180-ringing' });
          }
        }

        if (code === 183) {
          if (hasSdp) {
            stopRingbackTone({ trigger: 'sip-183', reason: 'early-media-sdp' });
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
      stopRingbackTone({ trigger: 'sip-200', reason: 'call-answered' });
      const info = formatSipResponse(resp);
      const details = getSipRejectDetails(resp);
      window.callHistory?.addCall?.(target, 'outgoing', 0, {
        sipCode: details?.code || 200,
        sipReason: details?.reason || 'OK',
      });
      ui.setStatus(info ? `Call established (${info})` : 'Call established');
    },
    onRedirect: async (resp) => {
      stopRingbackTone({ trigger: 'sip-3xx', reason: 'redirect' });
      const info = formatSipResponse(resp);
      ui.setStatus(info ? `Call redirected (${info})` : 'Call redirected');
    },
    onReject: async (resp) => {
      stopRingbackTone({ trigger: 'sip-reject', reason: 'reject' });
      const info = formatSipResponse(resp);
      const details = getSipRejectDetails(resp);
      const human = mapSipFailureToMessage(details);
      const q850 = details.q850Cause ? `; Q.850 cause=${details.q850Cause}${details.q850Text ? ` (${details.q850Text})` : ''}` : '';
      logLine(`[${nowISO()}] [call] rejected ${info || 'unknown'}${q850}`);
      window.callHistory?.addCall?.(target, 'rejected', 0, {
        sipCode: details?.code || '',
        sipReason: details?.reason || '',
        q850Cause: details?.q850Cause || '',
        q850Text: details?.q850Text || '',
      });
      ui.setStatus(info ? `${human} (${info})` : human);
    },
  };
}
