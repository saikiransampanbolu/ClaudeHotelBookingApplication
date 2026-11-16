---
name: sdlc-step
description: Run one Agentic SDLC step for the hotel booking app (requirements, architecture, design-review, impl-plan, implement, review, verify, pr) or the whole pipeline (orchestrate), and write its artifact into docs/.
---

Map the step named in the arguments to its agent and instructions:

| Step | Agent (`.claude/agents/`) | Instructions (`.claude/instructions/`) | Artifact |
|------|------|------|------|
| requirements | requirements-agent | requirements-agent-instructions.md | `docs/requirements.md` |
| architecture | architecture-agent | architecture-agent-instructions.md | `docs/architecture.md` |
| design-review | design-review-agent | design-review-agent-instructions.md | `docs/design-review.md` |
| impl-plan | impl-planning-agent | impl-planning-agent-instructions.md | `docs/impl-plan.md` |
| implement | implementation-agent | implementation-agent-instructions.md | `server/`, `client/` |
| review | code-review-agent | code-review-agent-instructions.md | `docs/review.md` |
| verify | testing-agent | testing-agent-instructions.md | `docs/verification.md` |
| pr | pr-agent | pr-agent-instructions.md | `docs/PR.md` |
| orchestrate | orchestrator-agent | orchestrator-agent-instructions.md | all of the above |

Workflow:
1. Read the previous artifacts in `docs/` (requirements → architecture → design-review → impl-plan).
2. Delegate to the mapped agent, telling it to follow its instructions file; produce only that step's artifact.
3. For **implement**: follow `impl-plan.md` order and keep `npm test` green.
4. Commit with a message naming the step, e.g. `docs: architecture rev 2`.
