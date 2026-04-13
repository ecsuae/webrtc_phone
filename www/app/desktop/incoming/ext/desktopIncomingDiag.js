import { isMobileCompatModeEnabled } from "../../../features/mobileNetworkMode.js";

function getInboundCorrId(invitation) {
  try {
    const req = invitation?.request;
    if (req && typeof req.getHeader === "function") {
      const v = req.getHeader("X-WebRTC-CorrId");
      if (v && String(v).trim()) return String(v).trim().slice(0, 128);
    }
  } catch {}
  try {
    const h = invitation?.request?.headers?.["X-WebRTC-CorrId"] || invitation?.request?.headers?.["x-webrtc-corrid"];
    const first = Array.isArray(h) ? h[0] : h;
    const raw = first?.raw || first?.value || first;
    if (raw && String(raw).trim()) return String(raw).trim().slice(0, 128);
  } catch {}
  return undefined;
}

export function getHeaderValue(request, headerName) {
  try {
    const headers = request?.getHeaders?.() || request?.headers || [];
    if (Array.isArray(headers)) {
      const want = String(headerName || "").toLowerCase();
      for (const h of headers) {
        if (typeof h !== "string") continue;
        const idx = h.indexOf(":");
        if (idx <= 0) continue;
        const name = h.slice(0, idx).trim().toLowerCase();
        if (name !== want) continue;
        return h.slice(idx + 1).trim();
      }
    }
  } catch {}
  return undefined;
}

export function getInboundDiagContext(st, invitation) {
  const username = st.account?.rawUsername || st.account?.username || invitation?.localIdentity?.uri?.user || undefined;
  const domain = st.account?.domain || invitation?.localIdentity?.uri?.host || undefined;
  const aor = username && domain ? `${username}@${domain}` : undefined;
  const peerUser = invitation?.remoteIdentity?.uri?.user || undefined;
  const peerDomain = invitation?.remoteIdentity?.uri?.host || undefined;
  const peerAor = peerUser ? (peerDomain ? `${peerUser}@${peerDomain}` : peerUser) : undefined;
  const callId = invitation?.request?.callId || undefined;
  const corrId = getInboundCorrId(invitation);
  const sessionId = invitation?.id || invitation?._id || undefined;
  const lteMode = isMobileCompatModeEnabled();
  const mode = lteMode ? "lte" : "wifi";
  const icePolicy = lteMode ? "relay" : "all";
  return {
    username,
    domain,
    aor,
    dir: "inbound",
    peer: peerUser,
    peerDomain,
    peerAor,
    callId,
    corrId,
    sessionId,
    lteMode,
    mode,
    selectedProfile: st.selectedProfile || mode,
    icePolicy,
  };
}
