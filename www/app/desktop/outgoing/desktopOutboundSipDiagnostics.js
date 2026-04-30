import { sendCallMediaEvent } from "../../features/callMediaLog.js";

function safeStr(x) {
  try {
    if (x == null) return "";
    return String(x);
  } catch {
    return "";
  }
}

export function emitDesktopOutboundProgress(inviter, st, target, {
  code,
  hasSdp,
  source,
} = {}) {
  try {
    sendCallMediaEvent({
      type: "desktop-session-progress",
      corrId: inviter?.__webrtcCorrId || st?.__webrtcCorrId || undefined,
      callId: inviter?.outgoingRequestMessage?.callId || undefined,
      dir: "outbound",
      peer: target,
      statusCode: code,
      hasSdp: !!hasSdp,
      sessionState: safeStr(inviter?.state),
      stSessionMatches: !!(st?.session && st.session === inviter),
      source: source || "desktopOutboundSipDiagnostics.emitDesktopOutboundProgress",
      msg: "Outbound progress response observed",
    });
  } catch {}
}

export function emitDesktopOutboundAccept(inviter, st, target, {
  statusCode,
  reasonPhrase,
  hasSdp,
  source,
} = {}) {
  try {
    sendCallMediaEvent({
      type: "desktop-remote-answer-processing",
      corrId: inviter?.__webrtcCorrId || st?.__webrtcCorrId || undefined,
      callId: inviter?.outgoingRequestMessage?.callId || undefined,
      dir: "outbound",
      peer: target,
      statusCode: statusCode || 200,
      reasonPhrase: reasonPhrase || "OK",
      hasSdp: !!hasSdp,
      sessionState: safeStr(inviter?.state),
      stSessionMatches: !!(st?.session && st.session === inviter),
      source: source || "desktopOutboundSipDiagnostics.emitDesktopOutboundAccept",
      msg: "Outbound 200/accept observed (before Established state)",
    });
  } catch {}
}

export function emitDesktopOutboundReject(inviter, st, target, {
  statusCode,
  reasonPhrase,
  q850Cause,
  q850Text,
  source,
} = {}) {
  try {
    sendCallMediaEvent({
      type: "desktop-sip-reject-details",
      corrId: inviter?.__webrtcCorrId || st?.__webrtcCorrId || undefined,
      callId: inviter?.outgoingRequestMessage?.callId || undefined,
      dir: "outbound",
      peer: target,
      statusCode: statusCode || undefined,
      reasonPhrase: reasonPhrase || undefined,
      q850Cause: q850Cause || undefined,
      q850Text: q850Text || undefined,
      sessionState: safeStr(inviter?.state),
      stSessionMatches: !!(st?.session && st.session === inviter),
      source: source || "desktopOutboundSipDiagnostics.emitDesktopOutboundReject",
      msg: "Outbound SIP reject observed",
    });
  } catch {}
}
