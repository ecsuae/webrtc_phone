import { nowISO, logLine } from "../desktopLogging.js";
import { bindPeerConnection } from "../../pcDebug.js?v=1773033002";
import { releaseDesktopCallAudio } from "../media/desktopCallAudioRuntime.js";
import { initDesktopTerminationDiagnostics } from "./desktopTerminationDiagnostics.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";

import { attachRemoteAudio, clearEarlyMediaAttachLoop } from "./desktopOutgoingMedia.js";
import { handleOutboundEstablishedDesktop } from "./desktopOutboundEstablished.js";

import { stopRingbackTone } from "./desktopRingbackDelegate.js";
import {
  emitDesktopAudioSenderBound,
  emitDesktopOutboundSenderObserved,
  emitDesktopNegotiatedAudioSnapshot,
  forceDesktopOutboundAudioSenderToLocalStreamTrack,
  installDesktopOutboundSenderMutationHooks,
} from "./desktopOutboundSenderDiagnostics.js";

export function onOutboundStateChangeDesktop(SIP, inviter, st, ui, { t_callStart, peer } = {}) {
  return async (s) => {
    logLine(`[${nowISO()}] [session:outbound] ${s}`);

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
        inviter.__desktopTermDiagApi?.captureSync?.("terminated");
      } catch {}
      try {
        clearEarlyMediaAttachLoop(inviter);
      } catch {}

      stopRingbackTone({ trigger: "terminated", reason: "session-terminated" });

      try {
        const pc = inviter?.sessionDescriptionHandler?.peerConnection;
        const senders = pc?.getSenders?.() || [];
        const a = senders.find((sd) => sd?.track?.kind === "audio") || null;
        inviter.__desktopLastSenderTrackId = a?.track?.id || null;
        inviter.__desktopLastSenderTrackReadyState = a?.track?.readyState || null;
        inviter.__desktopLastSenderTrackEnabled = (typeof a?.track?.enabled === "boolean") ? a.track.enabled : null;
        inviter.__desktopLastSenderTrackMuted = (typeof a?.track?.muted === "boolean") ? a.track.muted : null;
        inviter.__desktopLastPcSignalingState = pc?.signalingState || null;
      } catch {}

      try {
        const pc = inviter?.sessionDescriptionHandler?.peerConnection;
        const senders = pc?.getSenders?.() || [];
        const sender = senders.find((sd) => sd?.track?.kind === "audio") || null;
        const senderTrack = sender?.track || null;
        const storedMicTrack = inviter?.__desktopMicTrack || null;
        const storedStream = inviter?.__desktopLocalStream || null;
        const storedStreamTrackIdsBefore = (() => {
          try {
            const ts = storedStream?.getTracks?.() || [];
            return ts.map((t) => t?.id || null).filter(Boolean).slice(0, 8);
          } catch {
            return undefined;
          }
        })();
        const storedLocalStreamTrackIdsBefore = storedStreamTrackIdsBefore;
        const senderTrackId = senderTrack?.id || undefined;
        const senderTrackReadyState = senderTrack?.readyState || undefined;
        const senderTrackEnabled = (typeof senderTrack?.enabled === "boolean") ? senderTrack.enabled : undefined;
        const storedMicTrackId = storedMicTrack?.id || undefined;
        const storedMicTrackReadyStateBefore = storedMicTrack?.readyState || undefined;
        const localMicTrackId = inviter?.__desktopMicTrackId || undefined;
        const sameAsLocalMicTrack = !!(senderTrackId && localMicTrackId && senderTrackId === localMicTrackId);

        try {
          sendCallMediaEvent({
            type: "desktop-release-audio-before-close",
            corrId: inviter?.__webrtcCorrId || st?.__webrtcCorrId || undefined,
            callId: inviter?.outgoingRequestMessage?.callId || undefined,
            dir: "outbound",
            senderTrackId,
            senderTrackReadyState,
            senderTrackEnabled,
            localMicTrackId,
            sameAsLocalMicTrack,
            msg: "Desktop outbound: release audio before pc.close()",
          });
        } catch {}

        const teardownCorrId = inviter?.__webrtcCorrId || st?.__webrtcCorrId || undefined;
        const teardownCallId = inviter?.outgoingRequestMessage?.callId || undefined;

        const senderTrackIdBefore = senderTrack?.id || undefined;
        const senderTrackReadyStateBefore = senderTrack?.readyState || undefined;
        const senderSameAsLocalMicBefore = !!(senderTrackIdBefore && localMicTrackId && senderTrackIdBefore === localMicTrackId);
        try {
          sendCallMediaEvent({
            type: "desktop-replace-track-null-start",
            corrId: teardownCorrId,
            callId: teardownCallId,
            dir: "outbound",
            senderTrackIdBefore,
            senderTrackReadyStateBefore,
            sameAsLocalMicTrack: senderSameAsLocalMicBefore,
          });
        } catch {}

        let replaceTrackNullRan = false;
        let replaceTrackNullTimedOut = false;
        let replaceTrackNullError = undefined;
        try {
          if (sender && typeof sender.replaceTrack === "function") {
            const p = sender.replaceTrack(null);
            const raced = await Promise.race([
              p,
              new Promise((resolve) => setTimeout(() => resolve("timeout"), 900)),
            ]);
            if (raced === "timeout") {
              replaceTrackNullTimedOut = true;
            } else {
              replaceTrackNullRan = true;
            }
          }
        } catch (e) {
          try {
            replaceTrackNullError = String(e?.message || e);
          } catch {
            replaceTrackNullError = "unknown";
          }
        }

        try {
          sendCallMediaEvent({
            type: "desktop-replace-track-null-result",
            corrId: teardownCorrId,
            callId: teardownCallId,
            dir: "outbound",
            replaceTrackNullRan,
            replaceTrackNullTimedOut,
            replaceTrackNullError,
            senderTrackIdBefore,
            senderTrackReadyStateBefore,
          });
        } catch {}

        try {
          const afterDetachTrack = sender?.track;
          const senderHasTrackAfterDetach = !!afterDetachTrack;
          const senderTrackIdAfterDetach = afterDetachTrack?.id || undefined;
          const senderTrackReadyStateAfterDetach = afterDetachTrack?.readyState || undefined;
          const sameAsStoredMicTrack = !!(senderTrackIdAfterDetach && storedMicTrackId && senderTrackIdAfterDetach === storedMicTrackId);
          sendCallMediaEvent({
            type: "desktop-sender-post-detach-check",
            corrId: teardownCorrId,
            callId: teardownCallId,
            dir: "outbound",
            senderHasTrackAfterDetach,
            senderTrackIdAfterDetach,
            senderTrackReadyStateAfterDetach,
            sameAsStoredMicTrack,
          });
        } catch {}

        try {
          senderTrack?.stop?.();
        } catch {}
        try {
          inviter?.__desktopMicTrack?.stop?.();
        } catch {}
        try {
          const s = inviter?.__desktopLocalStream || null;
          const tracks = s?.getTracks?.() || [];
          tracks.forEach((t) => {
            try { t?.stop?.(); } catch {}
          });
        } catch {}

        const storedMicTrackReadyStateAfter = storedMicTrack?.readyState || undefined;
        const storedStreamTrackIdsAfter = (() => {
          try {
            const ts = storedStream?.getTracks?.() || [];
            return ts.map((t) => t?.id || null).filter(Boolean).slice(0, 8);
          } catch {
            return undefined;
          }
        })();
        const storedLocalStreamTrackIdsAfter = storedStreamTrackIdsAfter;

        try {
          const afterTrack = sender?.track;
          const afterTrackId = afterTrack?.id || undefined;
          const afterReadyState = afterTrack?.readyState || undefined;
          const afterEnabled = (typeof afterTrack?.enabled === "boolean") ? afterTrack.enabled : undefined;
          const afterSameAsLocalMicTrack = !!(afterTrackId && localMicTrackId && afterTrackId === localMicTrackId);
          sendCallMediaEvent({
            type: "desktop-release-audio-after-stop",
            corrId: teardownCorrId,
            callId: teardownCallId,
            dir: "outbound",
            afterStopEventEmitted: true,
            senderTrackId: afterTrackId,
            senderTrackReadyState: afterReadyState,
            senderTrackIdAfter: afterTrackId,
            senderTrackReadyStateAfter: afterReadyState,
            senderTrackEnabled: afterEnabled,
            localMicTrackId,
            sameAsLocalMicTrack: afterSameAsLocalMicTrack,
            replaceTrackNullRan,
            storedMicTrackId,
            storedMicTrackReadyStateBefore,
            storedMicTrackReadyStateAfter,
            storedLocalStreamTrackIdsBefore,
            storedLocalStreamTrackIdsAfter,
            msg: "Desktop outbound: release audio after stop/replaceTrack(null)",
          });
        } catch {}
      } catch {}

      try {
        const pc = inviter?.sessionDescriptionHandler?.peerConnection;
        if (pc && typeof pc.close === "function" && pc.signalingState !== "closed") {
          pc.close();
        }
      } catch {}

      releaseDesktopCallAudio("outbound-state-terminated", {
        session: inviter,
        corrId: inviter?.__webrtcCorrId || st?.__webrtcCorrId || null,
        callId: inviter?.outgoingRequestMessage?.callId || null,
        micId: inviter?.__desktopMicId || null,
        dir: "outbound",
        peer,
      });

      st.session = null;
      try {
        ui.setButtons();
        ui.setStatus("Idle");
      } catch {}

      try {
        if (window.callTimer) window.callTimer.stop();
      } catch {}
    }
  };
}
