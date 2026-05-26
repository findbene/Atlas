# Atlas — Session Handoff

**HEAD:** `7d054e98e00049a72625bac91aafef94e39c65ab` — Phase 25 ship.
**Status:** Phase 25 **COMMITTED**. Working tree clean.

---

## Final gate summary (Phase 25)

| Gate | Result |
|---|---|
| `pnpm run typecheck` | clean |
| `check:no-heuristic-runtime` | OK |
| atlas tests | **74/74** |
| api-server tests | **208/208** |
| curriculum-quality tests | **60/60** |
| execution-core tests | **4/4** |
| **Total tests** | **346/346** |
| `author:project anchor-check` | drift **0.00 / 0.00** |
| `audit:pedagogy` (visible) | **56/56** |
| Architect | **PASS** (round 1) |

---

## What Phase 25 shipped

- **`lib/remediationParser.ts`** — pure parser producing a discriminated
  union (`exact-diff` | `contains-miss` | `regex-miss` | `generic`)
  from the literal feedback strings emitted by `gradeSubmission`.
- **`components/studio/RemediationPanel.tsx`** — new sibling panel
  rendered below `ValidationFeedbackPanel` on failed checks/submits.
- **`ValidationFeedbackPanel` region refactor** — split into 3 named
  regions with `data-testid` markers
  (`validation-status-header` / `validation-feedback-region` /
  `validation-next-action`).
- **Provisional vs committed feedback clarity** — provisional tag only
  on Check results; XP, attempt counter, and completion celebration
  only on committed Submit results (four-way gate preserved).
- **Submit-when-ready CTA** — appears in `validation-next-action`
  region after a passed Check, routed through the existing `onSubmit`
  prop so the Phase-24 reducer phase-guard remains the sole gating.
- **Structured exact/contains/regex/generic remediation** —
  Expected/Got rows, needle chips, or generic-format hints depending
  on the parsed kind; `generic` defers to the parent panel's raw
  feedback (renders nothing in `RemediationPanel`).

---

## Untouched invariants

- `lib/workspaceStepMachine.ts` — unchanged.
- `artifacts/api-server/src/lib/grading.ts` — unchanged (feedback
  strings are the parser's contract).
- OpenAPI / codegen — unchanged.
- All server routes — unchanged.
- DB schema / migrations — unchanged.
- Curriculum content / rubric / taxonomy / anchors — unchanged.
- No PWA / Stripe / AI tutor / cloud-creds work.

Curriculum invariants intact: visible 56, hidden 32, beginner 10,
wave 56/56, pedagogy 56/56 visible, anchorCount=2, anchor drift 0.00,
lineage 0/0/0/0, 9-course taxonomy intact, rubric v1.0.1 frozen.

---

## Proposed next phase

**Phase 26 — NOT STARTED.** No proposal authored, no implementation
begun. The Phase 25 architect noted one nice-to-have follow-up: an
integration-level test wiring `RemediationPanel` through `StudioShell`
to assert it stays hidden when `hideCheck=true` even on a failed
grading (the parser-level `hidden` prop is already unit-tested). Pick
up or drop in the next session.

---

## Housekeeping

`replit.md` is ~172 lines (one chunky paragraph per recent phase).
Happy to compact Phase History entries to one-line links at a natural
pause — not blocking. Carried since Phase 22.
