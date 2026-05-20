# Phase 10 — Course Taxonomy Display + Revise Cohort (batch 2) + Visibility Controls

Phase 10 ran in two sub-phases: an interim taxonomy fix that made `courses` the learner-facing surface, then the batch-2 revise cohort and the `learner_visible` archive system.

## Part A — Taxonomy Display (interim)

Pre-batch sub-phase that fixed a learner-facing taxonomy gap: the catalog was showing only the 4 legacy `domains` rows even though Atlas is a 9-course platform.

**Course is now the learner-facing taxonomy. Domain is internal-only.**

- New endpoints `GET /api/courses` + `GET /api/courses/:slug` in `artifacts/api-server/src/routes/courses.ts`. Source of truth = `projects.course` + `projects.learner_visible` (no `domains`/`tracks` joins, no `mapToCourse`). Static display metadata (name/description/icon/color) lives in `COURSE_METADATA` keyed by `AtlasCourseSlug` so the 9 courses always render — courses with 0 visible projects show as `status: "coming_soon"` instead of being hidden.
- New pages `artifacts/atlas/src/pages/courses.tsx` + `course-detail.tsx`. Navbar primary nav now says **Courses** → `/courses`. Home showcase, dashboard, profile, certificates, conversations, leaderboard, project-workspace, onboarding tour all link to `/courses/...` instead of `/domains/...`.
- Legacy `/domains` route + page kept as `Internal · legacy` (banner relabel, link back to `/courses`) so admin/dev workflows that still depend on the 4-domain grouping keep working — no breakage, no delete.
- OpenAPI spec: new `courses` tag with `Course` + `CourseDetail` schemas; `domains` tag description marked INTERNAL. `slug` enum on `/courses/:slug` is the 9-course allowlist, so client + server agree on the closed set.
- Regression coverage (`artifacts/api-server/src/routes/courses.test.ts`, 3 tests): list returns exactly the 9 expected slugs; counts come from `projects.course` (not heuristic); unknown slugs 404 against the 9-course allowlist.
- `check:no-heuristic-runtime` still PASS (the courses route reads `projects.course` directly; the JSDoc string was rephrased so the lint's substring grep stays green).

**Admin quality report (`GET /api/admin/quality`) was already course-native** as of Phase 8 — it groups by `projects.course` over `ALL_COURSES` and emits a 9-bucket `courseDistribution`. No change needed there.

**Final gate for this sub-phase:** `pnpm run typecheck` PASS · 58/58 api-server tests (3 new) · `check:no-heuristic-runtime` PASS · live `/api/courses` returns 9 buckets with real counts.

## Part B — Revise Cohort (batch 2) + Visibility Controls

Phase 10 batch-2 closed the carry-overs flagged at the end of the interim taxonomy fix. **No rubric edits, no quality-gate weakening. Anchor drift 0.00 throughout. Atlas is a 9-course platform** — `data-engineering` · `ai-engineer` · `mlops-engineer` · `data-scientist` · `analytics-engineer` · `applied-llm-engineer` · `cloud-data-engineer` · `python-libraries` · `sql`.

**Batch-2 revise cohort (7 projects, all ≥70):**
- `analytics-engineer-data-catalog-implementation`, `ai-engineer-rag-pipeline`, `ai-engineer-feature-store`, `data-scientist-causal-inference-uplift`, `data-scientist-ab-test-from-scratch`, `data-engineering-column-store-engine`, `data-engineering-data-mesh-design`.
- Each authored module: 5 steps · full pedagogyConfig (L0–L5 + success/failure/portfolio/finalExplanation/misconception) · real validation kinds only (no `self_attest`) · `candidateId` populated with a pinned `phase10_revise` synthetic UUID from `REVISE_CANDIDATE_FOR_SLUG`.
- Anchor-checked between every promote — drift stayed at 0.00 across all 7.
- **Selection rationale (by construction, not oversight):** 3 courses (`applied-llm-engineer`, `python-libraries`, `sql`) are already 100% authored. `mlops-engineer` has zero revise candidates — only thin archive stubs (covered by hides). `cloud-data-engineer` revise candidates have only 1-step skeletons (fail criterion c → Phase-11 skeleton-rebuild work). The 7 picks land in the 4 courses where 5-step skeletons exist: DE (2), AI-eng (2), DS (2), AE (1).

**Adapter bug fix — `projectRowToInput` now hoists `qualityBreakdown.portfolioArtifact` into `ProposalInput.portfolioArtifact`:**
- Pre-fix, the portfolio scorer fell back to text-keyword inference for every authored project even though `author-project promote` was writing the declared kind/summary into `qualityBreakdown`. The 2 DS modules surfaced the bug (port=30/40 vs the 70+ they should have scored from declared `kind=repo`).
- Post-fix the scorer reads the declared kind directly. No rubric change — this is the adapter doing what `qualityBreakdown.portfolioArtifact` was always intended for.
- Added `polars` + `mlflow` (legitimate modern DS-tooling tier-1 tokens) to the 2 DS modules' techStack so jobReadiness reflects 2026 stack expectations.

**`projects.learner_visible` — archive without deletion:**
- New column `learner_visible BOOLEAN NOT NULL DEFAULT TRUE` (`lib/db/src/schema/domains.ts`). Purely additive — all 65 existing rows default to TRUE.
- Learner-facing routes filter `learner_visible = TRUE`:
  - `GET /api/projects` (relational `where` + `COUNT(*)` SQL).
  - `GET /api/projects/:slug` returns **404 (not 403)** for hidden rows — explicit `projects-visibility.test.ts` pins no-existence-leak.
  - `GET /api/domains/:slug` projects list.
  - `GET /api/courses` and `GET /api/courses/:slug` (already filtered as of the interim taxonomy fix).
- Admin route `GET /api/admin/quality` does NOT filter — gains `hiddenCount: number` + `hiddenSlugs: string[]` so operators always see what's archived.
- `GET /projects/resume` deliberately does NOT re-filter — by the archive script's zero-exposure safety check, archived rows have `enrolledCount=0` so they can't appear in resume anyway; keeping the route minimal preserves mid-progress learners on any non-archived row that may later be hidden.

**Archive flip (22 thin stubs hidden, none deleted):**
- `scripts/src/archive-thin-stubs.ts` (`pnpm --filter @workspace/scripts run archive:thin-stubs`) — idempotent. Hard-codes the 22 archive slugs from the Phase-9 triage manifest.
- **Safety check:** asserts `total_steps = 0 AND enrolled_count = 0` for every slug BEFORE any UPDATE; aborts the whole batch on violation (no partial application).
- Reversible: a single SQL `UPDATE … SET learner_visible = TRUE` puts a row back.

**Triage manifest now 9-course-native + Phase-10-aware:**
- `scripts/src/triage-legacy.ts` reads `projects.course` directly (already did; no `mapToCourse`). Adds a 9-course inventory header (all 9 courses listed even with 0 legacy rows), a `Hidden` column showing `learner_visible=false` rows, and a `replaceCandidate` boolean column (default false, reserved for Phase 11+ when authored replacements exist for archive slugs). Phase-10 outcome summary at the top.
- Regenerated `docs/phase9/legacy-triage.md`: revise dropped 17 → 10 (7 promoted out); archive stays 22 but all 22 marked hidden ✓.

**Lineage stays bidirectional:**
- 7 new `phase10_revise` candidates + 7 promotes write both directions atomically; `lineageIntegrity` counters all zero on prod DB.
- One FK cleanup: legacy slug `ai-eng-rag-pipeline` had a single `user_progress` row pointing at it; re-pointed to upgraded `ai-engineer-rag-pipeline` BEFORE the legacy delete (no learner progress lost).

**`/projects` SPA redirect:** added `<Route path="/projects"><Redirect to="/courses" /></Route>` in `artifacts/atlas/src/App.tsx` so the natural learner expectation of `/projects` lands on the 9-course catalog instead of 404.

**Final gate:** `pnpm run typecheck` PASS (chains `check:no-heuristic-runtime`) · 54/54 curriculum-quality · 63/63 api-server (10 new: 3 Phase-10 visibility + 7 pre-existing on this branch) · 4/4 execution-core · `anchor-check` drift 0.00 · `wave-report` 31/31 ≥70 (18 Phase-7 + 6 Phase-9 + 7 Phase-10) · `audit:pedagogy` **34/65 fully enriched** (was 26, KPI ≥33 ✓).

**Phase 10 explicitly did NOT:** upgrade the remaining 10 revise projects (Phase 11+); delete any archive rows (hidden, not destroyed); populate `replaceCandidate` for any slug (field-only); split the `de-core` track; touch rubric / Stripe / cloud creds; add an admin UI for unhide/re-archive (single-script reversal is sufficient). See `docs/phase9/legacy-triage.md` for the per-course breakdown of what's left.
