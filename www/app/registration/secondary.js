import { ICE_SERVERS, ICE_TRANSPORT_POLICY, nowISO } from "../config.js";
import { formatSipResponse, logLine } from "../log.js";

export async function registerWithSBC(SIP, st, ext, wss) {
  try {
    if (st.sbcUa || st.sbcReg) {
      try { await st.sbcReg?.unregister?.(); } catch {}
      try { await st.sbcUa?.stop?.(); } catch {}
      st.sbcUa = null;
      st.sbcReg = null;
    }

    const wssUrl = new URL(wss);
    const sbcHost = wssUrl.hostname;
    const sbcUri = SIP.UserAgent.makeURI(`sip:${ext}@${sbcHost}`);
    if (!sbcUri) return;

    st.sbcUa = new SIP.UserAgent({
      uri: sbcUri,
      authorizationUsername: ext,
      authorizationPassword: "",
      sipExtension100rel: "Supported",
      transportOptions: { server: wss },
      sessionDescriptionHandlerFactoryOptions: {
        peerConnectionConfiguration: { iceServers: ICE_SERVERS, iceTransportPolicy: ICE_TRANSPORT_POLICY },
      },
    });

    st.sbcReg = new SIP.Registerer(st.sbcUa, {
      delegate: {
        onAccept: (r) => logLine(`[${nowISO()}] [sbcReg] accepted ${formatSipResponse(r)}`.trim()),
        onReject: (r) => logLine(`[${nowISO()}] [sbcReg] rejected ${formatSipResponse(r)}`.trim()),
      },
    });

    await st.sbcUa.start();
    await st.sbcReg.register();
  } catch (e) {
    logLine(`[${nowISO()}] [sbcReg] Error registering with SBC: ${e?.message || e}`);
  }
}

export async function stopSecondaryRegistration(st) {
  try { await st.sbcReg?.unregister?.(); } catch {}
  try { await st.sbcUa?.stop?.(); } catch {}
  st.sbcUa = null;
  st.sbcReg = null;
}
