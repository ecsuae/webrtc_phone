import { nowISO } from "../../config.js";
import { logLine } from "../../log.js";
import { focusDialTabForIncoming, startIncomingAlert, stopIncomingAlert } from "../alert.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";
import { stopIncomingEarlyMediaLoop } from "../media.js?v=1773032001";
import { pageLoadTimeForIncoming, getLastRegistrationCompleteTime, cleanupIncomingState, endIncomingAlert } from "./state.js";
import { getInboundDiagContext } from "./diag.js";
import { onIncomingEstablished } from "./onEstablished.js";
import { onIncomingTerminated } from "./onTerminated.js";

export async function handleIncomingCall(SIP, st, ui, invitation) {
  const callerUser = invitation.remoteIdentity?.uri?.user || "Unknown";
  const callerDisplay = invitation.remoteIdentity?.displayName || callerUser;
  let wasAnswered = false;

  const ctx = getInboundDiagContext(st, invitation);
  invitation.__callMediaDiag = ctx;

  sendCallMediaEvent({
    type: "media-offer-incoming",
    ...ctx,
    t_incomingReceived: new Date().toISOString(),
    msg: "Incoming call offer (INVITE) received",
  });

  if (!st.registered) {
    logLine(`[${nowISO()}] [incoming] ⚠️ REJECTED (not registered) from ${callerDisplay}`);
    try {
      invitation.reject({ statusCode: 480 });
    } catch (err) {
      logLine(`[${nowISO()}] [incoming] Could not reject: ${err?.message || err}`);
    }
    return;
  }

  const regTime = getLastRegistrationCompleteTime();
  if (regTime !== null) {
    const timeSinceRegComplete = Date.now() - regTime;
    if (timeSinceRegComplete < 3000) {
      logLine(`[${nowISO()}] [incoming] ⚠️ BLOCKED ${timeSinceRegComplete}ms after reg from ${callerDisplay}`);
      try {
        invitation.reject({ statusCode: 480 });
      } catch (err) {}
      return;
    }
  }

  const timeSincePageLoad = Date.now() - pageLoadTimeForIncoming;
  if (timeSincePageLoad < 5000) {
    logLine(`[${nowISO()}] [incoming] ⚠️ BLOCKED ${timeSincePageLoad}ms after pageload from ${callerDisplay}`);
    try {
      invitation.reject({ statusCode: 480 });
    } catch (err) {}
    return;
  }

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
  startIncomingAlert(callerDisplay, { showBanner: false });

  const stateListener = (newState) => {
    logLine(`[${nowISO()}] [incoming:state] ${newState}`);
    if (newState === SIP.SessionState.Terminating) {
      endIncomingAlert(st, ui, "state-terminating");
      return;
    }

    if (newState === SIP.SessionState.Establishing) {
      ui.setStatus(`Answering ${callerDisplay}...`);
      return;
    }

    if (newState === SIP.SessionState.Established) {
      wasAnswered = true;
      stopIncomingAlert();
      try {
        wasAnswered = !!onIncomingEstablished(SIP, st, ui, invitation, callerUser, callerDisplay);
      } catch {
        wasAnswered = true;
      }
      return;
    }

    if (newState === SIP.SessionState.Terminated) {
      try {
        onIncomingTerminated(st, ui, invitation, callerUser, wasAnswered);
      } catch {
        try {
          endIncomingAlert(st, ui, "state-terminated");
          stopIncomingEarlyMediaLoop(invitation);
          cleanupIncomingState(st, ui);
        } catch {}
      }
    }
  };

  invitation.stateChange?.addListener?.(stateListener);
  invitation.delegate = {
    onCancel: () => {
      endIncomingAlert(st, ui, "remote-cancel");
    },
    onBye: () => {
      endIncomingAlert(st, ui, "remote-bye");
    },
  };

  try {
    invitation.progress();
  } catch (err) {
    logLine(`[${nowISO()}] [incoming] ERROR sending ringing: ${err?.message || err}`);
  }
}

export async function handleIncomingCallIsolated(SIP, st, ui, invitation) {
  return handleIncomingCall(SIP, st, ui, invitation);
}
