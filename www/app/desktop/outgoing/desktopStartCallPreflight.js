import { nowISO, logLine } from "../desktopLogging.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";

const TURN_UDP_TCP_PORT = 3478;
const TURN_TLS_PORT = 5349;

function isValidIceHostname(host) {
  const value = String(host || "").trim();
  if (!value) return false;
  if (value.includes("://") || value.includes("/") || value.includes(" ")) return false;
  if (/[^a-zA-Z0-9.\-]/.test(value)) return false;
  return true;
}

function buildIceServersFromWindowConfig() {
  const turnUser = String(window?.APP_CONFIG?.TURN_USER || "").trim();
  const turnPass = String(window?.APP_CONFIG?.TURN_PASS || "").trim();
  const turnHost = String(window?.APP_CONFIG?.TURN_HOST || "").trim();

  const servers = [];
  const stunHost = isValidIceHostname(turnHost) ? `${turnHost}:${TURN_UDP_TCP_PORT}` : "stun.l.google.com:19302";
  servers.push({ urls: [`stun:${stunHost}`] });

  if (isValidIceHostname(turnHost) && turnUser && turnPass) {
    servers.push({
      urls: [
        `turn:${turnHost}:${TURN_UDP_TCP_PORT}?transport=udp`,
        `turn:${turnHost}:${TURN_UDP_TCP_PORT}?transport=tcp`,
        `turns:${turnHost}:${TURN_TLS_PORT}`,
      ],
      username: turnUser,
      credential: turnPass,
    });
  }

  return servers;
}

function hasTurnServer(iceServers) {
  return (iceServers || []).some((s) => {
    const urls = s?.urls;
    const list = Array.isArray(urls) ? urls : urls ? [urls] : [];
    return list.some((u) => String(u || "").startsWith("turn:") || String(u || "").startsWith("turns:"));
  });
}

function checkLteRelayAvailable(iceServers, timeoutMs = 8000, diagContext = null) {
  return new Promise((resolve) => {
    let pc = null;
    let settled = false;
    const counts = { relay: 0, host: 0, srflx: 0, prflx: 0 };

    const safeIceServers = Array.isArray(iceServers)
      ? iceServers.map((s) => ({
          urls: s?.urls,
          hasUsername: Boolean(s?.username),
          hasCredential: Boolean(s?.credential),
          credentialType: s?.credentialType,
        }))
      : [];

    function settle(extra) {
      if (settled) return;
      settled = true;
      try {
        if (pc && pc.signalingState !== "closed") pc.close();
      } catch {}
      const total = counts.relay + counts.host + counts.srflx + counts.prflx;
      resolve({ ...counts, total, ...extra });
    }

    const timeout = setTimeout(() => settle({ timedOut: true }), timeoutMs);

    try {
      if (diagContext) {
        sendCallMediaEvent({
          type: "outbound-preflight-config",
          ...diagContext,
          iceTransportPolicy: "relay",
          timeoutMs,
          iceServerCount: safeIceServers.length,
          hasTurnServer: hasTurnServer(safeIceServers),
          iceServers: safeIceServers,
          msg: "LTE preflight RTCPeerConnection config (desktop)",
        });
      }
    } catch {}

    try {
      pc = new RTCPeerConnection({ iceServers, iceTransportPolicy: "relay" });
      pc.createDataChannel("preflight");

      pc.addEventListener("icecandidate", (ev) => {
        if (!ev.candidate) {
          clearTimeout(timeout);
          settle({ timedOut: false });
          return;
        }
        const m = ev.candidate.candidate?.match(/\btyp (\w+)\b/);
        const typ = m?.[1];
        if (typ && Object.prototype.hasOwnProperty.call(counts, typ)) counts[typ]++;
      });

      pc.addEventListener("icegatheringstatechange", () => {
        if (pc.iceGatheringState === "complete") {
          clearTimeout(timeout);
          settle({ timedOut: false });
        }
      });

      pc.addEventListener("icecandidateerror", (ev) => {
        try {
          if (!diagContext) return;
          sendCallMediaEvent({
            type: "outbound-preflight-icecandidateerror",
            ...diagContext,
            iceTransportPolicy: "relay",
            errorCode: ev?.errorCode,
            errorText: ev?.errorText,
            url: ev?.url,
            address: ev?.address,
            port: ev?.port,
            hostCandidate: ev?.hostCandidate,
            msg: "LTE preflight icecandidateerror (desktop)",
          });
        } catch {}
      });

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => {
          clearTimeout(timeout);
          settle({ timedOut: true });
        });
    } catch {
      clearTimeout(timeout);
      settle({ timedOut: true });
    }
  });
}

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

  const iceServers = buildIceServersFromWindowConfig();

  let preCheck;
  try {
    preCheck = await checkLteRelayAvailable(iceServers, 8000, ctx);
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
