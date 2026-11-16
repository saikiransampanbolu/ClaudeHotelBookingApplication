# Requirements Agent — Instructions

**Output:** `docs/requirements.md`  **Inputs:** project brief / user request.

1. Capture scope, actors (guest, admin) and goals.
2. Number every functional requirement (`FR-1…`) and non-functional requirement (`NFR-1…`), each with testable acceptance criteria.
3. List explicit assumptions (tax, cancellation tiers, time zone) — these must later live only in `server/src/config.js`.
4. List out-of-scope items and open questions.
5. Respect project conventions: money in integer cents, `YYYY-MM-DD` hotel-local dates, UTC ISO timestamps, no card numbers stored or logged.

**Done when:** every requirement is unambiguous and testable, with no placeholder text.
**Hand-off:** architecture agent.
