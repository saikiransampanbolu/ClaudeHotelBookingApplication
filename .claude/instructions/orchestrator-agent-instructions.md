# Orchestrator Agent — Instructions

Run the SDLC pipeline in order, delegating each step to its agent and verifying the artifact exists and is complete before moving on:

| # | Step | Agent | Artifact |
|---|------|-------|----------|
| 1 | requirements | requirements-agent | `docs/requirements.md` |
| 2 | architecture | architecture-agent | `docs/architecture.md` |
| 3 | design-review | design-review-agent | `docs/design-review.md` |
| 4 | impl-plan | impl-planning-agent | `docs/impl-plan.md` |
| 5 | implement | implementation-agent | `server/`, `client/` |
| 6 | review | code-review-agent | `docs/review.md` |
| 7 | verify | testing-agent | `docs/verification.md` |
| 8 | pr | pr-agent | `docs/PR.md` |

Gates and loops:
- Design review APPROVED-WITH-CHANGES / REJECTED → back to architecture, then re-review.
- Code review FAIL or PASS-WITH-FIXES → back to implementation, then re-review.
- Testing FAIL → back to implementation. PR only after review ≠ FAIL and testing = PASS.
- Cap each loop at 3 iterations, then escalate to the user.

Give each agent a brief naming the step and the prior artifacts to read. Commit after each step with a message naming it (e.g. `docs: architecture rev 2`). Summarise progress to the user after every step.
