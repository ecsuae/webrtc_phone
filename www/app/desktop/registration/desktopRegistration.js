import { normalizeWssServer, parseSipAccount } from "../../dom.js";
import { createWakeLockManager } from "../../runtime/wakeLockManager.js";
import { stopLocalAudioStream } from "../../media.js";
import { clearSessionPassword } from "../desktopRecoverySession.js";
import { wireDesktopIncomingInvitation } from "../incoming/desktopIncomingEstablished.js";
import { startIncomingAlert } from "../incoming/desktopIncomingAlert.js";
import { desktopEl } from "../ui/desktopDomRefs.js";

function waitForRegistration(st, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (st.registered) {
        clearInterval(timer);
        resolve(true);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, 250);
  });
}

function persistEnableFlag(enabled) {
  try {
    if (enabled) localStorage.setItem("webrtc_calls_enabled", "1");
    else localStorage.removeItem("webrtc_calls_enabled");
  } catch {}
}

function clearSavedCredentials() {
  try {
    localStorage.removeItem("webrtc_last_registration");
    localStorage.removeItem("webrtc_calls_enabled");
  } catch {}
  try {
    clearSessionPassword();
  } catch {}
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

async function startDesktopUaAndRegister(SIP, st, ui, { ext, domain, pass, wss }) {
  try {
    console.log(
      `[DESKTOP_REG_DEBUG] startDesktopUaAndRegister entered ext=${String(ext || "")} domain=${String(
        domain || ""
      )} wss=${String(wss || "")}`
    );
  } catch {}
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

  let ua;
  try {
    ua = new SIP.UserAgent(userAgentOptions);
  } catch (err) {
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

export function createDesktopAppState() {
  return {
    ua: null,
    reg: null,
    account: null,
    selectedProfile: null,
    registered: false,
    registering: false,
    session: null,
    incomingInvitation: null,
    _callsEnabled: false,
    _reregTimer: null,
  };
}

export function createDesktopRegistration({ SIP, st, ui, logLine, nowISO }) {
  const { acquireWakeLock, releaseWakeLock } = createWakeLockManager({ st, logLine, nowISO });

  async function startAndRegister() {
    try {
      console.log("[DESKTOP_REG_DEBUG] startAndRegister entered");
    } catch {}
    const passFromDom = (() => {
      try {
        return desktopEl.pass?.value ?? "";
      } catch {
        return "";
      }
    })();

    const rawExt = (() => {
      try {
        return desktopEl.ext?.value?.trim() || "";
      } catch {
        return "";
      }
    })();
    const rawDomain = (() => {
      try {
        return ui.domain?.() || "";
      } catch {
        return "";
      }
    })();
    const fallbackDomain = (() => {
      try {
        return ui.domainFallback?.() || "";
      } catch {
        return "";
      }
    })();

    const parsed = (() => {
      try {
        return parseSipAccount(rawExt, rawDomain, fallbackDomain);
      } catch {
        return { username: rawExt, domain: rawDomain || fallbackDomain };
      }
    })();

    const ext = parsed?.username || "";
    const domain = parsed?.domain || rawDomain || fallbackDomain;
    const pass = passFromDom || ui.pass();
    const wss = normalizeWssServer(ui.wss(), ui.wssFallback());

    try {
      console.log(
        `[DESKTOP_REG_DEBUG] computed ext=${String(ext || "")} domain=${String(domain || "")} wss=${String(
          wss || ""
        )} passLen=${String((pass || "").length)}`
      );
    } catch {}

    if (!ext || !domain || !pass) {
      try {
        console.log("[DESKTOP_REG_DEBUG] early return: missing ext/domain/pass");
      } catch {}
      ui.setStatus("Missing ext/domain/password");
      return null;
    }

    if (st.ua) await stopAndUnregister(true);

    try {
      localStorage.setItem(
        "webrtc_last_registration",
        JSON.stringify({ ext, domain, wss, timestamp: Date.now() })
      );
    } catch {}

    return startDesktopUaAndRegister(SIP, st, ui, { ext, domain, pass, wss });
  }

  async function stopAndUnregister(silent = false) {
    if (!silent) {
      try {
        logLine?.(`[${nowISO?.() || ""}] [boot] stopAndUnregister clicked`);
      } catch {}
    }

    if (st._reregTimer) {
      clearInterval(st._reregTimer);
      st._reregTimer = null;
    }

    if (!silent) clearSavedCredentials();

    try {
      await st.reg?.unregister?.();
    } catch {}

    try {
      await st.ua?.stop?.();
    } catch {}

    st.reg = null;
    st.ua = null;
    st.registered = false;
    st.registering = false;

    try {
      stopLocalAudioStream();
    } catch {}

    ui.setStatus("Idle");
    ui.setTransport("-");
    ui.setButtons();
  }

  async function enableCalls() {
    try {
      st._callsEnabled = true;
      persistEnableFlag(true);
    } catch {}

    await startAndRegister();
    if (!st.registered) {
      const ok = await waitForRegistration(st);
      if (!ok) return;
    }

    acquireWakeLock();
  }

  async function runOneTapEnableFlow() {
    try {
      console.log("[DESKTOP_REG_DEBUG] runOneTapEnableFlow entered");
    } catch {}
    return enableCalls();
  }

  function stop() {
    releaseWakeLock();
    void stopAndUnregister(false);
  }

  return {
    st,
    acquireWakeLock,
    releaseWakeLock,
    runOneTapEnableFlow,
    startAndRegister,
    stopAndUnregister,
    start: runOneTapEnableFlow,
    stop,
  };
}
