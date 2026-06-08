# Phase 60F — fresh-submit snapshot E2E + auth/CORS hardening (close-out)

**Status:** SHIPPED. Closes the remaining portfolio evidence loop before any
GitHub export / publishing, and pays down the two auth/CORS hardening debts the
Phase-60E close-out logged. Proves — through a real full-stack path — that a
fresh successful `/submit` creates a durable portfolio snapshot, that the
artifact route reflects the snapshot honestly, and that the browser download
remains leak-free and claim-safe. **No GitHub/export/publishing, no excerpt
preview, no new serverGrade/opt-ins, no schema/migration, envelope enforcement
OFF, Phase 52 untouched.**

Independent reviews: **`atlas-architect-reviewer` → PASS** + **`code-reviewer`
→ SHIP**, no P0/P1. Both traced the auth removals (production-equivalent), the
CORS production-inertness, and the leak-distinction in the new evidence-loop
test. Two scoped P2s raised by the reviewers were fixed in-phase (see §11).

---

## 1. Auth hardening (two out-of-scope `getAuth` callers)

The 60E close-out flagged three production routes that called Clerk's
`getAuth(req)` unconditionally and therefore 500 under the gated E2E auth mode
(where `clerkMiddleware` is not registered). Both fixes are **removals**, not
re-routes — production behaviour is byte-identical:

- **`routes/user.ts` `/user/profile` (was line 48).** `const auth = getAuth(req)`
  was **dead code** — its result was never read (the response builds from
  `user.clerkId`, the resolved user row). Removed the call + the now-unused
  `getAuth` import.
- **`routes/ai.ts` `/ai/chat` finalize + `/ai/chat/mark-read` (was 345/522).**
  Both derived the cache key via `getAuth(req).userId` purely to call
  `invalidateUserCache(...)`. Replaced with `invalidateUserCache(user.clerkId)`.
  This is **exactly equivalent in production**: `userCache` is keyed by the
  Clerk `userId`, and `getCurrentUser`/`requireAuth` resolve the row via
  `eq(users.clerkId, userId)` and cache it under that same key — so
  `user.clerkId === getAuth(req).userId` for any authenticated user. `clerk_id`
  is `NOT NULL`, so the key is always defined; both call sites sit after a
  `if (!user) …` guard. Removed the `getAuth` import.

**Security envelope unchanged:** no route is made public, no userId is ever read
from a request param/body — the user is always the one `requireAuth` resolved.
`ai.test.ts` updated (the mocked user now carries the asserted `clerkId`; the
orphan `@clerk/express` mock removed). Result: the full local stack now
exercises `/user/profile` and the `/ai/chat*` finalize paths without 500s, and
production is untouched.

## 2. CORS hardening (reflective → allowlist, production-inert)

`app.ts` previously used `cors({ origin: true, credentials: true })` — it
reflected ANY request `Origin` back AND allowed credentials, so any website
could make credentialed cross-origin requests and read the responses. Phase 60F
adds `lib/cors.ts`:

- `ATLAS_ALLOWED_ORIGINS` (comma-separated) → an explicit allowlist in ANY
  environment (the operator lever to harden production).
- Otherwise, in **non-production**, default to local dev/test origins
  (`localhost:5173/5199/4173`, `127.0.0.1:5173/4178`) so dev + the E2E harness
  work with no config.
- Otherwise (**production AND the env var unset**) → fall back to the LEGACY
  reflective behaviour, byte-identical to before. This keeps the change
  **production-inert** — production behaviour does not change until an operator
  sets `ATLAS_ALLOWED_ORIGINS`. The boot path emits a `warn` recommending they
  do so.

`credentials: true` is preserved in every branch; the hardening is the origin
allowlist, never a wildcard+credentials pairing. In allowlist mode an unknown
origin gets the callback `(null, false)` — **no `Access-Control-Allow-Origin`
header, and NOT an Error** — so the browser blocks the cross-origin read while
the server never throws/500s. No-Origin requests (curl, server-to-server, health
checks) are allowed, matching prior behaviour. `lib/cors.test.ts` pins all three
branches + the per-origin callback.

**Verified live** against the running stack: an allowed origin
(`http://127.0.0.1:4178`) received `Access-Control-Allow-Origin: http://127.0.0.1:4178`;
a disallowed origin (`http://evil.example.net`) received **no** ACAO header (and
a clean 200, no 500).

## 3. Fresh-submit snapshot E2E strategy

Proven at **two real-Postgres layers** (no mocks of the DB or the grader):

1. **API-level integration test** (`routes/user-fresh-submit-snapshot.integration.test.ts`)
   — the deterministic, reproducible backbone. Mirrors the existing
   `user-submit.integration.test.ts`: a per-run throwaway schema via
   `createTestSchema()` (dropped on teardown, never production, never the live
   catalog), the production `/submit`, `/check`, and `/portfolio-artifact`
   handlers, only auth/email/streak mocked. Seeds a **synthetic** opted-in
   `sql_resultset` step **in the throwaway schema** (an ephemeral fixture — NOT
   a catalog opt-in; the 2 live opted-in rows are untouched). Run via
   `pnpm --filter @workspace/api-server run test:integration`
   (`INTEGRATION_TEST_DB_ALLOW=1`); excluded from the default unit suite.

2. **True full-stack browser run** against the live persistent stack
   (`scripts/e2e-fullstack-portfolio.sh`, extended `seed:e2e --fresh-submit`):
   real frontend → real API → real Postgres → real generated client → real file
   download in Chromium (see §8).

**Leak-distinction technique (the Task-10 nuance):** a learner's correct
submission legitimately contains cell values that also appear in the answer key
— that is allowed as learner *evidence*. To detect genuine spec/answer-key
leakage we plant a `secretSentinel` key INSIDE the server-only validation spec
(a value that exists ONLY in `validation_config`, never in any submission) and
assert it never surfaces in the snapshot row, the artifact bundle, or any
response. Its absence is unambiguous proof no spec object serialized.

## 4. `/check` writes no snapshot

Integration test, real Postgres:
- `/check` with the correct `{columns, rows}` → `status: passed`, and the
  `portfolio_submission_snapshots` count for (user, project) is **0**, with **0**
  `user_step_completions` (the `/check` path opens no transaction and does no
  DB writes — `gradeSubmission` is pure).
- `/check` with an invalid payload → `status: failed`, snapshot count still
  **0**, completions still **0**.

## 5. `/submit` fresh pass writes one safe snapshot

Integration test, real Postgres — after the first passing `/submit`:
- exactly **1** snapshot row for (user, project, step);
- `passed=true`, `validation_kind='sql_resultset'`, `is_server_graded=true`,
  `submission_sha256` set (64 hex), `source='submit_legacy'`,
  `runtime_output_sha256=NULL` (legacy, non-envelope path);
- the serialized row contains the learner's submitted rows as **evidence**
  (`submission_excerpt`), but NONE of `serverGrade` / `expectedRows` /
  `expectedRowsHash` / `validationConfig` / `"spec"` / the `secretSentinel`.

Reconfirmed on the **live persistent stack**: a real `/submit` of the correct C2
step-2 rows returned `{status: passed, isFirstPass: true, xpEarned: 115}` and
wrote one `sql_resultset` / server-graded / `submit_legacy` snapshot; a DB scan
of `row_to_json(snapshot)` showed `serverGrade`/`expectedRows`/`validation_config`/
`secretSentinel` all **absent**.

## 6. Repeat-submit idempotency

Integration test — a second identical `/submit`:
- `isFirstPass` is not true, `xpEarned=0`;
- snapshot count stays **1** (the `isFreshPass` gate + `onConflictDoNothing` on
  the unique `(user, project, step)` index — append-only-once);
- `xp_transactions` count and `user_xp.total_xp` are **unchanged** (no double
  award, no duplicate ledger row).

A later **failing** `/submit` keeps the snapshot count at **1** and does not
downgrade the pass (monotonic-pass guard). Implementation and the Phase-60B docs
agree (unique-index append-only-once); no doc/impl reconciliation was needed.

## 7. Artifact reflects snapshot availability

`assemblePortfolioArtifactInput` derives `submittedCodeAvailable` from the
PRESENCE of a snapshot `submission_sha256` (never its content). The generator
renders that into `LIMITATIONS.md`. Verified before/after, both layers:
- **before** a snapshot: `LIMITATIONS.md` says the submitted code is "**not
  included**" — honest degradation;
- **after** the fresh submit: that line is gone (code availability reflected),
  while "submitted runtime output is **not included**" remains (legacy path has
  no runtime-output evidence — still honest); `VALIDATION_EVIDENCE.md` shows the
  `sql_resultset` step as **server-graded**.

No raw code/output preview is exposed; no new excerpt-preview UI was added.

## 8. True browser download after fresh submit

`scripts/e2e-fullstack-portfolio.sh` (extended) booted the real stack
(API :5055, frontend :4178, Docker Postgres :5434) under the gated test-auth
adapter + the new CORS allowlist (the runner declares
`ATLAS_ALLOWED_ORIGINS=http://127.0.0.1:4178`). `seed:e2e ATLAS_E2E_FRESH_SUBMIT=1`
enrolled the test learner IN-PROGRESS and cleared their own completions +
snapshots (only this synthetic learner's transient rows), so the target step was
un-passed. A real `/submit` of the correct C2 step-2 rows created the durable
snapshot; the default `seed:e2e` then completed the remaining steps (the snapshot
survives — the seed never touches the snapshot table) so the Certificates cert
card renders.

In real Chromium: the cert card rendered the **real authored project title**
(proving the cross-origin `/api/user/portfolio` call succeeded under the
allowlist), the **"Download Portfolio Bundle"** button downloaded a real file
(`…-portfolio.json`) via the real `/portfolio-artifact` route → real DB-backed
assembly → real generator. The downloaded bytes:
- reflect the snapshot (the "code not included" line is gone; the step is shown
  server-graded);
- carry the four required files (README, VALIDATION_EVIDENCE, LIMITATIONS,
  LEARNER_REFLECTION_TEMPLATE);
- contain the single allowed Atlas-verified claim;
- contain no spec/answer-key (`expectedRows`/`serverGrade`/`secretSentinel`/
  `validation_config` all absent), and no forbidden claim.

## 9. No-leak verification

Across the snapshot row, the artifact bundle, and every response (both layers):
no `validationConfig`, `expectedRows`, `expectedRowsHash`, hidden spec, answer
key, reference query, comparator diagnostic, secret, or `secretSentinel`. The
only answer-key-token match in the downloaded bundle was the substring
`overlap` inside the authored skill prose "no **overlap**ping effective ranges"
(the same documented Phase-60E false positive) — authored English, NOT the
answer-key cell value; the distinctive token `one_current` was **absent**. The
no-leak guarantee remains the server-side assembly chokepoint (unchanged) plus
the route's fail-closed `findBannedClaims` guard.

## 10. Evidence-honesty verification

The artifact makes only the allowed Atlas-verified claim ("Atlas verified that
submitted runtime output or artifacts matched the enabled validation checks…")
and the honest LIMITATIONS disclaimers ("does not prove… without assistance",
"does not guarantee employment", "does not certify… competence"). No
tamper-proof / cheat-proof / job-guaranteed / verified-authorship / no-outside-help
copy in the snapshot, the bundle, or any response. The runtime `findBannedClaims`
fail-closed route guard is unchanged.

## 11. Independent reviews

- **atlas-architect-reviewer → PASS** (no P0/P1): auth removals
  production-equivalent (cache-key parity proven via the auth wiring + NOT NULL
  `clerk_id`); CORS production-inert + no wildcard+credentials; evidence-loop
  test isolated, non-leaking, and idempotent; `CLONED_TABLES` change test-only +
  prod-safe; invariants intact (csv 1 / sql 1).
- **code-reviewer → SHIP** (no P0/P1): same verifications end-to-end; confirmed
  the grading path is real (not faked output), the sentinel leak-probe is sound,
  and the idempotency assertions are non-vacuous.

**P2s fixed in-phase (both reviewers, scoped + low-risk):**
- `.gitattributes` now normalizes `*.sh` to `eol=lf` — a CRLF on the runner
  could carry a trailing `\r` into the `ATLAS_ALLOWED_ORIGINS` value on Windows
  and silently break the allowlist match.
- `lib/cors.ts` dev defaults now include `http://127.0.0.1:4178` (the harness FE
  port) so plain `pnpm dev` against the harness port works belt-and-suspenders.

**P2 noted, no action:** `resolveAllowedOrigins` is called twice at boot (warn +
build) — pure and cheap; left as-is for clarity.

## 12. Latent defect found + fixed (Phase-60B regression in the test harness)

`lib/db/src/test-helpers.ts` `CLONED_TABLES` did not include
`portfolio_submission_snapshots`. Phase 60B added a snapshot write to the
`/submit` fresh-pass path, so in a namespaced test schema the unqualified INSERT
fell through `search_path` to **public**'s FK-bearing table → FK violation →
500. This had **silently broken the pre-existing Phase-30B concurrency
integration test** (verified: 4 failing before the fix, 4 passing after). Added
the table to the clone list (`LIKE` copies the unique index but not FKs), which
repairs both the 30B test and the new 60F test. Test-only helper, gated by
`assertNonProductionEnv` — no production surface touched.

## 13. Tests & gates (Node 24 + Docker PG :5434)

typecheck (4 projects) + `check:no-heuristic-runtime` **OK** · **check:boot OK** ·
api-server unit **604/604** (+ new `cors.test.ts`; updated `ai.test.ts`) · atlas
**165/165** · **integration 4/4** (both `user-submit.integration.test.ts` —
repaired — and the new `user-fresh-submit-snapshot.integration.test.ts`) ·
`audit:authoring` exit 0 · `audit:sql-resultset-bc` PASS (3 dark + **1**) ·
`audit:csv-set-equal-bc` PASS (**1**) · `audit:contains-bc` 3/3 · full-stack
portfolio download **browser-verified end-to-end** with a real snapshot present.

## 14. Final invariants (confirmed)

Exactly **1** `csv_set_equal` + **1** `sql_resultset` opted in (live catalog,
unchanged); no new validation rows/kinds; envelope enforcement **OFF**; Phase 52
untouched; **no schema/migration**; artifact route still authenticated +
read-only; `/check` writes no snapshots; `/submit` writes a safe snapshot only on
a fresh pass; repeat submit does not duplicate XP/progress; the frontend exposes
only safe generated artifacts; auth/CORS hardening did not weaken production
security; `RUBRIC_VERSION` frozen. **Phase 60G not started.**

## 15. Remaining limitations

- The frontend still fakes **identity** (Clerk shim) for the browser run; real
  Clerk SSO in a browser needs real keys (a deploy concern, not a code blocker).
- The browser fresh-submit used a `/submit` of the browser-equivalent
  `{columns, rows}` (the answer the learner's DuckDB run would produce) rather
  than an in-browser DuckDB execution + submit UI flow — that in-browser
  run→submit path is still the documented standing deferral (no submit UI on the
  Certificates page).
- CORS production hardening is an operator opt-in (`ATLAS_ALLOWED_ORIGINS`);
  production is inert until set. The boot warn recommends setting it.
- Stripe/Resend/Anthropic connectors remain warn-and-skip locally (fine for the
  portfolio flow; D1/0.2 is separate).

## 16. Phase 60G recommendation

With the evidence loop proven end-to-end and the auth/CORS debt cleared, the
deferred E2 tail is unblocked — owner-gated: (1) optional **safe
submission-excerpt preview** in the artifact behind a FRESH no-leak review; then
(2) **GitHub export / publishing**. Also worth folding in: set
`ATLAS_ALLOWED_ORIGINS` in the deploy manifest so production CORS is hardened
(not just inert). None started.
