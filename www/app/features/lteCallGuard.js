/**
 * lteCallGuard.js
 *
 * LTE/5G relay readiness guard for outgoing and incoming (answer) call paths.
 *
 * Problem: In relay-only ICE mode (LTE/5G compatibility mode), if the TURN server
 * is unreachable on the current mobile network, the browser gathers zero ICE candidates.
 * SIP.js then sends an INVITE/200 OK with SDP containing c=0.0.0.0 m=audio 9 (discard
 * address). RTPEngine stores this as the browser endpoint, DTLS never completes, and the
 * call appears to connect but both sides hear silence.
 *
 * This module provides two layers of protection:
 *
 *  Layer 1 — Pre-flight check (checkLteRelayAvailable):
 *    Creates a temporary RTCPeerConnection BEFORE invite()/accept() and tests whether
 *    at least one TURN relay candidate can be gathered. If not → abort before INVITE.
 *    This prevents the bad SDP from ever being sent to the PBX/RTPEngine.
 *
 *  Layer 2 — Post-invite guard (guardLteRelayReadiness):
 *    Secondary check that fires after invite()/accept(). Reads candidates from the
 *    session's local SDP (not event listeners — they fired before we attached).
 *    Cancels the call if gathering was still zero.
 *
 * Rules:
 *  - Both layers do nothing when LTE/5G compat mode is disabled (Wi-Fi path untouched)
 *  - Layer 1 is awaited before invite() — adds ~100ms on success, full timeout on failure
 *  - Layer 2 is non-blocking — monitors in parallel after invite()
 *  - Never throw
 */

import { isMobileCompatModeEnabled } from './mobileNetworkMode.js';
import { nowISO } from '../config.js';
import { logLine } from '../log.js';
import { sendCallMediaEvent } from './callMediaLog.js';

// ---------------------------------------------------------------------------
// MEDIA error catalog
// ---------------------------------------------------------------------------

export const MEDIA_ERRORS = {
  'MEDIA-E001': {
    code: 'MEDIA-E001',
    shortLabel: 'No relay found',
    userMessage: 'Could not reach the media relay (TURN) server on this network. Try Wi-Fi, or disable LTE/5G Mode if already on Wi-Fi.',
    longDescription: 'ICE gathering completed in relay-only mode with zero relay candidates. TURN server unreachable on the current carrier network.',
    likelyLayer: 'ICE / TURN',
    commonCauses: [
      'Mobile carrier blocks UDP/TCP port 3478 and TLS port 5349',
      'TURN credentials incorrect',
      'TURN server down or misconfigured',
    ],
    recommendedChecks: [
      'Verify TURN_HOST, TURN_USER, TURN_PASS in .env',
      'Test TURN: turnutils_uclient -u TURN_USER -w TURN_PASS TURN_HOST',
      'Check CoTURN logs: docker logs coturn',
      'Check CoTURN verbose logs for allocation attempts',
    ],
  },
  'MEDIA-E002': {
    code: 'MEDIA-E002',
    shortLabel: 'ICE timeout',
    userMessage: 'Media path setup timed out. This can happen on very restricted networks.',
    longDescription: 'ICE gathering or connectivity check timed out before any usable candidate pair was established.',
    likelyLayer: 'ICE',
    commonCauses: [
      'All candidate types blocked by carrier',
      'TURN server reachable but relay allocation is slow',
      'Network changed mid-gathering',
    ],
    recommendedChecks: [
      'Check icecandidateerror events in browser console',
      'Verify TURN server is not overloaded',
      'Check CoTURN verbose logs for allocation errors',
    ],
  },
  'MEDIA-E003': {
    code: 'MEDIA-E003',
    shortLabel: 'Secure media failed',
    userMessage: 'Secure media negotiation failed. The call connected but audio could not be established.',
    longDescription: 'DTLS handshake did not complete — SRTP session could not be established. Often caused by SDP discard address (0.0.0.0:9) when ICE failed silently.',
    likelyLayer: 'DTLS / SRTP',
    commonCauses: [
      'Browser sent SDP with discard address (ICE gathered zero candidates)',
      'ICE failed before DTLS initiated',
      'RTPEngine: "SRTP output wanted, but no crypto suite was negotiated"',
    ],
    recommendedChecks: [
      'grep "SRTP output wanted" rtpengine logs',
      'Check RTPEngine media endpoint — should not be 0.0.0.0:9',
      'Verify media-address= in kamailio/routes/60-media.cfg',
    ],
  },
  'MEDIA-E004': {
    code: 'MEDIA-E004',
    shortLabel: 'No audio received',
    userMessage: 'Call connected but no audio was received from the remote end.',
    longDescription: 'Call established (DTLS may have completed) but zero RTP packets received on the browser leg within the monitoring window.',
    likelyLayer: 'RTP',
    commonCauses: [
      'RTPEngine routing issue — browser-side leg has no media flow',
      'PBX media IP mismatch',
      'ICE selected a candidate pair that RTPEngine cannot reach',
    ],
    recommendedChecks: [
      'rtpengine-ctl list sessions — check bytes from browser side',
      'Check selected ICE candidate pair in browser (getStats)',
      'Verify PUBLIC_IP in .env matches server public IP',
    ],
  },
};

// ---------------------------------------------------------------------------
// SDP candidate counting helper (used when ICE events were missed)
// ---------------------------------------------------------------------------

/**
 * Count ICE candidates by type from a local SDP string.
 * Used when the PeerConnection's icecandidate events fired before we could listen.
 * @returns { host, srflx, relay, prflx, total }
 */
export function countCandidatesFromSdp(sdp) {
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

// ---------------------------------------------------------------------------
// Layer 1 — Pre-flight TURN check (call BEFORE invite())
// ---------------------------------------------------------------------------

/**
 * Tests whether at least one TURN relay candidate can be gathered using a
 * temporary RTCPeerConnection. Uses a data channel to trigger gathering
 * without requiring microphone permission.
 *
 * Call this BEFORE invite()/accept() in LTE mode. Only call when
 * isMobileCompatModeEnabled() is true.
 *
 * @param {object[]} iceServers - Same ICE server config used for the call
 * @param {number}   timeoutMs  - Gathering timeout (default 8s)
 * @param {object}   diagContext - Optional context to emit structured events (aor, callId, dir, peer, username, domain, mode, selectedProfile)
 * @returns {Promise<{ relay, host, srflx, prflx, total, timedOut }>}
 */
export function checkLteRelayAvailable(iceServers, timeoutMs = 8000, diagContext = null) {
  return new Promise((resolve) => {
    let pc = null;
    let settled = false;
    const counts = { relay: 0, host: 0, srflx: 0, prflx: 0 };

    const preflightEventPrefix = (diagContext && typeof diagContext.preflightEventPrefix === 'string')
      ? diagContext.preflightEventPrefix
      : '';

    const safeIceServers = Array.isArray(iceServers)
      ? iceServers.map((s) => ({
          urls: s?.urls,
          hasUsername: Boolean(s?.username),
          hasCredential: Boolean(s?.credential),
          credentialType: s?.credentialType,
        }))
      : [];

    const hasTurnServer = safeIceServers.some((s) => {
      const urls = s?.urls;
      const list = Array.isArray(urls) ? urls : (urls ? [urls] : []);
      return list.some((u) => String(u || '').startsWith('turn:') || String(u || '').startsWith('turns:'));
    });

    const turnServer = safeIceServers.find((s) => {
      const urls = s?.urls;
      const list = Array.isArray(urls) ? urls : (urls ? [urls] : []);
      return list.some((u) => String(u || '').startsWith('turn:') || String(u || '').startsWith('turns:'));
    }) || null;

    const turnUrls = (() => {
      const urls = turnServer?.urls;
      if (!urls) return [];
      return Array.isArray(urls) ? urls : [urls];
    })();

    try {
      if (diagContext) {
        sendCallMediaEvent({
          type: `${preflightEventPrefix}preflight-config`,
          ...diagContext,
          iceTransportPolicy: 'relay',
          timeoutMs,
          iceServerCount: safeIceServers.length,
          hasTurnServer,
          urls: turnUrls,
          hasUsername: Boolean(turnServer?.hasUsername),
          hasCredential: Boolean(turnServer?.hasCredential),
          credentialType: turnServer?.credentialType,
          iceServers: safeIceServers,
          msg: 'LTE preflight RTCPeerConnection config',
        });
      }
    } catch {
      // no-op
    }

    function settle(extra) {
      if (settled) return;
      settled = true;
      try { if (pc && pc.signalingState !== 'closed') pc.close(); } catch {}
      const total = counts.relay + counts.host + counts.srflx + counts.prflx;

      try {
        if (diagContext) {
          sendCallMediaEvent({
            type: extra?.timedOut ? `${preflightEventPrefix}preflight-timeout` : `${preflightEventPrefix}preflight-complete`,
            ...diagContext,
            iceTransportPolicy: 'relay',
            timeoutMs,
            relay: counts.relay,
            host: counts.host,
            srflx: counts.srflx,
            prflx: counts.prflx,
            total,
            timedOut: Boolean(extra?.timedOut),
            msg: extra?.timedOut ? 'LTE preflight ICE gathering timed out' : 'LTE preflight ICE gathering complete',
          });
        }
      } catch {
        // no-op
      }

      resolve({ ...counts, total, ...extra });
    }

    const timeout = setTimeout(() => settle({ timedOut: true }), timeoutMs);

    try {
      pc = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'relay' });

      // A data channel triggers ICE gathering without any media permissions.
      pc.createDataChannel('preflight');

      pc.addEventListener('icecandidate', (ev) => {
        if (!ev.candidate) {
          // null candidate = gathering complete
          clearTimeout(timeout);
          settle({ timedOut: false });
          return;
        }
        const m = ev.candidate.candidate?.match(/\btyp (\w+)\b/);
        const typ = m?.[1];
        if (typ && Object.prototype.hasOwnProperty.call(counts, typ)) counts[typ]++;
      });

      pc.addEventListener('icegatheringstatechange', () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          settle({ timedOut: false });
        }
      });

      pc.addEventListener('icecandidateerror', (ev) => {
        try {
          if (!diagContext) return;
          sendCallMediaEvent({
            type: `${preflightEventPrefix}preflight-icecandidateerror`,
            ...diagContext,
            iceTransportPolicy: 'relay',
            errorCode: ev?.errorCode,
            errorText: ev?.errorText,
            url: ev?.url,
            address: ev?.address,
            port: ev?.port,
            hostCandidate: ev?.hostCandidate,
            msg: 'LTE preflight icecandidateerror',
          });
        } catch {
          // no-op
        }
      });

      // setLocalDescription triggers ICE gathering
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => { clearTimeout(timeout); settle({ timedOut: true }); });
    } catch {
      clearTimeout(timeout);
      settle({ timedOut: true });
    }
  });
}

// ---------------------------------------------------------------------------
// Layer 2 — Post-invite gathering watcher
// ---------------------------------------------------------------------------

/**
 * Watches ICE gathering on a session's PeerConnection after invite()/accept().
 *
 * NOTE: In SIP.js 0.21 non-trickle mode, ICE gathering is complete BEFORE
 * invite() returns. This function handles that by reading the local SDP when
 * iceGatheringState is already 'complete' at attach time.
 *
 * @returns {Promise<{ host, srflx, relay, prflx, total, timedOut, fromSdp }>}
 */
export function waitForIceGatheringComplete(session, timeoutMs = 8000) {
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

      if (pc.iceGatheringState === 'complete') {
        // Gathering already done — read candidates from localDescription SDP.
        // The icecandidate events fired before we got here; SDP is the reliable source.
        clearTimeout(globalTimeout);
        const sdp = pc.localDescription?.sdp;
        const sdpCounts = countCandidatesFromSdp(sdp);
        Object.assign(counts, sdpCounts);
        settle({ timedOut: false, fromSdp: true });
        return;
      }

      function candHandler(ev) {
        if (!ev.candidate) {
          pc.removeEventListener('icecandidate', candHandler);
          pc.removeEventListener('icegatheringstatechange', gatherHandler);
          clearTimeout(globalTimeout);
          settle({ timedOut: false, fromSdp: false });
          return;
        }
        const match = ev.candidate.candidate?.match(/\btyp (\w+)\b/);
        const typ = match?.[1];
        if (typ && Object.prototype.hasOwnProperty.call(counts, typ)) counts[typ]++;
      }

      function gatherHandler() {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', gatherHandler);
          pc.removeEventListener('icecandidate', candHandler);
          clearTimeout(globalTimeout);
          settle({ timedOut: false, fromSdp: false });
        }
      }

      pc.addEventListener('icecandidate', candHandler);
      pc.addEventListener('icegatheringstatechange', gatherHandler);
    }

    attachToPC();
  });
}

// ---------------------------------------------------------------------------
// Layer 2 — Guard — call this after invite() / accept() as secondary check
// ---------------------------------------------------------------------------

/**
 * Secondary monitor: fires after invite()/accept() to verify ICE gathering result.
 * With the pre-flight check in place, this handles edge cases where the pre-flight
 * passed but the actual session gathering failed (e.g. network change between checks).
 *
 * Does nothing if LTE/5G compat mode is not enabled.
 * Non-blocking — returns immediately, runs asynchronously.
 *
 * @param {object} session - SIP.js Inviter or Invitation
 * @param {object} opts
 * @param {string}   opts.aor      - Account/AOR (e.g. "900900@<sip-domain>")
 * @param {string}   opts.callId   - SIP Call-ID if available
 * @param {string}   opts.dir      - "outbound" or "inbound"
 * @param {Function} opts.onFail   - (errorCode, userMessage) => void
 */
export function guardLteRelayReadiness(session, { aor, callId, dir = 'outbound', onFail }) {
  if (!isMobileCompatModeEnabled()) return;

  waitForIceGatheringComplete(session).then(({ relay, total, timedOut, host, srflx, fromSdp }) => {
    const summary = `relay=${relay} host=${host} srflx=${srflx} total=${total}${fromSdp ? ' (from-sdp)' : ''}`;

    if (timedOut) {
      const err = MEDIA_ERRORS['MEDIA-E002'];
      logLine(`[${nowISO()}] [lte-guard:${dir}] MEDIA-E002 — ICE gathering timed out (${summary})`);
      sendCallMediaEvent({
        type: 'MEDIA-E002', code: 'MEDIA-E002',
        aor, callId, dir, lteMode: true,
        relay, host, srflx, total, timedOut: true,
        msg: err.longDescription,
      });
      onFail?.('MEDIA-E002', err.userMessage);
      return;
    }

    if (relay === 0) {
      const err = MEDIA_ERRORS['MEDIA-E001'];
      logLine(`[${nowISO()}] [lte-guard:${dir}] MEDIA-E001 — relay-only mode, zero relay candidates (${summary})`);
      sendCallMediaEvent({
        type: 'MEDIA-E001', code: 'MEDIA-E001',
        aor, callId, dir, lteMode: true,
        relay: 0, host, srflx, total, timedOut: false,
        msg: err.longDescription,
      });
      onFail?.('MEDIA-E001', err.userMessage);
      return;
    }

    // Relay candidates found — media path should be viable
    logLine(`[${nowISO()}] [lte-guard:${dir}] relay OK — ${relay} relay candidate(s) in LTE mode (${summary})`);
    sendCallMediaEvent({
      type: 'ice-relay-ok',
      aor, callId, dir, lteMode: true,
      relay, host, srflx, total, timedOut: false,
    });
  }).catch(() => {
    // Never throw — guard must not affect call flow
  });
}
