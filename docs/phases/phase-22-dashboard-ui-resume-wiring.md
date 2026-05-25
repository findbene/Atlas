# Phase 22 — Dashboard UI + Workspace Resume Wiring

**Status:** CLOSED · SHIP
**Scope:** Pure frontend overlay on the Phase 21 endpoints.
**Tests:** 256 → **263/263** (api-server 192 + curriculum-quality 60 + execution-core 4 + atlas 7 new).

## Objective

Migrate `/dashboard` resume / in-progress / completed / recommendation surfaces from the legacy combo of `GET /api/projects/resume` + `useListUserProjects` to the single P21 `GET /api/dashboard` endpoint. Invalidate the dashboard query after every enrollment so the next visit reflects new state without a hard reload. Preserve XP / streak / level / weekly-XP chart / leaderboard verbatim.

## Hard constraints (all honored)

- **Zero** server, schema, OpenAPI, codegen, content authoring, rubric, taxonomy, Stripe, AI tutor, or cloud-credentials changes.
- **No edits** to `artifacts/atlas/src/pages/project-workspace.tsx` — read-only inspection only.
- **No `?step=N` deep-linking** introduced; resume CTAs link to `/projects/:slug` only; copy does not promise exact step landing.
- **Phase 11 not rerun.**

## What changed

### Dashboard (`artifacts/atlas/src/pages/dashboard.tsx`)
- Replaced hand-rolled `useResumeProject` (`GET /api/projects/resume` fetch) + `ResumePayload` interface with `useGetDashboard().resume`.
- Replaced `useListUserProjects` client-filtered in-progress list with `useGetDashboard().inProgress`.
- **Added** a Completed section sourced from `useGetDashboard().completed`.
- **Added** `<RecommendedStartHereCard>` rendered only when `useGetDashboard().recommendedStartHere` is non-null. Server only returns a recommendation for fresh learners (raw progressRows.length === 0), so hidden-only-enrolled users do not see it.
- **Dropped** the static "Ready to build something?" CTA (superseded by the recommendation card).
- **Dropped** the JobOutcomes button on each in-progress card — `DashboardEnrollment` does not carry `jobOutcomes`, and attaching a parallel `/api/projects` fetch purely to re-attach it would defeat the consolidation. Job outcomes remain available on the project detail page itself.
- **Loading**: skeleton block for the dashboard surface; stats / streak / leaderboard render independently (different queries).
- **Error**: top-level inline retry banner. Per-section "Couldn't load your projects." placeholders replace the would-be "No projects yet" empty-state copy so we don't lie about user state when the API failed. (Fix surfaced by architect review round 1.)
- **Defensive fully-empty fallback**: rare case where API succeeds but returns no resume, no enrollments, AND no recommendation → CTA to `/onboarding`. Normally a fresh learner always receives a recommendation; this catches the edge where the recommendation course is itself empty.

### New component (`artifacts/atlas/src/components/RecommendedStartHereCard.tsx`)
- Visual contract mirrors `StartHereCard` (course-detail.tsx).
- CTA: idempotent slug-based enroll → invalidate `getGetDashboardQueryKey()` → navigate to `/projects/:slug`.
- Invalidation runs in `onSettled` (fires once per mutation regardless of success / error) so a committed-write-with-failed-response still refreshes the dashboard.

### Cache invalidation on enrollment
- `artifacts/atlas/src/components/StartHereCard.tsx` — invalidates dashboard query on `useCreateEnrollment` `onSettled`.
- `artifacts/atlas/src/pages/onboarding.tsx` — invalidates dashboard query on enroll step `onSettled` (before marking onboarding complete).
- `RecommendedStartHereCard.tsx` (new) — same pattern.

### New test infrastructure (atlas)
- Added `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `@testing-library/dom` as devDependencies.
- New `artifacts/atlas/vitest.config.ts` (jsdom env, `@/` alias, css disabled).
- New `artifacts/atlas/src/test/setup.ts` (jest-dom matchers, ResizeObserver stub for Recharts/Radix, non-zero bounding-rect for ResponsiveContainer).
- New `test` script on `@workspace/atlas`.

### New tests (`artifacts/atlas/src/pages/dashboard.test.tsx`, 7 cases)
1. **Fresh learner** — recommendation visible, no resume banner, both lists empty-state, no defensive fallback.
2. **Has resume** — banner rendered with correct title, step counter visible inside the banner, href is `/projects/:slug` with no `step=` query.
3. **In-progress only** — list populated, completed empty, no recommendation, no banner.
4. **Completed only** — completed list populated, no banner, no recommendation, in-progress empty-state shown.
5. **Hidden-only enrollment edge case** — empty lists + null recommendation → defensive `/onboarding` fallback, NOT a fresh-learner recommendation card.
6. **Error** — retry button calls `refetch`, stats row still renders, per-section error placeholders shown, the misleading "No projects yet" empty-state copy suppressed.
7. **RecommendedStartHereCard CTA** — invalidates the `/api/dashboard` query key on enroll.

## Workspace resume gap → Phase 23 candidate

Read-only inspection of `project-workspace.tsx` confirms:

```ts
const [currentStepIdx, setCurrentStepIdx] = useState(0);
```

There is **no** URL parsing (no `?step=N`), **no** `popstate` listener, and **no** sync from `useGetUserProjectProgress().currentStep` to `currentStepIdx`. Every workspace session starts at step 0; the user must manually navigate forward. The dashboard's "Pick up where you left off" CTA therefore correctly takes the user back to the project, but the workspace itself does not honor the server's `currentStep` cursor.

**Phase 22 deliberately does not fix this** (out of approved scope). Phase 23 candidate work:
1. Parse `?step=N` (1-indexed) on workspace mount; bounds-check against `steps.length`.
2. If no URL param, seed `currentStepIdx` from `progress.currentStep` (or, lacking that, from the max `passed` stepCompletion + 1).
3. Update URL on `goToStep` via `history.replaceState` so reloads / shares preserve position.
4. Resume CTAs (dashboard banner, in-progress rows, course-detail) gain an optional `?step=` for a true single-click resume.
5. New tests covering URL deep-linking and step-bound clamping.

## Architecture / invariance

- `RUBRIC_VERSION='1.0.1'` — frozen.
- Catalog visible **56**, hidden **32**, beginner **10**, wave **54/54**, pedagogy **56/56 visible**, `anchorCount=2`, anchor drift **0.00/0.00**, lineage **0/0/0/0**, 9-course taxonomy intact.
- No new endpoints, no new schemas, no new env vars, no new secrets.
- Legacy `GET /api/projects/resume` server route remains (potential non-dashboard consumers); only the dashboard stops consuming it. Removal is a future cleanup phase.

## Architect review

- **Round 1**: FAIL — flagged false-empty section states when the dashboard API errors (sections defaulted to `[]` and rendered "No projects yet" while the real cause was a fetch failure).
- **Fix**: gated both section bodies on `!dashboardError`; rendered per-section "Couldn't load your projects." placeholders instead. Added explicit assertions to the error test case that the misleading empty-state copy is suppressed.
- **Round 2**: PASS.

## Final gates

| Gate | Result |
|---|---|
| `pnpm run typecheck` (chains `check:no-heuristic-runtime`) | ✅ clean |
| api-server tests | 192/192 |
| curriculum-quality tests | 60/60 |
| execution-core tests | 4/4 |
| atlas tests (new) | 7/7 |
| **Total tests** | **263/263** (floor was 262) |
| `author:project anchor-check` | drift 0.00 / 0.00 |
| `author:project wave-report` | 54/54 |
| `audit:pedagogy` (visible KPI) | 56/56 |
| Architect | PASS (round 2) |

## Files changed

```
M  artifacts/atlas/package.json                      (+ test script, + devDeps)
M  artifacts/atlas/src/pages/dashboard.tsx           (migration)
M  artifacts/atlas/src/pages/onboarding.tsx          (invalidation)
M  artifacts/atlas/src/components/StartHereCard.tsx  (invalidation)
A  artifacts/atlas/src/components/RecommendedStartHereCard.tsx
A  artifacts/atlas/src/pages/dashboard.test.tsx
A  artifacts/atlas/vitest.config.ts
A  artifacts/atlas/src/test/setup.ts
A  docs/phases/phase-22-dashboard-ui-resume-wiring.md
M  replit.md
M  pnpm-lock.yaml
```

## Out of scope (explicit)

- project-workspace.tsx edits (read-only inspection only).
- `?step=N` deep-linking and workspace step-resume — Phase 23 candidate.
- Removal of the legacy `GET /api/projects/resume` server route.
- Any server / schema / codegen / OpenAPI / content / rubric / taxonomy / Stripe / AI / cloud-creds changes.
