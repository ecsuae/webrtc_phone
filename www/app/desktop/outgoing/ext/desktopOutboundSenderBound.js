import { sendCallMediaEvent } from "../../../features/callMediaLog.js";
import { getLocalStream } from "../../../media.js";

import { buildDesktopOutboundSenderBaseContext } from "./desktopOutboundSenderBase.js";
import { snapshotDesktopOutboundSenderAndCodec } from "./desktopOutboundSenderSnapshotCore.js";

export function emitDesktopAudioSenderBound(inviter, st, peer, { reason = "first-audio-sender-bind" } = {}) {
  try {
    const snap = snapshotDesktopOutboundSenderAndCodec(inviter);
    const pc = snap.pc;

    let transceiverMid = null;
    let senderHasTrack = null;
    let senderKind = null;
    let transceiverDirection = null;
    let transceiverCurrentDirection = null;
    try {
      const trs = pc?.getTransceivers?.() || [];
      const t = trs.find((tr) => tr?.sender?.track?.kind === "audio" || tr?.receiver?.track?.kind === "audio") || null;
      transceiverMid = (t && (typeof t.mid === "string" || typeof t.mid === "number")) ? String(t.mid) : null;
      senderHasTrack = !!t?.sender?.track;
      senderKind = t?.sender?.track?.kind || null;
      transceiverDirection = t?.direction ?? null;
      transceiverCurrentDirection = t?.currentDirection ?? null;
    } catch {}

    const stream = getLocalStream() || null;
    const localStreamAudioTrack = (() => {
      try {
        return stream?.getAudioTracks?.()?.[0] || null;
      } catch {
        return null;
      }
    })();
    const localStreamTrackIds = (() => {
      try {
        return (stream?.getTracks?.() || []).map((t) => t?.id || null).filter(Boolean);
      } catch {
        return undefined;
      }
    })();
    const localStreamTrackCount = Array.isArray(localStreamTrackIds) ? localStreamTrackIds.length : undefined;

    const senderTrackIsSameObjectAsLocalStreamAudioTrack = (() => {
      try {
        if (!localStreamAudioTrack) return null;
        const pc0 = inviter?.sessionDescriptionHandler?.peerConnection || null;
        const senders = pc0?.getSenders?.() || [];
        const a = senders.find((sd) => sd?.track?.kind === "audio") || null;
        if (!a?.track) return null;
        return a.track === localStreamAudioTrack;
      } catch {
        return null;
      }
    })();

    const senderTrackIdMatchesLocalStreamAudioTrackId = (() => {
      try {
        const sid = snap.senderTrackId || null;
        const lid = localStreamAudioTrack?.id || null;
        if (!sid || !lid) return null;
        return sid === lid;
      } catch {
        return null;
      }
    })();

    sendCallMediaEvent({
      type: "desktop-audio-sender-bound",
      ...buildDesktopOutboundSenderBaseContext({ inviter, st, peer, checkpoint: "first-audio-sender-bind" }),
      reason,
      localMicTrackId: snap.localMicTrackId || undefined,
      localMicStreamId: snap.localMicStreamId || undefined,
      localStreamAudioTrackId: localStreamAudioTrack?.id || null,
      localStreamTrackIds,
      localStreamTrackCount,
      senderTrackId: snap.senderTrackId || undefined,
      senderTrackReadyState: snap.senderTrackReadyState || undefined,
      senderTrackEnabled: (typeof snap.senderTrackEnabled === "boolean") ? snap.senderTrackEnabled : undefined,
      senderTrackMuted: (typeof snap.senderTrackMuted === "boolean") ? snap.senderTrackMuted : undefined,
      senderStreamIds: snap.senderStreamIds,
      sameAsLocalMicTrack: snap.sameAsLocalMicTrack,
      senderTrackIsSameObjectAsLocalStreamAudioTrack: (typeof senderTrackIsSameObjectAsLocalStreamAudioTrack === "boolean") ? senderTrackIsSameObjectAsLocalStreamAudioTrack : undefined,
      senderTrackIdMatchesLocalStreamAudioTrackId: (typeof senderTrackIdMatchesLocalStreamAudioTrackId === "boolean") ? senderTrackIdMatchesLocalStreamAudioTrackId : undefined,
      pcSignalingState: snap.pcSignalingState || undefined,
      transceiverMid: transceiverMid || (snap.outboundCodec?.transceiverMid || undefined),
      senderHasTrack: (typeof senderHasTrack === "boolean") ? senderHasTrack : undefined,
      senderKind: senderKind || undefined,
      transceiverDirection: transceiverDirection || undefined,
      transceiverCurrentDirection: transceiverCurrentDirection || undefined,
      msg: "Desktop audio sender bound",
    });
  } catch {}
}
