import { nowISO, logLine } from "../desktopLogging.js";
import { getLocalStream } from "../../media.js";
import { guardDesktopLteRelayReadiness } from "../desktopLteCallGuard.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";
import { isMobileCompatModeEnabled } from "../../features/mobileNetworkMode.js";

import {
  acquireDesktopCallAudio,
  bindDesktopCallAudioReleaseOnTerminate,
  releaseDesktopCallAudio,
} from "../media/desktopCallAudioRuntime.js";

import { stopIncomingAlert } from "./desktopIncomingAlert.js";
import { cleanupDesktopIncomingState } from "./desktopIncomingState.js";
import { getHeaderValue, getInboundDiagContext } from "../../incoming/handlers/diag.js";
import { observeRemoteAudioPlay } from "../../incoming/handlers/observeRemoteAudioPlay.js";
import { runLteAnswerPreflight } from "../../incoming/handlers/answer/preflight.js";
import { acceptIncomingInvitation } from "../../incoming/handlers/answer/accept.js";

import { startDesktopIncomingEarlyMediaLoop } from "./desktopIncomingRemoteAudio.js";

export async function answerIncomingCallDesktop(SIP, st, ui) {
  const invitation = st.incomingInvitation;
  if (!invitation) return;

  const corrId = (() => {
    try {
      return `c-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
    } catch {
      return `c-${Date.now()}`;
    }
  })();

  try {
    invitation.__webrtcCorrId = corrId;
  } catch {}

  const caller = invitation.remoteIdentity?.uri?.user || "Unknown";
  const callerDisplay = invitation.remoteIdentity?.displayName || caller;

  stopIncomingAlert();
  const t_answerClicked = new Date().toISOString();
  const mic = await acquireDesktopCallAudio(ui, "inbound-answer");
  if (!mic.ok) {
    try {
      invitation.reject({ statusCode: 480 });
    } catch {}
    cleanupDesktopIncomingState(st, ui);
    ui.setStatus("Microphone access denied");
    return;
  }

  const micId = mic?.micId || "?";

  try {
    const track = mic?.track || null;
    const snap = mic?.trackSnapshot || null;
    const s = (() => {
      try {
        return (track && typeof track.getSettings === "function") ? (track.getSettings() || {}) : {};
      } catch {
        return {};
      }
    })();
    sendCallMediaEvent({
      type: "desktop-mic-acquired",
      ...getInboundDiagContext(st, invitation),
      reason: "inbound-answer",
      localMicTrackId: (snap?.id || track?.id) || undefined,
      localMicStreamId: mic?.stream?.id || null,
      localMicTrackReadyState: track?.readyState || snap?.readyState || null,
      localMicTrackEnabled: (typeof track?.enabled === "boolean") ? track.enabled : (snap?.enabled ?? null),
      localMicTrackMuted: (typeof track?.muted === "boolean") ? track.muted : (snap?.muted ?? null),
      localMicDeviceId: (typeof s.deviceId === "string" && s.deviceId) ? s.deviceId : null,
      localMicLabel: track?.label || snap?.label || null,
      micId,
      t_answerClicked,
      msg: "Desktop mic acquired",
    });
  } catch {}

  try {
    invitation.__desktopMicId = micId;
  } catch {}

  st.incomingInvitation = null;
  ui.setStatus(`Answering ${callerDisplay}...`);

  const aor = invitation.localIdentity?.uri
    ? `${invitation.localIdentity.uri.user}@${invitation.localIdentity.uri.host}`
    : null;
  const callId = invitation.request?.callId || null;

  sendCallMediaEvent({
    type: "answer-clicked",
    ...getInboundDiagContext(st, invitation),
    t_answerClicked,
    hasLocalStream: Boolean(getLocalStream()),
    msg: "User clicked answer (desktop)",
  });

  observeRemoteAudioPlay(ui, getInboundDiagContext(st, invitation), { t_answerClicked });

  if (isMobileCompatModeEnabled()) {
    const pre = await runLteAnswerPreflight({
      st,
      invitation,
      ui,
      aor,
      callId,
      caller,
      t_answerClicked,
      getInboundDiagContext,
    });
    if (!pre?.ok) {
      try {
        invitation.reject(pre?.reject || { statusCode: 488 });
      } catch {}
      cleanupDesktopIncomingState(st, ui);
      return;
    }
  }

  try {
    await acceptIncomingInvitation({
      st,
      invitation,
      aor,
      callId,
      t_answerClicked,
      getInboundDiagContext,
      getHeaderValue,
    });

    bindDesktopCallAudioReleaseOnTerminate(SIP, invitation, "inbound-terminated");

    startDesktopIncomingEarlyMediaLoop(invitation, ui);

    sendCallMediaEvent({
      type: "media-answer-incoming",
      ...getInboundDiagContext(st, invitation),
      t_answerClicked,
      msg: "Sent 200 OK (answer) (desktop)",
    });

    guardDesktopLteRelayReadiness(invitation, {
      aor,
      callId,
      dir: "inbound",
      onFail: (code, userMessage) => {
        logLine(`[${nowISO()}] [desktop:incoming:answer] ${code} — aborting call: ${userMessage}`);
        ui.setStatus(userMessage);
        try {
          invitation.bye();
        } catch {}
        cleanupDesktopIncomingState(st, ui);
      },
    });

    sendCallMediaEvent({
      type: "call-answer",
      ...getInboundDiagContext(st, invitation),
      t_answerClicked,
      msg: "Incoming call answered (desktop)",
    });
  } catch (err) {
    logLine(`[${nowISO()}] [desktop:incoming:answer] ERROR accepting call: ${err?.message || err}`);

    sendCallMediaEvent({
      type: "answer-accept-failed",
      ...getInboundDiagContext(st, invitation),
      aor,
      callId,
      t_answerClicked,
      msg: `invitation.accept() failed (desktop): ${err?.message || err}`,
    });

    try {
      releaseDesktopCallAudio("inbound-accept-failed", {
        session: invitation,
        corrId,
        callId,
        micId: invitation?.__desktopMicId || null,
      });
    } catch {}
    st.session = null;
    ui.setButtons();
    ui.setStatus("Failed to answer call");
  }
}
