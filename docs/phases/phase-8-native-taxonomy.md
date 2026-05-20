# Phase 8 — Native Taxonomy + Governance Hardening

Phase 8 closed the structural gaps Phase 7 surfaced. **No rubric edits, no mass authoring, no quality-gate relaxation.** All 18 Phase-7 projects re-audited at unchanged scores; anchor drift 0.00.

**Native 9-course taxonomy on `projects`:**
- New pg enum `atlas_course` (9 values) + `projects.course` column (NOT NULL).
- New pg enum `course_source` (`authored` | `heuristic_legacy`) + `projects.course_source` column (NOT NULL).
- One-shot backfill (`scripts/src/backfill-course.ts`): 18 authored rows stamped from `COURSE_FOR_AUTHORED_SLUG` as `authored`; 47 legacy rows backfilled via the (now `@deprecated` for runtime catalog reads) `mapToCourse` heuristic and labeled `heuristic_legacy` so the provenance stays visible until Phase 9 re-authors them.
- All catalog/wave/admin reports now read `projects.course` directly. `mapToCourse` is kept for the one-shot backfill and as a defensive fallback only.

**Candidate lineage on `projects`:**
- New nullable FK `projects.source_candidate_id` → `project_candidates.id` `ON DELETE SET NULL`.
- `AuthoredProject.candidateId: string` is now a required typed field (not a comment) — all 18 Phase-7 modules updated; new promotes refuse to compile without it.
- `GET /api/admin/quality` exposes `{ slug, course, courseSource, sourceCandidateId, sourceCandidateTitle }` per project.

**Canonical track resolution:**
- New `tracks.is_primary BOOLEAN NOT NULL DEFAULT FALSE` + partial unique index `(domain_id) WHERE is_primary` — at most one primary per domain.
- `COURSE_TO_TRACK_SLUG` map in `scripts/src/authored-lineage.ts` replaces the legacy `tracks.limit(1)` lookup. Today all 9 courses point at the single existing track per domain; Phase 9 can split without changing the lookup contract.

**Admin route hardening:**
- `requireAdmin` middleware in `artifacts/api-server/src/lib/auth.ts` chains off `requireAuth`, gates on existing `users.role === 'admin'`.
- `GET /api/admin/quality` upgraded from `requireAuth` to `requireAdmin`.
- `scripts/src/grant-admin.ts` is the bootstrap CLI (`pnpm --filter @workspace/scripts run grant:admin -- <email>`) — no UI yet.

**`learning_mode` enum natively supports `dynamic_ai_adaptive`:**
- `learningModeEnum` extended in `lib/db/src/schema/enums.ts`.
- `toAtlasLearnerMode`/`fromAtlasLearnerMode` in `lib/execution-core/src/pedagogy.ts` are now bijective for `dynamic_ai_adaptive` (no more `→ guided` alias collapse). `LEGACY_MODE_ALIAS` is empty by default.

**Phase 8 single source of truth:** `scripts/src/authored-lineage.ts` exports `COURSE_FOR_AUTHORED_SLUG`, `CANDIDATE_FOR_AUTHORED_SLUG`, `COURSE_TO_DOMAIN_SLUG`, `COURSE_TO_TRACK_SLUG`. Both `backfill-course.ts` and `author-project.ts` read from this one file.

**Final gate:** `pnpm run typecheck` PASS · 54/54 curriculum-quality tests · 45/45 api-server tests · `anchor-check` drift 0.00 · `wave-report` 18/18 ≥70 · backfill verified 65/65 rows have non-null `course`.

**Known carry-overs into Phase 9:**
- Promote stamps the FK; the inverse (`project_candidates.promoted_project_id`) is not yet written — readers can join via `sourceCandidateId` for now.
- 45/65 catalog projects still on `hints[]` fallback — Phase 9 mass-author pass.
- Splitting the `de-core` track per course (`analytics-engineer-core`, `cloud-data-engineer-core`, etc.) is deferred — only the lookup map needs updating when it happens.
- The deprecation marker on `mapToCourse` is JSDoc-only; consider a lint/grep CI guard when more callers exist.
