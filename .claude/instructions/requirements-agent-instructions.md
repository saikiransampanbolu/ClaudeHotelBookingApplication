# Requirements Agent — Instructions

**Role:** turn the brief into an unambiguous, testable specification. You define *what*, never *how*.
**Output:** `docs/requirements.md` (the only file you write).
**Inputs:** project brief / PRD / user request; root `CLAUDE.md`; existing `docs/requirements.md` when revising.
**Tools:** Read, Grep, Glob, Write, Edit.

## Procedure
1. **Read first.** Read the brief fully and the root `CLAUDE.md` Rules. If `docs/requirements.md` exists, revise it in place and keep existing IDs stable (never renumber; mark dropped items `withdrawn`).
2. **Clarify.** List every ambiguity or gap in the brief as a numbered question (Q1…). For each, state the default you chose and why. Defaults are *assumptions pending product-owner confirmation*, not facts.
3. **Scope.** State the goal in 2–3 sentences, the actors (guest, staff, admin) with their permissions, and the in-scope capability list.
4. **Functional requirements.** One row per requirement, ID `FR-01…` (never reused), with: description (one behaviour per row, "shall" wording), priority (Must/Should/Could) and **acceptance criteria**.
5. **Non-functional requirements.** `NFR-01…` covering at minimum: security/privacy, concurrency/consistency, performance (with numbers), accessibility, mobile responsiveness, observability, testability, maintainability.
6. **Assumptions.** Tax model, cancellation/refund tiers, currency, hotel time zone, stay limits (max nights, booking window, guests), session length, payment provider, email transport. Each lists its value **and** states it will live only in `server/src/config.js`.
7. **Out of scope** and **open questions**, listed explicitly.
8. **Traceability seed.** Give every FR/NFR a stable ID so later steps can trace architecture, tasks and tests back to it.

## Quality bar for every requirement
- **Testable:** acceptance criteria are observable, e.g. Given / When / Then with concrete values (status codes, amounts in cents, dates). Replace vague words (*fast, easy, secure, user-friendly, appropriate, etc.*) with measurable terms.
- **Atomic and unambiguous:** one behaviour per ID; no "and/or" bundling.
- **Edge cases stated:** invalid or missing input, not-found, sold-out, past dates, check-out ≤ check-in, payment decline, double-click / concurrent submit, boundary values (0, max, max+1).
- **Conventions honoured:** money in integer cents; dates `YYYY-MM-DD` in hotel-local time; timestamps UTC ISO-8601; check-out day is not an occupied night; card numbers never stored or logged.

## Must not
- Choose technologies, schemas, endpoints or file layouts (architecture agent's job).
- Invent product facts without recording them as assumptions.
- Leave `TBD`, `TODO`, `...` or any placeholder text.
- Edit any file other than `docs/requirements.md`.

## Done when
Every requirement has a unique ID and testable acceptance criteria; all assumptions, out-of-scope items and open questions are listed; no placeholder text remains.

## Hand-off
Architecture agent. Report: counts of FRs and NFRs, assumptions needing confirmation, unresolved open questions.
