import { nowISO } from "../config.js";
import { formatSipResponse, getSipRejectDetails, mapSipFailureToMessage, logLine } from "../log.js";
import { g711OnlyModifier } from "../sdp.js";
import { bindPeerConnection } from "../pcDebug.js?v=1773033002";
import { ensureMicAccess, getLocalStream, stopLocalAudioStream } from "../media.js";
import { attachRemoteAudio, startEarlyMediaAttachLoop, clearEarlyMediaAttachLoop } from "./media.js?v=1773032001";
import {
  primeOutboundRingbackContext,
  startRingbackTone,
  stopRingbackTone,
} from "./ringback.js";
import { dualSessionManager } from "../features/dualSessionManager.js";
import { guardLteRelayReadiness, checkLteRelayAvailable, MEDIA_ERRORS } from "../features/lteCallGuard.js";
import { sendCallMediaEvent } from "../features/callMediaLog.js";
import { isMobileCompatModeEnabled } from "../features/mobileNetworkMode.js";
import { ICE_SERVERS } from "../config.js";

let _pcStats = null;
let _pcStatsImport = null;

let _stats = null;
let _statsImport = null;

function getRuntimeCb() {
  try {
    const fromGlobal = (typeof window !== 'undefined' && window.__BUILD_CB) ? String(window.__BUILD_CB) : '';
    if (fromGlobal) return fromGlobal;
  } catch {}
  try {
    const u = new URL(import.meta.url);
    return (u.searchParams.get('cb') || '').trim();
  } catch {
    return '';
  }
}

function loadPcStats() {
  if (_stats) return Promise.resolve(_stats);
  if (_statsImport) return _statsImport;

  const cb = getRuntimeCb();
  const url = cb ? `../pc/stats.js?cb=${encodeURIComponent(cb)}` : '../pc/stats.js';
  _statsImport = import(url)
    .then((m) => {
      _stats = m;
      return m;
    })
    .catch((err) => {
      try {
        console.error('[outgoing/call] Failed to import pc/stats.js', err);
      } catch {}
      throw err;
    });

  return _statsImport;
}

function loadPcStatsForDiag() {
  if (_pcStats) return Promise.resolve(_pcStats);
  if (_pcStatsImport) return _pcStatsImport;

  const cb = getRuntimeCb();
  const url = cb ? `../pc/stats.js?cb=${encodeURIComponent(cb)}` : '../pc/stats.js';
  _pcStatsImport = import(url)
    .then((m) => {
      _pcStats = m;
      return m;
    })
    .catch(() => null);

  return _pcStatsImport;
}

function scheduleMediaStatsSnapshots(pc, label, diagCtx) {
  loadPcStats()
    .then((m) => {
      const fn = m?.scheduleMediaStatsSnapshots;
      if (typeof fn !== 'function') {
        try {
          console.error('[outgoing/call] Missing stats export scheduleMediaStatsSnapshots');
        } catch {}
        return;
      }
      fn(pc, label, diagCtx);
    })
    .catch(() => {});
}

async function readPostEstablishReceiveHealth(pc, audioEl) {
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

    // Audio element state
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

function configureRemoteAudio(ui) {
  const audioEl = ui?.remoteAudio?.();
  if (!audioEl) return;
  audioEl.autoplay = true;
  audioEl.playsInline = true;
  audioEl.muted = false;
  audioEl.volume = 0.7;

  // Observability only: do not call play() here (avoid changing gesture/autoplay behavior).
  // Instead, emit events when the element actually starts playing or errors.
  try {
    if (!audioEl.__callMediaPlayObserved) {
      audioEl.__callMediaPlayObserved = true;
      const emitAudioState = (type, msg) => {
        const ctx = audioEl.__callMediaDiagContext || {};
        sendCallMediaEvent({
          type,
          ...ctx,
          dir: 'outbound',
          audioElMuted: typeof audioEl.muted === 'boolean' ? audioEl.muted : undefined,
          audioElVolume: typeof audioEl.volume === 'number' ? audioEl.volume : undefined,
          audioElReadyState: typeof audioEl.readyState === 'number' ? audioEl.readyState : undefined,
          audioElPaused: typeof audioEl.paused === 'boolean' ? audioEl.paused : undefined,
          audioElCurrentTime: typeof audioEl.currentTime === 'number' ? audioEl.currentTime : undefined,
          msg,
        });
      };

      emitAudioState('remote-audio-ready-state', 'remoteAudio initial state');
      emitAudioState('remote-audio-muted-state', 'remoteAudio muted state');
      emitAudioState('remote-audio-volume-state', 'remoteAudio volume state');

      audioEl.addEventListener('volumechange', () => {
        emitAudioState('remote-audio-volume-state', 'remoteAudio volumechange');
        emitAudioState('remote-audio-muted-state', 'remoteAudio muted state change');
      });
      audioEl.addEventListener('loadedmetadata', () => emitAudioState('remote-audio-ready-state', 'remoteAudio loadedmetadata'));
      audioEl.addEventListener('canplay', () => emitAudioState('remote-audio-ready-state', 'remoteAudio canplay'));
      audioEl.addEventListener('waiting', () => emitAudioState('remote-audio-ready-state', 'remoteAudio waiting'));

      audioEl.addEventListener('playing', () => {
        try {
          audioEl.__callMediaPlayed = true;
          if (audioEl.__callMediaNoPlayTimer) {
            clearTimeout(audioEl.__callMediaNoPlayTimer);
            audioEl.__callMediaNoPlayTimer = null;
          }
        } catch {}

        // Logging-only: expose remote audio element for later stats-based proof sampling.
        try {
          window.__callMediaRemoteAudioEl = audioEl;
        } catch {}

        const ctx = audioEl.__callMediaDiagContext || {};
        sendCallMediaEvent({
          type: 'outbound-remote-audio-play-ok',
          ...ctx,
          dir: 'outbound',
          audioPlayOk: true,
          msg: 'remoteAudio is playing',
        });

        sendCallMediaEvent({
          type: 'remote-audio-play-ok',
          ...ctx,
          dir: 'outbound',
          audioPlayOk: true,
          msg: 'remoteAudio is playing',
        });

        // Logging-only: early receive render proof (restore previous summary row).
        try {
          if (!audioEl.__receiveRenderProofEarlyEmitted) {
            audioEl.__receiveRenderProofEarlyEmitted = true;
            const track = (() => {
              try {
                const t = audioEl?.srcObject?.getAudioTracks?.()?.[0] || null;
                return t || null;
              } catch {
                return null;
              }
            })();
            const baseEv = {
              type: 'receive-render-proof',
              ...ctx,
              dir: 'outbound',
              audioElPaused: typeof audioEl.paused === 'boolean' ? audioEl.paused : undefined,
              audioElMuted: typeof audioEl.muted === 'boolean' ? audioEl.muted : undefined,
              audioElVolume: typeof audioEl.volume === 'number' ? audioEl.volume : undefined,
              audioElCurrentTime: typeof audioEl.currentTime === 'number' ? audioEl.currentTime : undefined,
              audioElReadyState: typeof audioEl.readyState === 'number' ? audioEl.readyState : undefined,
              trackEnabled: typeof track?.enabled === 'boolean' ? track.enabled : undefined,
              trackMuted: typeof track?.muted === 'boolean' ? track.muted : undefined,
              trackReadyState: typeof track?.readyState === 'string' ? track.readyState : undefined,
              msg: 'Receive render proof (early)',
            };

            const pc = (() => {
              try { return audioEl.__callMediaPc || null; } catch { return null; }
            })();

            if (pc) {
              loadPcStatsForDiag().then(async (m) => {
                try {
                  const fn = m?.readAudioStatsSnapshotForDiag;
                  if (typeof fn !== 'function') {
                    sendCallMediaEvent(baseEv);
                    return;
                  }
                  const snap = await fn(pc);
                  if (!snap) {
                    sendCallMediaEvent(baseEv);
                    return;
                  }
                  sendCallMediaEvent({
                    ...baseEv,
                    inboundAudioPacketsReceived: snap.inPackets,
                    outboundAudioPacketsSent: snap.outPackets,
                    audioLevel: snap.inAudioLevel,
                    totalAudioEnergy: snap.inTotalAudioEnergy,
                    inboundCodecMimeType: snap.inboundCodecMimeType,
                    inboundCodecPayloadType: snap.inboundCodecPayloadType,
                    decoderImplementation: snap.decoderImplementation,
                    packetsDiscarded: snap.packetsDiscarded,
                    packetsRepaired: snap.packetsRepaired,
                    concealedSamples: snap.concealedSamples,
                    silentConcealedSamples: snap.silentConcealedSamples,
                    totalSamplesDecoded: snap.totalSamplesDecoded,
                    jitterBufferDelay: snap.jitterBufferDelay,
                    jitterBufferEmittedCount: snap.jitterBufferEmittedCount,
                  });
                } catch {
                  sendCallMediaEvent(baseEv);
                }
              });
            } else {
              sendCallMediaEvent(baseEv);
            }
          }
        } catch {}
      }, { once: true });
      audioEl.addEventListener('error', () => {
        const ctx = audioEl.__callMediaDiagContext || {};
        sendCallMediaEvent({
          type: 'outbound-remote-audio-play-failed',
          ...ctx,
          dir: 'outbound',
          audioPlayOk: false,
          audioPlayError: 'audio-element-error',
          msg: 'remoteAudio element error',
        });

        sendCallMediaEvent({
          type: 'remote-audio-play-failed',
          ...ctx,
          dir: 'outbound',
          audioPlayOk: false,
          audioPlayError: 'audio-element-error',
          msg: 'remoteAudio element error',
        });
      }, { once: true });
    }
  } catch {}
}

function getOutboundDiagContext(st, target, inviter) {
  const username = st.account?.rawUsername || st.account?.username || undefined;
  const domain = st.account?.domain || undefined;
  const aor = (username && domain) ? `${username}@${domain}` : undefined;
  const callId = inviter?.outgoingRequestMessage?.callId || undefined;
  const sessionId = inviter?.id || inviter?._id || undefined;
  const corrId = inviter?.__webrtcCorrId || inviter?.__callMediaDiag?.corrId || st?.__webrtcCorrId || undefined;
  const selectedProfile = st.selectedProfile || (isMobileCompatModeEnabled() ? 'lte' : 'wifi');
  const lteMode = selectedProfile === 'lte';
  const mode = lteMode ? 'lte' : 'wifi';
  const icePolicy = lteMode ? 'relay' : 'all';
  return {
    username,
    domain,
    aor,
    dir: 'outbound',
    peer: target || undefined,
    callId,
    corrId,
    sessionId,
    lteMode,
    mode,
    selectedProfile,
    icePolicy,
    probeBuildId: (() => { try { return window?.OUTBOUND_CALLER_PROBE_BUILD_ID || localStorage.getItem('OUTBOUND_CALLER_PROBE_BUILD_ID') || undefined; } catch { return undefined; } })(),
  };
}

function onOutboundStateChange(SIP, inviter, st, ui, { t_callStart, peer } = {}) {
  return (s) => {
    logLine(`[${nowISO()}] [session:outbound] ${s}`);
    const _aor = st.account ? `${st.account.rawUsername}@${st.account.domain}` : undefined;
    const _callId = inviter.outgoingRequestMessage?.callId || undefined;
    bindPeerConnection(inviter, "outbound", { aor: _aor, callId: _callId });
    attachRemoteAudio(inviter, ui);

    try {
      const audioEl = ui?.remoteAudio?.();
      const pc = inviter?.sessionDescriptionHandler?.peerConnection;
      if (audioEl && pc) audioEl.__callMediaPc = pc;
    } catch {}

    if (s === SIP.SessionState.Established) {
      stopRingbackTone();
      if (window.callTimer) window.callTimer.start();

      try {
        const audioEl = ui?.remoteAudio?.();
        if (audioEl && !audioEl.__callMediaNoPlayTimer) {
          audioEl.__callMediaNoPlayTimer = setTimeout(() => {
            try {
              if (audioEl.__callMediaPlayed) return;
              const ctx = audioEl.__callMediaDiagContext || getOutboundDiagContext(st, peer, inviter);
              sendCallMediaEvent({
                type: 'no-remote-audio-play',
                ...ctx,
                dir: 'outbound',
                msg: 'Remote audio did not start playing within 10s after establish',
              });
            } catch {}
          }, 10000);
        }
      } catch {}

      try {
        const pc = inviter?.sessionDescriptionHandler?.peerConnection;
        if (pc) {
          scheduleMediaStatsSnapshots(pc, 'outbound', getOutboundDiagContext(st, peer, inviter));
        }
      } catch {}

      // Guaranteed LTE receive-leg probe + periodic receive health snapshots
      try {
        const ctx = getOutboundDiagContext(st, peer, inviter);
        const audioEl = ui?.remoteAudio?.();
        const pc = inviter?.sessionDescriptionHandler?.peerConnection;

        sendCallMediaEvent({
          type: 'outbound-post-establish-probe',
          ...ctx,
          t_callStart,
          t_established: new Date().toISOString(),
          msg: 'Outbound post-establish probe (guaranteed LTE receive-leg marker)',
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
                msg: 'Outbound receive health snapshot',
              });
            } catch {}
          }, ms);
        };

        scheduleHealth(2000, 'outbound-receive-health-2s');
        scheduleHealth(5000, 'outbound-receive-health-5s');
        scheduleHealth(10000, 'outbound-receive-health-10s');
      } catch {}

      // Guaranteed chain marker: even if PC hooks fail, this should still post.
      try {
        sendCallMediaEvent({
          type: 'outbound-stats-scheduled',
          ...getOutboundDiagContext(st, peer, inviter),
          t_callStart,
          t_established: new Date().toISOString(),
          msg: 'Outbound stats scheduled (guaranteed chain)',
        });
      } catch {}

      // Mandatory stats: detect hook failures vs true media failure.
      try {
        const callId = inviter?.outgoingRequestMessage?.callId;
        if (callId) {
          setTimeout(() => {
            try {
              const seen = !!(window.__callMediaOutboundStats2sByCallId && window.__callMediaOutboundStats2sByCallId[callId]);
              if (seen) return;
              sendCallMediaEvent({
                type: 'missing-outbound-stats',
                ...getOutboundDiagContext(st, peer, inviter),
                t_callStart,
                msg: 'Outbound established but outbound-stats-2s missing (hook/posting failure detector)',
              });
            } catch {}
          }, 5000);
        }
      } catch {}

      sendCallMediaEvent({
        type: 'outbound-call-established',
        ...getOutboundDiagContext(st, peer, inviter),
        t_callStart,
        t_established: new Date().toISOString(),
        msg: 'Call established (outbound)',
      });

      sendCallMediaEvent({
        type: 'media-answer-outgoing',
        ...getOutboundDiagContext(st, peer, inviter),
        t_callStart,
        t_established: new Date().toISOString(),
        msg: 'Call established (answer received)',
      });

      sendCallMediaEvent({
        type: 'call-established',
        ...getOutboundDiagContext(st, peer, inviter),
        t_callStart,
        t_established: new Date().toISOString(),
        msg: 'Call established',
      });
      
      // Register as primary session with dual session manager
      if (!dualSessionManager.primary) {
        dualSessionManager.setPrimary(st);
        logLine(`[${nowISO()}] [session:outbound] Registered as primary session`);
      }
      return;
    }

    if (s === SIP.SessionState.Terminated) {
      stopRingbackTone();
      clearEarlyMediaAttachLoop(inviter);

      sendCallMediaEvent({
        type: 'call-ended',
        ...getOutboundDiagContext(st, peer, inviter),
        t_callStart,
        t_ended: new Date().toISOString(),
        msg: 'Call terminated',
      });

      sendCallMediaEvent({
        type: 'outbound-call-end',
        ...getOutboundDiagContext(st, peer, inviter),
        t_callStart,
        t_ended: new Date().toISOString(),
        msg: 'Outbound call end (guaranteed chain)',
      });
      
      // Remove from dual session manager
      dualSessionManager.removeSession(st);
      
      st.session = null;
      stopLocalAudioStream();
      ui.setButtons();
      ui.setStatus("Idle");
      if (window.callTimer) window.callTimer.stop();
    }
  };
}

export async function startCall(SIP, st, ui) {
  const target = ui.dial();
  if (!st.registered || !st.ua) return ui.setStatus("Not registered");
  if (!target) return ui.setStatus("Missing destination");
  if (st.session) return ui.setStatus("Call already active");

  const t_callStart = new Date().toISOString();
  const corrId = (() => {
    try {
      return `c-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
    } catch {
      return `c-${Date.now()}`;
    }
  })();
  try {
    st.__webrtcCorrId = corrId;
  } catch {}

  // Prime audio output while still in direct user gesture path.
  primeOutboundRingbackContext();

  const micOk = await ensureMicAccess(ui.setStatus);
  if (!micOk) return;

  const resolvedAccount = ui.account ? ui.account() : null;
  const domain = st.account?.domain || resolvedAccount?.domain || ui.domain() || ui.domainFallback?.();
  if (!domain) {
    stopLocalAudioStream();
    return ui.setStatus("Missing domain");
  }

  const encodedTarget = encodeURIComponent(target);
  const targetUri = SIP.UserAgent.makeURI(`sip:${encodedTarget}@${domain}`);
  if (!targetUri) {
    stopLocalAudioStream();
    return ui.setStatus("Invalid destination");
  }

  logLine(`[${nowISO()}] [call] dialing ${target} (encoded: ${encodedTarget})`);

  // Guaranteed chain: must exist for every outbound call attempt.
  sendCallMediaEvent({
    type: 'outbound-call-start',
    ...getOutboundDiagContext(st, target, { __webrtcCorrId: corrId }),
    t_callStart,
    msg: 'Outbound call start (guaranteed chain)',
  });

  // Minimal LTE caller probe: proves client emitted *and* sendCallMediaEvent path executed.
  try {
    const ctx = getOutboundDiagContext(st, target, null);
    if (String(ctx.username || '') === '900900' && ctx.lteMode === true) {
      sendCallMediaEvent({
        type: 'lte-caller-probe-callstart',
        ...ctx,
        sourceBuildId: (() => { try { return window.CALL_MEDIA_SOURCE_BUILD_ID; } catch { return undefined; } })(),
        t_callStart,
        msg: 'LTE caller probe on outbound call start',
      });
    }
  } catch {}

  sendCallMediaEvent({
    type: 'outbound-invite-start',
    ...getOutboundDiagContext(st, target, { __webrtcCorrId: corrId }),
    t_callStart,
    msg: 'Outbound call start (before INVITE)',
  });

  if (isMobileCompatModeEnabled()) {
    const aorForCheck = st.account ? `${st.account.rawUsername}@${st.account.domain}` : null;
    logLine(`[${nowISO()}] [call] LTE mode: running pre-flight TURN relay check...`);
    ui.setStatus("Checking media relay...");

    sendCallMediaEvent({
      type: 'outbound-preflight-start',
      username: st.account?.rawUsername || st.account?.username || undefined,
      domain: st.account?.domain || undefined,
      aor: aorForCheck || undefined,
      corrId,
      dir: 'outbound',
      peer: target,
      lteMode: true,
      mode: 'lte',
      selectedProfile: st.selectedProfile || 'lte',
      icePolicy: 'relay',
      t_callStart,
      msg: 'LTE outbound preflight started',
    });

    let preCheck;
    try {
      preCheck = await checkLteRelayAvailable(ICE_SERVERS, 8000, {
        preflightEventPrefix: 'outbound-',
        username: st.account?.rawUsername || st.account?.username || undefined,
        domain: st.account?.domain || undefined,
        aor: aorForCheck,
        callId: undefined,
        corrId,
        dir: 'outbound',
        peer: target,
        lteMode: true,
        mode: 'lte',
        selectedProfile: st.selectedProfile || 'lte',
      });
    } catch {
      preCheck = { relay: 0, total: 0, timedOut: true };
    }
    logLine(`[${nowISO()}] [call] pre-flight result: relay=${preCheck.relay} total=${preCheck.total} timedOut=${preCheck.timedOut}`);

    sendCallMediaEvent({
      type: preCheck.timedOut ? 'outbound-preflight-timeout' : 'outbound-preflight-complete',
      username: st.account?.rawUsername || st.account?.username || undefined,
      domain: st.account?.domain || undefined,
      aor: aorForCheck || undefined,
      corrId,
      dir: 'outbound',
      peer: target,
      lteMode: true,
      mode: 'lte',
      selectedProfile: st.selectedProfile || 'lte',
      icePolicy: 'relay',
      relay: preCheck.relay,
      total: preCheck.total,
      timedOut: preCheck.timedOut,
      t_callStart,
      msg: preCheck.timedOut ? 'LTE outbound preflight timed out' : 'LTE outbound preflight complete',
    });

    sendCallMediaEvent({
      type: 'outbound-preflight-result',
      code: preCheck.relay === 0 ? (preCheck.timedOut ? 'MEDIA-E002' : 'MEDIA-E001') : undefined,
      username: st.account?.rawUsername || st.account?.username || undefined,
      domain: st.account?.domain || undefined,
      aor: aorForCheck || undefined,
      corrId,
      dir: 'outbound',
      peer: target,
      lteMode: true,
      mode: 'lte',
      selectedProfile: st.selectedProfile || 'lte',
      icePolicy: 'relay',
      relay: preCheck.relay,
      total: preCheck.total,
      timedOut: preCheck.timedOut,
      t_callStart,
      msg: preCheck.relay > 0 ? 'LTE outbound preflight OK' : (preCheck.timedOut ? 'LTE outbound preflight failed (timeout)' : 'LTE outbound preflight failed (no relay)'),
    });
    sendCallMediaEvent({
      type: preCheck.relay > 0 ? 'preflight-ok' : 'preflight-fail',
      code: preCheck.relay === 0 ? (preCheck.timedOut ? 'MEDIA-E002' : 'MEDIA-E001') : undefined,
      username: st.account?.rawUsername || st.account?.username || undefined,
      domain: st.account?.domain || undefined,
      aor: aorForCheck,
      corrId,
      lteMode: true,
      mode: 'lte',
      dir: 'outbound',
      peer: target,
      relay: preCheck.relay,
      total: preCheck.total,
      timedOut: preCheck.timedOut,
      msg: preCheck.relay > 0 ? 'TURN relay reachable' : (preCheck.timedOut ? 'ICE gathering timed out' : 'Zero relay candidates — TURN unreachable'),
    });
    if (preCheck.relay === 0) {
      const errCode = preCheck.timedOut ? 'MEDIA-E002' : 'MEDIA-E001';
      const errDef = MEDIA_ERRORS[errCode];
      logLine(`[${nowISO()}] [call] ${errCode} — aborting call before INVITE: ${errDef.longDescription}`);
      ui.setStatus(errDef.userMessage);
      stopLocalAudioStream();
      st.session = null;
      ui.setButtons();
      return;
    }
    logLine(`[${nowISO()}] [call] pre-flight OK — ${preCheck.relay} relay candidate(s) — proceeding`);
  }

  configureRemoteAudio(ui);

  const selectedProfile = st.selectedProfile || (isMobileCompatModeEnabled() ? 'lte' : 'wifi');

  const inviter = new SIP.Inviter(st.ua, targetUri, {
    earlyMedia: true,
    // Do not force 100rel with Require; this PBX rejects it with 420 Bad Extension.
    extraHeaders: ["P-Early-Media: supported", `X-WebRTC-CorrId: ${corrId}`, `X-WebRTC-Profile: ${selectedProfile}`],
    sessionDescriptionHandlerModifiers: [g711OnlyModifier],
    sessionDescriptionHandlerOptions: {
      constraints: { audio: true, video: false },
      localMediaStream: getLocalStream() || undefined,
    },
  });

  try {
    inviter.__webrtcCorrId = corrId;
  } catch {}

  try {
    inviter.__callMediaDiag = getOutboundDiagContext(st, target, inviter);
  } catch {}

  const requestDelegate = {
    onTrying: async (resp) => {
      const info = formatSipResponse(resp);
      if (info) logLine(`[${nowISO()}] [call] trying ${info}`);
    },
    onProgress: async (resp) => {
      const info = formatSipResponse(resp);
      if (info) logLine(`[${nowISO()}] [call] progress ${info}`);

      const code = resp?.message?.statusCode || resp?.statusCode || resp?.message?.status;
      const body = resp?.message?.body || "";
      const hasSdp = body.includes("v=") && body.includes("m=audio");

      if (code === 180 || code === 183) {
        logLine(`[${nowISO()}] [call] provisional ${code} (hasSdp=${hasSdp})`);

        if (code === 180) {
          // 180 Ringing: Start local ringback as fallback since PBX won't send early media
          ui.setStatus("Ringing...");
          startRingbackTone();
        }

        if (code === 183) {
          if (hasSdp) {
            stopRingbackTone();
            ui.setStatus("Early media...");
          } else {
            ui.setStatus("Progress...");
          }
        }

        attachRemoteAudio(inviter, ui);
        startEarlyMediaAttachLoop(inviter, ui);
      }
    },
    onAccept: async (resp) => {
      stopRingbackTone();
      const info = formatSipResponse(resp);
      const details = getSipRejectDetails(resp);
      window.callHistory?.addCall?.(target, "outgoing", 0, {
        sipCode: details?.code || 200,
        sipReason: details?.reason || "OK",
      });
      ui.setStatus(info ? `Call established (${info})` : "Call established");
    },
    onRedirect: async (resp) => {
      stopRingbackTone();
      const info = formatSipResponse(resp);
      ui.setStatus(info ? `Call redirected (${info})` : "Call redirected");
    },
    onReject: async (resp) => {
      stopRingbackTone();
      const info = formatSipResponse(resp);
      const details = getSipRejectDetails(resp);
      const human = mapSipFailureToMessage(details);
      const q850 = details.q850Cause ? `; Q.850 cause=${details.q850Cause}${details.q850Text ? ` (${details.q850Text})` : ""}` : "";
      logLine(`[${nowISO()}] [call] rejected ${info || "unknown"}${q850}`);
      window.callHistory?.addCall?.(target, "rejected", 0, {
        sipCode: details?.code || "",
        sipReason: details?.reason || "",
        q850Cause: details?.q850Cause || "",
        q850Text: details?.q850Text || "",
      });
      ui.setStatus(info ? `${human} (${info})` : human);
      stopLocalAudioStream();
      st.session = null;
      ui.setButtons();
    },
  };

  const aor = st.account ? `${st.account.rawUsername}@${st.account.domain}` : null;

  try {
    const audioEl = ui?.remoteAudio?.();
    if (audioEl) audioEl.__callMediaDiagContext = getOutboundDiagContext(st, target, inviter);
  } catch {}

  st.session = inviter;
  bindPeerConnection(inviter, "outbound", { aor });
  inviter.stateChange.addListener(onOutboundStateChange(SIP, inviter, st, ui, { t_callStart, peer: target }));
  ui.setButtons();

  sendCallMediaEvent({
    type: 'media-offer-outgoing',
    ...getOutboundDiagContext(st, target, inviter),
    t_callStart,
    msg: 'About to send INVITE (offer)',
  });

  sendCallMediaEvent({
    type: 'outbound-invite-sent',
    ...getOutboundDiagContext(st, target, inviter),
    t_callStart,
    msg: 'Outbound INVITE will be sent',
  });

  try {
    await inviter.invite({ requestDelegate });
    ui.setStatus("Calling...");

    sendCallMediaEvent({
      type: 'invite-sent',
      ...getOutboundDiagContext(st, target, inviter),
      t_callStart,
      t_inviteSent: new Date().toISOString(),
      msg: 'INVITE sent',
    });

    sendCallMediaEvent({
      type: 'outbound-invite-sent',
      ...getOutboundDiagContext(st, target, inviter),
      t_callStart,
      t_inviteSent: new Date().toISOString(),
      msg: 'Outbound INVITE sent',
    });

    // LTE relay guard — monitors ICE gathering in relay-only mode.
    // If zero relay candidates are gathered, cancels and surfaces MEDIA-E001.
    // Non-blocking: does not delay the invite.
    const callId = inviter.outgoingRequestMessage?.callId || null;
    guardLteRelayReadiness(inviter, {
      aor,
      callId,
      dir: 'outbound',
      onFail: (code, userMessage) => {
        logLine(`[${nowISO()}] [call] ${code} — aborting call: ${userMessage}`);
        ui.setStatus(userMessage);
        try {
          if (inviter.state === SIP.SessionState.Established) inviter.bye();
          else inviter.cancel();
        } catch {}
        stopLocalAudioStream();
        st.session = null;
        ui.setButtons();
        stopRingbackTone();
      },
    });

    // Keep legacy event (used by existing docs), but enrich for new admin filters.
    sendCallMediaEvent({
      type: 'call-start',
      ...getOutboundDiagContext(st, target, inviter),
      t_callStart,
      msg: 'Outbound call active (invite initiated)',
    });
  } catch (e) {
    stopRingbackTone();
    logLine(`[${nowISO()}] [error] invite failed`, e?.message || e);
    ui.setStatus("Call failed (invite error)");
    stopLocalAudioStream();
    st.session = null;
    ui.setButtons();
  }
}

export async function hangupCall(st, ui, silent = false) {
  if (!st.session) return;
  const s = st.session;
  if (!silent) logLine(`[${nowISO()}] [call] hangup`);

  stopRingbackTone();

  try {
    if (s.state === SIP.SessionState.Established) await s.bye();
    else await s.cancel();
  } catch {}

  stopLocalAudioStream();
  st.session = null;
  ui.setButtons();
  ui.setStatus("Idle");
}
