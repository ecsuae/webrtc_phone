import { normalizeWssServer, parseSipAccount } from "./ext/desktopRegistrationInputUtils.js";
import { createWakeLockManager } from "../../runtime/wakeLockManager.js";
import { stopLocalAudioStream } from "../../media.js";
import { desktopEl } from "../ui/desktopDomRefs.js";
import { startDesktopUaAndRegister } from "./ext/desktopRegistrationUa.js";
import {
  clearDesktopSavedCredentials,
  persistDesktopCallsEnabledFlag,
  persistDesktopLastRegistration,
} from "./ext/desktopRegistrationStorage.js";
import { waitForDesktopRegistration } from "./ext/desktopRegistrationWait.js";



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

    persistDesktopLastRegistration({ ext, domain, wss });

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

    if (!silent) clearDesktopSavedCredentials();

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
      persistDesktopCallsEnabledFlag(true);
    } catch {}

    await startAndRegister();
    if (!st.registered) {
      const ok = await waitForDesktopRegistration(st);
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
