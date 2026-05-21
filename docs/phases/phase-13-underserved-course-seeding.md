# Phase 13 — Underserved Course Seeding + Anchor Reporting Hygiene

**Status:** CLOSED · SHIP
**Closed:** 2026-05-21
**Rubric version:** 1.0.1 (frozen — unchanged)

## Goal

Two parallel problems:

1. Four of the nine courses (`mlops-engineer`, `applied-llm-engineer`,
   `python-libraries`, `sql`) had been stuck at exactly **2 learner-visible
   projects** since Phase 12B. A 2-project course has no narrative arc; a
   learner who finishes both is done. Lift each to **3** with one net-new
   authored project per course.
2. `visibleThinStubs` had been pinned at **2** since Phase 12B — both entries
   being the rubric calibration anchors (`csv-to-postgres-pipeline` and
   `dbt-data-models`). These are *intentionally* 1-step demo rows that the
   rubric is calibrated against; surfacing them as "thin stubs to remediate"
   is misleading. Add `projects.is_anchor` and exclude anchors from the
   `visibleThinStubs` metric so it reflects genuine remediation backlog.

## Final state

| Metric | Phase 12B | Phase 13 | Δ |
|---|---|---|---|
| Total projects | 75 | 79 | +4 |
| Learner-visible | 43 | **47** | +4 |
| Hidden / archived | 32 | 32 | 0 |
| Anchor-flagged | n/a | **2** | +2 |
| `visibleThinStubs` (non-anchor) | 2 | **0** | −2 |
| Wave-report (authored ≥70) | 41/41 | **45/45** | +4 |
| Pedagogy (visible-only KPI) | 43/43 (100%) | **47/47 (100%)** | +4 |
| Anchor drift | 0.00 | 0.00 | 0 |
| `legacyReplacements` | 10 | 10 | 0 |
| Lineage integrity (4 counters) | 0/0/0/0 | 0/0/0/0 | 0 |
| `api-server` tests | 89 | **102** | +13 |

## What shipped

### 1. Schema — `projects.is_anchor`

- `lib/db/src/schema/domains.ts`: added `isAnchor: boolean('is_anchor').notNull().default(false)`.
- `pnpm --filter @workspace/db run push` — purely additive.
- `backfill:phase13-anchor-flag`: idempotent flip of the 2 known anchors;
  asserts both exist, are learner-visible, and that no other row gets flagged.

### 2. Four net-new authored projects (one per underserved course)

Each module: 5 steps · full pedagogy (L1-L5 hints + success/failure/portfolio/finalExplanation/misconception) · real validation kinds only (`csv_set_equal` / `json_equal` / `numeric_tolerance` / `contains`) · `candidateId` explicit · `isMultiFile: true` · `estimatedMinutes ≥ 180`.

| Course | Authored slug | Wave score | Difficulty |
|---|---|---|---|
| `sql` | `sql-window-functions-and-cte-mastery` | ≥70 | intermediate |
| `python-libraries` | `python-libraries-pydantic-config-and-cli` | ≥70 | intermediate |
| `applied-llm-engineer` | `applied-llm-engineer-rag-evaluation-harness` | ≥70 | advanced |
| `mlops-engineer` | `mlops-engineer-feature-pipeline-monitoring` | ≥70 | advanced |

Pinned candidate UUIDs:
- sql: `24708df5-8a01-45bb-9eef-e758697a8ba3`
- python-libraries: `13697ce4-79f0-44aa-9dde-d64758697a92`
- applied-llm-engineer: `02586bd3-68ef-4499-9ccd-c53647586981`
- mlops-engineer: `f1475ac2-57de-4388-9bbc-b42536475870`

Anchor-check ran after every promote; drift was 0.00 throughout.

### 3. Admin route — anchor reporting + thin-stub hygiene

`GET /api/admin/quality` gains 3 new fields:

- `anchorCount: number` — count of `is_anchor=true` rows.
- `anchorSlugs: string[]` — expected to be exactly `['csv-to-postgres-pipeline', 'dbt-data-models']` for the lifetime of rubric 1.0.1.
- `visibleThinStubs: { count, slugs[{slug, course, steps}] }` — visible rows with `<5` steps AND `is_anchor=false`. This is the actionable remediation surface; previously the anchors made the metric permanently bottom out at 2.

`hiddenCount`, `hiddenSlugs`, `legacyReplacements`, `lineageIntegrity`, `lineage`, `inverseLineage`, `courseDistribution` are unchanged.

### 4. Test coverage — `projects-coverage-phase13.test.ts` (13 new assertions)

- 4 reachability tests (200 on each new P13 slug).
- `anchorCount=2` + `anchorSlugs` matches expected set exactly (no drift).
- `visibleThinStubs` excludes anchors in a synthetic anchors-only dataset.
- `visibleThinStubs` STILL counts non-anchor sub-5-step rows in a mixed realistic dataset.
- `hiddenCount` baseline (32) preserved.
- Each underserved course lifts to ≥3 visible.
- Total visible 43 → 47, hidden stays at 32 (Phase 13 net effect).
- `lineageIntegrity` 4 counters all remain 0.

## Frozen invariants — verified

- `RUBRIC_VERSION='1.0.1'` — unchanged.
- `AuthoredProject.candidateId: string` — REQUIRED, all 4 modules supply explicit UUIDs.
- 9-course taxonomy — unchanged; no new courses; distinct `projects.course` still 9.
- Archive-by-hide — no row deletes; `hiddenCount` unchanged.
- `check:no-heuristic-runtime` — passes; no new `mapToCourse` callers.
- Anchor drift ≤ ±1 — actual drift 0.00 across all 4 promotes.
- Bidirectional lineage — every promote stamped both FK directions atomically.

## Gates run (all green)

```
pnpm run typecheck                              ✓
pnpm --filter @workspace/api-server run test    ✓ 102/102 (12 files)
author:project wave-report                      ✓ 45/45 ≥70
author:project anchor-check                     ✓ drift 0.00
audit:pedagogy                                  ✓ 47/47 visible
check:no-heuristic-runtime                      ✓
```

## Architect review

`evaluate_task` review surfaced one severe finding: initial test assertions
were too weak (`>=1` instead of `>=3`, no total-visible pin, no realistic
mixed dataset for the thin-stub guard). Strengthened to:
- Per-course `>=3` floor.
- Total visible exactly 47, hidden exactly 32.
- `anchorSlugs` is EXACTLY the 2 known anchors (Set equality).
- Mixed dataset confirms non-anchor thin stubs still count.
- `lineageIntegrity` regression guard.

All re-validated green (102/102).

## What Phase 13 explicitly did NOT do

- Did not promote any DE/cloud-DE/ai-eng/data-scientist/analytics-eng modules — out of scope.
- Did not delete or unhide any archived rows.
- Did not modify the rubric, the anchor calibration targets, or any scoring weight.
- Did not split the `de-core` track or recategorize `ml-feature-store` to `mlops-engineer`.
- Did not add new courses (taxonomy stays 9).
- Did not touch Stripe, AI tutor, cloud creds, or Atlas Studio.

## Open candidates for Phase 14

- Lift the 4 underserved courses further (3 → 4 each) for a deeper narrative.
- Track-split `de-core` (still deferred from Phase 13 backlog).
- Recategorize `data-engineering-ml-feature-store` to `mlops-engineer` (cross-course candidate).
- Beginner-tier seeding (no `beginner` difficulty projects exist outside legacy hidden rows).
