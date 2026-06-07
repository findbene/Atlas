# `/check` vs `/submit` — Evidence Contract (Phase 59A)

**Owner:** Phase 59A (evidence-parity baseline + scoped hardening).
**Routes:** `POST /user/projects/:projectId/steps/:stepId/check` and `.../submit`
(`artifacts/api-server/src/routes/user.ts`).
**Shared grader:** `gradeSubmission` (`artifacts/api-server/src/lib/grading.ts`) — pure, no side effects.

This doc is the authoritative description of what each route does, what it persists, and what it may /
must never expose. It is a baseline audit: **Phase 59A found no defect** in the relationship — both routes
share one comparator and parity holds for the two live server-graded rows — so this phase ships the contract
matrix + focused regression tests, not behavior changes.

---

## 1. Route behavior

| Aspect | `/check` | `/submit` |
| --- | --- | --- |
| Auth | `requireAuth` | `requireAuth` |
| Enrollment gate | 403 if not enrolled (before step lookup — no existence leak) | 403 if not enrolled |
| Step lookup | 404 if missing / wrong project | 404 if missing / wrong project |
| Grading | `gradeSubmission(step, submission)` ONLY | `envelopeCapture ? gradeEnvelopeCapture(step, capture) : gradeSubmission(step, submission)` |
| Durable writes | **NONE** | `user_step_completions` (upsert), `user_progress` (status/percent), `user_xp` + `xp_transactions` (gated on `isFreshPass`) — all inside one `db.transaction` under a per-user `pg_advisory_xact_lock` |
| Post-commit side effects | **NONE** | `bumpStreak` + completion email (best-effort, outside tx, only on the completed transition) |
| Response shape | `{ status, feedback }` | `{ status, feedback, xpEarned, attempt, isFirstPass, projectComplete }` |
| On-wire no-commit guarantee | response omits `xpEarned`/`attempt`/`isFirstPass`/`projectComplete` | n/a |

**Drift analysis.** The only grading-dispatch difference is `/submit`'s `gradeEnvelopeCapture` branch. It is
reachable only when (a) the client attaches an `envelope` AND (b) `isEnvelopeEnforcedFor(kind, userId)` is
true — which requires the kind to be in `ATLAS_ENVELOPE_REQUIRED_KINDS` (empty) AND the user in the canary
bucket. **Envelope enforcement is OFF**, so for every live row `/submit` falls through to
`gradeSubmission(step, submission)` — identical to `/check`. Furthermore, even when the envelope branch is
active, `gradeEnvelopeCapture` for `csv_set_equal` / `sql_resultset` serializes the captured `{columns,rows}`
and routes them through the SAME `gradeSubmission` comparator. There is exactly one comparator; the routes
cannot disagree on a verdict for the same `{columns,rows}`.

**Submission source for the two live server-graded rows.** The FE (`decideCsvSetEqualSubmission`, used by BOTH
the Check and Submit handlers in `project-workspace.tsx`) sends the canonical `{columns,rows}` JSON as
`submission` when `serverGrade === true && isSqlStep`. `/check` receives it (no envelope); `/submit` receives
it (envelope, if attached, is ignored for grading while off). Both grade the same string → same verdict.

---

## 2. Evidence-contract matrix (per validation kind)

`enf` = server-enforced commit grade; `prov` = client-provisional (server commit-grade auto-passes).

| kind | `/check` behavior | `/submit` behavior | graded by | durable evidence on pass? | awards XP/progress? | answer-key leak? | status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `exact` | trimmed equality; feedback `Expected: <v>` | same grade + persists pass/XP | server (`enf`) | yes (on pass) | yes (submit only) | feedback reveals the expected short string **by design** (legacy) | acceptable |
| `contains` | substring/structured match; feedback names the missing needle | same grade + persists | server (`enf`) | yes | yes (submit) | feedback reveals the required needle **by design** | acceptable |
| `numeric_tolerance` | falls through → auto-pass `"Step completed."` | same + persists pass | none (`prov`/contract-shaped) | yes (auto-pass) | yes (submit) | none (no comparison) | acceptable (no live server-grade) |
| `json_equal` | falls through → auto-pass (commit path) | same + persists | none on commit path (`prov`/contract); Phase-52 envelope canary is operator-pending + separate | yes (auto-pass) | yes (submit) | none | acceptable; Phase 52 untouched |
| `csv_set_equal` | `gradeCsvSetEqual` (opt-in `serverGrade`); 1 live row (C2 step 3) → real grade; else auto-pass | same grader; persists pass/XP on pass | server for the 1 opted-in row (`enf`), else `prov` | yes (on pass) | yes (submit) | **no** — feedback reports column names + structural mismatch (count/missing/unexpected/width), never expected cell VALUES | acceptable |
| `sql_resultset` | `gradeSqlResultset` (opt-in `serverGrade`); 1 live row (C2 step 2) → real grade; else auto-pass | same grader; persists on pass | server for the 1 opted-in row (`enf`), else `prov` | yes (on pass) | yes (submit) | **no** — same bounded feedback as `csv_set_equal` | acceptable |

Notes:
- `csv_set_equal` / `sql_resultset` share ONE comparator (`gradeRowsetSubmission`, Phase 58A). When opted in,
  submission MUST be JSON `{columns,rows}`; anything else (raw SQL, malformed JSON, empty, wrong/missing
  columns, missing/extra/wrong rows) **fails closed** on BOTH routes.
- The server-grade signal exposed to the client is the narrow `step.serverGrade: boolean` only
  (`deriveServerGrade`, gated to `csv_set_equal | sql_resultset`). `validationConfig`/`spec`/`expectedRows`/
  `expectedRowsHash`/the reference `query` are never serialized (pinned by `projects-server-grade.test.ts`).

---

## 3. The `/check` ≠ durable-evidence boundary

`/check` is provisional by construction: it performs **zero** DB writes and never even queries
`user_step_completions`. It cannot award XP, write completion/evidence rows, transition project status, bump
streaks, or send the completion email. The response deliberately omits the reward fields as an on-the-wire
proof that nothing was committed. This is intended and is now regression-pinned for the server-graded kinds
(not just `exact`/`contains`) by `user-check-submit-parity.test.ts`.

`/submit` is the only route that creates durable state, and only on a fresh pass: first-pass evidence
(`submissionExcerpt` + `submissionSha256`), one `xp_transactions` ledger row, monotonic `passed`, and the
project-completion transition (gated on all steps passed). Re-submits never double-award (idempotent).

---

## 4. H3 honesty boundary

Permitted claim: "Atlas verified that submitted runtime output or artifacts matched enabled validation
checks." Forbidden: independent authorship, no-outside-help, cheat-proof, tamper-proof, job-readiness
guarantee, "the SQL was honestly written by the learner." No feedback string on either route makes a
forbidden claim (pinned by the H3 feedback audit in `envelopeGrade.test.ts` for the envelope path; the
commit-path comparator feedback is bounded structural text). Envelope **provenance** remains separate from
envelope **enforcement** (OFF).

---

## 5. Limitations

- Full app UI cannot boot (Replit connector coupling, Phase 0.2 pending), so end-to-end verification uses the
  real browser DuckDB-WASM adapter capture (Phase 0.zz / 58B) fed to the live route grader, plus route-level
  supertest harnesses — not a full app boot.
- The `/submit` concurrency guarantee is enforced by `pg_advisory_xact_lock`; the unit harness simulates
  ordering rather than true parallelism (documented in `user-submit.test.ts`).
