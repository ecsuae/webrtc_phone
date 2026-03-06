import { bootLog } from "./log.js";
import { el } from "./dom.js";
import { createAppState, startAndRegister, stopAndUnregister } from "./sipRegister.js";
import { startCall, hangupCall } from "./sipCall.js";
import { answerIncomingCallIsolated, rejectIncomingCallIsolated } from "./sipCallIncoming.js";
import { primeIncomingRingtone } from "./incoming/alert.js";
import * as Push from "./push.js";
import { createUi } from "./ui/appUi.js";
import { createCallHistory } from "./ui/callHistoryLocal.js";
import { createCallTimer } from "./ui/callTimer.js";
import { setupTabNavigation } from "./ui/tabNavigation.js";
import { setupCallControls } from "./ui/callControls.js";

bootLog();

const SIP = window.SIP;
const st = createAppState();
const ui = createUi(st);
const callHistory = createCallHistory();
const callTimer = createCallTimer();

window.callHistory = callHistory;
window.callTimer = callTimer;

Push.init().catch((err) => console.warn("Push notifications not available:", err));

if (!SIP) {
  ui.setStatus("SIP.js not loaded");
}

if (el.btnStart && el.btnStop) {
  el.btnStart.addEventListener("click", () => {
    primeIncomingRingtone(); // Unlock audio for iOS
    startAndRegister(SIP, st, ui);
  });
  el.btnStop.addEventListener("click", () => stopAndUnregister(st, ui, false));
} else if (el.btnStart) {
  el.btnStart.addEventListener("click", () => {
    primeIncomingRingtone(); // Unlock audio for iOS
    if (st.registered) stopAndUnregister(st, ui, false);
    else startAndRegister(SIP, st, ui);
  });
}

el.btnCall?.addEventListener("click", () => {
  primeIncomingRingtone(); // Unlock audio for iOS
  const number = ui.dial();
  if (number) callHistory.addCall(number, "outgoing");
  startCall(SIP, st, ui);
});

el.btnHangup?.addEventListener("click", () => hangupCall(st, ui, false));
el.btnAnswer?.addEventListener("click", () => answerIncomingCallIsolated(SIP, st, ui));
el.btnReject?.addEventListener("click", () => rejectIncomingCallIsolated(st, ui));

el.dial?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  primeIncomingRingtone(); // Unlock audio for iOS
  el.btnCall?.click();
});

el.pass?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  primeIncomingRingtone(); // Unlock audio for iOS
  if (!st.registered) startAndRegister(SIP, st, ui);
});

setupTabNavigation();
setupCallControls(st);

// iOS audio unlock - prime on first user interaction
if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
  const unlockOnInteraction = () => {
    primeIncomingRingtone();
    document.removeEventListener("touchstart", unlockOnInteraction);
    document.removeEventListener("click", unlockOnInteraction);
  };
  document.addEventListener("touchstart", unlockOnInteraction, { once: true });
  document.addEventListener("click", unlockOnInteraction, { once: true });
}
