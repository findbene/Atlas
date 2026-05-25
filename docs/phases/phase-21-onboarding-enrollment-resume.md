# Phase 21 — Onboarding + Enrollment + Resume

**Status:** CLOSED · SHIP
**Closed against post-Phase-20 baseline** (visible=56, hidden=32, beginner=10, wave 56/56, pedagogy 56/56 visible, anchorCount=2 drift 0.00).

## Goal

Turn the clean post-P20 catalog into a usable learner product by adding the missing onboarding / enrollment / resume surface. **Pure overlay** — zero changes to schema, content, rubric, anchors, archive set, taxonomy, Stripe, or AI tutor.

## What shipped

### New API endpoints (4)

All registered in `artifacts/api-server/src/routes/index.ts`.

| Method | Path | Behavior |
|---|---|---|
| `POST` | `/api/enrollments` | Slug-based enrollment. Idempotent. Resolves `projectSlug` → `projects.id`, asserts `learner_visible=true`, gates premium, then `findFirst → INSERT` with `(user_id, project_id)` unique-index recovery (SQLSTATE 23505 → re-read → `created:false`). Returns `{projectId, projectSlug, currentStepNumber, currentStepId, created}`. **Hidden + missing slugs both return 404 with byte-identical body — no existence leak.** Premium gating checked only after visibility check so hidden-premium vs hidden-free is also indistinguishable. |
| `GET` | `/api/dashboard` | Single-call learner home payload `{resume, inProgress[], completed[], recommendedStartHere}`. Honors `learner_visible=true` filter — hidden enrollments are silently dropped from lists. `recommendedStartHere` fires only when `progressRows.length === 0` (true fresh learner — raw count BEFORE visibility filter, so a user with only hidden enrollments is NOT treated as fresh and re-recommended), defaults to `data-engineering`, reuses the existing `lib/startHere.ts` rule. |
| `GET` | `/api/onboarding/state` | Returns `{completed, hasEnrollments, lastSeenStep}`. `lastSeenStep` is derived: `null` if completed, `first_enroll` if has enrollments, else `pick_course`. |
| `POST` | `/api/onboarding/complete` | Idempotent. Only writes when flipping `false → true`. Calls `invalidateUserCache(user.clerkId)` (same key used by `requireAuth`/`userCache`) so the next request sees the updated row. |

### OpenAPI + codegen

`lib/api-spec/openapi.yaml` extended with 4 endpoint specs and 6 schemas (`EnrollmentRequest`, `EnrollmentResponse`, `DashboardEnrollment`, `DashboardResume`, `DashboardRecommendation`, `DashboardResponse`, `OnboardingState`). `pnpm --filter @workspace/api-spec run codegen` regenerated `useCreateEnrollment`, `useGetDashboard`, `useGetOnboardingState`, `useCompleteOnboarding` hooks + Zod schemas + types.

### Frontend (atlas)

- **New page `/onboarding`** (`artifacts/atlas/src/pages/onboarding.tsx`): 3-step protected flow — `pick_course → preview Start Here → enroll + complete + land on /projects/:slug`. Server is source of truth (no localStorage). Already-completed users auto-bounce to `/dashboard` on mount. `/onboarding/complete` is called regardless of enroll outcome so a transient enroll failure can't trap a user in the flow.
- **`StartHereCard` CTA wired** (`artifacts/atlas/src/components/StartHereCard.tsx`): static `<Link>` → button calling `useCreateEnrollment` then navigating to the workspace. Anonymous users skip the mutation and fall through to the protected route (which redirects to sign-in).
- **`/onboarding` route registered** in `artifacts/atlas/src/App.tsx` under `ProtectedRoute`.

### Schema

**No schema change.** Phase 21 uses the existing `users.onboardingCompleted` boolean and the existing `user_progress` table with its `progress_user_project_idx (user_id, project_id)` unique constraint.

## Frozen invariants — confirmed unchanged

- `RUBRIC_VERSION='1.0.1'` — untouched.
- `AuthoredProject.candidateId: string` — REQUIRED, untouched.
- Anchor drift 0.00 (csv-to-postgres-pipeline, dbt-data-models).
- `check:no-heuristic-runtime` clean.
- Hidden/archived slugs return 404 to learner routes (now including `POST /api/enrollments`).
- Bidirectional candidate ↔ project lineage clean (0/0/0/0).
- 9 Atlas courses intact.

## Catalog metrics — confirmed unchanged (P20 baseline preserved)

| Metric | P20 | P21 |
|---|---|---|
| Visible projects | 56 | **56** |
| Hidden projects | 32 | **32** |
| Beginner-tier visible | 10 | **10** |
| Wave-report passing | 54/54 (auth ≥70) | **54/54** |
| Pedagogy enriched (visible) | 56/56 | **56/56** |
| anchorCount | 2 | **2** |
| Anchor drift | 0.00 / 0.00 | **0.00 / 0.00** |
| Lineage failures (4 counters) | 0/0/0/0 | **0/0/0/0** |
| Zero-beginner courses | 0 | **0** |

## Tests

- Baseline: 232 tests.
- New: 23 tests across 3 suites (`enrollment.test.ts`, `dashboard.test.ts`, `onboarding.test.ts`).
- **api-server total: 192/192 pass.**
- curriculum-quality: 60/60.
- execution-core: 4/4.
- **Workspace total: 256/256 pass.**

Key regression pins:
- Enrollment 23505 race-recovery returns 200 `created:false` (idempotent under double-click / retry).
- Missing vs hidden 404 body byte-identical (`expect(missing.body).toEqual(hidden.body)`).
- Hidden-only enrollment → empty lists + `recommendedStartHere: null` (NOT re-flagged as fresh).
- `POST /onboarding/complete` is a no-op for already-completed users (no UPDATE, no cache invalidate).

## Architect review

`code_review` skill called twice.

**Round 1: FAIL** — flagged two criticals:
1. Idempotency not race-safe (no 23505 recovery → 500 on concurrent insert).
2. Fresh-learner gate used `enriched.length === 0` (visible-filtered) instead of true zero.

**Round 2: PASS** — both criticals resolved + 4 regression tests added. No new severe findings.

## Live smoke (development)

```
GET  /api/healthz                                              → 200
POST /api/enrollments    (anon)                                → 401
GET  /api/dashboard      (anon)                                → 401
GET  /api/onboarding/state (anon)                              → 401
```

## Explicit non-goals (deferred)

- Dashboard redesign — kept existing `/dashboard` page as-is; the new `/api/dashboard` endpoint is available for a future visual refresh.
- Onboarding "skip" link — flow is short enough; revisit if instrumentation shows drop-off.
- Anonymous-user enrollment intent capture (e.g. preserve "Start Here" intent across sign-in). Deferred.
- Multi-course recommendation in `recommendedStartHere` — currently hard-coded to `data-engineering` (Atlas flagship). Deferred to a future "interest picker".
- Stripe / billing / AI tutor / cloud creds / curriculum content / rubric / taxonomy — explicitly out of scope.

## Files touched

```
artifacts/api-server/src/routes/
  enrollment.ts            (new)
  enrollment.test.ts       (new)
  dashboard.ts             (new)
  dashboard.test.ts        (new)
  onboarding.ts            (new)
  onboarding.test.ts       (new)
  index.ts                 (+3 router.use)
artifacts/atlas/src/
  pages/onboarding.tsx     (new)
  components/StartHereCard.tsx  (CTA wired)
  App.tsx                  (+/onboarding route)
lib/api-spec/openapi.yaml  (+4 endpoints, +6 schemas)
lib/api-client-react/      (regenerated)
lib/api-zod/               (regenerated)
docs/phases/phase-21-onboarding-enrollment-resume.md  (this file)
replit.md                  (Current Phase Status + Phase History link)
```
