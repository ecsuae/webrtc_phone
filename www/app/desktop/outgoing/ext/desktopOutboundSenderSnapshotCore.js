import { getLocalStream } from "../../../media.js";

export function snapshotDesktopOutboundSenderAndCodec(inviter) {
  const pc = inviter?.sessionDescriptionHandler?.peerConnection || null;
  const stream = getLocalStream() || null;

  const localMicTrackId = inviter?.__desktopMicTrackId || null;
  const localMicStreamId = stream?.id || null;

  let senderTrack = null;
  let sender = null;
  try {
    const senders = pc?.getSenders?.() || [];
    sender = senders.find((sd) => sd?.track?.kind === "audio") || null;
    senderTrack = sender?.track || null;
  } catch {}

  const senderTrackId = senderTrack?.id || null;
  const senderTrackReadyState = senderTrack?.readyState || null;
  const senderTrackEnabled = (typeof senderTrack?.enabled === "boolean") ? senderTrack.enabled : null;
  const senderTrackMuted = (typeof senderTrack?.muted === "boolean") ? senderTrack.muted : null;
  const senderStreamIds = (() => {
    try {
      const ss = sender?.getStreams?.() || [];
      return ss.map((s) => s?.id || null).filter(Boolean);
    } catch {
      return undefined;
    }
  })();

  const pcSignalingState = pc?.signalingState || null;
  const sameAsLocalMicTrack = !!(senderTrackId && localMicTrackId && senderTrackId === localMicTrackId);

  const outboundCodec = (() => {
    try {
      const trs = pc?.getTransceivers?.() || [];
      const t = trs.find((tr) => tr?.sender?.track?.kind === "audio") || null;
      const transceiverMid = (t && (typeof t.mid === "string" || typeof t.mid === "number")) ? String(t.mid) : null;
      const codecs = t?.sender?.getParameters?.()?.codecs || [];
      const c0 = Array.isArray(codecs) ? codecs[0] : null;
      if (!c0) return null;
      return {
        transceiverMid,
        outboundCodecMimeType: c0.mimeType || null,
        outboundCodecPayloadType: (typeof c0.payloadType === "number") ? c0.payloadType : null,
        outboundCodecClockRate: (typeof c0.clockRate === "number") ? c0.clockRate : null,
        outboundCodecChannels: (typeof c0.channels === "number") ? c0.channels : null,
      };
    } catch {
      return null;
    }
  })();

  return {
    pc,
    localMicTrackId,
    localMicStreamId,
    senderTrackId,
    senderTrackReadyState,
    senderTrackEnabled,
    senderTrackMuted,
    senderStreamIds,
    sameAsLocalMicTrack,
    pcSignalingState,
    outboundCodec,
  };
}
