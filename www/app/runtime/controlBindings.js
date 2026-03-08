import { primeIncomingRingtone } from "../incoming/alert.js";
import { startCall, hangupCall } from "../sipCall.js";
import { answerIncomingCallIsolated, rejectIncomingCallIsolated } from "../sipCallIncoming.js";
import { setupTabNavigation } from "../ui/tabNavigation.js";
import { setupCallControls } from "../ui/callControls.js";

export function bindControlHandlers({ el, st, ui, SIP, callHistory, runOneTapEnableFlow, stopAndUnregister, releaseWakeLock }) {
  if (el.btnStart && el.btnStop) {
    el.btnStart.addEventListener("click", async () => {
      primeIncomingRingtone();
      await runOneTapEnableFlow();
    });

    el.btnStop.addEventListener("click", () => {
      releaseWakeLock();
      stopAndUnregister(st, ui, false);
    });
  } else if (el.btnStart) {
    el.btnStart.addEventListener("click", async () => {
      primeIncomingRingtone();
      if (st.registered) {
        releaseWakeLock();
        stopAndUnregister(st, ui, false);
      } else {
        await runOneTapEnableFlow();
      }
    });
  }

  el.btnCall?.addEventListener("click", () => {
    primeIncomingRingtone();
    if (st.incomingInvitation) {
      answerIncomingCallIsolated(SIP, st, ui);
      return;
    }

    const number = ui.dial();
    if (number) callHistory.addCall(number, "outgoing");
    startCall(SIP, st, ui);
  });

  el.btnHangup?.addEventListener("click", () => {
    if (st.incomingInvitation) {
      rejectIncomingCallIsolated(st, ui);
      return;
    }
    hangupCall(st, ui, false);
  });
  el.btnAnswer?.addEventListener("click", () => answerIncomingCallIsolated(SIP, st, ui));
  el.btnReject?.addEventListener("click", () => rejectIncomingCallIsolated(st, ui));

  el.dial?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    primeIncomingRingtone();
    el.btnCall?.click();
  });

  el.pass?.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    primeIncomingRingtone();
    if (!st.registered) await runOneTapEnableFlow();
  });

  setupTabNavigation();
  setupCallControls(st);
}

export function bindIosAudioUnlock() {
  if (!/iPhone|iPad|iPod/.test(navigator.userAgent)) return;

  const unlockOnInteraction = () => {
    primeIncomingRingtone();
    document.removeEventListener("touchstart", unlockOnInteraction);
    document.removeEventListener("click", unlockOnInteraction);
  };

  document.addEventListener("touchstart", unlockOnInteraction, { once: true });
  document.addEventListener("click", unlockOnInteraction, { once: true });
}
