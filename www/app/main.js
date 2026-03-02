// www/app/main.js
import { bootLog } from "./log.js";
import { defaultsFromBody, el, setText } from "./dom.js";
import { createAppState, startAndRegister, stopAndUnregister } from "./sipRegister.js";
import { startCall, hangupCall, answerIncomingCall, rejectIncomingCall } from "./sipCall.js";
import * as Push from "./push.js";

bootLog();

// Initialize push notifications
Push.init().catch(err => console.warn('Push notifications not available:', err));

const d = defaultsFromBody();
if (el.domain && !el.domain.value) el.domain.value = d.sipDomain;
if (el.wss && !el.wss.value) el.wss.value = d.wssHost;

const st = createAppState();

const ui = {
  ext: () => el.ext?.value?.trim(),
  domain: () => el.domain?.value?.trim(),
  pass: () => el.pass?.value ?? "",
  wss: () => el.wss?.value,
  wssFallback: () => (window.location?.host || d.wssHost || ""),
  dial: () => el.dial?.value?.trim(),
  remoteAudio: () => el.remoteAudio,
  setStatus: (s) => {
    const statusText = st.registered ? `${ui.ext() || "-"}` : s;
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
      setText(el.status, `${ui.ext() || "-"}`);
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

el.btnCall?.addEventListener("click", () => startCall(SIP, st, ui));
el.btnHangup?.addEventListener("click", () => hangupCall(st, ui, false));
el.btnAnswer?.addEventListener("click", () => answerIncomingCall(SIP, st, ui));
el.btnReject?.addEventListener("click", () => rejectIncomingCall(st, ui));

el.dial?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); startCall(SIP, st, ui); }});
el.pass?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); if (!st.registered) startAndRegister(SIP, st, ui); }});