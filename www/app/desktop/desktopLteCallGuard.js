import { nowISO, logLine } from "./desktopLogging.js";
import { isMobileCompatModeEnabled } from "../features/mobileNetworkMode.js";
import { sendCallMediaEvent } from "../features/callMediaLog.js";

export const DESKTOP_MEDIA_ERRORS = {
  "MEDIA-E001": {
    code: "MEDIA-E001",
    userMessage:
      "Could not reach the media relay (TURN) server on this network. Try Wi-Fi, or disable LTE/5G Mode if already on Wi-Fi.",
    longDescription:
      "ICE gathering completed in relay-only mode with zero relay candidates. TURN server unreachable on the current network.",
  },
  "MEDIA-E002": {
    code: "MEDIA-E002",
    userMessage: "Media path setup timed out. This can happen on very restricted networks.",
    longDescription: "ICE gathering timed out before any usable candidate pair was established.",
  },
};

function countCandidatesFromSdp(sdp) {
  const counts = { host: 0, srflx: 0, relay: 0, prflx: 0 };
  if (!sdp) return { ...counts, total: 0 };
  const lines = sdp.match(/a=candidate:[^\r\n]+/g) || [];
  for (const line of lines) {
    const m = line.match(/\btyp (\w+)\b/);
    const typ = m?.[1];
    if (typ && Object.prototype.hasOwnProperty.call(counts, typ)) counts[typ]++;
  }
  const total = counts.host + counts.srflx + counts.relay + counts.prflx;
  return { ...counts, total };
}

function waitForIceGatheringComplete(session, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const counts = { host: 0, srflx: 0, relay: 0, prflx: 0 };
    let settled = false;

    function settle(extra) {
      if (settled) return;
      settled = true;
      const total = counts.host + counts.srflx + counts.relay + counts.prflx;
      resolve({ ...counts, total, ...extra });
    }

    const globalTimeout = setTimeout(() => settle({ timedOut: true }), timeoutMs);

    function attachToPC() {
      if (settled) return;
      const pc = session?.sessionDescriptionHandler?.peerConnection;
      if (!pc) {
        setTimeout(attachToPC, 40);
        return;
      }

      if (pc.iceGatheringState === "complete") {
        clearTimeout(globalTimeout);
        const sdp = pc.localDescription?.sdp;
        const sdpCounts = countCandidatesFromSdp(sdp);
        Object.assign(counts, sdpCounts);
        settle({ timedOut: false, fromSdp: true });
        return;
      }

      function candHandler(ev) {
        if (!ev.candidate) {
          pc.removeEventListener("icecandidate", candHandler);
          pc.removeEventListener("icegatheringstatechange", gatherHandler);
          clearTimeout(globalTimeout);
          settle({ timedOut: false, fromSdp: false });
          return;
        }
        const match = ev.candidate.candidate?.match(/\btyp (\w+)\b/);
        const typ = match?.[1];
        if (typ && Object.prototype.hasOwnProperty.call(counts, typ)) counts[typ]++;
      }

      function gatherHandler() {
        if (pc.iceGatheringState === "complete") {
          pc.removeEventListener("icegatheringstatechange", gatherHandler);
          pc.removeEventListener("icecandidate", candHandler);
          clearTimeout(globalTimeout);
          settle({ timedOut: false, fromSdp: false });
        }
      }

      pc.addEventListener("icecandidate", candHandler);
      pc.addEventListener("icegatheringstatechange", gatherHandler);
    }

    attachToPC();
  });
}

export function guardDesktopLteRelayReadiness(session, { aor, callId, dir = "outbound", onFail }) {
  if (!isMobileCompatModeEnabled()) return;

  waitForIceGatheringComplete(session)
    .then(({ relay, total, timedOut, host, srflx, fromSdp }) => {
      const summary = `relay=${relay} host=${host} srflx=${srflx} total=${total}${fromSdp ? " (from-sdp)" : ""}`;

      if (timedOut) {
        const err = DESKTOP_MEDIA_ERRORS["MEDIA-E002"];
        logLine(`[${nowISO()}] [desktop:lte-guard:${dir}] MEDIA-E002 — ICE gathering timed out (${summary})`);
        try {
          sendCallMediaEvent({
            type: "MEDIA-E002",
            code: "MEDIA-E002",
            aor,
            callId,
            dir,
            lteMode: true,
            relay,
            host,
            srflx,
            total,
            timedOut: true,
            msg: err.longDescription,
          });
        } catch {}
        onFail?.("MEDIA-E002", err.userMessage);
        return;
      }

      if (relay === 0) {
        const err = DESKTOP_MEDIA_ERRORS["MEDIA-E001"];
        logLine(
          `[${nowISO()}] [desktop:lte-guard:${dir}] MEDIA-E001 — relay-only mode, zero relay candidates (${summary})`
        );
        try {
          sendCallMediaEvent({
            type: "MEDIA-E001",
            code: "MEDIA-E001",
            aor,
            callId,
            dir,
            lteMode: true,
            relay: 0,
            host,
            srflx,
            total,
            timedOut: false,
            msg: err.longDescription,
          });
        } catch {}
        onFail?.("MEDIA-E001", err.userMessage);
        return;
      }

      logLine(`[${nowISO()}] [desktop:lte-guard:${dir}] relay OK — ${relay} relay candidate(s) in LTE mode (${summary})`);
      try {
        sendCallMediaEvent({
          type: "ice-relay-ok",
          aor,
          callId,
          dir,
          lteMode: true,
          relay,
          host,
          srflx,
          total,
          timedOut: false,
        });
      } catch {}
    })
    .catch(() => {
      // Never throw — guard must not affect call flow
    });
}
