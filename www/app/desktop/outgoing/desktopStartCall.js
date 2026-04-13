import { nowISO, logLine } from "../desktopLogging.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";
import { isMobileCompatModeEnabled } from "../../features/mobileNetworkMode.js";

import {
  acquireDesktopCallAudio,
  releaseDesktopCallAudio,
} from "../media/desktopCallAudioRuntime.js";

import {
  configureDesktopRemoteAudio,
  getDesktopOutboundDiagContext,
} from "./desktopStartCallSupport.js";
import { runDesktopLtePreflightOrThrow } from "./desktopStartCallPreflight.js";

import { desktopEl } from "../ui/desktopDomRefs.js";

import {
  primeOutboundRingbackContext,
  stopRingbackTone,
} from "./desktopRingbackDelegate.js";
import { runDesktopExtInviteFlow } from "./ext/desktopExtInviteFlow.js";
import { runDesktopExtPostInviteFlow } from "./ext/desktopExtPostInviteFlow.js";

export async function startCall(SIP, st, ui) {
  const target = (() => {
    try {
      const v = desktopEl?.dial?.value;
      if (typeof v === "string") return v.trim();
    } catch {}
    try {
      const v = ui?.dial?.();
      if (typeof v === "string") return v.trim();
    } catch {}
    return "";
  })();
  if (!st.registered || !st.ua) return ui.setStatus("Not registered");
  if (!target) return ui.setStatus("Missing destination");
  if (st.session) return ui.setStatus("Call already active");

  const t_callStart = new Date().toISOString();
  const corrId = (() => {
    try {
      return `c-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
    } catch {
      return `c-${Date.now()}`;
    }
  })();

  try {
    st.__webrtcCorrId = corrId;
  } catch {}

  primeOutboundRingbackContext();

  const mic = await acquireDesktopCallAudio(ui, "outbound-start");
  if (!mic.ok) return;

  const micId = mic?.micId || "?";
  const micTrackId = mic?.trackSnapshot?.id || mic?.track?.id || null;

  try {
    const s = (() => {
      try {
        return (mic?.track && typeof mic.track.getSettings === "function") ? (mic.track.getSettings() || {}) : {};
      } catch {
        return {};
      }
    })();
    sendCallMediaEvent({
      type: "desktop-mic-acquired",
      ...getDesktopOutboundDiagContext(st, target, { __webrtcCorrId: corrId }),
      reason: "outbound-start",
      localMicTrackId: micTrackId || undefined,
      localMicStreamId: mic?.stream?.id || null,
      localMicTrackKind: mic?.track?.kind || mic?.trackSnapshot?.kind || null,
      localMicTrackReadyState: mic?.track?.readyState || mic?.trackSnapshot?.readyState || null,
      localMicTrackEnabled: (typeof mic?.track?.enabled === "boolean") ? mic.track.enabled : (mic?.trackSnapshot?.enabled ?? null),
      localMicTrackMuted: (typeof mic?.track?.muted === "boolean") ? mic.track.muted : (mic?.trackSnapshot?.muted ?? null),
      localMicDeviceId: (typeof s.deviceId === "string" && s.deviceId) ? s.deviceId : null,
      localMicLabel: mic?.track?.label || mic?.trackSnapshot?.label || null,
      micId,
      msg: "Desktop mic acquired",
    });
  } catch {}

  try {
    st.__desktopMicTrackId = micTrackId;
  } catch {}
  try {
    st.__desktopMicStreamId = mic?.stream?.id || null;
  } catch {}

  const resolvedAccount = ui.account ? ui.account() : null;
  const domain = st.account?.domain || resolvedAccount?.domain || ui.domain() || ui.domainFallback?.();
  if (!domain) {
    releaseDesktopCallAudio("outbound-missing-domain", { corrId, micId });
    return ui.setStatus("Missing domain");
  }

  const encodedTarget = encodeURIComponent(target);
  const targetUri = SIP.UserAgent.makeURI(`sip:${encodedTarget}@${domain}`);
  if (!targetUri) {
    releaseDesktopCallAudio("outbound-invalid-destination", { corrId, micId });
    return ui.setStatus("Invalid destination");
  }

  logLine(`[${nowISO()}] [call] dialing ${target} (encoded: ${encodedTarget})`);

  sendCallMediaEvent({
    type: "outbound-call-start",
    ...getDesktopOutboundDiagContext(st, target, { __webrtcCorrId: corrId }),
    t_callStart,
    msg: "Outbound call start (guaranteed chain)",
  });

  try {
    const ctx = getDesktopOutboundDiagContext(st, target, null);
    if (String(ctx.username || "") === "900900" && ctx.lteMode === true) {
      sendCallMediaEvent({
        type: "lte-caller-probe-callstart",
        ...ctx,
        sourceBuildId: (() => {
          try {
            return window.CALL_MEDIA_SOURCE_BUILD_ID;
          } catch {
            return undefined;
          }
        })(),
        t_callStart,
        msg: "LTE caller probe on outbound call start",
      });
    }
  } catch {}

  sendCallMediaEvent({
    type: "outbound-invite-start",
    ...getDesktopOutboundDiagContext(st, target, { __webrtcCorrId: corrId }),
    t_callStart,
    msg: "Outbound call start (before INVITE)",
  });

  if (isMobileCompatModeEnabled()) {
    try {
      await runDesktopLtePreflightOrThrow({
        st,
        ui,
        target,
        corrId,
        t_callStart,
        diagContext: getDesktopOutboundDiagContext(st, target, null),
      });
    } catch {
      releaseDesktopCallAudio("outbound-preflight-failed", { corrId, micId });
      st.session = null;
      ui.setButtons();
      return;
    }
  }

  configureDesktopRemoteAudio(ui);

  const selectedProfile = st.selectedProfile || (isMobileCompatModeEnabled() ? "lte" : "wifi");

  const aor = st.account ? `${st.account.rawUsername}@${st.account.domain}` : null;

  try {
    const out = await runDesktopExtInviteFlow(SIP, st, ui, {
      target,
      targetUri,
      corrId,
      t_callStart,
      selectedProfile,
      micId,
      micTrackId,
      mic,
    });
    const inviter = out?.inviter;

    runDesktopExtPostInviteFlow(SIP, st, ui, inviter, {
      target,
      corrId,
      t_callStart,
      aor,
      micId,
    });
  } catch (e) {
    stopRingbackTone();
    logLine(`[${nowISO()}] [error] invite failed`, e?.message || e);
    ui.setStatus("Call failed (invite error)");
    releaseDesktopCallAudio("outbound-invite-failed", { session: st?.session || null, corrId, micId });
    st.session = null;
    ui.setButtons();
  }
}
