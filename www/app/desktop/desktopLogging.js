import { desktopEl, refreshDesktopEl } from "./ui/desktopDomRefs.js";

function nowISO() {
  return new Date().toISOString();
}

function formatSipResponse(response) {
  if (!response) return "";
  const msg = response.message || response;
  const code = msg?.statusCode || response.statusCode;
  const reason = msg?.reasonPhrase || response.reasonPhrase;
  if (!code && !reason) return "";
  return `${code || ""} ${reason || ""}`.trim();
}

function getSipRejectDetails(response) {
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

function mapSipFailureToMessage(details) {
  const code = Number(details?.code);
  if (code === 486) return "User busy";
  if (code === 480) return "Temporarily unavailable";
  if (code === 487) return "Call canceled";
  if (code === 603) return "Call declined";
  if (code === 404) return "User not found";
  if (code === 408) return "Request timeout";
  return "Call failed";
}

function desktopLogLine(...args) {
  const msg = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");
  console.log(msg);

  if (desktopEl.log) {
    desktopEl.log.textContent += msg + "\n";
    desktopEl.log.scrollTop = desktopEl.log.scrollHeight;
  }
}

function desktopBootLog() {
  desktopLogLine(`[${nowISO()}] [boot] desktop app loaded`);
}

export {
  nowISO,
  formatSipResponse,
  getSipRejectDetails,
  mapSipFailureToMessage,
  desktopLogLine as logLine,
  desktopBootLog as bootLog,
};