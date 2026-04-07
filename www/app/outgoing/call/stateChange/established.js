import { nowISO } from "../../../config.js";
import { logLine } from "../../../log.js";
import { sendCallMediaEvent } from "../../../features/callMediaLog.js";
import { dualSessionManager } from "../../../features/dualSessionManager.js";
import { readAppAudioRouteDiagSnapshot } from "../../../ui/callControlAudioRoute.js";
import { stopRingbackTone } from "../../ringback.js";
import { loadPcStats } from "../statsImports.js";
import { startOutboundAudioOutputDiag, startOutboundRenderDiag } from "../audioOutputDiag.js";
import { getOutboundDiagContext } from "../diagContext.js";
import { readPostEstablishReceiveHealth } from "../postEstablishHealth.js";

function scheduleMediaStatsSnapshots(pc, label, diagCtx) {
  loadPcStats()
    .then((m) => {
      const fn = m?.scheduleMediaStatsSnapshots;
      if (typeof fn !== "function") return;
      fn(pc, label, diagCtx);
    })
    .catch(() => {});
}

export function handleOutboundEstablished(SIP, inviter, st, ui, { t_callStart, peer } = {}) {
  stopRingbackTone();
  if (window.callTimer) window.callTimer.start();

  try {
    const diag = readAppAudioRouteDiagSnapshot?.();
    sendCallMediaEvent({
      type: "app-audio-route-snapshot",
      ...getOutboundDiagContext(st, peer, inviter),
      dir: "outbound",
      trigger: "call-established",
      reason: "session-established",
      appAudioRouteMode: diag?.appAudioRouteMode || "unknown",
      appAudioRouteSource: diag?.appAudioRouteSource || "none",
      appAudioRouteDetail: diag?.appAudioRouteDetail || "none",
      speakerButtonActive: typeof diag?.speakerButtonActive === "boolean" ? diag.speakerButtonActive : false,
      earpieceButtonActive: typeof diag?.earpieceButtonActive === "boolean" ? diag.earpieceButtonActive : false,
      audioRouteStateAvailable: typeof diag?.audioRouteStateAvailable === "boolean" ? diag.audioRouteStateAvailable : false,
      audioRouteSnapshotTs: diag?.audioRouteSnapshotTs || undefined,
      audioRouteMismatch: false,
      msg: "App audio route snapshot (call established)",
    });
  } catch {}

  try {
    const ctx = getOutboundDiagContext(st, peer, inviter);
    const audioEl = ui?.remoteAudio?.();
    if (audioEl) {
      startOutboundAudioOutputDiag(audioEl, ctx);
      startOutboundRenderDiag(audioEl, ctx);
    }
  } catch {}

  try {
    const audioEl = ui?.remoteAudio?.();
    if (audioEl && !audioEl.__callMediaNoPlayTimer) {
      audioEl.__callMediaNoPlayTimer = setTimeout(() => {
        try {
          if (audioEl.__callMediaPlayed) return;
          const ctx = audioEl.__callMediaDiagContext || getOutboundDiagContext(st, peer, inviter);
          sendCallMediaEvent({
            type: "no-remote-audio-play",
            ...ctx,
            dir: "outbound",
            msg: "Remote audio did not start playing within 10s after establish",
          });
        } catch {}
      }, 10000);
    }
  } catch {}

  try {
    const pc = inviter?.sessionDescriptionHandler?.peerConnection;
    if (pc) scheduleMediaStatsSnapshots(pc, "outbound", getOutboundDiagContext(st, peer, inviter));
  } catch {}

  try {
    const ctx = getOutboundDiagContext(st, peer, inviter);
    const audioEl = ui?.remoteAudio?.();
    const pc = inviter?.sessionDescriptionHandler?.peerConnection;

    sendCallMediaEvent({
      type: "outbound-post-establish-probe",
      ...ctx,
      t_callStart,
      t_established: new Date().toISOString(),
      msg: "Outbound post-establish probe (guaranteed LTE receive-leg marker)",
    });

    const scheduleHealth = (ms, type) => {
      setTimeout(async () => {
        try {
          const snap = await readPostEstablishReceiveHealth(pc, audioEl);
          sendCallMediaEvent({
            type,
            ...ctx,
            t_callStart,
            packetsReceived: snap.packetsReceived,
            bytesReceived: snap.bytesReceived,
            packetsSent: snap.packetsSent,
            bytesSent: snap.bytesSent,
            remoteAudioTracks: snap.remoteAudioTracks,
            remoteAudioElementPaused: snap.remoteAudioElementPaused,
            remoteAudioElementMuted: snap.remoteAudioElementMuted,
            remoteAudioElementVolume: snap.remoteAudioElementVolume,
            selectedPair: snap.selectedPair,
            localCandidateType: snap.localCandidateType,
            remoteCandidateType: snap.remoteCandidateType,
            dtlsState: snap.dtlsState,
            iceConnectionState: snap.iceConnectionState,
            connectionState: snap.connectionState,
            msg: "Outbound receive health snapshot",
          });
        } catch {}
      }, ms);
    };

    scheduleHealth(2000, "outbound-receive-health-2s");
    scheduleHealth(5000, "outbound-receive-health-5s");
    scheduleHealth(10000, "outbound-receive-health-10s");
  } catch {}

  try {
    sendCallMediaEvent({
      type: "outbound-stats-scheduled",
      ...getOutboundDiagContext(st, peer, inviter),
      t_callStart,
      t_established: new Date().toISOString(),
      msg: "Outbound stats scheduled (guaranteed chain)",
    });
  } catch {}

  try {
    const callId = inviter?.outgoingRequestMessage?.callId;
    if (callId) {
      setTimeout(() => {
        try {
          const seen = !!(window.__callMediaOutboundStats2sByCallId && window.__callMediaOutboundStats2sByCallId[callId]);
          if (seen) return;
          sendCallMediaEvent({
            type: "missing-outbound-stats",
            ...getOutboundDiagContext(st, peer, inviter),
            t_callStart,
            msg: "Outbound established but outbound-stats-2s missing (hook/posting failure detector)",
          });
        } catch {}
      }, 5000);
    }
  } catch {}

  sendCallMediaEvent({
    type: "outbound-call-established",
    ...getOutboundDiagContext(st, peer, inviter),
    t_callStart,
    t_established: new Date().toISOString(),
    msg: "Call established (outbound)",
  });

  sendCallMediaEvent({
    type: "media-answer-outgoing",
    ...getOutboundDiagContext(st, peer, inviter),
    t_callStart,
    t_established: new Date().toISOString(),
    msg: "Call established (answer received)",
  });

  sendCallMediaEvent({
    type: "call-established",
    ...getOutboundDiagContext(st, peer, inviter),
    t_callStart,
    t_established: new Date().toISOString(),
    msg: "Call established",
  });

  if (!dualSessionManager.primary) {
    dualSessionManager.setPrimary(st);
    logLine(`[${nowISO()}] [session:outbound] Registered as primary session`);
  }
}
