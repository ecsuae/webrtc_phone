// www/app/sipCallIncoming.js
// ISOLATED INCOMING CALL HANDLER
// Purpose: Handle all incoming call logic separately from outgoing calls
// This prevents interference with working outgoing call code

import { nowISO } from "./config.js";
import { logLine } from "./log.js";
import { g711OnlyModifier } from "./sdp.js";
import { bindPeerConnection } from "./pcDebug.js";
import { ensureMicAccess, getLocalStream, stopLocalAudioStream } from "./media.js";

let incomingRingtoneTimer = null;
let incomingRingtoneCtx = null;
let incomingVibrationTimer = null;
let incomingAutoStopTimer = null;

function ensureIncomingBanner() {
  let banner = document.getElementById("incomingAlertBanner");
  if (banner) return banner;

  banner = document.createElement("div");
  banner.id = "incomingAlertBanner";
  banner.style.position = "fixed";
  banner.style.left = "12px";
  banner.style.right = "12px";
  banner.style.top = "12px";
  banner.style.zIndex = "9999";
  banner.style.padding = "12px 14px";
  banner.style.borderRadius = "10px";
  banner.style.background = "#16a34a";
  banner.style.color = "#ffffff";
  banner.style.fontWeight = "700";
  banner.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)";
  banner.style.display = "none";
  banner.style.textAlign = "center";

  const title = document.createElement("div");
  title.id = "incomingAlertTitle";
  title.style.marginBottom = "10px";
  banner.appendChild(title);

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";
  actions.style.justifyContent = "center";

  const answerBtn = document.createElement("button");
  answerBtn.type = "button";
  answerBtn.id = "incomingBannerAnswer";
  answerBtn.textContent = "Answer";
  answerBtn.style.border = "none";
  answerBtn.style.borderRadius = "8px";
  answerBtn.style.padding = "8px 14px";
  answerBtn.style.fontWeight = "700";
  answerBtn.style.cursor = "pointer";
  answerBtn.style.background = "#ffffff";
  answerBtn.style.color = "#0f766e";

  const rejectBtn = document.createElement("button");
  rejectBtn.type = "button";
  rejectBtn.id = "incomingBannerReject";
  rejectBtn.textContent = "Reject";
  rejectBtn.style.border = "1px solid #ffffff";
  rejectBtn.style.borderRadius = "8px";
  rejectBtn.style.padding = "8px 14px";
  rejectBtn.style.fontWeight = "700";
  rejectBtn.style.cursor = "pointer";
  rejectBtn.style.background = "transparent";
  rejectBtn.style.color = "#ffffff";

  answerBtn.addEventListener("click", () => {
    const btn = document.getElementById("btnAnswer");
    btn?.click();
  });

  rejectBtn.addEventListener("click", () => {
    const btn = document.getElementById("btnReject");
    btn?.click();
  });

  actions.appendChild(answerBtn);
  actions.appendChild(rejectBtn);
  banner.appendChild(actions);
  document.body.appendChild(banner);
  return banner;
}

function showIncomingBanner(callerDisplay) {
  const banner = ensureIncomingBanner();
  const title = document.getElementById("incomingAlertTitle");
  if (title) title.textContent = `Incoming call: ${callerDisplay}`;
  banner.style.display = "block";
}

function hideIncomingBanner() {
  const banner = document.getElementById("incomingAlertBanner");
  if (banner) banner.style.display = "none";
}

function focusDialTabForIncoming() {
  const dialBtn = document.querySelector('.tab-btn[data-tab="dial-tab"]');
  const allBtns = document.querySelectorAll(".tab-btn");
  const allTabs = document.querySelectorAll(".tab-content");
  const dialTab = document.getElementById("dial-tab");

  allBtns.forEach((btn) => btn.classList.remove("active"));
  allTabs.forEach((tab) => tab.classList.remove("active"));
  if (dialBtn) dialBtn.classList.add("active");
  if (dialTab) dialTab.classList.add("active");
}

function ringOnce() {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;

  if (!incomingRingtoneCtx) {
    incomingRingtoneCtx = new Ctx();
  }

  if (incomingRingtoneCtx.state === "suspended") {
    incomingRingtoneCtx.resume().catch(() => {});
  }

  const now = incomingRingtoneCtx.currentTime;
  const gain = incomingRingtoneCtx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
  gain.connect(incomingRingtoneCtx.destination);

  const osc = incomingRingtoneCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, now);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.38);
}

function startIncomingAlert(callerDisplay) {
  // Clear any stale alert loop before starting a new one
  stopIncomingAlert();

  showIncomingBanner(callerDisplay);

  if (!incomingRingtoneTimer) {
    ringOnce();
    incomingRingtoneTimer = setInterval(ringOnce, 1200);
  }

  if (navigator.vibrate) {
    navigator.vibrate([250, 150, 250, 800]);
    if (!incomingVibrationTimer) {
      incomingVibrationTimer = setInterval(() => {
        navigator.vibrate([250, 150, 250, 800]);
      }, 1700);
    }
  }

  if (window.Notification && Notification.permission === "granted") {
    try {
      new Notification("Incoming call", { body: callerDisplay });
    } catch (_) {
      // ignore notification failures
    }
  }

  // Failsafe: stop ringtone after 60s if no SIP terminal event arrives
  incomingAutoStopTimer = setTimeout(() => {
    stopIncomingAlert();
    logLine(`[${nowISO()}] [incoming] Failsafe stop: incoming alert auto-stopped after timeout`);
  }, 60000);
}

function stopIncomingAlert() {
  hideIncomingBanner();

  if (incomingRingtoneTimer) {
    clearInterval(incomingRingtoneTimer);
    incomingRingtoneTimer = null;
  }

  if (incomingVibrationTimer) {
    clearInterval(incomingVibrationTimer);
    incomingVibrationTimer = null;
  }

  if (incomingAutoStopTimer) {
    clearTimeout(incomingAutoStopTimer);
    incomingAutoStopTimer = null;
  }

  if (navigator.vibrate) {
    navigator.vibrate(0);
  }
}

/**
 * Attach remote audio for incoming calls
 * Handles both early media (ringing tones) and established call audio
 */
function attachIncomingRemoteAudio(session, ui) {
  try {
    const audioEl = ui?.remoteAudio?.();
    const pc = session?.sessionDescriptionHandler?.peerConnection;
    
    if (!audioEl || !pc) {
      logLine(`[${nowISO()}] [incoming:media] attachRemoteAudio skipped: audioEl=${!!audioEl}, pc=${!!pc}`);
      return;
    }

    // Prevent duplicate binding
    if (pc.__incomingAudioBound) {
      logLine(`[${nowISO()}] [incoming:media] Already bound to this PC`);
      return;
    }
    
    pc.__incomingAudioBound = true;
    logLine(`[${nowISO()}] [incoming:media] Attaching remote audio handler`);
    logLine(`[${nowISO()}] [incoming:media] PC state: connection=${pc.connectionState}, ice=${pc.iceConnectionState}, signaling=${pc.signalingState}`);

    const bindAndPlay = (stream, trackKind = "audio") => {
      if (!stream) {
        logLine(`[${nowISO()}] [incoming:media] bindAndPlay called with null stream`);
        return;
      }
      
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      audioEl.muted = false;
      audioEl.volume = 1;
      audioEl.srcObject = stream;
      
      logLine(`[${nowISO()}] [incoming:media] Remote ${trackKind} bound to audio element`);
      logLine(`[${nowISO()}] [incoming:media] Stream tracks: ${stream?.getTracks?.()?.length || 0}`);
      
      const playPromise = audioEl.play?.();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise
          .then(() => {
            logLine(`[${nowISO()}] [incoming:media] ✅ Audio playing: time=${audioEl.currentTime}, paused=${audioEl.paused}`);
          })
          .catch((err) => {
            logLine(`[${nowISO()}] [incoming:media] ❌ Play blocked: ${err?.name || err?.message || err}`);
          });
      }
    };

    // Listen for track events (remote audio arrives)
    pc.addEventListener("track", (ev) => {
      const [stream] = ev.streams || [];
      logLine(`[${nowISO()}] [incoming:media] ontrack: kind=${ev.track?.kind}, enabled=${ev.track?.enabled}, readyState=${ev.track?.readyState}`);
      logLine(`[${nowISO()}] [incoming:media] Streams: ${ev.streams?.length || 0}, PC: ${pc.connectionState}`);
      
      if (stream) {
        bindAndPlay(stream, ev.track?.kind || "audio");
      } else if (ev.track) {
        logLine(`[${nowISO()}] [incoming:media] Creating MediaStream from single track`);
        const singleTrackStream = new MediaStream([ev.track]);
        bindAndPlay(singleTrackStream, ev.track.kind || "audio");
      } else {
        logLine(`[${nowISO()}] [incoming:media] ontrack fired but no stream/track available`);
      }
    }, { once: false });

    // Check for existing tracks (in case track event already fired)
    const existingTrack = pc.getReceivers?.().find((r) => r.track && r.track.kind === "audio")?.track;
    if (existingTrack) {
      logLine(`[${nowISO()}] [incoming:media] Found existing audio track, binding now`);
      bindAndPlay(new MediaStream([existingTrack]), existingTrack.kind);
    }
  } catch (err) {
    logLine(`[${nowISO()}] [incoming:media] ERROR in attachRemoteAudio: ${err?.message || err}`);
  }
}

/**
 * Start periodic attempt to attach remote audio
 * Useful for early media scenarios where peer connection is still being established
 */
function startIncomingEarlyMediaLoop(session, ui) {
  try {
    if (session.__incomingEarlyMediaTimer) {
      logLine(`[${nowISO()}] [incoming:media] Early media timer already running`);
      return;
    }
    
    let attempts = 0;
    const maxAttempts = 40;
    
    logLine(`[${nowISO()}] [incoming:media] Starting early media attach loop`);
    
    session.__incomingEarlyMediaTimer = setInterval(() => {
      attempts += 1;
      attachIncomingRemoteAudio(session, ui);
      
      // Stop after max attempts or session terminated
      if (session?.state === "Terminated" || attempts >= maxAttempts) {
        clearInterval(session.__incomingEarlyMediaTimer);
        session.__incomingEarlyMediaTimer = null;
        logLine(`[${nowISO()}] [incoming:media] Early media loop stopped (attempts=${attempts})`);
      }
    }, 250);
  } catch (err) {
    logLine(`[${nowISO()}] [incoming:media] ERROR starting early media loop: ${err?.message || err}`);
  }
}

/**
 * MAIN INCOMING CALL HANDLER
 * Called when onInvite delegate fires in UserAgent
 */
export function handleIncomingCallIsolated(SIP, st, ui, invitation) {
  logLine(`[${nowISO()}] [incoming] ==================== INCOMING CALL ====================`);
  
  const callerUser = invitation.remoteIdentity?.uri?.user || 'Unknown';
  const callerDisplay = invitation.remoteIdentity?.displayName || callerUser;
  
  logLine(`[${nowISO()}] [incoming] Caller: ${callerDisplay} (${callerUser})`);
  logLine(`[${nowISO()}] [incoming] From: ${invitation.remoteIdentity?.uri?.toString() || 'unknown'}`);
  logLine(`[${nowISO()}] [incoming] Call-ID: ${invitation.request?.callId || 'unknown'}`);
  logLine(`[${nowISO()}] [incoming] State: ${invitation.state}`);
  
  // Check if already in a call
  if (st.session) {
    logLine(`[${nowISO()}] [incoming] ❌ Already in call, auto-rejecting from ${callerUser}`);
    try {
      invitation.reject({ statusCode: 486 }); // Busy Here
      logLine(`[${nowISO()}] [incoming] Sent 486 Busy Here`);
    } catch (err) {
      logLine(`[${nowISO()}] [incoming] ERROR rejecting: ${err?.message || err}`);
    }
    return;
  }

  logLine(`[${nowISO()}] [incoming] ✅ No active session, processing incoming call`);
  
  // Store invitation (but don't accept yet - wait for user action)
  st.incomingInvitation = invitation;

  // Force dial tab in front so Answer/Reject controls are visible
  focusDialTabForIncoming();
  
  // Update UI to show incoming call
  ui.setStatus(`📞 Incoming: ${callerDisplay}`);
  ui.setButtons();
  
  logLine(`[${nowISO()}] [incoming] UI updated - showing Answer/Reject buttons`);

  // Start audible/visual incoming alert
  startIncomingAlert(callerDisplay);
  logLine(`[${nowISO()}] [incoming] ✅ Incoming alert started (ringtone + banner)`);

  // Setup state change listener
  const stateListener = (newState) => {
    logLine(`[${nowISO()}] [incoming:state] ${newState}`);
    
    if (newState === SIP.SessionState.Establishing) {
      ui.setStatus(`Answering ${callerDisplay}...`);
      logLine(`[${nowISO()}] [incoming:state] Call being answered`);
    }
    else if (newState === SIP.SessionState.Established) {
      logLine(`[${nowISO()}] [incoming:state] ✅ Call ESTABLISHED with ${callerDisplay}`);
      stopIncomingAlert();
      st.session = invitation;
      ui.setStatus(`On call with ${callerDisplay}`);
      ui.setButtons();
      
      // Start call timer
      if (window.callTimer) {
        window.callTimer.start();
      }
      
      // Attach remote audio
      attachIncomingRemoteAudio(invitation, ui);
      bindPeerConnection(invitation, "inbound");
    }
    else if (newState === SIP.SessionState.Terminated) {
      logLine(`[${nowISO()}] [incoming:state] Call TERMINATED (${newState})`);
      stopIncomingAlert();
      
      // Cleanup early media timer
      if (invitation.__incomingEarlyMediaTimer) {
        clearInterval(invitation.__incomingEarlyMediaTimer);
        invitation.__incomingEarlyMediaTimer = null;
      }
      
      st.session = null;
      st.incomingInvitation = null;
      stopLocalAudioStream();
      ui.setButtons();
      ui.setStatus("Idle");
      
      // Stop call timer
      if (window.callTimer) {
        window.callTimer.stop();
      }
      
      logLine(`[${nowISO()}] [incoming:state] Cleanup complete`);
    }
  };

  if (invitation.stateChange && typeof invitation.stateChange.addListener === 'function') {
    invitation.stateChange.addListener(stateListener);
    logLine(`[${nowISO()}] [incoming] State change listener attached`);
  } else {
    logLine(`[${nowISO()}] [incoming] ⚠️ Cannot attach state listener`);
  }

  // Explicit SIP.js callback for remote CANCEL before answer
  invitation.delegate = {
    onCancel: () => {
      logLine(`[${nowISO()}] [incoming] Remote side canceled before answer`);
      stopIncomingAlert();
      st.incomingInvitation = null;
      ui.setButtons();
      ui.setStatus("Idle");
    },
  };

  // Send 180 Ringing to caller (but don't accept yet)
  try {
    invitation.progress();
    logLine(`[${nowISO()}] [incoming] ✅ Sent 180 Ringing - waiting for user action`);
  } catch (err) {
    logLine(`[${nowISO()}] [incoming] ERROR sending ringing: ${err?.message || err}`);
  }
  
  logLine(`[${nowISO()}] [incoming] Handler complete - waiting for Answer or Reject`);
}

/**
 * ANSWER INCOMING CALL
 * Called when user clicks Answer button
 */
export async function answerIncomingCallIsolated(SIP, st, ui) {
  logLine(`[${nowISO()}] [incoming:answer] ==================== ANSWERING CALL ====================`);
  
  const invitation = st.incomingInvitation;
  if (!invitation) {
    logLine(`[${nowISO()}] [incoming:answer] ❌ No incoming call to answer`);
    return;
  }
  
  const caller = invitation.remoteIdentity?.uri?.user || 'Unknown';
  const callerDisplay = invitation.remoteIdentity?.displayName || caller;
  
  logLine(`[${nowISO()}] [incoming:answer] Answering call from: ${callerDisplay} (${caller})`);
  
  // Add to call history as answered
  if (window.callHistory) {
    window.callHistory.addCall(caller, 'incoming');
  }

  stopIncomingAlert();
  logLine(`[${nowISO()}] [incoming:answer] ✅ Incoming alert stopped`);
  
  // Ensure microphone access
  logLine(`[${nowISO()}] [incoming:answer] Requesting microphone access...`);
  const micOk = await ensureMicAccess(ui.setStatus);
  
  if (!micOk) {
    logLine(`[${nowISO()}] [incoming:answer] ❌ Microphone access denied`);
    
    // Reject the call
    try {
      invitation.reject({ statusCode: 480 }); // Temporarily Unavailable
      logLine(`[${nowISO()}] [incoming:answer] Sent 480 (no microphone)`);
    } catch (err) {
      logLine(`[${nowISO()}] [incoming:answer] ERROR rejecting: ${err?.message || err}`);
    }
    
    st.incomingInvitation = null;
    st.session = null;
    ui.setButtons();
    ui.setStatus("Microphone access denied");
    return;
  }
  
  logLine(`[${nowISO()}] [incoming:answer] ✅ Microphone access granted`);
  
  // Clear ringing state
  st.incomingInvitation = null;
  
  ui.setStatus(`Answering ${callerDisplay}...`);
  
  try {
    // Get local media stream
    const localStream = getLocalStream();
    logLine(`[${nowISO()}] [incoming:answer] Local stream: ${!!localStream}, tracks=${localStream?.getAudioTracks()?.length || 0}`);
    
    // Accept the call with media options
    const inviteOptions = {
      sessionDescriptionHandlerModifiers: [g711OnlyModifier],
      sessionDescriptionHandlerOptions: {
        constraints: { audio: true, video: false },
        localMediaStream: localStream || undefined,
      }
    };
    
    logLine(`[${nowISO()}] [incoming:answer] Accepting call with options...`);
    await invitation.accept(inviteOptions);
    
    logLine(`[${nowISO()}] [incoming:answer] ✅ Call accepted successfully`);
    logLine(`[${nowISO()}] [incoming:answer] State changes will be handled by state listener`);
    
    // Start early media attachment in case it helps with early audio
    startIncomingEarlyMediaLoop(invitation, ui);
    
  } catch (err) {
    logLine(`[${nowISO()}] [incoming:answer] ❌ ERROR accepting call: ${err?.message || err}`);
    logLine(`[${nowISO()}] [incoming:answer] Stack: ${err?.stack || 'no stack'}`);
    
    ui.setStatus("Failed to answer call");
    st.session = null;
    stopLocalAudioStream();
    ui.setButtons();
  }
}

/**
 * REJECT INCOMING CALL
 * Called when user clicks Reject button or call times out
 */
export async function rejectIncomingCallIsolated(st, ui) {
  logLine(`[${nowISO()}] [incoming:reject] ==================== REJECTING CALL ====================`);
  
  const invitation = st.incomingInvitation;
  if (!invitation) {
    logLine(`[${nowISO()}] [incoming:reject] ❌ No incoming call to reject`);
    return;
  }
  
  const caller = invitation.remoteIdentity?.uri?.user || 'Unknown';
  const callerDisplay = invitation.remoteIdentity?.displayName || caller;
  
  logLine(`[${nowISO()}] [incoming:reject] Rejecting call from: ${callerDisplay} (${caller})`);
  
  // Add to call history as missed
  if (window.callHistory) {
    window.callHistory.addCall(caller, 'missed');
  }

  stopIncomingAlert();
  logLine(`[${nowISO()}] [incoming:reject] ✅ Incoming alert stopped`);
  
  try {
    invitation.reject({ statusCode: 603 }); // Decline
    logLine(`[${nowISO()}] [incoming:reject] ✅ Sent 603 Decline`);
  } catch (err) {
    logLine(`[${nowISO()}] [incoming:reject] ERROR rejecting: ${err?.message || err}`);
  }
  
  // Cleanup
  st.incomingInvitation = null;
  st.session = null;
  ui.setButtons();
  ui.setStatus("Idle");
  
  logLine(`[${nowISO()}] [incoming:reject] Cleanup complete`);
}
