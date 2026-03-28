import { nowISO } from "../config.js";
import { formatSipResponse, getSipRejectDetails, mapSipFailureToMessage, logLine } from "../log.js";
import { g711OnlyModifier } from "../sdp.js";
import { bindPeerConnection } from "../pcDebug.js";
import { ensureMicAccess, getLocalStream, stopLocalAudioStream } from "../media.js";
import { attachRemoteAudio, startEarlyMediaAttachLoop, clearEarlyMediaAttachLoop } from "./media.js?v=1773032001";
import {
  primeOutboundRingbackContext,
  startRingbackTone,
  stopRingbackTone,
} from "./ringback.js";
import { dualSessionManager } from "../features/dualSessionManager.js";
import { guardLteRelayReadiness, checkLteRelayAvailable, MEDIA_ERRORS } from "../features/lteCallGuard.js";
import { sendCallMediaEvent } from "../features/callMediaLog.js";
import { isMobileCompatModeEnabled } from "../features/mobileNetworkMode.js";
import { ICE_SERVERS } from "../config.js";

function configureRemoteAudio(ui) {
  const audioEl = ui?.remoteAudio?.();
  if (!audioEl) return;
  audioEl.autoplay = true;
  audioEl.playsInline = true;
  audioEl.muted = false;
  audioEl.volume = 0.7;
  const prePlayPromise = audioEl.play?.();
  if (prePlayPromise && typeof prePlayPromise.catch === "function") {
    prePlayPromise.catch(() => {
      try {
        audioEl.muted = true;
        const p2 = audioEl.play?.();
        if (p2 && typeof p2.finally === "function") {
          p2.finally(() => {
            audioEl.muted = false;
          });
        } else {
          audioEl.muted = false;
        }
      } catch {}
    });
  }
}

function onOutboundStateChange(SIP, inviter, st, ui) {
  return (s) => {
    logLine(`[${nowISO()}] [session:outbound] ${s}`);
    const _aor = st.account ? `${st.account.rawUsername}@${st.account.domain}` : undefined;
    const _callId = inviter.outgoingRequestMessage?.callId || undefined;
    bindPeerConnection(inviter, "outbound", { aor: _aor, callId: _callId });
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

  // LTE pre-flight check — runs BEFORE invite() so a bad INVITE is never sent.
  // If TURN is unreachable in relay-only mode, abort here with MEDIA-E001.
  // Wi-Fi path (isMobileCompatModeEnabled() == false) is completely unaffected.
  if (isMobileCompatModeEnabled()) {
    const aorForCheck = st.account ? `${st.account.rawUsername}@${st.account.domain}` : null;
    logLine(`[${nowISO()}] [call] LTE mode: running pre-flight TURN relay check...`);
    ui.setStatus("Checking media relay...");
    let preCheck;
    try {
      preCheck = await checkLteRelayAvailable(ICE_SERVERS);
    } catch {
      preCheck = { relay: 0, total: 0, timedOut: true };
    }
    logLine(`[${nowISO()}] [call] pre-flight result: relay=${preCheck.relay} total=${preCheck.total} timedOut=${preCheck.timedOut}`);
    sendCallMediaEvent({
      type: preCheck.relay > 0 ? 'preflight-ok' : 'preflight-fail',
      code: preCheck.relay === 0 ? (preCheck.timedOut ? 'MEDIA-E002' : 'MEDIA-E001') : undefined,
      aor: aorForCheck, lteMode: true,
      relay: preCheck.relay, total: preCheck.total, timedOut: preCheck.timedOut,
      msg: preCheck.relay > 0 ? 'TURN relay reachable' : (preCheck.timedOut ? 'ICE gathering timed out' : 'Zero relay candidates — TURN unreachable'),
    });
    if (preCheck.relay === 0) {
      const errCode = preCheck.timedOut ? 'MEDIA-E002' : 'MEDIA-E001';
      const errDef = MEDIA_ERRORS[errCode];
      logLine(`[${nowISO()}] [call] ${errCode} — aborting call before INVITE: ${errDef.longDescription}`);
      ui.setStatus(errDef.userMessage);
      stopLocalAudioStream();
      st.session = null;
      ui.setButtons();
      return;
    }
    logLine(`[${nowISO()}] [call] pre-flight OK — ${preCheck.relay} relay candidate(s) — proceeding`);
  }

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

  const aor = st.account ? `${st.account.rawUsername}@${st.account.domain}` : null;

  st.session = inviter;
  bindPeerConnection(inviter, "outbound", { aor });
  inviter.stateChange.addListener(onOutboundStateChange(SIP, inviter, st, ui));
  ui.setButtons();

  try {
    await inviter.invite({ requestDelegate });
    ui.setStatus("Calling...");

    // LTE relay guard — monitors ICE gathering in relay-only mode.
    // If zero relay candidates are gathered, cancels and surfaces MEDIA-E001.
    // Non-blocking: does not delay the invite.
    const callId = inviter.outgoingRequestMessage?.callId || null;
    guardLteRelayReadiness(inviter, {
      aor,
      callId,
      dir: 'outbound',
      onFail: (code, userMessage) => {
        logLine(`[${nowISO()}] [call] ${code} — aborting call: ${userMessage}`);
        ui.setStatus(userMessage);
        try {
          if (inviter.state === SIP.SessionState.Established) inviter.bye();
          else inviter.cancel();
        } catch {}
        stopLocalAudioStream();
        st.session = null;
        ui.setButtons();
        stopRingbackTone();
      },
    });

    sendCallMediaEvent({ type: 'call-start', aor, callId, dir: 'outbound', lteMode: null });
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
