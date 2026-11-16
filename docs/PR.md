# PR: Hotel Booking App MVP 1.0

## Summary
Implements the Hotel Booking App MVP from the PRD: guests search availability, book and pay (simulated), receive a booking code by email, and look up or cancel bookings; hotel staff manage room types, prices, rooms, and reservations through a calendar and booking tools. Double booking is prevented at the database level and verified by a concurrent-booking test. Delivered through the full agentic SDLC (requirements → architecture → design review → plan → implementation → review → verification).

## Changes Made
- `docs/requirements.md`, `architecture.md`, `design-review.md`, `impl-plan.md`, `review.md`, `verification.md` — SDLC artifacts; open PRD questions resolved as documented, configurable assumptions.
- `server/src/db.js`, `seed.js`, `config.js` — schema (incl. `booking_nights` UNIQUE guard), seed data, single place for assumptions.
- `server/src/services/*` — availability, pricing, cancellation/refund, bookings (create/cancel/modify/anonymise), room types, reports, auth.
- `server/src/adapters/*` — simulated payment provider and outbox mailer behind swappable interfaces.
- `server/src/app.js`, `lib/*` — Express routes, validation, error handling, security headers, rate limiting.
- `server/test/*` — 38 unit, API-integration and concurrency tests.
- `client/*` — React + Vite SPA: guest screens and admin screens, mobile-first accessible CSS.
- `.claude/agents`, `.claude/skills/sdlc-step`, `.claude/hooks/guard.mjs`, `.claude/settings.json`, `CLAUDE.md` — Claude agents, skill, secret-guard hook and project memory.
- `README.md`, `CHANGELOG.md`, `.env.example`, root/workspace `package.json`.

## Test Evidence
```
$ npm test
✔ FR-09 login: wrong password, unknown user, and unauthenticated access are rejected (94.1077ms)
✔ FR-09 session cookie is HttpOnly and token is stored hashed (64.722ms)
✔ passwords are stored as bcrypt hashes (0.4333ms)
✔ admin writes require application/json (CSRF hardening) (1.6911ms)
✔ login is rate limited (29.89ms)
✔ FR-10 admin creates, edits and deactivates room types; staff cannot (161.0982ms)
✔ out-of-order rooms are not sold; rooms with bookings cannot be deleted (177.8959ms)
✔ FR-11/16 calendar and dashboard show bookings (78.8274ms)
✔ FR-12 admin creates a booking on behalf of a guest (offline payment, no card) (16.9597ms)
✔ FR-15 modify booking re-checks availability atomically (192.1985ms)
✔ admin cancel refunds in full and frees nights; unknown id is 404 (96.0028ms)
✔ privacy: anonymize removes PII, admin only (47.6879ms)
✔ concurrent bookings never exceed inventory; losers are refunded (121.9372ms)
✔ database itself rejects a second booking of the same room-night (44.1054ms)
✔ NFR performance smoke: 50 concurrent searches finish well under 2 s (50.9678ms)
✔ health and hotel info (38.2927ms)
✔ FR-01 search rejects invalid input with 400 (36.7501ms)
✔ FR-02/03 search returns fitting types with price breakdown (18.4224ms)
✔ room type detail: public data only; unknown id is 404 (32.1804ms)
✔ FR-04 booking with missing/invalid guest fields is rejected before payment (9.7396ms)
✔ booking: guest requesting more than max guests / unknown room type (21.539ms)
✔ FR-05 declined card creates no booking and no nights (49.1526ms)
✔ FR-06 happy path: booking code, payment record and confirmation email (34.1428ms)
✔ FR-02/13 booked nights are unavailable; adjacent dates are not (141.0756ms)
✔ FR-07 lookup: wrong code / wrong email give the same 404 (64.4339ms)
✔ FR-07/08/14 cancel: refund tier, nights freed, email sent, no double cancel (65.7814ms)
✔ FR-08 partial and zero refunds near check-in (131.8622ms)
✔ malformed JSON and unknown routes return JSON errors (29.1133ms)
✔ lookup endpoint is rate limited (47.3463ms)
✔ isDate accepts real dates only (1.389ms)
✔ date arithmetic and nights (check-out night excluded) (0.4754ms)
✔ todayIn uses hotel-local calendar day (10.9626ms)
✔ zonedToUtc handles standard time and DST (0.813ms)
✔ FR-03 price breakdown in cents (0.1361ms)
✔ FR-08 refund tiers (0.8977ms)
✔ simulated payment: success, decline, and invalid input (72.0366ms)
✔ FR-01 validation rejects bad stays with field errors (1.3211ms)
✔ FR-04 guest validation (0.5115ms)
ℹ tests 38
ℹ pass 38
ℹ fail 0

$ npm run build   -> ✓ built (Vite 7)
$ npm audit       -> found 0 vulnerabilities
```
Manual browser run: guest booking end-to-end (code issued, confirmation shown), staff sign-in failure and success, admin calendar.

## Known Limitations
- Payment and refunds are simulated; email goes to an outbox table (no SMTP).
- Defaults for cancellation policy (100/50/0 at 48h/24h), tax (12%, exclusive), currency (USD) and time zone are **assumptions** for the PRD's open questions — confirm with the product owner.
- No guest accounts or "past bookings" list (lookup by code + email only).
- Booking modification keeps the original nightly rate, does not adjust payment, and sends no email.
- In-memory rate limiter (single instance); admin booking list capped at 500 rows.
- Not verified: 360 px on a real device, Safari/Firefox/Edge, automated WCAG audit, production HTTPS. No Stripe/SMTP integration.

## Reviewer Checklist
- [ ] Read `docs/requirements.md` §1 and confirm or change the assumptions (policy, tax, time zone).
- [ ] `npm install && npm test` passes locally (38 tests).
- [ ] `npm run build` succeeds and `npm audit` reports 0 vulnerabilities.
- [ ] Run the app; complete a booking with card 4242…, then cancel it from "My booking".
- [ ] Confirm the declined card (4000 0000 0000 0002) creates no booking.
- [ ] Sign in as admin; create a room type, add a room, see the booking on the calendar.
- [ ] Confirm staff role cannot edit room types (403).
- [ ] Review `booking_nights` UNIQUE constraint and the concurrency test for FR-13.
- [ ] Check no secrets or card numbers appear in code, logs or DB.
- [ ] Accept or log the limitations above.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
