# Changelog

## [1.0.0] — 2026-11-16
### Added
- Guest flow: search by dates/guests, room results with price breakdown, room detail with cancellation policy, guest details, simulated card payment, confirmation with booking code, booking lookup and cancellation (code + email).
- Admin area: role-based login (admin/staff), dashboard (arrivals, departures, occupancy), room type and room management, booking calendar, booking list/detail with modify, cancel and create-for-guest.
- Double-booking prevention via `booking_nights` UNIQUE(room_id, night) and `BEGIN IMMEDIATE` transactions; automatic refund when a paid request loses a race.
- Tiered cancellation refunds (100% ≥48h, 50% ≥24h, else 0%) computed in the hotel time zone.
- Outbox email adapter (confirmation and cancellation), simulated payment provider, guest data anonymisation endpoint.
- Agentic SDLC artifacts: requirements, architecture, design review, implementation plan, code review, verification; Claude agents, skill and guard hook.
- 38 automated tests including a concurrent-booking test.
### Security
- bcrypt passwords, hashed session tokens, HttpOnly cookies, JSON-only admin writes, rate limiting, CSP and security headers, no card data persisted.
