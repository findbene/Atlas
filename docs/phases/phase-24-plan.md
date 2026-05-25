# Phase 24 — Check vs Submit Separation / State Machine

**Status:** PLAN APPROVED · IMPLEMENTING

## Goal

Separate **low-stakes Check** (server-graded, non-committing) from
**high-stakes Submit** (server-graded **and** committing — writes
`user_step_completions`, awards XP, advances progress, possibly completes
the project, fires celebration / completion email). Encode the resulting
UX via an explicit frontend state machine so confetti and project-
completion celebration are **earned** by a committed Submit, never fired
by an exploratory Check.

## State machine (per active step)

```
                 ┌───────────────────────────────────────┐
                 ▼                                       │
  idle ──edit──▶ editing ──run──▶ running ──result──▶ run_done
                    │                                    │
                    └────check────▶ checking ────────┐   │
                                       │             │   │
                                       ▼             │   │
                                check_passed ◀──pass─┤   │
                                check_failed ◀──fail─┘   │
                                       │                 │
                                       │ submit          │ submit
                                       ▼                 ▼
                                   submitting  ◀────────┘
                                       │
                          ┌────────────┴─────────────┐
                          ▼                          ▼
                  submit_failed              submit_passed
                                                     │
                          ┌──────────────────────────┼─────────────────────┐
                          ▼                          ▼                     ▼
                  not_last_step              last_step+complete    already_completed
                  (auto-advance,             (celebration once)    (silent)
                   no celebration)
```

UX rules (locked):

- Editing after a check resets stale check feedback back to `editing`.
- Confetti / celebration fire **only** on `submit_passed`, never on `check_passed`.
- Auto-advance fires **only** on `submit_passed && !last_step`.
- `self_attest` / `reflection` / `file_upload` / `concept_check` steps skip
  Check entirely (only Submit is rendered).

## Endpoint contract

**New endpoint** (the only API surface change in this phase):

```
POST /user/projects/:projectId/steps/:stepId/check
```

- Same auth + enrollment gate as `/submit` (403 if unenrolled).
- Same step-not-found 404.
- Reuses the same grading helper as `/submit`.
- **No DB writes.** No `user_step_completions` insert/update, no
  `attemptCount` bump, no XP, no streak, no progress mutation, no
  completion email.
- Returns `CheckResult` (NOT `GradingResult`): `{status, feedback,
  stdout?, stderr?, executionTimeMs?}`. The omission of `xpEarned`,
  `attempt`, `isFirstPass`, `projectComplete` is the contract guarantee
  that nothing was committed.

`POST /user/projects/:projectId/steps/:stepId/submit` is **unchanged** —
same response shape, same byte-identical persistence behavior. The only
internal change is that its grading switch is now factored into a shared
helper.

## Schema delta

**None.** No migration, no new columns, no enum edits.
`user_step_completions` remains the commit ledger. Check attempts are
ephemeral by design — preserves existing `attemptCount` semantics that
the hint policy depends on.

## Server changes (api-server only)

1. **New** `artifacts/api-server/src/lib/grading.ts` — pure
   `gradeSubmission(step, submission): { passed, feedback }` extracted
   verbatim from the existing switch.
2. **Edit** `artifacts/api-server/src/routes/user.ts`:
   - `/submit` calls `gradeSubmission(...)`; all other behavior unchanged.
   - **New** `/check` route: enrollment gate → step lookup → call helper
     → return `{status, feedback}`. No DB writes.

## OpenAPI + codegen

1. **Edit** `lib/api-spec/openapi.yaml` — add the `/check` path and the
   `CheckResult` schema.
2. **Regenerate** via `pnpm --filter @workspace/api-spec run codegen`.

## Frontend changes (atlas only)

1. **New** `artifacts/atlas/src/lib/workspaceStepMachine.ts` —
   pure-function reducer + helpers (`workspaceStepReducer`, action types,
   `submitEnabled`, `checkEnabled`, `provisional`). 100% unit-testable.
2. **Edit** `project-workspace.tsx` — adopts the reducer, owns two
   mutations (`useCheckStep`, `useSubmitStep`), moves confetti /
   celebration / auto-advance into the `SUBMIT_PASS` reducer transition,
   wires `EDIT` action to clear stale check feedback when code/text
   changes.
3. **Edit** `EditorToolbar.tsx` + `StudioShell.tsx` — add `Check` button
   alongside `Run` / `Submit` (hidden for self-attest-style steps);
   thread `onCheck`, `checkPending`, `provisional` props.
4. **Edit** `ValidationFeedbackPanel.tsx` — adds `provisional?: boolean`
   prop. When provisional: hides XP line, completion celebration block,
   and renders a "Not yet submitted — click Submit to commit" tag.

## Confetti / celebration policy (locked)

| Trigger | Phase 23 (today) | Phase 24 (after) |
|---|---|---|
| Per-step confetti | On `/submit` `isFirstPass=true` | Unchanged — only on `SUBMIT_PASS` first-pass |
| Project-complete celebration | On `/submit` `projectComplete=true` | Unchanged — only on `SUBMIT_PASS` last-step |
| Auto-advance to next step | On `/submit` `passed && !projectComplete` | Unchanged — only on `SUBMIT_PASS` non-last-step |
| Anything on `/check` pass | (N/A) | Subtle "Looks good — Submit when ready" affordance only |

## Tests

**New api-server (target +≥6):**
- `/check` happy path returns `{status:'passed', feedback}` with no
  `xpEarned` / `attempt` / `isFirstPass` / `projectComplete` keys.
- `/check` failure paths for `exact`, `contains`, `regex`,
  `self_attest` (always passes), default (always passes).
- `/check` invariant: 5 calls leave `user_step_completions` empty, no
  XP delta, no progress mutation, no streak bump, no email.
- `/check` enrollment gate: 403 when not enrolled.
- `/check` 404 for unknown step / step from wrong project.
- `/submit` regression: behavior byte-identical (existing assertions
  intact; new pin test if needed).

**New atlas (target +≥4):**
- Reducer: `editing → checking → check_passed` never sets `submit*`
  state nor a "celebration" flag.
- Reducer: `EDIT` action from `check_passed`/`check_failed` returns to
  `editing` (stale feedback cleared).
- Reducer: `submit_passed` on non-last step computes auto-advance.
- Reducer: `submit_passed` on last step sets celebration once
  (idempotency vs `celebrated` flag).

Targets: **281 → ≥291/291** total.

## Hard stops (locked)

- No schema changes.
- No content / rubric / anchor / taxonomy changes.
- No PWA / Stripe / AI tutor / cloud-creds work.
- No Phase 25 work in this pass.
- All Phase 21–23 invariants preserved (enrollment idempotency, dashboard
  fresh-learner gate, workspace auto-resume + URL self-correction +
  popstate + slug-swap reset).
