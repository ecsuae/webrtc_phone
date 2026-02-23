// www/app/log.js
import { nowISO } from "./config.js";
import { el } from "./dom.js";

export function logLine(...args) {
  const msg = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");
  console.log(msg);

  if (el.log) {
    el.log.textContent += msg + "\n";
    el.log.scrollTop = el.log.scrollHeight;
  }
}

export function formatSipResponse(response) {
  if (!response) return "";
  const msg = response.message || response;
  const code = msg?.statusCode || response.statusCode;
  const reason = msg?.reasonPhrase || response.reasonPhrase;
  if (!code && !reason) return "";
  return `${code || ""} ${reason || ""}`.trim();
}

export function bootLog() {
  logLine(`[${nowISO()}] [boot] app loaded`);
}