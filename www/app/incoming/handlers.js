import { nowISO } from "../config.js";
import { logLine } from "../log.js";
import { g711OnlyModifier } from "../sdp.js";
import { bindPeerConnection } from "../pcDebug.js";
import { ensureMicAccess, getLocalStream, stopLocalAudioStream } from "../media.js";
import { focusDialTabForIncoming, startIncomingAlert, stopIncomingAlert } from "./alert.js";
import { attachIncomingRemoteAudio, startIncomingEarlyMediaLoop, stopIncomingEarlyMediaLoop } from "./media.js";
import { dualSessionManager } from "../features/dualSessionManager.js";

// Track page load time for ghost call prevention
const pageLoadTimeForIncoming = Date.now();
let lastRegistrationCompleteTime = null;  // Track when registration actually completes

function cleanupIncomingState(st, ui) {
  st.session = null;
  st.incomingInvitation = null;
  stopLocalAudioStream();
  ui.setButtons();
  ui.setStatus("Idle");
  if (window.callTimer) window.callTimer.stop();
}

function endIncomingAlert(st, ui, reason = "unknown") {
  logLine(`[${nowISO()}] [incoming] Ending incoming alert (${reason})`);
  stopIncomingAlert();
  stopIncomingEarlyMediaLoop(st.incomingInvitation || st.session);
  st.incomingInvitation = null;
  ui.setButtons();
  ui.setStatus("Idle");
}

// Export function to update registration complete time from primary.js
export function setRegistrationComplete() {
  lastRegistrationCompleteTime = Date.now();
  logLine(`[${nowISO()}] [incoming] Registration completed at ${lastRegistrationCompleteTime}`);
}

export function handleIncomingCallIsolated(SIP, st, ui, invitation) {
  const callerUser = invitation.remoteIdentity?.uri?.user || "Unknown";
  const callerDisplay = invitation.remoteIdentity?.displayName || callerUser;
  let wasAnswered = false;

  // CRITICAL: Reject all incoming calls if not registered yet (prevents phantom calls during login)
  if (!st.registered) {
    logLine(`[${nowISO()}] [incoming] ⚠️ REJECTED (not registered) from ${callerDisplay}`);
    try {
      invitation.reject({ statusCode: 480 });
    } catch (err) {
      logLine(`[${nowISO()}] [incoming] Could not reject: ${err?.message || err}`);
    }
    return;
  }

  // Second gate: Reject calls in first 3 seconds after registration (prevents iPhone post-login phantom calls)
  if (lastRegistrationCompleteTime !== null) {
    const timeSinceRegComplete = Date.now() - lastRegistrationCompleteTime;
    if (timeSinceRegComplete < 3000) {
      logLine(`[${nowISO()}] [incoming] ⚠️ BLOCKED ${timeSinceRegComplete}ms after reg from ${callerDisplay}`);
      try {
        invitation.reject({ statusCode: 480 });
      } catch (err) {}
      return;
    }
  }

  // Tertiary gate: ignore calls in first 5 seconds of page load (page startup protection)
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
      window.callHistory?.addCall?.(callerUser, "answered", 0, {
        sipCode: 200,
        sipReason: "OK",
      });
      stopIncomingAlert();
      st.session = invitation;
      ui.setStatus(`On call with ${callerDisplay}`);
      ui.setButtons();
      if (window.callTimer) window.callTimer.start();
      attachIncomingRemoteAudio(invitation, ui);
      bindPeerConnection(invitation, "inbound");
      
      // Register as primary session with dual session manager
      if (!dualSessionManager.primary) {
        dualSessionManager.setPrimary(st);
        logLine(`[${nowISO()}] [session:inbound] Registered as primary session`);
      }
      return;
    }

    if (newState === SIP.SessionState.Terminated) {
      if (!wasAnswered) {
        window.callHistory?.addCall?.(callerUser, "missed", 0, {
          sipCode: 480,
          sipReason: "Temporarily Unavailable",
        });
      }
      endIncomingAlert(st, ui, "state-terminated");
      stopIncomingEarlyMediaLoop(invitation);
      
      // Remove from dual session manager
      dualSessionManager.removeSession(st);
      
      cleanupIncomingState(st, ui);
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

  const caller = invitation.remoteIdentity?.uri?.user || "Unknown";

  stopIncomingAlert();
  try {
    invitation.reject({ statusCode: 603 });
    window.callHistory?.addCall?.(caller, "rejected", 0, {
      sipCode: 603,
      sipReason: "Decline",
    });
  } catch (err) {
    logLine(`[${nowISO()}] [incoming:reject] ERROR rejecting: ${err?.message || err}`);
  }
  cleanupIncomingState(st, ui);
}
