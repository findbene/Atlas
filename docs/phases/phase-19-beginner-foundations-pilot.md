# Phase 19 — Beginner / Foundations Pilot (2-project lift)

**Status:** CLOSED · SHIP

## Objective

Convert two of the four remaining zero-beginner courses into "has a beginner" courses by authoring exactly 2 net-new beginner-tier projects, so the Phase-18 `StartHereCard` flips from the honest "Most approachable project available — beginner projects coming soon" fallback to the recommended "Start Here" copy. Pure additive: no schema, no rubric, no archive, no anchor changes.

## What shipped

Two net-new authored projects:

| Course | Slug | Steps | Score |
|---|---|---|---|
| `cloud-data-engineer` | `cloud-data-engineer-foundations-duckdb-local-warehouse` | 5 | **81.1** |
| `applied-llm-engineer` | `applied-llm-engineer-beginner-structured-prompting-with-json-schema` | 5 | **73.6** |

Both: full `pedagogyConfig` (L0–L5 hints + success/failure/portfolio/finalExplanation/misconception), real validation (`json_equal` / `contains` only — no `self_attest`), `portfolioArtifact.kind="repo"`, registered in `scripts/src/authored/index.ts`, candidate UUIDs frozen in `scripts/src/authored-lineage.ts` under a new `BEGINNER_CANDIDATE_FOR_SLUG_PHASE19` map, source synthetic-candidates created via `backfill:phase19-candidates` with `source='phase19_beginner_pilot'`.

Framing: cloud-DE uses **"foundations"** language (DuckDB as a local warehouse, no cloud creds required) — local-only, runs from a learner's laptop, but maps directly to the cloud-DE skill set (analytics SQL, columnar storage, query plans, partitioning intuition). Applied-LLM uses **"beginner structured prompting"** framing (JSON-schema-shaped output from a single-turn LLM call, no agents/tools/RAG).

## Why these two (not all four zero-beginner courses)

`ai-engineer` and `mlops-engineer` were deferred. Both need real model-serving or eval scaffolding that meaningfully exceeds beginner-tier scope without compromising rigor — a 2-project pilot in well-bounded surface area (single-process Python + JSON, single-process DuckDB SQL) was chosen to validate the lift mechanic before committing the harder ones. Phase 20 may take those two on.

## Start-Here flip (live, post-promote)

```
GET /api/courses/cloud-data-engineer       → startHere.kind=start_here, reasonKey=beginner_available
GET /api/courses/applied-llm-engineer      → startHere.kind=start_here, reasonKey=beginner_available
```

Both endpoints previously returned `kind=most_approachable_available` pointing at advanced projects (`cloud-data-engineer-hudi-mor-cdc-merge` and `applied-llm-multi-agent-coordination` respectively). The Phase-18 `pickStartHere` rule (deterministic difficulty-rank → approachability-slug/title signal → estimatedHours → stepCount → slug ASC) auto-flipped on the first read after promote, no code change in `startHere.ts` required.

## Invariants — all green

| Invariant | Before | After |
|---|---|---|
| Visible projects | 52 | **54** |
| Hidden projects | 32 | 32 |
| Beginner-tier visible | 6 | **8** |
| Intermediate visible | 1 | 1 |
| Advanced visible | 45 | 45 |
| Wave-report (authored ≥70) | 50 / 50 | **52 / 52** |
| Pedagogy fully-enriched visible | 52 / 52 | **54 / 54** |
| Anchor count | 2 | 2 |
| Anchor drift (csv-to-postgres, dbt-data-models) | 0.00 | **0.00 / 0.00** |
| Lineage integrity (mismatches / inverse / dup / orphans) | 0/0/0/0 | 0/0/0/0 |
| Zero-beginner courses | 4 | **2** (`ai-engineer`, `mlops-engineer`) |
| 9-course taxonomy | intact | intact |
| `RUBRIC_VERSION` | 1.0.1 frozen | 1.0.1 frozen |

## Test deltas

`artifacts/api-server/src/routes/projects-coverage-phase19.test.ts` — 10 new tests:

- 2 × `GET /projects/:slug` 200-reachability per new beginner slug.
- 5 × admin `/api/admin/quality` regressions: `difficultyDistribution.visible.beginner=8`, course attribution in `visibleBeginnerSlugs`, `anchorCount=2` unchanged, `hiddenCount=32` baseline preserved, total visible 54 / total projects 86, `lineageIntegrity` all-zero.
- 2 × `GET /api/courses/:slug` route assertions: `startHere.kind='start_here'` + `reasonKey='beginner_available'` + correct project slug for both new beginner courses.
- 1 × per-course attribution assertion.

Suite totals: **218 / 218** pass (api-server **154** [+10] · curriculum-quality **60** · execution-core **4**). Full typecheck + `check:no-heuristic-runtime` green. Atlas typecheck clean.

## What did NOT change

- No schema / migrations (`projects` table untouched).
- No rubric edits, no scorer weight changes, no `RUBRIC_VERSION` bump.
- No archive flips (`learner_visible` writes are zero net).
- No anchor additions or `is_anchor` flips.
- No edits to `pickStartHere` / `startHere.ts` / `StartHereCard` / `DifficultyFilter` / `DifficultyBadge` / `course-detail.tsx`.
- No `mapToCourse` runtime callers added; `check:no-heuristic-runtime` allowlist unchanged at 4 entries.
- No new courses; the 9-course Atlas taxonomy is intact.

## Files touched

- `scripts/src/authored-lineage.ts` — added 2 entries each to `COURSE_FOR_AUTHORED_SLUG`, `CANDIDATE_FOR_AUTHORED_SLUG`, plus new `BEGINNER_CANDIDATE_FOR_SLUG_PHASE19` map.
- `scripts/src/backfill-phase19-candidates.ts` — new idempotent backfill (mirrors Phase 14 pattern); `source='phase19_beginner_pilot'`.
- `scripts/src/authored/cloud-data-engineer__foundations-duckdb-local-warehouse.ts` — new authored module.
- `scripts/src/authored/applied-llm-engineer__beginner-structured-prompting-with-json-schema.ts` — new authored module.
- `scripts/src/authored/index.ts` — registered both modules.
- `scripts/package.json` — registered `backfill:phase19-candidates`.
- `artifacts/api-server/src/routes/projects-coverage-phase19.test.ts` — 10 new tests.
- `docs/phases/phase-19-beginner-foundations-pilot.md` — this file.
- `replit.md` — Current Phase Status + Phase History updated.

## Deferred to Phase 20+

- Beginner-tier projects for `ai-engineer` and `mlops-engineer` (the remaining 2 zero-beginner courses).
- Optional Option-F admin rider (`startHereCoverage` aggregated counter) — skipped to keep scope tight; can be added in <30 min any time without risk.
