import { sendCallMediaEvent } from "../../../features/callMediaLog.js";
import { requirePlatformAdapter } from "../../../runtime/shared/platformAdapter.js";

export function bindOutboundReceiveLegObservers(pc, base) {
  try {
    if (!pc || pc.__outboundReceiveLegObserversBound) return;
    if ((base?.dir || "") !== "outbound") return;
    pc.__outboundReceiveLegObserversBound = true;

    const emitConn = () => {
      try {
        sendCallMediaEvent({
          type: "outbound-connection-state",
          ...base,
          connectionState: pc.connectionState,
          msg: `pc.connectionState=${pc.connectionState || ""}`,
        });
      } catch {}
    };
    const emitIceConn = () => {
      try {
        sendCallMediaEvent({
          type: "outbound-ice-connection-state",
          ...base,
          iceConnectionState: pc.iceConnectionState,
          msg: `pc.iceConnectionState=${pc.iceConnectionState || ""}`,
        });
      } catch {}
    };

    try {
      pc.addEventListener("connectionstatechange", emitConn);
    } catch {}
    try {
      pc.addEventListener("iceconnectionstatechange", emitIceConn);
    } catch {}

    emitConn();
    emitIceConn();
  } catch {}
}

export function tryGetRemoteAudioTrackCount(pc) {
  try {
    const receivers = typeof pc.getReceivers === "function" ? pc.getReceivers() : [];
    const tracks = (receivers || []).map((r) => r && r.track).filter((t) => t && t.kind === "audio");
    return tracks.length;
  } catch {
    return undefined;
  }
}

export function emitAnomaliesFromSnapshot(snapshot, base) {
  if (!snapshot) return;
  const { inPackets, outPackets, dtlsState, localCandidateType } = snapshot;

  if (typeof outPackets === "number" && outPackets > 0 && typeof inPackets === "number" && inPackets === 0) {
    sendCallMediaEvent({ type: "no-inbound-rtp", ...base, msg: "Outbound RTP present but inbound RTP is zero" });
    sendCallMediaEvent({ type: "one-way-audio-suspected", ...base, msg: "One-way audio suspected: sent RTP > 0, received RTP = 0" });
  }
  if (typeof inPackets === "number" && inPackets > 0 && typeof outPackets === "number" && outPackets === 0) {
    sendCallMediaEvent({ type: "no-outbound-rtp", ...base, msg: "Inbound RTP present but outbound RTP is zero" });
    sendCallMediaEvent({ type: "one-way-audio-suspected", ...base, msg: "One-way audio suspected: received RTP > 0, sent RTP = 0" });
  }
  if (dtlsState === "connected" && inPackets === 0 && outPackets === 0) {
    sendCallMediaEvent({ type: "dtls-connected-but-no-rtp", ...base, msg: "DTLS connected but no RTP packets seen yet" });
  }

  if (base?.icePolicy === "relay") {
    if (localCandidateType && localCandidateType !== "relay") {
      sendCallMediaEvent({
        type: "selected-pair-relay-mismatch",
        ...base,
        msg: `ICE policy relay but selected local candidate type is ${localCandidateType || "?"}`,
      });
    }
  }
}

export function enableReceiveRenderProofFollowup(base) {
  try {
    const a = requirePlatformAdapter();
    return !!a?.mediaDiag?.enableRenderDiag && base?.dir === "outbound";
  } catch {
    return false;
  }
}
