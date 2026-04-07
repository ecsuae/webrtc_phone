import { nowISO } from "../../config.js";
import { logLine } from "../../log.js";
import { ensureMicAccess, stopLocalAudioStream } from "../../media.js";
import { primeOutboundRingbackContext, stopRingbackTone } from "../ringback.js";
import { guardLteRelayReadiness } from "../../features/lteCallGuard.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";
import { isMobileCompatModeEnabled } from "../../features/mobileNetworkMode.js";
import { configureRemoteAudio } from "./remoteAudio.js";
import { getOutboundDiagContext } from "./diagContext.js";
import { onOutboundStateChange } from "./stateChange.js";
import { runLtePreflightOrThrow } from "./startCall/preflight.js";
import { createOutboundRequestDelegate } from "./startCall/requestDelegate.js";
import { createInviter } from "./startCall/inviter.js";

export async function startCall(SIP, st, ui) {
  const target = ui.dial();
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

  sendCallMediaEvent({
    type: 'outbound-call-start',
    ...getOutboundDiagContext(st, target, { __webrtcCorrId: corrId }),
    t_callStart,
    msg: 'Outbound call start (guaranteed chain)',
  });

  try {
    const ctx = getOutboundDiagContext(st, target, null);
    if (String(ctx.username || '') === '900900' && ctx.lteMode === true) {
      sendCallMediaEvent({
        type: 'lte-caller-probe-callstart',
        ...ctx,
        sourceBuildId: (() => { try { return window.CALL_MEDIA_SOURCE_BUILD_ID; } catch { return undefined; } })(),
        t_callStart,
        msg: 'LTE caller probe on outbound call start',
      });
    }
  } catch {}

  sendCallMediaEvent({
    type: 'outbound-invite-start',
    ...getOutboundDiagContext(st, target, { __webrtcCorrId: corrId }),
    t_callStart,
    msg: 'Outbound call start (before INVITE)',
  });

  if (isMobileCompatModeEnabled()) {
    try {
      await runLtePreflightOrThrow({ st, ui, target, corrId, t_callStart });
    } catch {
      stopLocalAudioStream();
      st.session = null;
      ui.setButtons();
      return;
    }
  }

  configureRemoteAudio(ui);

  const selectedProfile = st.selectedProfile || (isMobileCompatModeEnabled() ? 'lte' : 'wifi');

  const inviter = createInviter({ SIP, st, targetUri, corrId, selectedProfile });

  try {
    inviter.__callMediaDiag = getOutboundDiagContext(st, target, inviter);
  } catch {}

  const requestDelegate = createOutboundRequestDelegate({ st, ui, inviter, target });

  const aor = st.account ? `${st.account.rawUsername}@${st.account.domain}` : null;

  try {
    const audioEl = ui?.remoteAudio?.();
    if (audioEl) audioEl.__callMediaDiagContext = getOutboundDiagContext(st, target, inviter);
  } catch {}

  st.session = inviter;
  inviter.stateChange.addListener(onOutboundStateChange(SIP, inviter, st, ui, { t_callStart, peer: target }));
  ui.setButtons();

  sendCallMediaEvent({
    type: 'media-offer-outgoing',
    ...getOutboundDiagContext(st, target, inviter),
    t_callStart,
    msg: 'About to send INVITE (offer)',
  });

  sendCallMediaEvent({
    type: 'outbound-invite-sent',
    ...getOutboundDiagContext(st, target, inviter),
    t_callStart,
    msg: 'Outbound INVITE will be sent',
  });

  try {
    await inviter.invite({ requestDelegate });
    ui.setStatus("Calling...");

    sendCallMediaEvent({
      type: 'invite-sent',
      ...getOutboundDiagContext(st, target, inviter),
      t_callStart,
      t_inviteSent: new Date().toISOString(),
      msg: 'INVITE sent',
    });

    sendCallMediaEvent({
      type: 'outbound-invite-sent',
      ...getOutboundDiagContext(st, target, inviter),
      t_callStart,
      t_inviteSent: new Date().toISOString(),
      msg: 'Outbound INVITE sent',
    });

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
        stopRingbackTone({ trigger: 'hangup', reason: 'hangup' });
      },
    });

    sendCallMediaEvent({
      type: 'call-start',
      ...getOutboundDiagContext(st, target, inviter),
      t_callStart,
      msg: 'Outbound call active (invite initiated)',
    });
  } catch (e) {
    stopRingbackTone();
    logLine(`[${nowISO()}] [error] invite failed`, e?.message || e);
    ui.setStatus("Call failed (invite error)");
    stopLocalAudioStream();
    st.session = null;
    ui.setButtons();
  }
}
