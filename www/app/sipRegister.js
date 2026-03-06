// www/app/sipRegister.js
import { ICE_SERVERS, ICE_TRANSPORT_POLICY, nowISO, maskPassword } from "./config.js";
import { formatSipResponse, logLine } from "./log.js";
import { normalizeWssServer } from "./dom.js";
import { stopLocalAudioStream } from "./media.js";
import * as Push from "./push.js";
import { handleIncomingCallIsolated } from "./sipCallIncoming.js";

export function createAppState() {
  return { 
    ua: null,           // UA for PBX registration
    sbcUa: null,        // NEW: UA for SBC registrar (location table)
    reg: null,          // Registerer for PBX
    sbcReg: null,       // NEW: Registerer for SBC
    registered: false, 
    registering: false, 
    session: null, 
    incomingInvitation: null, 
    account: null 
  };
}

export async function startAndRegister(SIP, st, ui) {
  const account = ui.account ? ui.account() : {
    rawUsername: ui.ext(),
    username: ui.ext(),
    domain: ui.domain(),
  };
  const ext = account.username,
    domain = account.domain,
    authUsername = account.username,
    pass = ui.pass(),
    wss = normalizeWssServer(ui.wss(), ui.wssFallback());

  console.log('[startAndRegister] account object:', { rawUsername: account.rawUsername, username: account.username, domain: account.domain, inlineDomain: account.inlineDomain, hasInlineDomain: account.hasInlineDomain });
  logLine(`[${nowISO()}] [boot] startAndRegister clicked`);
  logLine(`[${nowISO()}] [debug] input=${account.rawUsername || ""}`);
  logLine(`[${nowISO()}] [debug] ext=${ext}`);
  logLine(`[${nowISO()}] [debug] domain=${domain}`);
  logLine(`[${nowISO()}] [debug] inlineDomain=${account.inlineDomain || "(none)"}`);
  logLine(`[${nowISO()}] [debug] authUsername=${authUsername || ""}`);
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
    authorizationUsername: authUsername,
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
        handleIncomingCallIsolated(SIP, st, ui, invitation);
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
    st.account = {
      username: ext,
      domain,
      rawUsername: account.rawUsername || ext,
      authUsername,
    };
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
        logLine(`[${nowISO()}] [registerer] accepted ${info}`.trim());
        
        // Secondary SBC registration temporarily disabled while stabilizing primary registration
        // registerWithSBC(SIP, st, ui, ext, domain, wss);
        
        ui.setStatus("Registered");
        ui.setButtons();
        
        // Subscribe to push notifications
        const subscribedExt = st.account?.username || ext;
        if (subscribedExt) {
          Push.subscribeAfterRegister(subscribedExt).catch(err => {
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

// NEW: Register with SBC as a secondary registrar
// This populates the SBC's location table with the WebSocket contact,
// enabling incoming calls to be routed to the WebSocket client
async function registerWithSBC(SIP, st, ui, ext, domain, wss) {
  try {
    if (st.sbcUa || st.sbcReg) {
      try { await st.sbcReg?.unregister?.(); } catch {}
      try { await st.sbcUa?.stop?.(); } catch {}
      st.sbcUa = null;
      st.sbcReg = null;
    }

    // Extract SBC IP/hostname from WSS URL (e.g., wss://phone.srve.cc/ws -> phone.srve.cc)
    const wssUrl = new URL(wss);
    const sbcHost = wssUrl.hostname; // e.g., "phone.srve.cc"
    
    // Create SBC URI - register with SBC instead of PBX
    const sbcUri = SIP.UserAgent.makeURI(`sip:${ext}@${sbcHost}`);
    if (!sbcUri) {
      logLine(`[${nowISO()}] [sbcReg] Invalid SBC URI for sbcReg`);
      return;
    }

    logLine(`[${nowISO()}] [sbcReg] Creating SBC registrar for ${sbcUri.toString()}`);

    // Create second UA for SBC registration (no auth needed - same domain as transport)
    st.sbcUa = new SIP.UserAgent({
      uri: sbcUri,
      authorizationUsername: ext,
      authorizationPassword: "",  // Empty password for SBC, it's trusted
      transportOptions: { server: wss },
      sessionDescriptionHandlerFactoryOptions: {
        peerConnectionConfiguration: { iceServers: ICE_SERVERS, iceTransportPolicy: ICE_TRANSPORT_POLICY },
      },
    });

    // Create registerer for SBC
    st.sbcReg = new SIP.Registerer(st.sbcUa, {
      delegate: {
        onAccept: (r) => {
          const info = formatSipResponse(r);
          logLine(`[${nowISO()}] [sbcReg] SBC registration accepted ${info}`.trim());
        },
        onReject: (r) => {
          const info = formatSipResponse(r);
          logLine(`[${nowISO()}] [sbcReg] SBC registration rejected ${info}`.trim());
        },
      },
    });

    st.sbcReg.stateChange?.addListener?.((s) => {
      logLine(`[${nowISO()}] [sbcReg] state change: ${s}`);
    });

    // Send registration to SBC
    await st.sbcUa.start();
    logLine(`[${nowISO()}] [sbcReg] sbcUa.start() done`);
    logLine(`[${nowISO()}] [sbcReg] Registering with SBC for incoming call routing`);
    await st.sbcReg.register();
    logLine(`[${nowISO()}] [sbcReg] SBC registration initiated`);
  } catch (e) {
    logLine(`[${nowISO()}] [sbcReg] Error registering with SBC: ${e?.message || e}`);
  }
}

export async function stopAndUnregister(st, ui, silent = false) {
  if (!silent) logLine(`[${nowISO()}] [boot] stopAndUnregister clicked`);

  try {
    await st.reg?.unregister?.();
    logLine(`[${nowISO()}] [debug] unregister() sent`);
  } catch {}

  // Unregister from SBC (secondary registrar)
  try {
    await st.sbcReg?.unregister?.();
    logLine(`[${nowISO()}] [debug] sbcReg.unregister() sent`);
  } catch {}

  st.registered = false;
  st.registering = false;

  try {
    await st.ua?.stop?.();
    logLine(`[${nowISO()}] [debug] ua.stop() done`);
  } catch {}

  // Stop SBC UA (secondary registrar)
  try {
    await st.sbcUa?.stop?.();
    logLine(`[${nowISO()}] [debug] sbcUa.stop() done`);
  } catch {}

  st.ua = null;
  st.reg = null;
  st.account = null;
  st.sbcUa = null;
  st.sbcReg = null;

  stopLocalAudioStream();
  ui.setStatus("Idle");
  ui.setTransport("-");
  ui.setButtons();
}