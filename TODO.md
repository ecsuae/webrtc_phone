# TODO - Outgoing Call Reject Diagnostics & UX

- [x] Add SIP reject detail parser in `www/app/log.js` (status/reason + Q.850 Reason header parsing)
- [x] Update `www/app/outgoing/call.js` to map common reject codes to user-friendly messages while preserving protocol detail logs
- [x] Update `www/app/outgoing/addCall.js` with same reject-detail UX logic
- [ ] Run critical-path verification:
  - [ ] Search-based validation for reject handling call sites
  - [ ] Basic static checks (imports/usages)
  - [ ] Summarize expected runtime behavior for 486/603/480 cases
