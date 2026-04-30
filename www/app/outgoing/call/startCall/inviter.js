import { g711OnlyModifier } from "../../../sdp.js";
import { getLocalStream } from "../../../media.js";

export function createInviter({ SIP, st, targetUri, corrId, selectedProfile }) {
  const inviter = new SIP.Inviter(st.ua, targetUri, {
    earlyMedia: true,
    extraHeaders: ["P-Early-Media: supported", `X-WebRTC-CorrId: ${corrId}`, `X-WebRTC-Profile: ${selectedProfile}`],
    sessionDescriptionHandlerModifiers: [g711OnlyModifier],
    sessionDescriptionHandlerOptions: {
      constraints: { audio: true, video: false },
      localMediaStream: getLocalStream() || undefined,
    },
  });

  try {
    inviter.__webrtcCorrId = corrId;
  } catch {}

  return inviter;
}
