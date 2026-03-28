# 09 — Phase: Dual Session and Conference
_Derived from actual code. Update when multi-call or conference logic changes._
_Last updated: 2026-03-28_

---

## Status: ✅ Working

Current branch `callcontrol` — active development context.

---

## Scope of this phase

- `dualSessionManager` singleton — state and events
- Add call flow (second outgoing call while first is active)
- Swap (toggle which call is active/held)
- Conference via SIP REFER + Replaces (RFC 3891)
- UI control visibility (Swap, Conference, Add Call buttons)

---

## Key files

| File | Role |
|---|---|
| `www/app/features/dualSessionManager.js` | Singleton — manages two sessions, swap, conference |
| `www/app/outgoing/addCall.js` | `addSecondCall()` — initiates second outgoing call |
| `www/app/ui/callControls.js` | Hold, Add Call, Swap, Conference button event bindings |
| `www/app/ui/callControlAddCall.js` | Add Call button initialization |
| `www/app/features/sipHold.js` | `setSIPHold()` — called by swap |
| `www/app/incoming/handlers.js` | `dualSessionManager.setPrimary(st)` called on answer |
| `www/app/outgoing/call.js` | `dualSessionManager.setPrimary(st)` called on establish |

---

## dualSessionManager — state structure

**File:** `www/app/features/dualSessionManager.js`

Singleton exported as named export and attached to `window.dualSessionManager` for debugging.

```js
{
  primary: st | null,         // First call state object
  secondary: st | null,       // Second call state object
  primaryOnHold: boolean,
  secondaryOnHold: boolean,
}
```

Both `primary` and `secondary` are the full `st` state objects (from `createAppState()`). Each has its own `session` (Inviter or Invitation). They **share the same `st.ua`** (one SIP.js UserAgent supports multiple sessions).

---

## dualSessionManager API

| Method | Description |
|---|---|
| `setPrimary(st)` | Store first session. Called on call establish (outgoing or incoming). |
| `setSecondary(st)` | Store second session. Called from `addSecondCall()` on establish. |
| `removeSession(st)` | Remove by reference. If primary is removed and secondary exists, secondary is **promoted to primary**. |
| `canAddCall()` | `true` if `primary.session` exists and `secondary.session` is null |
| `hasDualSessions()` | `true` if both `primary.session` and `secondary.session` exist |
| `getActiveSession()` | Returns `{st, type}` of the session that is NOT held |
| `getHeldSession()` | Returns `{st, type}` of the session that IS held |
| `swap()` | Toggle hold on both sessions concurrently |
| `conference()` | REFER+Replaces attended transfer |
| `reset()` | Clear all state |
| `emitStateChange()` | Dispatches `CustomEvent('dual-session:state-changed')` |

---

## Session lifecycle and removeSession promotion

**Critical:** when `primary` hangs up while `secondary` is active, `removeSession()` promotes secondary to primary:

```js
removeSession(st) {
  if (this.primary === st) {
    this.primary = null;
    this.primaryOnHold = false;

    if (this.secondary?.session) {
      // Promote secondary → primary so the surviving call remains active
      this.primary = this.secondary;
      this.primaryOnHold = this.secondaryOnHold;
      this.secondary = null;
      this.secondaryOnHold = false;
    }
  } else if (this.secondary === st) {
    this.secondary = null;
    this.secondaryOnHold = false;
  }
  this.emitStateChange();
}
```

**If this promotion is removed or broken**, hanging up the first call when a second call exists will leave the second call orphaned (no UI, no hangup button).

---

## Add call flow

**File:** `www/app/outgoing/addCall.js` — `addSecondCall(SIP, primarySt, ui, number)`

```
1. dualSessionManager.canAddCall()  ← must be true (primary active, no secondary)

2. Hold primary:
   await setSIPHold(primarySt, true)
   dualSessionManager.primaryOnHold = true

3. ensureMicAccess()

4. Create secondary state object:
   secondarySt = createAppState()
   secondarySt.ua = primarySt.ua    ← shares same UserAgent
   secondarySt.account = primarySt.account

5. Build target URI:
   sip:{encodeURIComponent(number)}@{account.domain}

6. Create SIP.Inviter (same options as startCall):
   earlyMedia: true
   g711OnlyModifier
   localMediaStream from mic

7. Setup stateChange listener:
   Established:
     secondarySt.session = inviter
     dualSessionManager.setSecondary(secondarySt)  ← emits state-changed
     attachOutgoingRemoteAudio(inviter)
     window.callTimer.start()

   Terminated:
     dualSessionManager.removeSession(secondarySt)
     if no other session: ui.setStatus("Idle"), callTimer.stop()
     else: unhold primary (setSIPHold(primarySt, false))

8. On call rejection (requestDelegate.onReject):
   await setSIPHold(primarySt, false)   ← unhold primary
   ui.setStatus("Idle")
   dualSessionManager.primaryOnHold = false

9. inviter.invite({ requestDelegate })
```

---

## Swap flow

**File:** `www/app/features/dualSessionManager.js` — `swap()`

```
1. hasDualSessions() check

2. Concurrently toggle hold on both sessions:
   await Promise.all([
     setSIPHold(primary, !primaryOnHold),
     setSIPHold(secondary, !secondaryOnHold)
   ])

3. Update internal state:
   primaryOnHold = !primaryOnHold
   secondaryOnHold = !secondaryOnHold

4. emitStateChange()
5. window.dispatchEvent(new Event('dual-session:hold-changed'))
```

`dual-session:hold-changed` updates the Hold button icon for the currently active call.

---

## Conference flow (attended transfer via REFER+Replaces)

**File:** `www/app/features/dualSessionManager.js` — `conference()`

Conference is implemented as a **SIP attended transfer** (RFC 3891 Replaces header). The client does NOT mix audio. The PBX (FusionPBX) performs the bridge.

```
1. hasDualSessions() check

2. held = getHeldSession()    ← the session currently on hold
   active = getActiveSession() ← the session currently speaking

3. Extract dialog info from active session:
   secondaryCallId = activeSession._dialog.callId
   secondaryLocalTag = activeSession._dialog.localTag
   secondaryRemoteTag = activeSession._dialog.remoteTag

4. Build Replaces header value (RFC 3891):
   "{callId};to-tag={remoteTag};from-tag={localTag}"

5. Clone active session's remote URI:
   referToUri = activeSession.remoteIdentity.uri.clone()

6. Attach Replaces as a SIP URI header parameter:
   referToUri.headers.Replaces = [encodeURIComponent(replacesValue)]

7. Send REFER from held session:
   await heldSession.refer(referToUri, {
     requestDelegate: { onAccept, onReject }
   })

   REFER message to PBX:
     REFER sip:held-remote-party@pbx
     Refer-To: sip:active-remote@pbx?Replaces={encoded}

8. PBX receives REFER:
   - Sees Replaces header pointing to the active call dialog
   - Bridges the two call legs at the PBX level
   - Browser is no longer in the media path for one leg

9. emitStateChange()
```

**Dialog access:** `session._dialog` is a private SIP.js property. It is accessed directly because SIP.js 0.21.x does not expose a public API for dialog tag retrieval. This may break on SIP.js version upgrades.

**If REFER is rejected (onReject):** Conference fails. Log the status code. Common causes: PBX doesn't support attended transfer, Replaces header malformed, dialog tags wrong.

---

## UI control visibility

**File:** `www/app/ui/callControls.js`

Listens to `dual-session:state-changed` CustomEvent. Updates button visibility:

```
detail.hasPrimary && !detail.hasSecondary:
  → Show: Hold, Add Call, DTMF, Mute
  → Hide: Swap, Conference

detail.hasDual (both sessions active):
  → Show: Swap, Conference, DTMF, Mute
  → Hide: Hold (replaced by Swap), Add Call
```

The Swap button icon reflects the active/held state via `dual-session:hold-changed` event.

---

## Events emitted

| Event | When | Detail |
|---|---|---|
| `dual-session:state-changed` | On any session add/remove/swap/conference | `{hasPrimary, hasSecondary, hasDual, canSwap, canConference, primaryOnHold, secondaryOnHold}` |
| `dual-session:hold-changed` | After swap completes | none (UI re-reads hold state from manager) |
| `sip:hold-state` | From sipHold.js on each hold/unhold | `{active, pending}` |

---

## Fragile areas and warnings

### Dialog tag access (_dialog)
`conference()` accesses `session._dialog` — a private/internal SIP.js property. If SIP.js is updated, verify this property still exists. If it breaks, REFER will fail to build valid Replaces headers.

### Swap concurrency
`swap()` runs both `setSIPHold` calls in parallel with `Promise.all`. If one fails, hold states may be inconsistent. If this happens, the UI hold state will be wrong — a bug, not a crash. `holdState.pending` in `sipHold.js` prevents double-hold on the same session.

### reset() must be called on clean teardown
If `reset()` is not called after both sessions end, `dualSessionManager` retains stale references. The next call will find `primary` pointing to a terminated session. `removeSession()` handles this in the normal flow — but if a session terminates without going through `removeSession` (e.g., connection drop), call `reset()` as a fallback.

---

## Debugging

| Symptom | Check |
|---|---|
| Add Call button not appearing | `canAddCall()` result, `primary.session` state |
| Add Call puts primary on hold but second call fails | `setSIPHold` on primary, outgoing INVITE error code |
| Second call doesn't appear in UI | `setSecondary()` called, `emitStateChange()` fired, UI listener |
| Swap doesn't switch audio | `setSIPHold` on both sessions, `sipHold.js` post-unhold recovery |
| Conference button does nothing | `hasDualSessions()`, `getHeldSession()` null |
| Conference REFER rejected | `_dialog` access, Replaces header format, FusionPBX transfer config |
| After hangup, second call goes silent | `removeSession` promotion working? Primary promoted from secondary? |
| Hold/unhold state out of sync | `primaryOnHold`/`secondaryOnHold` vs `holdState.active` in `sipHold.js` |
