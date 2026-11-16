# Requirements — Hotel Booking App (MVP 1.0)

Source: *Hotel Booking App – Product Requirements Document* (16 Nov 2026). Process: *Claude Capstone Project – Agentic SDLC*.

## 1. Clarifying questions and resolutions (Step 1)

The PRD lists three open questions plus gaps found while reading it. Claude proposed the defaults below; they are **assumptions pending product-owner confirmation** and are isolated in `server/src/config.js` so they can change without code edits.

| # | Question | Resolution used in MVP |
|---|----------|------------------------|
| Q1 | Which payment provider? | `PaymentProvider` interface with a **simulated** provider (test cards: `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` declines). Stripe test mode can replace it later. No card data is ever stored. |
| Q2 | Default cancellation policy? | Free cancellation (100% refund) ≥ 48 h before check-in time; 50% refund 24–48 h; 0% under 24 h. Policy text is shown on room detail and snapshotted onto each booking. |
| Q3 | Taxes included in displayed price? | **Tax-exclusive**: nightly rate × nights + 12% tax = total, all shown on the breakdown. Rate is configurable. |
| Q4 | Guest "no account" vs "account to view past bookings"? | MVP: guests book without an account; lookup is by booking code + email (FR-07). Guest accounts are deferred (see Out of scope). |
| Q5 | Currency and time zone? | USD; hotel time zone `America/New_York` (config). Stay dates are local calendar dates; timestamps stored UTC. |
| Q6 | Email delivery? | `Mailer` interface; MVP writes every email to an `emails` outbox table and the console. SMTP transport is a drop-in. |
| Q7 | Check-in/out dates semantics? | Check-out day is not an occupied night. Max stay 30 nights, max booking window 365 days ahead. |
| Q8 | One room type vs many rooms? | A room type has N physical rooms; the system assigns any free room of the type. |
| Q9 | Acceptance item "double booking test" is unchecked in the PRD. | Treated as **required**: a concurrent-booking test is part of Step 7. |

## 2. Actors
- **Guest** — anonymous traveler, mostly mobile.
- **Admin / Staff** — authenticated; `admin` can manage room types, prices, rooms and staff-visible actions; `staff` can view and manage bookings but not room types/prices. Admin accounts are seeded by the system owner (no self-signup).

## 3. Functional requirements

| ID | Requirement | Priority | Acceptance |
|----|-------------|----------|------------|
| FR-01 | Search by check-in, check-out, guests; reject check-out ≤ check-in, past check-in, stays > 30 nights, guests < 1. | Must | 400 with field errors |
| FR-02 | Return only room types with ≥1 room free on **every** night and `max_guests ≥ guests`; inactive types hidden. | Must | Unit + API tests |
| FR-03 | Price breakdown: nightly rate, nights, subtotal, tax, total. | Must | Totals computed server-side in cents |
| FR-04 | Collect name, valid email, phone, optional special requests before payment. | Must | Validated server-side |
| FR-05 | Pay through a provider abstraction (simulated). Declined payment creates no booking. | Must | Declined-card test |
| FR-06 | Unique booking code (e.g. `HB-7K3QX9PD`) and confirmation email on success. | Must | Email in outbox |
| FR-07 | View/cancel booking with **code + email** (both must match; same generic error otherwise). | Must | Not-found + wrong-email tests |
| FR-08 | Cancellation policy with tiered refund; refund is simulated and recorded on Payment. | Should | Policy unit tests |
| FR-09 | Admin login, session cookie, roles `admin` / `staff`. | Must | RBAC tests |
| FR-10 | Admin CRUD on room types (create, edit, deactivate) and nightly prices; manage rooms in a type. | Must | API + UI |
| FR-11 | Admin calendar: rooms × days, booked vs free. | Should | UI + API |
| FR-12 | Admin creates a booking for a guest (phone/walk-in), payment recorded as "offline". | Should | API test |
| FR-13 | A room cannot be booked twice for the same night, including under concurrency. | Must | DB unique constraint + concurrent test |
| FR-14 | Cancellation email on cancel (guest or admin). | Should | Outbox test |
| FR-15 (derived) | Admin can modify a booking (dates / guest details), re-checking availability atomically. | Should | API test |
| FR-16 (derived) | Admin dashboard: today's arrivals, departures, occupancy. | Should | API test |

## 4. Non-functional requirements
| Area | Requirement | How it is met |
|------|-------------|---------------|
| Performance | Search < 2 s at 50 concurrent users | Indexed night table, single SQL availability query; smoke load test |
| Availability | 99% uptime | Stateless API, health endpoint `/api/health` |
| Security | HTTPS; bcrypt passwords; no card storage | HSTS + secure cookies in production, bcryptjs cost 12, card number never persisted or logged; parameterised SQL; login rate limit; security headers |
| Privacy | Delete/anonymise guest data on request ≤ 30 days | `anonymizeGuest` admin endpoint/CLI |
| Accessibility | WCAG 2.1 AA | Labels, focus styles, skip link, ≥4.5:1 contrast, keyboard operable |
| Responsive | 360 px → desktop | Mobile-first CSS |
| Browsers | Latest 2 of Chrome/Safari/Edge/Firefox | Standard APIs only |
| Time | UTC storage, hotel-local display | `created_at` ISO UTC; display via `Intl` in hotel zone |

## 5. Data model
Per PRD §7: Hotel, RoomType, Room, Guest, Booking, Payment, StaffUser, plus implementation tables `booking_nights` (concurrency guard), `sessions`, `emails`. Availability is calculated, never stored.

## 6. Out of scope (MVP)
Multiple properties, channel integrations, dynamic pricing/promos, loyalty/reviews, native apps, i18n/multi-currency, real refunds, guest accounts.

## 7. Acceptance criteria
1. Guest searches, selects a room, pays with a test card, receives a booking code by email.
2. Booked nights are unavailable in every subsequent search; verified by a concurrent-booking test.
3. Guest cancels with code + email; room is available again.
4. Admin creates a room type with price and sees bookings on the calendar.
5. All **Must** requirements pass automated tests.
