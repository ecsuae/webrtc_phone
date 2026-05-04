import { wireDesktopIncomingInvitation } from "../../incoming/desktopIncomingEstablished.js";
import { startIncomingAlert } from "../../incoming/desktopIncomingAlert.js";

function safeErrDetails(err) {
  const name = (() => {
    try {
      return String(err?.name || "");
    } catch {
      return "";
    }
  })();
  const message = (() => {
    try {
      return String(err?.message || err || "");
    } catch {
      return "";
    }
  })();
  const stackLine = (() => {
    try {
      const s = String(err?.stack || "");
      return (s.split("\n")[0] || "").trim();
    } catch {
      return "";
    }
  })();
  return { name, message, stackLine };
}

function buildSipUri(SIP, ext, domain) {
  try {
    if (SIP?.UserAgent?.makeURI) return SIP.UserAgent.makeURI(`sip:${ext}@${domain}`);
  } catch {}
  try {
    return `sip:${ext}@${domain}`;
  } catch {
    return null;
  }
}

export async function startDesktopUaAndRegister(SIP, st, ui, { ext, domain, pass, wss }) {
  if (!SIP) {
    ui.setStatus("SIP.js not loaded");
    return null;
  }

  const sipUri = buildSipUri(SIP, ext, domain);
  if (!sipUri) {
    ui.setStatus("Invalid SIP URI");
    return null;
  }

  st.registering = true;
  st.registered = false;
  ui.setStatus("Starting...");
  ui.setTransport("Connecting...");
  ui.setButtons();

  const userAgentOptions = {
    uri: sipUri,
    authorizationUsername: String(ext || ""),
    authorizationPassword: String(pass || ""),
    transportOptions: {
      server: wss,
    },
  };

  try {
    const passSet = !!String(pass || "");
    const wssSet = !!String(wss || "");
    console.log(`[DESKTOP_REG_DEBUG] UA opts wss_set=${String(wssSet)} pass_set=${String(passSet)}`);
  } catch {}

  let ua;
  try {
    ua = new SIP.UserAgent(userAgentOptions);
  } catch (err) {
    try {
      const d = safeErrDetails(err);
      console.log(
        `[DESKTOP_REG_DEBUG] UA ctor threw name=${String(d.name)} message=${String(d.message)} stack0=${String(
          d.stackLine
        )}`
      );
    } catch {}
    st.registering = false;
    ui.setStatus("UA start failed");
    ui.setTransport("-");
    ui.setButtons();
    return null;
  }

  st.ua = ua;

  try {
    ua.transport?.stateChange?.addListener?.((state) => {
      try {
        ui.setTransport(String(state));
      } catch {}
    });
  } catch {}

  try {
    ua.delegate = {
      onInvite: (invitation) => {
        const callerUser = invitation?.remoteIdentity?.uri?.user || "Unknown";
        const callerDisplay = invitation?.remoteIdentity?.displayName || callerUser;

        try {
          st.incomingInvitation = invitation;
          ui.setButtons();
        } catch {}

        try {
          startIncomingAlert(callerDisplay);
        } catch {}

        try {
          wireDesktopIncomingInvitation(SIP, st, ui, invitation);
        } catch {}
      },
    };
  } catch {}

  try {
    await ua.start();
  } catch (err) {
    try {
      const d = safeErrDetails(err);
      console.log(
        `[DESKTOP_REG_DEBUG] ua.start threw name=${String(d.name)} message=${String(d.message)} stack0=${String(
          d.stackLine
        )}`
      );
    } catch {}
    st.registering = false;
    st.ua = null;
    ui.setStatus("UA start failed");
    ui.setTransport("-");
    ui.setButtons();
    return null;
  }

  let registerer;
  try {
    registerer = new SIP.Registerer(ua);
  } catch (err) {
    st.registering = false;
    ui.setStatus("Register failed");
    ui.setButtons();
    return null;
  }

  st.reg = registerer;

  try {
    registerer.stateChange.addListener((s) => {
      const low = String(s || "").toLowerCase();
      const isRegistered = low === "registered";
      st.registered = isRegistered;
      st.registering = !isRegistered;
      ui.setStatus(isRegistered ? "Registered" : "Registering...");
      ui.setButtons();
    });
  } catch {}

  try {
    await registerer.register();
  } catch (err) {
    st.registering = false;
    st.registered = false;
    ui.setStatus("Register failed");
    ui.setButtons();
    return null;
  }

  st.account = { username: ext, domain, rawUsername: ext, authUsername: ext };
  return { ext, domain, wss };
}
