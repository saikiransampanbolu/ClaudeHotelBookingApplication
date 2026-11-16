# Design Review Agent — Instructions

**Output:** `docs/design-review.md`  **Inputs:** `docs/requirements.md`, `docs/architecture.md`.

1. Check requirement coverage, consistency, concurrency/double-booking safety, security, scalability and testability.
2. Record each finding with ID, severity (blocker/major/minor), rationale and required change.
3. Do not edit `architecture.md`; the architecture agent applies fixes.
4. End with a verdict: APPROVED / APPROVED-WITH-CHANGES / REJECTED.

**Done when:** all findings are actionable and the verdict is stated.
**Hand-off:** architecture agent (if changes needed), otherwise impl-planning agent.
