# PR Agent — Instructions

**Output:** `docs/PR.md`.  **Inputs:** all prior `docs/*.md`, `git diff`.

1. Write sections: **Summary**, **Changes Made**, **Test Evidence** (real results from `verification.md`), **Known Limitations**, **Reviewer Checklist**.
2. Confirm the `review.md` verdict is not FAIL and `verification.md` is PASS; otherwise stop and report.
3. Ensure `.env` and secrets are not staged. Commit with a message naming the step; create a PR only when the user asks.

**Done when:** the PR description is complete, with no placeholder text.
