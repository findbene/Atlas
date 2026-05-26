# Atlas — Session Handoff

**HEAD:** `7c5662565ddbc328d01c3e5c6e90cd7c4fd688cf` (Phase 24 docs update)
**Previous HEAD:** `65a0e1b571b5f7cc72c678d9a8cea13d71925b14` (Phase 24 ship)
**Working tree:** Phase 25 implementation NOT YET COMMITTED — see §Commit commands below.

**Final gate summary (Phase 25):**
- Tests: **346/346 passing** (atlas 74 + api-server 208 + curriculum-quality 60 + execution-core 4).
- Typecheck: PASS.
- `check:no-heuristic-runtime`: PASS.
- Architect: **PASS** (round 1, no critical findings).
- Invariants intact: visible 56, hidden 32, beginner 10, wave 56/56, pedagogy 56/56 visible, anchorCount=2, anchor drift 0.00/0.00, lineage 0/0/0/0, 9-course taxonomy intact, rubric v1.0.1 frozen.

**Proposed next phase:**
- **Phase 26 — NOT STARTED.** No proposal yet. The Phase 25 architect noted one nice-to-have follow-up: an integration-level test wiring `RemediationPanel` through `StudioShell` to assert it's hidden when `hideCheck=true` even on a failed grading (the parser-level `hidden` prop is already unit-tested). Defer to Phase 26 planning if useful, otherwise drop.

---

## 1. Goal we are working toward

Atlas learner-ready platform.

Phase ship history (most recent first):

- **Phase 25 — Validation Result UI + Remediation Panel** — SHIPPED (this session, awaiting commit).
- **Phase 24 — Check vs Submit Separation / State Machine** — SHIPPED.
- **Phase 23 — Workspace Auto-Resume / Step Deep-Link Support** — SHIPPED.
- **Phase 22 — Dashboard UI + Workspace Resume Wiring** — SHIPPED.
- **Phase 21 — Onboarding + Enrollment + Resume** — SHIPPED.

## Phase 25 summary (this session)

**Goal:** Improve how Atlas displays validation results after Check/Submit
and add structured remediation guidance after failures, without disturbing
the Phase 24 reducer, the server, or any catalog/curriculum surface.

**Frontend changes (only):**

- New pure `artifacts/atlas/src/lib/remediationParser.ts` →
  `parseRemediation(feedback, submission)` returning a discriminated
  union: `exact-diff` | `contains-miss` | `regex-miss` | `generic`.
  Parses the literal strings emitted by `gradeSubmission`:
  - `"Expected: <X>"` → `exact-diff { expected: X, actual: submission }`
  - `"Your output should contain: <Y>"` → `contains-miss { needle: Y, actual }`
  - `"Your output doesn't match the expected pattern."` → `regex-miss { actual }`
  - `"Invalid regex pattern in grading config."` → `generic` (authoring bug, not learner mistake)
  - anything else → `generic`
  Uses `startsWith + slice` (not split on `:`) so colons/newlines/
  whitespace inside `expected`/`needle` round-trip verbatim.
- New `artifacts/atlas/src/components/studio/RemediationPanel.tsx` —
  sibling rendered below `ValidationFeedbackPanel` in `StudioShell`,
  only when `grading.status === 'failed' && !hideCheck`. Renders
  nothing for `kind === 'generic'` (parent panel's raw feedback is
  enough). Otherwise renders structured Expected/Got rows
  (`exact-diff`), needle chip + submission row (`contains-miss`), or
  a generic-format hint + submission row (`regex-miss`).
- `ValidationFeedbackPanel.tsx` refactored into **three named regions**
  with `data-testid` markers:
  - `validation-status-header` — passed/failed icon + provisional tag
    + committed-only attempt counter + XP.
  - `validation-feedback-region` — raw `grading.feedback` + pedagogy
    failure/success/portfolio (unchanged behavior).
  - `validation-next-action` — new "Submit when ready" CTA on
    provisional+passed (routed through the existing `onSubmit` prop —
    the same handler `EditorToolbar` uses, so the Phase-24 reducer
    phase-guard remains the only gating). Also hosts the existing
    committed-only project-completion celebration block.
- Committed-only `Attempt N` counter when `!provisional && grading.attempt > 1`.
- `StudioShell.tsx` threads `submission` (code or textAnswer) and the
  existing `onSubmit` / `submitPending` props down to both panels.

**Hint-escalation placement decision:** Kept inside
`ValidationFeedbackPanel` rather than moved to `RemediationPanel`.
Rationale: `useHintState` is the data source for BOTH failure and
success/portfolio feedback (which lives in `ValidationFeedbackPanel`).
Moving the hint button to `RemediationPanel` would either duplicate
the fetch or require lifting state into `StudioShell`. Architect
accepted this as defensible (no regression, no duplication).

**Hard stops respected:** Zero changes to `lib/workspaceStepMachine.ts`
(Phase 24 invariant), `grading.ts` (no feedback-string edits),
OpenAPI / codegen / server routes / schema / migrations / rubric /
content / taxonomy / anchors / PWA / Stripe / AI tutor / cloud creds.
No new dependencies.

**Tests:** 313 → 346 passing.
- atlas: 41 → 74 (+11 parser unit tests, +6 RemediationPanel tests,
  +16 ValidationFeedbackPanel tests pinning provisional tag, XP
  display, attempt counter, Submit-when-ready CTA, and the four-way
  celebration gate).
- api-server: 208 unchanged.
- curriculum-quality: 60 unchanged.
- execution-core: 4 unchanged.

**Architect:** Round 1 PASS, no critical findings. Confirmed:
1. Parser correctness against literal `grading.ts` strings.
2. Phase 24 invariants preserved (provisional tag, XP gating,
   completion celebration four-way gate).
3. RemediationPanel hide condition correct.
4. No state-machine hazard from the new in-panel Submit CTA.
5. Hint-escalation placement defensible.

**Invariants:** visible 56, hidden 32, beginner 10, wave 56/56,
pedagogy 56/56 visible, anchorCount=2, anchor drift 0.00, lineage
0/0/0/0, 9-course taxonomy intact, rubric v1.0.1 frozen.

---

## 2. Files changed in Phase 25

**New:**
- `artifacts/atlas/src/lib/remediationParser.ts`
- `artifacts/atlas/src/lib/remediationParser.test.ts`
- `artifacts/atlas/src/components/studio/RemediationPanel.tsx`
- `artifacts/atlas/src/components/studio/RemediationPanel.test.tsx`
- `artifacts/atlas/src/components/studio/ValidationFeedbackPanel.test.tsx`

**Edited:**
- `artifacts/atlas/src/components/studio/ValidationFeedbackPanel.tsx`
  — internal region split + Submit CTA + attempt counter; **no breaking
  prop change** (added optional `onSubmit` + `submitPending`).
- `artifacts/atlas/src/components/studio/StudioShell.tsx` — renders
  `RemediationPanel` directly below `ValidationFeedbackPanel`; threads
  `onSubmit` and `submitPending` into the validation panel.
- `replit.md` — Current Phase Status + Phase History entries.
- `HANDOFF.md` — this file.

**Untouched (verified):**
- `artifacts/atlas/src/lib/workspaceStepMachine.ts` + tests.
- `artifacts/api-server/src/lib/grading.ts`.
- OpenAPI, codegen, all server routes, all schemas, all migrations.
- All curriculum content, rubric, anchor, taxonomy, archive surfaces.
- Stripe, AI tutor, cloud creds, PWA.

---

## 3. Final gates

| Gate | Result |
|---|---|
| `pnpm run typecheck` | clean |
| `check:no-heuristic-runtime` | OK |
| atlas tests | **74/74** (was 41) |
| api-server tests | **208/208** (unchanged) |
| curriculum-quality tests | **60/60** (unchanged) |
| execution-core tests | **4/4** (unchanged) |
| **Total tests** | **346/346** (was 313) |
| `author:project anchor-check` | drift **0.00 / 0.00** |
| `audit:pedagogy` (visible) | **56/56** |
| Architect | **PASS** (round 1) |

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

## 4. Commit commands (main agent cannot commit — run these yourself)

```bash
git add -A ':!attached_assets'
git commit -m "Phase 25: Validation feedback and remediation panel"
```

---

## 5. Housekeeping note

`replit.md` is now ~170 lines (one chunky paragraph per phase). Happy
to compact Phase History entries to one-line links at a natural pause —
not blocking. Same suggestion has been carried since Phase 22.

---

## Hard stop reminder

Phase 26 is **not started** and **not proposed**. No schema, server,
API, OpenAPI, codegen, rubric, content, taxonomy, anchor, archive, or
PWA work has been done in this session beyond the Phase 25
frontend-only overlay described above.
