# 12 — LTE Media Diagnostics
_Derived from actual code. Update when MEDIA error codes, log endpoints, or ICE guard logic change._
_Last updated: 2026-03-29_

---

## Status: ✅ Implemented

---

## Scope

- Root cause of LTE no-audio and the server-side evidence
- MEDIA error code family (MEDIA-E001 through E004)
- LTE relay readiness guard (`lteCallGuard.js`) — detects zero-relay failure before call wastes time
- Client-side call media event transport (`callMediaLog.js`)
- Server-side event ingest and admin filter page
- Operator grep commands and debugging flow

---

## Root cause of LTE no-audio

**Confirmed evidence:** RTPEngine shows browser-side endpoint `0.0.0.0:9` with zero packets; logs "SRTP output wanted, but no crypto suite was negotiated."

**Cause chain:**

1. LTE/5G Compatibility Mode is enabled → `iceTransportPolicy: "relay"` → browser gathers ONLY TURN relay candidates
2. Mobile carrier blocks UDP/TCP port 3478 → TURN server unreachable → **zero candidates gathered**
3. SIP.js sends INVITE SDP with `c=0.0.0.0 m=audio 9` (RFC discard address — no candidates)
4. RTPEngine stores `0.0.0.0:9` as the browser media endpoint
5. DTLS handshake never initiates (no valid address to connect to)
6. Result: SRTP session never established; both sides hear silence

**Wi-Fi works** because with `iceTransportPolicy: "all"`, host and srflx candidates provide a direct media path without TURN.

**Server-side (RTPEngine public IP):** RTPEngine is configured with `--interface=eth0!${PUBLIC_IP}` in `docker-compose.yml`, which already causes it to advertise the correct public IP in ICE candidates. No additional `media-address` flag is needed in `60-media.cfg`.

**Warning:** `media-address=$env(KAM_PUBLIC_IP)` was added to the PBX→WebRTC `ICE=force` paths in `60-media.cfg` as part of the LTE fix attempt, but it caused **asymmetric audio on Wi-Fi** and was reverted on 2026-03-29. Do not re-add it to the shared `else` branches. See `docs/05-phase-media-hold-moh-rbt.md` for details.

---

## MEDIA error code family

| Code | Short label | When fired | Layer |
|---|---|---|---|
| MEDIA-E001 | Relay not found | ICE gathering complete in relay-only mode, zero relay candidates | ICE / TURN |
| MEDIA-E002 | ICE timeout | ICE gathering timed out (8s) before any candidates gathered | ICE |
| MEDIA-E003 | Secure media failed | DTLS/SRTP not established (currently server-side only, not client-reported) | DTLS / SRTP |
| MEDIA-E004 | No audio received | Call established but zero RTP packets on browser leg | RTP |

Defined in: `www/app/features/lteCallGuard.js` (`MEDIA_ERRORS` export)

---

## LTE relay readiness guard — two-layer design

**File:** `www/app/features/lteCallGuard.js`

**Activation:** Only when `isMobileCompatModeEnabled()` returns true (LTE/5G compat toggle is on). Completely inert on Wi-Fi paths.

### Layer 1 — Pre-flight check (primary protection)

`checkLteRelayAvailable(iceServers, timeoutMs=8000)` runs BEFORE `invite()`/`accept()`:

1. Creates a temporary `RTCPeerConnection` with `iceTransportPolicy: "relay"` + a data channel (no mic needed)
2. Calls `createOffer()` → `setLocalDescription()` to trigger ICE gathering
3. Counts `typ relay` candidates from `icecandidate` events
4. On gathering complete (null candidate or `icegatheringstatechange → complete`):
   - If `relay === 0` → aborts: shows MEDIA-E001 or MEDIA-E002 message, no INVITE sent
   - If `relay > 0` → proceeds to call
5. Temporary RTCPeerConnection is closed immediately after

**Result:** A zero-candidate INVITE with `0.0.0.0:9` SDP is **never sent** to the PBX.

### Layer 2 — Post-invite guard (edge-case protection)

`guardLteRelayReadiness(session, opts)` runs non-blocking after `invite()`/`accept()`:

- Handles rare race: network changed between pre-flight and actual gather
- SIP.js 0.21 completes ICE gathering BEFORE `invite()` returns (non-trickle), so `iceGatheringState` is already `'complete'` when the guard attaches. The guard detects this and reads candidate counts from `pc.localDescription.sdp` via `countCandidatesFromSdp()` instead of relying on `icecandidate` events (which already fired)
- If relay=0 in the post-invite SDP read: cancels the call and surfaces MEDIA-E001/E002

### bind.js late-bind SDP read

`bindPeerConnection` (called from session state-change events, after ICE is done) also reads candidates from `pc.localDescription.sdp` when `iceGatheringState === 'complete'` at attach time, so `ice-complete` server events always have accurate relay/host/srflx counts.

### Wi-Fi isolation

Both layers return immediately if `isMobileCompatModeEnabled()` is false. Zero impact on Wi-Fi call path.

### Frontend user messages (user-safe)
- MEDIA-E001: "Could not reach the media relay (TURN) server on this network. Try Wi-Fi, or disable LTE/5G Mode if already on Wi-Fi."
- MEDIA-E002: "Media path setup timed out. This can happen on very restricted networks."

---

## Call media event transport

**File:** `www/app/features/callMediaLog.js`

Sends structured call/media diagnostic events to `POST /api/logs/call` on the push-server.

- Batches up to 5 events per POST
- Queues up to 30 events (ring buffer — oldest dropped)
- 4s timeout per POST
- Never throws; network failures silently discarded
- Does not block or delay call flow

**Events emitted at each stage:**

| Stage | File | Event type |
|---|---|---|
| UA build | `registration/primary.js` | `ua-ice-policy` (aor, lteMode, icePolicy) |
| Incoming INVITE received | `registration/primary.js` | `incoming-received` (peer, callId, sessionId) |
| Pre-flight TURN check OK | `outgoing/call.js`, `incoming/handlers.js` | `preflight-ok` (relay/total) |
| Pre-flight TURN check fail | `outgoing/call.js`, `incoming/handlers.js` | `preflight-fail` (relay=0, timedOut) |
| ICE gathering complete | `pc/bind.js` | `ice-complete` (relay/host/srflx/total counts; `from-sdp` when late-bound) |
| ICE connection failed | `pc/bind.js` | `ice-failed` (code=MEDIA-E002) |
| Selected candidate pair | `pc/bind.js` | `selected-pair` (selectedPair summary) |
| LTE relay guard pass | `features/lteCallGuard.js` | `ice-relay-ok` |
| LTE relay guard fail | `features/lteCallGuard.js` | `MEDIA-E001` or `MEDIA-E002` |
| Outgoing call started | `outgoing/call.js` | `call-start` |
| Incoming call answered | `incoming/handlers.js` | `call-answer` |
| Offer/answer markers | `outgoing/call.js`, `incoming/handlers.js` | `media-offer-outgoing`, `media-answer-outgoing`, `media-offer-incoming`, `media-answer-incoming` |
| Timeline markers | `outgoing/call.js`, `incoming/handlers.js` | `invite-sent`, `answer-clicked`, `call-established`, `call-ended` |
| Remote audio signals | `pc/bind.js`, `outgoing/call.js`, `incoming/handlers.js` | `remote-audio-attached`, `remote-audio-play-ok`, `remote-audio-play-failed` |

---

## Server-side: /api/logs/call endpoint

**Route:** `POST /api/logs/call`
**Auth:** None (public endpoint — browser clients call it)
**Storage:** In-memory ring buffer, max 500 events (`push-server/src/services/callLogStore.js`)
**Not persisted:** Events are cleared on push-server restart

**Request body:** `{ "events": [ { "ts": "...", "type": "...", ... } ] }`

**Accepted event fields (selected):**
- Identity: `username`, `domain`, `aor`
- Call correlation: `callId`, `sessionId`, `dir`, `mode`, `lteMode`
- Peer: `peer`, `peerDomain`, `peerAor`
- ICE: `icePolicy`, `relay`, `host`, `srflx`, `total`, `candSummary`, `selectedPair`
- Media: `hasLocalStream`, `hasRemoteStream`, `remoteAudioTrackCount`, `remoteAudioAttached`, `audioPlayOk`, `audioPlayError`
- Timeline markers: `t_callStart`, `t_inviteSent`, `t_incomingReceived`, `t_answerClicked`, `t_established`, `t_ended`
- Message: `msg`

**Scan noise protection:**
- Empty or missing `events` array → 400
- Batch > 20 events → 400
- Events without a `type` string → silently discarded
- Ring buffer cap (500) prevents memory growth from sustained flooding

---

## Admin call log filter page

**URL:** `http://10.252.253.15:8081/admin/calllogs` (WireGuard-only)
**JSON API:** `http://10.252.253.15:8081/admin/calllogs/json`

**Filter controls:**
- Username / Extension — substring match (shows inbound + outbound in one timeline)
- Domain — substring match
- AOR / Account — substring match (e.g. `900900@fusn01.srve.cc`)
- Direction — inbound / outbound
- Mode — Wi-Fi / LTE
- Call-ID — substring match
- Event type — substring match (e.g. `MEDIA-E001`)
- Errors only — show only events with `MEDIA-E*` codes

**Per-call trace:** Each row provides a `trace` link which filters the view to that exact `Call-ID`.

**Auto-refresh:** 15s when no filter is active (default view)

**Stats bar:** Total events, media errors, LTE events, buffer usage

---

## Operator debugging flow

### LTE no-audio suspected

1. Check admin call log page for `MEDIA-E001` or `MEDIA-E002`:
   ```
   http://10.252.253.15:8081/admin/calllogs?errorsOnly=1&lteOnly=1
   ```

2. Filter by account:
   ```
   http://10.252.253.15:8081/admin/calllogs?aor=900900%40fusn01.srve.cc
   ```

3. JSON API for scripted access:
   ```bash
   curl -s "http://10.252.253.15:8081/admin/calllogs/json?errorsOnly=1" | jq '.events[] | {ts,code,aor,relay,msg}'
   ```

4. If MEDIA-E001 (relay=0): TURN unreachable on carrier
   - Test TURN: `turnutils_uclient -u $TURN_USER -w $TURN_PASS $TURN_HOST`
   - Check CoTURN logs: `docker logs coturn`
   - Check if carrier blocks 3478: try `nc -uzv $TURN_HOST 3478` from phone (via Termux)

5. If MEDIA-E002 (timeout): TURN partially reachable but allocation failing
   - Check CoTURN for allocation errors: `docker logs coturn | grep -i error`
   - Verify TURN_USER/TURN_PASS in `.env` match CoTURN config

6. If `ice-relay-ok` but still no audio: relay candidates gathered but media still broken
   - Check RTPEngine: `rtpengine-ctl list sessions` — look at byte counts for browser leg
   - Verify `media-address` in `kamailio/routes/60-media.cfg` → should be public IP
   - Grep RTPEngine logs: `docker logs rtpengine | grep -E "SRTP|crypto|0\.0\.0\.0"`

### RTPEngine evidence commands

```bash
# Check for SRTP errors (signature of 0.0.0.0:9 issue)
docker logs rtpengine | grep "SRTP output wanted"

# Check active sessions — look for 0.0.0.0:9 endpoints
rtpengine-ctl list sessions

# Check push-server call log store live
curl -s http://10.252.253.15:8081/admin/calllogs/json | jq '.stats'
```

---

## Files changed / created

| File | Change |
|---|---|
| `www/app/features/lteCallGuard.js` | NEW — MEDIA error catalog, `checkLteRelayAvailable` pre-flight, `countCandidatesFromSdp`, post-invite guard |
| `www/app/features/callMediaLog.js` | NEW (prev session) — client-side event transport |
| `www/app/pc/bind.js` | SDP-based candidate counting when bound after gather; `sendCallMediaEvent` on ICE complete + failed; `{aor,callId}` opts |
| `www/app/registration/primary.js` | Added `ua-ice-policy` event on UA build |
| `www/app/outgoing/call.js` | Pre-flight check BEFORE invite(); fixed aor/callId in state handler; `guardLteRelayReadiness` + `call-start` event |
| `www/app/incoming/handlers.js` | Pre-flight check BEFORE accept(); `guardLteRelayReadiness` + `call-answer` event |
| `www/index.html.template` | Version bump `v=1773032002` to force JS module reload |
| `docker-compose.yml` | Added `--verbose` to CoTURN command for TURN allocation logging |
| `push-server/src/services/callLogStore.js` | NEW — in-memory ring buffer |
| `push-server/src/routes/logRoutes.js` | Added `POST /api/logs/call` endpoint |
| `push-server/src/admin/callLogPage.js` | NEW — admin HTML page generator |
| `push-server/src/routes/adminRoutes.js` | Added `/admin/calllogs` and `/admin/calllogs/json` routes |
| `push-server/server.js` | Added call logs URL to admin startup log |
| `kamailio/routes/60-media.cfg` | media-address fix (prev session) |

---

## Container restart requirements

After deploying these changes:

```bash
# Rebuild and restart push-server (new routes + callLogStore)
make push-server   # or: docker compose up -d --build push-server

# Restart CoTURN to apply --verbose flag
docker compose up -d --force-recreate coturn

# Frontend changes (www/) are served statically.
# Run make render to regenerate index.html from template:
make render

# Then hard-refresh in browser (Ctrl+Shift+R / Cmd+Shift+R) to pick up new JS modules
```

Kamailio does NOT need to restart (no Kamailio changes in this session).
