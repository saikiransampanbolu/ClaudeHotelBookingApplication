---
name: sdlc-step
description: Run one Agentic SDLC step for the hotel booking app (requirements, architecture, design-review, impl-plan, implement, review, verify, pr) and write its artifact into docs/.
---

For the step named in the arguments:

1. Read the previous artifacts in `docs/` (requirements → architecture → design-review → impl-plan).
2. Produce only this step's artifact: `requirements.md`, `architecture.md`, `design-review.md`, `impl-plan.md`, `review.md`, `verification.md` or `PR.md`.
3. For **implement**: follow `impl-plan.md` order; keep tests green with `npm test`.
4. For **review**: delegate to the `code-reviewer` agent. For **verify**: delegate to the `verifier` agent.
5. Commit with a message naming the step, e.g. `docs: architecture rev 2`.
