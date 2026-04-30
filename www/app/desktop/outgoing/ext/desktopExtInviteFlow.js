import { sendCallMediaEvent } from "../../../features/callMediaLog.js";

import {
  createDesktopInviter,
  getDesktopOutboundDiagContext,
} from "../desktopStartCallSupport.js";
import { createOutboundRequestDelegateDesktop } from "../desktopRingbackDelegate.js";
import { initDesktopTerminationDiagnostics } from "../desktopTerminationDiagnostics.js";
import { onOutboundStateChangeDesktop } from "../desktopOutboundStateChange.js";

export async function runDesktopExtInviteFlow(SIP, st, ui, {
  target,
  targetUri,
  corrId,
  t_callStart,
  selectedProfile,
  micId,
  micTrackId,
  mic,
} = {}) {
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

  try {
    const audioEl = ui?.remoteAudio?.();
    if (audioEl) audioEl.__callMediaDiagContext = { ...getDesktopOutboundDiagContext(st, target, inviter), t_callStart };
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
    const t_inviteCallStart = new Date().toISOString();
    sendCallMediaEvent({
      type: "desktop-invite-call-start",
      ...getDesktopOutboundDiagContext(st, target, inviter),
      t_callStart,
      t_inviteCallStart,
      msg: "Calling SIP.js inviter.invite()",
    });

    await inviter.invite({ requestDelegate });
    const t_inviteSent = new Date().toISOString();
    ui.setStatus("Calling...");

    sendCallMediaEvent({
      type: "invite-sent",
      ...getDesktopOutboundDiagContext(st, target, inviter),
      t_callStart,
      t_inviteCallStart,
      t_inviteSent,
      msg: "INVITE sent",
    });

    sendCallMediaEvent({
      type: "outbound-invite-sent",
      ...getDesktopOutboundDiagContext(st, target, inviter),
      t_callStart,
      t_inviteCallStart,
      t_inviteSent,
      msg: "Outbound INVITE sent",
    });
  } catch (e) {
    throw e;
  }

  return { inviter };
}
