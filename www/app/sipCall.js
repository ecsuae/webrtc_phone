// www/app/sipCall.js
import { nowISO } from "./config.js";
import { formatSipResponse, logLine } from "./log.js";
import { g711OnlyModifier } from "./sdp.js";
import { bindPeerConnection } from "./pcDebug.js";
import { ensureMicAccess, getLocalStream, stopLocalAudioStream } from "./media.js";

/**
 * Attach remote audio for one-way-audio fixes:
 * - listen for ontrack on the peer connection
 * - attach received stream to <audio id="remoteAudio">
 * - call play() to avoid autoplay issues
 */
function attachRemoteAudio(session, ui) {
  try {
    const audioEl = ui?.remoteAudio?.();
    const pc = session?.sessionDescriptionHandler?.peerConnection;
    if (!audioEl || !pc) return;

    // Ensure we don't attach multiple times
    pc.ontrack = (ev) => {
      const [stream] = ev.streams || [];
      if (stream) {
        logLine(`[${nowISO()}] [media] remote track received: ${ev.track.kind}`);
        audioEl.srcObject = stream;

        // Some browsers need explicit play()
        const p = audioEl.play?.();
        if (p && typeof p.catch === "function") {
          p.catch((e) => logLine(`[${nowISO()}] [media] audio play blocked`, e?.message || e));
        }
      } else {
        logLine(`[${nowISO()}] [media] ontrack fired but no stream`);
      }
    };
  } catch (e) {
    logLine(`[${nowISO()}] [media] attachRemoteAudio error`, e?.message || e);
  }
}

export async function startCall(SIP, st, ui) {
  const target = ui.dial();
  if (!st.registered || !st.ua) return ui.setStatus("Not registered");
  if (!target) return ui.setStatus("Missing destination");
  if (st.session) return ui.setStatus("Call already active");

  const micOk = await ensureMicAccess(ui.setStatus);
  if (!micOk) return;

  const domain = ui.domain();
  const targetUri = SIP.UserAgent.makeURI(`sip:${target}@${domain}`);
  if (!targetUri) {
    stopLocalAudioStream(); // release mic if we fail early
    return ui.setStatus("Invalid destination");
  }

  logLine(`[${nowISO()}] [call] dialing ${targetUri.toString()}`);

  const inviter = new SIP.Inviter(st.ua, targetUri, {
    sessionDescriptionHandlerModifiers: [g711OnlyModifier],
    sessionDescriptionHandlerOptions: {
      constraints: { audio: true, video: false },
      localMediaStream: getLocalStream() || undefined,
    },
  });

  inviter.delegate = {
    onProgress: (resp) => {
      const info = formatSipResponse(resp);
      if (info) logLine(`[${nowISO()}] [call] progress ${info}`);
    },
    onAccept: (resp) => {
      const info = formatSipResponse(resp);
      if (info) logLine(`[${nowISO()}] [call] accepted ${info}`);
      ui.setStatus("Call established");
    },
    onReject: (resp) => {
      const info = formatSipResponse(resp);
      logLine(`[${nowISO()}] [call] INVITE rejected ${info}`.trim());
      ui.setStatus(info ? `Call failed (${info})` : "Call failed");
      stopLocalAudioStream(); // release mic on reject
      st.session = null;
      ui.setButtons();
    },
  };

  st.session = inviter;

  // Keep your existing debugging behavior
  bindPeerConnection(inviter, "outbound");

  inviter.stateChange.addListener((s) => {
    logLine(`[${nowISO()}] [session:outbound] ${s}`);

    // Try to bind again once SDH exists
    bindPeerConnection(inviter, "outbound");

    // Attach remote audio once peer connection exists
    attachRemoteAudio(inviter, ui);

    if (s === SIP.SessionState.Terminated) {
      st.session = null;
      stopLocalAudioStream(); // release mic on termination ALWAYS
      ui.setButtons();
      ui.setStatus("Idle");
    }
  });

  ui.setButtons();

  try {
    // DO NOT pre-touch sessionDescriptionHandler here.
    // This keeps behavior close to your previously working outbound call.
    await inviter.invite();
    logLine(`[${nowISO()}] [call] invite sent`);
    ui.setStatus("Calling...");
  } catch (e) {
    logLine(`[${nowISO()}] [error] invite failed`, e?.message || e);
    ui.setStatus("Call failed (invite error)");
    stopLocalAudioStream(); // release mic on error
    st.session = null;
    ui.setButtons();
  }
}

export async function hangupCall(st, ui, silent = false) {
  if (!st.session) return;
  const s = st.session;
  if (!silent) logLine(`[${nowISO()}] [call] hangup`);

  try {
    if (s.state === SIP.SessionState.Established) await s.bye();
    else await s.cancel();
  } catch {}

  stopLocalAudioStream(); // release mic even if SIP cancel fails
  st.session = null;
  ui.setButtons();
  ui.setStatus("Idle");
}