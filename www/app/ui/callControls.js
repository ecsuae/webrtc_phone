function sendDTMFCode(st, code) {
  if (!st.session) {
    alert("No active call");
    return false;
  }

  const dialInput = document.getElementById("dial");
  if (!dialInput) return false;

  return [...code].reduce(async (prev, digit) => {
    await prev;
    const dialBtn = document.querySelector(`.dial-btn[data-digit="${digit}"]`);
    if (dialBtn) {
      dialInput.value += digit;
      dialBtn.style.transform = "scale(0.95)";
      setTimeout(() => { dialBtn.style.transform = ""; }, 100);
      await new Promise((r) => setTimeout(r, 150));
    }
  }, Promise.resolve()).then(() => true);
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

  holdBtn?.addEventListener("click", () => {
    if (!st.session) return alert("No active call");
    holdBtn.classList.toggle("active");
    const onHold = holdBtn.classList.contains("active");
    holdBtn.innerHTML = onHold ? '<i class="fas fa-play"></i> Unhold' : '<i class="fas fa-pause"></i> Hold';
  });

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
