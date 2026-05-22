# Phase 16 — Learner-Facing Difficulty Badges + Filters

**Status:** UI / filter implementation **SHIP** (commit `671af63`). Catalog-quality gate **NOT GREEN** — pre-existing wave-report drift discovered (47/50 vs documented 50/50). Phase 16 did not cause the drift (zero authoring / scoring / rubric files touched), but the gate is still failing and is handed to Phase 17 to repair before further UX/product work.

**Scope:** Surface the Phase-15-trusted `projects.difficulty_level` to learners. Add a difficulty badge on every project card in `/courses/:slug` and a filter on the course-detail page. No DB writes, no authoring, no archive/delete.

## What shipped

### API (`GET /api/courses/:slug`)
- Optional `?difficulty=beginner|intermediate|advanced` query param. Validated against a learner-facing allowlist; the legacy `expert` enum value is intentionally NOT learner-facing and returns **400** (no visible project currently uses it).
- Invalid values → **400** (never silently ignored).
- The always-on `learner_visible=true` predicate is preserved when filtering; hidden rows never leak.
- Filter composed via Drizzle `eq(projects.difficultyLevel, ...)` — no string interpolation.
- OpenAPI spec updated; orval client regenerated; `useGetCourse(slug, { difficulty })` now type-safe end-to-end.

### Frontend (`artifacts/atlas`)
- **`DifficultyBadge`** — 3 color variants (emerald/amber/rose for beginner/intermediate/advanced). Defensive on unknown/null. Never displays `is_anchor` or any other internal flag.
- **`DifficultyFilter`** — All/Beginner/Intermediate/Advanced pill row. `aria-pressed` for selected state, `role="group"` for assistive tech.
- **`course-detail.tsx`** —
  - Badge displayed on every project card (replaces the previous plain text `<span>{difficulty}</span>`).
  - Filter wired with URL persistence via `?difficulty=...`. Selecting "All" clears the param.
  - `popstate` listener keeps state in sync with browser back/forward.
  - Empty-state copy:
    - For the 4 zero-beginner courses (`ai-engineer`, `cloud-data-engineer`, `applied-llm-engineer`, `mlops-engineer`): "Beginner projects for this course are coming soon. Try Intermediate or Advanced for now."
    - Generic filtered empty: "No {difficulty} projects in this course yet."
    - Unfiltered empty (unchanged): "No projects available for this course yet. Check back soon."

### Tests added
8 new API tests on `GET /api/courses/:slug` covering:
- Invalid difficulty → 400 (no DB call).
- Legacy `expert` → 400.
- No-param regression (still exactly 2 WHERE predicates).
- Per-difficulty composition (3 tests, beginner/intermediate/advanced — third predicate is `difficulty_level = <value>`).
- `learner_visible=true` always preserved when filtering.
- Response shape stays public (no `isAnchor`, `learnerVisible`, `courseSource` in payload).

## Invariants — all preserved

| Invariant | Pre-Phase-16 | Post-Phase-16 |
|---|---|---|
| Visible projects | 52 | **52** |
| Hidden projects | 32 | **32** |
| Difficulty distribution (visible beg/int/adv) | 6 / 1 / 45 | **6 / 1 / 45** |
| Pedagogy KPI (visible) | 52 / 52 | **52 / 52** |
| Anchor count | 2 | **2** |
| Anchor drift | 0.00 | **0.00** |
| Lineage integrity (4 counters) | 0/0/0/0 | **0/0/0/0** |
| `RUBRIC_VERSION` | 1.0.1 | **1.0.1** |
| 9-course taxonomy | 9 | **9** |
| `check:no-heuristic-runtime` | green | **green** |

## Gate results

| Gate | Result |
|---|---|
| `pnpm run typecheck` (chains `check:no-heuristic-runtime`) | ✓ |
| `pnpm --filter @workspace/api-server run test` | **128 / 128** (was 120 — added 8) |
| `pnpm --filter @workspace/curriculum-quality run test` | **54 / 54** |
| `pnpm --filter @workspace/execution-core run test` | **4 / 4** |
| Total | **186 / 186** |
| `pnpm --filter @workspace/atlas run typecheck` | ✓ |
| `author:project anchor-check` | drift 0.00, both anchors OK |
| `author:project wave-report` | **47/50 — NOT GREEN** (see Wave-report note below; handed to Phase 17) |
| `audit:pedagogy` | 52/52 visible enriched |
| `audit:difficulty-labels` | anchor immutability 2/2, no new mismatches |
| Live smoke (`/api/courses/sql?difficulty=beginner` returns 1; `?difficulty=wizard` returns 400) | ✓ |
| Architect review (code_review skill) | **PASS** — no severe findings |

## Wave-report drift — discovered, not caused (handed to Phase 17)

Phase 14 closed at 50/50; Phase 15 documented 50/50 unchanged; Phase 16 observed **47/50**. The 3 sub-70 rows are the **Phase-14 beginner-tier authored projects**:

| Slug | Score | Job | Realism | Depth | Pedagogy | Portfolio | Unique |
|---|---|---|---|---|---|---|---|
| `sql-beginner-select-where-join-essentials` | 65.3 | 39 | 82 | 68 | 100 | 30 | 89 |
| `data-engineering-beginner-csv-cleanup-pipeline` | 69.1 | 38 | 82 | 68 | 100 | 60 | 81 |
| `data-scientist-beginner-eda-and-summary-stats` | 67.1 | 45 | 82 | 68 | 100 | 30 | 94 |

Phase 16's diff touches **zero** authoring / scoring / rubric code (verified via `git diff --stat`: only OpenAPI spec, generated client, API route validation, tests, and frontend UI). This is **pre-existing scoring drift introduced before Phase 16, discovered during the Phase 16 wave-report run** — not a Phase-16 regression. Because the wave-report gate is not green, Phase 16's catalog-quality gate is **NOT GREEN**, even though the UI/filter implementation itself is sound. The repair is handed to **Phase 17 — Beginner-Tier Scoring Uplift** (decision brief: `.local/phase17-decision-brief.md`).

## Files changed

```
artifacts/api-server/src/routes/courses.ts        | +29
artifacts/api-server/src/routes/courses.test.ts   | +68
artifacts/atlas/src/components/DifficultyBadge.tsx   | new
artifacts/atlas/src/components/DifficultyFilter.tsx  | new
artifacts/atlas/src/pages/course-detail.tsx       | +86
lib/api-spec/openapi.yaml                         | +16
lib/api-client-react/src/generated/api.{ts,schemas.ts} | regen
lib/api-zod/src/generated/{api,types/index}.ts    | regen
```

Zero changes to: DB schema, authored project modules, seed data, archive script, rubric, candidate lineage, admin route, pedagogy config.

## What Phase 16 explicitly does NOT do

- Does **not** write to the DB.
- Does **not** add authoring, change difficulty labels, or flip any archive/visibility flag.
- Does **not** touch the rubric, lineage FKs, anchors, or any frozen invariant.
- Does **not** add a difficulty filter to `/courses` (course list) — only to `/courses/:slug` (project list within a course). The course-list page does not currently show per-difficulty counts and adding that would require a new admin-route surface.
- Does **not** add difficulty filtering to `/api/projects` (`listProjects` already accepts `difficulty`; no UI consumer changed in this phase).
- Does **not** add frontend unit tests for the URL-sync behavior — Atlas has no frontend test harness yet (architect flagged as optional hardening for a future phase).
