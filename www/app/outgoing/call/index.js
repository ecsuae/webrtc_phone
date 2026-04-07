import { startCall as startCallImpl } from "./startCall.js";
import { hangupCall as hangupCallImpl } from "./hangupCall.js";

export async function startCall(SIP, st, ui) {
  return startCallImpl(SIP, st, ui);
}

export async function hangupCall(st, ui, silent = false) {
  const SIP = window.SIP;
  return hangupCallImpl(SIP, st, ui, silent);
}
