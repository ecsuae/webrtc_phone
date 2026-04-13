import { sendCallMediaEvent } from "../../../features/callMediaLog.js";
import { getLocalStream } from "../../../media.js";

import {
  buildDesktopOutboundSenderBaseContext,
  getDesktopOutboundSenderStackTop,
} from "./desktopOutboundSenderBase.js";

function snapshotAudioSenderTrackId(pc) {
  try {
    const senders = pc?.getSenders?.() || [];
    const a = senders.find((sd) => sd?.track?.kind === "audio") || null;
    return a?.track?.id || null;
  } catch {
    return null;
  }
}

export function installDesktopOutboundSenderMutationHooksPcWrap(inviter, st, peer, pc) {
  const base0 = () => buildDesktopOutboundSenderBaseContext({ inviter, st, peer, checkpoint: "sender-mutation-hook" });

  try {
    const origAddTrack = pc.addTrack?.bind(pc);
    if (typeof origAddTrack === "function") {
      pc.addTrack = (...args) => {
        const prevId = snapshotAudioSenderTrackId(pc);
        try {
          const track = args?.[0] || null;
          const stream = args?.[1] || null;
          const localStreamAudioTrackId = (() => {
            try {
              return stream?.getAudioTracks?.()?.[0]?.id || null;
            } catch {
              return null;
            }
          })();
          sendCallMediaEvent({
            type: "desktop-audio-sender-mutation",
            ...base0(),
            checkpoint: "pc.addTrack-before",
            reason: "pc.addTrack",
            previousSenderTrackId: prevId || undefined,
            senderTrackId: track?.id || undefined,
            localMicTrackId: inviter?.__desktopMicTrackId || undefined,
            localMicStreamId: (() => { try { return getLocalStream()?.id || undefined; } catch { return undefined; } })(),
            localStreamAudioTrackId: localStreamAudioTrackId || undefined,
            pcSignalingState: pc?.signalingState || undefined,
            stackTop: getDesktopOutboundSenderStackTop("pc.addTrack"),
            msg: "pc.addTrack() called",
          });
        } catch {}
        const r = origAddTrack(...args);
        try {
          sendCallMediaEvent({
            type: "desktop-audio-sender-mutation",
            ...base0(),
            checkpoint: "pc.addTrack-after",
            reason: "pc.addTrack",
            previousSenderTrackId: prevId || undefined,
            senderTrackId: snapshotAudioSenderTrackId(pc) || undefined,
            localMicTrackId: inviter?.__desktopMicTrackId || undefined,
            localMicStreamId: (() => { try { return getLocalStream()?.id || undefined; } catch { return undefined; } })(),
            pcSignalingState: pc?.signalingState || undefined,
            stackTop: getDesktopOutboundSenderStackTop("pc.addTrack"),
            msg: "pc.addTrack() returned",
          });
        } catch {}
        return r;
      };
    }
  } catch {}

  try {
    const origAddTransceiver = pc.addTransceiver?.bind(pc);
    if (typeof origAddTransceiver === "function") {
      pc.addTransceiver = (...args) => {
        const prevId = snapshotAudioSenderTrackId(pc);
        try {
          const kindOrTrack = args?.[0] || null;
          const kind = typeof kindOrTrack === "string" ? kindOrTrack : (kindOrTrack?.kind || null);
          sendCallMediaEvent({
            type: "desktop-audio-sender-mutation",
            ...base0(),
            checkpoint: "pc.addTransceiver-before",
            reason: "pc.addTransceiver",
            previousSenderTrackId: prevId || undefined,
            senderKind: kind || undefined,
            localMicTrackId: inviter?.__desktopMicTrackId || undefined,
            localMicStreamId: (() => { try { return getLocalStream()?.id || undefined; } catch { return undefined; } })(),
            pcSignalingState: pc?.signalingState || undefined,
            stackTop: getDesktopOutboundSenderStackTop("pc.addTransceiver"),
            msg: "pc.addTransceiver() called",
          });
        } catch {}
        const r = origAddTransceiver(...args);
        try {
          sendCallMediaEvent({
            type: "desktop-audio-sender-mutation",
            ...base0(),
            checkpoint: "pc.addTransceiver-after",
            reason: "pc.addTransceiver",
            previousSenderTrackId: prevId || undefined,
            senderTrackId: snapshotAudioSenderTrackId(pc) || undefined,
            transceiverMid: (r && (typeof r.mid === "string" || typeof r.mid === "number")) ? String(r.mid) : undefined,
            pcSignalingState: pc?.signalingState || undefined,
            stackTop: getDesktopOutboundSenderStackTop("pc.addTransceiver"),
            msg: "pc.addTransceiver() returned",
          });
        } catch {}
        return r;
      };
    }
  } catch {}
}
