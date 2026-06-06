---
description: Phase 57C — read-only decision/proposal for the csv_set_equal trust model and first opt-in plan. Inspect-and-write only; produces a decision doc and STOPS for owner approval. No code, no flips.
argument-hint: (none — operates on the current repo state)
---

# Phase 57C — `csv_set_equal` Trust-Model Decision (READ-ONLY proposal)

Decide the correct trust model for activating `csv_set_equal` server grading on the first candidate step.
**This is a proposal phase: inspect code and write a decision doc. Change NO code.** Stop for approval.

## Corrected premise (verify, do not assume)
A prior handoff claimed "Phase 57B-prereq frontend submission-shape wiring is shipped." **It is NOT in the
repo** (no `artifacts/atlas/src/lib/csvSetEqualSubmit.ts`, no derived `serverGrade` in
`artifacts/api-server/src/routes/projects.ts`, no `capturedSqlByStepId` in `project-workspace.tsx`).
Treat the FE wiring as **TODO downstream of this decision**, not a prerequisite. Confirm this yourself first.

## Context
- Phase 57A added a DARK server-side comparator `gradeCsvSetEqual()` + `computeCsvSetEqualHash()` in
  `artifacts/api-server/src/lib/grading.ts`. Opt-in is `spec.serverGrade === true`. Zero rows opted in.
- Atlas already has signed RunEnvelope infrastructure (phases 45–52) and the H3 honesty boundary.
- Raw `{columns, rows}` JSON submitted by a learner is tamperable — it proves "the learner submitted
  matching rows," NOT "the learner's query produced those rows."
- Phase 52 canary remains OPERATOR-PENDING and must not be touched.

## Steps (read-only)
1. **Orient.** Read `.agentic/plan.md`, `.agentic/progress.md`, `HANDOFF.md`, `docs/phases/phase-57a-csv-set-equal-comparator.md`, `docs/phases/phase-57-proposal-csv-set-equal-hardening.md`, and `docs/validation-kind-matrix.md`.
2. **Inspect the infrastructure** and record findings:
   - Does the current RunCapture / run-result envelope already carry `rows`/`columns` for SQL (DuckDB-WASM) runs?
   - Does `POST /api/runs/sign` (the signing API) currently accept `csv_set_equal` captures?
   - Can envelope verification route a verified capture to `gradeCsvSetEqual`?
   - Identify the eligible first candidate step (expected: `analytics-engineer-semantic-layer-with-dbt-and-duckdb`, step with inline `expectedRows`, 0 enrollments) and verify its canonical `expectedRows` against intended DuckDB-WASM output.
3. **Compare two activation options** in a tradeoff table — for each: what it proves, what it does NOT prove, implementation changes required (FE + API), learner UX impact, test plan, rollback plan, overclaim risk:
   - **A.** raw `{columns, rows}` JSON submit
   - **B.** signed RunEnvelope `{columns, rows}` submit
4. **Recommend** A, B, or C (defer until more infra exists). Bias toward **B (signed RunEnvelope)** if feasible — it keeps weaker claims out of certificates/portfolio evidence and aligns with the H3 trust spine. Justify against the actual infra findings, not assumptions.
5. **Map the path** after the decision: the FE submission-shape wiring still to build, then the single-step opt-in (57B-flip), then rollback.

## Output
Write the decision to `docs/phases/phase-57c-csv-set-equal-trust-decision.md`. Print a tight summary to chat
and **STOP for owner approval — do not implement the flip or the FE wiring.**

## Hard stops (no exceptions)
No code changes · no DB row opt-in · no project content change · no schema/migration · no env-var changes ·
no production canary execution · no OpenAPI/codegen (unless the proposal proves it is required, then only
propose) · no frontend/backend behavior changes · no cert/portfolio language changes · Phase 52 stays
operator-pending. Honor every invariant in `.claude/skills/atlas-conventions/SKILL.md`.
