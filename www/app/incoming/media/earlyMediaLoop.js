import { nowISO } from "../../config.js";
import { logLine } from "../../log.js";
import { attachIncomingRemoteAudio } from "./attachIncomingRemoteAudio.js";

export function startIncomingEarlyMediaLoop(session, ui) {
  try {
    if (session.__incomingEarlyMediaTimer) return;

    let attempts = 0;
    const maxAttempts = 40;
    session.__incomingEarlyMediaTimer = setInterval(() => {
      attempts += 1;
      attachIncomingRemoteAudio(session, ui);
      if (session?.state === "Terminated" || attempts >= maxAttempts) {
        clearInterval(session.__incomingEarlyMediaTimer);
        session.__incomingEarlyMediaTimer = null;
      }
    }, 250);
  } catch (err) {
    logLine(`[${nowISO()}] [incoming:media] ERROR starting early media loop: ${err?.message || err}`);
  }
}

export function stopIncomingEarlyMediaLoop(session) {
  if (session?.__incomingEarlyMediaTimer) {
    clearInterval(session.__incomingEarlyMediaTimer);
    session.__incomingEarlyMediaTimer = null;
  }
}
