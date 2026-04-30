/**
 * Registration Diagnostics Catalog — regDiagCatalog.js
 *
 * Authoritative source for all REG-E error codes.
 *
 * shortLabel  — user-safe text shown on the login page (no tech jargon)
 * longDescription — full technical explanation for admin/ops use
 * likelyLayer     — which system layer owns the failure
 * commonCauses    — string[] of likely root causes
 * recommendedChecks — string[] of diagnostic actions
 *
 * IMPORTANT: The push-server mirrors this catalog in:
 *   push-server/src/diagCatalog.js  (CommonJS)
 * Keep both files in sync when adding or changing codes.
 */

export const ERROR_CATALOG = [
  {
    code: "REG-E001",
    shortLabel: "Invalid credentials",
    longDescription: "The extension, domain, or password field was empty, or the SIP URI could not be constructed from the provided values.",
    likelyLayer: "Frontend — user input",
    commonCauses: [
      "Extension field left blank",
      "Domain field left blank",
      "Password field left blank",
      "Extension contains characters that produce an invalid SIP URI",
    ],
    recommendedChecks: [
      "Verify all three fields are filled in",
      "Check that the extension is a number or valid SIP user string",
      "Confirm the domain matches what is configured in FusionPBX",
    ],
  },
  {
    code: "REG-E002",
    shortLabel: "App configuration error",
    longDescription: "The SIP.js library (window.SIP) was not found at startup, or the app was opened directly from the filesystem (file://) instead of being served over HTTPS. The APP_CONFIG data attributes injected by the index.html template may also be missing.",
    likelyLayer: "Frontend — page load / deployment",
    commonCauses: [
      "Page opened as file:// URL instead of https://",
      "www/index.html not generated from template (make config not run)",
      "SIP.js script failed to load (network error, CSP block)",
    ],
    recommendedChecks: [
      "Confirm the URL begins with https://",
      "Run `make config` to regenerate index.html from template",
      "Check browser console for SIP.js load errors",
      "Verify window.APP_CONFIG is present in browser console",
    ],
  },
  {
    code: "REG-E003",
    shortLabel: "Connection timeout",
    longDescription: "The WebSocket connection to the signaling server did not complete within the 20-second connect timer. The ua.start() call may also have thrown with a generic network error (not DNS or TLS specific).",
    likelyLayer: "Network — client to Nginx/Kamailio",
    commonCauses: [
      "Nginx not running or not reachable on port 443",
      "Firewall blocking TCP 443 from the client",
      "LTE carrier CGNAT dropping the connection silently",
      "Kamailio WebSocket port (8443) not listening or misconfigured",
    ],
    recommendedChecks: [
      "Check nginx container: `docker logs nginx`",
      "Check Kamailio container: `docker logs kamailio`",
      "Verify port 443 is reachable: `curl -v https://phone.srve.cc`",
      "Enable LTE/5G Mode toggle if on mobile data",
      "Verify Nginx proxy_buffering off is set on /ws location",
    ],
  },
  {
    code: "REG-E004",
    shortLabel: "Connection dropped",
    longDescription: "The WebSocket connection was established but then closed or disconnected before registration completed. The SIP.js transport state transitioned to Disconnected or Disconnecting while st.registered was still false.",
    likelyLayer: "Network — TCP keepalive / CGNAT",
    commonCauses: [
      "LTE carrier NAT table expiry during registration (30–60s window)",
      "Nginx keepalive timeout too short for mobile networks",
      "Network handoff (LTE ↔ Wi-Fi) during registration",
      "Kamailio keepalive_timeout expired (currently set to 20s)",
    ],
    recommendedChecks: [
      "Enable LTE/5G Mode to force TURN relay",
      "Verify Nginx proxy_buffering off on /ws (prevents delayed ping/pong)",
      "Check Kamailio keepalive_timeout value in kamailio.cfg",
      "Check SIP.js connectionTimeout and keepAliveInterval in primary.js",
    ],
  },
  {
    code: "REG-E005",
    shortLabel: "Registration timeout",
    longDescription: "A REGISTER request was sent but no SIP response (200 OK or 401 challenge) was received within the 30-second response timer. The transport connected successfully (REG-006 was reached) but the REGISTER was not answered by Kamailio or the PBX.",
    likelyLayer: "SIP signaling — Kamailio → PBX",
    commonCauses: [
      "Kamailio running but not forwarding REGISTER to PBX",
      "FusionPBX/FreeSWITCH not reachable from Kamailio (PBX_IP misconfigured)",
      "Kamailio domain map not matching the client's SIP domain",
      "PBX_PORT incorrect in .env / local.cfg",
    ],
    recommendedChecks: [
      "Check Kamailio logs: `docker logs kamailio`",
      "Verify PBX_IP and PBX_PORT in generated kamailio/local.cfg",
      "Check FusionPBX is running and listening on SIP/UDP 5060",
      "Run `make config` if .env was recently changed",
      "Check domain map in kamailio/routes/50-domain-map.cfg",
    ],
  },
  {
    code: "REG-E006",
    shortLabel: "Authentication failed",
    longDescription: "The REGISTER request was rejected by FusionPBX with a 4xx status code. This typically means the extension credentials are wrong or the extension does not exist in FusionPBX.",
    likelyLayer: "SIP authentication — PBX",
    commonCauses: [
      "Wrong password for the extension",
      "Extension does not exist in FusionPBX",
      "Extension exists but is disabled in FusionPBX",
      "SIP realm mismatch between client domain and FusionPBX domain",
    ],
    recommendedChecks: [
      "Verify the extension and password in FusionPBX → Accounts → Extensions",
      "Check that the domain matches the FusionPBX domain",
      "Look for 403 vs 401 in Kamailio logs to distinguish disabled vs wrong password",
    ],
  },
  {
    code: "REG-E007",
    shortLabel: "Host unreachable",
    longDescription: "The ua.start() call threw an error with DNS-related keywords (dns, getaddr, enotfound). The WebSocket server hostname could not be resolved from the client's network.",
    likelyLayer: "Network — DNS resolution",
    commonCauses: [
      "Client DNS cannot resolve the WSS hostname",
      "No internet connectivity on the client device",
      "WSS hostname typo in app config (check data-wss-host in index.html)",
      "DNS server not responding on the client's network",
    ],
    recommendedChecks: [
      "Try nslookup phone.srve.cc from the client device",
      "Check that the device has general internet access",
      "Verify data-wss-host attribute in generated www/index.html",
    ],
  },
  {
    code: "REG-E008",
    shortLabel: "Secure connection failed",
    longDescription: "The ua.start() call threw an error with TLS/certificate-related keywords (tls, cert, ssl, handshake). The WebSocket TLS handshake failed, usually due to an expired certificate or a certificate the browser does not trust.",
    likelyLayer: "Network — TLS/certificate",
    commonCauses: [
      "TLS certificate expired",
      "Self-signed certificate not trusted by the browser",
      "Certificate Common Name does not match the WSS hostname",
      "Intermediate certificate chain missing from Nginx config",
    ],
    recommendedChecks: [
      "Open https://phone.srve.cc in the browser and check for certificate warnings",
      "Verify cert expiry: `openssl s_client -connect phone.srve.cc:443`",
      "Check Nginx TLS cert and key paths in the generated Nginx config",
      "Re-issue certificate if expired (Let's Encrypt: `certbot renew`)",
    ],
  },
  {
    code: "REG-E009",
    shortLabel: "Server unavailable",
    longDescription: "The REGISTER request reached Kamailio, which relayed it to FusionPBX, but FusionPBX responded with a 5xx error code. This means Kamailio is reachable but the PBX itself is not processing registrations.",
    likelyLayer: "PBX — FusionPBX/FreeSWITCH",
    commonCauses: [
      "FusionPBX/FreeSWITCH not running or overloaded",
      "FusionPBX registrations module disabled",
      "Kamailio forwarding to wrong PBX host/port (check PBX_IP in local.cfg)",
      "FusionPBX 503 Service Unavailable during startup",
    ],
    recommendedChecks: [
      "Check FusionPBX is running and SIP port (5060 UDP) is listening",
      "Look at Kamailio logs for the 5xx response code",
      "Verify PBX_IP and PBX_PORT in generated kamailio/local.cfg",
      "Check FusionPBX error logs",
    ],
  },
  {
    code: "REG-E010",
    shortLabel: "Internal state error",
    longDescription: "Reserved for frontend state synchronization failures — where the SIP.js onAccept delegate fired but the application registered flag was not correctly set. This code is a diagnostic safety net and should not occur in normal operation.",
    likelyLayer: "Frontend — application state",
    commonCauses: [
      "Race condition in SIP.js delegate firing order (rare)",
      "Application state object re-created unexpectedly",
    ],
    recommendedChecks: [
      "Check browser console for JavaScript errors during registration",
      "Reload the page and retry",
      "File a bug with the Trace ID if reproducible",
    ],
  },
];

/**
 * Fast lookup by code: { "REG-E003": { ...entry } }
 */
export const ERROR_MAP = Object.fromEntries(ERROR_CATALOG.map((e) => [e.code, e]));

/**
 * User-safe step labels for the login widget.
 * No technology names (no: SIP, WSS, transport, REGISTER, UA, Kamailio, PBX).
 */
export const STEP_LABELS = {
  "REG-001": "Checking configuration",
  "REG-002": "Credentials validated",
  "REG-003": "Server address resolved",
  "REG-004": "Connecting...",
  "REG-005": "Connecting to server...",
  "REG-006": "Connected",
  "REG-007": "Sending registration...",
  "REG-008": "Verifying credentials...",
  "REG-009": "Completing registration...",
  "REG-010": "Registered",
};
