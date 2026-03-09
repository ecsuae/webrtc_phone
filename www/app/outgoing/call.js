import { nowISO } from "../config.js";
import { formatSipResponse, getSipRejectDetails, mapSipFailureToMessage, logLine } from "../log.js";
import { g711OnlyModifier } from "../sdp.js";
import { bindPeerConnection } from "../pcDebug.js";
import { ensureMicAccess, getLocalStream, stopLocalAudioStream } from "../media.js";
import { attachRemoteAudio, startEarlyMediaAttachLoop, clearEarlyMediaAttachLoop } from "./media.js";
import {
  primeOutboundRingbackContext,
  startRingbackTone,
  stopRingbackTone,
} from "./ringback.js";
import { dualSessionManager } from "../features/dualSessionManager.js";

function configureRemoteAudio(ui) {
  const audioEl = ui?.remoteAudio?.();
  if (!audioEl) return;
  audioEl.autoplay = true;
  audioEl.playsInline = true;
  audioEl.muted = false;
  audioEl.volume = 0.7;
  const prePlayPromise = audioEl.play?.();
  if (prePlayPromise && typeof prePlayPromise.catch === "function") {
    prePlayPromise.catch(() => {});
  }
}

function onOutboundStateChange(SIP, inviter, st, ui) {
  return (s) => {
    logLine(`[${nowISO()}] [session:outbound] ${s}`);
    bindPeerConnection(inviter, "outbound");
    attachRemoteAudio(inviter, ui);

    if (s === SIP.SessionState.Established) {
      stopRingbackTone();
      if (window.callTimer) window.callTimer.start();
      
      // Register as primary session with dual session manager
      if (!dualSessionManager.primary) {
        dualSessionManager.setPrimary(st);
        logLine(`[${nowISO()}] [session:outbound] Registered as primary session`);
      }
      return;
    }

    if (s === SIP.SessionState.Terminated) {
      stopRingbackTone();
      clearEarlyMediaAttachLoop(inviter);
      
      // Remove from dual session manager
      dualSessionManager.removeSession(st);
      
      st.session = null;
      stopLocalAudioStream();
      ui.setButtons();
      ui.setStatus("Idle");
      if (window.callTimer) window.callTimer.stop();
    }
  };
}

export async function startCall(SIP, st, ui) {
  const target = ui.dial();
  if (!st.registered || !st.ua) return ui.setStatus("Not registered");
  if (!target) return ui.setStatus("Missing destination");
  if (st.session) return ui.setStatus("Call already active");

  // Prime audio output while still in direct user gesture path.
  primeOutboundRingbackContext();

  const micOk = await ensureMicAccess(ui.setStatus);
  if (!micOk) return;

  const resolvedAccount = ui.account ? ui.account() : null;
  const domain = st.account?.domain || resolvedAccount?.domain || ui.domain() || ui.domainFallback?.();
  if (!domain) {
    stopLocalAudioStream();
    return ui.setStatus("Missing domain");
  }

  const encodedTarget = encodeURIComponent(target);
  const targetUri = SIP.UserAgent.makeURI(`sip:${encodedTarget}@${domain}`);
  if (!targetUri) {
    stopLocalAudioStream();
    return ui.setStatus("Invalid destination");
  }

  logLine(`[${nowISO()}] [call] dialing ${target} (encoded: ${encodedTarget})`);
  configureRemoteAudio(ui);

  const inviter = new SIP.Inviter(st.ua, targetUri, {
    earlyMedia: true,
    // Do not force 100rel with Require; this PBX rejects it with 420 Bad Extension.
    extraHeaders: ["P-Early-Media: supported"],
    sessionDescriptionHandlerModifiers: [g711OnlyModifier],
    sessionDescriptionHandlerOptions: {
      constraints: { audio: true, video: false },
      localMediaStream: getLocalStream() || undefined,
    },
  });

  const requestDelegate = {
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
          // 180 Ringing: Start local ringback as fallback since PBX won't send early media
          ui.setStatus("Ringing...");
          startRingbackTone();
        }

        if (code === 183) {
          if (hasSdp) {
            stopRingbackTone();
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
      stopRingbackTone();
      const info = formatSipResponse(resp);
      const details = getSipRejectDetails(resp);
      window.callHistory?.addCall?.(target, "outgoing", 0, {
        sipCode: details?.code || 200,
        sipReason: details?.reason || "OK",
      });
      ui.setStatus(info ? `Call established (${info})` : "Call established");
    },
    onRedirect: async (resp) => {
      stopRingbackTone();
      const info = formatSipResponse(resp);
      ui.setStatus(info ? `Call redirected (${info})` : "Call redirected");
    },
    onReject: async (resp) => {
      stopRingbackTone();
      const info = formatSipResponse(resp);
      const details = getSipRejectDetails(resp);
      const human = mapSipFailureToMessage(details);
      const q850 = details.q850Cause ? `; Q.850 cause=${details.q850Cause}${details.q850Text ? ` (${details.q850Text})` : ""}` : "";
      logLine(`[${nowISO()}] [call] rejected ${info || "unknown"}${q850}`);
      window.callHistory?.addCall?.(target, "rejected", 0, {
        sipCode: details?.code || "",
        sipReason: details?.reason || "",
        q850Cause: details?.q850Cause || "",
        q850Text: details?.q850Text || "",
      });
      ui.setStatus(info ? `${human} (${info})` : human);
      stopLocalAudioStream();
      st.session = null;
      ui.setButtons();
    },
  };

  st.session = inviter;
  bindPeerConnection(inviter, "outbound");
  inviter.stateChange.addListener(onOutboundStateChange(SIP, inviter, st, ui));
  ui.setButtons();

  try {
    await inviter.invite({ requestDelegate });
    ui.setStatus("Calling...");
  } catch (e) {
    stopRingbackTone();
    logLine(`[${nowISO()}] [error] invite failed`, e?.message || e);
    ui.setStatus("Call failed (invite error)");
    stopLocalAudioStream();
    st.session = null;
    ui.setButtons();
  }
}

export async function hangupCall(st, ui, silent = false) {
  if (!st.session) return;
  const s = st.session;
  if (!silent) logLine(`[${nowISO()}] [call] hangup`);

  stopRingbackTone();

  try {
    if (s.state === SIP.SessionState.Established) await s.bye();
    else await s.cancel();
  } catch {}

  stopLocalAudioStream();
  st.session = null;
  ui.setButtons();
  ui.setStatus("Idle");
}
