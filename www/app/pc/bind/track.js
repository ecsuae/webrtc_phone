import { nowISO } from "../../config.js";
import { logLine } from "../../log.js";
import { sendCallMediaEvent } from "../../features/callMediaLog.js";

export function bindTrackEvents(pc, label, dir, diag, { aor, callId } = {}) {
  pc.addEventListener("track", (ev) => {
    logLine(`[${nowISO()}] [pc:${label}] track`);
    try {
      const streamCount = Array.isArray(ev.streams) ? ev.streams.length : 0;
      const trackKind = ev.track?.kind || "unknown";
      const trackId = ev.track?.id || undefined;
      const trackMuted = typeof ev.track?.muted === "boolean" ? ev.track.muted : undefined;
      const remoteStream = streamCount > 0 ? ev.streams[0] : null;
      const remoteAudioTracks = remoteStream?.getAudioTracks ? remoteStream.getAudioTracks() : [];
      const remoteAudioTrackCount = Array.isArray(remoteAudioTracks) ? remoteAudioTracks.length : 0;

      if (trackKind === "audio") {
        sendCallMediaEvent({
          type: "remote-audio-track-added",
          dir,
          aor: diag.aor || aor,
          callId,
          corrId: diag.corrId,
          username: diag.username,
          domain: diag.domain,
          peer: diag.peer,
          peerDomain: diag.peerDomain,
          peerAor: diag.peerAor,
          mode: diag.mode,
          selectedProfile: diag.selectedProfile,
          icePolicy: diag.icePolicy,
          trackId,
          trackMuted,
          remoteAudioTrackCount,
          msg: "Remote audio track added (pc.track)",
        });

        try {
          if (ev.track && !ev.track.__callMediaMuteObserved) {
            ev.track.__callMediaMuteObserved = true;
            ev.track.onmute = () => {
              sendCallMediaEvent({
                type: "receiver-track-muted",
                dir,
                aor: diag.aor || aor,
                callId,
                corrId: diag.corrId,
                username: diag.username,
                domain: diag.domain,
                peer: diag.peer,
                peerDomain: diag.peerDomain,
                peerAor: diag.peerAor,
                mode: diag.mode,
                selectedProfile: diag.selectedProfile,
                icePolicy: diag.icePolicy,
                trackId,
                msg: "Receiver track muted",
              });
            };
            ev.track.onunmute = () => {
              sendCallMediaEvent({
                type: "receiver-track-unmuted",
                dir,
                aor: diag.aor || aor,
                callId,
                username: diag.username,
                domain: diag.domain,
                peer: diag.peer,
                peerDomain: diag.peerDomain,
                peerAor: diag.peerAor,
                mode: diag.mode,
                selectedProfile: diag.selectedProfile,
                icePolicy: diag.icePolicy,
                trackId,
                msg: "Receiver track unmuted",
              });
            };
          }
        } catch {}
      }

      sendCallMediaEvent({
        type: "remote-audio-attached",
        dir,
        aor: diag.aor || aor,
        callId,
        corrId: diag.corrId,
        sessionId: diag.sessionId,
        username: diag.username,
        domain: diag.domain,
        peer: diag.peer,
        peerDomain: diag.peerDomain,
        peerAor: diag.peerAor,
        mode: diag.mode,
        selectedProfile: diag.selectedProfile,
        icePolicy: diag.icePolicy,
        hasRemoteStream: Boolean(remoteStream),
        remoteAudioTrackCount,
        msg: `pc.track kind=${trackKind} streams=${streamCount}`,
      });
    } catch {
      // no-op
    }
  });
}
