import { sendCallMediaEvent } from "../../features/callMediaLog.js";
import { dualSessionManager } from "../../features/dualSessionManager.js";

import { stopRingbackTone } from "./desktopRingbackDelegate.js";
import { getOutboundDiagContext } from "../../outgoing/call/diagContext.js";

export function handleOutboundEstablishedDesktop(inviter, st, ui, { t_callStart, peer } = {}) {
  stopRingbackTone({ trigger: "established", reason: "session-established" });

  try {
    if (window.callTimer) window.callTimer.start();
  } catch {}

  try {
    sendCallMediaEvent({
      type: "outbound-call-established",
      ...getOutboundDiagContext(st, peer, inviter),
      t_callStart,
      t_established: new Date().toISOString(),
      msg: "Call established (outbound)",
    });
  } catch {}

  try {
    sendCallMediaEvent({
      type: "media-answer-outgoing",
      ...getOutboundDiagContext(st, peer, inviter),
      t_callStart,
      t_established: new Date().toISOString(),
      msg: "Call established (answer received)",
    });
  } catch {}

  try {
    sendCallMediaEvent({
      type: "call-established",
      ...getOutboundDiagContext(st, peer, inviter),
      t_callStart,
      t_established: new Date().toISOString(),
      msg: "Call established",
    });
  } catch {}

  try {
    if (!dualSessionManager.primary) {
      dualSessionManager.setPrimary(st);
    }
  } catch {}
}
