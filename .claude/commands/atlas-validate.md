---
description: Run the full Atlas gate chain (typecheck, all vitest suites, content audits, BC audits) and report pass/fail. Use after any code/content change and before /atlas-phase-close. This is the mechanical quality gate.
argument-hint: (optional) package or audit name to scope the run
---

# Atlas Validate

Run the gate chain in order. Stop and report on first hard failure; otherwise run all and summarize. Never declare a phase done with any gate red.

## Gate chain

1. **Typecheck (+ heuristic guard):** `pnpm run typecheck`
2. **Unit/integration suites:**
   - `pnpm --filter @workspace/api-server run test`
   - `pnpm --filter @workspace/atlas run test`
   - `pnpm --filter @workspace/execution-core run test`
   - `pnpm --filter @workspace/curriculum-quality run test`
3. **Content + quality audits:**
   - `pnpm --filter @workspace/scripts run audit:authoring`
   - `pnpm --filter @workspace/scripts run audit:pedagogy`
   - `pnpm --filter @workspace/scripts run audit:difficulty-labels`
4. **Backward-compat audits (if a grader or seeded content changed):**
   - `pnpm --filter @workspace/scripts run audit:contains-bc`
   - `pnpm --filter @workspace/scripts run audit:csv-set-equal-bc`
5. **Heuristic-runtime guard:** `pnpm --filter @workspace/scripts run check:no-heuristic-runtime`

If `$ARGUMENTS` is given, run only the matching package/audit.

## Report

Print a table: gate · result · delta vs last phase (counts from `HANDOFF.md`). Mirror the HANDOFF "Gates" format. List any failure with the exact error quoted. If a BC audit is relevant but the underlying grader changed, say so explicitly — a green run that skipped the BC audit is NOT a pass.
