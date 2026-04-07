import { nowISO } from "../../config.js";
import { logLine } from "../../log.js";
import { bindPeerConnection } from "../../pcDebug.js?v=1773033002";
import { attachRemoteAudio, clearEarlyMediaAttachLoop } from "../media.js?v=1773032001";
import { handleOutboundEstablished } from "./stateChange/established.js";
import { handleOutboundTerminated } from "./stateChange/terminated.js";

export function onOutboundStateChange(SIP, inviter, st, ui, { t_callStart, peer } = {}) {
  return (s) => {
    logLine(`[${nowISO()}] [session:outbound] ${s}`);
    const _aor = st.account ? `${st.account.rawUsername}@${st.account.domain}` : undefined;
    const _callId = inviter.outgoingRequestMessage?.callId || undefined;
    bindPeerConnection(inviter, "outbound", { aor: _aor, callId: _callId });
    attachRemoteAudio(inviter, ui);

    try {
      const audioEl = ui?.remoteAudio?.();
      const pc = inviter?.sessionDescriptionHandler?.peerConnection;
      if (audioEl && pc) audioEl.__callMediaPc = pc;
    } catch {}

    if (s === SIP.SessionState.Established) {
      handleOutboundEstablished(SIP, inviter, st, ui, { t_callStart, peer });
      return;
    }

    if (s === SIP.SessionState.Terminated) {
      try {
        clearEarlyMediaAttachLoop(inviter);
      } catch {}
      handleOutboundTerminated(inviter, st, ui, { t_callStart, peer });
    }
  };
}
