import { nowISO } from "../config.js";
import { logLine } from "../log.js";
import { g711OnlyModifier } from "../sdp.js";
import { bindPeerConnection } from "../pcDebug.js";
import { ensureMicAccess, getLocalStream, stopLocalAudioStream } from "../media.js";
import { focusDialTabForIncoming, startIncomingAlert, stopIncomingAlert } from "./alert.js";
import { attachIncomingRemoteAudio, startIncomingEarlyMediaLoop, stopIncomingEarlyMediaLoop } from "./media.js";

function cleanupIncomingState(st, ui) {
  st.session = null;
  st.incomingInvitation = null;
  stopLocalAudioStream();
  ui.setButtons();
  ui.setStatus("Idle");
  if (window.callTimer) window.callTimer.stop();
}

export function handleIncomingCallIsolated(SIP, st, ui, invitation) {
  const callerUser = invitation.remoteIdentity?.uri?.user || "Unknown";
  const callerDisplay = invitation.remoteIdentity?.displayName || callerUser;

  logLine(`[${nowISO()}] [incoming] ==================== INCOMING CALL ====================`);
  logLine(`[${nowISO()}] [incoming] Caller: ${callerDisplay} (${callerUser})`);

  if (st.session) {
    try {
      invitation.reject({ statusCode: 486 });
    } catch (err) {
      logLine(`[${nowISO()}] [incoming] ERROR rejecting busy call: ${err?.message || err}`);
    }
    return;
  }

  st.incomingInvitation = invitation;
  focusDialTabForIncoming();
  ui.setStatus(`Incoming: ${callerDisplay}`);
  ui.setButtons();
  startIncomingAlert(callerDisplay);

  const stateListener = (newState) => {
    logLine(`[${nowISO()}] [incoming:state] ${newState}`);
    if (newState === SIP.SessionState.Establishing) {
      ui.setStatus(`Answering ${callerDisplay}...`);
      return;
    }

    if (newState === SIP.SessionState.Established) {
      stopIncomingAlert();
      st.session = invitation;
      ui.setStatus(`On call with ${callerDisplay}`);
      ui.setButtons();
      if (window.callTimer) window.callTimer.start();
      attachIncomingRemoteAudio(invitation, ui);
      bindPeerConnection(invitation, "inbound");
      return;
    }

    if (newState === SIP.SessionState.Terminated) {
      stopIncomingAlert();
      stopIncomingEarlyMediaLoop(invitation);
      cleanupIncomingState(st, ui);
    }
  };

  invitation.stateChange?.addListener?.(stateListener);
  invitation.delegate = {
    onCancel: () => {
      stopIncomingAlert();
      st.incomingInvitation = null;
      ui.setButtons();
      ui.setStatus("Idle");
    },
  };

  try {
    invitation.progress();
  } catch (err) {
    logLine(`[${nowISO()}] [incoming] ERROR sending ringing: ${err?.message || err}`);
  }
}

export async function answerIncomingCallIsolated(SIP, st, ui) {
  const invitation = st.incomingInvitation;
  if (!invitation) return;

  const caller = invitation.remoteIdentity?.uri?.user || "Unknown";
  const callerDisplay = invitation.remoteIdentity?.displayName || caller;

  stopIncomingAlert();
  const micOk = await ensureMicAccess(ui.setStatus);
  if (!micOk) {
    try {
      invitation.reject({ statusCode: 480 });
    } catch {}
    cleanupIncomingState(st, ui);
    ui.setStatus("Microphone access denied");
    return;
  }

  st.incomingInvitation = null;
  ui.setStatus(`Answering ${callerDisplay}...`);

  try {
    const inviteOptions = {
      sessionDescriptionHandlerModifiers: [g711OnlyModifier],
      sessionDescriptionHandlerOptions: {
        constraints: { audio: true, video: false },
        localMediaStream: getLocalStream() || undefined,
      },
    };

    await invitation.accept(inviteOptions);
    startIncomingEarlyMediaLoop(invitation, ui);
  } catch (err) {
    logLine(`[${nowISO()}] [incoming:answer] ERROR accepting call: ${err?.message || err}`);
    stopLocalAudioStream();
    st.session = null;
    ui.setButtons();
    ui.setStatus("Failed to answer call");
  }
}

export async function rejectIncomingCallIsolated(st, ui) {
  const invitation = st.incomingInvitation;
  if (!invitation) return;

  stopIncomingAlert();
  try {
    invitation.reject({ statusCode: 603 });
  } catch (err) {
    logLine(`[${nowISO()}] [incoming:reject] ERROR rejecting: ${err?.message || err}`);
  }
  cleanupIncomingState(st, ui);
}
