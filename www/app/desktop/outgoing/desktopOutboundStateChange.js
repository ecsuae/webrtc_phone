import { nowISO, logLine } from "../desktopLogging.js";
import { bindPeerConnection } from "../../pcDebug.js?v=1773033002";
import { initDesktopTerminationDiagnostics } from "./desktopTerminationDiagnostics.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";

import { attachRemoteAudio } from "./desktopOutgoingMedia.js";
import { handleOutboundEstablishedDesktop } from "./desktopOutboundEstablished.js";

import { syncDesktopOutboundTerminated } from "./desktopOutboundTerminationSync.js";
import {
  emitDesktopAudioSenderBound,
  emitDesktopOutboundSenderObserved,
  emitDesktopNegotiatedAudioSnapshot,
  forceDesktopOutboundAudioSenderToLocalStreamTrack,
  installDesktopOutboundSenderMutationHooks,
} from "./desktopOutboundSenderDiagnostics.js";

export function onOutboundStateChangeDesktop(SIP, inviter, st, ui, { t_callStart, peer } = {}) {
  return async (s) => {
    try {
      if (typeof inviter.__desktopPrevSessionState === "undefined") {
        inviter.__desktopPrevSessionState = null;
      }
    } catch {}

    const prevState = (() => {
      try {
        return inviter.__desktopPrevSessionState;
      } catch {
        return null;
      }
    })();

    try {
      inviter.__desktopPrevSessionState = s;
    } catch {}

    logLine(`[${nowISO()}] [session:outbound] ${s}`);

    try {
      sendCallMediaEvent({
        type: "desktop-session-state-transition",
        corrId: inviter?.__webrtcCorrId || st?.__webrtcCorrId || undefined,
        callId: inviter?.outgoingRequestMessage?.callId || undefined,
        dir: "outbound",
        peer: peer || undefined,
        prevState: prevState == null ? undefined : String(prevState),
        nextState: String(s),
        sessionState: String(inviter?.state || ""),
        stSessionMatches: !!(st?.session && st.session === inviter),
        source: "desktopOutboundStateChange.stateChange",
        msg: "Desktop outbound session state transition",
      });
    } catch {}

    try {
      initDesktopTerminationDiagnostics(SIP, inviter, ui, { dir: "outbound", peer });
    } catch {}

    try {
      const _aor = st.account ? `${st.account.rawUsername}@${st.account.domain}` : undefined;
      const _callId = inviter.outgoingRequestMessage?.callId || undefined;
      bindPeerConnection(inviter, "outbound", { aor: _aor, callId: _callId });
    } catch {}

    attachRemoteAudio(inviter, ui);

    try {
      const audioEl = ui?.remoteAudio?.();
      const pc = inviter?.sessionDescriptionHandler?.peerConnection;
      if (audioEl && pc) audioEl.__callMediaPc = pc;
    } catch {}

    try {
      const pc = inviter?.sessionDescriptionHandler?.peerConnection;
      if (pc && !pc.__desktopSenderObservedPostPc) {
        pc.__desktopSenderObservedPostPc = true;
        try {
          if (!pc.__desktopAudioSenderBoundEmitted) {
            pc.__desktopAudioSenderBoundEmitted = true;
            emitDesktopAudioSenderBound(inviter, st, peer, { reason: "pc-available" });
          }
        } catch {}
        try {
          installDesktopOutboundSenderMutationHooks(inviter, st, peer, pc);
        } catch {}
        try {
          await forceDesktopOutboundAudioSenderToLocalStreamTrack(inviter, st, peer, pc, "post-pc");
        } catch {}
        try {
          await emitDesktopNegotiatedAudioSnapshot(inviter, st, peer, pc, "post-pc", { includeSdp: true });
        } catch {}
        emitDesktopOutboundSenderObserved(inviter, st, peer, "post-pc");
      }
    } catch {}

    if (s === SIP.SessionState.Established) {
      try {
        inviter.__desktopTermDiagApi?.captureSync?.("established");
      } catch {}
      try {
        emitDesktopOutboundSenderObserved(inviter, st, peer, "post-established");
      } catch {}
      try {
        const pc = inviter?.sessionDescriptionHandler?.peerConnection;
        if (pc) await emitDesktopNegotiatedAudioSnapshot(inviter, st, peer, pc, "post-established", { includeSdp: true });
      } catch {}
      handleOutboundEstablishedDesktop(inviter, st, ui, { t_callStart, peer });
      return;
    }

    if (s === SIP.SessionState.Terminated) {
      try {
        syncDesktopOutboundTerminated(SIP, inviter, st, ui, {
          peer,
          reason: "outbound-state-terminated",
          trigger: "stateChange:Terminated",
        });
      } catch {}
    }
  };
}
