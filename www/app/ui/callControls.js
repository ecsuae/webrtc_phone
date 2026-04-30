// Import hold feature from separate module (isolated to prevent call disruption)
import { initializeHoldButton, isSIPHoldActive, syncHoldButtonUI } from "../features/sipHold.js?v=1773023601";
import { initializeAudioRouteButton } from "./callControlAudioRoute.js?v=1773034001";
import { initializeAddCallButton } from "./callControlAddCall.js";
import { dualSessionManager } from "../features/dualSessionManager.js";
import { nowISO } from "../config.js";
import { logLine } from "../log.js";

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

async function onFeatureCode(st, code, label, successText) {
  if (!st.session) return alert("No active call");
  if (await sendDTMFCode(st, code)) alert(`${label} ${successText}`);
}

export function setupCallControls(SIP, st, ui) {
  const muteBtn = document.getElementById("btnMute");
  const speakerBtn = document.getElementById("btnSpeaker");
  const holdBtn = document.getElementById("btnHold");
  const addCallBtn = document.getElementById("btnAddCall");
  const keypadBtn = document.getElementById("btnKeypad");
  const swapBtn = document.getElementById("btnSwap");
  const transferBtn = document.getElementById("btnTransfer");
  const conferenceBtn = document.getElementById("btnConference");
  const recordBtn = document.getElementById("btnRecord");

  const dtmfOverlay = document.getElementById("dtmfOverlay");
  const dtmfCloseBtn = document.getElementById("btnDtmfClose");
  const dtmfButtons = document.querySelectorAll(".dtmf-btn");

  const closeDtmfOverlay = () => {
    if (!dtmfOverlay) return;
    dtmfOverlay.style.display = "none";
  };

  const openDtmfOverlay = () => {
    if (!dtmfOverlay) return;
    dtmfOverlay.style.display = "flex";
  };

  // Update button visibility based on dual session state
  const updateDualSessionUI = () => {
    const hasDual = dualSessionManager.hasDualSessions();
    const canSwap = hasDual;
    const canConference = hasDual;
    
    // Hide Hold button when dual sessions exist (use Swap instead)
    if (holdBtn) holdBtn.style.display = hasDual ? "none" : "";
    
    if (swapBtn) swapBtn.style.display = canSwap ? "" : "none";
    if (conferenceBtn) conferenceBtn.style.display = canConference ? "" : "none";
    if (addCallBtn) {
      addCallBtn.style.display = "none";
    }
    
    console.log(`[DualSession UI] hasDual=${hasDual}, swap=${canSwap}, conference=${canConference}, holdHidden=${hasDual}`);
  };

  muteBtn?.addEventListener("click", () => onMute(st, muteBtn));
  if (speakerBtn) {
    initializeAudioRouteButton(speakerBtn);
  }

  keypadBtn?.addEventListener("click", () => {
    if (!st.session) {
      alert("No active call");
      return;
    }
    if (!dtmfOverlay) return;
    const visible = dtmfOverlay.style.display !== "none";
    if (visible) closeDtmfOverlay();
    else openDtmfOverlay();
  });

  dtmfCloseBtn?.addEventListener("click", closeDtmfOverlay);
  dtmfOverlay?.addEventListener("click", (e) => {
    if (e.target === dtmfOverlay) closeDtmfOverlay();
  });

  dtmfButtons.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!st.session) {
        alert("No active call");
        return;
      }
      const digit = btn.getAttribute("data-digit") || "";
      if (!digit) return;
      btn.style.transform = "scale(0.96)";
      setTimeout(() => {
        btn.style.transform = "";
      }, 90);
      await sendDTMFCode(st, digit);
    });
  });

  // Initialize hold button using separate module (isolated feature)
  if (holdBtn) {
    initializeHoldButton(holdBtn, st);
  }

  // Add Call button - creates second SIP session
  if (addCallBtn) {
    initializeAddCallButton(SIP, st, ui, addCallBtn);
  }

  // Swap button - swap active and held calls
  swapBtn?.addEventListener("click", async () => {
    if (!dualSessionManager.hasDualSessions()) {
      alert("Need two calls to swap");
      return;
    }
    
    swapBtn.disabled = true;
    const prevLabel = swapBtn.innerHTML;
    swapBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Swapping...';
    
    try {
      await dualSessionManager.swap();
      logLine(`[${nowISO()}] [UI] Swap completed`);
      ui.setStatus("Calls swapped");
    } catch (err) {
      console.error("[Swap] failed:", err);
      alert("Swap failed: " + (err?.message || err));
    } finally {
      swapBtn.disabled = false;
      swapBtn.innerHTML = prevLabel;
    }
  });

  // Listen for dual session state changes
  window.addEventListener("dual-session:state-changed", updateDualSessionUI);
  
  // Listen for hold state changes to update hold button UI
  window.addEventListener("dual-session:hold-changed", () => {
    syncHoldButtonUI();
  });
  
  // Also update when regular session changes (for Add Call button visibility)
  window.addEventListener("ui:buttons-updated", updateDualSessionUI);
  
  // Initial UI update
  updateDualSessionUI();

  transferBtn?.addEventListener("click", async () => {
    const number = prompt("Enter extension to transfer to:");
    if (!number) return;
    await onFeatureCode(st, `*1${number}#`, "Transfer", `to ${number} initiated`);
  });

  // Conference button - merge two calls using SIP REFER
  conferenceBtn?.addEventListener("click", async () => {
    if (!dualSessionManager.hasDualSessions()) {
      alert("Need two calls to conference");
      return;
    }
    
    conferenceBtn.disabled = true;
    const prevLabel = conferenceBtn.innerHTML;
    conferenceBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Conferencing...';
    
    try {
      await dualSessionManager.conference();
      logLine(`[${nowISO()}] [UI] Conference initiated`);
      ui.setStatus("Conference initiated");
    } catch (err) {
      console.error("[Conference] failed:", err);
      alert("Conference failed: " + (err?.message || err));
    } finally {
      conferenceBtn.disabled = false;
      conferenceBtn.innerHTML = prevLabel;
    }
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
