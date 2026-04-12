import { sendCallMediaEvent } from "../../features/callMediaLog.js";
import { getLocalStream } from "../../media.js";

function buildBaseContext({ inviter, st, peer, checkpoint }) {
  return {
    username: st?.account?.rawUsername || st?.account?.username || undefined,
    domain: st?.account?.domain || undefined,
    aor: (() => {
      try {
        const u = st?.account?.rawUsername || st?.account?.username || undefined;
        const d = st?.account?.domain || undefined;
        return (u && d) ? `${u}@${d}` : undefined;
      } catch {
        return undefined;
      }
    })(),
    dir: "outbound",
    peer: peer || undefined,
    corrId: inviter?.__webrtcCorrId || st?.__webrtcCorrId || undefined,
    callId: inviter?.outgoingRequestMessage?.callId || undefined,
    sessionId: inviter?.id || inviter?._id || undefined,
    selectedProfile: st?.selectedProfile || undefined,
    icePolicy: (st?.selectedProfile === "lte") ? "relay" : "all",
    lteMode: st?.selectedProfile === "lte",
    mode: (st?.selectedProfile === "lte") ? "lte" : "wifi",
    checkpoint,
  };
}

function snapshotSenderAndCodec(inviter) {
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

export function emitDesktopOutboundSenderObserved(inviter, st, peer, checkpoint) {
  try {
    const snap = snapshotSenderAndCodec(inviter);
    const prev = inviter?.__desktopLastObservedSenderTrackId || null;
    inviter.__desktopLastObservedSenderTrackId = snap.senderTrackId || null;

    const base = buildBaseContext({ inviter, st, peer, checkpoint });

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

function getStackTop(label) {
  try {
    const s = (new Error(label)).stack || "";
    return String(s).split("\n").slice(0, 4).join(" | ").slice(0, 256);
  } catch {
    return undefined;
  }
}

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

function parseSdpAudioSummary(sdp) {
  try {
    if (!sdp || typeof sdp !== "string") return [];
    const lines = sdp.split(/\r?\n/);
    const out = [];
    let cur = null;
    for (const ln of lines) {
      if (!ln) continue;
      if (ln.startsWith("m=")) {
        if (cur) out.push(cur);
        cur = null;
        if (ln.startsWith("m=audio")) {
          cur = { mLine: ln, mid: null, direction: null, msid: null };
        }
        continue;
      }
      if (!cur) continue;
      if (ln.startsWith("a=mid:")) cur.mid = ln.slice("a=mid:".length) || null;
      else if (ln === "a=sendrecv" || ln === "a=sendonly" || ln === "a=recvonly" || ln === "a=inactive") cur.direction = ln.slice(2);
      else if (ln.startsWith("a=msid:")) cur.msid = ln.slice("a=msid:".length) || null;
    }
    if (cur) out.push(cur);
    return out.slice(0, 4);
  } catch {
    return [];
  }
}

export async function emitDesktopNegotiatedAudioSnapshot(inviter, st, peer, pc, checkpoint, opts = {}) {
  const includeSdp = !!opts?.includeSdp;
  const base = buildBaseContext({ inviter, st, peer, checkpoint });

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
      const localAudio = parseSdpAudioSummary(localSdp);
      const remoteAudio = parseSdpAudioSummary(remoteSdp);

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

  const base = buildBaseContext({ inviter, st, peer, checkpoint });

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

function snapshotAudioSenderTrackId(pc) {
  try {
    const senders = pc?.getSenders?.() || [];
    const a = senders.find((sd) => sd?.track?.kind === "audio") || null;
    return a?.track?.id || null;
  } catch {
    return null;
  }
}

export function installDesktopOutboundSenderMutationHooks(inviter, st, peer, pc) {
  try {
    if (!pc || pc.__desktopSenderMutationHooksInstalled) return;
    pc.__desktopSenderMutationHooksInstalled = true;
  } catch {
    return;
  }

  const base0 = () => buildBaseContext({ inviter, st, peer, checkpoint: "sender-mutation-hook" });

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
            stackTop: getStackTop("pc.addTrack"),
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
            stackTop: getStackTop("pc.addTrack"),
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
            stackTop: getStackTop("pc.addTransceiver"),
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
            stackTop: getStackTop("pc.addTransceiver"),
            msg: "pc.addTransceiver() returned",
          });
        } catch {}
        try {
          const sd = r?.sender;
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
                  stackTop: getStackTop("sender.replaceTrack"),
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
                  stackTop: getStackTop("sender.replaceTrack"),
                  msg: "sender.replaceTrack() resolved",
                });
              } catch {}
              return rr;
            };
          }
        } catch {}
        return r;
      };
    }
  } catch {}

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
            stackTop: getStackTop("pc.setLocalDescription"),
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
            stackTop: getStackTop("pc.setLocalDescription"),
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
            stackTop: getStackTop("pc.setRemoteDescription"),
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

export function emitDesktopAudioSenderBound(inviter, st, peer, { reason = "first-audio-sender-bind" } = {}) {
  try {
    const snap = snapshotSenderAndCodec(inviter);
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
      ...buildBaseContext({ inviter, st, peer, checkpoint: "first-audio-sender-bind" }),
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
