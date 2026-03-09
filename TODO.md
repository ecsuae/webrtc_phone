# TODO - Call History SIP Codes & Call Outcome Tracking

- [x] Add SIP reject detail parser in `www/app/log.js` (status/reason + Q.850 Reason header parsing)
- [x] Update `www/app/outgoing/call.js` to map common reject codes to user-friendly messages while preserving protocol detail logs
- [x] Update `www/app/outgoing/addCall.js` with same reject-detail UX logic

- [ ] Extend `www/app/ui/historyActivity.js` model and renderer to include:
  - [ ] call direction/type normalization
  - [ ] sipCode/sipReason/q850Cause/q850Text fields
  - [ ] display SIP code/reason in history group and detail rows
- [ ] Update `www/app/outgoing/call.js` to write history entries on accept/reject with SIP metadata
- [ ] Update `www/app/incoming/handlers.js` to write incoming/missed/rejected/answered history with SIP metadata where available
- [ ] Update `www/app/runtime/controlBindings.js` to avoid premature/duplicate history entries for outgoing calls
- [ ] Run critical-path verification:
  - [ ] Search-based validation for history call sites
  - [ ] Basic static checks (imports/usages)
  - [ ] Summarize expected runtime behavior for incoming/outgoing/missed/rejected with SIP codes
