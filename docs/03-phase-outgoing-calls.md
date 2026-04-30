# 03 — Phase: Outgoing Calls
_Derived from actual code. Update when outgoing call logic changes._
_Last updated: 2026-03-28_

---

## Status: ✅ Working

---

## Scope of this phase

- Outgoing INVITE initiation and lifecycle
- Ringback tone (180 Ringing)
- Early media (183 Session Progress with SDP)
- Call establishment and timer start
- Hangup (cancel or bye)
- SIP response → human error message mapping
- Call history logging

---

## Key files

| File | Role |
|---|---|
| `www/app/outgoing/call.js` | `startCall()`, `hangupCall()` |
| `www/app/outgoing/addCall.js` | `addSecondCall()` — add second call while first is active |
| `www/app/outgoing/ringback.js` | Ringback tone start/stop |
| `www/app/outgoing/media.js` | `attachOutgoingRemoteAudio()` — connect PeerConnection audio to DOM |
| `www/app/sipCall.js` | Re-export facade for `startCall` / `hangupCall` |
| `www/app/ui/callControls.js` | Dial button event handler, calls `startCall()` |
| `www/app/log.js` | SIP code → user message map |

---

## startCall() — full flow

**File:** `www/app/outgoing/call.js`

```
1. Validate:
   - st.registered === true
   - target number is not empty
   - no existing st.session (no concurrent call)

2. ensureMicAccess()
   → acquires mic stream (singleton), stored in media.js

3. Build target URI:
   sip:{encodeURIComponent(target)}@{st.account.domain}

4. Create SIP.Inviter:
   - earlyMedia: true          (capture 183 responses)
   - P-Early-Media: supported  (extra header)
   - sessionDescriptionHandlerOptions:
       modifiers: [g711OnlyModifier]      ← strips non-G.711 from SDP
       constraints: { audio: true, video: false }
       localMediaStream: (from mic)

5. Setup requestDelegate:
   onTrying(response):
     logLine("100 Trying")

   onProgress(response):
     if 180 Ringing:
       startRingbackTone()
     if 183 Session Progress + SDP body:
       stopRingbackTone()
       attachOutgoingRemoteAudio(session)   ← early media

   onAccept(response):
     logCallHistory(callee, "outgoing", "answered")
     stopRingbackTone()

   onReject(response):
     stopRingbackTone()
     msg = mapSipCodeToMessage(response.message.statusCode)
     ui.setStatus(msg)
     logCallHistory(callee, "outgoing", "rejected")
     stopLocalAudioStream()

   onRedirect(response):
     logLine("Redirect")

6. inviter.stateChange.addListener:
   Establishing:
     ui.setStatus("Calling…")
   Established:
     stopRingbackTone()
     attachOutgoingRemoteAudio(session)   ← primary media attach
     dualSessionManager.setPrimary(st)
     bindPeerConnection(session)          ← PC stats/debug
     window.callTimer.start()
   Terminating → nothing
   Terminated:
     stopLocalAudioStream()
     dualSessionManager.removeSession(st)
     st.session = null
     window.callTimer.stop()
     ui.setStatus("Idle")
     ui.setButtons()

7. st.session = inviter
8. inviter.invite({ requestDelegate })
```

---

## hangupCall() — flow

**File:** `www/app/outgoing/call.js`

```
if session state === Established:
  session.bye()
else:
  session.cancel()     ← pre-answer hangup

stopRingbackTone()
stopLocalAudioStream()
(stateChange Terminated event handles the rest)
```

`silent` parameter: if true, skips UI status update (used when hangup is triggered programmatically).

---

## Ringback tone

**File:** `www/app/outgoing/ringback.js`

- Started on **180 Ringing**
- Stopped on **183 with SDP** (early media replaces it), **200 OK** (call answered), **4xx/5xx** (call rejected), or **Terminated**
- Uses an `<audio>` element with a looped ringback audio file

---

## Early media (183 Session Progress)

When the remote party sends 183 with an SDP body:
1. Ringback stops
2. `attachOutgoingRemoteAudio(session)` connects the PeerConnection receiver track to the `<audio id="remoteAudio">` element
3. The caller hears whatever the PBX is playing (ring tone, queue music, IVR, etc.)

The `earlyMedia: true` Inviter option and `P-Early-Media: supported` header enable this. Required for proper call experience on FusionPBX.

---

## SIP response → user message mapping

**File:** `www/app/log.js`

Key codes and their UI messages:

| SIP Code | User message |
|---|---|
| 403 | "Forbidden / Not Authorized" |
| 404 | "Number not found" |
| 408 | "Request Timeout" |
| 480 | "Temporarily Unavailable" |
| 486 | "Busy" |
| 487 | "Call Cancelled" |
| 500 | "Server Error" |
| 503 | "Service Unavailable" |

Q.850 Reason header (if present) is also parsed and appended to the log message.

---

## Call history

On `onAccept` and `onReject`, `logCallHistory()` in `ui/callHistoryLocal.js` writes to `localStorage` and updates the History tab.

---

## Debugging

| Symptom | Check |
|---|---|
| Call doesn't dial | `st.registered` check, target URI encoding |
| No ringback | `startRingbackTone()` in `ringback.js`, audio file path |
| No early media | `earlyMedia: true` on Inviter, 183 SDP body parsing |
| No audio after answer | `attachOutgoingRemoteAudio()`, ICE candidate gathering, TURN reachability |
| Wrong codec negotiated | `g711OnlyModifier` applied, `sdp.js` |
| Call silently ends | Check Inviter `stateChange` Terminated log, `session.bye()` vs `cancel()` path |
| Error message not showing | `log.js` SIP code map |
