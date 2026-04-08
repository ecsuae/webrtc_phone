# NOW

## Current task
TASK-029 — frontend: fix missing inbound raw proof rows in /admin/calllogs (runtime evidence).

## Why this matters
push-server owns push notifications, WireGuard-only admin tooling, and routing-config management. Clear code/config ownership boundaries reduce split-brain risk, keep isolation reversible, and prevent push/admin changes from accidentally coupling into other services.

## Already proven
- push-server is repo-contained under `push-server/` with its own `Dockerfile`, `package.json`, `server.js`, and `src/` modules.
- push-server composes routes via `src/routes/*` and centralizes config reads in `src/config.js`.
- push-server has an explicit admin boundary:
  - a second listener binds `ADMIN_BIND_HOST:ADMIN_BIND_PORT`
  - admin routes are guarded by `requireWireGuardAccess`.
- Isolation step 1 complete: extracted admin timestamp formatting helpers into `push-server/src/admin/timeFormat.js` and updated `callLogPage.js` to import them. (Later consolidated.)
- Isolation step 2 complete: extracted `MEDIA_ERROR_DESCRIPTIONS` into `push-server/src/admin/callLogErrorCatalog.js` and updated `callLogPage.js` to import it.
- Isolation step 3 complete: extracted `SESSION_EVENT_TYPES` into `push-server/src/admin/callLogEventTypeSets.js` and updated `callLogPage.js` to import it.
- Isolation step 4 complete: extracted `SUMMARY_MILESTONE_TYPES` into `push-server/src/admin/callLogMilestoneTypeSets.js` and updated `callLogPage.js` to import it.
- Isolation step 5 complete: extracted `escHtml` into `push-server/src/admin/callLogHtmlEscape.js` and updated `callLogPage.js` to import it. (Later consolidated.)
- Isolation step 6 complete: extracted `corrKey` into `push-server/src/admin/callLogCorrelationKey.js` and updated `callLogPage.js` to import it. (Later consolidated.)
- Isolation step 7 complete: extracted `modeLabel` into `push-server/src/admin/callLogModeLabel.js` and updated `callLogPage.js` to import it. (Later consolidated.)
- Isolation step 8 complete: extracted `buildQueryString` into `push-server/src/admin/callLogQueryString.js` and updated `callLogPage.js` to import it.
- Isolation step 9 complete: extracted `isConcreteCount` into `push-server/src/admin/callLogConcreteCount.js` and updated `callLogPage.js` to import it. (Later consolidated.)
- Isolation step 10 complete: extracted `preflightOkFromCounts` into `push-server/src/admin/callLogPreflightOkFromCounts.js` and updated `callLogPage.js` to import it. (Later consolidated.)
- Isolation step 11 complete: extracted `isPreflightFamily` into `push-server/src/admin/callLogPreflightFamily.js` and updated `callLogPage.js` to import it. (Later consolidated.)
- Isolation step 12 complete: extracted `isSuspiciousStatsEvent` into `push-server/src/admin/callLogSuspiciousStatsEvent.js` and updated `callLogPage.js` to import it. (Later consolidated.)
- Isolation step 13 complete: extracted `mergeIceErrorDetail` into `push-server/src/admin/callLogMergeIceErrorDetail.js` and updated `callLogPage.js` to import it. (Later consolidated.)
- Isolation step 14 complete: extracted `pickBetterCounts` into `push-server/src/admin/callLogPickBetterCounts.js` and updated `callLogPage.js` to import it. (Later consolidated.)
- Isolation step 15 complete: extracted `shouldShowCandSummary` into `push-server/src/admin/callLogShouldShowCandSummary.js` and updated `callLogPage.js` to import it. (Later consolidated.)
- Isolation step 16 complete: extracted `stageLabel` into `push-server/src/admin/callLogStageLabel.js` and updated `callLogPage.js` to import it. (Later consolidated.)
- Isolation step 17 complete: extracted `buildExportLinks` into `push-server/src/admin/callLogExportLinks.js` and updated `callLogPage.js` to import it.
- Isolation step 18 complete: extracted `buildLegSummary` into `push-server/src/admin/callLogLegSummary.js` and updated `callLogPage.js` to import it. (Later consolidated.)
- Isolation step 19 complete: extracted `deriveAsymmetricDirectionDiagnosis` into `push-server/src/admin/callLogAsymmetricDirectionDiagnosis.js` and updated `callLogPage.js` to import it. (Later consolidated.)
- Isolation step 20 complete: extracted `PROBLEM_ROW_TYPES` and `WARN_ROW_TYPES` into `push-server/src/admin/callLogRowTypeSets.js` and updated `callLogPage.js` to import them.
- Isolation step 21 complete: extracted `renderLegSummaryBlock` into `push-server/src/admin/callLogLegSummaryBlock.js` and updated `callLogPage.js` to import it. (Later consolidated.)
- Isolation step 22 complete: extracted `renderMediaDiagnosisBlock` into `push-server/src/admin/callLogMediaDiagnosisBlock.js` and updated `callLogPage.js` to import it. (Later consolidated.)
- Isolation step 23 complete: extracted `buildToggleQsBase` into `push-server/src/admin/callLogToggleQsBase.js` and updated `callLogPage.js` to import it.
- Isolation step 24 complete: extracted `buildTraceDiagHtml` into `push-server/src/admin/callLogTraceDiagHtml.js` and updated `callLogPage.js` to import it. (Later consolidated.)
- Isolation step 25 complete: extracted `deriveViewMode` into `push-server/src/admin/callLogViewMode.js` and updated `callLogPage.js` to import it. (Later consolidated.)
- Isolation step 26 complete: extracted `fmtRenderProofSummary` into `push-server/src/admin/callLogRenderProofSummary.js` and updated `callLogPage.js` to import it. (Later consolidated.)
- Isolation step 27 complete: extracted `fmtPktBits` into `push-server/src/admin/callLogPktBits.js` and updated `callLogPage.js` to import it.
- Isolation step 28 complete: extracted `renderRawPayloadDetails` into `push-server/src/admin/callLogRawPayloadDetails.js` and updated `callLogPage.js` to import it.
- Isolation step 29 complete: extracted `renderStatsAnnotation` into `push-server/src/admin/callLogStatsAnnotation.js` and updated `callLogPage.js` to import it.
- Isolation step 30 complete: consolidated `fmtPktBits`, `renderRawPayloadDetails`, and `renderStatsAnnotation` into `push-server/src/admin/callLogDisplayHelpers.js` and updated `callLogPage.js` imports. (Later consolidated.)
- Isolation step 31 complete: consolidated query/export helpers into `push-server/src/admin/callLogQueryHelpers.js` and updated `callLogPage.js` imports.
- Isolation step 32 complete: consolidated call-log catalogs/type sets into `push-server/src/admin/callLogCatalogs.js` and updated `callLogPage.js` imports.
- Isolation step 33 complete: consolidated trace diagnosis blocks into `push-server/src/admin/callLogTraceDiagBlocks.js` and updated `callLogPage.js` imports. (Later consolidated.)
- Isolation step 34 complete: consolidated call-log label/mode helpers into `push-server/src/admin/callLogLabels.js` and updated `callLogPage.js` imports.
- Isolation step 35 complete: consolidated call-log stats/preflight helpers into `push-server/src/admin/callLogStatsHelpers.js` and updated `callLogPage.js` imports.
- Isolation step 36 complete: consolidated call-log diagnosis helpers into `push-server/src/admin/callLogDiagnosisHelpers.js` and updated `callLogPage.js` / `callLogTraceDiagBlocks.js` imports. (Later consolidated.)
- Isolation step 37 complete: consolidated call-log trace diagnosis helpers into `push-server/src/admin/callLogTraceDiagnosis.js` and updated `callLogPage.js` imports.
- Isolation step 38 complete: consolidated call-log core utilities into `push-server/src/admin/callLogCoreUtils.js` and updated imports.
- Isolation step 39 complete: consolidated call-log display/render helpers into `push-server/src/admin/callLogRenderHelpers.js` and updated `callLogPage.js` imports.
- Isolation step 40 complete: extracted call-log page client-side script block into `push-server/src/admin/callLogClientScript.js` and updated `callLogPage.js` to use it.
- Isolation step 41 complete: extracted call-log event row + table/legend rendering pipeline into `push-server/src/admin/callLogEventTableRender.js` and updated `callLogPage.js` to use it.
- Isolation step 42 complete: extracted call-log summary transform pipeline into `push-server/src/admin/callLogSummaryPrecompute.js` + `push-server/src/admin/callLogSummaryTransforms.js` and updated `callLogPage.js` to use it.
- Isolation step 43 complete: consolidated call-log catalogs + label helpers into `push-server/src/admin/callLogPresentationCatalogs.js` and updated imports.
- Isolation step 44 complete: extracted call-log page layout / header / filter / export / stats rendering into `push-server/src/admin/callLogPageHead.js` + `push-server/src/admin/callLogPageControls.js` and updated `callLogPage.js`.

## Current blocker
- Runtime/browser verification of `/admin/calllogs` is not possible in the current session environment; only code inspection + `node -c` + container + live-route checks have been recorded so far.
- New synthesized summary verdict logic (merged-parent precedence + stable enums + operator-facing conclusion row + stronger child/orphan suppression + inbound-playback-proof-missing row) needs runtime/browser confirmation on real merged calls.
- Summary view must be verified after restart to confirm `/admin/calllogs?view=summary` is using the extracted summary transform pipeline and emits the synthesized rows.
- TASK-028 is being closed because push-server isolation + summary diagnosis work is complete enough for operators.
- Inbound playback-path raw instrumentation proof rows are still missing from runtime raw logs and are explicitly deferred to TASK-029.

## What must not change
- Wi-Fi ↔ Wi-Fi calling
- Registration flow
- Push behavior
- Kamailio ↔ RTPEngine integration

## Files most likely involved
- `push-server/server.js`
- `push-server/src/config.js`
- `push-server/src/middleware/accessControl.js`
- `push-server/src/routes/*`
- `push-server/src/admin/*`

## Exact next safe step
1. Do runtime/browser verification of `/admin/calllogs` (summary view) on a merged-parent + child/orphan call sample to confirm:
   - only the merged parent emits call-level synthesized verdict rows
   - child/orphan synthesized per-leg rows are suppressed once a merged-parent primary summary exists
   - top-level verdict matches current-call evidence (if both legs have `remote-audio-play-ok`, do not emit `possible-playback-path-issue`)
   - the new `call-troubleshooting-conclusion` row reads correctly and is the primary operator-facing takeaway
   - (separately, under TASK-029) inbound raw instrumentation proof rows appear: `inbound-play-attempt`, `inbound-play-resolved`, `inbound-play-rejected`, `inbound-audio-route-snapshot`, `inbound-audio-element-state`, and inbound `receive-render-proof` (when enabled)
2. If runtime/browser verification remains unavailable, keep summary work stable and focus on the frontend-only instrumentation gap under TASK-029.