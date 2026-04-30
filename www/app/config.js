// www/app/config.js

export const SHOW_PASSWORD = false;

// Keep G711 only if you truly need it for PSTN bridging.
// For WebRTC-to-WebRTC, Opus is usually better. But keep as-is for now.
export const G711_ONLY = true;

// IMPORTANT:
// FORCE_RELAY = true will break calls if TURN is not working/reachable.
// Right now your logs show "no suitable candidates found" (488),
// which is exactly what happens when TURN relay candidates are unavailable.
export const FORCE_RELAY = false;

// If FORCE_RELAY is false, allow all candidate types (host/srflx/relay)
export const ICE_TRANSPORT_POLICY = FORCE_RELAY ? "relay" : "all";

// TURN credentials
export const TURN_USERNAME = (window.APP_CONFIG?.TURN_USER || "").trim();
export const TURN_CREDENTIAL = (window.APP_CONFIG?.TURN_PASS || "").trim();

// Hostname
export const TURN_HOST = (window.APP_CONFIG?.TURN_HOST || "").trim();

function isValidIceHostname(host) {
  const value = String(host || "").trim();
  if (!value) return false;
  // Accept IPv4 or DNS-ish hostnames (no scheme, no path, no spaces)
  if (value.includes("://") || value.includes("/") || value.includes(" ")) return false;
  if (/[^a-zA-Z0-9.\-]/.test(value)) return false;
  return true;
}

// Ports
export const TURN_UDP_TCP_PORT = 3478; // TURN/STUN
export const TURN_TLS_PORT = 5349;     // TURN over TLS

// ICE servers:
// - Always include STUN when not forcing relay (helps NAT traversal)
// - Include TURN as fallback
export const ICE_SERVERS = (() => {
  const servers = [];

  // Always keep at least one STUN entry so WebRTC can gather srflx candidates.
  // If TURN_HOST is invalid/missing, fall back to a known-good public STUN server.
  const stunHost = isValidIceHostname(TURN_HOST) ? `${TURN_HOST}:${TURN_UDP_TCP_PORT}` : "stun.l.google.com:19302";
  servers.push({ urls: [`stun:${stunHost}`] });

  // Add TURN only when we have a valid hostname and credentials.
  if (isValidIceHostname(TURN_HOST) && TURN_USERNAME && TURN_CREDENTIAL) {
    servers.push({
      urls: [
        `turn:${TURN_HOST}:${TURN_UDP_TCP_PORT}?transport=udp`,
        `turn:${TURN_HOST}:${TURN_UDP_TCP_PORT}?transport=tcp`,
        `turns:${TURN_HOST}:${TURN_TLS_PORT}`,
      ],
      username: TURN_USERNAME,
      credential: TURN_CREDENTIAL,
    });
  }

  return servers;
})();

// Audio codec set
export const G711_CODECS = new Set(["pcmu", "pcma"]);
export const DTMF_CODEC = "telephone-event";

export function nowISO() {
  return new Date().toISOString();
}

export function maskPassword(p) {
  if (!p) return "";
  if (SHOW_PASSWORD) return p;
  if (p.length <= 2) return "*".repeat(p.length);
  return `${p.slice(0, 2)}****${p.slice(-1)} (len=${p.length})`;
}