# Phase 60B — Authenticated Portfolio Artifact Route + Durable Submission Snapshot Store
META: 2026-06-07 · COMPLETED · implementation (schema + route + /submit integration + guard relocation) · commit 9cee53f

## 1. Task Received
Phase 60B — turn the 60A dark portfolio-artifact generator into a real authenticated backend capability + add the minimum durable submission-snapshot storage so future artifacts can include safe learner-submitted-work evidence. Implementation phase. A schema migration is allowed ONLY for the snapshot store, fully tested. Hard stops: no GitHub OAuth / direct push / publishing / cert-marketing; no new `serverGrade:true` / opt-ins / kind flips; no envelope enforcement; no Phase 52 / env / canary / production / cloud changes; no waves; no force-push; no secrets; **do not start 60C**. Route must be authenticated, read-only, 404-not-403 for inaccessible projects, no spec/answer-key leak.

## 2. Completion Status
**COMPLETED.** Append-only snapshot table + migration (verified on Docker PG); /submit fresh-pass snapshot write; authenticated read-only artifact route; safe assembly chokepoint; canonical serverGrade predicate; H3 guard relocated to a shared lib. Reviews architect **PASS** + code **SHIP** (no P0/P1); P2s fixed in-phase or deferred-to-60C with rationale. All gates green. Phase 60C not started.

## 3. Files Changed
- `lib/db/src/schema/progress.ts` — **modified**: new `portfolioSubmissionSnapshots` table + insert schema/type.
- `lib/db/drizzle/0002_phase60b_portfolio_submission_snapshots.sql` — **added**: migration.
- `lib/db/drizzle/meta/_journal.json` — **modified**: journal idx 2.
- `lib/execution-core/src/honestClaims.ts` — **added**: relocated canonical H3 guard (+ `findBannedClaims`).
- `lib/execution-core/package.json` — **modified**: `./honest-claims` subpath export.
- `artifacts/atlas/src/lib/banned-h1h2-phrases.ts` — **modified**: now a thin re-export of the canonical guard.
- `artifacts/api-server/src/lib/grading.ts` (+ `.test.ts`) — **modified**: canonical `isServerGradeOptedIn` + tests.
- `artifacts/api-server/src/routes/projects.ts` — **modified**: `deriveServerGrade` delegates to the canonical predicate.
- `artifacts/api-server/src/routes/user.ts` — **modified**: /submit snapshot write (isFreshPass).
- `artifacts/api-server/src/lib/portfolioArtifactAssembly.ts` — **added**: safe DB→input assembly.
- `artifacts/api-server/src/routes/user-portfolio-artifact.ts` (+ `.test.ts`) — **added**: route + 9 tests.
- `artifacts/api-server/src/routes/user-submit-snapshot.test.ts` — **added**: 4 snapshot-behavior tests.
- `artifacts/api-server/src/routes/index.ts` — **modified**: wire route.
- 3 submit-test mocks (`user-submit`, `user-submit-envelope`, `user-submit-envelope-pilot`, `user-check-submit-parity`) — **modified**: `.onConflictDoNothing()` shim + `portfolioSubmissionSnapshots` token.
- `docs/phases/phase-60b-portfolio-artifact-route-and-snapshots.md`, `.agentic/progress.md` — **added/modified**.
- Hook-managed (excluded from commit): `.agentic/self-review.log`, `HANDOFF.md`.

## 4. Scope Control / Hard Stops Check
App code? **yes** (route + /submit snapshot + assembly + predicate). DB schema/migration? **yes** — ONE additive append-only table (the phase's sanctioned exception). Project content? **no.** Env/canary? **no.** OpenAPI/codegen? **no** (deferred to 60C). Production? **no.** Phase 52? **no** (envelopeGrade/envelopeSubmit untouched). Any row opted in? **no** (serverGrade still csv 1 / sql 1, grep-verified). GitHub OAuth/publishing/cert-marketing? **no.** Force-push/secrets? **no.** Phase 60C started? **no.**

## 5. Schema / Data Model Implemented
`portfolio_submission_snapshots` (append-only): `id, user_id, project_id, step_id, step_number, validation_kind, is_server_graded, passed, submitted_at, submission_sha256, submission_excerpt, runtime_output_sha256, runtime_output_excerpt, source, created_at`. FKs cascade; **unique `(user_id, project_id, step_id)`** = append-only-once + `(user_id, project_id)` lookup index. Stores ONLY learner evidence (4 KB-clamped excerpt + sha256 of full content), never specs/answer keys. Migration applied to Docker PG and `\d` verified to match the Drizzle schema (types, defaults, indexes, FKs). Follows the repo's hand-authored .sql + journal pattern (no per-migration snapshot, matching 0001).

## 6. /submit Snapshot Behavior
Inside the existing per-user advisory-locked reward tx, gated on `isFreshPass` (`passed && !wasAlreadyPassed`): /check writes nothing (no tx); failing attempts write nothing; re-submits write nothing; a fresh pass writes exactly one snapshot via `.values({...}).onConflictDoNothing()` (unique index + gate ⇒ no duplicate). submission excerpt/sha reuse `captureSubmissionEvidence` (4 KB cap + full-content sha256); runtime output only from a verified envelope capture (null on legacy path, honestly). `isServerGraded` stamped via the canonical predicate. No grading/XP/completion/idempotency/streak/email change. The snapshot stores the learner's OWN submission (intended evidence) — never the spec; the no-leak guarantee is framed around the spec object.

## 7. Artifact Route Behavior
`GET /api/user/projects/:projectSlug/portfolio-artifact` — authenticated, read-only. Returns deterministic `{ projectSlug, generatedAt, files }` (README, VALIDATION_EVIDENCE, LIMITATIONS, LEARNER_REFLECTION_TEMPLATE, + optional DATASET_NOTES). Defense-in-depth: the assembled bundle is run through the canonical `findBannedClaims` and the route fails closed (500) rather than serve over-claiming author copy. No write side effects.

## 8. Access-Control Behavior
userId from the authenticated session only (no param accepts it). 404 (never 403) for hidden / soft-deleted / unknown project AND for a non-enrolled user — no hidden-project existence leak. Symmetric with `user-portfolio.ts` + `cert-verify.ts`. Assembly returns `null` for any inaccessible case → route 404.

## 9. No-Leak Verification
Assembly reads `validation_config` ONLY to derive the narrow `serverGradeFlag` (via canonical `isServerGradeOptedIn`) and NEVER returns it; snapshot rows are read presence-only (sha256 fields), never the excerpt. The route test seeds answer-key-bearing specs (`expectedRows` with `one_current`/`overlap`/`secretval`) and asserts none of those tokens — nor `validationConfig`/`expectedRowsHash`/`serverGrade`/`spec`/`select ` — appear in the response (real assembly→generator chain; non-vacuous). The snapshot test asserts the persisted row carries no spec object. Both reviewers independently traced and confirmed no leak path (the `projects` full-row load has no answer-key column; solutions live in a separate never-queried table).

## 10. Evidence-Honesty Verification
Output makes only the allowed claim ("Atlas verified that submitted runtime output or artifacts matched the enabled validation checks") and is checked against the CANONICAL `BANNED_H1H2_PATTERNS`/`findBannedClaims` (zero hits) both in the route test AND at runtime (fail-closed). LIMITATIONS retains all required non-claims and the honest degrade for missing snapshots. Guard relocation is byte-faithful (atlas guard 28/28 preserved).

## 11. OpenAPI / Codegen Decision
**Deferred to 60C.** The route is fully exercised by supertest without a generated client, and the frontend cannot boot until Phase 0.2, so nothing consumes a typed client yet. Adding the path to `openapi.yaml` triggers the known ~95-file orval CRLF regen; bundle it with the other deferred regen in a single controlled pass. Tracked debt; must land in 60C before client wiring.

## 12. Independent Review Results
- **atlas-architect-reviewer: PASS** (no P0/P1) — reproduced gates (587/587, 28/28, 83/83, typecheck, no-heuristic); verified append-only gating, no-leak by construction, 404-not-403, predicate parity, byte-faithful guard relocation, additive migration. P2s: runtime honesty guard on author copy → **FIXED**; un-spec'd route → **DEFERRED 60C**; missing close-out → **FIXED**.
- **code-reviewer: SHIP** (no P0/P1) — adversarial no-leak trace confirmed the guarantee is framed around the spec object (never persisted/served) and the excerpt-vs-answer-key distinction is sound; tests non-vacuous; migration matches schema; tx-failure placement sound. P2s: query fan-out → **FIXED** (Promise.all); two-evidence-source clarity → **FIXED** (comment); unbounded excerpt column → already write-clamped (4 KB), noted.

## 13. Tests and Gates Run (Node 24.16.0 + Docker PG :5434)
typecheck + check:no-heuristic-runtime **PASS** · api-server **587/587** (39 files) · atlas H3 guard **28/28** (re-export preserved) · execution-core **83/83** · audit:sql-resultset-bc PASS (3 dark + 1 opted-in) · audit:csv-set-equal-bc PASS (1 opted-in) · audit:contains-bc 3/3 · audit:authoring exit 0 (serverGrade csv 1 / sql 1) · migration applied + `portfolio_submission_snapshots` verified on Docker PG. Frontend full suite not separately run beyond the 2 guard files (atlas change is the re-export only; typecheck green).

## 14. Failures, Fixes, and Surprises
- 18 initial test failures across 4 /submit test files: vitest strict mocks THREW on the undefined `portfolioSubmissionSnapshots` export, and `.values()` mocks returned a bare Promise that lacked `.onConflictDoNothing()`. Fixed both in each mock (added the token + the chained method).
- One self-inflicted bad assertion in the snapshot test: it asserted the learner's submission excerpt must not contain `one_current` — but the excerpt legitimately stores the learner's correct submission, which equals the expected rows for that step. Corrected to assert the SPEC object is never persisted (the real no-leak guarantee).
- Relocating the H3 guard, my hand-typed Unicode normalize regexes kept coming out as literal glyphs instead of `\u` escapes; resolved by `cp`-ing the original file byte-for-byte then appending `findBannedClaims`.

## 15. Current Git State
Branch `main`. Feature commit **`9cee53f`** (21 files, +1279/-166). Archive commit follows. `git status --short` clean except hook-managed `.agentic/self-review.log` + `HANDOFF.md`. Will push to `main` after archive.

## 16. Current Project State After This Task
Portfolio artifacts are now reachable through an authenticated, leak-safe, honest read-only route, and `/submit` durably records safe submission snapshots going forward. Still NOT true: no GitHub export/publishing; no public portfolio page; OpenAPI lacks the new route (60C). Still off: envelope enforcement; Phase 52 canary. Exactly 1 csv + 1 sql server-graded row (unchanged). Phase 60C can safely begin on owner approval.

## 17. Remaining Risks / Blockers
- OpenAPI/orval entry for the route is deferred (must land in 60C before client wiring); tracked.
- Historical (pre-60B) completions have no snapshot → artifacts degrade honestly to metadata/validation evidence (by design; no backfill).
- Full app UI boot still blocked by Phase 0.2; end-to-end browser proof of the route awaits 0.2 (route is supertest-verified).
- Observe the 2 live opted-in C2 rows in a real env before any new opt-in (standing).

## 18. Recommended Next Step
Recommended next step: **owner approval to start Phase 60C** (OpenAPI/orval regen for the route + frontend download affordance + optional safe excerpt preview, then GitHub export/publishing). Classification: owner approval → implementation. Do not begin unprompted.

## Explicit Stop Statement
Stopped. Ready for next instruction. Phase 60C NOT started.
