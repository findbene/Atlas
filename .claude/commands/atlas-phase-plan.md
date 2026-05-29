---
description: Write a pre-build decision brief + numbered implementation plan + acceptance criteria for an Atlas phase, mirroring the docs/phases/*-plan.md ritual. Use before starting any phase that touches code, schema, or content.
argument-hint: <phase-id> (e.g. 58, E0.2, 67-analytics)
---

# Atlas Phase Plan — `$ARGUMENTS`

Produce a pre-build plan for this phase. Do NOT write implementation code in this step — plan only, then stop for owner approval.

## Steps

1. **Orient.** Read `.agentic/plan.md` (find the phase), `.agentic/progress.md`, `HANDOFF.md`, and the most recent relevant `docs/phases/*.md`. Confirm what shipped last and what this phase depends on.
2. **Scope the change.** State exactly which files/packages this phase touches and — explicitly — what it must NOT touch (the inherited hard-stops list: canary path, `RUBRIC_VERSION`, schema/migrations, `learner_visible`, cert/portfolio language, deploy, unless this phase IS that work).
3. **Decision brief.** If there is a real fork (trust model, submission shape, schema vs schema-free, etc.), lay out options with a tradeoff table and recommend one. Surface anything that needs owner sign-off.
4. **Numbered plan with per-step verification:**
   ```
   1. <step> → verify: <check>
   2. <step> → verify: <check>
   ```
5. **Acceptance criteria** — the binary gates this phase must pass (which test suites, which `audit:*`, BC audit if a grader changes, architect PASS).
6. **Risk + rollback** — what could regress, how it reverts (recall: dark-ship + opt-in flag for graders; archive=hide for content).

## Output

Write the plan to `docs/phases/phase-$ARGUMENTS-plan.md` (match existing naming). Print a tight summary to chat and ask the owner to approve before building. Honor every invariant in `.claude/skills/atlas-conventions/SKILL.md`.
