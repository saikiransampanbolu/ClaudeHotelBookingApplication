# Implementation Plan

Ordered by dependency. `Blocked by` lists prerequisites; tasks with no blockers can run in parallel.

| ID | Task | Priority | Blocked by | Covers |
|----|------|----------|-----------|--------|
| T1 | Project scaffold, config, `.gitignore`, Claude agents/skills/hooks | P0 | — | process |
| T2 | `db.js` schema + `tx()`; seed script (hotel, 3 room types, rooms, admin) | P0 | T1 | §7 data model |
| T3 | `lib/dates.js`, `pricing`, `cancellation` pure modules + unit tests | P0 | T1 | FR-01, 03, 08 |
| T4 | `availability` service + search endpoint | P0 | T2, T3 | FR-01, 02 |
| T5 | Payment + mailer adapters | P0 | T1 | FR-05, 06, 14 |
| T6 | Booking create (charge → reserve → email), lookup | P0 | T4, T5 | FR-04–07, 13 |
| T7 | Cancel (guest) with refund + email | P0 | T6 | FR-07, 08, 14 |
| T8 | Auth: login, sessions, RBAC, rate-limit | P0 | T2 | FR-09 |
| T9 | Admin room type/room CRUD | P0 | T8 | FR-10 |
| T10 | Admin bookings: list, detail, cancel, modify, create-for-guest | P1 | T6, T8 | FR-12, 15 |
| T11 | Calendar + dashboard reports | P1 | T10 | FR-11, 16 |
| T12 | Privacy anonymise endpoint | P2 | T6, T8 | NFR privacy |
| T13 | Client: shell, search, results, room detail | P0 | T4 | guest screens |
| T14 | Client: guest details, payment, confirmation, My Booking | P0 | T6, T7, T13 | guest screens |
| T15 | Client: admin login, dashboard, room types, calendar, bookings | P1 | T9–T11 | admin screens |
| T16 | Accessibility + responsive pass | P1 | T13–T15 | NFR |
| T17 | Test suite: unit, API integration, concurrency (FR-13), load smoke | P0 | T6–T11 | acceptance |
| T18 | Code review pass, fixes, verification report | P0 | all | Steps 6–7 |
| T19 | CHANGELOG + PR description | P0 | T18 | Step 8 |

**Critical path:** T1 → T2 → T3 → T4 → T6 → T7 → T14.
**Blocked until prerequisite finishes:** T6 (needs T4+T5), T10/T11/T12 (need T6+T8), all client work needs its API.
