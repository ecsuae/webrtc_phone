import { nowISO, logLine } from "../desktopLogging.js";
import { onDesktopIncomingEstablished } from "./desktopOnIncomingEstablished.js";
import { endDesktopCallUiState } from "../calls/desktopCallEndSync.js";

export function wireDesktopIncomingInvitation(SIP, st, ui, invitation) {
  const callerUser = invitation.remoteIdentity?.uri?.user || "Unknown";
  const callerDisplay = invitation.remoteIdentity?.displayName || callerUser;

  const stateListener = (newState) => {
    try {
      logLine(`[${nowISO()}] [desktop:incoming:state] ${newState}`);
    } catch {}

    if (newState === SIP.SessionState.Establishing) {
      try {
        ui.setStatus(`Answering ${callerDisplay}...`);
      } catch {}
      return;
    }

    if (newState === SIP.SessionState.Established) {
      try {
        onDesktopIncomingEstablished(SIP, st, ui, invitation, callerUser, callerDisplay);
      } catch {}
      return;
    }

    if (newState === SIP.SessionState.Terminated) {
      try {
        logLine(`[${nowISO()}] [desktop-remote-hangup-detected] dir=inbound trigger=SessionState.Terminated`);
      } catch {}

      try {
        logLine(`[${nowISO()}] [desktop-session-terminated] dir=inbound reason=session-terminated`);
      } catch {}

      try {
        endDesktopCallUiState(st, ui, invitation, {
          reason: "inbound-state-terminated",
          dir: "inbound",
          corrId: invitation?.__webrtcCorrId || st?.__webrtcCorrId || undefined,
          callId: invitation?.outgoingRequestMessage?.callId || undefined,
          trigger: "stateChange:Terminated",
        });
      } catch {}
    }
  };

  try {
    invitation.stateChange?.addListener?.(stateListener);
  } catch {}
}
