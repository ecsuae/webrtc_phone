import { clearSessionPassword } from "../../desktopRecoverySession.js";

export function persistDesktopCallsEnabledFlag(enabled) {
  try {
    if (enabled) localStorage.setItem("webrtc_calls_enabled", "1");
    else localStorage.removeItem("webrtc_calls_enabled");
  } catch {}
}

export function clearDesktopSavedCredentials() {
  try {
    localStorage.removeItem("webrtc_last_registration");
    localStorage.removeItem("webrtc_calls_enabled");
  } catch {}
  try {
    clearSessionPassword();
  } catch {}
}

export function persistDesktopLastRegistration({ ext, domain, wss }) {
  try {
    localStorage.setItem(
      "webrtc_last_registration",
      JSON.stringify({ ext, domain, wss, timestamp: Date.now() })
    );
  } catch {}
}
