import { sendCallMediaEvent } from "../../../features/callMediaLog.js";

const TURN_UDP_TCP_PORT = 3478;
const TURN_TLS_PORT = 5349;

function isValidIceHostname(host) {
  const value = String(host || "").trim();
  if (!value) return false;
  if (value.includes("://") || value.includes("/") || value.includes(" ")) return false;
  if (/[^a-zA-Z0-9.\-]/.test(value)) return false;
  return true;
}

export function buildDesktopIceServersFromWindowConfig() {
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

export function checkDesktopLteRelayAvailable(iceServers, timeoutMs = 8000, diagContext = null) {
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
