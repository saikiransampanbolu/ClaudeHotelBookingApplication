# Code Review (Step 6)

Self-review of the implementation against the capstone checklist, using the `code-reviewer` agent's rubric.

| Area | Result | Evidence / action |
|------|--------|-------------------|
| **Correctness** | Pass | Every FR-01…FR-16 has a test (see verification.md traceability). Price, refund tiers and DST deadline math are unit-tested. |
| **Security** | Pass with notes | Parameterised SQL everywhere; strict validators; bcrypt (cost 12); session tokens stored as SHA-256; HttpOnly + SameSite=Lax cookie; JSON-only admin writes; identical 404 for wrong code/email; card number never persisted (test greps the DB). **Fixed during review:** CSP dropped `'unsafe-inline'`; `trust proxy` no longer hard-coded (was IP-spoofable for rate limits) — now opt-in via `TRUST_PROXY`. |
| **Error handling** | Pass | Declined card → 402 and no rows; lost race → auto-refund + 409; malformed JSON → 400; unknown route → JSON 404; email failure never fails a booking; central error handler hides stack traces. |
| **Test coverage** | Pass | 38 tests: happy paths plus not-found, wrong email, missing fields, declined card, sold out, double cancel, forbidden roles, rate limits, concurrency. |
| **Code clarity** | Pass | Services are small and named by behaviour; assumptions only in `config.js`. |
| **DRY** | Pass with notes | Reviewer found the duplicated lookup in routes → `find()` helper; booking row mapping centralised in `toBooking`. Remaining: client forms repeat field-state boilerplate (acceptable for MVP). |
| **Dependency safety** | **Fixed** | `npm audit` initially reported 4 vulnerabilities (esbuild/vite dev server, react-router). Upgraded to Vite 7 + React Router 7; audit now reports **0**. |

## Findings carried forward (not fixed in MVP)
| # | Severity | Item |
|---|----------|------|
| R1 | Medium | Rate limiter is in-memory (single instance). Use a shared store when scaled out. |
| R2 | Medium | Modify booking keeps the booked nightly rate and does not adjust the payment or email the guest. |
| R3 | Low | Admin booking list loads the latest 500 and filters in memory; add SQL search/pagination for larger volumes. |
| R4 | Low | A new `guests` row is created per booking (no de-duplication) — simplifies privacy deletion but duplicates repeat guests. |
| R5 | Low | No CAPTCHA/bot protection on public booking endpoint. |
| R6 | Low | No browser-automation E2E suite; the guest flow and admin sign-in/calendar were exercised manually in the browser. |
| R7 | Info | Formal WCAG audit not run; labels, focus, contrast and keyboard paths were built in but unverified with a tool. |
