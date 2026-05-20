### Project Quality System (Phase 5)

Quality-gate that scores every project + every proposed candidate against a versioned rubric before we scale toward 1,080 projects. Pure-function scoring lib lives at `lib/curriculum-quality/`; orchestration + DB writes in `scripts/`.

**Rubric** (`RUBRIC_VERSION='1.0.1'`, `lib/curriculum-quality/src/rubric.ts`) — weights: jobReadiness 25, productionRealism 20, pythonSqlDepth 15, pedagogy 20, portfolio 15, uniqueness 5. Bands: 0-49 `needs_revision`, 50-69 `candidate`, 70-100 `approved`. Duplicates above `DUPLICATE_WARNING_THRESHOLD=0.6` Jaccard set `scorecard.duplicateWarning`.

**Schema** (`lib/db/src/schema/quality.ts` + quality fields on `projects`):
- `projects.{quality_status, quality_score, quality_breakdown, last_quality_audit_at}` — existing rows backfilled to `unreviewed` (not `approved`).
- `project_candidates` — separate table for AI-research proposals (never pollutes the production catalog).
- `project_status_history` — append-only audit log of every transition (`scope: 'project'|'candidate'`).
- New enums: `qualityStatusEnum` and `candidateStatusEnum`.

**Candidate scoring stage carve-out** — `composeScorecard(input, { steps, neighbors, stage })`. When `stage='candidate'`, the `pedagogy` dimension is excluded and the remaining 5 weights renormalize to 100, because pedagogy ladders/feedback only exist on authored projects. Without this, even strong proposals could never clear the 70 band. `scripts/src/quality-adapter.ts candidateRowToContext` synthesizes pseudo-steps from `proposal.proposedSteps` and infers language from `proposedStack` so `type: 'code_python'|'code_sql'` matches the depth scorer.

**Commands:**
- `pnpm --filter @workspace/scripts run audit:quality` — score every project + candidate, write back `quality_score` / `quality_breakdown` / `last_quality_audit_at`, print weakest-10 + summary.
- `pnpm --filter @workspace/scripts run catalog:report` — emit course×{difficulty, role, stack} matrices, depth + quality funnel, gap detection. Writes `.local/catalog-quality-report.{md,json}`. Role matrix uses per-role anchor overlap (`ROLE_PRIMARY_STACK`), not blanket tier-1 presence.
- `pnpm --filter @workspace/scripts run candidates -- {list|show|score|approve|reject|revise} ...` — single dispatcher; approve below 70 requires `--force`; `reject`/`revise` require `--reason`. **Atomic transitions:** `cmdTransition` wraps the status UPDATE (with compare-and-swap `WHERE id=? AND status=?` predicate) and the `project_status_history` INSERT in `db.transaction()`. Concurrent reviewers throw `CONCURRENT_UPDATE` instead of clobbering each other.

**Admin endpoint:** `GET /api/admin/quality` (`artifacts/api-server/src/routes/admin.ts`) returns the catalog-report JSON on demand. Auth-gated via `requireAuth` + role check. No UI yet.

**Calibration pins** (`audit:quality` output): csv-to-postgres-pipeline=70.5, dbt-data-models=72.7, 38/47 stubs in `needs_revision`. Lib test suite: 33/33 (includes a regression that proves a strong candidate proposal reaches ≥70 without `--force`).

**Job-demand source-of-truth:** `.local/job-demand-map.md` is the human-reviewable canonical map for the 9 Atlas mastery courses + role-to-stack anchors. `lib/curriculum-quality/src/jobMap.ts` derives from it.

**Known gaps before mass project generation:** (1) `dynamic_ai_adaptive` still aliases to `guided` at the DB enum layer — needs a Drizzle migration to extend `learning_mode`; (2) most catalog projects fall back to the legacy `hints[]` column and will score in the `needs_revision` band until pedagogy is authored; (3) admin role check on `/api/admin/quality` currently relies on the same `requireAuth` shape used elsewhere — promote to a dedicated `requireAdmin` middleware once more admin routes land.

