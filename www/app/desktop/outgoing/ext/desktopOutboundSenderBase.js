import { sendCallMediaEvent } from "../../../features/callMediaLog.js";

export function buildDesktopOutboundSenderBaseContext({ inviter, st, peer, checkpoint }) {
  return {
    username: st?.account?.rawUsername || st?.account?.username || undefined,
    domain: st?.account?.domain || undefined,
    aor: (() => {
      try {
        const u = st?.account?.rawUsername || st?.account?.username || undefined;
        const d = st?.account?.domain || undefined;
        return (u && d) ? `${u}@${d}` : undefined;
      } catch {
        return undefined;
      }
    })(),
    dir: "outbound",
    peer: peer || undefined,
    corrId: inviter?.__webrtcCorrId || st?.__webrtcCorrId || undefined,
    callId: inviter?.outgoingRequestMessage?.callId || undefined,
    sessionId: inviter?.id || inviter?._id || undefined,
    selectedProfile: st?.selectedProfile || undefined,
    icePolicy: (st?.selectedProfile === "lte") ? "relay" : "all",
    lteMode: st?.selectedProfile === "lte",
    mode: (st?.selectedProfile === "lte") ? "lte" : "wifi",
    checkpoint,
  };
}

export function getDesktopOutboundSenderStackTop(label) {
  try {
    const s = (new Error(label)).stack || "";
    return String(s).split("\n").slice(0, 4).join(" | ").slice(0, 256);
  } catch {
    return undefined;
  }
}

export function emitDesktopOutboundSenderMutationEvent(payload) {
  try {
    sendCallMediaEvent(payload);
  } catch {}
}
