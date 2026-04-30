function snapTrack(track) {
  try {
    return {
      id: track?.id || null,
      kind: track?.kind || null,
      enabled: typeof track?.enabled === "boolean" ? track.enabled : null,
      muted: typeof track?.muted === "boolean" ? track.muted : null,
      readyState: track?.readyState || null,
    };
  } catch {
    return { id: null, kind: null, enabled: null, muted: null, readyState: null };
  }
}

function pickAudioTransceiver(pc) {
  try {
    const trs = pc?.getTransceivers?.() || [];
    const audio = trs.filter((t) => t?.receiver?.track?.kind === "audio" || t?.sender?.track?.kind === "audio");
    return audio.find((t) => String(t?.mid || "") === "0") || audio[0] || null;
  } catch {
    return null;
  }
}

export async function getDesktopIceAndRtpStats(pc) {
  const out = {
    selectedCandidatePair: null,
    localCandidate: null,
    remoteCandidate: null,
    outboundAudio: null,
    inboundAudio: null,
  };

  if (!pc?.getStats) return out;

  try {
    const stats = await pc.getStats();
    const byId = new Map();
    stats.forEach((r) => {
      if (r?.id) byId.set(r.id, r);
    });

    let selectedPair = null;
    stats.forEach((r) => {
      if (r?.type === "transport" && r.selectedCandidatePairId) {
        const cp = byId.get(r.selectedCandidatePairId);
        if (cp) selectedPair = cp;
      }
    });

    if (!selectedPair) {
      stats.forEach((r) => {
        if (r?.type === "candidate-pair" && (r.selected === true || r.nominated === true) && r.state === "succeeded") {
          selectedPair = r;
        }
      });
    }

    if (selectedPair) {
      out.selectedCandidatePair = {
        id: selectedPair.id,
        state: selectedPair.state || null,
        nominated: selectedPair.nominated ?? null,
        selected: selectedPair.selected ?? null,
        currentRoundTripTime: selectedPair.currentRoundTripTime ?? null,
        totalRoundTripTime: selectedPair.totalRoundTripTime ?? null,
        availableOutgoingBitrate: selectedPair.availableOutgoingBitrate ?? null,
        bytesSent: selectedPair.bytesSent ?? null,
        bytesReceived: selectedPair.bytesReceived ?? null,
        localCandidateId: selectedPair.localCandidateId || null,
        remoteCandidateId: selectedPair.remoteCandidateId || null,
      };

      const lc = byId.get(selectedPair.localCandidateId);
      const rc = byId.get(selectedPair.remoteCandidateId);
      if (lc) {
        out.localCandidate = {
          id: lc.id,
          candidateType: lc.candidateType || null,
          protocol: lc.protocol || null,
          ip: lc.ip || lc.address || null,
          port: lc.port || null,
          networkType: lc.networkType || null,
        };
      }
      if (rc) {
        out.remoteCandidate = {
          id: rc.id,
          candidateType: rc.candidateType || null,
          protocol: rc.protocol || null,
          ip: rc.ip || rc.address || null,
          port: rc.port || null,
        };
      }
    }

    stats.forEach((r) => {
      if (r?.type === "outbound-rtp" && (r.kind === "audio" || r.mediaType === "audio")) {
        out.outboundAudio = {
          id: r.id,
          bytesSent: r.bytesSent ?? null,
          packetsSent: r.packetsSent ?? null,
          retransmittedPacketsSent: r.retransmittedPacketsSent ?? null,
          nackCount: r.nackCount ?? null,
          pliCount: r.pliCount ?? null,
          roundTripTime: r.roundTripTime ?? null,
          totalRoundTripTime: r.totalRoundTripTime ?? null,
          codecId: r.codecId || null,
        };
      }
      if (r?.type === "inbound-rtp" && (r.kind === "audio" || r.mediaType === "audio")) {
        out.inboundAudio = {
          id: r.id,
          bytesReceived: r.bytesReceived ?? null,
          packetsReceived: r.packetsReceived ?? null,
          packetsLost: r.packetsLost ?? null,
          jitter: r.jitter ?? null,
          codecId: r.codecId || null,
        };
      }
    });
  } catch {}

  return out;
}

export function snapDesktopSipDialog(session) {
  try {
    const callId = session?.outgoingRequestMessage?.callId || session?.request?.callId || session?.id || null;
    const localTag = session?.outgoingRequestMessage?.fromTag || session?.request?.fromTag || null;
    const remoteTag = session?.dialog?.id?.remoteTag || session?.dialog?.remoteTag || null;
    const dialogId = session?.dialog?.id ? JSON.stringify(session.dialog.id) : null;
    return { callId, localTag, remoteTag, dialogId };
  } catch {
    return { callId: null, localTag: null, remoteTag: null, dialogId: null };
  }
}

export function snapDesktopAudioTransceiver(pc) {
  const tr = pickAudioTransceiver(pc);
  try {
    return {
      mid: tr?.mid ?? null,
      direction: tr?.direction ?? null,
      currentDirection: tr?.currentDirection ?? null,
      senderTrack: snapTrack(tr?.sender?.track || null),
      receiverTrack: snapTrack(tr?.receiver?.track || null),
    };
  } catch {
    return { mid: null, direction: null, currentDirection: null, senderTrack: snapTrack(null), receiverTrack: snapTrack(null) };
  }
}
