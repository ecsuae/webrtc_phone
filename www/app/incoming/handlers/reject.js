import { nowISO } from "../../config.js";
import { logLine } from "../../log.js";
import { stopIncomingAlert } from "../alert.js";
import { cleanupIncomingState } from "./state.js";

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
