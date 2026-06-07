# Phase 60B — authenticated portfolio-artifact route + durable submission snapshot store (close-out)

**Status:** SHIPPED. Turns the Phase-60A dark generator into a real authenticated
backend capability and adds the minimum durable storage so future artifacts can
carry safe learner-submitted-work evidence. **No GitHub OAuth, no publishing, no
new `serverGrade`/opt-ins, envelope enforcement OFF, Phase 52 untouched.**

Independent reviews: **`atlas-architect-reviewer` → PASS** + **`code-reviewer`
→ SHIP**, no P0/P1. Both independently traced the no-leak chain end-to-end and
confirmed the snapshot-vs-answer-key distinction is handled correctly.

---

## 1. Schema / data model

NEW append-only table `portfolio_submission_snapshots`
(`lib/db/src/schema/progress.ts` + migration
`lib/db/drizzle/0002_phase60b_portfolio_submission_snapshots.sql` + journal
entry idx 2). Columns: `id, user_id, project_id, step_id, step_number,
validation_kind, is_server_graded, passed, submitted_at, submission_sha256,
submission_excerpt, runtime_output_sha256, runtime_output_excerpt, source,
created_at`. FKs cascade; **unique index `(user_id, project_id, step_id)`** makes
it append-only-once; a `(user_id, project_id)` lookup index serves the assembly.
It stores ONLY learner submission/runtime EVIDENCE (a 4 KB-clamped excerpt + a
one-way sha256 of the full content) — **never** validationConfig, expectedRows,
expectedRowsHash, reference solutions, hidden specs, or comparator internals.
Migration applied + verified against Docker PG (columns/defaults/indexes/FKs
match the Drizzle schema exactly).

## 2. `/submit` snapshot behavior

`artifacts/api-server/src/routes/user.ts` — inside the existing per-user
advisory-locked reward transaction, gated on `isFreshPass` (`passed &&
!wasAlreadyPassed`):
- **/check** writes nothing (it opens no transaction at all).
- A **failing** attempt writes nothing (isFreshPass requires `passed`).
- A **re-submit** of an already-passed step writes nothing (isFreshPass false).
- A **fresh pass** writes exactly one snapshot via
  `.insert(...).values({...}).onConflictDoNothing()`; the unique index + the
  gate make a duplicate impossible. submission excerpt/sha256 reuse the existing
  `captureSubmissionEvidence` (4 KB cap); runtime output is populated only when a
  verified envelope capture exists (null on the legacy path, honestly).
- No change to grading, completion, XP, idempotency, or streak/email semantics.
- The snapshot stores the learner's **own submission** (their work) — which can
  coincide with the expected output when correct. That is intended evidence; the
  no-leak guarantee is about the **spec object**, which is never written.

## 3. Artifact route

`GET /api/user/projects/:projectSlug/portfolio-artifact`
(`artifacts/api-server/src/routes/user-portfolio-artifact.ts`, wired in
routes/index.ts). Authenticated, read-only. Returns deterministic JSON
`{ projectSlug, generatedAt, files }` where `files` is the Phase-60A bundle
(README.md, VALIDATION_EVIDENCE.md, LIMITATIONS.md, LEARNER_REFLECTION_TEMPLATE.md,
+ optional DATASET_NOTES.md). A **defense-in-depth** step runs the assembled
bundle through the canonical `findBannedClaims` guard and fails closed (500)
rather than ever serve over-claiming copy from an authored field.

## 4. Access control

- userId comes EXCLUSIVELY from the authenticated session — no param accepts it.
- **404 (never 403)** for a hidden / soft-deleted / unknown project AND for a
  non-enrolled user — no hidden-project existence leak. Symmetric with
  `user-portfolio.ts` + `cert-verify.ts`.
- No write side effects; deterministic given the records at generation time.

## 5. Safe assembly

`artifacts/api-server/src/lib/portfolioArtifactAssembly.ts` is the no-leak
chokepoint between the DB and the pure generator. It reads only safe columns;
`validation_config` is read **only** to derive the narrow `serverGradeFlag`
(via the canonical `isServerGradeOptedIn`) and is never returned. Snapshot rows
are read for **presence only** (`submission_sha256`/`runtime_output_sha256`),
never the excerpt content. Defensive clamps mirror cert-verify
(`stepsCompleted <= totalSteps`, `evidenceHashCount <= stepsCompleted`). The four
record reads run concurrently (Promise.all) once the project is resolved.

## 6. Canonical serverGrade predicate

`isServerGradeOptedIn(validationType, validationConfig)` added to
`artifacts/api-server/src/lib/grading.ts` (single source of truth: the grader
gate, the FE `deriveServerGrade` signal — now delegating to it — the /submit
snapshot stamp, and the assembly all use it). curriculum-quality keeps its own
zero-dep `isServerGradedRowset` for audit reporting (intentionally decoupled).

## 7. Honesty guard relocation (canonical, Task 6)

The H1/H2/H3 banned-claim patterns + `normalize` moved to
`lib/execution-core/src/honestClaims.ts` (byte-faithful; new subpath export
`@workspace/execution-core/honest-claims`); `artifacts/atlas/src/lib/
banned-h1h2-phrases.ts` is now a thin re-export so the frontend surfaces and
their tests are unchanged (28/28 still green). A new `findBannedClaims` helper
centralizes the normalize+match. The route output is asserted clean against this
canonical guard (route test) AND guarded at runtime (§3).

## 8. Evidence included / unavailable for historical completions

Included now (for completed/enrolled projects of the caller): project metadata,
role/path, skills, tools, per-step validation kind + server-graded/
client-provisional/self-attested/unavailable status, pass + completedAt, durable
evidence-hash count, XP, verify URL, and the honest Atlas-verified claim.
**Unavailable for older completions:** the durable code/output snapshot only
exists for `/submit` passes that happen **after** this migration, so artifacts
for pre-60B completions degrade honestly (`submittedCodeAvailable=false`) and say
so in LIMITATIONS.md. We do NOT backfill or fake historical code/output.

## 9. No-leak & honesty verification

- **No-leak:** the route test seeds answer-key-bearing specs (`expectedRows`
  with `one_current`/`overlap`/`secretval`) and asserts none of those tokens,
  nor `validationConfig`/`expectedRowsHash`/`serverGrade`/`spec`/`select `,
  appear in the response. The snapshot test asserts the persisted row carries no
  spec object. Both reviewers confirmed the assembly reads `validation_config`
  only for the boolean.
- **Honesty:** the route output is checked against the CANONICAL
  `findBannedClaims` (zero hits) in tests AND fail-closed at runtime; the single
  allowed Atlas-verified statement is asserted present.

## 10. OpenAPI / codegen decision

**Deferred to Phase 60C.** The route is fully exercised by supertest without a
generated client, and the frontend cannot boot until Phase 0.2, so nothing
consumes a typed client yet. Adding the path to `openapi.yaml` triggers the known
~95-file orval CRLF regen; bundle it with the other deferred regen (the
`serverGrade` description) in a single controlled pass. Tracked debt — must land
in 60C before any client wiring.

## 11. Independent reviews

- **architect: PASS** — reproduced gates (587/587 api-server, 28/28 atlas guard,
  83/83 execution-core, typecheck + no-heuristic green); verified append-only
  gating, no-leak by construction, 404-not-403 access, predicate parity,
  byte-faithful guard relocation, additive migration. P2s: runtime honesty guard
  on author copy → **FIXED** (§3); un-spec'd route → **DEFERRED to 60C** (§10);
  missing close-out → **FIXED** (this doc).
- **code-reviewer: SHIP** — adversarial no-leak trace confirmed the guarantee is
  framed around the spec object (never persisted/served) and the excerpt-vs-
  answer-key distinction is sound; tests non-vacuous. P2s: query fan-out →
  **FIXED** (Promise.all in assembly); two-evidence-source clarity → **FIXED**
  (comment); unbounded excerpt column → already write-clamped (4 KB), noted.

## 12. Tests & gates (Node 24 + Docker PG :5434)

typecheck + check:no-heuristic-runtime **PASS** · api-server **587/587** (+16:
route 9, snapshot 4, isServerGradeOptedIn 4 — minus mock churn) · atlas H3 guard
**28/28** (re-export preserved) · execution-core **83/83** · audit:sql-resultset-bc
PASS (3 dark + 1 opted-in) · audit:csv-set-equal-bc PASS (1 opted-in) ·
audit:contains-bc 3/3 · audit:authoring exit 0 (serverGrade csv 1 / sql 1) ·
migration applied + table verified on Docker PG.

## 13. Final invariants (confirmed)

Exactly 1 `csv_set_equal` + 1 `sql_resultset` opted in (unchanged); no new
validation rows flipped; no new kinds enabled; envelope enforcement OFF
(`envelopeGrade.ts`/`envelopeSubmit.ts` untouched); Phase 52 untouched; no
schema change beyond the additive append-only snapshot table; no
env/canary/production/cloud/GitHub-OAuth/cert-marketing change; route is
authenticated + read-only; `/check` writes no snapshots; `/submit` writes safe
snapshots only on a fresh pass. `RUBRIC_VERSION` frozen. **Phase 60C not started.**

## 14. Phase 60C recommendation

1. Add the route to `openapi.yaml` + regen orval (bundle with the deferred
   `serverGrade`-description regen + a `.gitattributes` EOL pass to contain CRLF
   churn).
2. Frontend "Download portfolio artifact" affordance consuming the typed client.
3. Optional: include a short, safe submission-excerpt preview in the artifact
   (now that snapshots exist) — gated behind a fresh no-leak review.
4. Then GitHub export / publishing (the originally-deferred E2 tail).
