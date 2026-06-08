# Phase 60F — Fresh-Submit Snapshot E2E + Auth/CORS Hardening
META: 2026-06-08 · COMPLETED · evidence-loop + security hardening · commit 002d2e7

## 1. Task Received
Phase 60F — close the remaining portfolio evidence loop before any GitHub export/publishing: prove through a REAL full-stack path that a fresh successful `/submit` creates a durable portfolio snapshot, that the artifact route reflects it honestly, and that the browser download stays leak-free; AND harden the two remaining unconditional `getAuth` callers + tighten CORS without weakening production. Hard stops: no GitHub OAuth/publishing/public pages/excerpt-preview/cert-marketing; no new serverGrade/opt-ins/kind flips; no envelope enforcement; no Phase 52/env/canary/cloud changes; no schema/migration (unless a proven 60B snapshot defect); no force-push/secrets; do not start Phase 60G.

## 2. Completion Status
**COMPLETED.** Both thrusts shipped; evidence loop proven against real Postgres at the API level AND through a true full-stack browser download. Reviews architect **PASS** + code-reviewer **SHIP** (no P0/P1). All gates green. Committed `002d2e7`, pushed to `main`. Phase 60G not started.

## 3. Files Changed
Commit `002d2e7` (13 files, +1039/−28): `routes/user.ts`, `routes/ai.ts`, `routes/ai.test.ts`, `lib/cors.ts`(new), `lib/cors.test.ts`(new), `app.ts`, `routes/user-fresh-submit-snapshot.integration.test.ts`(new), `lib/db/src/test-helpers.ts`, `scripts/src/seed-e2e-user.ts`, `scripts/e2e-fullstack-portfolio.sh`, `.gitattributes`, `docs/phases/phase-60f-…md`(new), `.agentic/progress.md`.

## 4. Scope Control / Hard Stops Check
Production behaviour changed? **no** (auth removals equivalent; CORS prod-inert). Schema/migration? **no.** New serverGrade/opt-in/kind? **no** (the test's opted-in step is an ephemeral fixture in a throwaway schema). Envelope/Phase 52/env/canary/cloud? **no.** GitHub/publishing/public pages/excerpt-preview/cert-marketing? **no.** New deps/secrets/force-push? **no.** Phase 60G started? **no.**

## 5. Auth Hardening Implemented
Both fixes are **removals** (production byte-identical): `user.ts` `/user/profile` dropped a DEAD `getAuth(req)` (result never read; response uses `user.clerkId`). `ai.ts` `/ai/chat` finalize + `/ai/chat/mark-read` now `invalidateUserCache(user.clerkId)` instead of `getAuth(req).userId` — exact cache-key parity (`userCache` is keyed by the Clerk userId; the resolved row's `clerkId` IS that key; `clerk_id` is NOT NULL; both sites are post `if(!user)`-guard) AND works under the gated E2E mode where `getAuth` throws. Removed both `getAuth` imports; updated `ai.test.ts`. No route made public; no request userId trusted.

## 6. CORS Hardening Implemented
`lib/cors.ts`: `ATLAS_ALLOWED_ORIGINS` (comma-sep) allowlist in any env; localhost dev defaults in non-prod; PRODUCTION-INERT legacy reflective fallback (`{origin:true,credentials:true}`) when unset in prod + a boot warn recommending the allowlist. Unknown origin → `cb(null,false)` (no ACAO header, NOT an Error → no 500); no-Origin allowed; never wildcard+credentials. `lib/cors.test.ts` pins all 3 branches. **Verified live:** allowed origin (`127.0.0.1:4178`) got `Access-Control-Allow-Origin`; disallowed (`evil.example.net`) got none (clean 200).

## 7. Fresh-Submit E2E Setup
Two real-Postgres layers, no DB/grader mocks. (1) `user-fresh-submit-snapshot.integration.test.ts` — per-run throwaway schema via `createTestSchema()`, production `/submit` + `/check` + `/portfolio-artifact` handlers, a SYNTHETIC opted-in `sql_resultset` step seeded in the throwaway schema (NOT a catalog opt-in), a `secretSentinel` spec key as a sharp leak probe. Run via `test:integration` (`INTEGRATION_TEST_DB_ALLOW=1`); excluded from the unit suite. (2) `scripts/e2e-fullstack-portfolio.sh` + `seed:e2e ATLAS_E2E_FRESH_SUBMIT=1` (enroll in-progress, clear this synthetic learner's own completions+snapshots) → real `/submit` → real snapshot → browser download.

## 8. /check No-Snapshot Verification
Real Postgres: `/check` correct → `passed`, snapshot count **0**, completions **0**; `/check` invalid → `failed`, still **0**/**0**. (`/check` opens no tx, does no DB writes — `gradeSubmission` is pure.)

## 9. /submit Snapshot Verification
Real Postgres: first passing `/submit` → exactly **1** snapshot; `passed=true`, `validation_kind='sql_resultset'`, `is_server_graded=true`, `submission_sha256` set, `source='submit_legacy'`, `runtime_output_sha256=NULL`. Row carries the learner's submitted rows as EVIDENCE but none of `serverGrade`/`expectedRows`/`expectedRowsHash`/`validationConfig`/`"spec"`/`secretSentinel`. Reconfirmed on the live persistent stack (real C2 step-2 submit → `{passed,isFirstPass,xpEarned:115}`, leak-free snapshot).

## 10. Repeat-Submit / Idempotency Verification
Second identical `/submit`: `isFirstPass` not true, `xpEarned=0`, snapshot stays **1**, `xp_transactions` + `total_xp` unchanged (no double award; `isFreshPass` gate + `onConflictDoNothing` on the unique (user,project,step) index). A later FAILING submit keeps the snapshot at **1** (monotonic pass). Impl ⟷ 60B docs agree (append-only-once); no reconciliation needed.

## 11. Artifact Snapshot Reflection Result
`submittedCodeAvailable` derives from snapshot `submission_sha256` PRESENCE (never content). Before submit: LIMITATIONS says code "**not included**". After fresh submit: that line is gone (reflected); "submitted runtime output is **not included**" remains (legacy path — honest); VALIDATION_EVIDENCE shows the step **server-graded**. No raw code/output preview; no new excerpt UI.

## 12. Browser Download Result
Real Chromium against the live stack (API :5055, FE :4178, PG :5434): cert card rendered the real authored project title (proving the cross-origin `/api/user/portfolio` call works under the new allowlist); **Download Portfolio Bundle** downloaded a real `…-portfolio.json` via the real `/portfolio-artifact` route → real DB assembly → real generator. Downloaded bytes reflect the snapshot (code-included flipped on, step server-graded), carry the 4 required files + the single Atlas-verified claim, and contain no spec/answer-key/sentinel and no banned claim.

## 13. No-Leak Verification
Snapshot row + artifact bundle + every response: no `validationConfig`/`expectedRows`/`expectedRowsHash`/spec/answer-key/reference-query/comparator-diagnostic/secret/`secretSentinel`. The only answer-key-token match in the bundle was the substring `overlap` inside authored prose "no **overlap**ping effective ranges" (same documented 60E false positive) — authored English, NOT the cell value; the distinctive token `one_current` was **absent**. Learner-evidence overlap (the learner's own rows) is allowed and correctly distinguished from spec leakage.

## 14. Evidence-Honesty Verification
Only the allowed Atlas-verified claim + honest LIMITATIONS disclaimers ("does not prove… without assistance", "does not guarantee employment", "does not certify… competence"). No tamper-proof/cheat-proof/job-guaranteed/verified-authorship/no-outside-help copy anywhere. Runtime `findBannedClaims` route guard unchanged.

## 15. Independent Review Results
- **atlas-architect-reviewer → PASS** (no P0/P1): auth removals production-equivalent (cache-key parity proven); CORS prod-inert + no wildcard+credentials; evidence-loop test isolated/non-leaking/idempotent; CLONED_TABLES change test-only + prod-safe; invariants intact (csv 1 / sql 1).
- **code-reviewer → SHIP** (no P0/P1): same end-to-end; grading path is real (not faked), sentinel leak-probe sound, idempotency non-vacuous.
- **P2s fixed in-phase:** `.gitattributes` `*.sh eol=lf` (CRLF could corrupt the `ATLAS_ALLOWED_ORIGINS` value on Windows); `cors.ts` dev defaults += `127.0.0.1:4178` (harness FE port). P2 noted/no-action: double-resolve at boot (pure/cheap).

## 16. Tests and Gates Run (Node 24.16.0 + Docker PG :5434)
typecheck (4 projects) + `check:no-heuristic-runtime` **OK** · **check:boot OK** · api-server unit **604/604** (+ `cors.test.ts`) · atlas **165/165** · **integration 4/4** (repaired `user-submit.integration.test.ts` + new fresh-submit test) · `audit:authoring` exit 0 · `audit:sql-resultset-bc` PASS (3 dark + **1**) · `audit:csv-set-equal-bc` PASS (**1**) · `audit:contains-bc` 3/3 · full-stack browser download verified.

## 17. Failures, Fixes, and Surprises
- **Latent 60B defect found + fixed:** `lib/db/src/test-helpers.ts` `CLONED_TABLES` omitted `portfolio_submission_snapshots`; 60B's /submit snapshot write made the unqualified INSERT fall through `search_path` to public's FK-bearing table → FK violation → 500. This had silently broken the Phase-30B integration test (verified 4 fail → 4 pass after adding the table to the clone list).
- **Browser cert card needs `completed` status:** the fresh-submit learner was in-progress so "No certificates yet" rendered; re-ran the default `seed:e2e` to complete the project (it skips step 2's existing completion and never touches snapshots, so the real step-2 snapshot survived) → card + download button rendered.
- **`overlap` false positive** reconfirmed (authored prose, not a leak).

## 18. Current Git State
Branch `main`. Feature commit **`002d2e7`** (13 files, +1039/−28) on top of `c9d69eb`, pushed (`c9d69eb..002d2e7`). Archive commit follows. Working tree clean except hook-managed `.agentic/self-review.log`. `dist/*` + `.playwright-cli/*` gitignored.

## 19. Remaining Risks / Blockers
Frontend still fakes identity (Clerk shim). The browser fresh-submit used a `/submit` of the browser-equivalent `{columns,rows}` rather than an in-browser DuckDB run+submit UI (still the documented standing deferral — no submit UI on the Certificates page). CORS production hardening is an operator opt-in (`ATLAS_ALLOWED_ORIGINS`), inert until set.

## 20. Recommended Next Step
Owner approval for **Phase 60G**: (1) optional safe submission-excerpt preview behind a FRESH no-leak review, then (2) GitHub export/publishing; also set `ATLAS_ALLOWED_ORIGINS` in the deploy manifest so production CORS is hardened (not just inert). None started.

## 21. Explicit Stop Statement
**Stopped.** Auth + CORS hardened (production-inert), the fresh-submit → snapshot → artifact-reflection → leak-free loop proven against real Postgres at the API level AND through a true full-stack browser download in real Chromium; latent 60B test-harness defect repaired. Reviews PASS/SHIP, gates green, committed `002d2e7`. **Phase 60G NOT started.** Awaiting next instruction.
