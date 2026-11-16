# Harbor View Hotel — Booking App (MVP 1.0)

Web app for guests to search and book rooms, and for hotel staff to manage rooms and reservations. Built through an agentic SDLC with Claude — see `docs/`.

## Run it
Requires Node >= 22.5.
```bash
npm install
cp .env.example .env            # then set SEED_ADMIN_PASSWORD (min 10 chars)
npm run build
SEED_ADMIN_PASSWORD='choose-a-strong-one' npm start   # http://localhost:3001
```
Development with hot reload: `npm run dev` (UI on :5173, API on :3001). Tests: `npm test`.

The server seeds a demo hotel (3 room types, 9 rooms) on first start and creates the admin `admin@hotel.test` when `SEED_ADMIN_PASSWORD` is set. Staff (non-admin) accounts: set `SEED_STAFF_EMAIL`/`SEED_STAFF_PASSWORD` and run `npm run seed`.

Demo payment cards: `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is declined. Emails are written to the `emails` table and console.

## Configuration
`PORT`, `DB_PATH`, `TRUST_PROXY` (set to the number of proxies when behind one), `NODE_ENV=production` (secure cookies + HSTS). Business assumptions (tax 12% exclusive, refund tiers, time zone) are in `server/src/config.js`.

## Docs
`docs/requirements.md` → `architecture.md` → `design-review.md` → `impl-plan.md` → `review.md` → `verification.md` → `PR.md`.
