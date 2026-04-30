import { sendCallMediaEvent } from "../../features/callMediaLog.js";
import { dualSessionManager } from "../../features/dualSessionManager.js";
import { stopIncomingEarlyMediaLoop } from "../media.js?v=1773032001";
import { cleanupIncomingState, endIncomingAlert } from "./state.js";
import { getInboundDiagContext } from "./diag.js";

export function onIncomingTerminated(st, ui, invitation, callerUser, wasAnswered) {
  if (!wasAnswered) {
    window.callHistory?.addCall?.(callerUser, "missed", 0, {
      sipCode: 480,
      sipReason: "Temporarily Unavailable",
    });
  }

  endIncomingAlert(st, ui, "state-terminated");
  stopIncomingEarlyMediaLoop(invitation);

  sendCallMediaEvent({
    type: "call-ended",
    ...getInboundDiagContext(st, invitation),
    t_ended: new Date().toISOString(),
    msg: "Inbound call terminated",
  });

  dualSessionManager.removeSession(st);
  cleanupIncomingState(st, ui);
}
