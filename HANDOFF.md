# Atlas — Session Handoff

**HEAD:** `6d99acb94146b67b6f7f1a0fd42d232edd487eac` — Phase 26 ship.
**Status:** Phase 26 **COMMITTED**. Working tree clean.

---

## Final gate summary (Phase 26)

| Gate | Result |
|---|---|
| `pnpm run typecheck` | clean |
| `check:no-heuristic-runtime` | OK |
| `pnpm --filter @workspace/db run push` | applied (dev) |
| atlas tests | **74/74** |
| api-server tests | **219/219** |
| curriculum-quality tests | **60/60** |
| execution-core tests | **4/4** |
| **Total tests** | **357/357** |
| `author:project anchor-check` | drift **0.00 / 0.00** |
| `audit:pedagogy` (visible) | **56/56** |
| `audit:bad-completions` (dev DB) | **0 bad rows** |
| Architect | R1 FAIL → **R2 PASS** |

---

## What Phase 26 shipped

- **XP idempotency fix (H1).** XP increment + `xp_transactions` insert
  gated on `isFreshPass = passed && !wasAlreadyPassed`. Re-submits of
  an already-passed step no longer inflate `user_xp.totalXp` or append
  duplicate ledger rows. Returned `xpEarned` now matches persisted
  behavior.
- **Project completion now requires all steps passed (H2).** After
  writing the current step's completion, COUNT distinct `passed=true`
  rows for (user, project); `allStepsPassed = passedCount >=
  totalSteps` replaces the old `isLastStep` gate for status→completed
  flip, completion-email send, and `projectComplete` response. Deep-
  linking to the last step and submitting once can no longer falsely
  complete the project.
- **xp_transactions ledger writes on real awards only (H3).** First
  use of the previously-unused table. One append-only row per real
  award — `reason: 'step_pass'`, metadata
  `{ projectId, stepNumber, stepId, attempt }`.
- **submission_excerpt + submission_sha256 evidence persistence (H4).**
  Two additive nullable cols on `user_step_completions`. Excerpt is
  capped server-side at 4 KB by UTF-8 byte length; sha256 is computed
  over the FULL submission so identical submissions hash equal even
  when the excerpt is truncated. Written on first INSERT and on
  previously-failed → now-passes UPDATE paths. Re-submits of already-
  passed rows OMIT the evidence keys entirely — canonical first-pass
  evidence is immutable.
- **Monotonic `passed` behavior (architect R1 fix).** UPDATE set uses
  `passed: passed || wasAlreadyPassed`. A pass→fail→pass sequence on
  the same step cannot downgrade the row and re-qualify the third
  attempt as fresh; pinned by a dedicated regression test.
- **Read-only bad-completions audit script.** New
  `scripts/src/audit-bad-completions.ts` + `audit:bad-completions`
  npm entry. Reports `user_progress.status='completed'` rows where
  distinct `user_step_completions(passed=true)` count <
  `projects.totalSteps`. Zero mutations. Dev DB clean.

---

## Known caveat

Concurrent first-pass submits on the SAME step can still theoretically
race the read-then-write evidence/award path. **This is not introduced
by Phase 26** — the prior code had the same exposure. A transaction-
or-row-locking strategy is a possible **Phase 27 candidate** if race-
hardening is later prioritized.

---

## Untouched invariants

- No OpenAPI / codegen changes.
- No content / rubric / taxonomy / anchor changes.
- No PWA / Stripe / AI tutor / cloud-creds work.
- `routes/user.ts /check` path remains write-free (existing 6-test
  suite still green).
- `cert-verify.ts` response shape unchanged.
- `lib/grading.ts` behavior unchanged (only persistence/plumbing edits
  in the `/submit` route).
- `lib/workspaceStepMachine.ts` unchanged.

Curriculum invariants intact: visible 56, hidden 32, beginner 10,
wave 56/56, pedagogy 56/56 visible, anchorCount=2, anchor drift 0.00,
lineage 0/0/0/0, 9-course taxonomy intact, rubric v1.0.1 frozen.

---

## Proposed next phase

**Phase 27 — NOT STARTED.** No proposal authored, no implementation
begun. Natural candidates surfaced during Phase 26:

1. Race-harden the first-pass award path with a DB transaction /
   `INSERT ... ON CONFLICT DO UPDATE ... RETURNING (old.passed)` so
   the "first transition to passed" is atomic.
2. Surface submission evidence on the public cert-verify response
   (deferred in P26 per scope) — per-step
   `{ stepNumber, completedAt, attemptCount, sha256 }`; excerpt
   stays private.
3. One-shot repair script for any legacy bad completions the audit
   script flags (currently none in dev). Opt-in, dry-run-first,
   explicit operator approval.

Pick up or drop in the next session.

---

## Housekeeping

`replit.md` is now ~173 lines (one chunky paragraph per recent phase).
Happy to compact Phase History entries to one-line links at a natural
pause — not blocking. Carried since Phase 22.
