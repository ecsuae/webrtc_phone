import { nowISO, logLine } from "../desktopLogging.js";

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

async function getIceAndRtpStats(pc) {
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

function snapSipDialog(session) {
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

function snapTransceiver(pc) {
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

export function initDesktopTerminationDiagnostics(SIP, session, ui, meta = {}) {
  try {
    if (!session || session.__desktopTermDiagInit) return session?.__desktopTermDiagApi || null;
    session.__desktopTermDiagInit = true;
  } catch {}

  const state = {
    createdAt: nowISO(),
    meta,
    snapshots: [],
    lastError: null,
  };

  async function capture(label, extra = {}) {
    const pc = session?.sessionDescriptionHandler?.peerConnection || null;
    const sip = snapSipDialog(session);
    const transceiver = pc ? snapTransceiver(pc) : null;
    const stats = pc ? await getIceAndRtpStats(pc) : null;

    const uplinkHistory = (() => {
      try {
        const h = session.__desktopUplinkDiagHistory;
        return Array.isArray(h) ? h.slice(-6) : null;
      } catch {
        return null;
      }
    })();

    const snap = {
      ts: nowISO(),
      label,
      sessionState: (() => {
        try {
          return session?.state || null;
        } catch {
          return null;
        }
      })(),
      sip,
      transceiver,
      stats,
      uplinkHistory,
      extra,
    };

    try {
      state.snapshots.push(snap);
      session.__desktopTermDiagState = state;
    } catch {}

    try {
      const bye = extra?.bye;
      const byeLine = bye
        ? ` bye.reason=${bye.reason || ""} bye.status=${bye.statusCode || ""} bye.bodyLen=${String(bye.body || "").length}`
        : "";
      const cp = stats?.selectedCandidatePair;
      const outPk = stats?.outboundAudio?.packetsSent;
      const outBy = stats?.outboundAudio?.bytesSent;
      const inPk = stats?.inboundAudio?.packetsReceived;
      const tr = transceiver;
      logLine(
        `[${nowISO()}] [desktop:term-diag] ${label} callId=${sip.callId || "?"} state=${snap.sessionState || "?"} tr.mid=${tr?.mid || "?"} tr.dir=${tr?.direction || "?"} tr.cur=${tr?.currentDirection || "?"} outPk=${outPk ?? "?"} outBy=${outBy ?? "?"} inPk=${inPk ?? "?"} ice=${cp?.state || "?"}${byeLine}`
      );
    } catch {}

    return snap;
  }

  function captureSync(label, extra = {}) {
    void capture(label, extra);
  }

  function onRemoteBye(messageOrReq) {
    const bye = (() => {
      try {
        const msg = messageOrReq?.message || messageOrReq;
        const reason = msg?.getHeader?.("Reason") || msg?.headers?.Reason?.[0]?.raw || null;
        return {
          reason,
          statusCode: msg?.statusCode || msg?.status || null,
          body: msg?.body || null,
        };
      } catch {
        return { reason: null, statusCode: null, body: null };
      }
    })();

    captureSync("remote-bye", { bye });
  }

  try {
    session.stateChange?.addListener?.((s) => {
      if (s === SIP?.SessionState?.Established) captureSync("established");
      if (s === SIP?.SessionState?.Terminated) captureSync("terminated");
    });
  } catch {}

  const api = { capture, captureSync, onRemoteBye, state };
  try {
    session.__desktopTermDiagApi = api;
  } catch {}

  return api;
}

export function getDesktopTerminationDiagState(session) {
  try {
    return session?.__desktopTermDiagState || null;
  } catch {
    return null;
  }
}
