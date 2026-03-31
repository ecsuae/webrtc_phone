import { nowISO } from "./config.js";
import { logLine } from "./log.js";
import { stopLocalAudioStream } from "./media.js";
import { createAppState } from "./registration/state.js";
import { startPrimaryRegistration } from "./registration/primary.js";
import { stopRegistrationExecution } from "./registration/registrationService.js";
import { stopSecondaryRegistration } from "./registration/secondary.js";
import { clearSessionPassword } from "./push/recoverySession.js";

export { createAppState };

export async function startAndRegister(SIP, st, ui) {
  if (st.ua) await stopAndUnregister(st, ui, true);
  const result = await startPrimaryRegistration(SIP, st, ui);
  if (!result) return;
}

export async function stopAndUnregister(st, ui, silent = false) {
  if (!silent) logLine(`[${nowISO()}] [boot] stopAndUnregister clicked`);

  // Clear periodic re-registration timer
  if (st._reregTimer) {
    clearInterval(st._reregTimer);
    st._reregTimer = null;
  }

  // Clear saved registration credentials when manually logging out
  if (!silent) {
    try {
      localStorage.removeItem('webrtc_last_registration');
      localStorage.removeItem('webrtc_calls_enabled');
      clearSessionPassword();
      logLine(`[${nowISO()}] [boot] Cleared saved registration credentials`);
    } catch (err) {
      console.error('[Registration] Failed to clear credentials:', err);
    }
  }

  await stopSecondaryRegistration(st);
  await stopRegistrationExecution({ st });

  stopLocalAudioStream();
  ui.setStatus("Idle");
  ui.setTransport("-");
  ui.setButtons();
}
