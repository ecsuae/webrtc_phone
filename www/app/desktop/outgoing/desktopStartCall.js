import { nowISO, logLine } from "../desktopLogging.js";
import { guardDesktopLteRelayReadiness } from "../desktopLteCallGuard.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";
import { isMobileCompatModeEnabled } from "../../features/mobileNetworkMode.js";

import {
  acquireDesktopCallAudio,
  releaseDesktopCallAudio,
} from "../media/desktopCallAudioRuntime.js";

import {
  configureDesktopRemoteAudio,
  getDesktopOutboundDiagContext,
  createDesktopInviter,
} from "./desktopStartCallSupport.js";
import { onOutboundStateChangeDesktop } from "./desktopOutboundStateChange.js";
import { runDesktopLtePreflightOrThrow } from "./desktopStartCallPreflight.js";

import { desktopEl } from "../ui/desktopDomRefs.js";

import {
  createOutboundRequestDelegateDesktop,
  primeOutboundRingbackContext,
  stopRingbackTone,
} from "./desktopRingbackDelegate.js";
import { initDesktopTerminationDiagnostics } from "./desktopTerminationDiagnostics.js";

export async function startCall(SIP, st, ui) {
  const target = (() => {
    try {
      const v = desktopEl?.dial?.value;
      if (typeof v === "string") return v.trim();
    } catch {}
    try {
      const v = ui?.dial?.();
      if (typeof v === "string") return v.trim();
    } catch {}
    return "";
  })();
  if (!st.registered || !st.ua) return ui.setStatus("Not registered");
  if (!target) return ui.setStatus("Missing destination");
  if (st.session) return ui.setStatus("Call already active");

  const t_callStart = new Date().toISOString();
  const corrId = (() => {
    try {
      return `c-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
    } catch {
      return `c-${Date.now()}`;
    }
  })();

  try {
    st.__webrtcCorrId = corrId;
  } catch {}

  primeOutboundRingbackContext();

  const mic = await acquireDesktopCallAudio(ui, "outbound-start");
  if (!mic.ok) return;

  const micId = mic?.micId || "?";
  const micTrackId = mic?.trackSnapshot?.id || mic?.track?.id || null;

  try {
    const s = (() => {
      try {
        return (mic?.track && typeof mic.track.getSettings === "function") ? (mic.track.getSettings() || {}) : {};
      } catch {
        return {};
      }
    })();
    sendCallMediaEvent({
      type: "desktop-mic-acquired",
      ...getDesktopOutboundDiagContext(st, target, { __webrtcCorrId: corrId }),
      reason: "outbound-start",
      localMicTrackId: micTrackId || undefined,
      localMicStreamId: mic?.stream?.id || null,
      localMicTrackKind: mic?.track?.kind || mic?.trackSnapshot?.kind || null,
      localMicTrackReadyState: mic?.track?.readyState || mic?.trackSnapshot?.readyState || null,
      localMicTrackEnabled: (typeof mic?.track?.enabled === "boolean") ? mic.track.enabled : (mic?.trackSnapshot?.enabled ?? null),
      localMicTrackMuted: (typeof mic?.track?.muted === "boolean") ? mic.track.muted : (mic?.trackSnapshot?.muted ?? null),
      localMicDeviceId: (typeof s.deviceId === "string" && s.deviceId) ? s.deviceId : null,
      localMicLabel: mic?.track?.label || mic?.trackSnapshot?.label || null,
      micId,
      msg: "Desktop mic acquired",
    });
  } catch {}

  try {
    st.__desktopMicTrackId = micTrackId;
  } catch {}
  try {
    st.__desktopMicStreamId = mic?.stream?.id || null;
  } catch {}

  const resolvedAccount = ui.account ? ui.account() : null;
  const domain = st.account?.domain || resolvedAccount?.domain || ui.domain() || ui.domainFallback?.();
  if (!domain) {
    releaseDesktopCallAudio("outbound-missing-domain", { corrId, micId });
    return ui.setStatus("Missing domain");
  }

  const encodedTarget = encodeURIComponent(target);
  const targetUri = SIP.UserAgent.makeURI(`sip:${encodedTarget}@${domain}`);
  if (!targetUri) {
    releaseDesktopCallAudio("outbound-invalid-destination", { corrId, micId });
    return ui.setStatus("Invalid destination");
  }

  logLine(`[${nowISO()}] [call] dialing ${target} (encoded: ${encodedTarget})`);

  sendCallMediaEvent({
    type: "outbound-call-start",
    ...getDesktopOutboundDiagContext(st, target, { __webrtcCorrId: corrId }),
    t_callStart,
    msg: "Outbound call start (guaranteed chain)",
  });

  try {
    const ctx = getDesktopOutboundDiagContext(st, target, null);
    if (String(ctx.username || "") === "900900" && ctx.lteMode === true) {
      sendCallMediaEvent({
        type: "lte-caller-probe-callstart",
        ...ctx,
        sourceBuildId: (() => {
          try {
            return window.CALL_MEDIA_SOURCE_BUILD_ID;
          } catch {
            return undefined;
          }
        })(),
        t_callStart,
        msg: "LTE caller probe on outbound call start",
      });
    }
  } catch {}

  sendCallMediaEvent({
    type: "outbound-invite-start",
    ...getDesktopOutboundDiagContext(st, target, { __webrtcCorrId: corrId }),
    t_callStart,
    msg: "Outbound call start (before INVITE)",
  });

  if (isMobileCompatModeEnabled()) {
    try {
      await runDesktopLtePreflightOrThrow({
        st,
        ui,
        target,
        corrId,
        t_callStart,
        diagContext: getDesktopOutboundDiagContext(st, target, null),
      });
    } catch {
      releaseDesktopCallAudio("outbound-preflight-failed", { corrId, micId });
      st.session = null;
      ui.setButtons();
      return;
    }
  }

  configureDesktopRemoteAudio(ui);

  const selectedProfile = st.selectedProfile || (isMobileCompatModeEnabled() ? "lte" : "wifi");

  const inviter = createDesktopInviter({ SIP, st, targetUri, corrId, selectedProfile, peer: target });

  try {
    inviter.__webrtcCorrId = corrId;
  } catch {}
  try {
    inviter.__desktopMicId = micId;
  } catch {}
  try {
    inviter.__desktopMicTrackId = micTrackId;
  } catch {}
  try {
    inviter.__desktopMicStreamId = mic?.stream?.id || null;
  } catch {}
  try {
    inviter.__desktopMicTrack = mic?.track || null;
  } catch {}
  try {
    inviter.__desktopLocalStream = mic?.stream || null;
  } catch {}

  try {
    inviter.__callMediaDiag = getDesktopOutboundDiagContext(st, target, inviter);
  } catch {}

  const requestDelegate = createOutboundRequestDelegateDesktop({ SIP, st, ui, inviter, target });
  const termDiag = initDesktopTerminationDiagnostics(SIP, inviter, ui, { dir: "outbound", target });
  try {
    requestDelegate.onBye = async (req) => {
      try {
        termDiag?.onRemoteBye?.(req);
      } catch {}
    };
  } catch {}

  const aor = st.account ? `${st.account.rawUsername}@${st.account.domain}` : null;

  try {
    const audioEl = ui?.remoteAudio?.();
    if (audioEl) audioEl.__callMediaDiagContext = getDesktopOutboundDiagContext(st, target, inviter);
  } catch {}

  st.session = inviter;
  inviter.stateChange.addListener(onOutboundStateChangeDesktop(SIP, inviter, st, ui, { t_callStart, peer: target }));
  ui.setButtons();

  sendCallMediaEvent({
    type: "media-offer-outgoing",
    ...getDesktopOutboundDiagContext(st, target, inviter),
    t_callStart,
    msg: "About to send INVITE (offer)",
  });

  sendCallMediaEvent({
    type: "outbound-invite-sent",
    ...getDesktopOutboundDiagContext(st, target, inviter),
    t_callStart,
    msg: "Outbound INVITE will be sent",
  });

  try {
    await inviter.invite({ requestDelegate });
    ui.setStatus("Calling...");

    try {
      const pc = inviter?.sessionDescriptionHandler?.peerConnection || null;
      const stream = (() => {
        try {
          return pc ? (getLocalStream() || null) : (getLocalStream() || null);
        } catch {
          return null;
        }
      })();
      const localMicTrackId = inviter?.__desktopMicTrackId || st?.__desktopMicTrackId || undefined;
      const localMicStreamId = inviter?.__desktopMicStreamId || st?.__desktopMicStreamId || stream?.id || (() => {
        try {
          return getLocalStream()?.id || undefined;
        } catch {
          return undefined;
        }
      })();
      const pcSignalingState = pc?.signalingState || undefined;

      const senderTrack = (() => {
        try {
          const senders = pc?.getSenders?.() || [];
          const a = senders.find((sd) => sd?.track?.kind === "audio") || null;
          return a?.track || null;
        } catch {
          return null;
        }
      })();

      const senderStreamIds = (() => {
        try {
          const senders = pc?.getSenders?.() || [];
          const a = senders.find((sd) => sd?.track?.kind === "audio") || null;
          const ss = a?.getStreams?.() || [];
          return ss.map((s) => s?.id || null).filter(Boolean);
        } catch {
          return undefined;
        }
      })();

      const senderTrackId = senderTrack?.id || undefined;
      const senderTrackReadyState = senderTrack?.readyState || undefined;
      const senderTrackEnabled = (typeof senderTrack?.enabled === "boolean") ? senderTrack.enabled : undefined;
      const senderTrackMuted = (typeof senderTrack?.muted === "boolean") ? senderTrack.muted : undefined;
      const sameAsLocalMicTrack = !!(senderTrackId && localMicTrackId && senderTrackId === localMicTrackId);

      sendCallMediaEvent({
        type: "desktop-sender-track-observed",
        ...getDesktopOutboundDiagContext(st, target, inviter),
        checkpoint: "post-local-description",
        senderTrackId,
        senderTrackReadyState,
        senderTrackEnabled,
        senderTrackMuted,
        localMicTrackId,
        localMicStreamId,
        senderStreamIds,
        sameAsLocalMicTrack,
        pcSignalingState,
        msg: "Desktop sender audio track observed",
      });

      try {
        const trs = pc?.getTransceivers?.() || [];
        const t = trs.find((tr) => tr?.sender?.track?.kind === "audio") || null;
        const codecs = t?.sender?.getParameters?.()?.codecs || [];
        const c0 = Array.isArray(codecs) ? codecs[0] : null;
        if (c0 && c0.mimeType) {
          sendCallMediaEvent({
            type: "desktop-outbound-codec-observed",
            ...getDesktopOutboundDiagContext(st, target, inviter),
            checkpoint: "post-local-description",
            outboundCodecMimeType: c0.mimeType || undefined,
            outboundCodecPayloadType: (typeof c0.payloadType === "number") ? c0.payloadType : undefined,
            outboundCodecClockRate: (typeof c0.clockRate === "number") ? c0.clockRate : undefined,
            outboundCodecChannels: (typeof c0.channels === "number") ? c0.channels : undefined,
            msg: "Desktop outbound codec observed",
          });
        }
      } catch {}
    } catch {}

    sendCallMediaEvent({
      type: "invite-sent",
      ...getDesktopOutboundDiagContext(st, target, inviter),
      t_callStart,
      t_inviteSent: new Date().toISOString(),
      msg: "INVITE sent",
    });

    sendCallMediaEvent({
      type: "outbound-invite-sent",
      ...getDesktopOutboundDiagContext(st, target, inviter),
      t_callStart,
      t_inviteSent: new Date().toISOString(),
      msg: "Outbound INVITE sent",
    });

    const callId = inviter.outgoingRequestMessage?.callId || null;
    guardDesktopLteRelayReadiness(inviter, {
      aor,
      callId,
      dir: "outbound",
      onFail: (code, userMessage) => {
        logLine(`[${nowISO()}] [call] ${code} — aborting call: ${userMessage}`);
        ui.setStatus(userMessage);
        try {
          if (inviter.state === SIP.SessionState.Established) inviter.bye();
          else inviter.cancel();
        } catch {}
        releaseDesktopCallAudio("outbound-lte-guard-fail", { session: inviter, corrId, callId, micId });
        st.session = null;
        ui.setButtons();
        stopRingbackTone({ trigger: "hangup", reason: "hangup" });
      },
    });

    sendCallMediaEvent({
      type: "call-start",
      ...getDesktopOutboundDiagContext(st, target, inviter),
      t_callStart,
      msg: "Outbound call active (invite initiated)",
    });
  } catch (e) {
    stopRingbackTone();
    logLine(`[${nowISO()}] [error] invite failed`, e?.message || e);
    ui.setStatus("Call failed (invite error)");
    releaseDesktopCallAudio("outbound-invite-failed", { session: st?.session || null, corrId, micId });
    st.session = null;
    ui.setButtons();
  }
}
