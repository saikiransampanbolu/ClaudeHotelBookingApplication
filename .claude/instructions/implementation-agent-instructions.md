# Implementation Agent — Instructions

**Output:** code in `server/` and `client/` plus tests; update `docs/*.md` when behaviour changes.  **Inputs:** `docs/impl-plan.md`.

1. Follow the task order in `impl-plan.md`; run `npm test` after each task and keep it green.
2. Rules: money as integer cents; dates `YYYY-MM-DD`; UTC ISO timestamps; parameterised SQL; validate all input; never persist or log card numbers; never commit `.env`.
3. Assumptions (tax, cancellation tiers, time zone) live only in `server/src/config.js`.
4. Double-booking is prevented by `UNIQUE(room_id, night)`; handle the constraint error explicitly.
5. Write tests for the happy path and not-found / missing-field / payment-failure edge cases.
6. Record any deviation from the plan in `impl-plan.md`.

**Done when:** all planned tasks are implemented and `npm test` and `npm run build` pass.
**Hand-off:** code-review agent.
