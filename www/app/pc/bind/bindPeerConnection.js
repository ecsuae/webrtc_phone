import { nowISO } from "../../config.js";
import { logLine } from "../../log.js";
import { candType, short } from "../utils.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";
import { isMobileCompatModeEnabled } from "../../features/mobileNetworkMode.js";
import { countCandidatesFromSdp } from "../../features/lteCallGuard.js";
import { emitSelectedPairSummary } from "./emitSelectedPairSummary.js";
import { logSelectedPair, startRtpStats, stopRtpStats, scheduleMediaStatsSnapshots } from "./statsLoader.js";
import { bindTrackEvents } from "./track.js";
import { bindIceEvents } from "./ice.js";
import { bindStateEvents } from "./state.js";

function buildDiagFromSession(session, { aor } = {}) {
  const _lteMode = isMobileCompatModeEnabled();
  const _mode = _lteMode ? 'lte' : 'wifi';
  const _icePolicy = _lteMode ? 'relay' : 'all';
  const _selectedProfile = _mode;

  const d = session?.__callMediaDiag || null;
  if (!d || typeof d !== 'object') {
    return {
      lteMode: _lteMode,
      mode: _mode,
      icePolicy: _icePolicy,
      selectedProfile: _selectedProfile,
      aor,
    };
  }

  return {
    username: typeof d.username === 'string' ? d.username : undefined,
    domain: typeof d.domain === 'string' ? d.domain : undefined,
    aor: typeof d.aor === 'string' ? d.aor : aor,
    corrId: typeof d.corrId === 'string' ? d.corrId : undefined,
    sessionId: typeof d.sessionId === 'string' ? d.sessionId : undefined,
    peer: typeof d.peer === 'string' ? d.peer : undefined,
    peerDomain: typeof d.peerDomain === 'string' ? d.peerDomain : undefined,
    peerAor: typeof d.peerAor === 'string' ? d.peerAor : undefined,
    lteMode: _lteMode,
    mode: typeof d.mode === 'string' ? d.mode : _mode,
    selectedProfile: typeof d.selectedProfile === 'string' ? d.selectedProfile : _selectedProfile,
    icePolicy: typeof d.icePolicy === 'string' ? d.icePolicy : _icePolicy,
  };
}

function maybeEmitIceCompleteFromSdp(pc, label, dir, diag, { aor, callId, counts } = {}) {
  if (pc.iceGatheringState !== 'complete') return;

  const sdpCounts = countCandidatesFromSdp(pc.localDescription?.sdp);
  Object.assign(counts, sdpCounts);

  logLine(`[${nowISO()}] [pc:${label}] ICE already complete (from SDP) — host=${counts.host} srflx=${counts.srflx} relay=${counts.relay} total=${sdpCounts.total}`);
  if (counts.total === 0) {
    logLine(`[${nowISO()}] [pc:${label}] WARNING: zero candidates in local SDP — browser sent discard address (0.0.0.0:9)`);
  }

  sendCallMediaEvent({
    type: 'ice-complete',
    dir,
    aor: diag.aor || aor,
    callId,
    corrId: diag.corrId,
    username: diag.username,
    domain: diag.domain,
    peer: diag.peer,
    peerDomain: diag.peerDomain,
    peerAor: diag.peerAor,
    lteMode: diag.lteMode,
    mode: diag.mode,
    selectedProfile: diag.selectedProfile,
    icePolicy: diag.icePolicy,
    relay: counts.relay,
    host: counts.host,
    srflx: counts.srflx,
    total: sdpCounts.total,
    msg: 'from-sdp (late-bind)',
  });

  try {
    if (label === 'inbound' && pc && !pc.__callMediaInboundStatsStarted) {
      pc.__callMediaInboundStatsStarted = true;
      scheduleMediaStatsSnapshots(pc, label, {
        aor: diag.aor || aor,
        callId,
        corrId: diag.corrId,
        sessionId: diag.sessionId,
        username: diag.username,
        domain: diag.domain,
        peer: diag.peer,
        peerDomain: diag.peerDomain,
        peerAor: diag.peerAor,
        lteMode: diag.lteMode,
        mode: diag.mode,
        selectedProfile: diag.selectedProfile,
        icePolicy: diag.icePolicy,
      });
    }
  } catch {}
}

export function bindPeerConnection(session, label, { aor, callId } = {}) {
  const pc = session?.sessionDescriptionHandler?.peerConnection;
  if (!pc || pc.__bound) return;
  pc.__bound = true;

  const dir = (label === 'inbound' || label === 'outbound') ? label : label;
  const diag = buildDiagFromSession(session, { aor });
  const counts = { host: 0, srflx: 0, relay: 0, prflx: 0 };

  maybeEmitIceCompleteFromSdp(pc, label, dir, diag, { aor, callId, counts });
  bindTrackEvents(pc, label, dir, diag, { aor, callId });
  bindIceEvents(pc, label, dir, diag, counts, { aor, callId });
  bindStateEvents(pc, label, dir, diag, counts, { aor, callId });
}
