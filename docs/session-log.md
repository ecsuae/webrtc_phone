# session-log.md

# Session Log

This file is append-only.
Use one line per event.
Keep entries short and factual.

Format:
`YYYY-MM-DD HH:MM PKT | TYPE | TASK-ID | short message | AI: Name`

Allowed TYPE values:
- START
- NOTE
- CHANGE
- VERIFY
- BLOCKED
- STOP

Examples:
- `2026-03-30 09:10 PKT | START  | TASK-018 | Verify correlated export for both call legs | AI: ChatGPT`
- `2026-03-30 09:18 PKT | NOTE   | TASK-018 | Previous AI claimed export routes exist but not yet runtime-proven | AI: ChatGPT`
- `2026-03-30 09:42 PKT | CHANGE | TASK-018 | Added corrId-first export bundling in callLogExport.js | AI: ChatGPT`
- `2026-03-30 09:55 PKT | VERIFY | TASK-018 | export.json returns one bundle with both SIP Call-IDs | AI: ChatGPT`
- `2026-03-30 10:02 PKT | STOP   | TASK-018 | Session end | worked 52m | AI: ChatGPT`

---

2026-03-30 09:10 PKT | START  | TASK-018 | Verify and fix correlated export for both call legs | AI: ChatGPT
2026-03-30 09:15 PKT | NOTE   | TASK-018 | Project state carried forward: PKT timezone fixed, Android stale-module issue fixed, corrId-first correlation required | AI: ChatGPT
2026-03-30 09:20 PKT | NOTE   | TASK-018 | Current likely real issue remains LTE receive-side media failure; export must be verified before RTP/Kamailio changes | AI: ChatGPT
2026-03-30 09:30 PKT | BLOCKED| TASK-018 | Fresh-session code/runtime verification not completed yet in accessible environment | AI: ChatGPT
2026-03-30 09:35 PKT | STOP   | TASK-018 | Session end | worked 25m | AI: ChatGPT
2026-03-30 09:50 PKT | START  | TASK-018 | Add export workflow: export latest correlated call for caller username/ext | AI: Cascade
2026-03-30 09:57 PKT | CHANGE | TASK-018 | Added /admin/calllogs/latest/export.(json|csv) routes + UI buttons; corrId-first bundle export | AI: Cascade
2026-03-30 10:02 PKT | CHANGE | TASK-018 | Fixed admin username/domain filtering to match either event.username or AOR local-part/domain | AI: Cascade
2026-03-30 10:05 PKT | BLOCKED| TASK-018 | Runtime verification blocked: current buffer contains only call-log-post-flush-ok events with no identity/corrId; need one real call to verify export returns correlated bundle | AI: Cascade
2026-03-30 10:20 PKT | START  | TASK-018 | Add export workflow: export latest correlated call for caller+receiver pair | AI: Cascade
2026-03-30 10:23 PKT | CHANGE | TASK-018 | Added /admin/calllogs/latest-pair/export.(json|csv) routes (caller+receiver) and UI inputs/buttons on /admin/calllogs | AI: Cascade
2026-03-30 10:24 PKT | NOTE   | TASK-018 | callLogPage.js remains >200 lines (pre-existing monolith); kept changes minimal to avoid risky refactor during export fix | AI: Cascade
2026-03-30 10:25 PKT | BLOCKED| TASK-018 | Runtime verify pending: /admin/calllogs/latest-pair/export.json?caller=900900&receiver=600600 returns 404 until a fresh 900900↔600600 correlated call exists in in-memory buffer | AI: Cascade
2026-03-30 10:50 PKT | START  | TASK-018 | Fix export-only caller/receiver controls and add dedicated latest-caller/latest-receiver routes | AI: Cascade
2026-03-30 10:56 PKT | CHANGE | TASK-018 | Separated export controls from list filters: exportCaller/exportReceiver no longer affect visible log filtering; added separate Export section with 3 export actions | AI: Cascade
2026-03-30 11:02 PKT | CHANGE | TASK-018 | Added /admin/calllogs/latest-caller and /admin/calllogs/latest-receiver export routes; improved identity matching to include peer/peerAor (corrId-first, callId fallback) | AI: Cascade
2026-03-30 11:05 PKT | CHANGE | TASK-018 | push-server rebuilt/restarted to load new routes/UI | AI: Cascade
2026-03-30 11:06 PKT | BLOCKED| TASK-018 | Runtime verification pending until a fresh 900900↔600600 call exists in in-memory buffer; exports currently return 404 when no matching correlated call present | AI: Cascade
2026-03-30 11:20 PKT | CHANGE | TASK-018 | Fixed Export panel: Update export fields is now JS-only (no GET submit/navigation), updates export button URLs in-place so visible logs do not disappear | AI: Cascade
2026-03-30 11:22 PKT | CHANGE | TASK-018 | push-server rebuilt/restarted to load Export panel JS-only update behavior | AI: Cascade
2026-03-30 11:23 PKT | BLOCKED| TASK-018 | Runtime verification still pending until a fresh 900900↔600600 call exists in in-memory buffer; export routes return 404 when no matching correlated call present | AI: Cascade
2026-03-30 12:05 PKT | START  | TASK-018 | Fix caller/receiver visible filtering; simplify latest export UI; add PDF exports | AI: Cascade
2026-03-30 12:15 PKT | CHANGE | TASK-018 | Added visible-list caller/receiver filters (corrId-first group matching across local+peer identity) so filtering does not incorrectly empty the table | AI: Cascade
2026-03-30 12:25 PKT | CHANGE | TASK-018 | Simplified latest exports UI: one Export action per scope with format selector (JSON/CSV/PDF) | AI: Cascade
2026-03-30 12:30 PKT | CHANGE | TASK-018 | Added latest-caller/latest-receiver/latest-pair PDF export routes using server-side pdfkit renderer | AI: Cascade
2026-03-30 12:32 PKT | CHANGE | TASK-018 | push-server rebuilt/restarted to load caller/receiver filtering + PDF export routes + simplified export UI | AI: Cascade
2026-03-30 12:34 PKT | BLOCKED| TASK-018 | Full export correctness still pending until a fresh 900900↔600600 call exists in in-memory buffer; PDF endpoints return 404 when no matching correlated call present | AI: Cascade
2026-03-30 12:45 PKT | START  | TASK-018 | Fix PDF export truncation: ensure PDF includes full correlated call timeline with pagination | AI: Cascade
2026-03-30 12:52 PKT | CHANGE | TASK-018 | Fixed PDF pagination/wrapping using height-based page breaks + reprint table header per page; PDF now sorts events chronologically like JSON | AI: Cascade
2026-03-30 12:53 PKT | CHANGE | TASK-018 | push-server rebuilt/restarted to load PDF pagination fix | AI: Cascade
2026-03-30 12:55 PKT | BLOCKED| TASK-018 | Runtime verification still pending: container callLogStore currently has 0 events; need fresh 900900↔600600 call then re-export PDF/JSON and compare eventCount + included rows | AI: Cascade
2026-03-30 13:20 PKT | START  | TASK-018 | Fix PDF export content: render human-useful summary view (stage/aor/profile/candSummary) and suppress noisy flush-ok spam | AI: Cascade
2026-03-30 13:30 PKT | CHANGE | TASK-018 | Updated PDF renderer to use summary-style milestone filtering + derived PROBLEM rows; suppress call-log-post-flush-ok; include stage/aor/profile/call-id/candSummary columns | AI: Cascade
2026-03-30 13:31 PKT | CHANGE | TASK-018 | Increased in-memory call log ring buffer capacity to reduce losing one leg in exports when flush-ok noise is high | AI: Cascade
2026-03-30 13:32 PKT | CHANGE | TASK-018 | push-server rebuilt/restarted to load human-summary PDF + larger call log buffer | AI: Cascade
2026-03-30 13:33 PKT | BLOCKED| TASK-018 | Live verification pending: place fresh 900900↔600600 call, then compare /admin/calllogs summary view vs latest-pair PDF export for included rows and both legs | AI: Cascade
2026-03-30 11:37 PKT | START  | TASK-019 | Investigate LTE relay mismatch / DTLS connecting using existing runtime evidence; inspect selected-pair diagnostics | AI: Cascade
2026-03-30 11:55 PKT | CHANGE | TASK-019 | Reduced false selected-pair-relay-mismatch: require only localCandidateType=relay when icePolicy=relay; use st.selectedProfile for outbound diag context instead of current toggle | AI: Cascade
2026-03-30 11:57 PKT | NOTE   | TASK-019 | CoTURN config shows external-ip and relay-ip set to public IP; TURN TCP/TLS disconnects/timeouts seen earlier may still be relevant for real LTE DTLS connecting failures | AI: Cascade
2026-03-30 12:00 PKT | STOP   | TASK-019 | Session end | worked 23m | AI: Cascade
2026-03-30 15:20 PKT | START  | TASK-018 | Fix latest exports: identity matching (peer/peerAor + sip:/tel: normalization) and ensure pair export includes both legs under corrId | AI: Cascade
2026-03-30 15:32 PKT | CHANGE | TASK-018 | Updated latest-caller/latest-receiver/latest-pair export selection: normalize identities (sip:/tel:/<>/; params), match across local+peer fields, and expand selected dataset by corrId when present so both SIP Call-ID legs export together | AI: Cascade
2026-03-30 15:35 PKT | CHANGE | TASK-018 | Rewrote PDF renderer to use real fixed-width table cells with per-column wrapping + row-height pagination (no more monospaced padded line wrap mangling) | AI: Cascade
2026-03-30 15:36 PKT | CHANGE | TASK-018 | push-server rebuilt/restarted to load export matching fixes + PDF table layout rewrite | AI: Cascade
2026-03-30 15:37 PKT | BLOCKED| TASK-018 | Runtime verification pending: container callLogStore currently empty; place fresh 900900↔600600 call then verify caller/receiver/pair exports in JSON/CSV/PDF against on-screen /admin/calllogs | AI: Cascade
2026-03-30 11:45 PKT | START  | TASK-020 | Restore frontend bootstrap: fix missing named export handleIncomingCallIsolated breaking desktop+Android login | AI: Cascade
2026-03-30 11:48 PKT | CHANGE | TASK-020 | Added compatibility export handleIncomingCallIsolated as alias to handleIncomingCall in www/app/incoming/handlers.js | AI: Cascade
2026-03-30 11:50 PKT | VERIFY | TASK-020 | Verified nginx-served /app/incoming/handlers.js includes export async function handleIncomingCallIsolated (curl inside container) | AI: Cascade
2026-03-30 11:52 PKT | STOP   | TASK-020 | Session end | worked 7m | AI: Cascade
2026-03-30 12:06 PKT | START  | TASK-021 | Investigate LTE↔Wi-Fi one-way audio: ICE connected but LTE DTLS stuck connecting / recv=0; inspect Kamailio/RTPEngine ext-to-ext bridge negotiation | AI: Cascade
2026-03-30 12:10 PKT | NOTE   | TASK-021 | Proven call logs show: Wi-Fi sent RTP>0 recv=0; LTE inbound RTP=0; LTE DTLS connecting while ICE connected; both legs established | AI: Cascade
2026-03-30 12:14 PKT | CHANGE | TASK-021 | Kamailio MEDIA_OFFER/MEDIA_ANSWER ext-to-ext bridge: explicitly set RTP/SAVPF + rtcp-mux=offer + codec-mask=PCMA/PCMU to stabilize DTLS/SRTP negotiation | AI: Cascade
2026-03-30 12:15 PKT | NOTE   | TASK-021 | Restart required: kamailio container must reload updated routes/60-media.cfg for change to take effect | AI: Cascade
2026-03-31 03:10 PKT | START  | TASK-022 | Android Enable Calls regression: click triggers runOneTapEnableFlow but explicit enable flag not applied before Android registration gate | AI: Cascade
2026-03-31 03:18 PKT | CHANGE | TASK-022 | Android registration now loads registerFlow.js with runtime cb token via dynamic import to prevent stale cached module (no pinned ?v= imports) | AI: Cascade
2026-03-31 03:19 PKT | BLOCKED| TASK-022 | Runtime verification pending: require Android hard refresh / clear site data then confirm enabled_session=true and registration proceeds on Enable Calls click | AI: Cascade
2026-03-31 03:25 PKT | NOTE   | TASK-022 | Proven: REGISTER reaches Kamailio over WS; PBX sends 401; Kamailio receives 401 but fails to relay promptly to WS client (REG-RELAY-FAILED / relay=0) | AI: Cascade
2026-03-31 03:28 PKT | CHANGE | TASK-022 | Increased Kamailio websocket keepalive_timeout to reduce WS disconnect before delayed PBX REGISTER replies can be relayed | AI: Cascade
2026-03-31 03:29 PKT | NOTE   | TASK-022 | Restart required: kamailio must reload kamailio.cfg | AI: Cascade
2026-03-31 03:55 PKT | START  | TASK-022 | Registration isolation step 2: extract pure registration config builder (UA/Registerer options) | AI: Cascade
2026-03-31 04:05 PKT | CHANGE | TASK-022 | Added www/app/registration/registrationConfig.js and wired primary.js to use buildRegistrationConfig() (pure config only; UA/Registerer creation remains in primary.js) | AI: Cascade
2026-03-31 04:06 PKT | NOTE   | TASK-022 | Verification pending: run one desktop + Android Enable Calls login to confirm no registration behavior change | AI: Cascade
2026-03-31 04:15 PKT | START  | TASK-022 | Registration isolation step 3: extract registration execution service (UA/Registerer lifecycle) | AI: Cascade
2026-03-31 04:25 PKT | CHANGE | TASK-022 | Added www/app/registration/registrationService.js and wired primary.js + sipRegister.js to use it for UA start/register and unregister/stop lifecycle | AI: Cascade
2026-03-31 04:26 PKT | NOTE   | TASK-022 | Verification pending: run one desktop + Android Enable Calls login to confirm no registration behavior change | AI: Cascade
2026-03-31 04:30 PKT | START  | TASK-022 | Registration isolation step 4: extract Enable/Disable Calls actions | AI: Cascade
2026-03-31 04:40 PKT | CHANGE | TASK-022 | Added www/app/registration/registrationActions.js and made runtime/registerFlow.js delegate runOneTapEnableFlow to actions.enableCalls (behavior preserved) | AI: Cascade
2026-03-31 04:41 PKT | NOTE   | TASK-022 | Verification pending: run one desktop + Android Enable Calls login to confirm no registration behavior change | AI: Cascade
2026-03-31 04:50 PKT | START  | TASK-022 | Registration isolation step 5: extract registration event bridge (transport/registerer normalization) | AI: Cascade
2026-03-31 05:05 PKT | CHANGE | TASK-022 | Added www/app/registration/registrationEvents.js and wired primary.js to use attachTransportEvents/createRegistererDelegate/attachRegistererStateEvents | AI: Cascade
2026-03-31 05:06 PKT | NOTE   | TASK-022 | Verification pending: run one desktop + Android Enable Calls login to confirm no registration behavior change | AI: Cascade
2026-03-31 05:10 PKT | START  | TASK-022 | Registration isolation step 6: extract registration UI bindings (Enable/Stop button wiring) | AI: Cascade
2026-03-31 05:20 PKT | CHANGE | TASK-022 | Added www/app/registration/registrationUiBindings.js and wired runtime/controlBindings.js to call bindRegistrationUiHandlers() for Enable/Stop wiring | AI: Cascade
2026-03-31 05:21 PKT | NOTE   | TASK-022 | Verification pending: run one desktop + Android Enable Calls login to confirm no registration behavior change | AI: Cascade
2026-03-31 05:30 PKT | START  | TASK-022 | Thin Android registration bridge cleanup: call shared registrationActions via cb-safe dynamic import (no duplicate enable flow ownership) | AI: Cascade
2026-03-31 05:35 PKT | CHANGE | TASK-022 | Android wrapper now dynamically imports registrationActions.js (cb token) and calls actions.enableCalls(); guard + diagnostics preserved | AI: Cascade
2026-03-31 05:36 PKT | NOTE   | TASK-022 | Verification pending: run one desktop + Android Enable Calls login to confirm no registration behavior change | AI: Cascade
2026-03-31 05:55 PKT | START  | TASK-022 | Registration cleanup pass: remove dead old registration code paths proven unused | AI: Cascade
2026-03-31 06:05 PKT | CHANGE | TASK-022 | Removed dead disabled secondary SBC registration entrypoint registerWithSBC (kept stopSecondaryRegistration used on logout) | AI: Cascade
2026-03-31 06:06 PKT | NOTE   | TASK-022 | Verification pending: desktop+Android Enable Calls and Stop/Logoff to confirm behavior unchanged | AI: Cascade
2026-03-31 06:45 PKT | START  | TASK-023 | Isolate call log classification + diagnosis so feature-code/echo/IVR calls are not misdiagnosed as one-way audio/missing leg | AI: Cascade
2026-03-31 06:55 PKT | CHANGE | TASK-023 | Added dedicated callClassification + callDiagnosis modules; gated peer-only missing-leg/LTE-receive/one-way-audio rules to callClass=peer in admin summary and PDF summary | AI: Cascade
2026-03-31 06:56 PKT | BLOCKED| TASK-023 | Runtime verification pending: need exported *9196 echo trace (corrId/callId JSON) to confirm false PROBLEM rows suppressed | AI: Cascade
2026-03-31 07:05 PKT | NOTE   | TASK-023 | After restart/re-test, *9196 no longer shows false one-way-audio/LTE-no-receive but still showed false PROBLEM: missing leg | AI: Cascade
2026-03-31 07:10 PKT | CHANGE | TASK-023 | Fixed remaining missing-leg emitter: admin applySummaryTransforms incomplete-observability injection now gated by callClassAllowsMissingLeg(callClass) | AI: Cascade
2026-03-31 07:11 PKT | NOTE   | TASK-023 | Restart required: push-server rebuild to load updated callLogPage.js; then re-test *9196 summary missing-leg is gone | AI: Cascade
2026-03-31 07:20 PKT | NOTE   | TASK-023 | New proven symptom on *9196: ICE/DTLS connected, remote-audio-play-ok, but recv RTP stays 0 while sent RTP > 0 (no echo return audio) | AI: Cascade
2026-03-31 07:22 PKT | CHANGE | TASK-023 | Tightened call classification: treat short numeric peer targets (e.g. 9196) as feature-code/service when local user looks like an extension; suppress peer-only PROBLEM rows in summary for service calls | AI: Cascade
2026-03-31 07:25 PKT | START  | TASK-024 | Restore in-call RX/TX packet indicators (live bars/counters) | AI: Cascade
2026-03-31 07:35 PKT | CHANGE | TASK-024 | Added rtpIndicators DOM to dialpad layout and bound a minimal getStats poller to update RX/TX pkt/s bars during active call | AI: Cascade