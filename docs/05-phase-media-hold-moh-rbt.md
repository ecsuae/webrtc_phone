# 05 — Phase: Media, Hold, MOH, Ringback
_Derived from actual code. Update when media or hold/unhold logic changes._
_Last updated: 2026-03-28_

---

## Status: ✅ Working

---

## Scope of this phase

- Codec enforcement (G.711-only SDP)
- Microphone access (singleton stream)
- Remote audio attachment (outgoing and incoming)
- Hold / Unhold via SIP re-INVITE
- Post-unhold RTP recovery (silent call fix)
- Music on Hold (MOH) — Kamailio/FusionPBX side
- Ringback tone — outgoing calls (03-phase covers triggers; this covers the audio side)
- ICE / TURN configuration
- PeerConnection debugging

---

## Key files

| File | Role |
|---|---|
| `www/app/sdp.js` | `g711OnlyModifier()` — SDP codec filter |
| `www/app/media.js` | `ensureMicAccess()`, `getLocalStream()`, `stopLocalAudioStream()` |
| `www/app/outgoing/media.js` | `attachOutgoingRemoteAudio()` |
| `www/app/incoming/media.js` | `attachIncomingRemoteAudio()`, early media loop |
| `www/app/features/sipHold.js` | `setSIPHold()`, hold/unhold with RTP recovery |
| `www/app/config.js` | ICE servers, TURN credentials, `G711_ONLY`, `FORCE_RELAY` |
| `www/app/pc/bind.js` | PeerConnection event/stats binding |
| `www/app/pc/stats.js` | RTP stats collection (used by post-unhold recovery) |

---

## G.711-only codec enforcement

**File:** `www/app/sdp.js` — `g711OnlyModifier(description)`

All non-G.711 (PCMU/PCMA) and non-DTMF (telephone-event) codecs are stripped from the SDP before it is sent or accepted.

**Applied in two places — both are required:**
1. `outgoing/call.js` — Inviter `sessionDescriptionHandlerOptions.modifiers: [g711OnlyModifier]`
2. `incoming/handlers.js` — `invitation.accept({ sessionDescriptionHandlerOptions: { modifiers: [g711OnlyModifier] } })`

**Why:** RTPEngine expects G.711 and does not transcode. If Opus or other codecs slip through, media fails silently.

**Config flag:** `G711_ONLY = true` in `app/config.js`. Do not set to false without testing end-to-end with RTPEngine.

Allowed codecs set: `new Set(["pcmu", "pcma"])` + `"telephone-event"` for DTMF.

---

## Microphone access

**File:** `www/app/media.js`

`ensureMicAccess()` — called before every outgoing call and before every incoming call answer.

- Acquires `getUserMedia({ audio: true, video: false })`
- Stores result as a module-level singleton (not re-acquired on each call)
- Returns the stream for use as `localMediaStream` in Inviter / Invitation accept options

`getLocalStream()` — returns the current stream (null if not acquired).

`stopLocalAudioStream()` — called on hangup. Stops all tracks, clears the singleton so the next call re-acquires fresh.

---

## Remote audio attachment

### Outgoing — attachOutgoingRemoteAudio()
**File:** `www/app/outgoing/media.js`

Called at two points:
1. On **183 with SDP** (early media) during call progress
2. On **Established** state transition

Gets the audio receiver track from `session.sessionDescriptionHandler.peerConnection.getReceivers()` and sets `document.getElementById('remoteAudio').srcObject = new MediaStream([track])`.

### Incoming — attachIncomingRemoteAudio()
**File:** `www/app/incoming/media.js`

Same pattern. Called from the `Established` state handler.

---

## Hold / Unhold — setSIPHold()

**File:** `www/app/features/sipHold.js`

### Hold state module

```js
const holdState = {
  active: false,    // is hold currently active
  pending: false,   // debounce — a hold/unhold is in flight
};
```

Events emitted: `CustomEvent("sip:hold-state", { detail: { active, pending } })` — UI listens to this.

### setSIPHold(st, shouldHold) — step by step

```
1. Validate: session exists and state === Established
2. if holdState.pending: return false (debounce — prevent concurrent re-INVITEs)
3. holdState.pending = true
4. emitHoldState()

5. Get PeerConnection from st.session.sessionDescriptionHandler.peerConnection

6. If HOLD:
   modifiers = [getSipJsHoldModifier()]   ← "sendonly" direction
   (SIP.js built-in holdModifier, falls back to forceAudioDirectionModifier("sendonly"))

7. If UNHOLD:
   a. Ensure audio track is enabled on local sender
   b. Re-attach local stream sender track if missing
   c. modifiers = [forceAudioDirectionModifier("sendrecv")]   ← or "recvonly"

8. Send re-INVITE:
   session.invite({
     sessionDescriptionHandlerModifiers: modifiers
   })

9. Wait 150ms (session needs to settle after re-INVITE)
10. Verify session still Established
11. holdState.active = shouldHold
12. holdState.pending = false
13. emitHoldState()

14. recoverRemoteAudioPlayback(session, "after-hold-change")
    → re-fetch receiver track from PeerConnection
    → re-attach to #remoteAudio element
    → unmute, volume = 1, play()

15. If UNHOLD: run post-unhold RTP recovery check
```

### Post-unhold RTP recovery — do not remove

After unhold, some Kamailio/RTPEngine paths don't immediately resume RTP flow. This step detects and recovers:

```
1. Snapshot RTP inbound packet count (before)
   → from PeerConnection.getStats() inbound-rtp track
2. Wait 2500ms
3. Snapshot again (after)
4. If delta === 0 (no packets arrived):
   logLine("RTP stalled — triggering recovery re-INVITE with iceRestart")
   session.invite({
     sessionDescriptionHandlerModifiers: [forceAudioDirectionModifier("sendrecv")],
     sessionDescriptionHandlerOptions: { iceRestart: true }
   })
5. recoverRemoteAudioPlayback() again after iceRestart
```

**Why this exists:** Kamailio + RTPEngine sometimes do not resume the RTP stream after a re-INVITE hold/unhold cycle on certain network paths. The iceRestart forces both sides to renegotiate ICE candidates, which re-triggers RTPEngine media path setup.

**Removing this causes silent calls** on affected network paths.

---

## SDP direction modifiers

**File:** `www/app/features/sipHold.js`

```js
function forceAudioDirectionModifier(direction) {
  // Patches the audio m= section:
  // - Removes any existing a=sendrecv / a=sendonly / a=recvonly / a=inactive
  // - Inserts a={direction} after the a=mid line
  // direction: "sendonly" | "recvonly" | "sendrecv" | "inactive"
}

function getSipJsHoldModifier() {
  // Returns SIP.Web.holdModifier if available on window.SIP
  // Otherwise falls back to forceAudioDirectionModifier("sendonly")
}
```

---

## Music on Hold (MOH)

MOH is handled entirely server-side by **Kamailio + FusionPBX**. When the client sends a re-INVITE with `a=sendonly`, FusionPBX detects the hold and starts streaming MOH to the remote party.

The client does not play MOH locally. The client's role is only to send the correct SDP direction.

**Frontend responsibility:** send `sendonly` re-INVITE on hold, `sendrecv` re-INVITE on unhold.
**Kamailio responsibility:** relay the re-INVITE to FusionPBX, handle the in-dialog RTPEngine media update.

---

## Ringback tone (audio side)

**File:** `www/app/outgoing/ringback.js`

The ringtone is an `<audio>` element with `loop=true`. `startRingbackTone()` plays it; `stopRingbackTone()` pauses and resets it.

Triggers are in `outgoing/call.js` (see [03-phase-outgoing-calls.md](03-phase-outgoing-calls.md)):
- Start: on 180 Ringing
- Stop: on 183 with SDP, 200 OK, 4xx/5xx, or Terminated

---

## ICE / TURN configuration

**File:** `www/app/config.js`

```js
ICE_SERVERS = [
  { urls: `stun:${TURN_HOST}:3478` },
  {
    urls: [
      `turn:${TURN_HOST}:3478?transport=udp`,
      `turn:${TURN_HOST}:3478?transport=tcp`,
      `turns:${TURN_HOST}:5349`
    ],
    username: TURN_USERNAME,
    credential: TURN_CREDENTIAL
  }
]
```

`TURN_HOST`, `TURN_USERNAME`, `TURN_CREDENTIAL` come from `window.APP_CONFIG` (injected by template). **Known issue:** there are hardcoded fallback literals in `config.js` — see `01-current-state-and-handoff.md`.

`ICE_TRANSPORT_POLICY = "all"` (default). Use `"relay"` only for strict firewall environments (forces all media through TURN).

`FORCE_RELAY = false` by default.

### LTE/5G Compatibility Mode (relay override)

**File:** `www/app/features/mobileNetworkMode.js`

When the user enables "LTE/5G Mode", `buildUserAgent()` in `primary.js` passes `iceTransportPolicy: "relay"` to the PeerConnection configuration instead of the default `"all"`. This forces all WebRTC media through the TURN relay, bypassing carrier CGNAT that may block UDP STUN candidates.

- Effective on the next UA construction (next login or reconnect)
- Adds TURN relay overhead — only appropriate when ICE fails on mobile data
- Does not change signaling, codec, or any other media behavior
- An explicit log is written at UA build time: `ICE transport policy = relay — LTE/5G media relay mode ACTIVE`

**LTE relay path — why media-address matters in RTPEngine:**

When relay mode is ON, the browser only offers TURN relay candidates. RTPEngine generates ICE candidates and sends them in the SDP to the browser. For TURN relay to work, CoTURN must route from the browser's relay allocation to RTPEngine. This requires RTPEngine's ICE candidates to advertise the correct **public IP**. If RTPEngine advertises a container/private IP, CoTURN cannot route packets and audio fails on LTE even though signaling succeeds.

**Fix applied:** RTPEngine is configured with `--interface=eth0!${PUBLIC_IP}` in docker-compose.yml, which already causes it to advertise the correct public IP in all ICE candidates. No `media-address` flag is needed in `60-media.cfg`.

**Warning — two confirmed regression causes in `60-media.cfg`:**

1. `media-address=$env(KAM_PUBLIC_IP)` in the PBX→WebRTC `else` branches causes **asymmetric audio on Wi-Fi**. RTPEngine already uses the correct public IP from `--interface=eth0!PUBLIC_IP`. Do NOT add `media-address` to these paths.

2. `rtcp-mux=answer codec-mask=PCMA codec-mask=PCMU` in MEDIA_ANSWER else (outgoing call answer path) causes **asymmetric audio on Wi-Fi** (one-sided). The OFFER path sets up the session without rtcp-mux state (`ICE=remove` to PBX); adding `rtcp-mux=answer` in ANSWER creates mismatched state in RTPEngine. Confirmed broken and reverted 2026-03-29.

The MEDIA_ANSWER else branch must remain exactly:
```
rtpengine_answer("RTP/SAVPF replace-origin replace-session-connection ICE=force DTLS=passive")
```

The `is_local_call` ext-to-ext branch (dead code — `is_local_call` is never set) retains `media-address=$env(KAM_PUBLIC_IP)` from a prior commit. This is harmless since that branch never fires.

---

## PeerConnection debugging

**File:** `www/app/pc/bind.js` — `bindPeerConnection(session)`

Bound during `Established` state in both call flows. Logs:
- ICE connection state changes
- ICE candidate pair selection
- RTP stats (inbound packet counts)
- Candidate type summary at gathering complete: `candidates: host=N srflx=N relay=N`
- LTE relay-only confirmation: `LTE relay-only mode confirmed — all media through TURN relay`
- ICE failure: logs candidate counts for triage (`relay=N host=N srflx=N`)

Used by the post-unhold RTP recovery to snapshot packet counts.

---

## Hold button UI

**File:** `www/app/ui/callControls.js` — `initializeHoldButton()`

- Listens to `sip:hold-state` CustomEvent
- Updates button icon and text (Hold / Unhold)
- Disables button during `pending = true` to prevent double-clicks

---

## Debugging

| Symptom | Check |
|---|---|
| Hold re-INVITE fails | `setSIPHold()` session state check, `holdState.pending` debounce |
| Silent after unhold | Post-unhold RTP recovery step, RTP packet delta check |
| MOH not playing | FusionPBX MOH config, Kamailio in-dialog `30-dialog-relay.cfg` |
| Remote audio missing after answer | `attachOutgoingRemoteAudio()` / `attachIncomingRemoteAudio()` |
| Codec mismatch | `g711OnlyModifier` applied, `sdp.js` allowed codec set |
| No audio — TURN | ICE server config, TURN credentials, `coturn` container running |
| Audio cuts out mid-call | ICE restart triggered by network change, check `pc/bind.js` logs |
