// www/app/sipCall.js
import { nowISO } from "./config.js";
import { formatSipResponse, logLine } from "./log.js";
import { g711OnlyModifier } from "./sdp.js";
import { bindPeerConnection } from "./pcDebug.js";
import { ensureMicAccess, getLocalStream, stopLocalAudioStream } from "./media.js";

/**
 * Attach remote audio for one-way-audio fixes:
 * - listen for ontrack on the peer connection

 * - attach received stream to <audio id="remoteAudio">
 * - call play() to avoid autoplay issues
 */
function attachRemoteAudio(session, ui) {
  try {
    const audioEl = ui?.remoteAudio?.();
    const pc = session?.sessionDescriptionHandler?.peerConnection;
    if (!audioEl || !pc) {
      logLine(`[${nowISO()}] [media] attachRemoteAudio skipped: audioEl=${!!audioEl}, pc=${!!pc}`);
      return;
    }

    if (pc.__remoteAudioBound) return;
    pc.__remoteAudioBound = true;
    logLine(`[${nowISO()}] [media] attaching remote audio: connectionState=${pc.connectionState}, iceConnectionState=${pc.iceConnectionState}, iceGatheringState=${pc.iceGatheringState}, signalingState=${pc.signalingState}`);

    const bindAndPlay = (stream, trackKind = "audio") => {
      if (!stream) return;
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      audioEl.muted = false;
      audioEl.volume = 1;
      audioEl.srcObject = stream;
      logLine(`[${nowISO()}] [media] remote track bound: ${trackKind}, stream.getTracks()=${stream?.getTracks?.()?.length || 0}, audioEl.readyState=${audioEl.readyState}, srcObjectSet=true`);
      const p = audioEl.play?.();
      if (p && typeof p.catch === "function") {
        p
          .then(() => logLine(`[${nowISO()}] [media] audio play() succeeded, currentTime=${audioEl.currentTime}, paused=${audioEl.paused}`))
          .catch((e) => logLine(`[${nowISO()}] [media] audio play blocked`, e?.name || e?.message || e));
      }
    };

    pc.addEventListener("track", (ev) => {
      const [stream] = ev.streams || [];
      logLine(`[${nowISO()}] [media] ontrack event: kind=${ev.track?.kind}, enabled=${ev.track?.enabled}, readyState=${ev.track?.readyState}, streamCount=${ev.streams?.length || 0}, pc.state=${pc.connectionState}`);
      if (stream) {
        bindAndPlay(stream, ev.track?.kind || "audio");
      } else if (ev.track) {
        const singleTrackStream = new MediaStream([ev.track]);
        bindAndPlay(singleTrackStream, ev.track.kind || "audio");
      } else {
        logLine(`[${nowISO()}] [media] ontrack fired but no stream/track`);
      }
    }, { once: false });

    const existingTrack = pc.getReceivers?.().find((r) => r.track && r.track.kind === "audio")?.track;
    if (existingTrack) {
      bindAndPlay(new MediaStream([existingTrack]), existingTrack.kind);
    }
  } catch (e) {
    logLine(`[${nowISO()}] [media] attachRemoteAudio error`, e?.message || e);
  }
}

function startEarlyMediaAttachLoop(session, ui) {
  try {
    if (session.__earlyMediaAttachTimer) return;
    let attempts = 0;
    session.__earlyMediaAttachTimer = setInterval(() => {
      attempts += 1;
      attachRemoteAudio(session, ui);
      if (session?.state === "Terminated" || attempts >= 40) {
        clearInterval(session.__earlyMediaAttachTimer);
        session.__earlyMediaAttachTimer = null;
      }
    }, 250);
  } catch (error) {
    logLine(`[${nowISO()}] [media] early-media attach loop error`, error?.message || error);
  }
}

export async function startCall(SIP, st, ui) {
  const target = ui.dial();
  if (!st.registered || !st.ua) return ui.setStatus("Not registered");
  if (!target) return ui.setStatus("Missing destination");
  if (st.session) return ui.setStatus("Call already active");

  const micOk = await ensureMicAccess(ui.setStatus);
  if (!micOk) return;

  const domain = ui.domain();
  // Encode special characters like * # etc. for SIP URI
  const encodedTarget = encodeURIComponent(target);
  const targetUri = SIP.UserAgent.makeURI(`sip:${encodedTarget}@${domain}`);
  if (!targetUri) {
    stopLocalAudioStream(); // release mic if we fail early
    return ui.setStatus("Invalid destination");
  }

  logLine(`[${nowISO()}] [call] dialing ${target} (encoded: ${encodedTarget})`);

  const remoteAudioElement = ui?.remoteAudio?.();
  if (remoteAudioElement) {
    remoteAudioElement.autoplay = true;
    remoteAudioElement.playsInline = true;
    remoteAudioElement.muted = false;
    remoteAudioElement.volume = 1;
    const prePlayPromise = remoteAudioElement.play?.();
    if (prePlayPromise && typeof prePlayPromise.catch === "function") {
      prePlayPromise.catch((error) => {
        logLine(`[${nowISO()}] [media] pre-play attempt (expected before stream)`, error?.message || error);
      });
    }
  }

  const localStream = getLocalStream();
  logLine(`[${nowISO()}] [call] local audio stream: stream=${!!localStream}, tracks=${localStream?.getAudioTracks()?.length || 0}`);
  if (localStream?.getAudioTracks()[0]) {
    const audioTrack = localStream.getAudioTracks()[0];
    logLine(`[${nowISO()}] [call] local audio track: enabled=${audioTrack.enabled}, readyState=${audioTrack.readyState}`);
  }

  const inviter = new SIP.Inviter(st.ua, targetUri, {
    earlyMedia: true,
    sessionDescriptionHandlerModifiers: [g711OnlyModifier],
    sessionDescriptionHandlerOptions: {
      constraints: { audio: true, video: false },
      localMediaStream: localStream || undefined,
    },
  });

  inviter.delegate = {
    onProgress: (resp) => {
      const info = formatSipResponse(resp);
      if (info) logLine(`[${nowISO()}] [call] progress ${info}`);
      
      // Handle early media (180 Ringing with audio from far end)
      // Attach remote audio immediately so we can hear the real ringtone/IVR
      const code = resp?.message?.statusCode || resp?.statusCode || resp?.message?.status;
      if (code === 180 || code === 183) {
        logLine(`[${nowISO()}] [call] Provisional response (${code}) - attaching early media`);
        attachRemoteAudio(inviter, ui);
        startEarlyMediaAttachLoop(inviter, ui);
      }
    },
    onAccept: (resp) => {
      const info = formatSipResponse(resp);
      if (info) logLine(`[${nowISO()}] [call] accepted ${info}`);
      ui.setStatus("Call established");
    },
    onReject: (resp) => {
      const info = formatSipResponse(resp);
      logLine(`[${nowISO()}] [call] INVITE rejected ${info}`.trim());
      
      ui.setStatus(info ? `Call failed (${info})` : "Call failed");
      stopLocalAudioStream(); // release mic on reject
      st.session = null;
      ui.setButtons();
    },
  };

  st.session = inviter;

  // Keep your existing debugging behavior
  bindPeerConnection(inviter, "outbound");

  inviter.stateChange.addListener((s) => {
    logLine(`[${nowISO()}] [session:outbound] ${s}`);

    // Try to bind again once SDH exists
    bindPeerConnection(inviter, "outbound");

    // Attach remote audio once peer connection exists
    attachRemoteAudio(inviter, ui);

    if (s === SIP.SessionState.Terminated) {
      if (inviter.__earlyMediaAttachTimer) {
        clearInterval(inviter.__earlyMediaAttachTimer);
        inviter.__earlyMediaAttachTimer = null;
      }
      st.session = null;
      stopLocalAudioStream(); // release mic on termination ALWAYS
      ui.setButtons();
      ui.setStatus("Idle");
    }
  });

  ui.setButtons();

  try {
    // DO NOT pre-touch sessionDescriptionHandler here.
    // This keeps behavior close to your previously working outbound call.
    await inviter.invite();
    logLine(`[${nowISO()}] [call] invite sent`);
    ui.setStatus("Calling...");
  } catch (e) {
    logLine(`[${nowISO()}] [error] invite failed`, e?.message || e);
    ui.setStatus("Call failed (invite error)");
    stopLocalAudioStream(); // release mic on error
    st.session = null;
    ui.setButtons();
  }
}

export async function hangupCall(st, ui, silent = false) {
  if (!st.session) return;
  const s = st.session;
  if (!silent) logLine(`[${nowISO()}] [call] hangup`);

  try {
    if (s.state === SIP.SessionState.Established) await s.bye();
    else await s.cancel();
  } catch {}

  stopLocalAudioStream(); // release mic even if SIP cancel fails
  st.session = null;
  ui.setButtons();
  ui.setStatus("Idle");
}

export function handleIncomingCall(SIP, st, ui, invitation) {
  const callerUser = invitation.remoteIdentity?.uri?.user || 'Unknown';
  
  logLine(`[${nowISO()}] [incoming] ========== INCOMING CALL from ${callerUser} ==========`);
  console.warn(`[INCOMING CALL] from ${callerUser}`, invitation);

  // If already in a call, reject the new one
  if (st.session) {
    logLine(`[${nowISO()}] [incoming] Already in call, rejecting from ${callerUser}`);
    try {
      invitation.reject();
    } catch (e) {
      logLine(`[${nowISO()}] [error] Failed to reject`, e?.message || e);
    }
    return;
  }

  logLine(`[${nowISO()}] [incoming] No active session, showing ringing UI`);
  
  // Store the invitation (but don't accept yet!)
  st.incomingInvitation = invitation;
  
  // Update UI to show ringing state
  ui.setStatus(`📞 Ringing: ${callerUser}`);
  ui.setButtons();
  
  // START RINGTONE
  
  logLine(`[${nowISO()}] [incoming] UI updated to show Answer/Reject buttons`);

  // Setup session state listeners for when call is answered
  const stateListener = (s) => {
    logLine(`[${nowISO()}] [session:inbound:state] ${s}`);
    if (s === SIP.SessionState.Establishing) {
      ui.setStatus(`📞 Answering ${callerUser}...`);
    }
    else if (s === SIP.SessionState.Established) {
      logLine(`[${nowISO()}] [incoming] Session established with ${callerUser}`);
      st.session = invitation; // Mark as active session
      ui.setStatus(`On call with ${callerUser}`);
      ui.setButtons();
      
      // Attach remote audio now that session is established
      attachRemoteAudio(invitation, ui);
      bindPeerConnection(invitation, "inbound");
    }
    else if (s === SIP.SessionState.Terminated) {
      logLine(`[${nowISO()}] [incoming] Call terminated (state: ${s})`);
      st.session = null;
      st.incomingInvitation = null;
      stopLocalAudioStream();
      ui.setButtons();
      ui.setStatus("Idle");
    }
  };

  if (invitation.stateChange && typeof invitation.stateChange.addListener === 'function') {
    invitation.stateChange.addListener(stateListener);
    logLine(`[${nowISO()}] [incoming] State listener attached`);
  } else {
    logLine(`[${nowISO()}] [warning] Could not attach state listener`);
  }

  // Send 180 Ringing (but don't accept yet - wait for user to click Answer)
  try {
    invitation.progress();
    logLine(`[${nowISO()}] [incoming] *** 180 RINGING sent - waiting for user to click Answer ***`);
  } catch (e) {
    logLine(`[${nowISO()}] [error] Failed to send ringing response: ${e?.message || e}`);
  }
}

export async function answerIncomingCall(SIP, st, ui) {
  const invitation = st.incomingInvitation;
  if (!invitation) {
    logLine(`[${nowISO()}] [incoming] No incoming call to answer`);
    return;
  }
  
  const caller = invitation.remoteIdentity?.uri?.user || 'Unknown';
  logLine(`[${nowISO()}] [incoming] *** USER CLICKED ANSWER for ${caller} ***`);
  
  // STOP RINGTONE
  
  // Ensure microphone access before answering
  const { ensureMicAccess, getLocalStream } = await import("./media.js");
  const micOk = await ensureMicAccess(ui.setStatus);
  if (!micOk) {
    logLine(`[${nowISO()}] [incoming] Microphone access denied, rejecting call`);
    try {
      invitation.reject();
    } catch (e) {
      logLine(`[${nowISO()}] [error] Failed to reject call`, e?.message || e);
    }
    st.incomingInvitation = null;
    st.session = null;
    ui.setButtons();
    ui.setStatus("Idle");
    return;
  }
  
  // Clear the ringing invitation from state
  st.incomingInvitation = null;
  
  logLine(`[${nowISO()}] [incoming] Accepting call WITH media...`);
  ui.setStatus(`Answering ${caller}...`);

  try {
    // NOW accept the call with proper media options
    const inviteOptions = {
      sessionDescriptionHandlerModifiers: [g711OnlyModifier],
      sessionDescriptionHandlerOptions: {
        constraints: { audio: true, video: false },
        localMediaStream: getLocalStream() || undefined,
      }
    };
    
    await invitation.accept(inviteOptions);
    logLine(`[${nowISO()}] [incoming] *** Call accepted with media ***`);
    // Note: Session state listener will handle UI updates when state becomes Established
  } catch (e) {
    logLine(`[${nowISO()}] [error] Failed to accept call: ${e?.message || e}`);
    ui.setStatus("Failed to answer call");
    st.session = null;
    stopLocalAudioStream();
    ui.setButtons();
  }
}

export async function rejectIncomingCall(st, ui) {
  const invitation = st.incomingInvitation;
  if (!invitation) {
    logLine(`[${nowISO()}] [incoming] No incoming call to reject`);
    return;
  }
  
  const caller = invitation.remoteIdentity?.uri?.user || 'Unknown';
  logLine(`[${nowISO()}] [incoming] Rejecting call from ${caller}`);
  
  // STOP RINGTONE
  
  try {
    invitation.reject();
    logLine(`[${nowISO()}] [incoming] Call rejected`);
  } catch (e) {
    logLine(`[${nowISO()}] [error] Failed to reject call`, e?.message || e);
  }
  
  st.incomingInvitation = null;
  st.session = null;
  stopLocalAudioStream();
  ui.setStatus("Idle");
  ui.setButtons();
}