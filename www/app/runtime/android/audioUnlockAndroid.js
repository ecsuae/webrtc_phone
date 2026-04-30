import { primeIncomingRingtone } from "../../incoming/alert.js";

export function bindAndroidAudioUnlock() {
  const unlockOnInteraction = () => {
    primeIncomingRingtone();
    try {
      const audioEl = document.getElementById("remoteAudio");
      if (!audioEl) return;
      audioEl.autoplay = true;
      audioEl.playsInline = true;
      audioEl.muted = true;
      const p = audioEl.play?.();
      if (p && typeof p.finally === "function") {
        p.finally(() => {
          audioEl.muted = false;
        });
      } else {
        audioEl.muted = false;
      }
    } catch {}
    document.removeEventListener("touchstart", unlockOnInteraction);
    document.removeEventListener("click", unlockOnInteraction);
  };

  document.addEventListener("touchstart", unlockOnInteraction, { once: true });
  document.addEventListener("click", unlockOnInteraction, { once: true });
}
