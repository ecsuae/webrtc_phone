import { nowISO, logLine } from "../desktopLogging.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";
import {
  buildDesktopIceServersFromWindowConfig,
  checkDesktopLteRelayAvailable,
} from "./ext/desktopPreflightIceServers.js";

export const DESKTOP_PREFLIGHT_ERRORS = {
  "MEDIA-E001": {
    code: "MEDIA-E001",
    userMessage:
      "Could not reach the media relay (TURN) server on this network. Try Wi-Fi, or disable LTE/5G Mode if already on Wi-Fi.",
    longDescription:
      "ICE gathering completed in relay-only mode with zero relay candidates. TURN server unreachable on the current network.",
  },
  "MEDIA-E002": {
    code: "MEDIA-E002",
    userMessage: "Media path setup timed out. This can happen on very restricted networks.",
    longDescription: "ICE gathering timed out before any usable candidate pair was established.",
  },
};

export async function runDesktopLtePreflightOrThrow({ st, ui, target, corrId, t_callStart, diagContext }) {
  const aorForCheck = st.account ? `${st.account.rawUsername}@${st.account.domain}` : null;
  logLine(`[${nowISO()}] [call] LTE mode: running pre-flight TURN relay check...`);
  ui.setStatus("Checking media relay...");

  const ctx = {
    username: st.account?.rawUsername || st.account?.username || undefined,
    domain: st.account?.domain || undefined,
    aor: aorForCheck || undefined,
    corrId,
    dir: "outbound",
    peer: target,
    lteMode: true,
    mode: "lte",
    selectedProfile: st.selectedProfile || "lte",
    icePolicy: "relay",
    ...(diagContext || {}),
  };

  try {
    sendCallMediaEvent({
      type: "outbound-preflight-start",
      ...ctx,
      t_callStart,
      msg: "LTE outbound preflight started (desktop)",
    });
  } catch {}

  const iceServers = buildDesktopIceServersFromWindowConfig();

  let preCheck;
  try {
    preCheck = await checkDesktopLteRelayAvailable(iceServers, 8000, ctx);
  } catch {
    preCheck = { relay: 0, total: 0, timedOut: true };
  }

  logLine(`[${nowISO()}] [call] pre-flight result: relay=${preCheck.relay} total=${preCheck.total} timedOut=${preCheck.timedOut}`);

  try {
    sendCallMediaEvent({
      type: preCheck.timedOut ? "outbound-preflight-timeout" : "outbound-preflight-complete",
      ...ctx,
      relay: preCheck.relay,
      total: preCheck.total,
      timedOut: preCheck.timedOut,
      t_callStart,
      msg: preCheck.timedOut ? "LTE outbound preflight timed out (desktop)" : "LTE outbound preflight complete (desktop)",
    });
  } catch {}

  if (preCheck.relay === 0) {
    const errCode = preCheck.timedOut ? "MEDIA-E002" : "MEDIA-E001";
    const errDef = DESKTOP_PREFLIGHT_ERRORS[errCode];
    logLine(`[${nowISO()}] [call] ${errCode} — aborting call before INVITE: ${errDef.longDescription}`);
    ui.setStatus(errDef.userMessage);
    throw new Error(errCode);
  }

  logLine(`[${nowISO()}] [call] pre-flight OK — ${preCheck.relay} relay candidate(s) — proceeding`);
}
