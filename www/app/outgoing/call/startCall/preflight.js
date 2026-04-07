import { nowISO, ICE_SERVERS } from "../../../config.js";
import { logLine } from "../../../log.js";
import { checkLteRelayAvailable, MEDIA_ERRORS } from "../../../features/lteCallGuard.js";
import { sendCallMediaEvent } from "../../../features/callMediaLog.js";

export async function runLtePreflightOrThrow({ st, ui, target, corrId, t_callStart }) {
  const aorForCheck = st.account ? `${st.account.rawUsername}@${st.account.domain}` : null;
  logLine(`[${nowISO()}] [call] LTE mode: running pre-flight TURN relay check...`);
  ui.setStatus("Checking media relay...");

  sendCallMediaEvent({
    type: 'outbound-preflight-start',
    username: st.account?.rawUsername || st.account?.username || undefined,
    domain: st.account?.domain || undefined,
    aor: aorForCheck || undefined,
    corrId,
    dir: 'outbound',
    peer: target,
    lteMode: true,
    mode: 'lte',
    selectedProfile: st.selectedProfile || 'lte',
    icePolicy: 'relay',
    t_callStart,
    msg: 'LTE outbound preflight started',
  });

  let preCheck;
  try {
    preCheck = await checkLteRelayAvailable(ICE_SERVERS, 8000, {
      preflightEventPrefix: 'outbound-',
      username: st.account?.rawUsername || st.account?.username || undefined,
      domain: st.account?.domain || undefined,
      aor: aorForCheck,
      callId: undefined,
      corrId,
      dir: 'outbound',
      peer: target,
      lteMode: true,
      mode: 'lte',
      selectedProfile: st.selectedProfile || 'lte',
    });
  } catch {
    preCheck = { relay: 0, total: 0, timedOut: true };
  }

  logLine(`[${nowISO()}] [call] pre-flight result: relay=${preCheck.relay} total=${preCheck.total} timedOut=${preCheck.timedOut}`);

  sendCallMediaEvent({
    type: preCheck.timedOut ? 'outbound-preflight-timeout' : 'outbound-preflight-complete',
    username: st.account?.rawUsername || st.account?.username || undefined,
    domain: st.account?.domain || undefined,
    aor: aorForCheck || undefined,
    corrId,
    dir: 'outbound',
    peer: target,
    lteMode: true,
    mode: 'lte',
    selectedProfile: st.selectedProfile || 'lte',
    icePolicy: 'relay',
    relay: preCheck.relay,
    total: preCheck.total,
    timedOut: preCheck.timedOut,
    t_callStart,
    msg: preCheck.timedOut ? 'LTE outbound preflight timed out' : 'LTE outbound preflight complete',
  });

  sendCallMediaEvent({
    type: 'outbound-preflight-result',
    code: preCheck.relay === 0 ? (preCheck.timedOut ? 'MEDIA-E002' : 'MEDIA-E001') : undefined,
    username: st.account?.rawUsername || st.account?.username || undefined,
    domain: st.account?.domain || undefined,
    aor: aorForCheck || undefined,
    corrId,
    dir: 'outbound',
    peer: target,
    lteMode: true,
    mode: 'lte',
    selectedProfile: st.selectedProfile || 'lte',
    icePolicy: 'relay',
    relay: preCheck.relay,
    total: preCheck.total,
    timedOut: preCheck.timedOut,
    t_callStart,
    msg: preCheck.relay > 0 ? 'LTE outbound preflight OK' : (preCheck.timedOut ? 'LTE outbound preflight failed (timeout)' : 'LTE outbound preflight failed (no relay)'),
  });

  sendCallMediaEvent({
    type: preCheck.relay > 0 ? 'preflight-ok' : 'preflight-fail',
    code: preCheck.relay === 0 ? (preCheck.timedOut ? 'MEDIA-E002' : 'MEDIA-E001') : undefined,
    username: st.account?.rawUsername || st.account?.username || undefined,
    domain: st.account?.domain || undefined,
    aor: aorForCheck,
    corrId,
    lteMode: true,
    mode: 'lte',
    dir: 'outbound',
    peer: target,
    relay: preCheck.relay,
    total: preCheck.total,
    timedOut: preCheck.timedOut,
    msg: preCheck.relay > 0 ? 'TURN relay reachable' : (preCheck.timedOut ? 'ICE gathering timed out' : 'Zero relay candidates — TURN unreachable'),
  });

  if (preCheck.relay === 0) {
    const errCode = preCheck.timedOut ? 'MEDIA-E002' : 'MEDIA-E001';
    const errDef = MEDIA_ERRORS[errCode];
    logLine(`[${nowISO()}] [call] ${errCode} — aborting call before INVITE: ${errDef.longDescription}`);
    ui.setStatus(errDef.userMessage);
    throw new Error(errCode);
  }

  logLine(`[${nowISO()}] [call] pre-flight OK — ${preCheck.relay} relay candidate(s) — proceeding`);
}
