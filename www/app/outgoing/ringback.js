import { primeOutboundRingbackContext, startRingbackTone, stopRingbackTone } from "./ringback/index.js";

export { primeOutboundRingbackContext, startRingbackTone, stopRingbackTone };

export function startOutboundRingbackIfNeeded() {
  startRingbackTone();
}

export function stopOutboundRingback() {
  stopRingbackTone();
}
