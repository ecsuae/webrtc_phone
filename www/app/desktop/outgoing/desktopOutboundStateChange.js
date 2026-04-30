import { nowISO, logLine } from "../desktopLogging.js";
import { bindPeerConnection } from "../../pcDebug.js?v=1773033002";
import { initDesktopTerminationDiagnostics } from "./desktopTerminationDiagnostics.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";

import { attachRemoteAudio } from "./desktopOutgoingMedia.js";
import { handleOutboundEstablishedDesktop } from "./desktopOutboundEstablished.js";
import { getLocalStream } from "../../media.js";

import { syncDesktopOutboundTerminated } from "./desktopOutboundTerminationSync.js";
import { emitDesktopAudioSenderBound } from "./ext/desktopOutboundSenderBound.js";
import { emitDesktopOutboundSenderObserved } from "./ext/desktopOutboundSenderObserved.js";
import { emitDesktopNegotiatedAudioSnapshot } from "./ext/desktopOutboundNegotiatedAudioSnapshot.js";
import { forceDesktopOutboundAudioSenderToLocalStreamTrack } from "./ext/desktopOutboundSenderForceTrack.js";
import { installDesktopOutboundSenderMutationHooks } from "./ext/desktopOutboundSenderMutationHooksCore.js";

async function emitDesktopOutboundAudioProof(inviter, st, peer, { checkpoint } = {}) {
  try {
    const pc = inviter?.sessionDescriptionHandler?.peerConnection || null;
    if (!pc) return;

    const localStream = (() => {
      try {
        return getLocalStream() || null;
      } catch {
        return null;
      }
    })();

    const localMicTrackId = inviter?.__desktopMicTrackId || st?.__desktopMicTrackId || undefined;
    const localMicStreamId = inviter?.__desktopMicStreamId || st?.__desktopMicStreamId || localStream?.id || undefined;

    const sender = (() => {
      try {
        return (pc.getSenders?.() || []).find((s) => s?.track?.kind === "audio") || null;
      } catch {
        return null;
      }
    })();
    const senderTrack = sender?.track || null;

    const tr = (() => {
      try {
        return (pc.getTransceivers?.() || []).find((t) => t?.sender?.track?.kind === "audio" || t?.receiver?.track?.kind === "audio") || null;
      } catch {
        return null;
      }
    })();

    const stats = await pc.getStats();
    let outPk = null;
    let outBy = null;
    let outAudioLevel = null;
    let outTotalAudioEnergy = null;
    stats.forEach((r) => {
      try {
        if (r?.type !== "outbound-rtp") return;
        if (r.kind !== "audio" && r.mediaType !== "audio") return;
        if (typeof r.packetsSent === "number") outPk = r.packetsSent;
        if (typeof r.bytesSent === "number") outBy = r.bytesSent;
        if (typeof r.audioLevel === "number") outAudioLevel = r.audioLevel;
        if (typeof r.totalAudioEnergy === "number") outTotalAudioEnergy = r.totalAudioEnergy;
      } catch {}
    });

    sendCallMediaEvent({
      type: "desktop-outbound-audio-proof",
      corrId: inviter?.__webrtcCorrId || st?.__webrtcCorrId || undefined,
      callId: inviter?.outgoingRequestMessage?.callId || undefined,
      dir: "outbound",
      peer: peer || undefined,
      checkpoint: checkpoint || "post-established-2p5s",
      localMicTrackId,
      localMicStreamId,
      senderTrackId: senderTrack?.id || undefined,
      senderTrackReadyState: senderTrack?.readyState || undefined,
      senderTrackEnabled: (typeof senderTrack?.enabled === "boolean") ? senderTrack.enabled : undefined,
      senderTrackMuted: (typeof senderTrack?.muted === "boolean") ? senderTrack.muted : undefined,
      senderTrackIsSameObjectAsLocalStreamAudioTrack: (() => {
        try {
          const t0 = localStream?.getAudioTracks?.()?.[0] || null;
          if (!t0 || !senderTrack) return undefined;
          return senderTrack === t0;
        } catch {
          return undefined;
        }
      })(),
      senderTrackIdMatchesLocalMicTrackId: !!(senderTrack?.id && localMicTrackId && senderTrack.id === localMicTrackId),
      transceiverMid: (tr && (typeof tr.mid === "string" || typeof tr.mid === "number")) ? String(tr.mid) : undefined,
      transceiverDirection: (typeof tr?.direction === "string") ? tr.direction : undefined,
      transceiverCurrentDirection: (typeof tr?.currentDirection === "string") ? tr.currentDirection : undefined,
      outboundAudioPacketsSent: outPk ?? undefined,
      outboundAudioBytesSent: outBy ?? undefined,
      outboundAudioLevel: outAudioLevel ?? undefined,
      outboundTotalAudioEnergy: outTotalAudioEnergy ?? undefined,
      pcSignalingState: pc?.signalingState || undefined,
      pcConnectionState: pc?.connectionState || undefined,
      msg: "Desktop outbound audio proof (post-established)"
    });
  } catch {}
}

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

      try {
        const pc = inviter?.sessionDescriptionHandler?.peerConnection;
        if (pc && !pc.__desktopOutboundAudioProofScheduled) {
          pc.__desktopOutboundAudioProofScheduled = true;
          setTimeout(() => {
            void emitDesktopOutboundAudioProof(inviter, st, peer, { checkpoint: "post-established-2p5s" });
          }, 2500);
        }
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
