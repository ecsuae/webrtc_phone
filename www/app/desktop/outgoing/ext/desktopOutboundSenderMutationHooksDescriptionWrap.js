import { sendCallMediaEvent } from "../../../features/callMediaLog.js";
import { getLocalStream } from "../../../media.js";

import {
  buildDesktopOutboundSenderBaseContext,
  getDesktopOutboundSenderStackTop,
} from "./desktopOutboundSenderBase.js";
import { forceDesktopOutboundAudioSenderToLocalStreamTrack } from "./desktopOutboundSenderForceTrack.js";
import { emitDesktopNegotiatedAudioSnapshot } from "./desktopOutboundNegotiatedAudioSnapshot.js";

function snapshotAudioSenderTrackId(pc) {
  try {
    const senders = pc?.getSenders?.() || [];
    const a = senders.find((sd) => sd?.track?.kind === "audio") || null;
    return a?.track?.id || null;
  } catch {
    return null;
  }
}

export function installDesktopOutboundSenderMutationHooksDescriptionWrap(inviter, st, peer, pc) {
  const base0 = () => buildDesktopOutboundSenderBaseContext({ inviter, st, peer, checkpoint: "sender-mutation-hook" });

  try {
    const origSetLocalDescription = pc.setLocalDescription?.bind(pc);
    if (typeof origSetLocalDescription === "function") {
      pc.setLocalDescription = async (...args) => {
        const prevId = snapshotAudioSenderTrackId(pc);
        try {
          sendCallMediaEvent({
            type: "desktop-audio-sender-mutation",
            ...base0(),
            checkpoint: "pc.setLocalDescription-before",
            reason: "pc.setLocalDescription",
            previousSenderTrackId: prevId || undefined,
            senderTrackId: snapshotAudioSenderTrackId(pc) || undefined,
            localMicTrackId: inviter?.__desktopMicTrackId || undefined,
            localMicStreamId: (() => { try { return getLocalStream()?.id || undefined; } catch { return undefined; } })(),
            pcSignalingState: pc?.signalingState || undefined,
            stackTop: getDesktopOutboundSenderStackTop("pc.setLocalDescription"),
            msg: "pc.setLocalDescription() called",
          });
        } catch {}
        const r = await origSetLocalDescription(...args);

        try {
          await forceDesktopOutboundAudioSenderToLocalStreamTrack(inviter, st, peer, pc, "post-local-description");
        } catch {}
        try {
          await emitDesktopNegotiatedAudioSnapshot(inviter, st, peer, pc, "post-local-description", { includeSdp: true });
        } catch {}
        try {
          sendCallMediaEvent({
            type: "desktop-audio-sender-mutation",
            ...base0(),
            checkpoint: "pc.setLocalDescription-after",
            reason: "pc.setLocalDescription",
            previousSenderTrackId: prevId || undefined,
            senderTrackId: snapshotAudioSenderTrackId(pc) || undefined,
            localMicTrackId: inviter?.__desktopMicTrackId || undefined,
            localMicStreamId: (() => { try { return getLocalStream()?.id || undefined; } catch { return undefined; } })(),
            pcSignalingState: pc?.signalingState || undefined,
            stackTop: getDesktopOutboundSenderStackTop("pc.setLocalDescription"),
            msg: "pc.setLocalDescription() resolved",
          });
        } catch {}
        return r;
      };
    }
  } catch {}

  try {
    const origSetRemoteDescription = pc.setRemoteDescription?.bind(pc);
    if (typeof origSetRemoteDescription === "function") {
      pc.setRemoteDescription = async (...args) => {
        const prevSenderTrackId = snapshotAudioSenderTrackId(pc) || undefined;
        try {
          sendCallMediaEvent({
            type: "desktop-audio-sender-mutation",
            ...base0(),
            checkpoint: "pc.setRemoteDescription-before",
            reason: "pc.setRemoteDescription",
            previousSenderTrackId: prevSenderTrackId,
            senderTrackId: prevSenderTrackId,
            pcSignalingState: pc?.signalingState || undefined,
            stackTop: getDesktopOutboundSenderStackTop("pc.setRemoteDescription"),
            msg: "Desktop outbound: pc.setRemoteDescription() called",
          });
        } catch {}

        const out = await origSetRemoteDescription(...args);

        try {
          await forceDesktopOutboundAudioSenderToLocalStreamTrack(inviter, st, peer, pc, "post-remote-description");
        } catch {}
        try {
          await emitDesktopNegotiatedAudioSnapshot(inviter, st, peer, pc, "post-remote-description", { includeSdp: true });
        } catch {}

        const afterSenderTrackId = snapshotAudioSenderTrackId(pc) || undefined;
        try {
          sendCallMediaEvent({
            type: "desktop-audio-sender-mutation",
            ...base0(),
            checkpoint: "pc.setRemoteDescription-after",
            reason: "pc.setRemoteDescription",
            previousSenderTrackId: prevSenderTrackId,
            senderTrackId: afterSenderTrackId,
            pcSignalingState: pc?.signalingState || undefined,
            msg: "Desktop outbound: pc.setRemoteDescription() completed",
          });
        } catch {}
        return out;
      };
    }
  } catch {}
}
