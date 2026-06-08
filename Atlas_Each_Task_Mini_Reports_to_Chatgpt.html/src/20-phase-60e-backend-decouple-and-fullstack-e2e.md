# Phase 60E — Backend Connector Decouple + True Full-Stack Portfolio Download E2E
META: 2026-06-08 · COMPLETED · infra + E2E hardening (gated test-auth decouple + real full-stack browser verification) · commit 61c5f7b

## 1. Task Received
Phase 60E — make the backend/API stack boot in a controlled local/test mode and verify the Phase-60C portfolio download through a TRUE full-stack browser path (real frontend → real API → real DB → real route → real generated client → real browser download). Infra + E2E hardening, not a GitHub/export/publishing phase. Hard stops: no GitHub OAuth/publishing/public pages/cert-marketing/excerpt-preview; no new serverGrade/opt-ins/kind flips; no envelope enforcement; no Phase 52/env/canary/cloud changes; no schema/migration (unless a proven 60B migration defect); no force-push/secrets; do not start Phase 60F.

## 2. Completion Status
**COMPLETED.** Real blocker (Clerk-key 500s) decoupled via a gated, production-inert test-auth adapter; full-stack download verified end-to-end in real Chromium; reviews architect **PASS** + code-reviewer **SHIP** (no P0/P1); all gates green. Phase 60F not started.

## 3. Files Changed
Commit `61c5f7b` (10 files, +735/−77): `artifacts/api-server/src/lib/auth.ts` (adapter) + `auth.test.ts` (new, 10 tests); `app.ts` (gated clerkMiddleware); `routes/user-portfolio.ts` (inArray fix); `scripts/src/seed-e2e-user.ts` (new) + `scripts/package.json` (`seed:e2e`); `scripts/e2e-fullstack-portfolio.sh` (new runner); `artifacts/atlas/e2e/e2e-main.tsx` (full-stack mode); `docs/phases/phase-60e-…md`; `.agentic/progress.md`. Gitignored (not committed): `dist/*`. Hook-managed: `.agentic/self-review.log`.

## 4. Scope Control / Hard Stops Check
Production app behavior changed? **no** (adapter inert in prod). DB schema/migration? **no.** Grading/serverGrade/opt-in/kind? **no.** Envelope/Phase 52/env/canary/cloud? **no.** GitHub OAuth/publishing/public pages/cert-marketing/excerpt-preview? **no.** New deps/lockfile? **no.** Secrets/force-push? **no** (removed the Docker-cred default from the runner per owner directive). Phase 60F started? **no.**

## 5. Backend / Local API Blocker Found
The API **already boots** locally with `PORT` + `DATABASE_URL` (Stripe/Replit connector init self-guards — warns+skips without `REPLIT_CONNECTORS_HOSTNAME`; envelope-secret only hard-fails under `REPLIT_DEPLOYMENT=1`). The REAL blocker = **auth**: `clerkMiddleware` (app.ts) hard-throws "Missing Clerk Secret Key" → **every** request 500s (even `/api/healthz`) without real Clerk creds. **Class:** auth/session coupling. Reproduced: booted `dist/index.mjs` → "Server listening", `curl /api/healthz` → 500 with the Clerk stack.

## 6. Decoupling Implementation
Env-gated, triple-fail-closed test-auth adapter in `lib/auth.ts`: `isE2EAuthMode()` = `ATLAS_E2E_AUTH==="1" && NODE_ENV!=="production"`; `e2eClerkIdFromRequest` resolves a **fixed** `ATLAS_E2E_AUTH_CLERK_ID` only when `ATLAS_E2E_AUTH_TOKEN` is set AND a matching `X-Atlas-E2E-Auth` header is present (else null → 401; never a request-supplied userId → no impersonation). `requireAuth`/`getCurrentUser` use the adapter (never call `getAuth`) in e2e mode; the production Clerk path is byte-unchanged. `app.ts` registers `clerkMiddleware` only `if (!isE2EAuthMode())`. Production (no `ATLAS_E2E_AUTH`) = 100% unchanged; defense-in-depth `NODE_ENV` gate enforced at the deploy manifest (`artifact.toml`).

## 7. Full-Stack E2E Setup
`scripts/e2e-fullstack-portfolio.sh` (repeatable): Docker PG :5434 → `seed` + `seed:e2e` (test learner + completed C2) → build API → build frontend e2e bundle wired to the real API (`VITE_E2E_API_BASE` + `VITE_E2E_API_TOKEN`) → boot API (PORT + DATABASE_URL + `ATLAS_E2E_AUTH=1` + token + `NODE_ENV=development`) → serve frontend → print the `playwright-cli` drive commands. `dist/*` gitignored; `DATABASE_URL` required from env (no committed credential).

## 8. Authentication / Test Strategy
Test-only Clerk shim on the frontend (60D alias mock) + the API's gated test-auth adapter: the frontend injects `X-Atlas-E2E-Auth`, the API's REAL `requireAuth` resolves the seeded learner — exercising the real auth contract (incl. 401 for tokenless) WITHOUT making the route public, bypassing prod auth, or trusting a request userId. Seeded user is a `learner` (admin routes still 403). `seed:e2e` writes only learner-side state (user + progress + step completions) — no authored content/serverGrade/answer keys.

## 9. Portfolio Download True E2E Result
Real Chromium against the real stack: frontend booted · Certificates card rendered the **real DB project title** (full authored name — proving the real `/api/user/portfolio` call, not a mock) · **"Download Portfolio Bundle"** visible · click → **real** `/api/user/projects/:slug/portfolio-artifact` → **real DB-backed assembly** → real generator → **real JSON file download** · payload had projectSlug/generatedAt/files{README, VALIDATION_EVIDENCE, LIMITATIONS, LEARNER_REFLECTION_TEMPLATE} · VALIDATION_EVIDENCE showed the **real per-step classification** (step2 `sql_resultset` + step3 `csv_set_equal` server-graded — the 2 live opted-in rows) · API-level: healthz 200, 401 no-token, 200 with token, **404 unknown slug**.

## 10. Snapshot Behavior Verification
Seeded completions have no `portfolio_submission_snapshot` → artifact **honestly degrades** (LIMITATIONS: code "not included" — verified in the payload). `/check`-writes-nothing + `/submit`-writes-on-fresh-pass remain unit-verified (`user-submit-snapshot.test.ts`, unchanged, in the 598). A browser-level fresh-`/submit`→snapshot run is deferred (needs a runnable grading/submit flow — Task 8 allows API/unit-level + documented follow-up).

## 11. No-Leak Verification
Real-browser scan of DOM **and** downloaded JSON: no `validationConfig`/`expectedRows`/`expectedRowsHash`/specs/answer-keys/queries/diagnostics/secrets/forbidden-claims. The C2 answer-key cells (`one_current`, `secretval`) and `expectedRows` were **absent**; the only banned-token match (`overlap`) was a false positive from "no **overlap**ping effective ranges" in authored skill copy. Server-side assembly chokepoint unchanged.

## 12. Evidence-Honesty Verification
Only the allowed Atlas-verified claim + honest LIMITATIONS disclaimers ("does not prove… without assistance", "does not guarantee employment", "does not certify… competence", code "not included"). No tamper-proof/cheat-proof/job-guaranteed/verified-authorship copy. Runtime `findBannedClaims` route guard unchanged.

## 13. Independent Review Results
- **atlas-architect-reviewer → PASS** (no P0/P1): production-inertness clean across three gates; fixed clerkId (no impersonation); 404-not-403 preserved; inArray correct; seed learner-only; invariants intact (csv 1 / sql 1).
- **code-reviewer → SHIP** (no P0/P1): verified the `NODE_ENV` gate at the deploy manifest (`artifact.toml`), `inArray` vs the installed Drizzle impl, idempotent FK-correct seed, non-vacuous tests. P2: getCurrentUser e2e branch untested → **FIXED** (+2 tests, 10 total); missing close-out → **FIXED**. **Deferred (rationale):** `getAuth` throws in e2e mode in out-of-scope prod routes (`user.ts:48`, `ai.ts`) — e2e-only, not the portfolio flow, not production; reflective CORS (pre-existing). Logged for a future hardening pass.

## 14. Tests and Gates Run (Node 24.16.0 + Docker PG :5434)
typecheck + check:no-heuristic-runtime **PASS** · **check:boot OK** · api-server **598/598** (+10 auth adapter tests) · atlas **165/165** · audit:csv-set-equal-bc PASS (1 opt-in) · audit:sql-resultset-bc PASS (3 dark + 1) · audit:contains-bc 3/3 · audit:authoring exit 0 (server-graded csv 1 / sql 1) · full-stack download browser-verified end-to-end.

## 15. Failures, Fixes, and Surprises
- **Surprise:** the API booted locally on the first try — the connectors were already self-guarded; the actual blocker was the Clerk-key 500, found by curling a booted server.
- **Discovered + fixed a real pre-existing bug:** `/api/user/portfolio` 500'd (`malformed array literal`) for any user with a completed project — the `= ANY(${jsArray})` binding. Fixed with `inArray`. Needed for the Certificates page to render.
- **Owner directive caught:** the runner initially defaulted the throwaway Docker credential; removed it (now requires `DATABASE_URL` from env) — never commit that cred.

## 16. Current Git State
Branch `main`. Feature commit **`61c5f7b`** (10 files, +735/−77) on top of `8a33c4b`. Archive commit follows. `git status --short` clean except hook-managed `.agentic/self-review.log`. Will push to `main` after the archive. `dist/*` gitignored.

## 17. Remaining Risks / Blockers
- Frontend still fakes **identity** (Clerk shim); real Clerk SSO in a browser needs real keys (deploy concern, not a code blocker) — the API auth middleware *contract* is exercised.
- Fresh-pass `/submit`→snapshot loop is browser-unverified (API/unit-verified) — documented follow-up.
- Two out-of-scope prod routes (`user.ts:48`, `ai.ts`) call `getAuth` unconditionally → would 500 in e2e mode (not production, not the portfolio flow) — logged for a future hardening pass, with CORS tightening.

## 18. Recommended Next Step
Owner approval for **Phase 60F** — the now-unblocked deferred E2E tail: (1) optional safe submission-excerpt preview behind a fresh no-leak review, then (2) GitHub export/publishing. Plus a small hardening pass (guard the two `getAuth` callers; tighten reflective CORS). Do not begin unprompted.

## 19. Explicit Stop Statement
**Stopped.** Backend auth decoupled (gated, production-inert), the portfolio download verified through a TRUE full stack in real Chromium (real frontend → real API → real DB → real download, leak-free + honest). Reviews PASS/SHIP, gates green, committed `61c5f7b`. **Phase 60F NOT started.** Awaiting next instruction.
