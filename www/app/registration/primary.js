import { ICE_TRANSPORT_POLICY, nowISO, maskPassword } from "../config.js";
import { isMobileCompatModeEnabled } from "../features/mobileNetworkMode.js";
import { formatSipResponse, logLine } from "../log.js";
import { normalizeWssServer } from "../dom.js";
import { sendCallMediaEvent } from "../features/callMediaLog.js";
import * as Push from "../push.js";
import { saveSessionPassword } from "../push/recoverySession.js";
import { handleIncomingCallIsolated } from "../sipCallIncoming.js";
import { setRegistrationComplete } from "../incoming/handlers.js";
import { setUsername } from "../remoteLogs.js";
import { buildRegistrationConfig } from "./registrationConfig.js";
import { attachRegistererStateEvents, attachTransportEvents, createRegistererDelegate } from "./registrationEvents.js";
import { createRegisterer, createUserAgent, sendRegister, startUserAgent } from "./registrationService.js";
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

const OUTBOUND_CALLER_PROBE_BUILD_ID = 'probe-900900-2026-03-29T02:45Z';
const LTE_CALLER_SOURCE_BUILD_ID = 'lte-caller-obs-2026-03-29T09:35+05';

function attachTransportListener(st, ui) {
  attachTransportEvents({
    st,
    getHasActiveCall: () => !!st.session || !!st.incomingInvitation,
    onState: (state) => {
      logLine(`[${nowISO()}] [transport] ${state}`);
      ui.setTransport(String(state));
    },
    onConnected: () => {
      // Auto-register when connection is restored
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
    },
    onDisconnected: (state) => {
      logLine(`[${nowISO()}] [transport] Disconnected - will auto-reconnect`);
      // Only emit REG-E004 if we haven't registered yet (mid-registration drop)
      if (!st.registered) {
        diagError("REG-E004", state);
      }
    },
  });
}

function buildUserAgent(SIP, st, ui, account, pass, wss) {
  const config = buildRegistrationConfig({
    SIP,
    account,
    pass,
    wss,
    mobileCompatMode: isMobileCompatModeEnabled(),
  });

  const ext = account.username;
  const domain = account.domain;
  const uri = config.userAgentOptions?.uri;
  if (!uri) return null;

  const _iceMode = config.iceTransportPolicy;
  st.selectedProfile = config.selectedProfile;

  sendCallMediaEvent({
    type: 'profile-selected',
    username: account.username,
    domain: account.domain,
    aor: `${account.username}@${account.domain}`,
    lteMode: _iceMode === 'relay',
    selectedProfile: st.selectedProfile,
    msg: 'Selected call profile applied at UA build time',
  });

  ui.setButtons();

  const delegate = {
    onInvite: (invitation) => {
        const callerUser = invitation.remoteIdentity?.uri?.user || "unknown";
        const callerDomain = invitation.remoteIdentity?.uri?.host || null;
        const callId = invitation.request?.callId || null;
        const sessionId = invitation.id || invitation._id || null;
        const aor = `${account.username}@${account.domain}`;
        logLine(`[${nowISO()}] [incoming] INCOMING CALL RECEIVED from ${callerUser}`);

        sendCallMediaEvent({
          type: 'incoming-received',
          username: account.username,
          domain: account.domain,
          aor,
          dir: 'inbound',
          peer: callerUser,
          peerDomain: callerDomain || undefined,
          peerAor: callerDomain ? `${callerUser}@${callerDomain}` : callerUser,
          callId: callId || undefined,
          sessionId: sessionId || undefined,
          mode: isMobileCompatModeEnabled() ? 'lte' : 'wifi',
          selectedProfile: st.selectedProfile,
          icePolicy: isMobileCompatModeEnabled() ? 'relay' : ICE_TRANSPORT_POLICY,
          t_incomingReceived: new Date().toISOString(),
          msg: 'Incoming INVITE received',
        });

        handleIncomingCallIsolated(SIP, st, ui, invitation);
      },
  };

  st.ua = createUserAgent({
    SIP,
    userAgentOptions: config.userAgentOptions,
    delegate,
  });

  if (_iceMode === "relay") {
    logLine(`[${nowISO()}] [UA] ICE transport policy = relay — LTE/5G media relay mode ACTIVE (all media via TURN)`);
  } else {
    logLine(`[${nowISO()}] [UA] ICE transport policy = ${_iceMode}`);
  }
  sendCallMediaEvent({
    type: 'ua-ice-policy',
    username: account.username,
    domain: account.domain,
    aor: `${account.username}@${account.domain}`,
    lteMode: _iceMode === "relay",
    mode: _iceMode === 'relay' ? 'lte' : 'wifi',
    selectedProfile: st.selectedProfile,
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
    await startUserAgent({ st, ua: st.ua });
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

  const config = buildRegistrationConfig({
    SIP,
    account,
    pass,
    wss,
    mobileCompatMode: compatMode,
  });

  const delegate = createRegistererDelegate({
    st,
    onAccept: (r) => {
      diagCancelResponseTimer();
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

      try {
        if (String(ext) === '900900') {
          try {
            window.CALL_MEDIA_SOURCE_BUILD_ID = LTE_CALLER_SOURCE_BUILD_ID;
          } catch {}

          sendCallMediaEvent({
            type: 'outbound-probe-900900',
            probeBuildId: OUTBOUND_CALLER_PROBE_BUILD_ID,
            sourceBuildId: LTE_CALLER_SOURCE_BUILD_ID,
            username: ext,
            domain,
            aor: `${ext}@${domain}`,
            dir: 'outbound',
            lteMode: isMobileCompatModeEnabled(),
            mode: isMobileCompatModeEnabled() ? 'lte' : 'wifi',
            selectedProfile: st.selectedProfile,
            icePolicy: isMobileCompatModeEnabled() ? 'relay' : ICE_TRANSPORT_POLICY,
            msg: 'Caller probe emitted on registration accept (900900)',
          });

          sendCallMediaEvent({
            type: 'lte-caller-probe-login',
            probeBuildId: OUTBOUND_CALLER_PROBE_BUILD_ID,
            sourceBuildId: LTE_CALLER_SOURCE_BUILD_ID,
            username: ext,
            domain,
            aor: `${ext}@${domain}`,
            dir: 'outbound',
            lteMode: isMobileCompatModeEnabled(),
            mode: isMobileCompatModeEnabled() ? 'lte' : 'wifi',
            selectedProfile: st.selectedProfile,
            icePolicy: isMobileCompatModeEnabled() ? 'relay' : ICE_TRANSPORT_POLICY,
            msg: 'LTE caller probe on registration accept',
          });

          try {
            fetch('/api/logs/ping', {
              method: 'GET',
              signal: AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined,
            }).then((resp) => {
              if (resp && resp.ok) {
                sendCallMediaEvent({
                  type: 'lte-caller-ping-ok',
                  probeBuildId: OUTBOUND_CALLER_PROBE_BUILD_ID,
                  sourceBuildId: LTE_CALLER_SOURCE_BUILD_ID,
                  username: ext,
                  domain,
                  aor: `${ext}@${domain}`,
                  dir: 'outbound',
                  lteMode: isMobileCompatModeEnabled(),
                  mode: isMobileCompatModeEnabled() ? 'lte' : 'wifi',
                  selectedProfile: st.selectedProfile,
                  icePolicy: isMobileCompatModeEnabled() ? 'relay' : ICE_TRANSPORT_POLICY,
                  postOk: true,
                  postStatus: resp.status,
                  postStatusText: resp.statusText,
                  postUrl: '/api/logs/ping',
                  msg: 'LTE caller ping ok',
                });
              } else {
                sendCallMediaEvent({
                  type: 'lte-caller-ping-failed',
                  probeBuildId: OUTBOUND_CALLER_PROBE_BUILD_ID,
                  sourceBuildId: LTE_CALLER_SOURCE_BUILD_ID,
                  username: ext,
                  domain,
                  aor: `${ext}@${domain}`,
                  dir: 'outbound',
                  lteMode: isMobileCompatModeEnabled(),
                  mode: isMobileCompatModeEnabled() ? 'lte' : 'wifi',
                  selectedProfile: st.selectedProfile,
                  icePolicy: isMobileCompatModeEnabled() ? 'relay' : ICE_TRANSPORT_POLICY,
                  postOk: false,
                  postStatus: resp?.status,
                  postStatusText: resp?.statusText,
                  postUrl: '/api/logs/ping',
                  msg: 'LTE caller ping failed',
                });
              }
            }).catch((e) => {
              sendCallMediaEvent({
                type: 'lte-caller-ping-failed',
                probeBuildId: OUTBOUND_CALLER_PROBE_BUILD_ID,
                sourceBuildId: LTE_CALLER_SOURCE_BUILD_ID,
                username: ext,
                domain,
                aor: `${ext}@${domain}`,
                dir: 'outbound',
                lteMode: isMobileCompatModeEnabled(),
                mode: isMobileCompatModeEnabled() ? 'lte' : 'wifi',
                selectedProfile: st.selectedProfile,
                icePolicy: isMobileCompatModeEnabled() ? 'relay' : ICE_TRANSPORT_POLICY,
                postOk: false,
                postUrl: '/api/logs/ping',
                postError: String(e?.message || e || 'ping-failed').slice(0, 160),
                msg: 'LTE caller ping failed (fetch)',
              });
            });
          } catch {}
        }
      } catch {
        // no-op
      }
    },
    onReject: (r) => {
      diagCancelResponseTimer();
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
  });

  createRegisterer({
    SIP,
    st,
    ua: st.ua,
    registererOptions: config.registererOptions,
    delegate,
  });

  attachRegistererStateEvents({
    st,
    onStateChange: (s) => {
      const low = String(s).toLowerCase();
      if (low.includes("registered")) {
        try {
          setUsername(ext);
        } catch (err) {
          console.error('[RemoteLogs] Failed to set username on stateChange:', err);
        }
      }
      ui.setButtons();
    },
  });

  try {
    sendRegister({ st });
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
