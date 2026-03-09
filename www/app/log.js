// www/app/log.js
import { nowISO } from "./config.js";
import { el } from "./dom.js";
import { captureLog } from "./remoteLogs.js";

export function logLine(...args) {
  const msg = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");
  console.log(msg);
  
  // Capture log for mobile remote debugging (non-blocking)
  try {
    captureLog("log", msg);
  } catch (err) {
    // Silently fail if remote logging has issues
  }

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

export function getSipRejectDetails(response) {
  if (!response) return { code: undefined, reason: "", q850Cause: "", q850Text: "" };

  const msg = response.message || response;
  const code = msg?.statusCode || response.statusCode;
  const reason = msg?.reasonPhrase || response.reasonPhrase || "";

  let reasonHeader = "";
  try {
    if (typeof msg?.getHeader === "function") {
      reasonHeader = msg.getHeader("Reason") || "";
    } else if (msg?.headers?.Reason) {
      const h = Array.isArray(msg.headers.Reason) ? msg.headers.Reason[0] : msg.headers.Reason;
      reasonHeader = h?.raw || h?.value || h || "";
    } else if (msg?.headers?.reason) {
      const h = Array.isArray(msg.headers.reason) ? msg.headers.reason[0] : msg.headers.reason;
      reasonHeader = h?.raw || h?.value || h || "";
    }
  } catch {}

  const q850Cause = (reasonHeader.match(/cause\s*=\s*"?(\d+)"?/i) || [])[1] || "";
  const q850Text = (reasonHeader.match(/text\s*=\s*"([^"]*)"/i) || [])[1] || "";

  return { code, reason, reasonHeader, q850Cause, q850Text };
}

export function mapSipFailureToMessage(details) {
  const code = Number(details?.code);
  if (code === 486) return "User busy";
  if (code === 480) return "Temporarily unavailable";
  if (code === 487) return "Call canceled";
  if (code === 603) return "Call declined";
  if (code === 404) return "User not found";
  if (code === 408) return "Request timeout";
  return "Call failed";
}

export function bootLog() {
  logLine(`[${nowISO()}] [boot] app loaded`);
}