# Atlas — Session Handoff

**HEAD:** `f5799ac95f47a7fb90d075d7e60851e460b94cb0`
**Subject:** Update dashboard to use new API endpoint for project data
**Working tree:** clean for tracked files. All Phase 22 changes are committed. Only untracked path is `attached_assets/Pasted-Excellent-Phase-22-is-accepted-as-SHIPPED-_1779689582889.txt` (user-attached note, not project content).

---

## 1. Goal

Build Atlas — a learner-ready, project-based Data Engineering / AI / MLOps platform — phase by phase, with strict catalog invariants and architect-reviewed gates.

- **Phase 21 — Onboarding + Enrollment + Resume** — SHIPPED (`docs/phases/phase-21-onboarding-enrollment-resume.md`)
- **Phase 22 — Dashboard UI + Workspace Resume Wiring** — SHIPPED (`docs/phases/phase-22-dashboard-ui-resume-wiring.md`)
- **Phase 23 — Workspace Auto-Resume / Step Deep-Link Support** — PROPOSED, NOT STARTED

---

## 2. Current state of the code

### What Phase 22 shipped (frontend-only overlay on the P21 endpoints)

**Dashboard migration**
- `/dashboard` now consumes the single P21 `useGetDashboard()` endpoint for resume / in-progress / completed / recommendation.
- Dropped legacy `useResumeProject` (`GET /api/projects/resume` fetch) and `useListUserProjects` client-filtering.
- XP / streak / level / weekly-XP chart / leaderboard preserved verbatim (independent queries: `useGetUserStats`, `useGetLeaderboard`).
- Resume CTAs link to `/projects/:slug` only — no `?step=N`, no copy promising exact step landing.
- Dropped static "Ready to build" CTA (superseded by recommendation card).
- Dropped JobOutcomes button on dashboard cards — not in `DashboardEnrollment` payload; still available on project detail page.

**New `RecommendedStartHereCard`** (`artifacts/atlas/src/components/RecommendedStartHereCard.tsx`)
- Renders only when server returns a recommendation. Server only does so for fresh learners (raw `progressRows.length === 0`), so hidden-only-enrolled users do NOT see it.
- CTA: idempotent slug-based enroll → invalidate dashboard query → navigate.

**New Completed section**
- Sourced from `useGetDashboard().completed`.

**Dashboard query invalidation on enroll — 3 sites, all via `onSettled`**
- `artifacts/atlas/src/components/StartHereCard.tsx`
- `artifacts/atlas/src/pages/onboarding.tsx` (finish step)
- `artifacts/atlas/src/components/RecommendedStartHereCard.tsx`
- `onSettled` (not `onSuccess`) so a committed-write-with-failed-response still refreshes the dashboard.

**New atlas test infrastructure**
- `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `@testing-library/dom` (devDependencies).
- `artifacts/atlas/vitest.config.ts` (jsdom env, `@/` alias, css disabled).
- `artifacts/atlas/src/test/setup.ts` (jest-dom matchers, ResizeObserver stub for Recharts/Radix, non-zero bounding-rect for ResponsiveContainer).
- `"test": "vitest run"` script added.

**Error-path hardening** (architect round 1 fix)
- When `/api/dashboard` errors, In Progress and Completed sections render per-section "Couldn't load your projects." placeholders (`data-testid="in-progress-error-placeholder"` / `"completed-error-placeholder"`) instead of the misleading "No projects yet" empty-state copy. Top-level inline retry banner remains.

### Final test counts: **263 / 263**

| Suite | Count |
|---|---|
| api-server | 192 |
| curriculum-quality | 60 |
| execution-core | 4 |
| atlas (new in P22) | 7 |
| **Total** | **263** |

### Architect review

- **Round 1: FAIL** — flagged false-empty section states when `/api/dashboard` errors (sections defaulted to `[]` and rendered "No projects yet" while the real cause was a fetch failure).
- **Fix** — gated section bodies on `!dashboardError`, added per-section error placeholders, added explicit suppression assertions in the error test.
- **Round 2: PASS.**

### Catalog invariants preserved

| Invariant | Value |
|---|---|
| Visible projects | 56 |
| Hidden projects | 32 |
| Beginner-tier visible | 10 |
| `anchorCount` | 2 |
| Anchor drift | 0.00 / 0.00 |
| Lineage failures (4 modes) | 0 / 0 / 0 / 0 |
| Wave-report | 54 / 54 |
| Pedagogy KPI (visible) | 56 / 56 |
| 9-course taxonomy | intact |
| Rubric version | `1.0.1` (frozen) |

Zero server / schema / OpenAPI / codegen / content / rubric / taxonomy / Stripe / AI / cloud-creds changes.

---

## 3. Files actively edited in Phase 22

```
M  artifacts/atlas/src/pages/dashboard.tsx
A  artifacts/atlas/src/components/RecommendedStartHereCard.tsx
M  artifacts/atlas/src/components/StartHereCard.tsx
M  artifacts/atlas/src/pages/onboarding.tsx
A  artifacts/atlas/src/pages/dashboard.test.tsx
A  artifacts/atlas/vitest.config.ts
A  artifacts/atlas/src/test/setup.ts
M  artifacts/atlas/package.json
A  docs/phases/phase-22-dashboard-ui-resume-wiring.md
M  replit.md
M  pnpm-lock.yaml
```

`artifacts/atlas/src/pages/project-workspace.tsx` was inspected read-only and **not edited**.

---

## 4. Everything tried that failed or required correction

### Workspace auto-resume does NOT currently exist
Confirmed by read-only inspection of `artifacts/atlas/src/pages/project-workspace.tsx`:

```ts
const [currentStepIdx, setCurrentStepIdx] = useState(0);
```

- No `?step=N` URL parsing on mount.
- No `popstate` listener.
- No sync from `useGetUserProjectProgress().currentStep` (or max-passed `stepCompletion`) into `currentStepIdx`.
- Every workspace session starts at step 0; user must manually navigate forward.

Phase 22 deliberately did not modify this — out of approved scope. This is the entire scope of the proposed Phase 23.

### Architect round 1 regression
- Failure mode: when the dashboard API errored, `inProgress` / `completed` defaulted to `[]` and the section bodies rendered the "No projects in progress yet" / "No completed projects yet" empty states — lying about user state.
- Fix: gated both section bodies on `!dashboardError`, added per-section error placeholders, updated the error test to assert placeholders present AND empty-state copy absent.

### Lockfile reconcile after `pnpm --filter atlas add -D`
- After installing atlas devDeps, the api-server's `vitest` types briefly looked unresolved. Running `pnpm install` at the workspace root reconciled the lockfile and api-server typecheck + tests went back to green. Worth remembering: after any per-package add, re-run root `pnpm install` if other packages start failing.

---

## 5. Next step

### Recommended: Phase 23 — Workspace Auto-Resume / Step Deep-Link Support

**Goal.** Close the gap documented in Phase 22 so the workspace honors server-side progress and supports deep links.

**Proposed scope**
1. Parse `?step=N` (1-indexed) on workspace mount; bounds-check against `steps.length`; clamp out-of-range to last step.
2. If no URL param, seed `currentStepIdx` from `progress.currentStep` (or, lacking that, from `max(stepCompletion where passed) + 1`).
3. Update URL on `goToStep` via `history.replaceState` so reloads / shares preserve position.
4. `popstate` listener to keep state and URL in sync on back/forward.
5. Optionally extend dashboard / course-detail / in-progress-row resume CTAs to attach `?step=` for single-click resume (separate decision — could be deferred).
6. New tests covering deep-linking, clamping, progress→idx seeding, and popstate.

**Hard stops / constraints**
- Frontend-only.
- No server / schema / codegen / OpenAPI / content / rubric / taxonomy / Stripe / AI / cloud-creds changes.
- No copy that promises an exact step landing if `progress.currentStep` is null.

**Risks**
- `progress` query timing: avoid flashing step 0 before progress resolves. Either suspend mount until progress settles, or render a skeleton in the workspace shell.
- Step indexing collisions: server is 1-indexed (`currentStep`), local UI is 0-indexed (`currentStepIdx`). Centralize the conversion.
- Test infra: extend the new atlas vitest setup to cover workspace render with mocked progress + URL.

**Gates (must pass)**
- `pnpm run typecheck` clean (includes `check:no-heuristic-runtime`).
- All existing suites still pass.
- New workspace tests ≥ 4.
- Total ≥ 267/267.
- `anchor-check` drift 0.00, `wave-report` 54/54, `audit:pedagogy` 56/56.
- Architect PASS.

### Optional housekeeping (NOT blocking)
- `replit.md` is now **165 lines**. Current Phase Status holds two full entries (P21 + P22) and the Phase History is long.
- At a natural pause: trim Current Phase Status to the most recent phase only, archive older entries into Phase History, and consider extracting Phase History into `docs/phases/INDEX.md`.

---

## Exact command / gate summary (re-run to verify)

```bash
# Typecheck (chains check:no-heuristic-runtime)
pnpm run typecheck

# Test suites
pnpm --filter @workspace/api-server          run test   #  → 192/192
pnpm --filter @workspace/curriculum-quality  run test   #  →  60/60
pnpm --filter @workspace/execution-core      run test   #  →   4/4
pnpm --filter @workspace/atlas               run test   #  →   7/7
# Total: 263/263

# Catalog invariants
pnpm --filter @workspace/scripts run author:project anchor-check   # drift 0.00 / 0.00
pnpm --filter @workspace/scripts run author:project wave-report    # 54/54
pnpm --filter @workspace/scripts run audit:pedagogy                # 56/56 visible
```

---

## Hard stop for this handoff

- Documentation/handoff only.
- No Phase 23 implementation.
- No new feature work.
- No schema changes.
- No API / server changes.
- No rubric / content / taxonomy changes.
