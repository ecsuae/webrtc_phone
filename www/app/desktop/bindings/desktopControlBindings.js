import { primeIncomingRingtone } from "../incoming/desktopIncomingAlert.js";
import { hangupCallDesktop } from "../outgoing/desktopHangupCall.js";
import { rejectDesktopIncomingCall } from "../incoming/desktopRejectIncomingCall.js";
import { joinDesktopConference } from "../conference/desktopJoinConference.js";
import { setupDesktopTabNavigation } from "../ui/desktopTabNavigation.js";
import { setupDesktopCallControls } from "../ui/desktopCallControls.js";
import { logLine } from "../desktopLogging.js";
import { startCall } from "../outgoing/desktopStartCall.js";
import { answerIncomingCallDesktop } from "../incoming/desktopAnswerIncomingCall.js";
import { desktopEl } from "../ui/desktopDomRefs.js";

export function bindDesktopControlHandlers({
  el,
  st,
  ui,
  SIP,
  callHistory,
  runOneTapEnableFlow,
  stopAndUnregister,
  releaseWakeLock,
}) {
  const passToggleBtn = desktopEl.btnPassToggle || document.getElementById("btnPassToggle");
  const joinConferenceBtn = desktopEl.btnJoinConference || document.getElementById("btnJoinConference");
  const conferenceEnabled = String(document?.body?.dataset?.conferenceEnabled || "").toLowerCase() === "true";

  // Desktop-owned registration UI bindings. This intentionally does not depend on shared
  // registration/ui binding modules so desktop can own its flow end-to-end.
  try {
    const btnStart = desktopEl.btnStart || el.btnStart;
    if (btnStart && typeof runOneTapEnableFlow === "function") {
      btnStart.addEventListener("click", () => {
        try {
          console.log("[DESKTOP_REG_DEBUG] btnStart click: calling runOneTapEnableFlow");
        } catch {}
        primeIncomingRingtone();
        void runOneTapEnableFlow();
      });
    }
  } catch {}

  try {
    const btnStop = desktopEl.btnStop || el.btnStop;
    if (btnStop && typeof stopAndUnregister === "function") {
      btnStop.addEventListener("click", () => {
        try {
          releaseWakeLock?.();
        } catch {}
        void stopAndUnregister(st, ui, false);
      });
    }
  } catch {}

  (desktopEl.btnCall || el.btnCall)?.addEventListener("click", () => {
    try {
      logLine(
        `[ui] btnCall clicked (registered=${!!st.registered}, inCall=${!!st.session}, hasIncoming=${!!st.incomingInvitation})`
      );
    } catch {}

    primeIncomingRingtone();
    if (st.incomingInvitation) {
      answerIncomingCallDesktop(SIP, st, ui);
      return;
    }

    void startCall(SIP, st, ui).catch((err) => {
      try {
        logLine(`[ui] startCall failed: ${err?.message || err}`);
      } catch {}
      try {
        ui?.setStatus?.("Call failed");
      } catch {}
    });
  });

  (desktopEl.btnHangup || el.btnHangup)?.addEventListener("click", () => {
    if (st.incomingInvitation) {
      rejectDesktopIncomingCall(st, ui);
      return;
    }
    hangupCallDesktop(st, ui, false);
  });
  (desktopEl.btnAnswer || el.btnAnswer)?.addEventListener("click", () => answerIncomingCallDesktop(SIP, st, ui));
  (desktopEl.btnReject || el.btnReject)?.addEventListener("click", () => rejectDesktopIncomingCall(st, ui));

  (desktopEl.dial || el.dial)?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    primeIncomingRingtone();
    (desktopEl.btnCall || el.btnCall)?.click();
  });

  passToggleBtn?.addEventListener("click", () => {
    const input = desktopEl.pass || el.pass;
    if (!input) return;
    const icon = passToggleBtn.querySelector("i");
    const isHidden = (input.getAttribute("type") || "password") === "password";

    input.setAttribute("type", isHidden ? "text" : "password");
    passToggleBtn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    if (icon) icon.className = isHidden ? "fas fa-eye-slash" : "fas fa-eye";
    input.focus();
  });

  if (conferenceEnabled)
    joinConferenceBtn?.addEventListener("click", async () => {
      if (!joinConferenceBtn) return;
      joinConferenceBtn.disabled = true;
      try {
        await joinDesktopConference({ st, ui, SIP, runOneTapEnableFlow });
      } finally {
        joinConferenceBtn.disabled = false;
      }
    });

  setupDesktopTabNavigation(st);
  setupDesktopCallControls(SIP, st, ui);
}
