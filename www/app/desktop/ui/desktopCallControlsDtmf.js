export async function sendDesktopDTMFCode(st, code, { alertFn = alert, log = console } = {}) {
  if (!st.session) {
    alertFn?.("No active call");
    return false;
  }

  try {
    const pc = st.session?.sessionDescriptionHandler?.peerConnection;
    if (!pc) {
      log?.error?.("[DTMF] No peer connection available");
      alertFn?.("Cannot send DTMF: No peer connection");
      return false;
    }

    const audioSender = pc.getSenders().find((s) => s.track?.kind === "audio");
    if (!audioSender) {
      log?.error?.("[DTMF] No audio sender found");
      alertFn?.("Cannot send DTMF: No audio track");
      return false;
    }

    const dtmfSender = audioSender.dtmf;
    if (!dtmfSender) {
      log?.error?.("[DTMF] DTMF sender not available");
      alertFn?.("Cannot send DTMF: Not supported by browser");
      return false;
    }

    let attempts = 0;
    const maxAttempts = 20;

    while (!dtmfSender.canInsertDTMF && attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 200));
      attempts++;
    }

    if (!dtmfSender.canInsertDTMF) {
      log?.error?.("[DTMF] canInsertDTMF is still false after waiting");
      alertFn?.(
        "Cannot send DTMF: Call not ready. The audio codec may not support DTMF (telephone-event)."
      );
      return false;
    }

    dtmfSender.insertDTMF(code, 250, 150);
    return true;
  } catch (err) {
    log?.error?.("[DTMF] Failed to send:", err);
    alertFn?.("Failed to send DTMF: " + (err?.message || err));
    return false;
  }
}
