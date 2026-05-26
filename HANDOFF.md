# Atlas — Session Handoff

**HEAD:** Phase 27 ship (pending commit by platform).
**Status:** Phase 27 **READY TO COMMIT**. Working tree changes: `routes/user.ts`, `routes/user-submit.test.ts`, `HANDOFF.md`, `replit.md`.

---

## Final gate summary (Phase 27)

| Gate | Result |
|---|---|
| `pnpm run typecheck` | clean |
| `check:no-heuristic-runtime` | OK |
| atlas tests | **74/74** (unchanged) |
| api-server tests | **219 → 222/222** (+3 P27) |
| curriculum-quality tests | **60/60** (unchanged) |
| execution-core tests | **4/4** (unchanged) |
| **Total tests** | **357 → 360/360** |
| `author:project anchor-check` | drift **0.00 / 0.00** |
| `audit:pedagogy` (visible) | **56/56** |
| `audit:bad-completions` (dev DB) | **0 bad rows** |
| Architect | **PASS** (R1 nit folded in: lock-SQL content + ordering assertion strengthened) |

---

## What Phase 27 shipped

- **Transactional reward boundary on `/submit`.** All persistence work
  (completion row read+write, post-write COUNT, progress update, XP
  read+write, `xp_transactions` insert) now runs inside a single
  `db.transaction(async (tx) => ...)` callback.
- **Per-user `pg_advisory_xact_lock` is the FIRST statement in the tx.**
  Key is `hashtextextended('atlas-submit:' || user.id, 0)` — bigint to
  match the lock signature. Released automatically at commit/rollback.
  This serializes ALL concurrent `/submit` requests for a single
  learner (same step, cross-step, cross-project) so every
  read-then-write window inside the tx is race-free.
- **`bumpStreak` + completion email run OUTSIDE the tx** as best-effort
  post-commit work. Email is still gated on `didTransitionToCompleted`
  returned from the tx, so it fires at most once per real completion
  transition. A streak or email failure cannot roll back the persisted
  reward state.
- **Pure `gradeSubmission` stays OUTSIDE the tx** to keep the lock
  window short.
- **Phase 26 invariants preserved verbatim:** monotonic `passed`,
  evidence-on-first-pass-only, `isFreshPass`-gated XP/ledger,
  `allStepsPassed` completion gate, conditional progress UPDATE for
  email idempotency (now defense-in-depth on top of the lock).
- **Response shape unchanged** for every branch (passed first-pass,
  passed re-submit, failed, project complete).
- **3 additive concurrency tests** in `user-submit.test.ts`:
  1. First-pass `/submit` runs inside `db.transaction` exactly once
     and issues `pg_advisory_xact_lock(hashtextextended(...))` as the
     FIRST `tx.execute` call, keyed on `atlas-submit:${user.id}`.
  2. `bumpStreak` throwing does NOT roll back XP/ledger/completion
     writes — proves the streak call is OUTSIDE the tx (otherwise
     the throw would bubble through `db.transaction` and rollback).
  3. Winner/loser race ordering — the "loser" `/submit` that arrives
     after the "winner" persisted `passed=true` takes the
     `wasAlreadyPassed` branch, returns `xpEarned: 0`,
     `isFirstPass: false`, `projectComplete: false`, writes NO XP,
     NO ledger row, does NOT re-send the completion email, and
     does NOT overwrite the canonical first-pass evidence.

## Hard stops respected

- Zero FE changes (no `project-workspace.tsx`, no reducer, no
  `ValidationFeedbackPanel`, no `RemediationPanel`).
- Zero `/check` route changes — the `lib/grading.ts` helper stays
  pure and the existing 6-test `/check` suite stays green.
- Zero OpenAPI / codegen / schema / migration changes.
- Zero content / rubric / taxonomy / anchor / archive / wave /
  cert-verify / PWA / Stripe / AI tutor / cloud-creds changes.

## Architect review

- **R1 PASS** with one nit: assert the advisory-lock SQL content
  + statement ordering, not just call count. **Folded in same
  session.** The first test now pins:
  - `executeCalls[0]._sql` contains `pg_advisory_xact_lock`
  - `executeCalls[0]._sql` contains `hashtextextended`
  - `executeCalls[0]._values[0]` equals `atlas-submit:${TEST_USER.id}`

  If a future edit reorders the tx body, weakens the lock function,
  or drops the per-user scoping, this fails loudly.

## Coverage limitations (documented, intentional)

- The test harness uses a mock `db.transaction(cb)` that runs `cb`
  against the same mock db — there is no real Postgres
  serialization or rollback in tests. True end-to-end concurrent
  /submit testing requires a real Postgres + parallel requests,
  which is out of scope for this phase. The runtime guarantee
  comes from the `pg_advisory_xact_lock(...)` SQL emitted via
  `tx.execute` (which IS asserted at the SQL level) plus the
  transactional boundary. The simulated winner/loser test pins the
  observable post-lock contract.
- The advisory-lock key namespace is `atlas-submit:` — any future
  writer to reward tables (`user_step_completions`, `user_xp`,
  `xp_transactions`) MUST take the same per-user lock to preserve
  integrity. Document this in code review of any future reward-
  table touching PR.

## Phase 27 NOT addressed (deferred)

- Real-Postgres integration test for parallel /submit
  (architect-suggested but out of scope; mock-level + SQL assertion
  cover the contract).
- No INSERT ... ON CONFLICT DO UPDATE refactor of the user_xp
  upsert — the user-level lock makes the existing read-then-write
  pattern safe, and rewriting it would require additional test
  mock work for no behavioral gain.

## Active invariants (post-Phase-27)

- Visible projects: **56**, hidden: 32, beginner: 10
- Zero-beginner courses: **0**
- Wave coverage: **56/56**
- Pedagogy (visible): **56/56**
- Lineage failures: **0 / 0 / 0 / 0**
- 9-course taxonomy intact; rubric `v1.0.1` frozen
- Anchor drift: **0.00 / 0.00**
- Known caveats: none in scope. (Pre-existing pre-P26 bad-completion
  rows: dev DB clean = 0.)

---

## Files touched

- `artifacts/api-server/src/routes/user.ts` — `/submit` wrapped in
  `db.transaction` + advisory lock; bumpStreak + email moved
  post-commit. ~290 lines changed in handler. Phase 27 block comment.
- `artifacts/api-server/src/routes/user-submit.test.ts` — db mock
  gains `transaction` + `execute`; `sql` mock upgraded to
  tagged-template-aware so concurrency tests can inspect SQL
  fragments; 3 new tests at file end.
- `HANDOFF.md` — this document.
- `replit.md` — Phase 27 entry added to Current Phase Status +
  Phase History.
