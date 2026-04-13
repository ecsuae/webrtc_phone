import { sendCallMediaEvent } from "../../../features/callMediaLog.js";
import { getLocalStream } from "../../../media.js";

import { buildDesktopOutboundSenderBaseContext } from "./desktopOutboundSenderBase.js";

function pickPreferredAudioTransceiver(pc) {
  try {
    const trs = pc?.getTransceivers?.() || [];
    const audio = trs.filter((tr) => tr?.receiver?.track?.kind === "audio" || tr?.sender?.track?.kind === "audio");
    if (!audio.length) return null;
    const withMid = audio.find((tr) => tr?.mid !== null && tr?.mid !== undefined);
    return withMid || audio[0] || null;
  } catch {
    return null;
  }
}

export async function forceDesktopOutboundAudioSenderToLocalStreamTrack(inviter, st, peer, pc, checkpoint = "post-pc") {
  try {
    if (!pc) return;
    if (pc.__desktopForcedAudioSenderToLocalStreamTrackAt === checkpoint) return;
    pc.__desktopForcedAudioSenderToLocalStreamTrackAt = checkpoint;
  } catch {
    return;
  }

  const stream = (() => {
    try {
      return getLocalStream() || null;
    } catch {
      return null;
    }
  })();
  const desiredTrack = (() => {
    try {
      return stream?.getAudioTracks?.()?.[0] || null;
    } catch {
      return null;
    }
  })();

  if (!stream || !desiredTrack) return;

  const base = buildDesktopOutboundSenderBaseContext({ inviter, st, peer, checkpoint });

  const findAudioSender = () => {
    try {
      const senders = pc?.getSenders?.() || [];
      const s0 = senders.find((sd) => sd?.track?.kind === "audio") || null;
      if (s0) return s0;
      const trs = pc?.getTransceivers?.() || [];
      const tr0 = trs.find((tr) => tr?.receiver?.track?.kind === "audio" || tr?.sender?.track?.kind === "audio") || null;
      return tr0?.sender || null;
    } catch {
      return null;
    }
  };

  const preferredTr = pickPreferredAudioTransceiver(pc);
  const sender0 = preferredTr?.sender || findAudioSender();
  const prevSenderTrackId = sender0?.track?.id || undefined;
  const localMicTrackId = inviter?.__desktopMicTrackId || st?.__desktopMicTrackId || undefined;
  const localMicStreamId = stream?.id || undefined;
  const localStreamAudioTrackId = desiredTrack?.id || undefined;

  try {
    sendCallMediaEvent({
      type: "desktop-audio-sender-mutation",
      ...base,
      checkpoint: `${checkpoint}:force-audio-sender-before`,
      reason: "forceDesktopOutboundAudioSenderToLocalStreamTrack",
      previousSenderTrackId: prevSenderTrackId,
      senderTrackId: prevSenderTrackId,
      localMicTrackId,
      localMicStreamId,
      localStreamAudioTrackId,
      senderTrackIsSameObjectAsLocalStreamAudioTrack: !!(sender0?.track && desiredTrack && sender0.track === desiredTrack),
      senderTrackIdMatchesLocalStreamAudioTrackId: !!(sender0?.track?.id && localStreamAudioTrackId && sender0.track.id === localStreamAudioTrackId),
      pcSignalingState: pc?.signalingState || undefined,
      msg: "Desktop outbound: ensuring audio sender uses local stream audio track",
    });
  } catch {}

  try {
    if (sender0) {
      if (sender0.track !== desiredTrack) {
        await sender0.replaceTrack(desiredTrack);
      }
    } else {
      pc.addTrack(desiredTrack, stream);
    }
  } catch {}

  try {
    try {
      desiredTrack.enabled = true;
    } catch {}
  } catch {}

  const sender1 = findAudioSender();
  const senderTrackId1 = sender1?.track?.id || undefined;
  try {
    sendCallMediaEvent({
      type: "desktop-audio-sender-mutation",
      ...base,
      checkpoint: `${checkpoint}:force-audio-sender-after`,
      reason: "forceDesktopOutboundAudioSenderToLocalStreamTrack",
      previousSenderTrackId: prevSenderTrackId,
      senderTrackId: senderTrackId1,
      localMicTrackId,
      localMicStreamId,
      localStreamAudioTrackId,
      sameAsLocalMicTrack: !!(senderTrackId1 && localMicTrackId && senderTrackId1 === localMicTrackId),
      senderTrackIsSameObjectAsLocalStreamAudioTrack: !!(sender1?.track && desiredTrack && sender1.track === desiredTrack),
      senderTrackIdMatchesLocalStreamAudioTrackId: !!(senderTrackId1 && localStreamAudioTrackId && senderTrackId1 === localStreamAudioTrackId),
      pcSignalingState: pc?.signalingState || undefined,
      msg: "Desktop outbound: audio sender track forced to local stream audio track (if needed)",
    });
  } catch {}
}
