import { sendCallMediaEvent } from "../../../features/callMediaLog.js";
import { getLocalStream } from "../../../media.js";

import { buildDesktopOutboundSenderBaseContext } from "./desktopOutboundSenderBase.js";
import { parseDesktopSdpAudioSummary } from "./desktopOutboundSdpAudioSummary.js";

export async function emitDesktopNegotiatedAudioSnapshot(inviter, st, peer, pc, checkpoint, opts = {}) {
  const includeSdp = !!opts?.includeSdp;
  const base = buildDesktopOutboundSenderBaseContext({ inviter, st, peer, checkpoint });

  const stream = (() => {
    try {
      return getLocalStream() || null;
    } catch {
      return null;
    }
  })();

  const localMicTrackId = inviter?.__desktopMicTrackId || st?.__desktopMicTrackId || undefined;
  const localMicStreamId = inviter?.__desktopMicStreamId || st?.__desktopMicStreamId || stream?.id || undefined;

  let outboundRtp = [];
  let statsById = null;
  try {
    const stats = await pc?.getStats?.();
    if (stats && typeof stats.forEach === "function") {
      statsById = {};
      stats.forEach((r) => {
        try {
          if (!r || typeof r.id !== "string") return;
          statsById[r.id] = r;
        } catch {}
      });
      stats.forEach((r) => {
        try {
          if (!r || r.type !== "outbound-rtp") return;
          if (r.kind !== "audio" && r.mediaType !== "audio") return;
          outboundRtp.push({
            mid: (typeof r.mid === "string" || typeof r.mid === "number") ? String(r.mid) : null,
            ssrc: (typeof r.ssrc === "number") ? r.ssrc : null,
            packetsSent: (typeof r.packetsSent === "number") ? r.packetsSent : null,
            bytesSent: (typeof r.bytesSent === "number") ? r.bytesSent : null,
            audioLevel: (typeof r.audioLevel === "number") ? r.audioLevel : null,
            totalAudioEnergy: (typeof r.totalAudioEnergy === "number") ? r.totalAudioEnergy : null,
            trackId: (typeof r.trackId === "string") ? r.trackId : null,
            senderId: (typeof r.senderId === "string") ? r.senderId : null,
            codecId: (typeof r.codecId === "string") ? r.codecId : null,
            transportId: (typeof r.transportId === "string") ? r.transportId : null,
          });
        } catch {}
      });
    }
  } catch {}

  const trs = (() => {
    try {
      return pc?.getTransceivers?.() || [];
    } catch {
      return [];
    }
  })();

  let audioIdx = 0;
  for (const tr of trs) {
    const isAudio = tr?.receiver?.track?.kind === "audio" || tr?.sender?.track?.kind === "audio";
    if (!isAudio) continue;
    audioIdx += 1;

    const mid = (tr && (typeof tr.mid === "string" || typeof tr.mid === "number")) ? String(tr.mid) : undefined;
    const direction = (typeof tr?.direction === "string") ? tr.direction : undefined;
    const currentDirection = (typeof tr?.currentDirection === "string") ? tr.currentDirection : undefined;
    const senderTrackId = tr?.sender?.track?.id || undefined;
    const receiverTrackId = tr?.receiver?.track?.id || undefined;
    const senderHasTrack = !!tr?.sender?.track;

    const byMid = mid ? outboundRtp.find((r) => r?.mid === mid) : null;
    const byTrackId = senderTrackId ? outboundRtp.find((r) => r?.trackId === senderTrackId) : null;
    const rtp = byTrackId || byMid || null;
    const isOutboundRtpProducer = !!rtp;

    const trackIdentifier = (() => {
      try {
        if (!rtp?.trackId || !statsById) return undefined;
        const tr = statsById[rtp.trackId];
        return (typeof tr?.trackIdentifier === "string") ? tr.trackIdentifier : undefined;
      } catch {
        return undefined;
      }
    })();

    const selectedCandidatePairId = (() => {
      try {
        if (!rtp?.transportId || !statsById) return undefined;
        const t = statsById[rtp.transportId];
        return (typeof t?.selectedCandidatePairId === "string") ? t.selectedCandidatePairId : undefined;
      } catch {
        return undefined;
      }
    })();

    try {
      sendCallMediaEvent({
        type: "desktop-audio-transceiver-snapshot",
        ...base,
        checkpoint,
        audioTransceiverIndex: audioIdx,
        transceiverMid: mid,
        transceiverDirection: direction,
        transceiverCurrentDirection: currentDirection,
        senderHasTrack,
        senderTrackId,
        receiverTrackId,
        localMicTrackId,
        localMicStreamId,
        pcSignalingState: pc?.signalingState || undefined,
        outboundRtpMid: rtp?.mid || undefined,
        outboundRtpSsrc: (typeof rtp?.ssrc === "number") ? rtp.ssrc : undefined,
        outboundRtpPacketsSent: (typeof rtp?.packetsSent === "number") ? rtp.packetsSent : undefined,
        outboundRtpBytesSent: (typeof rtp?.bytesSent === "number") ? rtp.bytesSent : undefined,
        outboundRtpAudioLevel: (typeof rtp?.audioLevel === "number") ? rtp.audioLevel : undefined,
        outboundRtpTotalAudioEnergy: (typeof rtp?.totalAudioEnergy === "number") ? rtp.totalAudioEnergy : undefined,
        outboundRtpTrackIdentifier: trackIdentifier,
        outboundRtpCodecId: rtp?.codecId || undefined,
        outboundRtpTransportId: rtp?.transportId || undefined,
        outboundRtpSelectedCandidatePairId: selectedCandidatePairId,
        isOutboundRtpProducer,
        msg: "Desktop outbound: audio transceiver snapshot",
      });
    } catch {}
  }

  if (includeSdp) {
    try {
      const localSdp = pc?.localDescription?.sdp || null;
      const remoteSdp = pc?.remoteDescription?.sdp || null;
      const localAudio = parseDesktopSdpAudioSummary(localSdp);
      const remoteAudio = parseDesktopSdpAudioSummary(remoteSdp);

      for (let i = 0; i < localAudio.length; i += 1) {
        const a = localAudio[i];
        sendCallMediaEvent({
          type: "desktop-sdp-audio-summary",
          ...base,
          checkpoint,
          sdpType: "local",
          sdpAudioMLineIndex: i,
          sdpAudioMLine: a?.mLine || undefined,
          sdpAudioMid: a?.mid || undefined,
          sdpAudioDirection: a?.direction || undefined,
          sdpAudioMsid: a?.msid || undefined,
          msg: "Desktop outbound: SDP audio summary",
        });
      }
      for (let i = 0; i < remoteAudio.length; i += 1) {
        const a = remoteAudio[i];
        sendCallMediaEvent({
          type: "desktop-sdp-audio-summary",
          ...base,
          checkpoint,
          sdpType: "remote",
          sdpAudioMLineIndex: i,
          sdpAudioMLine: a?.mLine || undefined,
          sdpAudioMid: a?.mid || undefined,
          sdpAudioDirection: a?.direction || undefined,
          sdpAudioMsid: a?.msid || undefined,
          msg: "Desktop outbound: SDP audio summary",
        });
      }
    } catch {}
  }
}
