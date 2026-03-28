# 04 — Phase: Incoming Calls
_Derived from actual code. Update when incoming call logic changes._
_Last updated: 2026-03-28_

---

## Status: ✅ Working (all platforms)

---

## Scope of this phase

- Incoming INVITE handling and phantom-call protection (4 gates)
- Incoming call alert (ringtone, UI)
- Answer flow
- Reject flow
- Busy handling (session already active)
- Early media loop for incoming (before answer)

---

## Key files

| File | Role |
|---|---|
| `www/app/incoming/handlers.js` | Core: `handleIncomingCallIsolated()`, `answerIncomingCallIsolated()`, `rejectIncomingCallIsolated()`, `setRegistrationComplete()` |
| `www/app/incoming/alert.js` | `startIncomingAlert()`, `stopIncomingAlert()`, `focusDialTabForIncoming()` |
| `www/app/incoming/media.js` | `attachIncomingRemoteAudio()`, early media loop |
| `www/app/sipCallIncoming.js` | Re-export facade |
| `www/app/runtime/controlBindings.js` | Binds answer/reject button events |

---

## Phantom-call gates — CRITICAL — do not remove

**File:** `www/app/incoming/handlers.js`, top of `handleIncomingCallIsolated()`

These four gates reject invalid INVITEs before any alert or UI state change:

```
GATE 1: !st.registered
  → reject 480 Temporarily Unavailable
  → Reason: iOS/Android sometimes deliver an INVITE before registration completes
             or after the UA has been torn down

GATE 2: timeSinceRegComplete < 3000ms
  → reject 480
  → Reason: iPhone fires a phantom INVITE within ~1-2s of a fresh REGISTER completing.
             The 3s window is validated in production — calls from real users
             arrive well after this window.
  → Anchor: setRegistrationComplete() called from primary.js onRegister handler.

GATE 3: timeSincePageLoad < 5000ms
  → reject 480
  → Reason: Startup protection. On page reload, old push payloads can trigger
             INVITEs before the UA is fully initialized.

GATE 4: st.session already exists
  → reject 486 Busy Here
  → Reason: Already in a call. (Second incoming calls during dual-session
             must come through addCall flow, not a new INVITE.)
```

**Never remove, loosen timing, or bypass these gates.** They are validated against iPhone behavior in production. Phantom calls cause the UI to ring for no reason and confuse users.

---

## handleIncomingCallIsolated() — full flow

**File:** `www/app/incoming/handlers.js`

```
1. [GATES 1-4] — see above

2. st.incomingInvitation = invitation
3. focusDialTabForIncoming()         ← switch to dial tab, show caller ID
4. startIncomingAlert(invitation)    ← ringtone + UI "Incoming from {name}"
5. ui.setButtons("incoming")

6. invitation.stateChange.addListener:
   Establishing:
     logLine("Establishing")
   Established:
     st.session = invitation
     stopIncomingAlert()
     attachIncomingRemoteAudio(invitation)
     dualSessionManager.setPrimary(st)
     bindPeerConnection(invitation)
     window.callTimer.start()
     ui.setButtons("in-call")
   Terminating → nothing
   Terminated:
     stopIncomingAlert()
     stopLocalAudioStream()
     dualSessionManager.removeSession(st)
     st.session = null
     st.incomingInvitation = null
     window.callTimer.stop()
     ui.setStatus("Idle")
     ui.setButtons()

7. invitation.delegate = {
     onCancel: () => {
       logLine("Remote party cancelled")
       endIncomingAlert(st, ui, "cancelled")
     },
     onBye: () => {
       logLine("Remote party hung up")
     }
   }
```

---

## answerIncomingCallIsolated() — answer flow

**File:** `www/app/incoming/handlers.js`

```
1. ensureMicAccess()
2. invitation.accept({
     sessionDescriptionHandlerOptions: {
       constraints: { audio: true, video: false },
       modifiers: [g711OnlyModifier]    ← G.711-only codec enforcement
     }
   })
3. (stateChange Established fires → sets st.session, starts timer)
```

Called by the answer button in `runtime/controlBindings.js`.

---

## rejectIncomingCallIsolated() — reject flow

**File:** `www/app/incoming/handlers.js`

```
1. invitation.reject({ statusCode: 486 })
2. stopIncomingAlert()
3. st.incomingInvitation = null
4. ui.setStatus("Idle")
5. ui.setButtons()
```

Called by the reject button in `runtime/controlBindings.js`.

---

## Incoming ringtone and alert

**File:** `www/app/incoming/alert.js`

- `startIncomingAlert(invitation)` — plays ringtone loop, updates status bar with caller ID + display name
- `stopIncomingAlert()` — stops ringtone
- `focusDialTabForIncoming()` — switches tab to dialpad so the answer/reject buttons are visible

---

## Early media loop (incoming)

**File:** `www/app/incoming/media.js`

Before the call is answered, if the remote party sends early media (183), `startIncomingEarlyMediaLoop()` attaches it to an `<audio>` element so the user hears any PBX audio (ringback, queue, etc.). Stopped on answer or reject via `stopIncomingEarlyMediaLoop()`.

---

## Platform-specific notes

### iOS
- GATE 2 (3s post-registration) is the critical fix for iOS phantom calls
- Phantom calls arrive within ~1-2s of REGISTER completing — the 3s window blocks them
- Real calls from other parties always arrive more than 3s after registration

### Android
- Push-woken clients: `swWakeHandler.js` calls `startAndRegister()`, then the INVITE arrives after registration
- The gate check passes because registration completes before the INVITE is relayed

### Desktop
- No phantom call issues on desktop browsers
- All four gates still run (harmless overhead)

---

## setRegistrationComplete() — connection to this phase

`setRegistrationComplete()` is exported from `incoming/handlers.js` and imported by `registration/primary.js`. It is called inside the `onRegister` delegate. This is a cross-phase dependency: registration phase sets the timestamp, incoming phase reads it for GATE 2.

**If you ever move or rename this function, update both import locations.**

---

## Debugging

| Symptom | Check |
|---|---|
| Phone rings immediately after login | GATE 2 timing, `setRegistrationComplete()` called from `onRegister` |
| Phone rings on page load | GATE 3 timing (5s page load window) |
| Phantom ring with no one calling | GATE 1 — `st.registered` state, GATE 2 registration time |
| Answer button does nothing | `ensureMicAccess()` failure, mic permission denied |
| Answer button answers but no audio | `attachIncomingRemoteAudio()`, ICE candidates, TURN |
| Call shows Establishing but never Established | SDP negotiation, codec mismatch, RTPEngine issue |
| Remote party hears nothing | Mic stream not attached to answer options, local track missing |
| Busy tone sent to caller | GATE 4 firing — `st.session` already set from a previous call not cleaned up |
