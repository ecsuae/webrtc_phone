export async function sendDTMF(session, code, { duration = 250, gap = 150, waitForReadyMs = 4000 } = {}) {
  if (!session) throw new Error("No active call");

  const pc = session?.sessionDescriptionHandler?.peerConnection;
  if (!pc) throw new Error("Cannot send DTMF: No peer connection");

  const audioSender = pc.getSenders().find((s) => s.track?.kind === "audio");
  if (!audioSender) throw new Error("Cannot send DTMF: No audio track");

  const dtmfSender = audioSender.dtmf;
  if (!dtmfSender) throw new Error("Cannot send DTMF: Not supported by browser");

  const started = Date.now();
  while (!dtmfSender.canInsertDTMF && Date.now() - started < waitForReadyMs) {
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!dtmfSender.canInsertDTMF) {
    throw new Error("Cannot send DTMF: call not ready (telephone-event missing?)");
  }

  dtmfSender.insertDTMF(code, duration, gap);

  // Rough timing wait so callers can sequence actions.
  const perToneMs = duration + gap;
  const tones = String(code || "").length;
  if (tones > 0) {
    await new Promise((r) => setTimeout(r, Math.min(tones * perToneMs, 6000)));
  }

  return true;
}
