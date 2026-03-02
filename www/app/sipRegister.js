// www/app/sipRegister.js
import { ICE_SERVERS, ICE_TRANSPORT_POLICY, nowISO, maskPassword } from "./config.js";
import { formatSipResponse, logLine } from "./log.js";
import { normalizeWssServer } from "./dom.js";
import { stopLocalAudioStream } from "./media.js";
import * as Push from "./push.js";
import { handleIncomingCall } from "./sipCall.js";

export function createAppState() {
  return { ua: null, reg: null, registered: false, registering: false, session: null, incomingInvitation: null };
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
    delegate: {
      onInvite: (invitation) => {
        const callerUser = invitation.remoteIdentity?.uri?.user || 'unknown';
        logLine(`[${nowISO()}] [incoming] *** INCOMING CALL RECEIVED from ${callerUser} ***`);
        console.warn(`[INCOMING CALL] from ${callerUser}`, invitation);
        handleIncomingCall(SIP, st, ui, invitation);
      },
    },
  });

  // Verify delegate was set
  logLine(`[${nowISO()}] [VERIFY] st.ua exists: ${!!st.ua}`);
  logLine(`[${nowISO()}] [VERIFY] st.ua.delegate exists: ${!!st.ua.delegate}`);
  logLine(`[${nowISO()}] [VERIFY] st.ua.delegate.onInvite is function: ${typeof st.ua.delegate?.onInvite === 'function'}`);
  console.log('DEBUG: UA Delegate =', st.ua.delegate);

  st.ua.transport?.stateChange?.addListener?.((state) => {
    logLine(`[${nowISO()}] [transport] ${state}`);
    ui.setTransport(String(state));
  });

  logLine(`[${nowISO()}] [CRITICAL] UA created with delegate configured`);
  logLine(`[${nowISO()}] [CRITICAL] onInvite delegate: ${typeof st.ua.delegate?.onInvite === 'function' ? 'CONFIGURED' : 'NOT SET'}`);
  logLine(`[${nowISO()}] [info] Ready to receive incoming calls for ext=${ext}, domain=${domain}`);

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
        
        // Subscribe to push notifications
        const ext = ui.ext();
        if (ext) {
          Push.subscribeAfterRegister(ext).catch(err => {
            logLine(`[${nowISO()}] [push] Subscription failed: ${err.message}`);
          });
        }
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