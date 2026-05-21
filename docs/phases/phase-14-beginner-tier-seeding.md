# Phase 14 — Beginner-Tier Seeding

**Status:** CLOSED · SHIP
**Closed:** 2026-05-21
**Rubric version:** 1.0.1 (frozen — unchanged)

## Goal

Atlas had **exactly 1 learner-visible beginner-tier project** at Phase-13 close
(`csv-to-postgres-pipeline`, a rubric calibration anchor). Every other visible
project was intermediate (6) or advanced (40). A learner with no prior data
experience hit a wall on project two. Lift the beginner tier from **1 → 6** by
seeding one net-new authored beginner project per top-5 entry-level course:
`sql`, `python-libraries`, `data-engineering`, `analytics-engineer`,
`data-scientist`.

Also: add an `audit:difficulty` script + admin route `difficultyDistribution`
field so the beginner-tier coverage is a first-class reporting surface
(parallel to `anchorCount` / `visibleThinStubs` from Phase 13).

## Final state

| Metric | Phase 13 | Phase 14 | Δ |
|---|---|---|---|
| Total projects | 79 | **84** | +5 |
| Learner-visible | 47 | **52** | +5 |
| Hidden / archived | 32 | 32 | 0 |
| Beginner (visible) | 1 | **6** | +5 |
| Intermediate (visible) | 6 | 6 | 0 |
| Advanced (visible) | 40 | 40 | 0 |
| Anchor-flagged | 2 | 2 | 0 |
| Wave-report (authored ≥70) | 45/45 | **50/50** | +5 |
| Pedagogy (visible-only KPI) | 47/47 (100%) | **52/52 (100%)** | +5 |
| Anchor drift | 0.00 | 0.00 | 0 |
| Lineage integrity (4 counters) | 0/0/0/0 | 0/0/0/0 | 0 |
| `api-server` tests | 102 | **114** | +12 |

## What shipped

### 1. Five net-new beginner-tier authored projects

Each module: 5 steps · full pedagogy (L1-L5 hints + success/failure/portfolio/finalExplanation/misconception) · real validation kinds only (`csv_set_equal` / `json_equal` / `numeric_tolerance` / `contains`) · `candidateId` explicit · `difficulty: 'beginner'`.

| Course | Authored slug | Wave score | Candidate UUID |
|---|---|---|---|
| `sql` | `sql-beginner-select-where-join-essentials` | ≥70 | `93c15ce7-344f-48a2-8aa8-67ee7284e77e` |
| `python-libraries` | `python-libraries-beginner-pandas-essentials` | ≥70 | `434d885b-6d1d-46b6-b922-88bbcfc6e383` |
| `data-engineering` | `data-engineering-beginner-csv-cleanup-pipeline` | ≥70 | `86667efa-bf0c-47eb-8803-3f016cc53784` |
| `analytics-engineer` | `analytics-engineer-beginner-spreadsheet-to-sql-models` | ≥70 | `601eb400-64c3-4e5f-921b-75e4cff1606f` |
| `data-scientist` | `data-scientist-beginner-eda-and-summary-stats` | ≥70 | `100f741c-1ca3-4dcd-8b85-84d0d54b3258` |

### 2. Synthetic candidate backfill (`phase14_beginner`)

`scripts/src/backfill-phase14-candidates.ts` (idempotent) inserts 5 synthetic
`project_candidates` rows with `source='phase14_beginner'`, `status='approved'`,
and the pinned UUIDs above. Run-once-per-environment; subsequent invocations
are no-ops.

### 3. `audit:difficulty` script

`scripts/src/audit-difficulty.ts` reports:

- Total learner-visible projects.
- Visible counts by difficulty (beginner / intermediate / advanced) with %.
- Per-course breakdown grid.
- Full list of beginner-tier visible slugs (course-attributed).

### 4. Admin route — `difficultyDistribution` field

`GET /api/admin/quality` payload extended with:

```jsonc
{
  "difficultyDistribution": {
    "visible": { "beginner": 6, "intermediate": 6, "advanced": 40 },
    "visibleBeginnerSlugs": [
      { "slug": "sql-beginner-select-where-join-essentials", "course": "sql" },
      // ... 5 more
    ]
  }
}
```

Only `learner_visible=true` rows are counted; hidden rows are excluded by
construction (consistent with `visibleThinStubs` from Phase 13).

### 5. Test surface — `projects-coverage-phase14.test.ts`

12 net-new tests pinning:
- 5 P14 slugs return 200 on `GET /projects/:slug` (one per slug).
- `difficultyDistribution.visible.beginner` aggregates correctly across all 3 buckets.
- `visibleBeginnerSlugs` contains all 5 P14 slugs with correct course attribution.
- `anchorCount=2` unchanged.
- `hiddenCount=32` unchanged.
- Total visible 47 → 52, total projects 79 → 84.
- `lineageIntegrity` all counters remain 0.

## Invariants preserved (no drift)

- `RUBRIC_VERSION='1.0.1'` — unchanged.
- `AuthoredProject.candidateId: string` — REQUIRED. All 5 promotes have candidate rows.
- Anchor drift: 0.00 across every promote (csv-to-postgres-pipeline 70.5/70.5, dbt-data-models 72.7/72.7).
- 9-course taxonomy — unchanged.
- Learner-facing routes filter `learner_visible=TRUE`; hidden slugs return 404 (not 403).
- Archive = hide, not destroy — no row deletes from `projects` or `project_candidates`.
- No runtime `mapToCourse` calls outside the 4-file allowlist (`check:no-heuristic-runtime` green).
- Bidirectional candidate ↔ project lineage maintained on each promote.

## Per-course beginner coverage outcome

After Phase 14, every top-5 entry-level course has a learner-visible beginner
project (the cumulative tally `audit:difficulty` reports):

```
course                    beg  int  adv  tot
analytics-engineer          1    2    2    5
data-engineering            2    0   14   16   (includes csv-to-postgres-pipeline anchor)
data-scientist              1    1    3    5
python-libraries            1    2    1    4
sql                         1    1    2    4
```

`ai-engineer`, `mlops-engineer`, `applied-llm-engineer`, `cloud-data-engineer`
intentionally have no beginner-tier rows — these are advanced specialization
courses with intermediate/advanced prerequisites. Adding beginner content
there would be a curriculum-design error, not coverage progress.

## Out of scope (Phase 15+)

- Beginner-tier coverage for `ai-engineer` / `mlops-engineer` / `applied-llm-engineer` / `cloud-data-engineer` (curriculum-design: these are not entry-level).
- Lifting underserved courses 3 → 4.
- Track-split for `de-core`.
- `ml-feature-store` → `mlops-engineer` recategorization.
- New course additions.
- Atlas Studio / Stripe pricing changes / cloud creds.
