# Phase 17 — Beginner-Tier Scoring Uplift (Catalog-Quality Repair)

**Status:** CLOSED · SHIP
**Scope:** Restore wave-report from 47/50 → 50/50 by lifting the 3 below-threshold beginner projects discovered during Phase 16 closure.
**Rubric:** v1.0.1 (frozen — untouched).

## Root cause

The Phase 16 wave-report drift (47/50 vs. documented 50/50 at Phase 14/15 close) was **not** authoring-quality decay. Diagnosis traced it to a self-defeating cycle in the audit pipeline:

1. `promote(slug)` writes `qualityBreakdown = { authoredMeta, portfolioArtifact }`.
2. `audit --commit <slug>` (and the legacy `audit-quality.ts` batch path) **overwrite** `qualityBreakdown` with the full `Scorecard`, stripping `portfolioArtifact`.
3. On the next read, `projectRowToInput` no longer finds `qb.portfolioArtifact`, so `scorePortfolio` falls back to keyword-inference on the description text.
4. For the 3 beginner projects whose descriptions matched no keywords in `KIND_BASE`/`DATA_ASSET_KEYWORDS`/`SERVICE_KEYWORDS`/etc., portfolio collapsed from 85 (kind="repo") to 30–60, dropping overall below 70.

The regression was silent because the field was reconstructable from the authored module on the *next* `promote`, but no one re-promoted between Phase 14 close and Phase 16's wave-report run. Phase 15B's difficulty `UPDATE`s did not trigger this — but a subsequent batch `audit --commit` or `audit-quality.ts` run between Phase 14 and Phase 16 did.

## Fix

`scripts/src/author-project.ts` and `scripts/src/audit-quality.ts`: change three `qualityBreakdown` writes from overwrite to **merge** (object spread).

- `promote()` preserves any pre-existing scorecard fields and layers `authoredMeta` + `portfolioArtifact` on top.
- `audit --commit` preserves `authoredMeta` + `portfolioArtifact` and layers `Scorecard` fields on top.
- `audit-quality.ts` (batch path) same as `audit --commit`.

Both reader shapes continue to work: `catalog-report.ts` and `admin.ts` cast `qualityBreakdown as Scorecard` (extra fields ignored); `quality-adapter.ts` reads `qb.portfolioArtifact` directly.

Then re-ran `promote` + `audit --commit` for the 3 target slugs; portfolio scores climbed from 30/60/30 → 85/85/85, and overalls climbed from 65.3/69.1/67.1 → **73.6 / 72.9 / 75.3** — all clear ≥70, all "approved".

## Targets (results)

| Slug | Before | After | Δ | Portfolio (before → after) |
|---|---|---|---|---|
| sql-beginner-select-where-join-essentials | 65.3 | **73.6** | +8.3 | 30 → 85 |
| data-engineering-beginner-csv-cleanup-pipeline | 69.1 | **72.9** | +3.8 | 60 → 85 |
| data-scientist-beginner-eda-and-summary-stats | 67.1 | **75.3** | +8.2 | 30 → 85 |

## What Phase 17 did **not** touch

Per the approved decision brief (`.local/phase17-decision-brief.md`, Option A):

- ❌ No rubric changes (`RUBRIC_VERSION='1.0.1'` untouched).
- ❌ No new projects, no archives, no difficulty relabels, no anchor edits.
- ❌ No UI / frontend changes.
- ❌ No edits to the authored modules themselves (`scripts/src/authored/sql__beginner-select-where-join-essentials.ts`, `…csv-cleanup-pipeline.ts`, `…eda-and-summary-stats.ts` are byte-identical to Phase 16 close).
- ❌ No DB schema changes.

Only 3 writes to `scripts/src/*.ts` (audit/promote merge fix), plus 3 `promote`s and 3 `audit --commit`s against the existing 3 projects.

## Invariants preserved

| Invariant | Phase 16 close | Phase 17 close |
|---|---|---|
| Visible projects | 52 | 52 |
| Hidden projects | 32 | 32 |
| Difficulty distribution (beg/int/adv, visible) | 6/1/45 | 6/1/45 |
| Anchor count | 2 | 2 |
| Anchor drift (csv-to-postgres-pipeline) | 0.00 | 0.00 |
| Anchor drift (dbt-data-models) | 0.00 | 0.00 |
| Lineage failure modes | 0/0/0/0 | 0/0/0/0 |
| 9-course taxonomy | intact | intact |
| Pedagogy (visible) | 52/52 | 52/52 |
| Wave-report (authored ≥70) | **47/50** ❌ | **50/50** ✓ |
| Difficulty-label mismatches | 0 | 0 |
| Anchor immutability mismatches | 0 | 0 |

## Tests / gates

- `pnpm run typecheck` — PASS (chains `check:no-heuristic-runtime` — PASS)
- `pnpm --filter @workspace/api-server run test` — 128/128 PASS
- `pnpm --filter @workspace/curriculum-quality run test` — 60/60 PASS (54 prior + 6 new Phase-17 regression tests)
- `pnpm --filter @workspace/execution-core run test` — 4/4 PASS
- `author:project anchor-check` — both anchors drift 0.00
- `author:project wave-report` — 50/50
- `audit:pedagogy` — 52/52 visible
- `audit:difficulty-labels` — 0 mismatches, anchor immutability 0 mismatches

Total: **192/192** tests pass (186 prior + 6 new Phase-17 merge regression tests).

## Files changed

- `lib/curriculum-quality/src/mergeQualityBreakdown.ts` — new canonical merge helper (single source of truth for the spread).
- `lib/curriculum-quality/src/mergeQualityBreakdown.test.ts` — 6 regression tests that pin the contract: portfolioArtifact survives audit; scorecard survives promote; repeated audits don't drift; null-existing is safe; last-write-wins on collision. Every test in this file would have failed before the Phase 17 fix.
- `lib/curriculum-quality/src/index.ts` — barrel re-export.
- `scripts/src/author-project.ts` — `promote()` + `audit --commit` call `mergeQualityBreakdown` instead of inlining the spread.
- `scripts/src/audit-quality.ts` — same on the batch path.

Snapshot artifacts:

- `.local/phase17-baseline-wave-report.{md,json}` — pre-Phase-17 wave-report capture (47/50).
- `.local/phase7-wave-report.{md,json}` — post-Phase-17 (50/50).
- `.local/phase17-decision-brief.md` — approved Option A plan.

## Follow-ups (not in Phase 17)

- `targetRoles` is only consumed by `scoreJobReadiness` on candidate-stage projects; promoted projects rely on the inferred-role overlap path. If we wanted to lift `jobReadiness` further on beginner-tier authored projects, a future phase could plumb `targetRoles` through `promote()` and the projects schema. Out of scope here.
- Phase 17 closure-hardening pass (this revision): extracted the merge into `mergeQualityBreakdown` and added 6 unit-level regression tests. Any new code path that writes `projects.qualityBreakdown` should call this helper instead of inlining a spread.
