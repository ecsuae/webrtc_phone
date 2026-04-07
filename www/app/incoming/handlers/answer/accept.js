import { nowISO } from "../../../config.js";
import { logLine } from "../../../log.js";
import { g711OnlyModifier } from "../../../sdp.js";
import { getLocalStream } from "../../../media.js";
import { sendCallMediaEvent } from "../../../features/callMediaLog.js";
import { ICE_SERVERS } from "../../../config.js";

export async function acceptIncomingInvitation({ st, invitation, aor, callId, t_answerClicked, getInboundDiagContext, getHeaderValue }) {
  sendCallMediaEvent({
    type: "answer-accept-start",
    ...getInboundDiagContext(st, invitation),
    aor,
    callId,
    t_answerClicked,
    msg: "Starting invitation.accept() for inbound answer",
  });

  const remoteProfile = getHeaderValue(invitation?.request, "X-WebRTC-Profile");
  const forceRelayForThisCall = String(remoteProfile || "").toLowerCase() === "lte";

  try {
    sendCallMediaEvent({
      type: "inbound-remote-profile",
      ...getInboundDiagContext(st, invitation),
      remoteProfile: remoteProfile || undefined,
      forceRelayForThisCall,
      msg: `Remote caller profile header: ${remoteProfile || "none"}`,
    });
  } catch {}

  const inviteOptions = {
    sessionDescriptionHandlerModifiers: [g711OnlyModifier],
    sessionDescriptionHandlerOptions: {
      constraints: { audio: true, video: false },
      localMediaStream: getLocalStream() || undefined,
      peerConnectionConfiguration: forceRelayForThisCall
        ? {
            iceServers: ICE_SERVERS,
            iceTransportPolicy: "relay",
          }
        : undefined,
    },
  };

  await invitation.accept(inviteOptions);

  try {
    const pc = invitation?.sessionDescriptionHandler?.peerConnection;
    const line = `[${nowISO()}] [incoming:diag] accept() resolved: pc=${!!pc} hasGetStats=${typeof pc?.getStats === "function"} hasGetReceivers=${typeof pc?.getReceivers === "function"}`;
    logLine(line);
    console.log(line);
  } catch {}

  sendCallMediaEvent({
    type: "answer-accept-success",
    ...getInboundDiagContext(st, invitation),
    aor,
    callId,
    t_answerClicked,
    msg: "invitation.accept() resolved",
  });
}
