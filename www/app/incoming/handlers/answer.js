import { nowISO } from "../../config.js";
import { logLine } from "../../log.js";
import { ensureMicAccess, getLocalStream, stopLocalAudioStream } from "../../media.js";
import { startIncomingEarlyMediaLoop } from "../media.js?v=1773032001";
import { guardLteRelayReadiness } from "../../features/lteCallGuard.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";
import { isMobileCompatModeEnabled } from "../../features/mobileNetworkMode.js";
import { stopIncomingAlert } from "../alert.js";
import { cleanupIncomingState } from "./state.js";
import { getHeaderValue, getInboundDiagContext } from "./diag.js";
import { observeRemoteAudioPlay } from "./observeRemoteAudioPlay.js";
import { runLteAnswerPreflight } from "./answer/preflight.js";
import { acceptIncomingInvitation } from "./answer/accept.js";

export async function answerIncomingCallIsolated(SIP, st, ui) {
  const invitation = st.incomingInvitation;
  if (!invitation) return;

  const caller = invitation.remoteIdentity?.uri?.user || "Unknown";
  const callerDisplay = invitation.remoteIdentity?.displayName || caller;

  stopIncomingAlert();
  const t_answerClicked = new Date().toISOString();
  const micOk = await ensureMicAccess(ui.setStatus);
  if (!micOk) {
    try {
      invitation.reject({ statusCode: 480 });
    } catch {}
    cleanupIncomingState(st, ui);
    ui.setStatus("Microphone access denied");
    return;
  }

  st.incomingInvitation = null;
  ui.setStatus(`Answering ${callerDisplay}...`);

  const aor = invitation.localIdentity?.uri ? `${invitation.localIdentity.uri.user}@${invitation.localIdentity.uri.host}` : null;
  const callId = invitation.request?.callId || null;

  sendCallMediaEvent({
    type: "answer-clicked",
    ...getInboundDiagContext(st, invitation),
    t_answerClicked,
    hasLocalStream: Boolean(getLocalStream()),
    msg: "User clicked answer",
  });

  observeRemoteAudioPlay(ui, getInboundDiagContext(st, invitation), { t_answerClicked });

  if (isMobileCompatModeEnabled()) {
    const pre = await runLteAnswerPreflight({
      st,
      invitation,
      ui,
      aor,
      callId,
      caller,
      t_answerClicked,
      getInboundDiagContext,
    });
    if (!pre?.ok) {
      try {
        invitation.reject(pre?.reject || { statusCode: 488 });
      } catch {}
      cleanupIncomingState(st, ui);
      return;
    }
  }

  try {
    await acceptIncomingInvitation({
      st,
      invitation,
      aor,
      callId,
      t_answerClicked,
      getInboundDiagContext,
      getHeaderValue,
    });

    startIncomingEarlyMediaLoop(invitation, ui);

    sendCallMediaEvent({
      type: "media-answer-incoming",
      ...getInboundDiagContext(st, invitation),
      t_answerClicked,
      msg: "Sent 200 OK (answer)",
    });

    guardLteRelayReadiness(invitation, {
      aor,
      callId,
      dir: "inbound",
      onFail: (code, userMessage) => {
        logLine(`[${nowISO()}] [incoming:answer] ${code} — aborting call: ${userMessage}`);
        ui.setStatus(userMessage);
        try {
          invitation.bye();
        } catch {}
        cleanupIncomingState(st, ui);
      },
    });

    sendCallMediaEvent({
      type: "call-answer",
      ...getInboundDiagContext(st, invitation),
      t_answerClicked,
      msg: "Incoming call answered",
    });
  } catch (err) {
    logLine(`[${nowISO()}] [incoming:answer] ERROR accepting call: ${err?.message || err}`);

    sendCallMediaEvent({
      type: "answer-accept-failed",
      ...getInboundDiagContext(st, invitation),
      aor,
      callId,
      t_answerClicked,
      msg: `invitation.accept() failed: ${err?.message || err}`,
    });

    stopLocalAudioStream();
    st.session = null;
    ui.setButtons();
    ui.setStatus("Failed to answer call");
  }
}
