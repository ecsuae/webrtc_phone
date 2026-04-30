import { nowISO, logLine } from "../desktopLogging.js";

function safeStr(x) {
  try {
    if (x == null) return null;
    return String(x);
  } catch {
    return null;
  }
}

export function endDesktopCallUiState(st, ui, session, {
  reason = "unknown",
  dir = undefined,
  corrId = undefined,
  callId = undefined,
  peer = undefined,
  trigger = undefined,
} = {}) {
  const ts = nowISO();

  try {
    logLine(`[${ts}] [desktop:call-end] reason=${reason} dir=${dir || "-"} trigger=${trigger || "-"}`);
  } catch {}

  try {
    if (window.callTimer) {
      try {
        logLine(`[${ts}] [desktop-call-timer-stop] reason=${reason} dir=${dir || "-"} trigger=${trigger || "-"}`);
      } catch {}
      window.callTimer.stop();
    }
  } catch {}

  try {
    const cur = st?.session || null;
    const same = !!(cur && session && cur === session);
    const willClear = !!(st && (same || !session));

    if (willClear) {
      try {
        logLine(`[${ts}] [desktop-call-state-cleared] reason=${reason} dir=${dir || "-"} sameSession=${same} sessionState=${safeStr(cur?.state) || "-"}`);
      } catch {}
      st.session = null;
    }
  } catch {}

  try {
    ui?.setButtons?.();
  } catch {}

  try {
    ui?.setStatus?.("Idle");
  } catch {}
}
