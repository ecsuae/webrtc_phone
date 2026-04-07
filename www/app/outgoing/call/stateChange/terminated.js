import { stopLocalAudioStream } from "../../../media.js";
import { dualSessionManager } from "../../../features/dualSessionManager.js";
import { sendCallMediaEvent } from "../../../features/callMediaLog.js";
import { stopRingbackTone } from "../../ringback.js";
import { clearEarlyMediaAttachLoop } from "../../media.js?v=1773032001";
import { stopOutboundDiag } from "../audioOutputDiag.js";
import { getOutboundDiagContext } from "../diagContext.js";

export function handleOutboundTerminated(inviter, st, ui, { t_callStart, peer } = {}) {
  stopRingbackTone();
  clearEarlyMediaAttachLoop(inviter);

  try {
    const audioEl = ui?.remoteAudio?.();
    stopOutboundDiag(audioEl);
  } catch {}

  sendCallMediaEvent({
    type: "call-ended",
    ...getOutboundDiagContext(st, peer, inviter),
    t_callStart,
    t_ended: new Date().toISOString(),
    msg: "Call terminated",
  });

  sendCallMediaEvent({
    type: "outbound-call-end",
    ...getOutboundDiagContext(st, peer, inviter),
    t_callStart,
    t_ended: new Date().toISOString(),
    msg: "Outbound call end (guaranteed chain)",
  });

  dualSessionManager.removeSession(st);

  st.session = null;
  stopLocalAudioStream();
  ui.setButtons();
  ui.setStatus("Idle");
  if (window.callTimer) window.callTimer.stop();
}
