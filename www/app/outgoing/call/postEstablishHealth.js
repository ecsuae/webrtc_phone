export async function readPostEstablishReceiveHealth(pc, audioEl) {
  try {
    const out = {
      packetsReceived: undefined,
      bytesReceived: undefined,
      packetsSent: undefined,
      bytesSent: undefined,
      selectedPair: undefined,
      localCandidateType: undefined,
      remoteCandidateType: undefined,
      dtlsState: undefined,
    };

    if (pc) {
      try {
        out.iceConnectionState = pc.iceConnectionState;
        out.connectionState = pc.connectionState;
      } catch {}

      try {
        const stats = await pc.getStats();
        let selectedPair = null;
        let localCand = null;
        let remoteCand = null;

        stats.forEach((r) => {
          if (r.type === 'inbound-rtp' && r.kind === 'audio') {
            if (typeof r.packetsReceived === 'number') out.packetsReceived = (out.packetsReceived || 0) + r.packetsReceived;
            if (typeof r.bytesReceived === 'number') out.bytesReceived = (out.bytesReceived || 0) + r.bytesReceived;
          }
          if (r.type === 'outbound-rtp' && r.kind === 'audio') {
            if (typeof r.packetsSent === 'number') out.packetsSent = (out.packetsSent || 0) + r.packetsSent;
            if (typeof r.bytesSent === 'number') out.bytesSent = (out.bytesSent || 0) + r.bytesSent;
          }
          if (r.type === 'transport') {
            if (r.dtlsState) out.dtlsState = r.dtlsState;
            if (r.selectedCandidatePairId) selectedPair = stats.get(r.selectedCandidatePairId);
          }
        });

        if (!selectedPair) {
          stats.forEach((r) => {
            if (r.type === 'candidate-pair' && (r.selected === true || r.nominated === true)) selectedPair = r;
          });
        }

        if (selectedPair) {
          localCand = selectedPair.localCandidateId ? stats.get(selectedPair.localCandidateId) : null;
          remoteCand = selectedPair.remoteCandidateId ? stats.get(selectedPair.remoteCandidateId) : null;
        }

        if (selectedPair) {
          const lp = localCand
            ? `${localCand.candidateType || '?'} ${localCand.address || localCand.ip || '?'}:${localCand.port || '?'}`
            : 'unknown';
          const rp = remoteCand
            ? `${remoteCand.candidateType || '?'} ${remoteCand.address || remoteCand.ip || '?'}:${remoteCand.port || '?'}`
            : 'unknown';
          out.selectedPair = `local=${lp} remote=${rp}`;
          out.localCandidateType = localCand?.candidateType;
          out.remoteCandidateType = remoteCand?.candidateType;
        }
      } catch {}
    }

    try {
      out.remoteAudioElementPaused = typeof audioEl?.paused === 'boolean' ? audioEl.paused : undefined;
      out.remoteAudioElementMuted = typeof audioEl?.muted === 'boolean' ? audioEl.muted : undefined;
      out.remoteAudioElementVolume = typeof audioEl?.volume === 'number' ? audioEl.volume : undefined;
      out.remoteAudioTracks = (() => {
        try {
          const receivers = typeof pc?.getReceivers === 'function' ? pc.getReceivers() : [];
          const tracks = (receivers || []).map((r) => r && r.track).filter((t) => t && t.kind === 'audio');
          return tracks.length;
        } catch {
          return undefined;
        }
      })();
    } catch {}

    return out;
  } catch {
    return {};
  }
}
