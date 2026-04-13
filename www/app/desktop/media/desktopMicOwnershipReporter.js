import { sendCallMediaEvent } from "../../features/callMediaLog.js";

export function reportDesktopMicOwnershipSnapshotToCallLog(snap, ctx = {}) {
  try {
    if (!snap) return;
    sendCallMediaEvent({
      type: "desktop-mic-ownership-snapshot",
      corrId: snap.corrId,
      callId: snap.callId,
      dir: ctx?.dir || "outbound",
      checkpoint: snap.checkpoint,
      reason: snap.reason,
      activeCount: snap.ownerCount,
      msg: ctx?.msg || `desktop-mic-ownership-snapshot ownerCount=${snap.ownerCount} liveOwnerCount=${snap.liveOwnerCount}`,
    });
  } catch {}
}
