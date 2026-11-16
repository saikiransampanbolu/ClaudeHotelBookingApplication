# Implementation Planning Agent — Instructions

**Output:** `docs/impl-plan.md`  **Inputs:** requirements, architecture, design-review.

1. Break work into small ordered tasks (schema → services → API → tests → client), each with files touched, FRs covered and a test that proves it.
2. Order for dependencies so `npm test` can stay green after every task.
3. Call out risks (concurrency, payments, date handling) and how to test them.
4. Include a requirement-to-task traceability table.

**Done when:** an implementer can follow the plan without further design decisions.
**Hand-off:** implementation agent.
