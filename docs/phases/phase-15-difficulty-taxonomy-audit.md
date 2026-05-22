# Phase 15 — Difficulty Taxonomy Audit + Targeted Backfill

**Status:** CLOSED · SHIP
**Predecessor:** Phase 14 — Beginner-Tier Seeding (closed at `1c6a6e80716e9be448ea206dc927574f7bab7267`)
**Phase 15A pre-snapshot commit:** `c601c973e3d8bfb144d994a52ba02a92987052e8`

---

## 1. Phase 15A audit summary

Phase 15A built read-only audit infrastructure and stopped before any DB mutation. The audit reported **5 declared/suggested mismatches** out of 52 learner-visible projects, all of them `intermediate → advanced`. Anchor immutability was enforced by `audit:difficulty-labels` Rule 1 (`isAnchor → suggested = declared`) — zero anchor mismatches.

**Heuristic used (pure local, no `mapToCourse`):**
1. Anchors short-circuit to declared (never flagged).
2. `<course>-beginner-*` canonical slug → beginner.
3. Advanced-keyword guard on slug/title/desc (30+ keywords: kafka, spark, airflow, snowflake, delta-lake, mlops, kubernetes, …) → advanced.
4. `steps ≤ 2 AND estMin ≤ 120` → beginner; `steps ≤ 4 AND estMin ≤ 300` → intermediate; else advanced.
5. Tie-break: prefer no-change.

Pre-backfill visible distribution: **beginner 6 · intermediate 6 · advanced 40**.

## 2. Approved Phase 15B allowlist

5 rows, all `intermediate → advanced`. No anchors. No beginner-count change. No hidden rows touched.

| Slug | Course | from | to | Reason |
|---|---|---|---|---|
| `analytics-engineer-dbt-ci-state-modified` | analytics-engineer | intermediate | advanced | Snowflake target + dbt CI/state-modified semantics — advanced-stack |
| `sql-window-functions-and-cte-mastery` | sql | intermediate | advanced | 5-step × 180min · window/CTE mastery |
| `python-libraries-pydantic-config-and-cli` | python-libraries | intermediate | advanced | 5-step × 195min · Pydantic + Typer CLI authoring depth |
| `python-libraries-pydantic-validation-service` | python-libraries | intermediate | advanced | 5-step × 180min · validation service depth |
| `data-scientist-ab-test-from-scratch` | data-scientist | intermediate | advanced | 5-step × 180min · A/B test from scratch with stats + power + MDE |

## 3. Dry-run result

```
[backfill-phase15] allowlist size=5  apply=false
[backfill-phase15] plan:
  [ok] analytics-engineer-dbt-ci-state-modified         intermediate → advanced
  [ok] sql-window-functions-and-cte-mastery             intermediate → advanced
  [ok] python-libraries-pydantic-config-and-cli         intermediate → advanced
  [ok] python-libraries-pydantic-validation-service     intermediate → advanced
  [ok] data-scientist-ab-test-from-scratch              intermediate → advanced
[backfill-phase15] visible distribution: BEFORE beg=6 int=6 adv=40
[backfill-phase15] visible distribution: AFTER  beg=6 int=1 adv=45
[backfill-phase15] DRY-RUN. Re-run with --apply to mutate.
```

All 5 entries returned status `ok` (live `from` matched declared `from`, all visible, none anchors). Zero blocking entries.

## 4. Apply result

```
[backfill-phase15] allowlist size=5  apply=true
[backfill-phase15] visible distribution: BEFORE beg=6 int=6 adv=40
[backfill-phase15] visible distribution: AFTER  beg=6 int=1 adv=45
[backfill-phase15] applied 5 difficulty updates. ALLOWLIST size=5.
```

5 `UPDATE projects SET difficulty_level = 'advanced' WHERE slug = ?` statements, one per row. Idempotent — re-running with the same allowlist returns `already-applied` for every row.

## 5. Difficulty distribution — before vs after

| Difficulty | Before | After | Δ |
|---|---|---|---|
| beginner | 6 | 6 | 0 |
| intermediate | 6 | **1** | −5 |
| advanced | 40 | **45** | +5 |
| **total visible** | 52 | 52 | 0 |

Per-course `intermediate` deltas:
- analytics-engineer: 2 → 1 (`dbt-data-models` anchor remains)
- python-libraries: 2 → 0
- sql: 1 → 0
- data-scientist: 1 → 0

## 6. Exact remaining intermediate row

**`dbt-data-models` (analytics-engineer)** — this is one of the two calibration **anchors** (`is_anchor = true`). Anchor immutability (Rule 1) means it was never targeted by the backfill. The sole post-apply intermediate is by design.

## 7. Anchor immutability confirmation

| Anchor slug | Pre-backfill difficulty | Post-backfill difficulty | Scored | Drift |
|---|---|---|---|---|
| `csv-to-postgres-pipeline` | beginner | beginner (unchanged) | 70.5 | 0.00 |
| `dbt-data-models` | intermediate | intermediate (unchanged) | 72.7 | 0.00 |

`audit:difficulty-labels` Rule 1 + `backfill-phase15-difficulty` `FORBIDDEN_SLUGS` set both enforce that neither anchor can be flipped. `anchor-check` reports both within ±1.0.

## 8. Admin `difficultyDistribution` output (post-apply)

```json
{
  "visible": { "beginner": 6, "intermediate": 1, "advanced": 45 },
  "visibleBeginnerSlugs": [
    { "slug": "analytics-engineer-beginner-spreadsheet-to-sql-models", "course": "analytics-engineer" },
    { "slug": "csv-to-postgres-pipeline", "course": "data-engineering" },
    { "slug": "data-engineering-beginner-csv-cleanup-pipeline", "course": "data-engineering" },
    { "slug": "data-scientist-beginner-eda-and-summary-stats", "course": "data-scientist" },
    { "slug": "python-libraries-beginner-pandas-essentials", "course": "python-libraries" },
    { "slug": "sql-beginner-select-where-join-essentials", "course": "sql" }
  ],
  "visibleByCourse": {
    "ai-engineer":          { "beginner": 0, "intermediate": 0, "advanced": 6 },
    "analytics-engineer":   { "beginner": 1, "intermediate": 1, "advanced": 3 },
    "applied-llm-engineer": { "beginner": 0, "intermediate": 0, "advanced": 3 },
    "cloud-data-engineer":  { "beginner": 0, "intermediate": 0, "advanced": 6 },
    "data-engineering":     { "beginner": 2, "intermediate": 0, "advanced": 14 },
    "data-scientist":       { "beginner": 1, "intermediate": 0, "advanced": 4 },
    "mlops-engineer":       { "beginner": 0, "intermediate": 0, "advanced": 3 },
    "python-libraries":     { "beginner": 1, "intermediate": 0, "advanced": 3 },
    "sql":                  { "beginner": 1, "intermediate": 0, "advanced": 3 }
  },
  "beginnerCoverageByCourse": {
    "analytics-engineer": 1, "data-engineering": 2, "data-scientist": 1,
    "python-libraries": 1, "sql": 1,
    "ai-engineer": 0, "applied-llm-engineer": 0, "cloud-data-engineer": 0, "mlops-engineer": 0
  },
  "mismatchCount": 0,
  "mismatchSlugs": []
}
```

## 9. Test/typecheck results

| Gate | Result |
|---|---|
| `pnpm run typecheck` (chains `check:no-heuristic-runtime`) | **green** |
| `@workspace/api-server` tests | **120 / 120 passed** |
| `@workspace/curriculum-quality` tests | **54 / 54 passed** |
| `@workspace/execution-core` tests | **4 / 4 passed** |
| **Total** | **178 / 178 passed** |

## 10. Wave-report result

`50 / 50 passing` — unchanged from Phase 14 close. Difficulty backfill does not affect quality scoring.

## 11. Pedagogy audit result

`52 / 52 visible` — unchanged. Difficulty backfill does not touch `pedagogy_config`.

## 12. Lineage check result

`0 / 0 / 0 / 0` — `promotedProjects`, `candidatesWithInverse`, `mismatches`, `inverseMismatches`, `duplicateCandidatePromotions` all unchanged. Difficulty backfill does not touch candidate↔project FKs.

## 13. Runtime `mapToCourse` result

`[check] OK — no runtime mapToCourse callers outside the 4-entry allowlist.`

## 14. Architect verdict

**PASS — no severe or blocking issues.** Highlights:
- Allowlist matches exactly the 5 approved rows; anchors hard-blocked by both `FORBIDDEN_SLUGS` and runtime `isAnchor` guard.
- Post-apply audit reports `mismatchCount=0` — heuristic now agrees with declared on every visible row.
- Remaining intermediate is the `dbt-data-models` anchor, consistent with the "anchor never targeted" invariant.
- All 178 tests pass; typecheck + runtime `mapToCourse` gate green.
- Lineage 0/0/0/0; anchor drift 0.00; wave 50/50; pedagogy 52/52 visible.
- No project content, steps, archive, or authoring changes — only the `difficulty_level` column on 5 rows.

## 15. Changed files (Phase 15 total)

| File | Phase | Change |
|---|---|---|
| `scripts/src/snapshot-phase15-pre.ts` | 15A | new |
| `scripts/src/audit-difficulty-labels.ts` | 15A | new |
| `scripts/src/backfill-phase15-difficulty.ts` | 15A new; 15B populated `ALLOWLIST` with 5 rows | new |
| `artifacts/api-server/src/routes/admin.ts` | 15A | additive: `visibleByCourse` + `beginnerCoverageByCourse` + `mismatchCount` + `mismatchSlugs` |
| `artifacts/api-server/src/routes/projects-coverage-phase15.test.ts` | 15A | new (6 tests) |
| `scripts/package.json` | 15A | registered `snapshot:phase15-pre` + `audit:difficulty-labels` + `backfill:phase15-difficulty` |
| `.local/phase15-pre-state.json` | 15A | new (snapshot) |
| `.local/phase15-difficulty-audit.json` | 15A pre + 15B post | written |
| `docs/phases/phase-15-difficulty-taxonomy-audit.md` | 15B | new (this file) |
| `replit.md` | 15B | Phase 15 marked CLOSED · SHIP |

## 16. DB writes performed

**Exactly 5 `UPDATE` statements** during Phase 15B `--apply`:

```sql
UPDATE projects SET difficulty_level = 'advanced' WHERE slug = 'analytics-engineer-dbt-ci-state-modified';
UPDATE projects SET difficulty_level = 'advanced' WHERE slug = 'sql-window-functions-and-cte-mastery';
UPDATE projects SET difficulty_level = 'advanced' WHERE slug = 'python-libraries-pydantic-config-and-cli';
UPDATE projects SET difficulty_level = 'advanced' WHERE slug = 'python-libraries-pydantic-validation-service';
UPDATE projects SET difficulty_level = 'advanced' WHERE slug = 'data-scientist-ab-test-from-scratch';
```

Zero `INSERT`s. Zero `DELETE`s. Zero row counts changed. No other columns touched.

## 17. Final checkpoint / commit hash

Phase 15A pre-implementation checkpoint: `60f47daffea72e409dc1cfe5ded2aa59a78531ae`.
Phase 15A close checkpoint: `c601c973e3d8bfb144d994a52ba02a92987052e8`.
Phase 15B close: see auto-checkpoint emitted at end of turn.

## 18. Confirmation: Phase 16 NOT started

`replit.md` still lists Phase 16 as NOT STARTED. No Phase 16 code, scripts, tests, schema changes, or documentation exist. Phase 15 closure is final.

---

## Why this phase mattered

The catalog held 6 declared-intermediate visible projects entering Phase 15. The heuristic audit found 5 of those 6 sat squarely in the advanced band on every dimension (step count × estimated minutes, and in one case an explicit advanced-stack keyword). The lone correctly-labelled intermediate is the calibration anchor `dbt-data-models`, which is frozen by design.

By making difficulty labels trustworthy now — without authoring, archiving, or any UI work — the catalog is ready to support learner-facing difficulty filters and badges in a future phase. The mismatch surface (`mismatchCount`, `mismatchSlugs`) remains in place on the admin route as an ongoing canary for drift introduced by future authoring waves.
