import { nowISO, logLine } from "../desktopLogging.js";
import { isMobileCompatModeEnabled } from "../../features/mobileNetworkMode.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";

import { g711OnlyModifier } from "../../sdp.js";
import { getLocalStream } from "../../media.js";

export function configureDesktopRemoteAudio(ui) {
  const audioEl = ui?.remoteAudio?.();
  if (!audioEl) return;
  audioEl.autoplay = true;
  audioEl.playsInline = true;
  audioEl.muted = false;
  audioEl.volume = 0.7;

  try {
    if (audioEl.__callMediaPlayObserved) return;
    audioEl.__callMediaPlayObserved = true;

    const emitAudioState = (type, msg) => {
      const ctx = audioEl.__callMediaDiagContext || {};
      sendCallMediaEvent({
        type,
        ...ctx,
        dir: "outbound",
        audioElMuted: typeof audioEl.muted === "boolean" ? audioEl.muted : undefined,
        audioElVolume: typeof audioEl.volume === "number" ? audioEl.volume : undefined,
        audioElReadyState: typeof audioEl.readyState === "number" ? audioEl.readyState : undefined,
        audioElPaused: typeof audioEl.paused === "boolean" ? audioEl.paused : undefined,
        audioElCurrentTime: typeof audioEl.currentTime === "number" ? audioEl.currentTime : undefined,
        msg,
      });
    };

    emitAudioState("remote-audio-ready-state", "remoteAudio initial state");
    emitAudioState("remote-audio-muted-state", "remoteAudio muted state");
    emitAudioState("remote-audio-volume-state", "remoteAudio volume state");

    audioEl.addEventListener("volumechange", () => {
      emitAudioState("remote-audio-volume-state", "remoteAudio volumechange");
      emitAudioState("remote-audio-muted-state", "remoteAudio muted state change");
    });
    audioEl.addEventListener("loadedmetadata", () => emitAudioState("remote-audio-ready-state", "remoteAudio loadedmetadata"));
    audioEl.addEventListener("canplay", () => emitAudioState("remote-audio-ready-state", "remoteAudio canplay"));
    audioEl.addEventListener("waiting", () => emitAudioState("remote-audio-ready-state", "remoteAudio waiting"));

    audioEl.addEventListener(
      "playing",
      () => {
        try {
          audioEl.__callMediaPlayed = true;
          if (audioEl.__callMediaNoPlayTimer) {
            clearTimeout(audioEl.__callMediaNoPlayTimer);
            audioEl.__callMediaNoPlayTimer = null;
          }
        } catch {}

        try {
          window.__callMediaRemoteAudioEl = audioEl;
        } catch {}

        const ctx = audioEl.__callMediaDiagContext || {};
        sendCallMediaEvent({
          type: "outbound-remote-audio-play-ok",
          ...ctx,
          dir: "outbound",
          audioPlayOk: true,
          msg: "remoteAudio is playing",
        });

        sendCallMediaEvent({
          type: "remote-audio-play-ok",
          ...ctx,
          dir: "outbound",
          audioPlayOk: true,
          msg: "remoteAudio is playing",
        });
      },
      { once: true }
    );

    audioEl.addEventListener(
      "error",
      () => {
        const ctx = audioEl.__callMediaDiagContext || {};
        sendCallMediaEvent({
          type: "outbound-remote-audio-play-failed",
          ...ctx,
          dir: "outbound",
          audioPlayOk: false,
          audioPlayError: "audio-element-error",
          msg: "remoteAudio element error",
        });

        sendCallMediaEvent({
          type: "remote-audio-play-failed",
          ...ctx,
          dir: "outbound",
          audioPlayOk: false,
          audioPlayError: "audio-element-error",
          msg: "remoteAudio element error",
        });
      },
      { once: true }
    );
  } catch {}
}

export function getDesktopOutboundDiagContext(st, target, inviter) {
  const username = st.account?.rawUsername || st.account?.username || undefined;
  const domain = st.account?.domain || undefined;
  const aor = username && domain ? `${username}@${domain}` : undefined;
  const callId = inviter?.outgoingRequestMessage?.callId || undefined;
  const sessionId = inviter?.id || inviter?._id || undefined;
  const corrId = inviter?.__webrtcCorrId || inviter?.__callMediaDiag?.corrId || st?.__webrtcCorrId || undefined;
  const selectedProfile = st.selectedProfile || (isMobileCompatModeEnabled() ? "lte" : "wifi");
  const lteMode = selectedProfile === "lte";
  const mode = lteMode ? "lte" : "wifi";
  const icePolicy = lteMode ? "relay" : "all";
  const localMicTrackId = inviter?.__desktopMicTrackId || st?.__desktopMicTrackId || undefined;
  const localMicStreamId = (() => {
    try {
      return getLocalStream()?.id || undefined;
    } catch {
      return undefined;
    }
  })();
  return {
    username,
    domain,
    aor,
    dir: "outbound",
    peer: target || undefined,
    callId,
    corrId,
    sessionId,
    lteMode,
    mode,
    selectedProfile,
    icePolicy,
    localMicTrackId,
    localMicStreamId,
    probeBuildId: (() => {
      try {
        return window?.OUTBOUND_CALLER_PROBE_BUILD_ID || localStorage.getItem("OUTBOUND_CALLER_PROBE_BUILD_ID") || undefined;
      } catch {
        return undefined;
      }
    })(),
  };
}

export function createDesktopInviter({ SIP, st, targetUri, corrId, selectedProfile, peer }) {
  try {
    const stream = getLocalStream() || null;
    const tracks = (() => {
      try {
        return (stream && typeof stream.getTracks === "function") ? (stream.getTracks() || []) : [];
      } catch {
        return [];
      }
    })();
    const audioTrack = (() => {
      try {
        return stream?.getAudioTracks?.()?.[0] || null;
      } catch {
        return null;
      }
    })();
    const trackIds = tracks.map((t) => {
      try {
        return t?.id || null;
      } catch {
        return null;
      }
    }).filter(Boolean);
    const trackKinds = tracks.map((t) => {
      try {
        return t?.kind || null;
      } catch {
        return null;
      }
    }).filter(Boolean);
    const trackLabels = tracks.map((t) => {
      try {
        return t?.label || null;
      } catch {
        return null;
      }
    }).filter(Boolean);
    const localMicTrackId = st?.__desktopMicTrackId || (() => {
      try {
        return stream?.getAudioTracks?.()?.[0]?.id || null;
      } catch {
        return null;
      }
    })();

    sendCallMediaEvent({
      type: "desktop-local-stream-passed-to-sip",
      username: st.account?.rawUsername || st.account?.username || undefined,
      domain: st.account?.domain || undefined,
      aor: (() => {
        try {
          const u = st.account?.rawUsername || st.account?.username || undefined;
          const d = st.account?.domain || undefined;
          return (u && d) ? `${u}@${d}` : undefined;
        } catch {
          return undefined;
        }
      })(),
      dir: "outbound",
      peer: peer || undefined,
      corrId,
      selectedProfile,
      mode: selectedProfile === "lte" ? "lte" : "wifi",
      lteMode: selectedProfile === "lte",
      icePolicy: selectedProfile === "lte" ? "relay" : "all",
      reason: "before-invite",
      localMicTrackId: localMicTrackId || undefined,
      localMicStreamId: stream?.id || null,
      localStreamTrackIds: trackIds,
      localStreamTrackCount: trackIds.length,
      localStreamTrackKinds: trackKinds,
      localStreamTrackLabels: trackLabels,
      localStreamAudioTrackId: audioTrack?.id || null,
      localStreamAudioTrackLabel: audioTrack?.label || null,
      localStreamAudioTrackEnabled: (typeof audioTrack?.enabled === "boolean") ? audioTrack.enabled : null,
      localStreamAudioTrackMuted: (typeof audioTrack?.muted === "boolean") ? audioTrack.muted : null,
      localStreamAudioTrackReadyState: audioTrack?.readyState || null,
      msg: "Local media stream passed to SIP.js (Inviter localMediaStream)",
    });
  } catch {}

  const inviter = new SIP.Inviter(st.ua, targetUri, {
    earlyMedia: true,
    extraHeaders: ["P-Early-Media: supported", `X-WebRTC-CorrId: ${corrId}`, `X-WebRTC-Profile: ${selectedProfile}`],
    sessionDescriptionHandlerModifiers: [g711OnlyModifier],
    sessionDescriptionHandlerOptions: {
      constraints: { audio: true, video: false },
      localMediaStream: getLocalStream() || undefined,
    },
  });

  try {
    inviter.__webrtcCorrId = corrId;
  } catch {}

  return inviter;
}
