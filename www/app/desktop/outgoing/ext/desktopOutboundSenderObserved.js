import { sendCallMediaEvent } from "../../../features/callMediaLog.js";

import { buildDesktopOutboundSenderBaseContext } from "./desktopOutboundSenderBase.js";
import { snapshotDesktopOutboundSenderAndCodec } from "./desktopOutboundSenderSnapshotCore.js";

export function emitDesktopOutboundSenderObserved(inviter, st, peer, checkpoint) {
  try {
    const snap = snapshotDesktopOutboundSenderAndCodec(inviter);
    const prev = inviter?.__desktopLastObservedSenderTrackId || null;
    inviter.__desktopLastObservedSenderTrackId = snap.senderTrackId || null;

    const base = buildDesktopOutboundSenderBaseContext({ inviter, st, peer, checkpoint });

    sendCallMediaEvent({
      type: "desktop-sender-track-observed",
      ...base,
      senderTrackId: snap.senderTrackId || undefined,
      senderTrackReadyState: snap.senderTrackReadyState || undefined,
      senderTrackEnabled: (typeof snap.senderTrackEnabled === "boolean") ? snap.senderTrackEnabled : undefined,
      senderTrackMuted: (typeof snap.senderTrackMuted === "boolean") ? snap.senderTrackMuted : undefined,
      senderStreamIds: snap.senderStreamIds,
      localMicTrackId: snap.localMicTrackId || undefined,
      localMicStreamId: snap.localMicStreamId || undefined,
      sameAsLocalMicTrack: snap.sameAsLocalMicTrack,
      pcSignalingState: snap.pcSignalingState || undefined,
      msg: "Desktop sender audio track observed",
    });

    try {
      const localMicTrackId = snap.localMicTrackId || null;
      const senderTrackId = snap.senderTrackId || null;
      const mismatch = !!(localMicTrackId && senderTrackId && localMicTrackId !== senderTrackId);
      if (mismatch && !inviter?.__desktopFirstSenderMismatchEmitted) {
        inviter.__desktopFirstSenderMismatchEmitted = true;
        const stackTop = (() => {
          try {
            const s = (new Error("sender-mismatch")).stack || "";
            const line = String(s).split("\n").slice(0, 3).join(" | ");
            return line.slice(0, 256);
          } catch {
            return undefined;
          }
        })();
        sendCallMediaEvent({
          type: "desktop-sender-mismatch-first-seen",
          ...base,
          localMicTrackId: localMicTrackId || undefined,
          localMicStreamId: snap.localMicStreamId || undefined,
          senderTrackId: senderTrackId || undefined,
          senderTrackReadyState: snap.senderTrackReadyState || undefined,
          senderTrackEnabled: (typeof snap.senderTrackEnabled === "boolean") ? snap.senderTrackEnabled : undefined,
          senderTrackMuted: (typeof snap.senderTrackMuted === "boolean") ? snap.senderTrackMuted : undefined,
          senderStreamIds: snap.senderStreamIds,
          sameAsLocalMicTrack: snap.sameAsLocalMicTrack,
          pcSignalingState: snap.pcSignalingState || undefined,
          stackTop,
          msg: "Sender track id differs from acquired local mic track id (first seen)",
        });
      }
    } catch {}

    if (prev && snap.senderTrackId && prev !== snap.senderTrackId) {
      sendCallMediaEvent({
        type: "desktop-sender-track-changed",
        ...base,
        previousSenderTrackId: prev,
        senderTrackId: snap.senderTrackId,
        localMicTrackId: snap.localMicTrackId || undefined,
        localMicStreamId: snap.localMicStreamId || undefined,
        sameAsLocalMicTrack: snap.sameAsLocalMicTrack,
        pcSignalingState: snap.pcSignalingState || undefined,
        senderTrackReadyState: snap.senderTrackReadyState || undefined,
        senderTrackEnabled: (typeof snap.senderTrackEnabled === "boolean") ? snap.senderTrackEnabled : undefined,
        senderTrackMuted: (typeof snap.senderTrackMuted === "boolean") ? snap.senderTrackMuted : undefined,
        senderStreamIds: snap.senderStreamIds,
        msg: "Desktop sender audio track changed",
      });
    }

    if (snap.outboundCodec && snap.outboundCodec.outboundCodecMimeType) {
      const key = `${snap.outboundCodec.outboundCodecMimeType}|${snap.outboundCodec.outboundCodecPayloadType}|${snap.outboundCodec.outboundCodecClockRate}|${snap.outboundCodec.outboundCodecChannels}`;
      if (inviter?.__desktopLastObservedOutboundCodecKey !== key) {
        inviter.__desktopLastObservedOutboundCodecKey = key;
        sendCallMediaEvent({
          type: "desktop-outbound-codec-observed",
          ...base,
          ...snap.outboundCodec,
          msg: "Desktop outbound codec observed",
        });
      }
    }
  } catch {}
}
