// www/app/main.js
import { bootLog } from "./log.js";
import { defaultsFromBody, el, parseSipAccount, setText } from "./dom.js";
import { createAppState, startAndRegister, stopAndUnregister } from "./sipRegister.js";
import { startCall, hangupCall } from "./sipCall.js";
import { answerIncomingCallIsolated, rejectIncomingCallIsolated } from "./sipCallIncoming.js";
import * as Push from "./push.js";

bootLog();

// Initialize push notifications
Push.init().catch(err => console.warn('Push notifications not available:', err));

const d = defaultsFromBody();
if (el.domain && !el.domain.value) el.domain.value = d.sipDomain;
if (el.wss && !el.wss.value) el.wss.value = d.wssHost;

const st = createAppState();

// Call History Management
const callHistory = {
  calls: [],
  addCall: (number, type, duration = 0) => {
    const timestamp = new Date();
    callHistory.calls.unshift({
      number,
      type, // 'incoming', 'outgoing', 'missed'
      duration,
      timestamp,
      displayTime: timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    // Keep only last 50 calls
    if (callHistory.calls.length > 50) {
      callHistory.calls = callHistory.calls.slice(0, 50);
    }
    callHistory.updateDisplay();
    callHistory.save();
  },
  updateDisplay: () => {
    const list = document.getElementById('historyList');
    if (!list) return;
    
    if (callHistory.calls.length === 0) {
      list.innerHTML = '<li style="text-align: center; padding: 32px 16px; color: #94a3b8;"><i class="fas fa-phone-slash" style="font-size: 32px; display: block; margin-bottom: 8px; opacity: 0.5;"></i>No calls yet</li>';
      return;
    }
    
    list.innerHTML = callHistory.calls.map(call => {
      const typeClass = call.type;
      const typeLabel = call.type === 'incoming' ? 'Incoming' : call.type === 'outgoing' ? 'Outgoing' : 'Missed';
      const icon = call.type === 'incoming' ? 'fa-arrow-down' : call.type === 'outgoing' ? 'fa-arrow-up' : 'fa-phone-slash';
      
      return `<li class="history-item">
        <div class="history-item-left">
          <div class="history-number">
            <span class="history-type ${typeClass}">
              <i class="fas ${icon}"></i> ${typeLabel}
            </span>
            ${call.number}
          </div>
          <div class="history-time">${call.displayTime}</div>
        </div>
      </li>`;
    }).join('');
  },
  save: () => {
    try {
      localStorage.setItem('callHistory', JSON.stringify(callHistory.calls));
    } catch (e) {
      console.warn('Could not save call history:', e);
    }
  },
  load: () => {
    try {
      const saved = localStorage.getItem('callHistory');
      if (saved) {
        callHistory.calls = JSON.parse(saved);
        callHistory.updateDisplay();
      }
    } catch (e) {
      console.warn('Could not load call history:', e);
    }
  }
};

// Load call history on startup
callHistory.load();

const ui = {
  ext: () => el.ext?.value?.trim(),
  domain: () => el.domain?.value?.trim(),
  domainFallback: () => d.sipDomain,
  account: () => parseSipAccount(el.ext?.value, el.domain?.value, d.sipDomain),
  pass: () => el.pass?.value ?? "",
  wss: () => el.wss?.value,
  wssFallback: () => (window.location?.host || d.wssHost || ""),
  dial: () => el.dial?.value?.trim(),
  remoteAudio: () => el.remoteAudio,
  setStatus: (s) => {
    const currentAccount = st.account || ui.account();
    const accountLabel = currentAccount?.username && currentAccount?.domain
      ? `${currentAccount.username}@${currentAccount.domain}`
      : (currentAccount?.username || "-");
    const statusText = st.registered ? accountLabel : s;
    setText(el.status, statusText);
    const indicator = document.getElementById('statusIndicator');
    if (indicator) {
      if (st.registered) {
        indicator.classList.add('connected');
      } else {
        indicator.classList.remove('connected');
      }
    }
  },
  setTransport: (s) => setText(el.tstatus, s),
  setButtons: () => {
    const registered = st.registered;
    const hasIncoming = !!st.incomingInvitation;
    const inCall = !!st.session;
    const dialpadCard = document.getElementById("dialpadCard");
    const accountFields = document.getElementById("accountFields");
    const registrationCard = document.getElementById("registrationCard");
    const refreshBtn = document.getElementById("refreshBtn");
    const logOffBtn = document.getElementById("logOffBtn");
    const callControls = document.getElementById("callControls");

    // Hide/show entire registration card when logged in/out
    if (registrationCard) {
      registrationCard.style.display = registered ? "none" : "";
    }

    // Show dialpad when registered
    if (dialpadCard) {
      dialpadCard.style.display = registered ? "" : "none";
    }

    // Hide hard reload button and show log off button when registered
    if (refreshBtn) {
      refreshBtn.style.display = registered ? "none" : "";
    }
    if (logOffBtn) {
      logOffBtn.style.display = registered ? "" : "none";
    }

    if (accountFields) {
      accountFields.style.display = registered ? "none" : "grid";
    }

    if (el.btnStart) {
      el.btnStart.style.display = registered ? "none" : "";
    }

    if (el.btnStop) {
      el.btnStop.style.display = registered ? "" : "none";
    }

    if (registered) {
      const currentAccount = st.account || ui.account();
      const accountLabel = currentAccount?.username && currentAccount?.domain
        ? `${currentAccount.username}@${currentAccount.domain}`
        : (currentAccount?.username || "-");
      setText(el.status, accountLabel);
    }

    const indicator = document.getElementById('statusIndicator');
    if (indicator) {
      if (registered) {
        indicator.classList.add('connected');
      } else {
        indicator.classList.remove('connected');
      }
    }
    
    if (el.btnStart && el.btnStop) { el.btnStart.disabled = registered; el.btnStop.disabled = !registered; }
    if (el.btnStart && !el.btnStop) el.btnStart.textContent = registered ? "Unregister" : "Register";
    
    // Normal call button only enabled when registered, not in call, and no incoming call
    if (el.btnCall) {
      el.btnCall.disabled = !registered || inCall || hasIncoming;
      el.btnCall.style.display = hasIncoming ? 'none' : '';
    }
    if (el.btnHangup) {
      el.btnHangup.disabled = !inCall;
      el.btnHangup.style.display = hasIncoming ? 'none' : '';
    }
    
    // Answer/Reject buttons only shown when there's an incoming call
    if (el.btnAnswer) {
      el.btnAnswer.disabled = !hasIncoming;
      el.btnAnswer.style.display = hasIncoming ? '' : 'none';
    }
    if (el.btnReject) {
      el.btnReject.disabled = !hasIncoming;
      el.btnReject.style.display = hasIncoming ? '' : 'none';
    }
    
    // Toggle between dialpad and call controls during active call
    const dialTabContent = document.getElementById('dial-tab');
    const dialDisplay = document.querySelector('.dial-display');
    const dialButtons = document.querySelector('.dial-buttons');
    const callActions = document.querySelector('.call-actions');
    
    // Hide dialpad elements when in call, show call controls instead
    if (dialDisplay) {
      dialDisplay.style.display = inCall ? 'none' : '';
    }
    if (dialButtons) {
      dialButtons.style.display = inCall ? 'none' : '';
    }
    // Keep call action buttons visible always (they control their own button visibility)
    if (callActions) {
      callActions.style.display = '';
    }
    
    // Show call controls only during active call
    if (callControls) {
      callControls.style.display = inCall ? 'grid' : 'none';
      if (inCall) {
        // Reset button states and labels
        const muteBtn = document.getElementById('btnMute');
        const speakerBtn = document.getElementById('btnSpeaker');
        const holdBtn = document.getElementById('btnHold');
        const recordBtn = document.getElementById('btnRecord');
        
        if (muteBtn) {
          muteBtn.classList.remove('active');
          muteBtn.innerHTML = '<i class="fas fa-microphone"></i> Mute';
        }
        if (speakerBtn) {
          speakerBtn.classList.remove('active');
          speakerBtn.innerHTML = '<i class="fas fa-volume-down"></i> Earpiece';
        }
        if (holdBtn) {
          holdBtn.classList.remove('active');
          holdBtn.innerHTML = '<i class="fas fa-pause"></i> Hold';
        }
        if (recordBtn) {
          recordBtn.classList.remove('active');
          recordBtn.innerHTML = '<i class="fas fa-circle"></i> Record';
        }
        
        // Ensure audio element starts with earpiece volume
        const audioEl = document.getElementById('remoteAudio');
        if (audioEl) {
          audioEl.volume = 0.7;
          audioEl.muted = false;
        }
      }
    }
  },
};

ui.setStatus("Idle"); ui.setTransport("-"); ui.setButtons();

const SIP = window.SIP;
if (!SIP) ui.setStatus("SIP.js not loaded");

if (el.btnStart && el.btnStop) {
  el.btnStart.addEventListener("click", () => startAndRegister(SIP, st, ui));
  el.btnStop.addEventListener("click", () => stopAndUnregister(st, ui, false));
} else if (el.btnStart) {
  el.btnStart.addEventListener("click", () => (st.registered ? stopAndUnregister(st, ui, false) : startAndRegister(SIP, st, ui)));
}

// Track outgoing calls
const originalStartCall = startCall;
el.btnCall?.addEventListener("click", () => {
  const number = ui.dial();
  if (number) {
    callHistory.addCall(number, 'outgoing');
  }
  originalStartCall(SIP, st, ui);
});

// End call handler
el.btnHangup?.addEventListener("click", () => hangupCall(st, ui, false));
el.btnAnswer?.addEventListener("click", () => answerIncomingCallIsolated(SIP, st, ui));
el.btnReject?.addEventListener("click", () => rejectIncomingCallIsolated(st, ui));

el.dial?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); el.btnCall?.click(); }});
el.pass?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); if (!st.registered) startAndRegister(SIP, st, ui); }});

// ===== Tab Switching =====
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId = btn.getAttribute('data-tab');
    
    // Remove active class from all tabs and buttons
    tabButtons.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    
    // Add active class to clicked button and corresponding content
    btn.classList.add('active');
    document.getElementById(tabId)?.classList.add('active');
  });
});

// ===== Call Timer =====
let callStartTime = null;
let callTimerInterval = null;

const callTimer = {
  start: () => {
    if (callStartTime) return;
    callStartTime = Date.now();
    const timerDisplay = document.getElementById('timerDisplay');
    const callTimerDiv = document.getElementById('callTimer');
    
    if (callTimerDiv) callTimerDiv.style.display = 'block';
    if (callTimerInterval) clearInterval(callTimerInterval);
    
    callTimerInterval = setInterval(() => {
      if (!callStartTime) return;
      const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;
      if (timerDisplay) {
        timerDisplay.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
    }, 1000);
  },
  
  stop: () => {
    if (callTimerInterval) { clearInterval(callTimerInterval); callTimerInterval = null; }
    callStartTime = null;
    const callTimerDiv = document.getElementById('callTimer');
    if (callTimerDiv) { callTimerDiv.style.display = 'none'; document.getElementById('timerDisplay').textContent = '00:00:00'; }
  }
};

// Helper function to send DTMF / feature codes via dialpad
const sendDTMFCode = async (code) => {
  if (!st.session) { alert('No active call'); return false; }
  const dialInput = document.getElementById('dial');
  if (!dialInput) return false;
  
  for (const digit of code) {
    const dialBtn = document.querySelector(`.dial-btn[data-digit="${digit}"]`);
    if (dialBtn) {
      dialInput.value += digit;
      dialBtn.style.transform = 'scale(0.95)';
      setTimeout(() => { dialBtn.style.transform = ''; }, 100);
      await new Promise(r => setTimeout(r, 150));
    }
  }
  return true;
};

// ===== Call Control Button Handlers with FusionPBX DTMF Feature Codes =====

// Mute Button
document.getElementById('btnMute')?.addEventListener('click', function() {
  if (!st.session || !st.session.sessionDescriptionHandler) { alert('No active call'); return; }
  const pc = st.session.sessionDescriptionHandler.peerConnection;
  const audioTrack = pc.getSenders().find(s => s.track?.kind === 'audio')?.track;
  if (!audioTrack) { console.warn('[Mute] No audio track'); return; }
  
  audioTrack.enabled = !audioTrack.enabled;
  this.classList.toggle('active');
  this.innerHTML = !audioTrack.enabled ? '<i class="fas fa-microphone-slash"></i> Unmute' : '<i class="fas fa-microphone"></i> Mute';
  console.log(`[Mute] ${audioTrack.enabled ? 'enabled' : 'muted'}`);
});

// Speaker Button - Toggle between earpiece (lower volume) and speakerphone (full volume)
document.getElementById('btnSpeaker')?.addEventListener('click', function() {
  if (!st.session || !st.session.sessionDescriptionHandler) { alert('No active call'); return; }
  this.classList.toggle('active');
  const isSpeaker = this.classList.contains('active');
  const audioEl = document.getElementById('remoteAudio');
  if (audioEl) {
    // Use full volume for speakerphone, lower volume for earpiece
    audioEl.volume = isSpeaker ? 1.0 : 0.7;
    audioEl.muted = false; // Never mute - always allow audio
  }
  this.innerHTML = isSpeaker ? '<i class="fas fa-volume-up"></i> Speaker' : '<i class="fas fa-volume-down"></i> Earpiece';
  console.log(`[Speaker] ${isSpeaker ? 'Speakerphone' : 'Earpiece'} mode, volume: ${audioEl?.volume || 'N/A'}`);
});

// Hold Button
document.getElementById('btnHold')?.addEventListener('click', async function() {
  if (!st.session) { alert('No active call'); return; }
  this.classList.toggle('active');
  const isOnHold = this.classList.contains('active');
  this.innerHTML = isOnHold ? '<i class="fas fa-play"></i> Unhold' : '<i class="fas fa-pause"></i> Hold';
  console.log(`[Hold] ${isOnHold ? 'on hold' : 'resumed'}`);
});

// Transfer Button - *1 code
document.getElementById('btnTransfer')?.addEventListener('click', async function() {
  if (!st.session) { alert('No active call'); return; }
  const number = prompt('Enter extension to transfer to:');
  if (!number) return;
  try {
    const code = '*1' + number + '#';
    if (await sendDTMFCode(code)) {
      console.log(`[Transfer] Sent ${code}`);
      alert(`Feature code ${code} sent\nTransferring to ${number}...`);
    }
  } catch (e) {
    console.error('[Transfer] Error:', e);
    alert('Transfer failed: ' + (e?.message || e));
  }
});

// Conference Button - *8 code
document.getElementById('btnConference')?.addEventListener('click', async function() {
  if (!st.session) { alert('No active call'); return; }
  const number = prompt('Enter extension to add to conference:');
  if (!number) return;
  try {
    const code = '*8' + number + '#';
    if (await sendDTMFCode(code)) {
      console.log(`[Conference] Sent ${code}`);
      alert(`Feature code ${code} sent\nAdding ${number} to conference...`);
    }
  } catch (e) {
    console.error('[Conference] Error:', e);
    alert('Conference failed: ' + (e?.message || e));
  }
});

// Record Button - *2 code
document.getElementById('btnRecord')?.addEventListener('click', async function() {
  if (!st.session) { alert('No active call'); return; }
  this.classList.toggle('active');
  const isRecording = this.classList.contains('active');
  try {
    const code = '*2';
    if (await sendDTMFCode(code)) {
      console.log(`[Record] Sent ${code}`);
      this.innerHTML = isRecording ? '<i class="fas fa-stop-circle"></i> Stop' : '<i class="fas fa-circle"></i> Record';
      alert(`Recording ${isRecording ? 'started' : 'stopped'} on PBX`);
    }
  } catch (e) {
    console.error('[Record] Error:', e);
    this.classList.remove('active');
    this.innerHTML = '<i class="fas fa-circle"></i> Record';
    alert('Record failed: ' + (e?.message || e));
  }
});

// Export for use in sipCall.js
window.callHistory = callHistory;
window.callTimer = callTimer;