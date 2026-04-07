function findOutputDevice(devices, mode) {
  const labels = devices
    .filter((d) => d.kind === "audiooutput")
    .map((d) => ({ id: d.deviceId, label: (d.label || "").toLowerCase() }));

  if (!labels.length) return null;

  const speakerHints = ["speaker", "loud", "handsfree", "default"];
  const earpieceHints = ["earpiece", "receiver", "phone", "communications", "default"];
  const hints = mode === "speaker" ? speakerHints : earpieceHints;

  for (const hint of hints) {
    const found = labels.find((d) => d.label.includes(hint));
    if (found) return found.id;
  }

  return labels[0].id;
}

async function trySetSink(audioEl, mode) {
  if (!audioEl || typeof audioEl.setSinkId !== "function") return false;
  if (!navigator.mediaDevices?.enumerateDevices) return false;

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const deviceId = findOutputDevice(devices, mode);
    if (!deviceId) return false;

    await audioEl.setSinkId(deviceId);
    return true;
  } catch {
    return false;
  }
}

function applyVolumeFallback(audioEl, mode) {
  if (!audioEl) return;
  try {
    audioEl.muted = false;
  } catch {}

  try {
    audioEl.volume = mode === "speaker" ? 1.0 : 0.85;
  } catch {}
}

export async function enforceDesktopAudioRoute(audioEl, mode) {
  const usedSink = await trySetSink(audioEl, mode);
  if (!usedSink) applyVolumeFallback(audioEl, mode);
  return usedSink;
}
