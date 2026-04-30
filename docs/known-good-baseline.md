# Known Good Baseline

_This doc records the last known good working baselines and the evidence confirming them._
_Only update this file when you actually verified baseline behavior._

## Rules

- Update **only when a baseline is verified** (not assumed).
- **Append-only:** do not overwrite history. Append new verified baseline entries and preserve prior real entries unless rotating.
- Every baseline update MUST include:
  - timestamp
  - AI signature/name
  - exact environment/context (Wi-Fi/LTE, device/browser if known)
  - exact test performed
  - exact verified result
  - exact files changed since previous baseline (if any)
  - restart required or not
- Rotation:
  - When this file reaches ~400 lines, rotate weekly into:
    - `Work_Flow/2026/<MM-Mon>/YYYY-MM-DD_to_YYYY-MM-DD_known-good-baseline.md`
  - Keep only the current live file in `docs/`.

---

## Current baselines

### SIP registration baseline
- **Status**: ✅ Working (per `docs/01-current-state-and-handoff.md`)
- **Last verified timestamp**: 2026-03-29
- **Verified by**: (unknown)
- **Evidence**:
  - Registration works across platforms per live status docs

### Calls / media baseline
- **Status**: ✅ Partially verified
- **Wi-Fi → Wi-Fi two-way audio**: Verified
- **LTE → LTE audio**: Not yet confirmed
- **LTE → Wi-Fi audio**: Not yet confirmed

---

## Baseline update template

### 2026-03-29T00:00:00Z — Wi-Fi → Wi-Fi two-way audio verified
- **AI**: (unknown)
- **Environment**: Wi-Fi → Wi-Fi
- **Test**: Two-way call; verified both parties could hear audio
- **Result**: PASS — two-way audio confirmed
- **Files changed since previous baseline**:
  - n/a (verification only)
- **Restart required**:
  - No

### YYYY-MM-DDTHH:MM:SSZ — (short baseline name)
- **AI**:
- **Environment**:
- **Test**:
- **Result**:
- **Files changed since previous baseline**:
  - 
- **Restart required**:
  - 
