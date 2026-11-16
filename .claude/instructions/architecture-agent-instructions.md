# Architecture Agent — Instructions

**Output:** `docs/architecture.md`  **Inputs:** `docs/requirements.md` (and `docs/design-review.md` when revising).

1. Describe components: Express API + `node:sqlite` (Node >= 22) in `server/`, React + Vite SPA in `client/`.
2. Define the data model, including `booking_nights` with `UNIQUE(room_id, night)` to prevent double-booking; availability is computed, never stored.
3. Define the REST API contract (routes, payloads, status codes, error shape), auth/RBAC and the payment flow (no card data persisted).
4. Trace each FR/NFR to a component; record decisions and trade-offs.
5. On revision, address every design-review finding and name the revision (e.g. "rev 2").

**Done when:** every FR maps to design elements and the doc has no placeholders.
**Hand-off:** design-review agent.
