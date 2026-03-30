import { nowISO } from "../config.js";
import { logLine } from "../log.js";
import { g711OnlyModifier } from "../sdp.js";
import { bindPeerConnection } from "../pcDebug.js?v=1773033002";
import { ensureMicAccess, getLocalStream, stopLocalAudioStream } from "../media.js";
import { focusDialTabForIncoming, startIncomingAlert, stopIncomingAlert } from "./alert.js";
import { attachIncomingRemoteAudio, startIncomingEarlyMediaLoop, stopIncomingEarlyMediaLoop } from "./media.js?v=1773032001";
import { dualSessionManager } from "../features/dualSessionManager.js";
import { guardLteRelayReadiness, checkLteRelayAvailable, MEDIA_ERRORS } from "../features/lteCallGuard.js";
import { sendCallMediaEvent } from "../features/callMediaLog.js";
import { isMobileCompatModeEnabled } from "../features/mobileNetworkMode.js";
import { ICE_SERVERS } from "../config.js";

let _stats = null;
let _statsImport = null;

function getHeaderValue(request, headerName) {
  try {
    const headers = request?.getHeaders?.() || request?.headers || [];
    if (Array.isArray(headers)) {
      const want = String(headerName || '').toLowerCase();
      for (const h of headers) {
        if (typeof h !== 'string') continue;
        const idx = h.indexOf(':');
        if (idx <= 0) continue;
        const name = h.slice(0, idx).trim().toLowerCase();
        if (name !== want) continue;
        return h.slice(idx + 1).trim();
      }
    }
  } catch {}
  return undefined;
}

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
        console.error('[incoming/handlers] Failed to import pc/stats.js', err);
      } catch {}
      throw err;
    });

  return _statsImport;
}

function scheduleMediaStatsSnapshots(pc, label, diagCtx) {
  loadPcStats()
    .then((m) => {
      const fn = m?.scheduleMediaStatsSnapshots;
      if (typeof fn !== 'function') {
        try {
          console.error('[incoming/handlers] Missing stats export scheduleMediaStatsSnapshots');
        } catch {}
        return;
      }
      fn(pc, label, diagCtx);
    })
    .catch(() => {});
}

function getInboundCorrId(invitation) {
  try {
    const req = invitation?.request;
    if (req && typeof req.getHeader === 'function') {
      const v = req.getHeader('X-WebRTC-CorrId');
      if (v && String(v).trim()) return String(v).trim().slice(0, 128);
    }
  } catch {}
  try {
    const h = invitation?.request?.headers?.['X-WebRTC-CorrId'] || invitation?.request?.headers?.['x-webrtc-corrid'];
    const first = Array.isArray(h) ? h[0] : h;
    const raw = first?.raw || first?.value || first;
    if (raw && String(raw).trim()) return String(raw).trim().slice(0, 128);
  } catch {}
  return undefined;
}

function getInboundDiagContext(st, invitation) {
  const username = st.account?.rawUsername || st.account?.username || invitation?.localIdentity?.uri?.user || undefined;
  const domain = st.account?.domain || invitation?.localIdentity?.uri?.host || undefined;
  const aor = (username && domain) ? `${username}@${domain}` : undefined;
  const peerUser = invitation?.remoteIdentity?.uri?.user || undefined;
  const peerDomain = invitation?.remoteIdentity?.uri?.host || undefined;
  const peerAor = peerUser ? (peerDomain ? `${peerUser}@${peerDomain}` : peerUser) : undefined;
  const callId = invitation?.request?.callId || undefined;
  const corrId = getInboundCorrId(invitation);
  const sessionId = invitation?.id || invitation?._id || undefined;
  const lteMode = isMobileCompatModeEnabled();
  const mode = lteMode ? 'lte' : 'wifi';
  const icePolicy = lteMode ? 'relay' : 'all';
  return {
    username,
    domain,
    aor,
    dir: 'inbound',
    peer: peerUser,
    peerDomain,
    peerAor,
    callId,
    corrId,
    sessionId,
    lteMode,
    mode,
    selectedProfile: st.selectedProfile || mode,
    icePolicy,
  };
}

function observeRemoteAudioPlay(ui, ctx, { t_answerClicked } = {}) {
  try {
    const audioEl = ui?.remoteAudio?.();
    if (!audioEl) return;
    if (audioEl.__callMediaPlayObserved) return;
    audioEl.__callMediaPlayObserved = true;

    const emitAudioState = (type, msg) => {
      sendCallMediaEvent({
        type,
        ...ctx,
        t_answerClicked,
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
      sendCallMediaEvent({
        type: 'remote-audio-play-ok',
        ...ctx,
        t_answerClicked,
        audioPlayOk: true,
        msg: 'remoteAudio is playing',
      });
    }, { once: true });

    audioEl.addEventListener('error', () => {
      sendCallMediaEvent({
        type: 'remote-audio-play-failed',
        ...ctx,
        t_answerClicked,
        audioPlayOk: false,
        audioPlayError: 'audio-element-error',
        msg: 'remoteAudio element error',
      });
    }, { once: true });
  } catch {
    // no-op
  }
}

// Track page load time for ghost call prevention
const pageLoadTimeForIncoming = Date.now();
let lastRegistrationCompleteTime = null;  // Track when registration actually completes

function cleanupIncomingState(st, ui) {
  st.session = null;
  st.incomingInvitation = null;
  stopLocalAudioStream();
  ui.setButtons();
  ui.setStatus("Idle");
  if (window.callTimer) window.callTimer.stop();
  try {
    const audioEl = ui?.remoteAudio?.();
    if (audioEl?.__callMediaNoPlayTimer) {
      clearTimeout(audioEl.__callMediaNoPlayTimer);
      audioEl.__callMediaNoPlayTimer = null;
    }
  } catch {}
}

function endIncomingAlert(st, ui, reason = "unknown") {
  logLine(`[${nowISO()}] [incoming] Ending incoming alert (${reason})`);
  stopIncomingAlert();
  stopIncomingEarlyMediaLoop(st.incomingInvitation || st.session);
  st.incomingInvitation = null;
  ui.setButtons();
  ui.setStatus("Idle");
}

// Export function to update registration complete time from primary.js
export function setRegistrationComplete() {
  lastRegistrationCompleteTime = Date.now();
  logLine(`[${nowISO()}] [incoming] Registration completed at ${lastRegistrationCompleteTime}`);
}

export async function handleIncomingCall(SIP, st, ui, invitation) {
  const callerUser = invitation.remoteIdentity?.uri?.user || "Unknown";
  const callerDisplay = invitation.remoteIdentity?.displayName || callerUser;
  let wasAnswered = false;

  const ctx = getInboundDiagContext(st, invitation);
  invitation.__callMediaDiag = ctx;

  sendCallMediaEvent({
    type: 'media-offer-incoming',
    ...ctx,
    t_incomingReceived: new Date().toISOString(),
    msg: 'Incoming call offer (INVITE) received',
  });

  // CRITICAL: Reject all incoming calls if not registered yet (prevents phantom calls during login)
  if (!st.registered) {
    logLine(`[${nowISO()}] [incoming] ⚠️ REJECTED (not registered) from ${callerDisplay}`);
    try {
      invitation.reject({ statusCode: 480 });
    } catch (err) {
      logLine(`[${nowISO()}] [incoming] Could not reject: ${err?.message || err}`);
    }
    return;
  }

  // Second gate: Reject calls in first 3 seconds after registration (prevents iPhone post-login phantom calls)
  if (lastRegistrationCompleteTime !== null) {
    const timeSinceRegComplete = Date.now() - lastRegistrationCompleteTime;
    if (timeSinceRegComplete < 3000) {
      logLine(`[${nowISO()}] [incoming] ⚠️ BLOCKED ${timeSinceRegComplete}ms after reg from ${callerDisplay}`);
      try {
        invitation.reject({ statusCode: 480 });
      } catch (err) {}
      return;
    }
  }

  // Tertiary gate: ignore calls in first 5 seconds of page load (page startup protection)
  const timeSincePageLoad = Date.now() - pageLoadTimeForIncoming;
  if (timeSincePageLoad < 5000) {
    logLine(`[${nowISO()}] [incoming] ⚠️ BLOCKED ${timeSincePageLoad}ms after pageload from ${callerDisplay}`);
    try {
      invitation.reject({ statusCode: 480 });
    } catch (err) {}
    return;
  }

  logLine(`[${nowISO()}] [incoming] ==================== INCOMING CALL ====================`);
  logLine(`[${nowISO()}] [incoming] Caller: ${callerDisplay} (${callerUser})`);

  if (st.session) {
    try {
      invitation.reject({ statusCode: 486 });
    } catch (err) {
      logLine(`[${nowISO()}] [incoming] ERROR rejecting busy call: ${err?.message || err}`);
    }
    return;
  }

  st.incomingInvitation = invitation;
  focusDialTabForIncoming();
  ui.setStatus(`Incoming: ${callerDisplay}`);
  ui.setButtons();
  startIncomingAlert(callerDisplay, { showBanner: false });

  const stateListener = (newState) => {
    logLine(`[${nowISO()}] [incoming:state] ${newState}`);
    if (newState === SIP.SessionState.Terminating) {
      endIncomingAlert(st, ui, "state-terminating");
      return;
    }

    if (newState === SIP.SessionState.Establishing) {
      ui.setStatus(`Answering ${callerDisplay}...`);
      return;
    }

    if (newState === SIP.SessionState.Established) {
      wasAnswered = true;
      window.callHistory?.addCall?.(callerUser, "answered", 0, {
        sipCode: 200,
        sipReason: "OK",
      });
      stopIncomingAlert();
      st.session = invitation;
      ui.setStatus(`On call with ${callerDisplay}`);
      ui.setButtons();
      if (window.callTimer) window.callTimer.start();
      attachIncomingRemoteAudio(invitation, ui);
      const _ctx = getInboundDiagContext(st, invitation);
      bindPeerConnection(invitation, "inbound", { aor: _ctx.aor, callId: _ctx.callId });

      try {
        const audioEl = ui?.remoteAudio?.();
        if (audioEl && !audioEl.__callMediaNoPlayTimer) {
          audioEl.__callMediaNoPlayTimer = setTimeout(() => {
            try {
              if (audioEl.__callMediaPlayed) return;
              sendCallMediaEvent({
                type: 'no-remote-audio-play',
                ..._ctx,
                msg: 'Remote audio did not start playing within 10s after establish',
              });
            } catch {}
          }, 10000);
        }
      } catch {}

      try {
        const pc = invitation?.sessionDescriptionHandler?.peerConnection;
        if (pc) scheduleMediaStatsSnapshots(pc, 'inbound', _ctx);
      } catch {}

      sendCallMediaEvent({
        type: 'call-established',
        ..._ctx,
        t_established: new Date().toISOString(),
        msg: 'Inbound call established',
      });
      
      // Register as primary session with dual session manager
      if (!dualSessionManager.primary) {
        dualSessionManager.setPrimary(st);
        logLine(`[${nowISO()}] [session:inbound] Registered as primary session`);
      }
      return;
    }

    if (newState === SIP.SessionState.Terminated) {
      if (!wasAnswered) {
        window.callHistory?.addCall?.(callerUser, "missed", 0, {
          sipCode: 480,
          sipReason: "Temporarily Unavailable",
        });
      }
      endIncomingAlert(st, ui, "state-terminated");
      stopIncomingEarlyMediaLoop(invitation);

      sendCallMediaEvent({
        type: 'call-ended',
        ...getInboundDiagContext(st, invitation),
        t_ended: new Date().toISOString(),
        msg: 'Inbound call terminated',
      });
      
      // Remove from dual session manager
      dualSessionManager.removeSession(st);
      
      cleanupIncomingState(st, ui);
    }
  };

  invitation.stateChange?.addListener?.(stateListener);
  invitation.delegate = {
    onCancel: () => {
      endIncomingAlert(st, ui, "remote-cancel");
    },
    onBye: () => {
      endIncomingAlert(st, ui, "remote-bye");
    },
  };

  try {
    invitation.progress();
  } catch (err) {
    logLine(`[${nowISO()}] [incoming] ERROR sending ringing: ${err?.message || err}`);
  }
}

export async function handleIncomingCallIsolated(SIP, st, ui, invitation) {
  return handleIncomingCall(SIP, st, ui, invitation);
}

export async function answerIncomingCallIsolated(SIP, st, ui) {
  const invitation = st.incomingInvitation;
  if (!invitation) return;

  const caller = invitation.remoteIdentity?.uri?.user || "Unknown";
  const callerDisplay = invitation.remoteIdentity?.displayName || caller;

  stopIncomingAlert();
  const t_answerClicked = new Date().toISOString();
  const micOk = await ensureMicAccess(ui.setStatus);
  if (!micOk) {
    try {
      invitation.reject({ statusCode: 480 });
    } catch {}
    cleanupIncomingState(st, ui);
    ui.setStatus("Microphone access denied");
    return;
  }

  st.incomingInvitation = null;
  ui.setStatus(`Answering ${callerDisplay}...`);

  const aor = invitation.localIdentity?.uri
    ? `${invitation.localIdentity.uri.user}@${invitation.localIdentity.uri.host}`
    : null;
  const callId = invitation.request?.callId || null;

  sendCallMediaEvent({
    type: 'answer-clicked',
    ...getInboundDiagContext(st, invitation),
    t_answerClicked,
    hasLocalStream: Boolean(getLocalStream()),
    msg: 'User clicked answer',
  });

  observeRemoteAudioPlay(ui, getInboundDiagContext(st, invitation), { t_answerClicked });

  // LTE pre-flight check for incoming answer — same as outbound path.
  // Must run BEFORE accept() to prevent answering with 0.0.0.0:9 SDP.
  if (isMobileCompatModeEnabled()) {
    logLine(`[${nowISO()}] [incoming:answer] LTE mode: running pre-flight TURN relay check...`);
    ui.setStatus("Checking media relay...");

    sendCallMediaEvent({
      type: 'answer-preflight-start',
      ...getInboundDiagContext(st, invitation),
      aor,
      callId,
      t_answerClicked,
      msg: 'Starting LTE answer preflight (relay candidate check)',
    });

    let preCheck;
    try {
      preCheck = await checkLteRelayAvailable(ICE_SERVERS, 8000, {
        ...getInboundDiagContext(st, invitation),
        aor,
        callId,
        dir: 'inbound',
        peer: caller,
        lteMode: true,
        mode: 'lte',
        selectedProfile: st.selectedProfile || 'lte',
      });
    } catch {
      preCheck = { relay: 0, total: 0, timedOut: true };
    }
    logLine(`[${nowISO()}] [incoming:answer] pre-flight result: relay=${preCheck.relay} total=${preCheck.total} timedOut=${preCheck.timedOut}`);

    sendCallMediaEvent({
      type: 'answer-preflight-result',
      ...getInboundDiagContext(st, invitation),
      aor,
      callId,
      t_answerClicked,
      relay: preCheck.relay,
      total: preCheck.total,
      timedOut: preCheck.timedOut,
      msg: `LTE answer preflight result: relay=${preCheck.relay} total=${preCheck.total} timedOut=${preCheck.timedOut}`,
    });

    sendCallMediaEvent({
      type: preCheck.relay > 0 ? 'preflight-ok' : 'preflight-fail',
      code: preCheck.relay === 0 ? (preCheck.timedOut ? 'MEDIA-E002' : 'MEDIA-E001') : undefined,
      aor, callId, lteMode: true, dir: 'inbound',
      username: st.account?.rawUsername || st.account?.username || undefined,
      domain: st.account?.domain || undefined,
      mode: 'lte',
      selectedProfile: st.selectedProfile || 'lte',
      peer: caller,
      relay: preCheck.relay, total: preCheck.total, timedOut: preCheck.timedOut,
      msg: preCheck.relay > 0 ? 'TURN relay reachable' : (preCheck.timedOut ? 'ICE gathering timed out' : 'Zero relay candidates'),
    });
    if (preCheck.relay === 0) {
      const errCode = preCheck.timedOut ? 'MEDIA-E002' : 'MEDIA-E001';
      const errDef = MEDIA_ERRORS[errCode];
      logLine(`[${nowISO()}] [incoming:answer] ${errCode} — rejecting call before accept(): ${errDef.longDescription}`);
      ui.setStatus(errDef.userMessage);
      try { invitation.reject({ statusCode: 488 }); } catch {}
      cleanupIncomingState(st, ui);
      return;
    }
    logLine(`[${nowISO()}] [incoming:answer] pre-flight OK — ${preCheck.relay} relay candidate(s) — proceeding`);
  }

  try {
    sendCallMediaEvent({
      type: 'answer-accept-start',
      ...getInboundDiagContext(st, invitation),
      aor,
      callId,
      t_answerClicked,
      msg: 'Starting invitation.accept() for inbound answer',
    });

    const remoteProfile = getHeaderValue(invitation?.request, 'X-WebRTC-Profile');
    const forceRelayForThisCall = String(remoteProfile || '').toLowerCase() === 'lte';

    try {
      sendCallMediaEvent({
        type: 'inbound-remote-profile',
        ...getInboundDiagContext(st, invitation),
        remoteProfile: remoteProfile || undefined,
        forceRelayForThisCall,
        msg: `Remote caller profile header: ${remoteProfile || 'none'}`,
      });
    } catch {}

    const inviteOptions = {
      sessionDescriptionHandlerModifiers: [g711OnlyModifier],
      sessionDescriptionHandlerOptions: {
        constraints: { audio: true, video: false },
        localMediaStream: getLocalStream() || undefined,
        peerConnectionConfiguration: forceRelayForThisCall ? {
          iceServers: ICE_SERVERS,
          iceTransportPolicy: 'relay',
        } : undefined,
      },
    };

    await invitation.accept(inviteOptions);

    sendCallMediaEvent({
      type: 'answer-accept-success',
      ...getInboundDiagContext(st, invitation),
      aor,
      callId,
      t_answerClicked,
      msg: 'invitation.accept() resolved',
    });

    startIncomingEarlyMediaLoop(invitation, ui);

    sendCallMediaEvent({
      type: 'media-answer-incoming',
      ...getInboundDiagContext(st, invitation),
      t_answerClicked,
      msg: 'Sent 200 OK (answer)',
    });

    // LTE relay guard — monitors ICE gathering in relay-only mode after answer.
    guardLteRelayReadiness(invitation, {
      aor,
      callId,
      dir: 'inbound',
      onFail: (code, userMessage) => {
        logLine(`[${nowISO()}] [incoming:answer] ${code} — aborting call: ${userMessage}`);
        ui.setStatus(userMessage);
        try { invitation.bye(); } catch {}
        cleanupIncomingState(st, ui);
      },
    });

    // Keep legacy event (used by existing docs), but enrich for new admin filters.
    sendCallMediaEvent({
      type: 'call-answer',
      ...getInboundDiagContext(st, invitation),
      t_answerClicked,
      msg: 'Incoming call answered',
    });
  } catch (err) {
    logLine(`[${nowISO()}] [incoming:answer] ERROR accepting call: ${err?.message || err}`);

    sendCallMediaEvent({
      type: 'answer-accept-failed',
      ...getInboundDiagContext(st, invitation),
      aor,
      callId,
      t_answerClicked,
      msg: `invitation.accept() failed: ${err?.message || err}`,
    });

    stopLocalAudioStream();
    st.session = null;
    ui.setButtons();
    ui.setStatus("Failed to answer call");
  }
}

export async function rejectIncomingCallIsolated(st, ui) {
  const invitation = st.incomingInvitation;
  if (!invitation) return;

  const caller = invitation.remoteIdentity?.uri?.user || "Unknown";

  stopIncomingAlert();
  try {
    invitation.reject({ statusCode: 603 });
    window.callHistory?.addCall?.(caller, "rejected", 0, {
      sipCode: 603,
      sipReason: "Decline",
    });
  } catch (err) {
    logLine(`[${nowISO()}] [incoming:reject] ERROR rejecting: ${err?.message || err}`);
  }
  cleanupIncomingState(st, ui);
}
