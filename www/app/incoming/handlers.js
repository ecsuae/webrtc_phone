import { nowISO } from "../config.js";
import { logLine } from "../log.js";
import { setLastRegistrationCompleteTime } from "./handlers/state.js";

export { handleIncomingCall, handleIncomingCallIsolated } from "./handlers/incomingCall.js";
export { answerIncomingCallIsolated } from "./handlers/answer.js";
export { rejectIncomingCallIsolated } from "./handlers/reject.js";

export function setRegistrationComplete() {
  const t = Date.now();
  setLastRegistrationCompleteTime(t);
  logLine(`[${nowISO()}] [incoming] Registration completed at ${t}`);
}
