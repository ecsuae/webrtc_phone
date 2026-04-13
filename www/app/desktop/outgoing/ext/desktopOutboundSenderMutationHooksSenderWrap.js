import { sendCallMediaEvent } from "../../../features/callMediaLog.js";
import { getLocalStream } from "../../../media.js";

import {
  buildDesktopOutboundSenderBaseContext,
  getDesktopOutboundSenderStackTop,
} from "./desktopOutboundSenderBase.js";

export function installDesktopOutboundSenderMutationHooksSenderWrap(inviter, st, peer, pc, transceiver) {
  const base0 = () => buildDesktopOutboundSenderBaseContext({ inviter, st, peer, checkpoint: "sender-mutation-hook" });

  try {
    const sd = transceiver?.sender;
    if (sd && typeof sd.replaceTrack === "function" && !sd.__desktopReplaceTrackWrapped) {
      sd.__desktopReplaceTrackWrapped = true;
      const orig = sd.replaceTrack.bind(sd);
      sd.replaceTrack = async (newTrack) => {
        const prev = sd?.track?.id || null;
        try {
          sendCallMediaEvent({
            type: "desktop-audio-sender-mutation",
            ...base0(),
            checkpoint: "sender.replaceTrack-before",
            reason: "sender.replaceTrack",
            previousSenderTrackId: prev || undefined,
            senderTrackId: newTrack?.id || undefined,
            localMicTrackId: inviter?.__desktopMicTrackId || undefined,
            localMicStreamId: (() => { try { return getLocalStream()?.id || undefined; } catch { return undefined; } })(),
            pcSignalingState: pc?.signalingState || undefined,
            stackTop: getDesktopOutboundSenderStackTop("sender.replaceTrack"),
            msg: "sender.replaceTrack() called",
          });
        } catch {}
        const rr = await orig(newTrack);
        try {
          sendCallMediaEvent({
            type: "desktop-audio-sender-mutation",
            ...base0(),
            checkpoint: "sender.replaceTrack-after",
            reason: "sender.replaceTrack",
            previousSenderTrackId: prev || undefined,
            senderTrackId: sd?.track?.id || undefined,
            localMicTrackId: inviter?.__desktopMicTrackId || undefined,
            localMicStreamId: (() => { try { return getLocalStream()?.id || undefined; } catch { return undefined; } })(),
            pcSignalingState: pc?.signalingState || undefined,
            stackTop: getDesktopOutboundSenderStackTop("sender.replaceTrack"),
            msg: "sender.replaceTrack() resolved",
          });
        } catch {}
        return rr;
      };
    }
  } catch {}
}
