# Atlas — Session Handoff

**HEAD:** Phase 26 ship (commit pending).
**Status:** Phase 26 **READY TO COMMIT**. Working tree carries Phase 26 changes.

---

## Final gate summary (Phase 26)

| Gate | Result |
|---|---|
| `pnpm run typecheck` | clean |
| `check:no-heuristic-runtime` | OK |
| `pnpm --filter @workspace/db run push` | applied (dev) |
| atlas tests | **74/74** |
| api-server tests | **219/219** (+11) |
| curriculum-quality tests | **60/60** |
| execution-core tests | **4/4** |
| **Total tests** | **357/357** (+11) |
| `audit:pedagogy` (visible) | **56/56** |
| `audit:bad-completions` (dev DB) | **0 bad rows / 2 completions** |
| Architect | R1 FAIL → **R2 PASS** |

---

## What Phase 26 shipped

**Backend trust phase — `routes/user.ts /submit`.** Fixes 4 reward-integrity
holes (H1 XP double-award, H2 premature projectComplete, H3 missing
xp_transactions ledger, H4 discarded submission evidence) without any UX
redesign.

### Schema (additive only)

- `user_step_completions.submission_excerpt text` — nullable, capped
  server-side at 4 KB by UTF-8 byte length.
- `user_step_completions.submission_sha256 text` — nullable, SHA-256
  of the FULL submission (deterministic, stable across requests).
- Pushed in dev via `pnpm --filter @workspace/db run push`.
  Production push deferred per ops policy. Pre-P26 rows stay null —
  no backfill.

### `/submit` integrity fixes

- **H1.** XP increment + `xp_transactions` insert gated on
  `isFreshPass = passed && !wasAlreadyPassed`. Returned `xpEarned`
  now matches persisted behavior.
- **H2.** After writing the current step's completion, COUNT distinct
  `passed=true` rows for (user, project); `allStepsPassed = passedCount
  >= totalSteps` replaces the old `isLastStep` gate for status flip /
  email send / `projectComplete` response. Conditional UPDATE
  `WHERE status != 'completed'` still serializes concurrent transitions.
- **H3.** One append-only `xp_transactions` row per real award.
  `reason: 'step_pass'`, `metadata: { projectId, stepNumber, stepId, attempt }`.
- **H4.** `captureSubmissionEvidence()` helper computes excerpt + sha256.
  Written on first INSERT and on previously-failed → now-passes UPDATE
  paths. Re-submits of an already-passed row OMIT the evidence keys
  entirely — canonical first-pass evidence is immutable.
- **Monotonic `passed` (architect R1 fix).** UPDATE set uses
  `passed: passed || wasAlreadyPassed` so a pass→fail→pass sequence
  cannot downgrade the row and re-qualify the third attempt as fresh.

### Audit-only script

- `scripts/src/audit-bad-completions.ts` + `audit:bad-completions` npm
  entry. READ-ONLY. Reports `user_progress.status='completed'` rows
  where distinct `user_step_completions(passed=true)` count <
  `projects.totalSteps`. Dev DB clean.

---

## Untouched invariants

- `lib/grading.ts` — behavior unchanged; only used via the existing
  `gradeSubmission` import in /submit.
- `lib/workspaceStepMachine.ts` — unchanged.
- `routes/user-check.ts` path — write-free contract verified by the
  existing 6-test suite (still passing).
- OpenAPI / codegen — unchanged (no surface additions).
- `cert-verify.ts` response shape — unchanged.
- Curriculum content / rubric / taxonomy / anchors — unchanged.
- No PWA / Stripe / AI tutor / cloud-creds work.

Curriculum invariants intact: visible 56, hidden 32, beginner 10,
wave 56/56, pedagogy 56/56 visible, anchorCount=2, anchor drift 0.00,
lineage 0/0/0/0, 9-course taxonomy intact, rubric v1.0.1 frozen.

---

## Known caveat (pre-existing, out-of-scope)

Concurrent first-pass submits on the SAME step can still theoretically
race the read-then-write evidence/award path. This is NOT introduced by
Phase 26 — the prior code had the same exposure. A transaction-or-row-
locking strategy is the natural follow-up if race-hardening is later
prioritized. Architect explicitly accepted this as out-of-scope for R2.

---

## Proposed next phase

**Phase 27 — NOT STARTED.** No proposal authored. Natural candidates:

1. Race-harden first-pass award path with a DB transaction / `INSERT
   ... ON CONFLICT DO UPDATE ... RETURNING (old.passed)` so the
   "first transition to passed" is atomic.
2. Surface submission evidence on the public cert-verify response
   (deferred in P26 per scope). Would expose per-step `{ stepNumber,
   completedAt, attemptCount, sha256 }` — excerpt stays private.
3. One-shot repair script for any legacy bad completions the audit
   script flags (currently none in dev). Would be opt-in / dry-run-
   first / explicit operator approval.

---

## Housekeeping

`replit.md` is now ~173 lines (one chunky paragraph per recent phase).
Happy to compact Phase History entries to one-line links at a natural
pause — not blocking. Carried since Phase 22.
