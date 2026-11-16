# Hotel Booking App — Agentic SDLC project

Capstone: build a hotel booking app from `docs/requirements.md` using Claude agents, skills, hooks.

## Layout
- `docs/` — SDLC artifacts (requirements, architecture, design-review, impl-plan, review, verification, PR)
- `server/` — Express API + `node:sqlite` (Node >= 22). `npm test` runs `node:test`.
- `client/` — React + Vite SPA.
- `.claude/agents` — `code-reviewer`, `verifier`. `.claude/skills/sdlc-step` — step workflow. `.claude/hooks` — guards.

## Commands
- `npm install` (root installs both workspaces), `npm run seed`, `npm run dev` (API :3001, UI :5173), `npm test`, `npm run build`, `npm start`.

## Rules
- Money is integer cents; dates are `YYYY-MM-DD` strings in hotel-local time; timestamps UTC ISO.
- Never persist or log card numbers. Never commit `.env`.
- Availability is computed; double-booking is prevented by `UNIQUE(room_id, night)` in `booking_nights`.
- Assumptions (tax, cancellation tiers, time zone) live only in `server/src/config.js`.
- Update the relevant `docs/*.md` when behaviour changes.
