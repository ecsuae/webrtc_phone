import { formatSipResponse, getSipRejectDetails, mapSipFailureToMessage } from "../../desktopLogging.js";
import {
  emitDesktopOutboundAccept,
  emitDesktopOutboundProgress,
  emitDesktopOutboundReject,
} from "../desktopOutboundSipDiagnostics.js";

function getBody(resp) {
  try {
    return resp?.message?.body || "";
  } catch {
    return "";
  }
}

function hasSdp(body) {
  try {
    return String(body).includes("v=") && String(body).includes("m=audio");
  } catch {
    return false;
  }
}

export function getDesktopExtProgressMeta(resp) {
  const info = formatSipResponse(resp);
  const code = resp?.message?.statusCode || resp?.statusCode || resp?.message?.status;
  const body = getBody(resp);
  const sdp = hasSdp(body);
  const isProvisional = code === 180 || code === 183;
  return { info, code, hasSdp: sdp, isProvisional };
}

export function emitDesktopExtProgress(inviter, st, target, meta = {}) {
  try {
    emitDesktopOutboundProgress(inviter, st, target, {
      code: meta.code,
      hasSdp: meta.hasSdp,
      source: meta.source || "desktopExtSipResponses.emitDesktopExtProgress",
    });
  } catch {}
}

export function getDesktopExtAcceptMeta(resp) {
  const info = formatSipResponse(resp);
  const details = getSipRejectDetails(resp);
  const body = getBody(resp);
  const sdp = hasSdp(body);
  return { info, details, hasSdp: sdp };
}

export function emitDesktopExtAccept(inviter, st, target, meta = {}) {
  try {
    emitDesktopOutboundAccept(inviter, st, target, {
      statusCode: meta?.details?.code || meta?.statusCode || 200,
      reasonPhrase: meta?.details?.reason || meta?.reasonPhrase || "OK",
      hasSdp: meta.hasSdp,
      source: meta.source || "desktopExtSipResponses.emitDesktopExtAccept",
    });
  } catch {}
}

export function getDesktopExtRejectMeta(resp) {
  const info = formatSipResponse(resp);
  const details = getSipRejectDetails(resp);
  const human = mapSipFailureToMessage(details);
  const q850 = details.q850Cause
    ? `; Q.850 cause=${details.q850Cause}${details.q850Text ? ` (${details.q850Text})` : ""}`
    : "";
  return { info, details, human, q850 };
}

export function emitDesktopExtReject(inviter, st, target, meta = {}) {
  try {
    emitDesktopOutboundReject(inviter, st, target, {
      statusCode: meta?.details?.code || meta?.statusCode || undefined,
      reasonPhrase: meta?.details?.reason || meta?.reasonPhrase || undefined,
      q850Cause: meta?.details?.q850Cause || meta?.q850Cause || undefined,
      q850Text: meta?.details?.q850Text || meta?.q850Text || undefined,
      source: meta.source || "desktopExtSipResponses.emitDesktopExtReject",
    });
  } catch {}
}
