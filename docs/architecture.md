# Architecture — Hotel Booking App (MVP 1.0)

Derived from [requirements.md](requirements.md). Revision 2 (updated after [design-review.md](design-review.md)).

## 1. Style
Single deployable: a Node.js **Express REST API** that also serves the built **React (Vite) SPA**. One SQLite database file (PostgreSQL-compatible SQL; swap-able via the `db` module). Chosen for a one-property MVP: few moving parts, zero native dependencies (`node:sqlite`, Node ≥ 22).

```
 Browser (React SPA)
   │  JSON over HTTPS, cookie session for /api/admin/*
   ▼
 ┌──────────────────────── Express app ─────────────────────────┐
 │ middleware: security headers · json · rate-limit · auth/RBAC │
 │ routes/public  routes/admin                                  │
 │        │              │                                      │
 │ services: availability · pricing · booking · cancellation    │
 │           roomTypes · reports · auth                         │
 │        │                                                     │
 │ adapters: PaymentProvider (simulated) · Mailer (outbox)      │
 └────────┬─────────────────────────────────────────────────────┘
          ▼
   SQLite (WAL)  hotel · room_types · rooms · guests · bookings
                 booking_nights (UNIQUE room_id+night) · payments
                 staff_users · sessions · emails
```

## 2. Components and responsibilities
| Component | Responsibility |
|-----------|----------------|
| `db.js` | Open DB, schema migration, `tx()` helper using `BEGIN IMMEDIATE`. |
| `config.js` | Tax rate, policy tiers, time zone, limits (single source for assumptions). |
| `lib/dates.js` | Strict `YYYY-MM-DD` parsing, night enumeration, hotel-local "today", policy deadline math. |
| `services/pricing.js` | Pure price breakdown in integer cents. |
| `services/availability.js` | Which rooms of each type are free for all nights; search. |
| `services/cancellation.js` | Pure refund-tier calculation. |
| `services/bookings.js` | Create (quote → pay → reserve), lookup, cancel, modify, admin create, anonymise. |
| `services/roomTypes.js` | Admin CRUD of room types and rooms. |
| `services/reports.js` | Calendar, dashboard. |
| `services/auth.js` | bcrypt verify, session create/destroy, RBAC middleware. |
| `adapters/payment.js` | `charge()` / `refund()` — simulated provider; never stores PAN. |
| `adapters/mailer.js` | Render + store emails (outbox), log. |
| `client/` | Guest flow pages, My Booking, Admin pages; mobile-first CSS. |

## 3. Key data flows
**Search** → validate → `availability.search` (SQL: rooms of active types not present in `booking_nights` for any requested night) → pricing per type.

**Booking** (the critical path):
1. Validate input; recompute price server-side (client totals are ignored).
2. Pre-check availability (fast fail, no lock).
3. `payment.charge()` — outside the DB transaction (no DB lock held during a network call).
4. `tx(BEGIN IMMEDIATE)`: pick a free room, insert `bookings`, insert one `booking_nights` row per night (UNIQUE `room_id, night`), insert `payments`.
5. If step 4 fails (lost race): `payment.refund()` automatically, return 409. 
6. After commit: send confirmation email (failure is logged, never fails the booking).

**Cancel**: lookup by code+email → compute refund tier from hotel-local deadline → in one tx set status `cancelled`, **delete** `booking_nights` rows (frees the nights), record refund → email.

## 4. Technology choices
| Concern | Choice | Reason |
|---------|--------|--------|
| Runtime | Node 24, ESM | Available locally, built-in SQLite + test runner |
| API | Express 4 | PRD suggestion |
| DB | `node:sqlite` | No native build; schema is portable to PostgreSQL |
| Frontend | React 18 + Vite + React Router, plain CSS | PRD suggestion, small bundle |
| Passwords | `bcryptjs` cost 12 | PRD (bcrypt/Argon2), pure JS |
| Tests | `node:test` + `supertest`-free `fetch` against ephemeral server | Minimal dependencies |

## 5. Security design
- Parameterised SQL only; strict validators (dates, email, phone, lengths).
- Admin sessions: random 32-byte token, stored hashed (SHA-256) in `sessions`, cookie `HttpOnly; SameSite=Lax; Secure` (prod), 8 h expiry. Mutating admin routes require `Content-Type: application/json` (CSRF mitigation with SameSite).
- Login and booking-lookup rate-limited per IP (in-memory; documented limitation for multi-instance).
- Guest lookup returns identical 404 for wrong code or wrong email (no enumeration); booking codes have 40 bits of entropy from `crypto.randomInt`.
- Card number: only validated in-memory by the simulated provider; only last4 + provider ref persisted.
- Headers: CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, HSTS (prod).
- Secrets via env (`SESSION_SECRET` not needed—tokens are random; `SEED_ADMIN_PASSWORD` for seeding). `.env` is git-ignored and edit-blocked by a Claude hook.

## 6. Time and money
Money = integer cents. Stay dates = local `YYYY-MM-DD` strings; policy deadlines computed at `check_in 15:00` in hotel zone → UTC instant. `created_at` = ISO UTC.

## 7. Deployment
`npm run build` (client) then `npm start`; any Node host. `DB_PATH` env selects the DB file. Health at `/api/health`.
