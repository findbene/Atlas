# Atlas — Session Handoff

**HEAD:** `65a0e1b571b5f7cc72c678d9a8cea13d71925b14`
**Commit message:** _Introduce a separate check for step submissions without committing_
**Previous HEAD:** `270437a508d63ec18c861bfc5fd96f17a0b3f58f` (Phase 23)
**Working tree:** clean. Phase 24 is COMMITTED.

**Final gate summary:**
- Tests: **313/313 passing** (api-server 208 + atlas 41 + curriculum-quality 60 + execution-core 4).
- Typecheck: PASS.
- `check:no-heuristic-runtime`: PASS.
- Architect: **PASS** (round 5, after R1–R4 each caught a distinct phase-hijack class).
- Invariants intact: visible 56, hidden 32, beginner 10, wave 56/56, pedagogy 56/56 visible, anchorCount=2, anchor drift 0.00/0.00, lineage 0/0/0/0, 9-course taxonomy intact, rubric v1.0.1 frozen.

**Proposed next phase:**
- **Phase 25 — Validation Result UI + Remediation Panel** — **NOT STARTED**. Build on the Phase-24 reducer surface to render richer feedback for `CheckResult` / `SubmitResult` (rubric breakdown, per-criterion remediation suggestions, "fix and re-check" affordance). No schema / API / content / rubric / taxonomy / PWA changes anticipated; purely a frontend overlay on `ValidationFeedbackPanel` + new remediation surface fed by data already on the wire. Plan before implement.

---

## 1. Goal we are working toward

Atlas learner-ready platform.

Phase ship history (most recent first):

- **Phase 24 — Check vs Submit Separation / State Machine** — SHIPPED.
- **Phase 23 — Workspace Auto-Resume / Step Deep-Link Support** — SHIPPED.
- **Phase 22 — Dashboard UI + Workspace Resume Wiring** — SHIPPED.
- **Phase 21 — Onboarding + Enrollment + Resume** — SHIPPED.

## Phase 24 summary (this session)

**Goal:** Separate "Check" (provisional, zero DB writes, no XP / no
celebration) from "Submit" (committed grade, XP, confetti, auto-advance).
Drive the workspace through an explicit reducer state machine so late
async responses, edits, and local Run paths can never trigger false
celebration or drop a committed result.

**Server changes:**
- New `artifacts/api-server/src/lib/grading.ts` — shared scoring helper
  + `NO_CHECK_STEP_TYPES` allowlist (self_attest, reflection,
  concept_check, file_upload all skip Check).
- New `POST /api/user/projects/:projectId/steps/:stepId/check` returns
  `CheckResult { status, feedback }` only. Zero DB writes. Enrollment
  403 runs BEFORE step lookup; missing/wrong-project step → 404; skip
  types → 400.
- `/submit` refactored to call the helper. Response shape byte-identical.
- OpenAPI extended; codegen regenerated → `useCheckStep` hook.

**Frontend changes:**
- New `artifacts/atlas/src/lib/workspaceStepMachine.ts` reducer:
  phases `editing | checking | check_passed | check_failed | submitting
  | submit_passed | submit_failed`. Terminal actions (CHECK_PASS/FAIL,
  SUBMIT_PASS/FAIL) are PHASE-GUARDED — they no-op unless the matching
  start phase is current. This makes late async responses after a
  RESET (step nav) silently drop.
- Local-grading paths (SQL Run, empty-input check, empty-input submit)
  emit START before their terminal action so the phase-guard accepts
  them from `editing`.
- `EDIT` no-ops during `checking` or `submitting` to prevent a
  learner typing in the editor from hijacking phase out of a pending
  request and causing the submit response to be dropped.
- `runCode()` early-returns when `!checkEnabled(stepState)`; Run
  button disabled when any check/submit is in flight.
- Display: `isProvisional(state) ? lastCheck : lastSubmit`.
- `ValidationFeedbackPanel` shows a "Provisional" tag and suppresses
  celebration UI when result is provisional.
- Confetti / celebration / auto-advance fire EXCLUSIVELY when
  reducer transitions to `submit_passed`.

**Tests:** 281 → 313 passing.
- api-server: 192 → 208 (+10 grading helper, +6 /check route).
- atlas: 25 → 41 (+13 reducer unit tests, +3 regression tests covering
  local-grading START pairing, Run/EDIT hijack defense, late-response
  drop after RESET; workspace component test updated for `useCheckStep`
  mock).
- curriculum-quality: 60, execution-core: 4 (unchanged).

**Architect rounds:** R1 → R2 → R3 → R4 FAIL, **R5 PASS**. Each round
caught a phase-hijack class:
- R1: display selection picked submit when provisional should win.
- R2: 3 local-grading call sites dispatched terminal-only and were
  silently dropped by the new phase-guard.
- R3: Run during pending submit hijacked phase via the SQL local-grade
  CHECK_START → SUBMIT_PASS dropped.
- R4: EDIT during pending submit hijacked phase the same way.

**Hard stops respected:** Zero changes to schema, content, rubric,
taxonomy, anchors, PWA, Stripe, AI tutor, cloud creds.

**Invariants:** visible 56, hidden 32, beginner 10, wave 56/56,
pedagogy 56/56 visible, anchorCount=2, anchor drift 0.00, lineage
0/0/0/0, 9-course taxonomy intact, rubric v1.0.1 frozen.

---

## 2. Current state of the code (post-Phase-23)

The workspace (`/projects/:slug`) now does safe auto-resume:

- `?step=N` wins when valid (1-indexed, strict positive integer) and is
  clamped to `[1, totalSteps]`. Out-of-range values self-correct (e.g.
  `?step=999` on a 5-step project rewrites to `?step=5`).
- When no URL param, seeds `currentStepIdx` from
  `progress.currentStepPosition` once **both** enrollment and the progress
  query have actually resolved (`progressLoaded = enrolled ? progressFetched
  : enrollError !== null`).
- Otherwise falls back to step 0.
- Loading skeleton holds while `currentStepIdx === null` — no step-0 flash
  over the learner's intended landing step.
- Browser back/forward triggers a `popstate` handler that re-clamps from
  the URL; missing/invalid params are intentionally ignored (so back from a
  non-workspace page doesn't reset to step 0).
- `goToStep` writes the new step to URL via `replaceState` (not
  `pushState` — workspace back-button still exits the workspace, doesn't
  walk backwards through steps).
- SPA navigation between two `/projects/:slug` routes without remount
  resets `resumeAppliedRef` and `currentStepIdx` inside the existing
  auto-enroll effect, so the new project re-resolves cleanly.
- All 0↔1 indexing flows through a single helper module
  (`lib/workspaceStepUrl.ts`) — server, URL, and UI cannot drift.

**Zero changes to:** schema, server, API, OpenAPI, codegen, content,
rubric, anchors, taxonomy, Stripe, AI tutor, cloud creds, PWA.

---

## 3. Files changed in Phase 23

- `artifacts/atlas/src/lib/workspaceStepUrl.ts` (new) — sole owner of
  0↔1 conversion: `parseStepParam`, `clampStepIdx`, `idxToStepNumber`,
  `buildStepSearch`, `resolveInitialStepIdx` (URL → progress → null
  precedence).
- `artifacts/atlas/src/pages/project-workspace.tsx` (edited) —
  `currentStepIdx` becomes `useState<number | null>(null)` with
  `resumeAppliedRef` one-shot guard; resume `useEffect`, `popstate`
  listener, `goToStep` URL sync, project-id reset, skeleton hold.
- `artifacts/atlas/src/lib/workspaceStepUrl.test.ts` (new) — 15 pure-
  function unit tests covering parse strictness, clamp edges, search
  building, all precedence rows.
- `artifacts/atlas/src/pages/project-workspace.test.tsx` (new) — 3
  component-level lifecycle tests: async-enroll progress seeding, URL
  `?step=999` clamp + self-correct to `?step=5`, skeleton-holds-no-flash
  while enroll pending.
- `docs/phases/phase-23-workspace-auto-resume.md` (new) — full phase log.
- `replit.md` (edited) — Current Phase Status + Phase History entries.

---

## 4. Everything tried that failed or required correction

**Architect round 1 → FAIL.** Two real bugs caught:

1. **Premature resume resolution.** The first draft gated on
   `progressLoaded: progressFetched || !enrolled`. Since `enrolled` starts
   `false`, the `!enrolled` arm fired immediately on mount, resolved
   `currentStepIdx` to 0 before the progress query could fetch, and the
   one-shot `resumeAppliedRef` then blocked real progress from applying.
   Returning learners still landed on step 1 — the exact bug the phase
   was meant to fix.
   - **Fix:** `progressLoaded = enrolled ? progressFetched : enrollError
     !== null`. URL `?step=N` short-circuits inside
     `resolveInitialStepIdx`, so the gating only matters for the no-URL
     case, which now correctly waits for enrollment.

2. **Project-change race / stale resume.** `resumeAppliedRef` and
   `currentStepIdx` were never reset on `project.id` change, so SPA
   navigation between `/projects/:slug` routes (no remount) carried the
   prior project's resolved step into the new one.
   - **Fix:** Reset both inside the existing auto-enroll `useEffect`
     keyed on `project?.id`, alongside the existing `setEnrolled(false)`
     / `setEnrollError(null)` reset.

3. **Insufficient test coverage.** The 15 pure-function helper tests
   were correct but didn't exercise the real component lifecycle where
   the failure occurred.
   - **Fix:** Added 3 component-level tests with mocked
     `@workspace/api-client-react` hooks (stubbed `StudioShell` to a
     marker that exposes `data-step-idx`).

**Architect round 2 → PASS.** Bug 1 confirmed resolved, bug 2 confirmed
real fix, popstate-ignore-on-missing-param confirmed acceptable. Round-2
suggestions (same-component slug-swap integration test; stale-enroll-
callback hardening; re-resolve-on-popstate-without-step semantic) were
noted as nice-to-haves, not required for scope.

---

## 5. Final gates

| Gate | Result |
|---|---|
| `pnpm run typecheck` | clean |
| `check:no-heuristic-runtime` | OK (4-entry allowlist intact) |
| api-server tests | **192/192** |
| curriculum-quality tests | **60/60** |
| execution-core tests | **4/4** |
| atlas tests | **25/25** (was 7; +15 helper + 3 lifecycle) |
| **Total tests** | **281/281** (floor was 267) |
| `author:project anchor-check` | drift **0.00 / 0.00** |
| `author:project wave-report` | **54/54** passing |
| `audit:pedagogy` | **56/56** visible |
| Architect | **PASS** (round 2) |

**Catalog invariants unchanged:** visible 56, hidden 32, beginner 10,
zero-beginner courses 0, `anchorCount=2`, lineage 0/0/0/0, 9-course
taxonomy intact, rubric `v1.0.1` frozen.

### Exact command summary

```bash
pnpm run typecheck
pnpm --filter @workspace/api-server run test
pnpm --filter @workspace/curriculum-quality run test
pnpm --filter @workspace/execution-core run test
pnpm --filter @workspace/atlas run test
pnpm --filter @workspace/scripts run author:project anchor-check
pnpm --filter @workspace/scripts run author:project wave-report
pnpm --filter @workspace/scripts run audit:pedagogy
```

---

## 6. Recommended next step

### Phase 24 — Check vs Submit Separation / State Machine (PLAN, do not implement yet)

**Proposed goal:**

- Separate **low-stakes step checks** (run code, test against expected
  output, get fast feedback) from **high-stakes final project
  submission** (commits XP, marks project complete, triggers
  confetti/celebration).
- Define and implement an explicit frontend **state machine** for step
  status (e.g. `idle → running → check_failed | check_passed →
  submitting → submitted`).
- Ensure ordinary checks do **not** trigger final completion side-effects
  (no premature `projectComplete: true`, no early confetti, no XP double-
  counting).
- Lay the foundation for **validation-gated completion** and **earned
  confetti** in later phases (a check passing isn't the same as a project
  being done).

**Why it should be planned before implementation:**

- Current `useSubmitStep` mutation in `project-workspace.tsx` conflates
  "run + grade" with "commit". The auto-advance + celebration trigger
  fire from inside the `onSuccess` handler of the same mutation that
  also writes step completion to the DB. Untangling that needs a
  contract decision (likely two endpoints: `POST /api/steps/:id/check`
  vs `POST /api/steps/:id/submit`) before any FE/BE code changes — and
  that crosses the schema/API line we've held flat for Phases 21–23.
- Need to decide whether "check" persists (run history, hint policy,
  attempt counter) or is purely client-side.
- Need to map the state machine onto the existing
  `step_completions.status` enum (`pending|passed|failed|skipped`) and
  decide if a new `checked` state is needed.

**Suggested plan deliverables before code:**

1. Endpoint contract diff (OpenAPI sketch, but **not** yet codegened).
2. State-machine diagram + transition table.
3. Schema delta (if any) + migration plan.
4. Test inventory (which existing tests will need updates).
5. Architect-reviewed plan doc at `docs/phases/phase-24-plan.md`.

### Optional housekeeping (not blocking)

- `replit.md` is ~167 lines and growing one fat paragraph per phase.
  Trimming/reorganizing the older Phase History entries into one-line
  summaries (keeping only the last 2–3 phases verbose) would be useful
  at a natural pause. Not required for Phase 24 to start.

---

## Hard stop reminder

This handoff is documentation only. Phase 24 is **not started**. No
schema, server, API, OpenAPI, codegen, rubric, content, taxonomy, or PWA
work has been done in this session beyond the Phase 23 deliverables
already shipped and committed at `270437a`.
