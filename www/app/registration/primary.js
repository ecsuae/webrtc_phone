import { ICE_SERVERS, ICE_TRANSPORT_POLICY, nowISO, maskPassword } from "../config.js";
import { isMobileCompatModeEnabled } from "../features/mobileNetworkMode.js";
import { formatSipResponse, logLine } from "../log.js";
import { normalizeWssServer } from "../dom.js";
import { sendCallMediaEvent } from "../features/callMediaLog.js";
import * as Push from "../push.js";
import { saveSessionPassword } from "../push/recoverySession.js";
import { handleIncomingCallIsolated } from "../sipCallIncoming.js";
import { setRegistrationComplete } from "../incoming/handlers.js";
import { setUsername } from "../remoteLogs.js";
import {
  diagInit,
  diagStep,
  diagError,
  diagClear,
  diagStartConnectTimer,
  diagCancelConnectTimer,
  diagStartResponseTimer,
  diagCancelResponseTimer,
} from "./regDiag.js";

function attachTransportListener(st, ui) {
  st.ua.transport?.stateChange?.addListener?.((state) => {
    logLine(`[${nowISO()}] [transport] ${state}`);
    ui.setTransport(String(state));

    // Auto-register when connection is restored
    if (state === "Connected") {
      diagCancelConnectTimer();
      diagStep("REG-006");
      if (st.reg && !st.registered && !st.registering) {
        logLine(`[${nowISO()}] [transport] Connection restored - auto-registering`);
        st.registering = true;
        st.reg.register().catch((err) => {
          st.registering = false;
          logLine(`[${nowISO()}] [transport] Auto-registration failed: ${err?.message || err}`);
        });
      }
    }

    // Handle disconnection - prepare for reconnection
    if (state === "Disconnected" || state === "Disconnecting") {
      logLine(`[${nowISO()}] [transport] Disconnected - will auto-reconnect`);
      // Only emit REG-E004 if we haven't registered yet (mid-registration drop)
      if (!st.registered) {
        diagError("REG-E004", state);
      }
      // Do not force UI back to login while a call (or incoming call) is active.
      if (!st.session && !st.incomingInvitation) {
        st.registered = false;
      }
    }
  });
}

function buildUserAgent(SIP, st, ui, account, pass, wss) {
  const ext = account.username;
  const domain = account.domain;
  const uri = SIP.UserAgent.makeURI(`sip:${ext}@${domain}`);
  if (!uri) return null;

  st.ua = new SIP.UserAgent({
    uri,
    authorizationUsername: ext,
    authorizationPassword: pass,
    sipExtension100rel: "Supported",
    transportOptions: {
      server: wss,
      connectionTimeout: 15,         // 15s to accommodate LTE cold-start TLS latency (was 8s)
      keepAliveInterval: 15,         // Aggressive keepalive to maintain CGNAT entries on mobile
      keepAliveDebounce: 3,
    },
    reconnectionAttempts: 999,       // Effectively infinite reconnection attempts
    reconnectionDelay: 2,            // Reduced from 3s for faster reconnection
    sessionDescriptionHandlerFactoryOptions: {
      peerConnectionConfiguration: {
        iceServers: ICE_SERVERS,
        iceTransportPolicy: isMobileCompatModeEnabled() ? "relay" : ICE_TRANSPORT_POLICY,
      },
    },
    delegate: {
      onInvite: (invitation) => {
        const callerUser = invitation.remoteIdentity?.uri?.user || "unknown";
        logLine(`[${nowISO()}] [incoming] INCOMING CALL RECEIVED from ${callerUser}`);
        handleIncomingCallIsolated(SIP, st, ui, invitation);
      },
    },
  });

  const _iceMode = isMobileCompatModeEnabled() ? "relay" : ICE_TRANSPORT_POLICY;
  if (_iceMode === "relay") {
    logLine(`[${nowISO()}] [UA] ICE transport policy = relay — LTE/5G media relay mode ACTIVE (all media via TURN)`);
  } else {
    logLine(`[${nowISO()}] [UA] ICE transport policy = ${_iceMode}`);
  }
  sendCallMediaEvent({
    type: 'ua-ice-policy',
    aor: `${account.username}@${account.domain}`,
    lteMode: _iceMode === "relay",
    icePolicy: _iceMode,
  });

  attachTransportListener(st, ui);
  return uri;
}

export async function startPrimaryRegistration(SIP, st, ui) {
  // REG-001: check config and SIP.js loaded
  diagInit();
  if (!window.SIP && !SIP) {
    diagError("REG-E002", "window.SIP not found");
    return null;
  }
  diagStep("REG-001");

  const account = ui.account ? ui.account() : {
    rawUsername: ui.ext(),
    username: ui.ext(),
    domain: ui.domain(),
  };

  const ext = account.username;
  const domain = account.domain;
  const pass = ui.pass();
  const wss = normalizeWssServer(ui.wss(), ui.wssFallback());

  logLine(`[${nowISO()}] [boot] startAndRegister clicked`);
  logLine(`[${nowISO()}] [debug] input=${account.rawUsername || ""}`);
  logLine(`[${nowISO()}] [debug] ext=${ext}`);
  logLine(`[${nowISO()}] [debug] domain=${domain}`);
  logLine(`[${nowISO()}] [debug] password=${maskPassword(pass)}`);
  logLine(`[${nowISO()}] [debug] wss=${wss}`);
  const compatMode = isMobileCompatModeEnabled();
  logLine(`[${nowISO()}] [debug] ICE policy=${compatMode ? "relay (LTE/5G compat)" : ICE_TRANSPORT_POLICY}`);

  // REG-E001: input validation
  if (!ext || !domain || !pass) {
    diagError("REG-E001", !ext ? "extension missing" : !domain ? "domain missing" : "password missing");
    ui.setStatus("Missing ext/domain/password");
    return null;
  }

  // REG-002: input valid; REG-003: WSS URL resolved
  diagStep("REG-002");
  diagStep("REG-003");

  // Capture intended username early so metadata does not remain not-logged-in.
  try {
    setUsername(ext);
  } catch (err) {
    console.error('[RemoteLogs] Failed to pre-set username:', err);
  }

  // Save registration credentials to localStorage for auto-restore after screen lock
  try {
    if (!st._skipCredentialPersist) {
      localStorage.setItem('webrtc_last_registration', JSON.stringify({
        ext,
        domain,
        wss,
        timestamp: Date.now()
      }));
      saveSessionPassword(pass);
    }
  } catch (err) {
    console.error('[Registration] Failed to save credentials:', err);
  }

  ui.setStatus("Starting...");
  ui.setTransport("Connecting...");

  // REG-004: build UserAgent
  const uri = buildUserAgent(SIP, st, ui, account, pass, wss);
  if (!uri) {
    diagError("REG-E001", "SIP URI construction failed");
    ui.setStatus("Invalid SIP URI");
    return null;
  }
  diagStep("REG-004");

  if (SIP.Logger && SIP.LogLevel) SIP.Logger.level = SIP.LogLevel.debug;

  // REG-005: transport connecting
  diagStep("REG-005");
  diagStartConnectTimer(20000);

  try {
    await st.ua.start();
    st.account = {
      username: ext,
      domain,
      rawUsername: account.rawUsername || ext,
      authUsername: ext,
    };
  } catch (e) {
    const msg = String(e?.message || e || "").toLowerCase();
    logLine(`[${nowISO()}] [error] ua.start() failed`, e?.message || e);
    diagCancelConnectTimer();
    if (msg.includes("tls") || msg.includes("cert") || msg.includes("ssl") || msg.includes("handshake")) {
      diagError("REG-E008", e?.message || String(e));
    } else if (msg.includes("dns") || msg.includes("getaddr") || msg.includes("enotfound")) {
      diagError("REG-E007", e?.message || String(e));
    } else {
      diagError("REG-E003", e?.message || String(e));
    }
    ui.setStatus("UA start failed");
    ui.setTransport("-");
    st.ua = null;
    return null;
  }

  st.reg = new SIP.Registerer(st.ua, {
    expires: 300,                   // Increased from 180s to 300s (5 minutes) for better mobile stability
    delegate: {
      onAccept: (r) => {
        diagCancelResponseTimer();
        st.registered = true;
        st.registering = false;
        diagStep("REG-010");
        // Hide diagnostics after brief delay on success — keeps widget out of the way
        setTimeout(() => { if (st.registered) diagClear(); }, 3000);
        const info = formatSipResponse(r);
        logLine(`[${nowISO()}] [registerer] accepted ${info}`.trim());
        ui.setStatus("Registered");
        ui.setButtons();

        // Track username for mobile debugging
        try {
          setUsername(ext);
        } catch (err) {
          console.error('[RemoteLogs] Failed to set username:', err);
        }

        setRegistrationComplete();  // Notify incoming handler that registration is complete
        const subscribedExt = st.account?.username || ext;
        if (subscribedExt) Push.subscribeAfterRegister(subscribedExt).catch(() => {});
      },
      onReject: (r) => {
        diagCancelResponseTimer();
        st.registered = false;
        st.registering = false;
        const statusCode = r?.message?.statusCode;
        const info = formatSipResponse(r);
        if (statusCode >= 500 && statusCode < 600) {
          diagError("REG-E009", info || String(statusCode));
        } else {
          diagError("REG-E006", info || "rejected");
        }
        ui.setStatus(info ? `Register failed (${info})` : "Register failed");
        logLine(`[${nowISO()}] [registerer] rejected ${info}`.trim());
        ui.setButtons();
      },
    },
  });

  st.reg.stateChange?.addListener?.((s) => {
    const low = String(s).toLowerCase();
    if (low.includes("registered")) {
      st.registered = true;
      try {
        setUsername(ext);
      } catch (err) {
        console.error('[RemoteLogs] Failed to set username on stateChange:', err);
      }
    }
    if (low.includes("unregistered") || low.includes("terminated")) st.registered = false;
    ui.setButtons();
  });

  try {
    st.registering = true;
    st.reg.register();
    // REG-007: REGISTER sent — start response timer
    diagStep("REG-007");
    diagStartResponseTimer(30000);
    ui.setStatus("Registering...");
  } catch (e) {
    st.registering = false;
    logLine(`[${nowISO()}] [error] register() failed`, e?.message || e);
    diagError("REG-E005", e?.message || String(e));
    ui.setStatus("Register failed");
  }

  ui.setButtons();
  return { ext, domain, wss };
}
