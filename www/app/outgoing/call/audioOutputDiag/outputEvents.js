import { sendCallMediaEvent } from "../../../features/callMediaLog.js";

export function emitAudioOutputSnapshot({ type, ctx, snap, msg }) {
  try {
    sendCallMediaEvent({
      type,
      ...ctx,
      dir: "outbound",
      desiredMode: snap?.desiredMode,
      routedTo: snap?.routedTo,
      sinkSupported: snap?.sinkSupported,
      sinkId: snap?.sinkId,
      audioOutputs: snap?.outputs,
      enumerateDevicesAvailable: snap?.enumerateDevicesAvailable,
      setSinkIdAvailable: snap?.setSinkIdAvailable,
      routeInfoUnavailable: snap?.routeInfoUnavailable,
      routeInfoSource: snap?.routeInfoSource,
      androidRouteControlAvailable: snap?.androidRouteControlAvailable,
      effectiveOutput: snap?.effectiveOutput,
      routeDecision: snap?.routeDecision,
      routeDecisionReason: snap?.routeDecisionReason,
      appAudioRouteMode: snap?.appRoute?.appAudioRouteMode || "unknown",
      appAudioRouteSource: snap?.appRoute?.appAudioRouteSource || "none",
      appAudioRouteDetail: snap?.appRoute?.appAudioRouteDetail || "none",
      speakerButtonActive: typeof snap?.appRoute?.speakerButtonActive === "boolean" ? snap.appRoute.speakerButtonActive : false,
      earpieceButtonActive: typeof snap?.appRoute?.earpieceButtonActive === "boolean" ? snap.appRoute.earpieceButtonActive : false,
      audioRouteStateAvailable: typeof snap?.appRoute?.audioRouteStateAvailable === "boolean" ? snap.appRoute.audioRouteStateAvailable : false,
      audioRouteSnapshotTs: snap?.appRoute?.audioRouteSnapshotTs || undefined,
      audioRouteMismatch: typeof snap?.audioRouteMismatch === "boolean" ? snap.audioRouteMismatch : false,
      msg,
    });
  } catch {}
}
