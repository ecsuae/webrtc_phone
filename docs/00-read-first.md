# 00-read-first.md

# STOP — READ THIS FILE BEFORE ANYTHING ELSE

## Mandatory read order
Read these files first, in this exact order:
1. `docs/ai-working-rules.md`
2. `docs/now.md`
3. `docs/session-log.md`
4. `docs/change-ledger.md`
5. `docs/known-good-baseline.md`

Do not scan the whole repo by default.

---

## Repo workflow rules
- Work only on the current task described in `docs/now.md`
- Do not restart old investigations unless the current task requires it
- Protect already working features
- Make small, safe, isolated changes
- Verify important fixes with runtime evidence when practical
- Update workflow docs before ending the session

---

## Code management rule
- Keep code files small and focused
- Preferred maximum size is **150 to 200 lines per code file**
- If a file grows beyond that, split it into focused modules/files
- Do not keep stuffing more logic into long monolithic files

---

## Documentation rule
Before ending any session:
- append to `docs/session-log.md`
- append to `docs/change-ledger.md` if files changed
- update `docs/now.md`
- update `docs/known-good-baseline.md` only if a baseline was actually verified

---

## Current task pointer
After reading the files above, follow only the active task in `docs/now.md`.