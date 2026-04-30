import { primeIncomingRingtone } from "../../incoming/alert.js";
import { startCall, hangupCall } from "../../sipCall.js";
import { answerIncomingCallIsolated, rejectIncomingCallIsolated } from "../../sipCallIncoming.js";
import { joinConferenceFromPin } from "../../conference/join.js";
import { bindRegistrationUiHandlers } from "../../registration/registrationUiBindings.js";
import { setupTabNavigation } from "../../ui/tabNavigation.js";
import { setupCallControls } from "../../ui/callControls.js";
import { logLine } from "../../log.js";

export function bindControlHandlers({ el, st, ui, SIP, callHistory, runOneTapEnableFlow, stopAndUnregister, releaseWakeLock }) {
  const passToggleBtn = document.getElementById("btnPassToggle");
  const joinConferenceBtn = document.getElementById("btnJoinConference");
  const conferenceEnabled = String(document?.body?.dataset?.conferenceEnabled || "").toLowerCase() === "true";

  bindRegistrationUiHandlers({
    el,
    st,
    ui,
    runOneTapEnableFlow,
    stopAndUnregister,
    releaseWakeLock,
    primeIncomingRingtone,
  });

  el.btnCall?.addEventListener("click", () => {
    try {
      logLine(`[ui] btnCall clicked (registered=${!!st.registered}, inCall=${!!st.session}, hasIncoming=${!!st.incomingInvitation})`);
    } catch {}

    primeIncomingRingtone();
    if (st.incomingInvitation) {
      answerIncomingCallIsolated(SIP, st, ui);
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

  passToggleBtn?.addEventListener("click", () => {
    const input = el.pass;
    if (!input) return;
    const icon = passToggleBtn.querySelector("i");
    const isHidden = (input.getAttribute("type") || "password") === "password";

    input.setAttribute("type", isHidden ? "text" : "password");
    passToggleBtn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    if (icon) icon.className = isHidden ? "fas fa-eye-slash" : "fas fa-eye";
    input.focus();
  });

  if (conferenceEnabled) joinConferenceBtn?.addEventListener("click", async () => {
    if (!joinConferenceBtn) return;
    joinConferenceBtn.disabled = true;
    try {
      await joinConferenceFromPin({ el, st, ui, SIP, runOneTapEnableFlow });
    } finally {
      joinConferenceBtn.disabled = false;
    }
  });

  setupTabNavigation(st);
  setupCallControls(SIP, st, ui);
}
