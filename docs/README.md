# docs/ — Documentation Index
**WebRTC SIP Softphone**

---

## Required read order for every new AI session

```
1. docs/ai-working-rules.md              ← ALWAYS first. Standing rules for all AI work.
2. docs/00-project-structure-and-architecture.md   ← Project layout, module map, decisions
3. docs/01-current-state-and-handoff.md  ← Feature status, active issues, warnings
4. docs/[relevant phase doc below]       ← Phase doc for the specific task
```

Do not skip step 1. It defines the rules that govern all work on this project.

---

## Active documentation (source of truth)

| File | Read when |
|---|---|
| [ai-working-rules.md](ai-working-rules.md) | Every session — defines how to work on this project |
| [00-project-structure-and-architecture.md](00-project-structure-and-architecture.md) | Every session — project layout, module map, architectural decisions |
| [01-current-state-and-handoff.md](01-current-state-and-handoff.md) | Every session — current feature status, known issues, in-progress work |
| [02-phase-registration-and-login.md](02-phase-registration-and-login.md) | Working on registration, UA config, transport, auth |
| [03-phase-outgoing-calls.md](03-phase-outgoing-calls.md) | Working on outgoing calls, ringback, early media, hangup |
| [04-phase-incoming-calls.md](04-phase-incoming-calls.md) | Working on incoming calls, phantom gates, answer, reject |
| [05-phase-media-hold-moh-rbt.md](05-phase-media-hold-moh-rbt.md) | Working on audio, codec, hold/unhold, MOH, post-unhold recovery |
| [06-phase-push-notifications.md](06-phase-push-notifications.md) | Working on push, SW, VAPID, mobile wake/recovery |
| [07-phase-kamailio-rtpengine-nginx.md](07-phase-kamailio-rtpengine-nginx.md) | Working on Kamailio, RTPEngine, Nginx, Docker deployment |
| [08-phase-multi-domain-and-env.md](08-phase-multi-domain-and-env.md) | Working on .env config, templates, multi-PBX domains |
| [09-phase-dual-session-and-conference.md](09-phase-dual-session-and-conference.md) | Working on add call, swap, conference, dualSessionManager |

---

## Archive (historical reference only)

Older docs are in [archive/](archive/). They are preserved for historical context on past bugs and decisions. **Do not treat archive files as current architecture** — the code may have changed significantly since they were written.

When an archive file is referenced in active docs, it is linked by name. Do not read archive files before reading the active phase docs — they may contradict the current implementation.

---

## How to update docs after code changes

Per `ai-working-rules.md` Rule 16:
1. **Always** update `01-current-state-and-handoff.md` (recent work section, feature status)
2. Update the relevant phase doc for any changed behavior
3. Update `00-project-structure-and-architecture.md` if files/modules were added or renamed

Do not finish a task with code updated but docs stale.
