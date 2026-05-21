# Phase 12A — Archive Replaced Phase 11 Legacy Twins

**Status: CLOSED · SHIP.** Architect verdict: ship (no severe findings). All frozen invariants intact.

Phase 12A hid the 7 legacy projects superseded by the Phase 11 batch-3 upgrades. No row deletes. No upgraded P11 row touched. No rubric edits. No taxonomy changes. No `candidateId` requirement loosening. No runtime `mapToCourse` regressions. Cleanup only — fully reversible by a single `UPDATE projects SET learner_visible = true WHERE slug IN (…)`.

## Archived legacy slugs (7/7 flipped)

| Legacy slug | Steps | Enrolled | Before | After | Replaced by (still visible) |
|---|---|---|---|---|---|
| `ai-eng-llm-eval-harness` | 5 | 0 | visible | **hidden** | `ai-engineer-llm-eval-harness` |
| `mlops-model-serving-canary` | 5 | 0 | visible | **hidden** | `ai-engineer-model-serving-canary` |
| `delta-lake-lakehouse` | 1 | 0 | visible | **hidden** | `cloud-data-engineer-delta-lake-lakehouse` |
| `snowflake-data-warehouse` | 1 | 0 | visible | **hidden** | `cloud-data-engineer-snowflake-data-warehouse` |
| `airflow-etl-dag` | 1 | 0 | visible | **hidden** | `data-engineering-airflow-etl-dag` |
| `api-to-warehouse-ingestion` | 2 | 0 | visible | **hidden** | `data-engineering-api-to-warehouse-ingestion` |
| `data-quality-framework` | 1 | 0 | visible | **hidden** | `data-engineering-data-quality-framework` |

Triple-source agreement passed: hardcoded 7-slug allowlist ↔ `PHASE11_LEGACY_SLUG_MAP` keys ↔ DB-derived `replace_candidate_slug` values. Safety gate: every target had `enrolled_count = 0` (approved Phase 12A deviation from Phase 10's `total_steps = 0 AND enrolled_count = 0` gate — two of the legacy rows had pre-existing 5-step stubs, and the learner-safety invariant is "no project with active progress is silently archived", which `enrolled_count = 0` alone guarantees).

## Upgraded Phase 11 twins — all 7 confirmed still visible

`ai-engineer-llm-eval-harness` · `ai-engineer-model-serving-canary` · `cloud-data-engineer-delta-lake-lakehouse` · `cloud-data-engineer-snowflake-data-warehouse` · `data-engineering-airflow-etl-dag` · `data-engineering-api-to-warehouse-ingestion` · `data-engineering-data-quality-framework`. All `learnerVisible = true`, all 5-step, each carrying `replace_candidate_slug` pointing at the now-hidden legacy mirror. Verified by `phase11-final-gates.ts` and pinned by 7 new visibility tests.

## Hidden count

| Phase | hiddenCount |
|---|---|
| Phase 10 baseline | 22 |
| **Phase 12A after** | **29** |
| Delta | **+7** ✓ |

## Admin `legacyReplacements` output (live, Phase-12A T004 surface)

```json
"legacyReplacements": {
  "count": 7,
  "pairs": [
    { "upgradedSlug": "ai-engineer-llm-eval-harness",                  "legacySlug": "ai-eng-llm-eval-harness",      "legacyHidden": true },
    { "upgradedSlug": "ai-engineer-model-serving-canary",              "legacySlug": "mlops-model-serving-canary",   "legacyHidden": true },
    { "upgradedSlug": "cloud-data-engineer-delta-lake-lakehouse",      "legacySlug": "delta-lake-lakehouse",         "legacyHidden": true },
    { "upgradedSlug": "cloud-data-engineer-snowflake-data-warehouse",  "legacySlug": "snowflake-data-warehouse",     "legacyHidden": true },
    { "upgradedSlug": "data-engineering-airflow-etl-dag",              "legacySlug": "airflow-etl-dag",              "legacyHidden": true },
    { "upgradedSlug": "data-engineering-api-to-warehouse-ingestion",   "legacySlug": "api-to-warehouse-ingestion",   "legacyHidden": true },
    { "upgradedSlug": "data-engineering-data-quality-framework",       "legacySlug": "data-quality-framework",       "legacyHidden": true }
  ]
}
```

All 7 pairs report `legacyHidden: true` — the upgrade→archive lifecycle is closed and admin can verify it at a glance.

## Pedagogy audit — dual denominator (Phase-12A T003)

```
SUMMARY
  Total projects:                 72
  Learner-visible projects:       43
  Archived / hidden projects:     29
  Fully enriched (all):           40 / 72       ← historical denominator (kept for continuity)
  Fully enriched (visible only):  40 / 43       ← learner-facing KPI (going forward)
SUMMARY (legacy): 40 / 72 projects fully enriched
```

- **All-projects ratio: 40 / 72** — preserved verbatim for historical scrapers and internal cleanup visibility (so an enriched-but-archived row would still flag as a regression signal).
- **Learner-visible ratio: 40 / 43 (93%)** — the meaningful learner-facing KPI. Pre-Phase-12A the same data produced 40/65 (62%) once Phase-10's 22 hidden stubs are excluded; now with the 7 Phase-12A archives included in the hidden bucket, the visible-only denominator is 43 and the ratio jumps to 93%. The improvement is denominator hygiene, not new enrichment — the numerator stayed at 40 (same 40 authored modules from P7-P11).

## Catalog report — visibility summary (Phase-12A T003)

`.local/catalog-quality-report.md` now leads with:

```
## Visibility-aware summary (Phase 12A)
| Total projects | 72 |
| Learner-visible projects | 43 |
| Archived / hidden projects | 29 |
| Approved (all projects) | 40 / 72 |
| Approved (learner-visible only, learner-facing KPI) | 40 / 43 |
```

JSON output gained a top-level `visibility` field with the same 5 counts. All existing sections (course × difficulty, course × tier-1 anchor, gaps, candidate sections) preserved unchanged.

## Lineage inverse check

```
lineageIntegrity: {
  promotedProjects:             40,
  candidatesWithInverse:        40,
  mismatches:                   0,
  inverseMismatches:            0,
  duplicateCandidatePromotions: 0
},
orphanCandidates: 0
```

All four bidirectional counters + the orphan-candidates check = **0**. None of the 7 archived rows were referenced as an inverse target (they were source legacy mirrors, not promoted-from candidates). Bidirectional candidate ↔ project lineage invariant holds.

## Test / typecheck results

| Suite | Result |
|---|---|
| `pnpm run typecheck` (libs + 4 leaf packages + `check:no-heuristic-runtime`) | ✓ |
| `@workspace/api-server` tests | ✓ **80/80** (63 prior + 17 new in `projects-visibility-phase11.test.ts`) |
| `@workspace/curriculum-quality` tests | ✓ 54/54 |
| `@workspace/execution-core` tests | ✓ 4/4 |
| `author:project wave-report` | ✓ **38/38** unchanged |
| `phase11-final-gates.ts` | ✓ all four lineage counters = 0 · hiddenCount = 29 (+7) · 7 upgraded twins all `learnerVisible=true` with `replaceCandidateSlug` populated |

## Runtime `mapToCourse` gate

```
[check] OK — no runtime mapToCourse callers outside the 4-entry allowlist.
```

✓ Green. No new callsites introduced by Phase 12A.

## Architect verdict

**SHIP — no severe findings.** Architect explicitly verified:

1. **Triple-source safety chain in the archive script is exhaustive and bypass-free.** The hardcoded allowlist, `PHASE11_LEGACY_SLUG_MAP` keys, and DB-derived `replace_candidate_slug` set must all agree exactly before any UPDATE runs; any divergence aborts the entire batch.
2. **`admin.ts learnerVisibleBySlug` correctly defaults missing values to visible.** `p.learnerVisible !== false` is the safe-failure idiom; combined with the schema-level `boolean NOT NULL DEFAULT true`, no row can be misclassified as hidden by accident.
3. **New visibility tests exercise the actual Express router with DB-layer mocks** (not trivially green). The 17 new tests parameterize over the 7 legacy + 7 upgraded slugs and exercise the real `/projects/:slug` and `/api/admin/quality` handlers.
4. **Dual-denominator audit preserves the legacy summary line verbatim** — downstream tooling that scrapes "SUMMARY: N / N projects fully enriched" continues to parse correctly.
5. **No race condition** between the archive script and concurrent learner/admin traffic. The flip is one `UPDATE` per project; the `enrolled_count = 0` gate guarantees no in-flight learner sessions on any target row.
6. **All frozen invariants intact**: rubric 1.0.1, `candidateId` requirement, no row deletes (UPDATE only), 404-not-403 on hidden slugs, 9 Atlas courses unchanged, bidirectional lineage unchanged.

## Changed files

```
T001 — Archive script
  scripts/src/archive-phase11-replaced.ts                              (new, ~165 lines)
  scripts/package.json                                                 (+1 npm script: archive:phase11-replaced)

T002 — Visibility tests
  artifacts/api-server/src/routes/projects-visibility-phase11.test.ts  (new, 17 tests)

T003 — Dual-denominator reporting
  scripts/src/audit-pedagogy.ts                                        (+visible/hidden counts + dual ratio block; legacy SUMMARY line preserved)
  scripts/src/catalog-report.ts                                        (+visibility-aware MD block + JSON `visibility` field)

T004 — Admin legacyReplacements surface
  artifacts/api-server/src/routes/admin.ts                             (+legacyReplacements{count,pairs} block + pre-built learnerVisibleBySlug lookup)

Closure docs
  docs/phases/phase-12a-archive-replaced-legacy-twins.md               (this file)
  replit.md                                                            (P12A → CLOSED · SHIP; P12B → NOT STARTED; phase history entry)
```

## DB writes performed

Single batch, run via `pnpm --filter @workspace/scripts run archive:phase11-replaced`:

```sql
-- 7 × UPDATE projects SET learner_visible = false WHERE id = $1;
-- One row per legacy slug; per-row UPDATE so each flip is logged individually.
-- No INSERTs, no DELETEs, no schema mutations.
```

Pre-flight asserts all passed: 7 target rows existed, all had `enrolled_count = 0`, all 7 upgraded twins were `learnerVisible = true`, no upgraded slug appeared in the target list, code-derived ↔ DB-derived ↔ allowlist sets agreed exactly.

## Reversibility note

The archive is fully reversible. A single SQL statement restores every learner-facing row to its pre-Phase-12A state:

```sql
UPDATE projects
   SET learner_visible = true
 WHERE slug IN (
   'ai-eng-llm-eval-harness',
   'mlops-model-serving-canary',
   'delta-lake-lakehouse',
   'snowflake-data-warehouse',
   'airflow-etl-dag',
   'api-to-warehouse-ingestion',
   'data-quality-framework'
 );
```

No other DB state was mutated — `projects.replace_candidate_slug` values, `project_candidates` rows, lineage FKs, `user_progress`, and the upgraded P11 rows are all untouched. The archive script itself is idempotent: re-running it after this restore would re-hide the same 7 rows (or skip already-hidden rows without erroring).

## Final checkpoint / commit hash

**`3fcc50884c3c1fd6b078671781f99ed0460ee3cf`** — auto-checkpoint at end of Phase 12A implementation (T001-T005 complete, archive script executed, all gates green, architect SHIP).

This closure note + the `replit.md` update will be picked up by the next auto-checkpoint at the end of this turn.

## Frozen invariants confirmed intact

- `RUBRIC_VERSION='1.0.1'` — untouched.
- `AuthoredProject.candidateId: string` REQUIRED — unchanged.
- No row deletes — only `learner_visible` UPDATEs (reversible).
- Bidirectional candidate ↔ project lineage — 0/0/0/0 counters.
- Learner-facing routes filter `learner_visible = TRUE`; hidden slugs return **404 (not 403)** — pinned by 7 new tests.
- Admin route does NOT filter; exposes `hiddenCount` + `hiddenSlugs` + `legacyReplacements` + 4 `lineageIntegrity` counters.
- `check:no-heuristic-runtime` allowlist unchanged — green.
- 9 Atlas courses unchanged: `data-engineering` · `ai-engineer` · `mlops-engineer` · `data-scientist` · `analytics-engineer` · `applied-llm-engineer` · `cloud-data-engineer` · `python-libraries` · `sql`.

## Explicitly NOT done in Phase 12A

- No beginner-tier seeding.
- No work on the 31 remaining `needs_revision` legacy stubs.
- No mass project generation.
- No rubric edits.
- No `candidateId` requirement loosening.
- No taxonomy changes (still 9 courses).
- No cloud-credential work.
- No Phase 12B planning or implementation started.
