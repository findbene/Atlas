# Phase 60A — Evidence-Safe Portfolio Artifact MVP Foundation
META: 2026-06-07 · COMPLETED · implementation (pure generator + tests + close-out) · commit d08bb25

## 1. Task Received
Phase 60A — build the first recruiter-usable, **evidence-safe portfolio artifact foundation**: a deterministic generator that produces local/manual artifact files (README.md, VALIDATION_EVIDENCE.md, LIMITATIONS.md; optional DATASET_NOTES.md + LEARNER_REFLECTION_TEMPLATE.md) from **safe existing Atlas data**, with NO GitHub OAuth, NO public publishing, NO schema churn unless proven necessary, and without overstating what Atlas verified. Implementation phase. Hard stops: no GitHub OAuth / direct push / publishing flow / certificate-marketing claims; no new `serverGrade:true` / opt-ins / kind flips; no envelope enforcement; no Phase 52 / env / canary / production / cloud changes; no high-speed waves; no force-push; no secrets; **do not start 60B**. Schema rule: avoid schema/migration; if durable records are insufficient for code/output export, document the gap for 60B rather than faking data. Route: start generator-only; add an authenticated read-only route only if low-risk + fully testable without schema churn, else skip.

## 2. Completion Status
**COMPLETED.** Built the pure generator + 45 tests + close-out. Reviews: architect **PASS** + code **SHIP** (no P0/P1); all flagged P2s either fixed in-phase or deferred-with-rationale to 60B. All gates green. The optional route was **deliberately deferred** to 60B (rationale §9). Phase 60B not started.

## 3. Files Changed
- `artifacts/api-server/src/lib/portfolioArtifact.ts` — **added** (intentional). Pure generator `generatePortfolioArtifact(input)` + `classifyEvidenceStatus(kind, flag)` + safe input types. No db/network/env access.
- `artifacts/api-server/src/lib/portfolioArtifact.test.ts` — **added** (intentional). 45 tests: no-leak (token + structural), evidence-honesty, determinism, classifier table, unavailable, md-escaping, edge cases.
- `docs/phases/phase-60a-portfolio-artifact-mvp.md` — **added** (intentional). Close-out: inventory, design, allowed/forbidden claims, OAuth-deferral rationale, 60B plan.
- `.agentic/progress.md` — **modified** (intentional). Phase 60A entry.
- `.agentic/self-review.log` — modified (hook-managed; excluded from commit).
- Archive: `Atlas_Each_Task_Mini_Reports_to_Chatgpt.html/src/15-…md` + regenerated HTML (this).
- **NOT changed:** any route/grader/audit, `lib/db` schema/migrations, `lib/api-spec`/openapi.yaml, generated codegen, authored project files, envelope, Phase 52.

## 4. Scope Control / Hard Stops Check
App code changed? **yes** — one NEW unreferenced leaf module + its test in api-server (zero callers → zero behavior change). DB schema/migration? **no.** Project content changed? **no.** Env/canary? **no.** OpenAPI/codegen? **no.** Production touched? **no.** Phase 52 touched? **no.** Any row opted in? **no** (serverGrade count still csv 1 / sql 1). GitHub OAuth / publishing / cert-marketing? **no.** Schema for code/output export? **no** — documented as a 60B gap instead. Force-push / secrets? **no.** Any unexpected file? **no.** Phase 60B started? **no.**

## 5. Existing Data Inventory
**Safe to generate today** (from existing records): completion evidence already assembled by the Phase-29 `/user/portfolio` route + the Phase-28 `/verify/:certId` view (completedAt, stepsCompleted/totalSteps, evidenceHashCount, durationSeconds, totalXpEarned, certId, verifyUrl, topRole), plus project/step metadata — `projects.title`/`short_description` (summary), `learning_objectives[]` (skills), `tech_stack[]` (tools), `job_outcomes.roles[0]` (role), `course`, `difficulty_level`, `total_steps`; `project_steps.validation_type` (the kind — a safe enum, not a spec), `required_skill`; per-step `passed`/`completed_at`; durable evidence-hash count (`submission_sha256 IS NOT NULL`). Per-step **server-graded** status is derivable as a narrow boolean (kind ∈ rowset AND `validation_config.spec.serverGrade === true`) without ever exposing the config.
**Cannot generate yet (→ 60B):** the learner's **submitted code** and **runtime output** are NOT durably stored canonically — `submission_excerpt` is a truncated, exposure-forbidden excerpt; `submission_sha256` is a one-way hash; `user_code_sessions.files` is the latest editor snapshot (one row per user+project, overwritten); `user_code_runs.code/stdout/stderr` is pruned run history. Exporting real code/output needs a new durable, append-only submission store written at passing `/submit` — a schema change, hence out of 60A scope.

## 6. Artifact Generator Design
A pure leaf module. `PortfolioArtifactInput` distinguishes project metadata · role/path · per-step completion evidence · server-graded vs client-provisional vs self-attested vs **unavailable** · limitations/disclosures — and **excludes by type** any `validationConfig`/`expectedRows`/`expectedRowsHash`/answer key/hidden spec/comparator diagnostic/secret. `classifyEvidenceStatus(kind, serverGradeFlag)` is the single source of truth for evidence strength, logically identical to runtime `deriveServerGrade`; the generator derives the displayed status per step (`unavailable` when not passed) rather than trusting a caller-set value. `generatedAtIso` is passed in (not computed) → determinism. Author-supplied fields are markdown-escaped (`mdCell`/`mdHeading`) so a `|`/`#` cannot corrupt the evidence table or inject a heading.

## 7. Implementation Details
- `generatePortfolioArtifact(input): PortfolioArtifactBundle` — renders the bundle; `DATASET_NOTES.md` only when datasets are supplied; reflection template always (pure boilerplate, no learner data).
- `classifyEvidenceStatus` — rowset kind + flag → server-graded; `self_attest` → self-attested; else client-provisional. A stray flag on a non-rowset kind never upgrades (asserted).
- The single allowed claim is centralized in one constant and reused verbatim in README + VALIDATION_EVIDENCE.
- LIMITATIONS states every non-claim, worded to avoid the forbidden phrasings **even in negation** ("produced the solution without assistance", "who wrote the code or SQL", "certify the learner's competence") so the honesty audit stays a simple substring check.
- Behavior intentionally unchanged: the module is imported only by its test; no route/grader references it.

## 8. Generated Artifact Files
`README.md` (title, role/path, course, level, summary, skills, tools, completion summary, the allowed Atlas-verified statement) · `VALIDATION_EVIDENCE.md` (per-step table: step · title · kind · skill · evidence strength · completed; legend; evidence-integrity rollup; durable `/submit` vs provisional `/check` distinction) · `LIMITATIONS.md` (non-claims, what it does reflect, data scope/freshness incl. submitted-code-unavailable) · `LEARNER_REFLECTION_TEMPLATE.md` (static) · `DATASET_NOTES.md` (conditional).

## 9. Optional Route Decision
**Deferred to 60B.** `/user/portfolio` is already in `openapi.yaml`, so a new `GET /user/portfolio/:slug/artifact` would either drift from the spec or force the known deferred ~95-file orval CRLF regen. Building the generator **dark and provable first**, then exposing it behind an authenticated read-only route, mirrors the project's dark→flip discipline (57A→57B, 58A→58B) and keeps 60A's leak surface minimal. The close-out specifies the exact 60B route (auth, session-only userId, completed+visible gate, 404-not-403, safe-columns-only SELECT, `validation_config->'spec'->>'serverGrade'`, reuse of the `user-portfolio.ts` clamps, supertest-testable, OpenAPI on next regen).

## 10. No-Leak Verification
**No-leak by construction** — the input model has no field that can carry a spec/answer key/raw submission/secret; the only validation fact per step is the `validation_type` enum + a derived narrow status. Tests assert (on a realistic C2-shaped input carrying BOTH opted-in rowset steps) that none of validationConfig/expectedRows(/Hash)/serverGrade-key/C2 query+expected fragments (one_current, overlap, 9999-12-31, generate_series, lag(, md5(, seeds/*, mart_subscription_monthly, C-100, …)/submission-excerpt/secret-like strings appear. A **structural** test attaches extra spec-like props (`validationConfig`, `expectedRows`, `answerKey`) to the input via casting and asserts none surface — proving the implementation reads only declared fields. Architect independently confirmed no leak channel.

## 11. Evidence-Honesty Verification
Tests assert the allowed claim is PRESENT and the forbidden over-claims are ABSENT (cheat-proof/tamper-proof incl. en-dash variants, job readiness/guarantee, independent authorship, "authorship" entirely, outside help, professional competence, verified honest …). Architect ran the generated bundle through the **canonical** `BANNED_H1H2_PATTERNS` + `normalize()` (NFKC/Cf-strip/dash-fold) guard → **0 hits**. Required limitation language verified present.

## 12. Independent Review Results
- **atlas-architect-reviewer: PASS** (no P0/P1). Verified empirically: 42→45/45 suite, canonical-guard 0 hits, unreferenced leaf, predicate parity, inventory accuracy. P2s: P2-1 close-out wrong spec path → **FIXED**; P2-3 dead fields → **FIXED**; P2-4 §10 placeholder → **FIXED**; P2-2 canonical-guard wiring → **DEFERRED to 60B** (cross-package; passes today); P2-5 clamp reuse → documented as 60B route requirement.
- **code-reviewer: SHIP** (no P0/P1). Verified classifier exhaustively, determinism, non-vacuous tests. P2s: markdown-injection → **FIXED** (`mdCell`/`mdHeading` + test); no-leak structural gap → **FIXED** (extra-props test); dead `unavailable`/unrendered fields → **FIXED**; durable store + guard wiring → **DEFERRED to 60B**.

## 13. Tests and Gates Run (Node 24.16.0 + Docker PG :5434)
- typecheck (`tsc --build` + per-project) — **PASS** (after fixing one test-helper signature).
- check:no-heuristic-runtime — **OK**.
- api-server vitest — **571/571 PASS** (37 files; +45 new portfolioArtifact tests; was 526 in 59B).
- audit:sql-resultset-bc — **PASS** (3 dark + 1 opted-in; 7 checks 0 failures).
- audit:csv-set-equal-bc — **PASS** (1 opted-in; 5 checks 0 failures).
- audit:contains-bc — **PASS** (3/3, 21 submissions, 0 mismatches).
- audit:authoring — **exit 0** (0 advisories).
- Frontend (atlas) / curriculum-quality — NOT RUN (untouched by this phase).

## 14. Failures, Fixes, and Surprises
- Test-helper `concatBundle` typed as `Record<string,string|undefined>` rejected `PortfolioArtifactBundle` (no index signature) → typed it as the bundle. (Caught by typecheck, not the focused vitest run — gate chain did its job.)
- One honesty assertion used `"not certify"` but the source has `**not** certify` (markdown bold) → matched on `"certify the learner's competence"` instead.
- Reviews surfaced a real correctness bug in the 60B **doc** guidance (serverGrade nested under `.spec`, not top-level) → fixed before it could mislead 60B. No code defects.

## 15. Current Git State
Branch `main`. Feature commit **`d08bb25`** (`feat(portfolio): evidence-safe portfolio artifact generator (Phase 60A)`, 4 files +1038). Archive commit follows. `git status --short`: clean except hook-managed `.agentic/self-review.log` (+ `HANDOFF.md`). Will push to `main` after archive.

## 16. Current Project State After This Task
A pure, reviewed, leak-safe, honest portfolio-artifact generator exists as a dark foundation (Epic E2 begun). Still NOT true: no route serves it; no GitHub export/publishing; learner code/output not durably stored. Still dark/off: envelope enforcement; Phase 52 canary. Exactly 1 csv + 1 sql server-graded row, both C2 (unchanged). Phase 60B (route + durable submission store + canonical-guard wiring) can safely begin **on owner approval**.

## 17. Remaining Risks / Blockers
- 60B must use `validation_config->'spec'->>'serverGrade'` and reuse the `user-portfolio.ts` clamps (documented) or it would mis-grade/leak — guard rails written into the close-out.
- Canonical H3-guard wiring is deferred (guard passes today; risk = a future copy edit regressing without the canonical net) — 60B gate.
- Real code/output export blocked until a durable submission store (60B schema).
- Full app UI boot still blocked by Phase 0.2; end-to-end route proof awaits 60B supertest.
- Observe the 2 live opted-in C2 rows in a real env before any new opt-in (unchanged standing item).

## 18. Recommended Next Step
Recommended next step: **owner approval to start Phase 60B** (authenticated read-only artifact route + durable submission store + canonical-guard wiring), per the close-out §9 design. Classification: owner approval (then implementation). Do not begin unprompted.

## Explicit Stop Statement
Stopped. Ready for next instruction. Phase 60B NOT started.
