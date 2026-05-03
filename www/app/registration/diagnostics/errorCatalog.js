export const ERROR_CATALOG = [
  {
    code: "REG-E001",
    shortLabel: "Invalid credentials",
    longDescription:
      "The extension, domain, or password field was empty, or the SIP URI could not be constructed from the provided values.",
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
      "Confirm the domain matches what is configured in your PBX",
    ],
  },
  {
    code: "REG-E002",
    shortLabel: "App configuration error",
    longDescription:
      "The SIP.js library (window.SIP) was not found at startup, or the app was opened directly from the filesystem (file://) instead of being served over HTTPS. The APP_CONFIG data attributes injected by the index.html template may also be missing.",
    likelyLayer: "Frontend — page load / deployment",
    commonCauses: [
      "Page opened as file:// URL instead of https://",
      "www/index.html not generated from template (render not run)",
      "SIP.js script failed to load (network error, CSP block)",
    ],
    recommendedChecks: [
      "Confirm the URL begins with https://",
      "Re-render index.html from template",
      "Check browser console for SIP.js load errors",
      "Verify window.APP_CONFIG is present in browser console",
    ],
  },
  {
    code: "REG-E003",
    shortLabel: "Connection timeout",
    longDescription:
      "The WebSocket connection to the signaling server did not complete within the 20-second connect timer. The ua.start() call may also have thrown with a generic network error (not DNS or TLS specific).",
    likelyLayer: "Network — client to Nginx/Kamailio",
    commonCauses: [
      "Nginx not running or not reachable on port 443",
      "Firewall blocking TCP 443 from the client",
      "LTE carrier CGNAT dropping the connection silently",
      "Kamailio WebSocket port not listening or misconfigured",
    ],
    recommendedChecks: [
      "Check nginx container logs",
      "Check Kamailio container logs",
      "Verify port 443 is reachable: `curl -v https://<your-domain>`",
      "Enable LTE/5G Mode toggle if on mobile data",
      "Verify Nginx proxy_buffering off is set on /ws location",
    ],
  },
  {
    code: "REG-E004",
    shortLabel: "Connection dropped",
    longDescription:
      "The WebSocket connection was established but then closed or disconnected before registration completed. The SIP.js transport state transitioned to Disconnected or Disconnecting while st.registered was still false.",
    likelyLayer: "Network — TCP keepalive / CGNAT",
    commonCauses: [
      "LTE carrier NAT table expiry during registration (30–60s window)",
      "Nginx keepalive timeout too short for mobile networks",
      "Network handoff (LTE ↔ Wi-Fi) during registration",
      "Kamailio keepalive_timeout expired (currently set to 20s)",
    ],
    recommendedChecks: [
      "Try nslookup <your-domain> from the client device",
      "Check that the device has general internet access",
      "Verify data-wss-host attribute in generated www/index.html",
    ],
  },
  {
    code: "REG-E005",
    shortLabel: "Connection refused",
    longDescription:
      "The TCP connection to the signaling server was refused (RST) during the connect attempt.",
    likelyLayer: "Network — client to server",
    commonCauses: [
      "Nginx not listening on port 443",
      "Firewall/security group blocking 443",
      "Wrong hostname points to the wrong server",
    ],
    recommendedChecks: [
      "Verify DNS A/AAAA records",
      "Confirm nginx is running and listening on 443",
      "Check firewall rules",
    ],
  },
  {
    code: "REG-E006",
    shortLabel: "DNS failure",
    longDescription:
      "The signaling hostname could not be resolved to an IP address.",
    likelyLayer: "Network — DNS",
    commonCauses: [
      "Incorrect hostname",
      "DNS record missing",
      "DNS server not responding on the client's network",
    ],
    recommendedChecks: [
      "Try nslookup <your-domain> from the client device",
      "Check that the device has general internet access",
      "Verify data-wss-host attribute in generated www/index.html",
    ],
  },
  {
    code: "REG-E007",
    shortLabel: "TLS certificate mismatch",
    longDescription:
      "The secure WebSocket connection failed because the certificate is not trusted or does not match the hostname.",
    likelyLayer: "Network — TLS/certificate",
    commonCauses: [
      "TLS certificate expired",
      "Self-signed certificate not trusted by the browser",
      "Certificate Common Name does not match the WSS hostname",
      "Intermediate certificate chain missing from Nginx config",
    ],
    recommendedChecks: [
      "Open https://<your-domain> in the browser and check for certificate warnings",
      "Verify cert expiry: `openssl s_client -connect <your-domain>:443`",
      "Check Nginx TLS cert and key paths in the generated Nginx config",
      "Renew or re-issue the certificate if expired",
    ],
  },
  {
    code: "REG-E008",
    shortLabel: "Secure connection failed",
    longDescription:
      "The ua.start() call threw an error with TLS/certificate-related keywords (tls, cert, ssl, handshake). The WebSocket TLS handshake failed, usually due to an expired certificate or a certificate the browser does not trust.",
    likelyLayer: "Network — TLS/certificate",
    commonCauses: [
      "TLS certificate expired",
      "Self-signed certificate not trusted by the browser",
      "Certificate Common Name does not match the WSS hostname",
      "Intermediate certificate chain missing from Nginx config",
    ],
    recommendedChecks: [
      "Open https://<your-domain> in the browser and check for certificate warnings",
      "Verify cert expiry: `openssl s_client -connect <your-domain>:443`",
      "Check Nginx TLS cert and key paths in the generated Nginx config",
      "Re-issue certificate if expired",
    ],
  },
  {
    code: "REG-E009",
    shortLabel: "Server unavailable",
    longDescription:
      "The REGISTER request reached Kamailio, which relayed it to the PBX, but the PBX responded with a 5xx error code.",
    likelyLayer: "PBX",
    commonCauses: [
      "PBX not running or overloaded",
      "PBX registrations module disabled",
      "Kamailio forwarding to wrong PBX host/port",
      "PBX returning 503 Service Unavailable during startup",
    ],
    recommendedChecks: [
      "Check PBX is running and SIP port is listening",
      "Look at Kamailio logs for the 5xx response code",
      "Verify PBX_IP and PBX_PORT in generated kamailio/local.cfg",
      "Check PBX error logs",
    ],
  },
  {
    code: "REG-E010",
    shortLabel: "Internal state error",
    longDescription:
      "Reserved for frontend state synchronization failures — where the SIP.js onAccept delegate fired but the application registered flag was not correctly set.",
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
