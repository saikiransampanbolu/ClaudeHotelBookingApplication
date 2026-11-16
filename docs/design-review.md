# Design Review — architecture.md (rev 1 → rev 2)

Reviewer role: Claude as senior reviewer. Scope: risks and gaps before any production code.

## Findings and decisions

| # | Severity | Finding in rev 1 | Decision (applied in architecture rev 2) |
|---|----------|------------------|------------------------------------------|
| D1 | **High** | Availability was only checked by query, so two concurrent requests could both pass and double-book (FR-13). | Add `booking_nights` with `UNIQUE(room_id, night)`; booking inserts inside `BEGIN IMMEDIATE`. The database, not application code, is the final guard. |
| D2 | **High** | Payment charged inside the booking transaction would hold the write lock during an external call. | Charge first, reserve second; on lost race, auto-refund and return 409. |
| D3 | High | Guest lookup could reveal whether a code exists. | Same 404 for wrong code and wrong email; rate-limit lookups. |
| D4 | Medium | Cancelling by status flag only would leave nights blocked. | Cancel deletes `booking_nights` rows in the same transaction. |
| D5 | Medium | Policy deadline relative to date only is ambiguous across time zones/DST. | Deadline = hotel-local check-in time (15:00) converted via `Intl` to UTC; policy snapshot stored on booking. |
| D6 | Medium | Client-supplied totals could be tampered with. | Server recomputes price; client total is display-only. |
| D7 | Medium | Email failure should not lose a paid booking. | Send after commit, catch/log, store failed state in outbox. |
| D8 | Medium | Room type deactivation with future bookings. | Deactivation only hides from search; existing bookings remain valid. Rooms with future bookings cannot be deleted (only set `out_of_order`). |
| D9 | Medium | Sessions stored raw would leak on DB read. | Store SHA-256 of token. |
| D10 | Low | In-memory rate limiter isn't shared across instances. | Accepted for MVP; documented. |
| D11 | Low | Room `status` (clean/dirty/out of order): does it block sales? | Only `out_of_order` rooms are excluded from availability. |
| D12 | Low | Privacy deletion (30 days). | Add `anonymizeGuest` that blanks PII but keeps booking rows for accounting. |
| D13 | Info | Open PRD questions (provider, policy, tax). | Defaults documented in requirements §1; isolated in config. |

## Gaps added to requirements
FR-15 (modify booking) and FR-16 (dashboard) were implied by user stories/screens but had no requirement IDs; added.

## Approval
Architecture rev 2 approved to proceed to implementation planning. Residual risks: SQLite single-writer (fine at MVP load); in-memory rate limit.
