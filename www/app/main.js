// www/app/main.js
import { bootLog } from "./log.js";
import { defaultsFromBody, el, setText } from "./dom.js";
import { createAppState, startAndRegister, stopAndUnregister } from "./sipRegister.js";
import { startCall, hangupCall } from "./sipCall.js";

bootLog();

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
  setStatus: (s) => setText(el.status, s),
  setTransport: (s) => setText(el.tstatus, s),
  setButtons: () => {
    const registered = st.registered;
    if (el.btnStart && el.btnStop) { el.btnStart.disabled = registered; el.btnStop.disabled = !registered; }
    if (el.btnStart && !el.btnStop) el.btnStart.textContent = registered ? "Unregister" : "Register";
    if (el.btnCall) el.btnCall.disabled = !registered || !!st.session;
    if (el.btnHangup) el.btnHangup.disabled = !st.session;
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

el.dial?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); startCall(SIP, st, ui); }});
el.pass?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); if (!st.registered) startAndRegister(SIP, st, ui); }});