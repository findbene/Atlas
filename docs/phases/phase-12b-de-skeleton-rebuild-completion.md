# Phase 12B — DE Skeleton-Rebuild Completion (Phase-11 Deferral Closure)

**Status:** CLOSED · SHIP
**Scope:** Promote the 3 Phase-11-deferred DE skeleton-rebuild candidates as a single cohesive batch; archive their legacy 1-step twins; bump pedagogy KPI; keep every frozen invariant intact.

## Objective recap

Phase 11 capped its promote batch at 7 (out of 10 ranked candidates) to stay within skeleton-rebuild risk budget. The 3 deferred DE picks were:

| Slug (legacy) | Course | P11 entry score | P11 steps | Rationale to defer |
|---|---|---|---|---|
| `kafka-streaming-pipeline` | data-engineering | 49.2 | 1 | Below the cap. |
| `ml-feature-store` | data-engineering | 47.7 | 1 | Below the cap (also flagged for possible mlops-engineer recategorization — kept on DE per scope decision below). |
| `spark-batch-processing` | data-engineering | 43.8 | 1 | Lowest entry score in the P11 cohort. |

Phase 12B closes those 3 in one cohesive pass using the exact same disciplines that landed Phases 7, 10, 11, and 12A.

## Scope decisions

- **In:** 3 DE skeleton rebuilds (5 authored steps each, full pedagogy, real validation kinds only — no `self_attest`), 3 synthetic `project_candidates` rows with `source='phase12b_revise'`, `replace_candidate_slug` backfill for each upgraded twin, archive-by-hide of all 3 legacy 1-step twins, 1 new visibility-regression test suite.
- **Out (deferred / unchanged):** `ml-feature-store` recategorization to `mlops-engineer` (stays in `data-engineering` per scope decision; would change course-distribution KPI mid-batch). Track-split for `de-core`. Admin UI for unhide / re-archive. Atlas Studio / Stripe / cloud creds. New courses.

## Frozen invariants — all held

- `RUBRIC_VERSION='1.0.1'` (unchanged).
- `AuthoredProject.candidateId: string` (typed and required for all 3 new modules).
- Anchor drift **0.00** before and after each of the 3 promotes.
- All reports read `projects.course` directly. `check:no-heuristic-runtime` green (no callers outside the 4-file allowlist).
- Learner-facing routes filter `learner_visible=TRUE`. 3 archived legacy slugs return **404** (not 403 — no existence leak).
- Bidirectional candidate ↔ project lineage written atomically by `promote()`; all 4 lineage failure modes report 0.
- Archive = hide (`learner_visible=false`), not destroy. No row deletes. Archive script gated on `total_steps <= 1 AND enrolled_count = 0` per slug, DB-source set restricted via `inArray` to the 3 P12B slugs only.

## The 3 modules (results)

| Authored slug | Candidate ID | Score | Steps | Pedagogy | Validation kinds |
|---|---|---|---|---|---|
| `data-engineering-kafka-streaming-pipeline` | `c3142df9-…36` | **90.0** | 5 | full | json_equal × 5 |
| `data-engineering-ml-feature-store` | `d4253ea0-…4a` | **79.9** | 5 | full | json_equal × 3, numeric_tolerance × 2 |
| `data-engineering-spark-batch-processing` | `e5364fb1-…5b` | **81.1** | 5 | full | json_equal × 4, contains × 1 |

All 3 ≥70 ✓. Anchor drift 0.00 after each promote ✓.

### Content highlights

- **Kafka** — idempotent producer + transactional consume-transform-produce EOS + cooperative-sticky rebalance + Avro Schema Registry FULL compat + DLQ with structured envelope + Prometheus lag metric.
- **ML feature store** — entity/view registry + strict-`<` AS-OF point-in-time training joins (leakage harness) + versioned Redis materialization + p99 < 5ms MGET-batched serving + PSI drift monitor.
- **Spark** — partitioned Parquet pushdown verification + 1000:1 skew salting + broadcast hints + AQE (skew + coalesce + dynamic join switch) + 128MB output file sizing + Spark-UI shuffle-bytes CI gate.

Each module ships with a portfolio repo deliverable that includes a chaos test / harness proving the contract (kill-mid-batch for Kafka, leakage-test harness for the feature store, before/after Spark UI screenshots for spark) — the kind of artifact reviewers can actually inspect.

## Schema & lineage

No schema migrations (P11 already added `replace_candidate_slug` + CHECK).

`scripts/src/authored-lineage.ts` extended additively:
- `COURSE_FOR_AUTHORED_SLUG`: +3 entries (all `data-engineering`).
- `REVISE_CANDIDATE_FOR_SLUG`: +3 entries (UUID strings).
- New isolated map `REVISE_CANDIDATE_FOR_SLUG_PHASE12B` (3 entries, used by the P12B backfill).
- New `PHASE12B_LEGACY_SLUG_MAP: Record<authoredSlug, legacySlug>` (3 entries, used by both the replace-slug backfill and the archive script as one of the three safety sources).

Prior P10/P11 lineage maps left untouched.

## Backfill + archive sequence (all idempotent)

```bash
pnpm --filter @workspace/scripts run snapshot:phase12b-pre               # baseline
pnpm --filter @workspace/scripts run backfill:phase12b-candidates        # 3 synthetic candidates
pnpm --filter @workspace/scripts run author:project -- promote data-engineering-kafka-streaming-pipeline
pnpm --filter @workspace/scripts run author:project -- anchor-check       # 0.00
pnpm --filter @workspace/scripts run author:project -- promote data-engineering-ml-feature-store
pnpm --filter @workspace/scripts run author:project -- anchor-check       # 0.00
pnpm --filter @workspace/scripts run author:project -- promote data-engineering-spark-batch-processing
pnpm --filter @workspace/scripts run author:project -- anchor-check       # 0.00
pnpm --filter @workspace/scripts run backfill:phase12b-replace-candidate-slug  # 3 set
pnpm --filter @workspace/scripts run archive:phase12b-replaced            # hiddenCount 29 → 32
```

Idempotency re-run results (verified):
- `backfill:phase12b-candidates`: `created=0 existing=3`.
- `backfill:phase12b-replace-candidate-slug`: `updated=0 unchanged=3`.
- `archive:phase12b-replaced`: `flipped=0 alreadyHidden=3 delta=+0`.

### Archive script safety

`archive-phase12b-replaced.ts` triple-sources its target set and asserts all 3 agree before flipping:
1. Compile-time `PHASE12B_LEGACY_SLUG_MAP` (hardcoded).
2. DB-derived: `projects` rows where `replace_candidate_slug IS NOT NULL` AND the upgraded slug is in the 3 P12B authored set (DB query restricted via `inArray` to those 3 slugs — won't ever drift).
3. Per-row gate: `total_steps <= 1 AND enrolled_count = 0` (and abort if any single row fails).

If any source diverges, the script aborts before any UPDATE.

## State delta

| Metric | Pre-P12B (P12A end) | Post-P12B | Delta |
|---|---|---|---|
| Total `projects` rows | 72 | **75** | +3 (the 3 upgraded twins) |
| Learner-visible projects | 43 | **43** | 0 (3 new visible − 3 legacy hidden) |
| Hidden (archived) projects | 29 | **32** | +3 ✓ |
| Authored modules (wave-report) | 38 / 38 ≥70 | **41 / 41 ≥70** | +3 |
| `legacyReplacements.count` | 7 | **10** | +3 |
| Pedagogy: all (audit) | 40 / 72 | **43 / 75** | +3 numerator, +3 denominator |
| Pedagogy: visible-only (learner-facing KPI) | 40 / 43 (93%) | **43 / 43 (100%)** | +3 numerator |
| Visible thin stubs (1–2 step legacy) | 5 | **2** | −3 |
| Anchor drift | 0.00 | **0.00** | unchanged |
| All 4 lineage failure counters | 0 | **0** | unchanged |
| Distinct courses | 9 | **9** | unchanged |

**The headline:** every learner-visible DE project on the platform now has fully-authored 5-step content with full pedagogy. 100% enriched coverage on the visible surface.

## Tests

New file `artifacts/api-server/src/routes/projects-visibility-phase12b.test.ts` (8 cases, all pass) asserts:
- Each of the 3 P12B legacy slugs returns 404 from `GET /projects/:slug` once hidden (no existence leak).
- Each of the 3 P12B upgraded slugs returns 200.
- Admin `/api/admin/quality` exposes all 3 in `hiddenSlugs`, none of the 3 upgraded in `hiddenSlugs`, and `hiddenCount = PHASE12A_HIDDEN_BASELINE + 3`.
- `legacyReplacements.count = 10` with all 3 P12B pairs reporting `legacyHidden=true`.
- Pre-archive sanity case: when legacy is still visible, `legacyHidden=false` (so ops can see drift).

Full suite: `pnpm --filter @workspace/api-server run test` → **89 / 89 passing**.

## Final gate results

- `pnpm run typecheck` (chains `check:no-heuristic-runtime`) → **PASS**.
- `pnpm --filter @workspace/api-server run test` → **89 / 89 passing**.
- `author:project anchor-check` → both anchors **drift 0.00**.
- `author:project wave-report` → **41 / 41 authored ≥70**.
- `audit:pedagogy` → **43 / 75 all · 43 / 43 visible-only (100%)**.
- Lineage integrity (all 4 counters): **0**.
- 9 distinct courses preserved.

## Architect review

Called `architect({ responsibility: 'evaluate_task', includeGitDiff: true })` across the 3 authored modules + lineage map + 3 backfill/archive scripts + visibility test + replit.md. Result: **PASS, no severe findings**. Recommended next action (non-blocker): an additional test asserting the 3 P12B legacy slugs are excluded from the `/projects` list endpoint — deferred (current visibility test already covers the single-slug case).

## What Phase 12B explicitly did NOT do

- Did NOT recategorize `ml-feature-store` to `mlops-engineer` (deferred; would shift course-distribution KPI mid-batch).
- Did NOT split the `de-core` track (P13+).
- Did NOT delete any DB rows.
- Did NOT change the rubric, the candidateId requirement, the 9-course taxonomy, or the heuristic-runtime allowlist.
- Did NOT promote any modules outside the 3 deferred picks.
- Did NOT touch the Stripe billing path, the AI tutor, the Pyodide runner, or Atlas Studio.

## Forward signal

With Phase 12B closed, the visible Atlas catalog is 100% enriched on the pedagogy KPI for the first time. The remaining 32 hidden rows are archive-state (intentionally hidden, gated on `enrolled=0`, addressable for future recategorization or permanent retirement once policy is set). Phase 13 scope is open — likely candidates: track-split for `de-core`, the deferred `ml-feature-store` → `mlops-engineer` recategorization, beginner-tier seeding, or new-course addition.
