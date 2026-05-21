# Phase 11 — Course Coverage Repair + Remaining Legacy Remediation

**Status: CLOSED · SHIP.** Architect verdict: ship (no blocking findings). All frozen invariants intact.

Phase 11 promoted the 7-pick user-approved cohort (2 ai-engineer carry-overs + 2 cloud-DE skeleton rebuilds + 3 data-engineering skeleton rebuilds), added the `projects.replace_candidate_slug` column for legacy-twin tracking, and exercised the full Phase-7→9→10 promote contract end-to-end. No rubric edits, no quality-gate weakening, no row deletes, no `learner_visible` filter changes, no runtime `mapToCourse` regressions.

## Promoted cohort (all ≥70, all anchor drift 0.00)

| # | Slug | Course | Score | jobReady · prodReal · py/sql · pedagogy · portfolio · uniqueness |
|---|---|---|---|---|
| 1 | `ai-engineer-llm-eval-harness` | ai-engineer | **91.0** | 98 · 90 · 78 · 100 · 85 · 81 |
| 2 | `ai-engineer-model-serving-canary` | ai-engineer | **90.2** | 94 · 90 · 78 · 100 · 85 · 85 |
| 3 | `cloud-data-engineer-delta-lake-lakehouse` | cloud-data-engineer | **87.4** | 94 · 90 · 58 · 100 · 85 · 88 |
| 4 | `cloud-data-engineer-snowflake-data-warehouse` | cloud-data-engineer | **88.1** | 94 · 90 · 63 · 100 · 85 · 88 |
| 5 | `data-engineering-airflow-etl-dag` | data-engineering | **90.5** | 100 · 90 · 68 · 100 · 85 · 90 |
| 6 | `data-engineering-api-to-warehouse-ingestion` | data-engineering | **90.2** | 100 · 90 · 68 · 100 · 85 · 85 |
| 7 | `data-engineering-data-quality-framework` | data-engineering | **85.3** | 86 · 90 · 58 · 100 · 85 · 86 |

Every promote: 5 steps, real validation kinds only (`json_equal` / `numeric_tolerance` / `contains` / `sql_resultset` — no `manual_review`), L1–L5 hint ladders with progression from semantic boundary to implementation, `successFeedback` + `failureFeedback` + step-level + project-level `portfolioRelevance`, typed `candidateId: string` mapped to a pinned `phase11_revise` synthetic UUID, `readmeOutline` present.

## Schema additions (T001)

`lib/db/src/schema/domains.ts`:

- `projects.replace_candidate_slug TEXT NULL` — records the legacy slug each upgraded P11 project supersedes. Populated for the 7 P11 upgrades via `backfill:replace-candidate-slug`.
- CHECK constraint `projects_replace_candidate_no_self` — forbids self-reference (`replace_candidate_slug IS NULL OR replace_candidate_slug <> slug`). Not unique-indexed (a future legacy slug could in principle be replaced by ≥1 newer slug, though current cohort is 1:1).

Pushed to DB via `pnpm --filter @workspace/db run push`.

## Lineage (T002, T004)

- 7 synthetic `project_candidates` rows created during T002 backfill — `source='phase11_revise'`, `status='approved'`, pinned UUIDs (`b6a7c1e2…` / `c7b8d2f3…` / `d8c9e3a4…` / `e9d0f4b5…` / `f0e1a5c6…` / `a1f2b6d7…` / `b2031ce8…`), reviewer note explicit about Phase-11 synthesis. Mirror of the Phase-10 `backfill-revise-candidates.ts` pattern — only the source tag and cohort differ, keeping the per-phase audit trail parallel.
- `PHASE11_LEGACY_SLUG_MAP` added to `scripts/src/authored-lineage.ts` (7 entries, restricted via `PHASE11_UPGRADED_SLUGS = new Set(Object.values(PHASE11_LEGACY_SLUG_MAP))` so the backfill never touches Phase-10 revise rows).
- `promote()` wrote both FK directions atomically; bidirectional lineage invariant held on every promote.
- T004 backfill populated `replace_candidate_slug` on all 7 upgraded rows (updated=7, unchanged=0, missing=0).

## Final gates

| Gate | Result |
|---|---|
| `pnpm run typecheck` | ✓ (libs + 4 leaf packages + `check:no-heuristic-runtime`) |
| `@workspace/api-server` tests | ✓ 63/63 (9 files) |
| `@workspace/curriculum-quality` tests | ✓ 54/54 (6 files) |
| `@workspace/execution-core` tests | ✓ 4/4 (1 file) |
| `author:project wave-report` | ✓ 38/38 passing — `.local/phase7-wave-report.{md,json}` |
| `audit:pedagogy` | ✓ **40/72** (≥39 KPI met; +6 enriched vs Phase 10) |
| `catalog:report` | ✓ `.local/catalog-quality-report.{md,json}` |
| Anchor drift | ✓ csv-to-postgres-pipeline=0.00, dbt-data-models=0.00, on every promote |
| Lineage inverse check | ✓ 0 mismatches · 0 inverse mismatches · 0 duplicate promotions · **0 orphan candidates** |
| Hidden/archive count | unchanged from Phase 10 (22 thin stubs hidden); 7 P11 legacy twins still visible by design — Phase 12A scope |
| `check:no-heuristic-runtime` | ✓ no runtime `mapToCourse` outside the 4-file allowlist |
| `learner_visible` filtering on `/projects` | unchanged — verified by existing `projects-visibility.test.ts` (hidden = 404, not 403) |
| Architect review | **SHIP** (no blocking findings, CRITICAL=0, HIGH=0) |

## Changed files

```
lib/db/src/schema/domains.ts                                            (T001 schema)
scripts/src/authored-lineage.ts                                         (T002 — 4 maps updated)
scripts/src/backfill-phase11-candidates.ts                              (T002 — new, idempotent)
scripts/src/backfill-replace-candidate-slug.ts                          (T004 — new, idempotent)
scripts/src/phase11-final-gates.ts                                      (T005 — new, report-only)
scripts/src/authored/index.ts                                           (+7 registrations)
scripts/src/authored/ai-engineer__llm-eval-harness.ts                   (new, 5 steps)
scripts/src/authored/ai-engineer__model-serving-canary.ts               (new, 5 steps)
scripts/src/authored/cloud-data-engineer__delta-lake-lakehouse.ts       (new, 5 steps)
scripts/src/authored/cloud-data-engineer__snowflake-data-warehouse.ts   (new, 5 steps)
scripts/src/authored/data-engineering__airflow-etl-dag.ts               (new, 5 steps)
scripts/src/authored/data-engineering__api-to-warehouse-ingestion.ts    (new, 5 steps)
scripts/src/authored/data-engineering__data-quality-framework.ts        (new, 5 steps)
scripts/package.json                                                    (+2 npm scripts)
```

## Checkpoints

- `386a2e4` — schema (T001) + lineage maps (T002) + 7 authored modules + backfill-phase11-candidates script.
- `f96710e` — `backfill-replace-candidate-slug.ts` + `package.json` script registration.

The 7 promote-time DB writes (`projects` row inserts + lineage FK writes + `replace_candidate_slug` updates) live in the database but are not part of any commit — they were executed by `author:project promote` and `backfill:replace-candidate-slug`. The `phase11-final-gates.ts` script was committed in `f96710e` (it's a report-only utility used to verify lineage at Phase-11 close).

## Unresolved risks (Phase 12 scope)

1. **Legacy P11 twins still `learner_visible=true`.** The 7 legacy slugs (`ai-eng-llm-eval-harness`, `mlops-model-serving-canary`, `delta-lake-lakehouse`, `snowflake-data-warehouse`, `airflow-etl-dag`, `api-to-warehouse-ingestion`, `data-quality-framework`) appear in `/courses` alongside their upgraded twins. The `replace_candidate_slug` pointer is now populated on the upgraded rows, so the data is ready for an archive flip. **→ Phase 12A.**
2. **`replace_candidate_slug` not yet surfaced on admin route.** Column is populated + CHECK-protected, but `GET /api/admin/quality` doesn't yet expose a `legacyReplacedSlugs` array. **→ Phase 12A.**
3. **`audit:pedagogy` denominator mixes visible + hidden rows.** Numerator (enriched) and denominator (total) both come from an unfiltered `db.query.projects.findMany()`. Adding 7 upgraded rows without retiring 7 legacy rows shifted the denominator 65 → 72. Once the legacy twins are hidden, the audit should report both `total` and `learner-visible` denominators separately. **→ Phase 12A T003.**
4. **31 needs_revision legacy stubs remain.** Phase 11 only addressed the user-approved 7-pick cohort. Top candidates by weakness: `geospatial-data-pipeline` (15.2), `trino-federated-queries` (15.6), `time-series-pipeline` (15.6), `data-lineage-graph` (15.9), `graph-data-pipeline` (15.9), `data-access-governance` (16.2), `data-freshness-monitoring` (16.9), `advanced-partitioning` (17.2), `multi-cloud-platform` (18.1), `data-contracts` (18.5). **Out of Phase 12A scope.**
5. **Beginner-tier coverage = 0 in every course.** Catalog report flags every (course × difficulty) cell as `med` priority; `applied-llm-engineer` and `sql` have advanced-only coverage (2 each). **Out of Phase 12A scope.**

## Frozen invariants confirmed intact

- `RUBRIC_VERSION='1.0.1'` — untouched.
- `AuthoredProject.candidateId: string` REQUIRED — all 7 P11 modules typed + populated.
- Anchor drift ≤ ±1 (actual: 0.00 on every promote).
- No row deletes — archive = hide pattern preserved.
- Bidirectional candidate ↔ project lineage — `promote()` writes both directions atomically; lineage integrity counters all zero on prod DB.
- Learner-facing routes filter `learner_visible = TRUE`; hidden slugs return **404 (not 403)**.
- Admin route does NOT filter; exposes `hiddenCount` + `hiddenSlugs` + 4 `lineageIntegrity` counters (all zero).
- No runtime `mapToCourse` outside the 4-file allowlist — `check:no-heuristic-runtime` chained into `pnpm run typecheck`.
- 9 Atlas courses unchanged: `data-engineering` · `ai-engineer` · `mlops-engineer` · `data-scientist` · `analytics-engineer` · `applied-llm-engineer` · `cloud-data-engineer` · `python-libraries` · `sql`.
