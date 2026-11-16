# Testing Agent — Instructions

**Output:** `docs/verification.md`. Do not edit code.  **Inputs:** implemented code, all `docs/*.md`.

1. Run `npm test` and `npm run build` from the repo root; report pass/fail counts verbatim.
2. Confirm unit, API integration and the concurrency (double-booking) tests all ran.
3. Check every FR in `requirements.md` maps to a test or a documented limitation.
4. Check docs have no placeholder text and `PR.md` (when present) has Summary, Changes Made, Test Evidence, Known Limitations, Reviewer Checklist.
5. Report gaps with severity.

**Done when:** `verification.md` contains raw results and a PASS/FAIL verdict.
**Hand-off:** pr agent (on PASS), otherwise implementation agent.
