import { initializeHoldButton, syncHoldButtonUI } from "../../features/sipHold.js?v=1773023601";
import { initializeAddCallButton } from "../../ui/callControlAddCall.js";
import { dualSessionManager } from "../../features/dualSessionManager.js";
import { nowISO, logLine } from "../desktopLogging.js";
import { initializeAudioRouteButtonDesktop } from "./desktopCallControlAudioRoute.js";
import { sendDesktopDTMFCode } from "./desktopCallControlsDtmf.js";

function onMute(st, btn) {
  if (!st.session?.sessionDescriptionHandler) return alert("No active call");
  const pc = st.session.sessionDescriptionHandler.peerConnection;
  const track = pc.getSenders().find((s) => s.track?.kind === "audio")?.track;
  if (!track) return;
  track.enabled = !track.enabled;
  btn.classList.toggle("active");
  btn.innerHTML = !track.enabled
    ? '<i class="fas fa-microphone-slash"></i> Unmute'
    : '<i class="fas fa-microphone"></i> Mute';
}

async function onFeatureCode(st, code, label, successText) {
  if (!st.session) return alert("No active call");
  if (await sendDesktopDTMFCode(st, code)) alert(`${label} ${successText}`);
}

export function setupDesktopCallControls(SIP, st, ui) {
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

  try {
    if (speakerBtn) speakerBtn.style.display = "none";
  } catch {}

  try {
    if (recordBtn) recordBtn.style.display = "none";
  } catch {}

  const closeDtmfOverlay = () => {
    if (!dtmfOverlay) return;
    dtmfOverlay.style.display = "none";
  };

  const openDtmfOverlay = () => {
    if (!dtmfOverlay) return;
    dtmfOverlay.style.display = "flex";
  };

  const updateDualSessionUI = () => {
    const hasDual = dualSessionManager.hasDualSessions();
    const canSwap = hasDual;
    const canConference = hasDual;

    if (holdBtn) holdBtn.style.display = hasDual ? "none" : "";

    if (swapBtn) swapBtn.style.display = canSwap ? "" : "none";
    if (conferenceBtn) conferenceBtn.style.display = canConference ? "" : "none";
    if (addCallBtn) {
      addCallBtn.style.display = "none";
    }

    console.log(
      `[DualSession UI] hasDual=${hasDual}, swap=${canSwap}, conference=${canConference}, holdHidden=${hasDual}`
    );
  };

  muteBtn?.addEventListener("click", () => onMute(st, muteBtn));
  // Desktop UI: earpiece/speaker route toggle is not supported in this desktop shell.
  // Keep the control hidden and do not attach audio-route behavior.

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
      await sendDesktopDTMFCode(st, digit);
    });
  });

  if (holdBtn) {
    initializeHoldButton(holdBtn, st);
  }

  if (addCallBtn) {
    initializeAddCallButton(SIP, st, ui, addCallBtn);
  }

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

  window.addEventListener("dual-session:state-changed", updateDualSessionUI);

  window.addEventListener("dual-session:hold-changed", () => {
    syncHoldButtonUI();
  });

  window.addEventListener("ui:buttons-updated", updateDualSessionUI);

  updateDualSessionUI();

  transferBtn?.addEventListener("click", async () => {
    const number = prompt("Enter extension to transfer to:");
    if (!number) return;
    await onFeatureCode(st, `*1${number}#`, "Transfer", `to ${number} initiated`);
  });

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
    if (recordBtn.style.display === "none") return;
    if (!st.session) return alert("No active call");
    recordBtn.classList.toggle("active");
    const recording = recordBtn.classList.contains("active");
    if (await sendDesktopDTMFCode(st, "*2")) {
      recordBtn.innerHTML = recording
        ? '<i class="fas fa-stop-circle"></i> Stop'
        : '<i class="fas fa-circle"></i> Record';
      alert(`Recording ${recording ? "started" : "stopped"} on PBX`);
    }
  });
}
