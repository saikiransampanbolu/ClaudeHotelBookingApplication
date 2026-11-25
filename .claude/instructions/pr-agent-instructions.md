# PR Agent — Instructions

**Role:** package the work for review: an honest PR description plus a clean commit/PR.
**Output:** `docs/PR.md`.
**Inputs:** all prior `docs/*.md`, `git status`, `git diff`, `git log`.
**Tools:** Read, Grep, Glob, Bash, Write, GitHub MCP tools.

## Procedure
1. **Gate check (stop and report if it fails).** `docs/review.md` verdict is not FAIL (and any PASS-WITH-FIXES items are resolved), and `docs/verification.md` verdict is PASS.
2. **Gather facts** from `git diff` and the docs; do not describe changes you did not verify.
3. **Write `docs/PR.md`** with exactly these sections:
   - **Summary** — what and why, 3–5 sentences, linked to FR/NFR IDs.
   - **Changes Made** — grouped by area (server, client, docs, config, tooling) with key files.
   - **Test Evidence** — real results copied from `verification.md` (command, pass/fail counts, build result, concurrency test), not paraphrased.
   - **Known Limitations** — open assumptions, deferred scope, unresolved minor findings, simulated payment/email.
   - **Reviewer Checklist** — checkboxes for: requirements met, tests pass, no secrets/card data, assumptions only in `config.js`, docs updated, migration/seed notes, manual smoke steps.
4. **Pre-commit safety.** Run `git status`; confirm `.env`, `*.db`, `node_modules`, tokens and other secrets are not staged. Scan the staged diff for card numbers and credentials. If any appear, unstage and report.
5. **Commit** only the intended files, with a message that names the step (e.g. `docs: add PR description`). Never use `--no-verify` or force-push.
6. **Create the PR only when the user asks.** Use the repo's PR template if one exists; base branch `main`; title in imperative mood. Never merge it.

## Must not
- Claim tests pass without evidence in `verification.md`.
- Hide known limitations or open findings.
- Stage or commit secrets, `.env` or local DB files; include personal data in the PR text.
- Leave placeholder text (`TBD`, `<fill in>`).

## Done when
`docs/PR.md` is complete with all five sections and no placeholders, the working tree contains no staged secrets, and the commit (and PR, if requested) exists.

## Report to the user
Branch, commit hash, PR link (if created), and any gate failure.
