import { nowISO, logLine } from "../desktopLogging.js";
import {
  getDesktopIceAndRtpStats,
  snapDesktopAudioTransceiver,
  snapDesktopSipDialog,
} from "./ext/desktopTerminationSnapshotHelpers.js";

export function initDesktopTerminationDiagnostics(SIP, session, ui, meta = {}) {
  try {
    if (!session || session.__desktopTermDiagInit) return session?.__desktopTermDiagApi || null;
    session.__desktopTermDiagInit = true;
  } catch {}

  const state = {
    createdAt: nowISO(),
    meta,
    snapshots: [],
    lastError: null,
  };

  async function capture(label, extra = {}) {
    const pc = session?.sessionDescriptionHandler?.peerConnection || null;
    const sip = snapDesktopSipDialog(session);
    const transceiver = pc ? snapDesktopAudioTransceiver(pc) : null;
    const stats = pc ? await getDesktopIceAndRtpStats(pc) : null;

    const uplinkHistory = (() => {
      try {
        const h = session.__desktopUplinkDiagHistory;
        return Array.isArray(h) ? h.slice(-6) : null;
      } catch {
        return null;
      }
    })();

    const snap = {
      ts: nowISO(),
      label,
      sessionState: (() => {
        try {
          return session?.state || null;
        } catch {
          return null;
        }
      })(),
      sip,
      transceiver,
      stats,
      uplinkHistory,
      extra,
    };

    try {
      state.snapshots.push(snap);
      session.__desktopTermDiagState = state;
    } catch {}

    try {
      const bye = extra?.bye;
      const byeLine = bye
        ? ` bye.reason=${bye.reason || ""} bye.status=${bye.statusCode || ""} bye.bodyLen=${String(bye.body || "").length}`
        : "";
      const cp = stats?.selectedCandidatePair;
      const outPk = stats?.outboundAudio?.packetsSent;
      const outBy = stats?.outboundAudio?.bytesSent;
      const inPk = stats?.inboundAudio?.packetsReceived;
      const tr = transceiver;
      logLine(
        `[${nowISO()}] [desktop:term-diag] ${label} callId=${sip.callId || "?"} state=${snap.sessionState || "?"} tr.mid=${tr?.mid || "?"} tr.dir=${tr?.direction || "?"} tr.cur=${tr?.currentDirection || "?"} outPk=${outPk ?? "?"} outBy=${outBy ?? "?"} inPk=${inPk ?? "?"} ice=${cp?.state || "?"}${byeLine}`
      );
    } catch {}

    return snap;
  }

  function captureSync(label, extra = {}) {
    void capture(label, extra);
  }

  function onRemoteBye(messageOrReq) {
    const bye = (() => {
      try {
        const msg = messageOrReq?.message || messageOrReq;
        const reason = msg?.getHeader?.("Reason") || msg?.headers?.Reason?.[0]?.raw || null;
        return {
          reason,
          statusCode: msg?.statusCode || msg?.status || null,
          body: msg?.body || null,
        };
      } catch {
        return { reason: null, statusCode: null, body: null };
      }
    })();

    captureSync("remote-bye", { bye });
  }

  try {
    session.stateChange?.addListener?.((s) => {
      if (s === SIP?.SessionState?.Established) captureSync("established");
      if (s === SIP?.SessionState?.Terminated) captureSync("terminated");
    });
  } catch {}

  const api = { capture, captureSync, onRemoteBye, state };
  try {
    session.__desktopTermDiagApi = api;
  } catch {}

  return api;
}

export function getDesktopTerminationDiagState(session) {
  try {
    return session?.__desktopTermDiagState || null;
  } catch {
    return null;
  }
}
