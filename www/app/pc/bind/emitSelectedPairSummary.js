import { sendCallMediaEvent } from "../../features/callMediaLog.js";

export async function emitSelectedPairSummary(pc, label, { aor, callId, mode, icePolicy } = {}) {
  try {
    const stats = await pc.getStats();
    let selectedPair = null;

    stats.forEach((r) => {
      if (r.type === "transport" && r.selectedCandidatePairId) selectedPair = stats.get(r.selectedCandidatePairId);
      if (!selectedPair && r.type === "candidate-pair" && r.selected === true) selectedPair = r;
    });

    if (!selectedPair) {
      stats.forEach((r) => {
        if (r.type === "candidate-pair" && r.state === "succeeded" && (r.nominated === true || r.writable === true)) {
          selectedPair = r;
        }
      });
    }

    if (!selectedPair) return;
    const local = selectedPair.localCandidateId ? stats.get(selectedPair.localCandidateId) : null;
    const remote = selectedPair.remoteCandidateId ? stats.get(selectedPair.remoteCandidateId) : null;

    const lp = local ? `${local.candidateType || "?"} ${local.address || local.ip || "?"}:${local.port || "?"}` : "unknown";
    const rp = remote ? `${remote.candidateType || "?"} ${remote.address || remote.ip || "?"}:${remote.port || "?"}` : "unknown";
    const pair = `local=${lp} remote=${rp}`;

    sendCallMediaEvent({
      type: 'selected-pair',
      dir: label,
      aor,
      callId,
      mode,
      icePolicy,
      selectedPair: pair,
      msg: 'Selected ICE candidate pair',
    });
  } catch {
    // no-op: observability only
  }
}
