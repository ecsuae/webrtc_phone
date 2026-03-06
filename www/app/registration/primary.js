import { ICE_SERVERS, ICE_TRANSPORT_POLICY, nowISO, maskPassword } from "../config.js";
import { formatSipResponse, logLine } from "../log.js";
import { normalizeWssServer } from "../dom.js";
import * as Push from "../push.js";
import { handleIncomingCallIsolated } from "../sipCallIncoming.js";

function attachTransportListener(st, ui) {
  st.ua.transport?.stateChange?.addListener?.((state) => {
    logLine(`[${nowISO()}] [transport] ${state}`);
    ui.setTransport(String(state));
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
    transportOptions: { server: wss },
    sessionDescriptionHandlerFactoryOptions: {
      peerConnectionConfiguration: { iceServers: ICE_SERVERS, iceTransportPolicy: ICE_TRANSPORT_POLICY },
    },
    delegate: {
      onInvite: (invitation) => {
        const callerUser = invitation.remoteIdentity?.uri?.user || "unknown";
        logLine(`[${nowISO()}] [incoming] INCOMING CALL RECEIVED from ${callerUser}`);
        handleIncomingCallIsolated(SIP, st, ui, invitation);
      },
    },
  });

  attachTransportListener(st, ui);
  return uri;
}

export async function startPrimaryRegistration(SIP, st, ui) {
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
  logLine(`[${nowISO()}] [debug] ICE policy=${ICE_TRANSPORT_POLICY}`);

  if (!ext || !domain || !pass) {
    ui.setStatus("Missing ext/domain/password");
    return null;
  }

  ui.setStatus("Starting...");
  ui.setTransport("Connecting...");
  const uri = buildUserAgent(SIP, st, ui, account, pass, wss);
  if (!uri) {
    ui.setStatus("Invalid SIP URI");
    return null;
  }

  if (SIP.Logger && SIP.LogLevel) SIP.Logger.level = SIP.LogLevel.debug;

  try {
    await st.ua.start();
    st.account = {
      username: ext,
      domain,
      rawUsername: account.rawUsername || ext,
      authUsername: ext,
    };
  } catch (e) {
    logLine(`[${nowISO()}] [error] ua.start() failed`, e?.message || e);
    ui.setStatus("UA start failed");
    ui.setTransport("-");
    st.ua = null;
    return null;
  }

  st.reg = new SIP.Registerer(st.ua, {
    delegate: {
      onAccept: (r) => {
        st.registered = true;
        st.registering = false;
        const info = formatSipResponse(r);
        logLine(`[${nowISO()}] [registerer] accepted ${info}`.trim());
        ui.setStatus("Registered");
        ui.setButtons();
        const subscribedExt = st.account?.username || ext;
        if (subscribedExt) Push.subscribeAfterRegister(subscribedExt).catch(() => {});
      },
      onReject: (r) => {
        st.registered = false;
        st.registering = false;
        const info = formatSipResponse(r);
        ui.setStatus(info ? `Register failed (${info})` : "Register failed");
        logLine(`[${nowISO()}] [registerer] rejected ${info}`.trim());
        ui.setButtons();
      },
    },
  });

  st.reg.stateChange?.addListener?.((s) => {
    const low = String(s).toLowerCase();
    if (low.includes("registered")) st.registered = true;
    if (low.includes("unregistered") || low.includes("terminated")) st.registered = false;
    ui.setButtons();
  });

  try {
    st.registering = true;
    st.reg.register();
    ui.setStatus("Registering...");
  } catch (e) {
    st.registering = false;
    logLine(`[${nowISO()}] [error] register() failed`, e?.message || e);
    ui.setStatus("Register failed");
  }

  ui.setButtons();
  return { ext, domain, wss };
}
