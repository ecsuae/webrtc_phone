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
import {
  clearAutoProvisionedVisibleCredentials,
  consumePendingDesktopAutoProvisioningLogin,
  consumeDesktopProvisionedSipConfig,
  clearDesktopProvisionedSipConfig,
  getActiveDesktopAutoProvisioningSession,
  logDesktopAutoProvisioningLogout,
  releaseDesktopAutoProvisioningSession,
} from "../features/auto_provisioning/desktopProvisioningSession.js";

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
    try { console.log("[DESKTOP_REG_DEBUG] startAndRegister entered"); } catch {}
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

    let ext = parsed?.username || "";
    let domain = parsed?.domain || rawDomain || fallbackDomain;
    let pass = passFromDom || ui.pass();
    const wss = normalizeWssServer(ui.wss(), ui.wssFallback());

    const autoProvisioningInfo = consumePendingDesktopAutoProvisioningLogin();
    st._autoProvisioningInfo = autoProvisioningInfo;
    st._autoProvisionedLogin = !!autoProvisioningInfo;
    if (!autoProvisioningInfo) persistDesktopLastRegistration({ ext, domain, wss });

    if (autoProvisioningInfo) {
      const provisioned = consumeDesktopProvisionedSipConfig();
      if (!provisioned?.sipUsername || !provisioned?.sipPassword || !provisioned?.sipDomain) {
        ui.setStatus("Provisioning missing SIP credentials");
        return null;
      }
      ext = String(provisioned.sipUsername);
      domain = String(provisioned.sipDomain);
      pass = String(provisioned.sipPassword);
    }

    try {
      const passSet = !!String(pass || "");
      const domainSet = !!String(domain || "");
      const wssSet = !!String(wss || "");
      console.log(
        `[DESKTOP_REG_DEBUG] computed auto_provisioned=${String(!!autoProvisioningInfo)} pass_set=${String(
          passSet
        )} domain_set=${String(domainSet)} wss_set=${String(wssSet)}`
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

    return startDesktopUaAndRegister(SIP, st, ui, { ext, domain, pass, wss });
  }

  async function stopAndUnregister(silent = false) {
    silent = silent === true;
    try { console.log(`[logout-runtime] stopAndUnregister entered silent=${silent}`); } catch {}
    if (!silent) {
      try {
        logLine?.(`[${nowISO?.() || ""}] [boot] stopAndUnregister clicked`);
      } catch {}
    }

    if (st._reregTimer) {
      clearInterval(st._reregTimer);
      st._reregTimer = null;
    }

    const autoProvisionedLogin = st._autoProvisionedLogin === true;
    const autoProvisioningInfo = st._autoProvisioningInfo || getActiveDesktopAutoProvisioningSession();
    if (!silent) {
      logDesktopAutoProvisioningLogout(
        `start provisioning_id_present=${!!autoProvisioningInfo?.provisioningId} device_id_present=${!!autoProvisioningInfo?.deviceId}`
      );
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
    st._autoProvisionedLogin = false;
    st._autoProvisioningInfo = null;

    if (!silent && (autoProvisionedLogin || autoProvisioningInfo)) {
      await releaseDesktopAutoProvisioningSession(autoProvisioningInfo);
      clearAutoProvisionedVisibleCredentials(desktopEl);
      clearDesktopProvisionedSipConfig();
      try { console.log(`[logout-runtime] visible credentials after cleanup ext_empty=${!desktopEl.ext?.value} pass_empty=${!desktopEl.pass?.value} ext_len=${String(desktopEl.ext?.value || "").length} pass_len=${String(desktopEl.pass?.value || "").length}`); } catch {}
    }

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
    try { console.log("[DESKTOP_REG_DEBUG] runOneTapEnableFlow entered"); } catch {}
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
