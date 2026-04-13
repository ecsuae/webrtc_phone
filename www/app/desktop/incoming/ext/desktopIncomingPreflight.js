import { nowISO } from "../../../config.js";
import { logLine } from "../../../log.js";
import { checkLteRelayAvailable, MEDIA_ERRORS } from "../../../features/lteCallGuard.js";
import { sendCallMediaEvent } from "../../../features/callMediaLog.js";
import { ICE_SERVERS } from "../../../config.js";

export async function runLteAnswerPreflight({ st, invitation, ui, aor, callId, caller, t_answerClicked, getInboundDiagContext }) {
  logLine(`[${nowISO()}] [incoming:answer] LTE mode: running pre-flight TURN relay check...`);
  ui.setStatus("Checking media relay...");

  sendCallMediaEvent({
    type: "answer-preflight-start",
    ...getInboundDiagContext(st, invitation),
    aor,
    callId,
    t_answerClicked,
    msg: "Starting LTE answer preflight (relay candidate check)",
  });

  let preCheck;
  try {
    preCheck = await checkLteRelayAvailable(ICE_SERVERS, 8000, {
      ...getInboundDiagContext(st, invitation),
      aor,
      callId,
      dir: "inbound",
      peer: caller,
      lteMode: true,
      mode: "lte",
      selectedProfile: st.selectedProfile || "lte",
    });
  } catch {
    preCheck = { relay: 0, total: 0, timedOut: true };
  }
  logLine(`[${nowISO()}] [incoming:answer] pre-flight result: relay=${preCheck.relay} total=${preCheck.total} timedOut=${preCheck.timedOut}`);

  sendCallMediaEvent({
    type: "answer-preflight-result",
    ...getInboundDiagContext(st, invitation),
    aor,
    callId,
    t_answerClicked,
    relay: preCheck.relay,
    total: preCheck.total,
    timedOut: preCheck.timedOut,
    msg: `LTE answer preflight result: relay=${preCheck.relay} total=${preCheck.total} timedOut=${preCheck.timedOut}`,
  });

  sendCallMediaEvent({
    type: preCheck.relay > 0 ? "preflight-ok" : "preflight-fail",
    code: preCheck.relay === 0 ? (preCheck.timedOut ? "MEDIA-E002" : "MEDIA-E001") : undefined,
    aor,
    callId,
    lteMode: true,
    dir: "inbound",
    username: st.account?.rawUsername || st.account?.username || undefined,
    domain: st.account?.domain || undefined,
    mode: "lte",
    selectedProfile: st.selectedProfile || "lte",
    peer: caller,
    relay: preCheck.relay,
    total: preCheck.total,
    timedOut: preCheck.timedOut,
    msg: preCheck.relay > 0 ? "TURN relay reachable" : preCheck.timedOut ? "ICE gathering timed out" : "Zero relay candidates",
  });

  if (preCheck.relay === 0) {
    const errCode = preCheck.timedOut ? "MEDIA-E002" : "MEDIA-E001";
    const errDef = MEDIA_ERRORS[errCode];
    logLine(`[${nowISO()}] [incoming:answer] ${errCode} — rejecting call before accept(): ${errDef.longDescription}`);
    ui.setStatus(errDef.userMessage);
    return { ok: false, reject: { statusCode: 488 } };
  }

  logLine(`[${nowISO()}] [incoming:answer] pre-flight OK — ${preCheck.relay} relay candidate(s) — proceeding`);
  return { ok: true };
}
