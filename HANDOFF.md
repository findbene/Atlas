# Atlas — Session Handoff

**Date:** 2026-05-25
**Last shipped phase:** Phase 21 — Onboarding + Enrollment + Resume — **CLOSED · SHIP**
**Do not start Phase 22 in this handoff.**

> Note for next session: a Phase 11 session plan was re-pasted at the end of the previous session. **Ignore it.** Phase 11 closed in Q1 2026; it is already in `docs/phases/phase-11-course-coverage-repair.md` and listed in `replit.md` Phase History. The latest live phase is **21**.

---

## 1. Goal

**Long-term:** Atlas — a learner-ready, project-based Data Engineering / AI / MLOps / Data Science / Analytics / SQL / Python platform with 9 native courses, frozen rubric, anchor-stable scoring, and a clean candidate→authored promote pipeline.

**Where we are now:**
- Catalog is product-ready: **56 visible authored projects**, **32 hidden** (archive cohort), **10 beginner-tier**, zero zero-beginner courses, 9-course taxonomy intact, rubric v1.0.1 frozen, anchor drift 0.00.
- As of Phase 21, the learner can now actually **onboard, enroll, and resume** against that catalog. Prior phases authored the content; Phase 21 made it usable as a product.

**Proposed (not started) next phase:** see §5 below.

---

## 2. State of the code after Phase 21

### 2a. What Phase 21 shipped

Pure product overlay. **Zero** changes to: schema, content, rubric, anchor set, archive set, taxonomy, Stripe, AI tutor, cloud creds.

### 2b. API endpoints added (4)

| Method | Path | Behavior |
|---|---|---|
| `POST` | `/api/enrollments` | Slug-based, **idempotent**. Resolves slug → id, asserts `learner_visible=true`, gates premium, `findFirst → INSERT` with **SQLSTATE 23505 race recovery** (re-read → 200 `created:false`). Hidden + missing both 404 with **byte-identical body** (no existence leak). |
| `GET` | `/api/dashboard` | Single-call `{resume, inProgress[], completed[], recommendedStartHere}`. Honors `learner_visible=true`. Fresh-learner gate uses raw `progressRows.length === 0` (hidden-only enrollments are NOT re-recommended). Default recommendation hard-coded to `data-engineering`. |
| `GET` | `/api/onboarding/state` | `{completed, hasEnrollments, lastSeenStep}` — `lastSeenStep` derived from enrollment presence. |
| `POST` | `/api/onboarding/complete` | Idempotent. Writes only on `false → true`. Calls `invalidateUserCache(user.clerkId)`. |

All registered in `artifacts/api-server/src/routes/index.ts`. All live-smoked: return 401 to anon.

### 2c. Frontend changes (atlas)

- **New page `/onboarding`** (`artifacts/atlas/src/pages/onboarding.tsx`): 3-step protected flow (`pick_course → preview Start Here → enroll + finish`). Server is source of truth (no localStorage). `/onboarding/complete` always called on settle so a transient enroll failure doesn't trap a user.
- **`StartHereCard` CTA wired** (`artifacts/atlas/src/components/StartHereCard.tsx`): static `<Link>` replaced with `useCreateEnrollment` then navigate. Anon users fall through to the protected route (which redirects to sign-in via Clerk).
- **`/onboarding` route registered** in `artifacts/atlas/src/App.tsx` under `ProtectedRoute`.

### 2d. OpenAPI + codegen

- `lib/api-spec/openapi.yaml` — +4 endpoint specs, +6 schemas (`EnrollmentRequest`, `EnrollmentResponse`, `DashboardEnrollment`, `DashboardResume`, `DashboardRecommendation`, `DashboardResponse`, `OnboardingState`).
- `pnpm --filter @workspace/api-spec run codegen` regenerated:
  - `lib/api-client-react/src/generated/api.ts` (+`useCreateEnrollment`, `useGetDashboard`, `useGetOnboardingState`, `useCompleteOnboarding`)
  - `lib/api-client-react/src/generated/api.schemas.ts`
  - `lib/api-zod/src/generated/api.ts` + 9 new type files under `lib/api-zod/src/generated/types/`

### 2e. Tests and gate results

| Suite | Before | After | Delta |
|---|---|---|---|
| api-server | 169 | **192** | +23 (3 new suites: enrollment / dashboard / onboarding) |
| curriculum-quality | 60 | **60** | unchanged |
| execution-core | 4 | **4** | unchanged |
| **Workspace total** | **232** | **256 / 256 PASS** | **+24** |

Key regression pins (all in `artifacts/api-server/src/routes/`):
- `enrollment.test.ts` — 23505 race → 200 `created:false`; non-23505 → 500; missing-vs-hidden 404 body equality.
- `dashboard.test.ts` — hidden-only enrollment → empty lists + `recommendedStartHere: null` (NOT fresh).
- `onboarding.test.ts` — `/complete` no-op for already-completed users; cache invalidation only on flip.

Catalog invariance gates:
- `pnpm run typecheck` (chains `check:no-heuristic-runtime`) — **clean**.
- `author:project anchor-check` — drift **0.00 / 0.00** (csv-to-postgres-pipeline, dbt-data-models).
- `author:project wave-report` — **54/54**.
- `audit:pedagogy` — **56/56 visible**.
- `audit:difficulty-labels` — anchor immutability clean.

### 2f. Architect review

`code_review` skill called twice.

- **Round 1: FAIL** — 2 criticals (see §4).
- **Round 2: PASS** — both criticals fixed + 4 regression tests added. No new severes.

### 2g. Confirmed invariants preserved

| Invariant | Status |
|---|---|
| `RUBRIC_VERSION='1.0.1'` frozen | ✓ untouched |
| `AuthoredProject.candidateId: string` REQUIRED | ✓ untouched |
| Anchor drift ≤ ±1 (target 0.00) | ✓ 0.00 / 0.00 |
| `check:no-heuristic-runtime` clean | ✓ |
| Hidden slugs return 404 (not 403) | ✓ now also on `POST /enrollments` |
| Bidirectional candidate ↔ project lineage (4 counters) | ✓ 0/0/0/0 |
| Archive = hide, not destroy | ✓ no deletes |
| 9-course taxonomy (`data-engineering` · `ai-engineer` · `mlops-engineer` · `data-scientist` · `analytics-engineer` · `applied-llm-engineer` · `cloud-data-engineer` · `python-libraries` · `sql`) | ✓ intact |
| visible 56 · hidden 32 · beginner 10 · zero-beginner courses 0 | ✓ unchanged |

---

## 3. Files actively edited in Phase 21

### New files
```
artifacts/api-server/src/routes/enrollment.ts
artifacts/api-server/src/routes/enrollment.test.ts
artifacts/api-server/src/routes/dashboard.ts
artifacts/api-server/src/routes/dashboard.test.ts
artifacts/api-server/src/routes/onboarding.ts
artifacts/api-server/src/routes/onboarding.test.ts
artifacts/atlas/src/pages/onboarding.tsx
docs/phases/phase-21-onboarding-enrollment-resume.md
HANDOFF.md   (this file)
```

### Modified files
```
artifacts/api-server/src/routes/index.ts          (+3 router.use)
artifacts/atlas/src/App.tsx                       (+/onboarding route)
artifacts/atlas/src/components/StartHereCard.tsx  (CTA wired)
lib/api-spec/openapi.yaml                         (+4 endpoints, +6 schemas)
replit.md                                         (Current Phase Status + Phase History)
```

### Regenerated (codegen — do not hand-edit)
```
lib/api-client-react/src/generated/api.ts
lib/api-client-react/src/generated/api.schemas.ts
lib/api-zod/src/generated/api.ts
lib/api-zod/src/generated/types/*.ts   (9 new files)
```

---

## 4. Everything that failed or required correction

### 4a. Architect Round 1 — FAIL (2 criticals)

1. **Enrollment not race-safe.** `findFirst → INSERT` had no unique-violation recovery. Concurrent retry / double-click would surface SQLSTATE 23505 from `progress_user_project_idx` as a 500, breaking the "idempotent" contract.

   **Fix** (`artifacts/api-server/src/routes/enrollment.ts`): wrapped INSERT in try/catch, on `err.code === "23505"` re-reads via the same `findFirst` helper and returns 200 `created:false`. Non-23505 errors still surface as 500 (preserves failure visibility).

2. **`recommendedStartHere` fresh-learner gate used the wrong set.** Gate was `enriched.length === 0` (visible-filtered), so a user whose only enrollment pointed at a since-hidden slug was treated as fresh and re-recommended → silent double-enrollment risk.

   **Fix** (`artifacts/api-server/src/routes/dashboard.ts`): gate now `progressRows.length === 0` (raw count BEFORE visibility filter). Hidden-only users are correctly not-fresh.

### 4b. Regression tests added in response

- `enrollment.test.ts`: "23505 → re-read → 200 created:false"
- `enrollment.test.ts`: "non-23505 still surfaces as 500" (regression guard against over-broad catch)
- `enrollment.test.ts`: "missing-vs-hidden 404 body byte-identical"
- `dashboard.test.ts`: "hidden-only enrollments → empty lists + recommendedStartHere null"

### 4c. Minor corrections during build

- `users.estimatedHours` does NOT exist on `projects` schema — column is `estimatedMinutes`. Dashboard had to convert via `/60` before feeding `pickStartHere`.
- api-server doesn't import `zod` directly — used hand-rolled validation in `enrollment.ts`.
- `vi.fn()` with an explicit return-type can't accept rest args — needed `(_table: unknown) => insertFn()` pattern instead of spread.
- A mid-task checkpoint commit (`a39b365`) already included the initial route files before the architect fixes; the final commit (`09b973d`) layered the fixes + tests + docs on top. No squashing was attempted.

### 4d. Architect Round 2 — PASS

Both criticals resolved. No new severes. Optional hardening note (deferred): centralize `err.code === "23505"` detection into a helper if a future DB driver swap changes error shape.

---

## 5. Next step — proposed Phase 22 (DO NOT START)

### Recommendation: **Phase 22 — Dashboard UI + Workspace Resume Wiring**

**Rationale.** Phase 21 shipped the API and the onboarding entry point, but the existing `/dashboard` page predates the new `/api/dashboard` endpoint and does not consume it. Users who complete onboarding land in `/projects/:slug` (good) but if they later visit `/dashboard` they get the legacy view with no resume CTA, no "what's next," and no recommendation surface. This is the highest-leverage gap because it directly closes the onboarding-to-retention loop with **no schema or content risk**.

### Scope (in)
- Rewrite `/dashboard` page to consume `useGetDashboard` (the codegen hook already exists from P21).
- Render: `ResumeCard` (uses `resume.projectSlug` + `currentStepNumber` for deep link), `InProgressList`, `CompletedList`, and a `RecommendedStartHereCard` that only shows when the API returns one (fresh learner path).
- Empty-state copy for the truly-fresh signed-in user who somehow skipped onboarding (sends them to `/onboarding`).
- A small `/workspace/:slug?step=N` deep-link contract — confirm or fix the existing workspace route so `resume.currentStepId` lands the user on the right step.

### Scope (out — hard)
- No new API endpoints. (P21 already covers it.)
- **No schema / content / rubric / anchor / archive / taxonomy / Stripe / AI changes.** Same overlay-only discipline as P21.
- No anonymous-user intent capture (deferred — needs auth flow design).
- No multi-course recommendation logic — `recommendedStartHere` stays hard-coded to `data-engineering` until a future "interest picker" phase.
- No instrumentation / analytics — separate phase.

### Risks
1. **Existing `/dashboard` page may have non-trivial logic** (e.g. legacy progress reads) that needs careful unwinding so we don't lose existing-user-visible behavior. *Mitigation: read the existing page first; gate the rewrite behind feature parity (no removed information).*
2. **`/workspace/:slug?step=N` deep link.** If the workspace route ignores `?step=`, the resume link is misleading. *Mitigation: confirm + add an integration test before shipping the dashboard rewrite.*
3. **React Query cache freshness.** After `POST /enrollments` from `StartHereCard`, the dashboard's `useGetDashboard` cache may be stale on next visit. *Mitigation: invalidate `["dashboard"]` query key on enrollment success.*

### Constraints
- Pure frontend phase. Zero server-side code changes expected.
- Codegen hooks must be used as-is (no edits to `lib/api-client-react/src/generated/*`).
- Test floor: maintain 256/256 with at least +6 new tests covering the dashboard page render paths (fresh, has-resume, completed-only, hidden-only enrollment → empty).
- Preserve all 9-course / rubric / anchor / lineage invariants (no risk in a frontend-only phase, but the gates must still be re-run as part of T-final).

### Gates Phase 22 must clear before SHIP
1. `pnpm run typecheck` clean (chains heuristic guard).
2. All 3 test suites green; ≥262/262.
3. `author:project anchor-check` drift 0.00 — should be untouched.
4. `author:project wave-report` 54/54 — untouched.
5. `audit:pedagogy` 56/56 visible — untouched.
6. Architect PASS on the rewritten dashboard page + deep-link contract.
7. Live smoke: fresh user, returning user with one in-progress, returning user with one completed, hidden-only edge case.

### Alternative phases considered (and why not first)

- **Phase 22-alt: Anonymous intent capture for `StartHereCard`.** Currently anon clicks fall through to sign-in but the chosen project is lost. Real UX win, but needs auth-flow design + a server-side "pending intent" persisted somewhere — schema risk. Defer.
- **Phase 22-alt: Multi-course `recommendedStartHere`.** Needs an interest picker on `/onboarding` step 1. Worth doing, but onboarding already works; this is polish, not retention-critical.
- **Phase 22-alt: Atlas Studio / curriculum authoring UI.** Big surface area, would need its own dedicated multi-phase arc.
- **Phase 22-alt: Stripe upgrade flow polish.** Stripe was last touched in early phases and is stable; no user-reported bugs. Lower leverage right now.

---

## 6. Housekeeping notes

- `replit.md` is **159 lines** (just over the 150-line guideline). At a natural pause, trim "Current Phase Status" down to the latest 1–2 phases — the Phase History section already carries the full lineage. Not blocking.
- `wave-report` shows `54/54` while `audit:pedagogy` shows `56/56`. This 54-vs-56 discrepancy was already present at the close of Phase 20 (it appears the wave-report denominator lags the latest 2 promotes by one phase). Not a Phase 21 regression. Worth confirming if a future phase touches wave logic.
- `pedagogy` audit lists 10 legacy (hidden) slugs as "missing or partial" — that's the archive cohort by design; they're filtered out of the visible-only KPI which reads 56/56.
- HEAD commit at handoff time: `09b973d` ("Add onboarding, enrollment, and dashboard resume functionality").
