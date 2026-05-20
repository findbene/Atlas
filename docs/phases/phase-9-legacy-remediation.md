# Phase 9 — Legacy Remediation (batch 1)

Phase 9 closed the Phase-8 carry-overs WITHOUT touching the rubric, weakening gates, or mass-authoring. **No rubric edits. Anchor drift 0.00 throughout.**

**Bidirectional candidate ↔ project lineage:**
- New nullable FK `project_candidates.promoted_project_id → projects.id ON DELETE SET NULL`.
- `promote()` in `scripts/src/author-project.ts` now writes both directions atomically in a single transaction AND hard-fails the transaction if the inverse-lineage `UPDATE` doesn't match exactly 1 candidate row (prevents silent zero/multi-row drift).
- `backfill-inverse-lineage.ts` stamped the 18 Phase-7 promotes + the 6 Phase-9 upgrade candidates (20 total).
- `GET /api/admin/quality` exposes `lineageIntegrity: { promotedProjects, candidatesWithInverse, mismatches, inverseMismatches, duplicateCandidatePromotions }` — all four failure modes (project→candidate broken, candidate→project broken, duplicate claims, zero-fan-out) are detectable from the response, and 5 api-server tests pin the invariant directly.

**Synthetic candidates preserve `AuthoredProject.candidateId` REQUIRED:**
- New `project_candidates.source` column (nullable). NULL = legacy candidate-pipeline row; `'grandfathered_phase4'` marks the 2 Phase-4-original synthetics; `'phase9_upgrade'` marks the 6 batch-1-upgrade synthetics. Lineage stays uniform without weakening the typed contract.
- `scripts/src/backfill-grandfather-candidates.ts` + `backfill-upgrade-candidates.ts` are idempotent; both stamp the inverse FK.

**Batch-1 upgrade cohort (6 projects, all ≥70):**
- `data-engineering-real-time-dashboard`, `data-engineering-debezium-cdc`, `data-engineering-vector-database-search`, `data-engineering-stream-processing-flink`, `cloud-data-engineer-iceberg-table-format`, `cloud-data-engineer-dbt-macros-mastery`.
- Each authored module: 5 steps · full pedagogyConfig (L0–L5 + success/failure/portfolio/finalExplanation/misconception) · real validation kinds (json_equal / numeric_tolerance / contains / exact — no `self_attest`) · `candidateId` field populated with the pinned synthetic UUID from `UPGRADE_CANDIDATE_FOR_SLUG`.
- Anchor-checked between every promote — drift stayed at 0.00 across all 6.

**Grandfather cohort (2 projects):**
- `csv-to-postgres-pipeline` (70.5) and `dbt-data-models` (72.7) flipped from `heuristic_legacy` → `authored` with synthetic candidates stamped. No quality regression.

**Heuristic runtime guard:**
- `scripts/src/check-no-runtime-mapToCourse.ts` greps `artifacts/**` and `lib/**` for `mapToCourse` across `.ts`/`.tsx`/`.js`/`.jsx`/`.mjs`/`.cjs` (explicit glob list, not the `--type ts` shortcut, so JS callers and any rg version-skew can't slip through). Allowlist is exactly the 4 historical/library files. Chained into root `pnpm run typecheck` so a regression fails the canonical gate, not just an opt-in script.
- `admin.ts` dropped its `mapToCourse` fallback — reads `projects.course` directly (post-backfill it's NOT NULL).

**Legacy 47 triage manifest:** `docs/phase9/legacy-triage.md` classifies every remaining `heuristic_legacy` row deterministically: 6 upgrade (done), 2 grandfather (done), ~15 revise, ~24 archive. Revise/archive cohorts are explicitly Phase-10 work — Phase 9 only commits the classification.

**Track-split decision (`docs/phase9/track-split-decision.md`):** Deferred to Phase 10. The 8 Phase-9 projects span 2 courses; splitting `COURSE_TO_TRACK_SLUG` now would force re-wiring all 9 courses to preserve the `is_primary` invariant for no immediate benefit.

**Final gate:** `pnpm run typecheck` PASS (now chains `check:no-heuristic-runtime`) · 54/54 curriculum-quality · 53/53 api-server (8 new lineage tests: 3 backfill-invariant + 5 bidirectional `lineageIntegrity` mode coverage) · 4/4 execution-core · `anchor-check` drift 0.00 · `wave-report` 24/24 ≥70 (18 Phase-7 + 6 Phase-9) · `audit:pedagogy` 26/65 fully enriched (was 20).

**Phase 9 explicitly did NOT:** upgrade the revise/archive cohorts (Phase 10+); split the `de-core` track; touch the rubric / Stripe / cloud creds.
