// Import hold feature from separate module (isolated to prevent call disruption)
import { initializeHoldButton } from "../features/sipHold.js?v=1773023601";

// ============================================================================
// DTMF SENDING (Feature codes: Transfer, Conference, Record)
// ============================================================================

async function sendDTMFCode(st, code) {
  if (!st.session) {
    alert("No active call");
    return false;
  }

  console.log("[DTMF] Attempting to send:", code);
  
  try {
    // Get the peer connection and audio sender
    const pc = st.session?.sessionDescriptionHandler?.peerConnection;
    if (!pc) {
      console.error("[DTMF] No peer connection available");
      alert("Cannot send DTMF: No peer connection");
      return false;
    }

    const audioSender = pc.getSenders().find(s => s.track?.kind === "audio");
    if (!audioSender) {
      console.error("[DTMF] No audio sender found");
      alert("Cannot send DTMF: No audio track");
      return false;
    }

    const dtmfSender = audioSender.dtmf;
    if (!dtmfSender) {
      console.error("[DTMF] DTMF sender not available");
      alert("Cannot send DTMF: Not supported by browser");
      return false;
    }

    // Wait for DTMF to become ready (with timeout)
    let attempts = 0;
    const maxAttempts = 20; // 20 attempts * 200ms = 4 seconds max wait
    
    while (!dtmfSender.canInsertDTMF && attempts < maxAttempts) {
      console.log(`[DTMF] Waiting for DTMF readiness... attempt ${attempts + 1}/${maxAttempts}`);
      await new Promise(r => setTimeout(r, 200));
      attempts++;
    }

    if (!dtmfSender.canInsertDTMF) {
      console.error("[DTMF] canInsertDTMF is still false after waiting");
      
      // Check SDP for telephone-event support
      const localDesc = pc.localDescription;
      const remoteDesc = pc.remoteDescription;
      console.log("[DTMF] Local SDP:", localDesc?.sdp?.substring(0, 500));
      console.log("[DTMF] Remote SDP:", remoteDesc?.sdp?.substring(0, 500));
      
      const hasTelephoneEvent = localDesc?.sdp?.includes("telephone-event") || 
                                remoteDesc?.sdp?.includes("telephone-event");
      console.log("[DTMF] telephone-event codec present:", hasTelephoneEvent);
      
      alert("Cannot send DTMF: Call not ready. The audio codec may not support DTMF (telephone-event).");
      return false;
    }

    console.log("[DTMF] DTMF sender is ready, inserting DTMF:", code);
    
    // Send DTMF tones using WebRTC RTCDTMFSender (in-band RTP)
    // Duration: 250ms per tone, gap: 150ms between tones
    dtmfSender.insertDTMF(code, 250, 150);
    console.log("[DTMF] insertDTMF completed for:", code);
    
    // Visual feedback: only animate buttons, do NOT add to dial input
    // DTMF should be sent silently without modifying the dial number
    for (const digit of code) {
      const dialBtn = document.querySelector(`.dial-btn[data-digit="${digit}"]`);
      if (dialBtn) {
        dialBtn.style.transform = "scale(0.95)";
        setTimeout(() => { dialBtn.style.transform = ""; }, 100);
      }
      
      // Visual delay to match audio timing
      await new Promise((r) => setTimeout(r, 400));
    }
    
    console.log("[DTMF] Sent successfully:", code);
    return true;
  } catch (err) {
    console.error("[DTMF] Failed to send:", err);
    alert("Failed to send DTMF: " + err.message);
    return false;
  }
}

function onMute(st, btn) {
  if (!st.session?.sessionDescriptionHandler) return alert("No active call");
  const pc = st.session.sessionDescriptionHandler.peerConnection;
  const track = pc.getSenders().find((s) => s.track?.kind === "audio")?.track;
  if (!track) return;
  track.enabled = !track.enabled;
  btn.classList.toggle("active");
  btn.innerHTML = !track.enabled ? '<i class="fas fa-microphone-slash"></i> Unmute' : '<i class="fas fa-microphone"></i> Mute';
}

function onSpeaker(st, btn) {
  if (!st.session?.sessionDescriptionHandler) return alert("No active call");
  btn.classList.toggle("active");
  const isSpeaker = btn.classList.contains("active");
  const audioEl = document.getElementById("remoteAudio");
  if (audioEl) {
    audioEl.volume = isSpeaker ? 1.0 : 0.7;
    audioEl.muted = false;
  }
  btn.innerHTML = isSpeaker ? '<i class="fas fa-volume-up"></i> Speaker' : '<i class="fas fa-volume-down"></i> Earpiece';
}

async function onFeatureCode(st, code, label, successText) {
  if (!st.session) return alert("No active call");
  if (await sendDTMFCode(st, code)) alert(`${label} ${successText}`);
}

export function setupCallControls(st) {
  const muteBtn = document.getElementById("btnMute");
  const speakerBtn = document.getElementById("btnSpeaker");
  const holdBtn = document.getElementById("btnHold");
  const transferBtn = document.getElementById("btnTransfer");
  const conferenceBtn = document.getElementById("btnConference");
  const recordBtn = document.getElementById("btnRecord");

  muteBtn?.addEventListener("click", () => onMute(st, muteBtn));
  speakerBtn?.addEventListener("click", () => onSpeaker(st, speakerBtn));

  // Initialize hold button using separate module (isolated feature)
  if (holdBtn) {
    initializeHoldButton(holdBtn, st);
  }

  transferBtn?.addEventListener("click", async () => {
    const number = prompt("Enter extension to transfer to:");
    if (!number) return;
    await onFeatureCode(st, `*1${number}#`, "Transfer", `to ${number} initiated`);
  });

  conferenceBtn?.addEventListener("click", async () => {
    const number = prompt("Enter extension to add to conference:");
    if (!number) return;
    await onFeatureCode(st, `*8${number}#`, "Conference", `invite ${number} sent`);
  });

  recordBtn?.addEventListener("click", async () => {
    if (!st.session) return alert("No active call");
    recordBtn.classList.toggle("active");
    const recording = recordBtn.classList.contains("active");
    if (await sendDTMFCode(st, "*2")) {
      recordBtn.innerHTML = recording ? '<i class="fas fa-stop-circle"></i> Stop' : '<i class="fas fa-circle"></i> Record';
      alert(`Recording ${recording ? "started" : "stopped"} on PBX`);
    }
  });
}
