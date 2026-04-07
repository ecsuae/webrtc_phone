import { primeIncomingRingtone } from "../../incoming/alert.js";

export function bindIosAudioUnlock() {
  const unlockOnInteraction = () => {
    primeIncomingRingtone();
    document.removeEventListener("touchstart", unlockOnInteraction);
    document.removeEventListener("click", unlockOnInteraction);
  };

  document.addEventListener("touchstart", unlockOnInteraction, { once: true });
  document.addEventListener("click", unlockOnInteraction, { once: true });
}
