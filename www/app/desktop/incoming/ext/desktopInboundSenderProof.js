import { sendCallMediaEvent } from "../../../features/callMediaLog.js";
import { getLocalStream } from "../../../media.js";
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
function findAudioSender(pc) {
  try {
    const senders = pc?.getSenders?.() || [];
    const s0 = senders.find((sd) => sd?.track?.kind === "audio") || null;
    if (s0) return s0;
    const tr0 = pickPreferredAudioTransceiver(pc);
    return tr0?.sender || null;
  } catch {
    return null;
  }
}
async function readOutboundAudioSenderStats(pc) {
  try {
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

    return {
      outboundAudioPacketsSent: outPk,
      outboundAudioBytesSent: outBy,
      outboundAudioLevel: outAudioLevel,
      outboundTotalAudioEnergy: outTotalAudioEnergy,
    };
  } catch {
    return { outboundAudioPacketsSent: null, outboundAudioBytesSent: null, outboundAudioLevel: null, outboundTotalAudioEnergy: null };
  }
}

export async function forceDesktopInboundAudioSenderToLocalStreamTrack(invitation, ctx, checkpoint = "post-established") {
  try {
    const pc = invitation?.sessionDescriptionHandler?.peerConnection || null;
    if (!pc) return;

    const mark = `__desktopInboundForcedAudioSenderToLocalStreamTrackAt_${checkpoint}`;
    if (pc[mark]) return;
    pc[mark] = true;

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
    const preferredTr = pickPreferredAudioTransceiver(pc);
    const sender0 = preferredTr?.sender || findAudioSender(pc);
    const prevSenderTrackId = sender0?.track?.id || undefined;
    const localMicTrackId = invitation?.__desktopMicTrackId || undefined;
    const localMicStreamId = invitation?.__desktopMicStreamId || stream?.id || undefined;

    try {
      sendCallMediaEvent({
        type: "desktop-audio-sender-mutation",
        ...ctx,
        dir: "inbound",
        checkpoint: `${checkpoint}:force-audio-sender-before`,
        reason: "forceDesktopInboundAudioSenderToLocalStreamTrack",
        previousSenderTrackId: prevSenderTrackId,
        senderTrackId: prevSenderTrackId,
        localMicTrackId,
        localMicStreamId,
        localStreamAudioTrackId: desiredTrack?.id || undefined,
        senderTrackIsSameObjectAsLocalStreamAudioTrack: !!(sender0?.track && desiredTrack && sender0.track === desiredTrack),
        senderTrackIdMatchesLocalStreamAudioTrackId: !!(sender0?.track?.id && desiredTrack?.id && sender0.track.id === desiredTrack.id),
        pcSignalingState: pc?.signalingState || undefined,
        msg: "Desktop inbound: ensuring audio sender uses local stream audio track",
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
      desiredTrack.enabled = true;
    } catch {}

    const sender1 = findAudioSender(pc);
    const senderTrackId1 = sender1?.track?.id || undefined;

    try {
      sendCallMediaEvent({
        type: "desktop-audio-sender-mutation",
        ...ctx,
        dir: "inbound",
        checkpoint: `${checkpoint}:force-audio-sender-after`,
        reason: "forceDesktopInboundAudioSenderToLocalStreamTrack",
        previousSenderTrackId: prevSenderTrackId,
        senderTrackId: senderTrackId1,
        localMicTrackId,
        localMicStreamId,
        localStreamAudioTrackId: desiredTrack?.id || undefined,
        sameAsLocalMicTrack: !!(senderTrackId1 && localMicTrackId && senderTrackId1 === localMicTrackId),
        senderTrackIsSameObjectAsLocalStreamAudioTrack: !!(sender1?.track && desiredTrack && sender1.track === desiredTrack),
        senderTrackIdMatchesLocalStreamAudioTrackId: !!(senderTrackId1 && desiredTrack?.id && senderTrackId1 === desiredTrack.id),
        pcSignalingState: pc?.signalingState || undefined,
        msg: "Desktop inbound: audio sender track forced to local stream audio track (if needed)",
      });
    } catch {}
  } catch {}
}

export async function emitDesktopInboundAudioProof(invitation, ctx, { checkpoint } = {}) {
  try {
    const pc = invitation?.sessionDescriptionHandler?.peerConnection || null;
    if (!pc) return;

    const localStream = (() => {
      try {
        return getLocalStream() || null;
      } catch {
        return null;
      }
    })();

    const sender = findAudioSender(pc);
    const senderTrack = sender?.track || null;

    const tr = pickPreferredAudioTransceiver(pc);

    const stats = await readOutboundAudioSenderStats(pc);
    const acquiredLocalMicTrackId = invitation?.__desktopMicTrackId || undefined;
    const acquiredLocalMicStreamId = invitation?.__desktopMicStreamId || localStream?.id || undefined;

    sendCallMediaEvent({
      type: "desktop-inbound-audio-proof",
      ...ctx,
      dir: "inbound",
      checkpoint: checkpoint || "post-established-2p5s",
      acquiredLocalMicTrackId,
      acquiredLocalMicStreamId,
      actualSenderTrackId: senderTrack?.id || undefined,
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
      senderTrackIdMatchesAcquiredLocalMicTrackId: !!(senderTrack?.id && acquiredLocalMicTrackId && senderTrack.id === acquiredLocalMicTrackId),
      transceiverMid: (tr && (typeof tr.mid === "string" || typeof tr.mid === "number")) ? String(tr.mid) : undefined,
      transceiverDirection: (typeof tr?.direction === "string") ? tr.direction : undefined,
      transceiverCurrentDirection: (typeof tr?.currentDirection === "string") ? tr.currentDirection : undefined,
      ...stats,
      pcSignalingState: pc?.signalingState || undefined,
      pcConnectionState: pc?.connectionState || undefined,
      msg: "Desktop inbound audio proof (post-established)",
    });
  } catch {}
}
