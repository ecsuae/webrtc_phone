/**
 * SIP Hold Feature Module
 * Isolated hold/unhold logic to prevent core call disruption.
 */

import { g711OnlyModifier } from "../sdp.js";
import { ensureMicAccess, getLocalStream } from "../media.js";

const holdState = {
  active: false,
  pending: false,
};

function recoverRemoteAudioPlayback(session, reason = "unknown") {
  try {
    const pc = session?.sessionDescriptionHandler?.peerConnection;
    const audioEl = document.getElementById("remoteAudio");
    if (!pc || !audioEl) return;

    const receiverTrack = pc.getReceivers?.().find((r) => r.track?.kind === "audio")?.track;
    if (receiverTrack) {
      const currentTrack = audioEl.srcObject?.getAudioTracks?.()[0] || null;
      if (!currentTrack || currentTrack.id !== receiverTrack.id) {
        audioEl.srcObject = new MediaStream([receiverTrack]);
      }
    }

    audioEl.muted = false;
    audioEl.volume = 1;
    const p = audioEl.play?.();
    if (p && typeof p.catch === "function") {
      p.catch((err) => {
        console.warn(`[SIP-Hold] audio recovery play blocked (${reason}):`, err?.name, err?.message);
      });
    }
  } catch (err) {
    console.warn("[SIP-Hold] audio recovery error:", err?.message || err);
  }
}

function getSipJsHoldModifier() {
  const SIP = window.SIP;
  const modifier = SIP?.Web?.holdModifier;
  return typeof modifier === "function" ? modifier : null;
}

function forceAudioDirectionModifier(direction) {
  return (sessionDescription) => {
    if (!sessionDescription?.sdp) return Promise.resolve(sessionDescription);

    const lines = sessionDescription.sdp.split(/\r\n/);
    const mIdx = [];
    for (let i = 0; i < lines.length; i++) if (lines[i].startsWith("m=")) mIdx.push(i);

    const audioStart = mIdx.find((i) => lines[i].startsWith("m=audio "));
    if (audioStart === undefined) return Promise.resolve(sessionDescription);

    const audioEnd = mIdx.find((i) => i > audioStart) ?? lines.length;
    const audioLines = lines.slice(audioStart, audioEnd).filter(
      (line) => !/^a=(sendrecv|sendonly|recvonly|inactive)$/.test(line)
    );

    let insertAt = audioLines.findIndex((line) => line.startsWith("a=mid:"));
    if (insertAt === -1) insertAt = 1;
    audioLines.splice(insertAt + 1, 0, `a=${direction}`);

    const sdp = [...lines.slice(0, audioStart), ...audioLines, ...lines.slice(audioEnd)].join("\r\n");
    return Promise.resolve({ type: sessionDescription.type, sdp });
  };
}

function ensureLocalAudioSenderEnabled(pc) {
  const senders = pc?.getSenders?.() || [];
  for (const sender of senders) {
    if (sender?.track?.kind === "audio") {
      sender.track.enabled = true;
    }
  }
}

function logPeerState(pc, label = "state") {
  if (!pc) return;
  const transceivers = (pc.getTransceivers?.() || [])
    .map((t, i) => {
      const s = t?.sender?.track;
      const r = t?.receiver?.track;
      return `#${i}:${s?.kind || r?.kind || "?"}:dir=${t?.direction || "?"}/cur=${t?.currentDirection || "?"}/s=${s?.readyState || "none"}:${s?.enabled ?? "-"}/r=${r?.readyState || "none"}`;
    })
    .join(" | ");

  console.log(
    `[SIP-Hold] ${label} signaling=${pc.signalingState} ice=${pc.iceConnectionState} conn=${pc.connectionState} transceivers=${transceivers}`
  );
}

async function ensureAudioSenderTrackRestored(pc) {
  const audioSender = (pc?.getSenders?.() || []).find((s) => s?.track?.kind === "audio");
  if (!audioSender) return;

  if (audioSender.track && audioSender.track.readyState === "live") {
    audioSender.track.enabled = true;
    return;
  }

  await ensureMicAccess(() => {});
  const localTrack = getLocalStream()?.getAudioTracks?.()[0];
  if (localTrack) {
    await audioSender.replaceTrack(localTrack);
    localTrack.enabled = true;
    console.log("[SIP-Hold] restored local audio sender track");
  }
}

async function getAudioRtpSnapshot(pc) {
  const snapshot = { inPackets: 0, outPackets: 0 };
  try {
    const stats = await pc.getStats();
    stats.forEach((report) => {
      if (report.type === "inbound-rtp" && report.kind === "audio") {
        snapshot.inPackets += Number(report.packetsReceived || 0);
      }
      if (report.type === "outbound-rtp" && report.kind === "audio") {
        snapshot.outPackets += Number(report.packetsSent || 0);
      }
    });
  } catch (err) {
    console.warn("[SIP-Hold] stats snapshot failed:", err?.message || err);
  }
  return snapshot;
}

async function runUnholdMediaRecovery(session) {
  if (!session || typeof session.invite !== "function") return false;
  if (session.__unholdRecoveryInProgress) return false;

  session.__unholdRecoveryInProgress = true;
  try {
    console.warn("[SIP-Hold] unhold media stalled; running recovery re-INVITE (iceRestart)");
    const pc = session?.sessionDescriptionHandler?.peerConnection;
    logPeerState(pc, "before-recovery-invite");
    if (pc) {
      ensureLocalAudioSenderEnabled(pc);
      await ensureAudioSenderTrackRestored(pc);
    }

    const inviteOptions = {
      sessionDescriptionHandlerModifiers: [g711OnlyModifier],
      sessionDescriptionHandlerOptions: {
        offerOptions: { iceRestart: true },
      },
      requestDelegate: {
        onAccept: () => console.log("[SIP-Hold] recovery re-INVITE accepted"),
        onReject: (response) => {
          console.error(
            `[SIP-Hold] recovery re-INVITE rejected: ${response?.message?.statusCode || "unknown"}`
          );
        },
      },
    };
    await session.invite(inviteOptions);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    recoverRemoteAudioPlayback(session, "recovery-invite");
    logPeerState(pc, "after-recovery-invite");
    return true;
  } catch (err) {
    console.error("[SIP-Hold] recovery re-INVITE failed:", err?.message || err);
    return false;
  } finally {
    session.__unholdRecoveryInProgress = false;
  }
}

async function ensureMediaResumedAfterUnhold(session, pc) {
  const before = await getAudioRtpSnapshot(pc);
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const after = await getAudioRtpSnapshot(pc);

  const inDelta = after.inPackets - before.inPackets;
  const outDelta = after.outPackets - before.outPackets;
  const stalled = inDelta <= 0;

  console.log(`[SIP-Hold] unhold RTP delta in=${inDelta} out=${outDelta}`);

  if (stalled) {
    await runUnholdMediaRecovery(session);
  }
}

/**
 * Attempt to place call on hold via SIP re-INVITE
 * @param {Object} st - State object with session
 * @param {Boolean} shouldHold - true=hold, false=unhold
 * @returns {Promise<Boolean>} - Success status
 */
export async function setSIPHold(st, shouldHold) {
  if (!st?.session) {
    console.error("[SIP-Hold] hold failed: no active session");
    return false;
  }

  if (holdState.pending) {
    console.warn("[SIP-Hold] hold/unhold skipped: request already pending");
    return false;
  }

  console.log(`[SIP-Hold] ${shouldHold ? "hold requested" : "unhold requested"}`);

  try {
    const SIP = window.SIP;
    if (!SIP) {
      console.error("[SIP-Hold] hold failed: SIP.js not available");
      return false;
    }

    // Check session state
    if (st.session.state !== SIP.SessionState.Established) {
      console.error(`[SIP-Hold] hold failed: session not established (state=${st.session.state})`);
      return false;
    }

    // Get peer connection
    const pc = st.session?.sessionDescriptionHandler?.peerConnection;
    if (!pc) {
      console.error("[SIP-Hold] hold failed: no peer connection");
      return false;
    }

    if (typeof st.session.invite !== "function") {
      console.error("[SIP-Hold] hold failed: session.invite() unavailable");
      return false;
    }

    holdState.pending = true;
    logPeerState(pc, shouldHold ? "before-hold-invite" : "before-unhold-invite");
    if (!shouldHold) {
      ensureLocalAudioSenderEnabled(pc);
      await ensureAudioSenderTrackRestored(pc);
    }

    const requestDelegate = {
      onAccept: () => {
        console.log(`[SIP-Hold] ${shouldHold ? "hold response accepted" : "unhold response accepted"}`);
      },
      onReject: (response) => {
        console.error(
          `[SIP-Hold] ${shouldHold ? "hold failed" : "unhold failed"}: rejected ${response?.message?.statusCode || "unknown"}`
        );
      },
    };

    const holdModifier = getSipJsHoldModifier();
    const modifiers = shouldHold
      ? holdModifier
        ? [holdModifier, g711OnlyModifier]
        : [forceAudioDirectionModifier("sendonly"), g711OnlyModifier]
      : [g711OnlyModifier];

    const inviteOptions = {
      requestDelegate,
      sessionDescriptionHandlerModifiers: modifiers,
    };

    await st.session.invite(inviteOptions);

    // Give SIP.js/WebRTC a short settle window before declaring success.
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (st.session.state !== SIP.SessionState.Established) {
      console.error(`[SIP-Hold] ${shouldHold ? "hold failed" : "unhold failed"}: session not established after re-INVITE`);
      return false;
    }

    holdState.active = shouldHold;
    recoverRemoteAudioPlayback(st.session, shouldHold ? "after-hold" : "after-unhold");
    logPeerState(pc, shouldHold ? "after-hold-invite" : "after-unhold-invite");

    if (!shouldHold) {
      // Some PBX paths acknowledge unhold but media remains frozen (no RTP deltas).
      // Detect and perform one recovery re-INVITE with ICE restart.
      ensureMediaResumedAfterUnhold(st.session, pc).catch((err) => {
        console.warn("[SIP-Hold] post-unhold media check failed:", err?.message || err);
      });
    }

    console.log(`[SIP-Hold] ${shouldHold ? "hold succeeded" : "unhold succeeded"}`);
    return true;
  } catch (err) {
    console.error(`[SIP-Hold] ${shouldHold ? "hold failed" : "unhold failed"}:`, err?.message || err);
    return false;
  } finally {
    holdState.pending = false;
  }
}

/**
 * Initialize UI for hold feature
 * Safe to call even if hold doesn't fully work - core calls still function
 * @param {Element} holdBtn - The hold button element
 * @param {Object} st - State object
 */
export function initializeHoldButton(holdBtn, st) {
  if (!holdBtn) return;
  
  holdBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    
    if (!st?.session) {
      console.log("[Hold UI] No active session");
      alert("No active call");
      return;
    }

    const wasOnHold = holdState.active || holdBtn.classList.contains("active");
    const willBeOnHold = !wasOnHold;

    console.log(`[Hold UI] Toggling hold: ${wasOnHold ? "held" : "active"} → ${willBeOnHold ? "held" : "active"}`);

    // Visual feedback: disable and fade
    holdBtn.disabled = true;
    holdBtn.style.opacity = "0.5";

    // Attempt SIP hold/unhold re-INVITE with SDP media direction modifier.
    const success = await setSIPHold(st, willBeOnHold);

    // Re-enable button
    holdBtn.disabled = false;
    holdBtn.style.opacity = "1";

    if (success) {
      // Update button state
      holdBtn.classList.toggle("active", willBeOnHold);
      const isNowOnHold = willBeOnHold;
      holdBtn.innerHTML = isNowOnHold
        ? '<i class="fas fa-play"></i> Unhold'
        : '<i class="fas fa-pause"></i> Hold';
      console.log(`[Hold UI] state=${isNowOnHold ? "hold active" : "hold released"}`);
    } else {
      console.warn("[Hold UI] hold request failed; call remains active");
      // Note: This is logged but doesn't alert, allowing call to continue
    }
  });
}
