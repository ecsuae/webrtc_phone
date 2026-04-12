import { nowISO, logLine } from "../desktopLogging.js";
import { onDesktopIncomingEstablished } from "./desktopOnIncomingEstablished.js";

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
    }
  };

  try {
    invitation.stateChange?.addListener?.(stateListener);
  } catch {}
}
