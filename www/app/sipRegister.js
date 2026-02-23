// www/app/sipRegister.js
import { ICE_SERVERS, ICE_TRANSPORT_POLICY, nowISO, maskPassword } from "./config.js";
import { formatSipResponse, logLine } from "./log.js";
import { normalizeWssServer } from "./dom.js";
import { stopLocalAudioStream } from "./media.js";

export function createAppState() {
  return { ua: null, reg: null, registered: false, registering: false, session: null };
}

export async function startAndRegister(SIP, st, ui) {
  const ext = ui.ext(),
    domain = ui.domain(),
    pass = ui.pass(),
    wss = normalizeWssServer(ui.wss(), ui.wssFallback());

  logLine(`[${nowISO()}] [boot] startAndRegister clicked`);
  logLine(`[${nowISO()}] [debug] ext=${ext}`);
  logLine(`[${nowISO()}] [debug] domain=${domain}`);
  logLine(`[${nowISO()}] [debug] password=${maskPassword(pass)}`);
  logLine(`[${nowISO()}] [debug] wss=${wss}`);
  logLine(`[${nowISO()}] [debug] ICE policy=${ICE_TRANSPORT_POLICY}`);

  if (!ext || !domain || !pass) return ui.setStatus("Missing ext/domain/password");
  if (st.ua) await stopAndUnregister(st, ui, true);

  const uri = SIP.UserAgent.makeURI(`sip:${ext}@${domain}`);
  if (!uri) return ui.setStatus("Invalid SIP URI");
  if (SIP.Logger && SIP.LogLevel) SIP.Logger.level = SIP.LogLevel.debug;

  ui.setStatus("Starting...");
  ui.setTransport("Connecting...");

  st.ua = new SIP.UserAgent({
    uri,
    authorizationUsername: ext,
    authorizationPassword: pass,
    transportOptions: { server: wss },
    sessionDescriptionHandlerFactoryOptions: {
      peerConnectionConfiguration: { iceServers: ICE_SERVERS, iceTransportPolicy: ICE_TRANSPORT_POLICY },
    },
  });

  st.ua.transport?.stateChange?.addListener?.((state) => {
    logLine(`[${nowISO()}] [transport] ${state}`);
    ui.setTransport(String(state));
  });

  try {
    await st.ua.start();
    logLine(`[${nowISO()}] [debug] ua.start() done`);
  } catch (e) {
    logLine(`[${nowISO()}] [error] ua.start() failed`, e?.message || e);
    ui.setStatus("UA start failed");
    ui.setTransport("-");
    st.ua = null;
    return;
  }

  st.reg = new SIP.Registerer(st.ua, {
    delegate: {
      onAccept: (r) => {
        st.registered = true;
        st.registering = false;
        const info = formatSipResponse(r);
        ui.setStatus(info ? `Registered (${info})` : "Registered");
        logLine(`[${nowISO()}] [registerer] accepted ${info}`.trim());
        ui.setButtons();
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
    logLine(`[${nowISO()}] [registerer] ${s}`);
    const low = String(s).toLowerCase();
    if (low.includes("registered")) st.registered = true;
    if (low.includes("unregistered") || low.includes("terminated")) st.registered = false;
    ui.setButtons();
  });

  try {
    st.registering = true;
    st.reg.register();
    ui.setStatus("Registering...");
    logLine(`[${nowISO()}] [debug] register() called`);
  } catch (e) {
    st.registering = false;
    logLine(`[${nowISO()}] [error] register() failed`, e?.message || e);
    ui.setStatus("Register failed");
  }

  ui.setButtons();
}

export async function stopAndUnregister(st, ui, silent = false) {
  if (!silent) logLine(`[${nowISO()}] [boot] stopAndUnregister clicked`);

  try {
    await st.reg?.unregister?.();
    logLine(`[${nowISO()}] [debug] unregister() sent`);
  } catch {}

  st.registered = false;
  st.registering = false;

  try {
    await st.ua?.stop?.();
    logLine(`[${nowISO()}] [debug] ua.stop() done`);
  } catch {}

  st.ua = null;
  st.reg = null;

  stopLocalAudioStream();
  ui.setStatus("Idle");
  ui.setTransport("-");
  ui.setButtons();
}