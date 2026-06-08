# Phase 60D — Full-App Boot Decouple + Portfolio Download E2E Verification
META: 2026-06-08 · COMPLETED · infra + E2E (frontend boot decouple + real-browser verification) · commit c1327ca

## 1. Task Received
Phase 60D — remove the long-standing full-app frontend boot blocker (Replit env/connector coupling) so Atlas boots in a controlled dev/test environment, then verify the Phase-60C portfolio "Download Portfolio Bundle" flow through a REAL browser. Infra + E2E phase, not feature expansion. Hard stops: no GitHub OAuth/publishing/public pages/cert-marketing; no excerpt preview; no new serverGrade/opt-ins/kind flips; no envelope enforcement; no Phase 52/env/canary/cloud changes; no schema/migration; no force-push; no secrets; do not start Phase 60E.

## 2. Completion Status
**COMPLETED.** Boot blocker found + decoupled (prod-safe); committed regression guard; real-browser E2E of the download flow verified in Chromium; reviews architect **PASS** + code-reviewer **SHIP** (no P0/P1); all gates green. Phase 60E not started.

## 3. Files Changed
Commit `c1327ca` (9 files, +554/−21): `artifacts/atlas/vite.config.ts` (decouple); `artifacts/atlas/package.json` (+`check:boot`); `artifacts/atlas/scripts/check-boot-config.ts` (new guard); `artifacts/atlas/vite.e2e.config.ts` + `artifacts/atlas/e2e/{index.html,e2e-main.tsx,clerk-mock.tsx}` (new isolated harness); `docs/phases/phase-60d-frontend-boot-decouple-and-e2e.md`; `.agentic/progress.md`. Gitignored (not committed): `dist/e2e`, `.playwright-cli/`. Hook-managed (excluded): `.agentic/self-review.log`.

## 4. Scope Control / Hard Stops Check
Production app behavior changed? **no** (prod still fail-fast). DB/schema/migration? **no.** Grading/route/serverGrade/opt-in/kind? **no.** Envelope/Phase 52/env/canary/cloud? **no.** GitHub OAuth/publishing/public pages/cert-marketing/excerpt-preview? **no.** New deps / lockfile change? **no** (deliberately did NOT install `@playwright/test`). Secrets/force-push? **no.** Phase 60E started? **no.**

## 5. Full-App Boot Blocker Found
`artifacts/atlas/vite.config.ts` hard-`throw`ew **at config load** when `PORT` or `BASE_PATH` env were absent — Replit always injected both; off-Replit they are unset, so every `vite build`/`dev`/`preview` died immediately. Reproduced: `pnpm --filter @workspace/atlas run build` → "PORT environment variable is required". With both set, the full app builds (1708 KB JS + DuckDB-WASM + PWA SW) → these two throws were the **only** boot blocker. **Category:** dev-server/env coupling. **Not the blocker:** the `@replit/vite-plugin-*` (cartographer/dev-banner already gated behind `REPL_ID`; runtime-error-modal off-Replit-safe). App.tsx's `VITE_CLERK_PUBLISHABLE_KEY` throw is normal app config, not Replit coupling (out of scope).

## 6. Decoupling Implementation
Converted to `defineConfig(async ({ mode }) => {…})`. `PORT`/`BASE_PATH` fall back to `5173`/`/` when `mode !== "production"`, but **still throw in production** (fail-fast preserved). `mode` is Vite's canonical signal (`vite dev`→development, `vite build`/`preview`→production). All other config (Replit-plugin `REPL_ID` gate, VitePWA, aliases, server/preview) byte-identical, re-indented into the returned object. Smallest safe fix — no connector deletion, no auth/security weakening, no broad rewrite. Verified: prod build no-env still throws (new message); dev mode → base "/" + port 5173; explicit env honored. Regression guard `scripts/check-boot-config.ts` (`pnpm --filter @workspace/atlas run check:boot`, tsx) asserts all three and exits non-zero on regression.

## 7. Browser Verification Path
An **isolated** `vite.e2e.config.ts` (separate from prod config) builds the REAL `Certificates` page + REAL `DownloadPortfolioBundleButton` + REAL generated client, with `@clerk/react` aliased to `e2e/clerk-mock.tsx` (test-only) and the backend faked at the `window.fetch` boundary (`e2e/e2e-main.tsx`), capturing the download to `window.__E2E_DOWNLOAD__`. Built to `dist/e2e` (gitignored), served via `python -m http.server`, driven by the global **`playwright-cli`** in real Chromium. `@playwright/test` deliberately NOT installed (lockfile is a standing hard-stop).

## 8. Authentication / Test Strategy
Safest available: a **test-only Clerk shim** (module alias present ONLY in the isolated e2e build) + **frontend network interception** of the two read routes. Production auth untouched — the 60B route still derives `userId` exclusively from `getCurrentUser(req)`, stays behind `requireAuth`, returns 404-not-403. No production auth disabled, no route made public; `user_e2e` lives only in the isolated mock. Both reviewers grep-confirmed the harness is production-inert (never imported by prod `vite.config.ts`; outside tsconfig + vitest include).

## 9. Portfolio Download E2E Result
Verified in real Chromium: page loads · **completed-project card renders** · **"Download Portfolio Bundle" button visible** · click → **generated client** calls `/api/user/projects/:slug/portfolio-artifact` · success → **real local JSON download** (`…-portfolio.json` written by the browser) · payload contains `projectSlug`, `generatedAt`, `files`, and all of `README.md`/`VALIDATION_EVIDENCE.md`/`LIMITATIONS.md`/`LEARNER_REFLECTION_TEMPLATE.md` + the allowed Atlas-verified claim · 404 → generic safe error "Couldn't prepare the bundle. Please try again." + **no** download. Only console error = benign `favicon.ico` 404.

## 10. No-Leak Verification
DOM (`document.body.innerText`) and the downloaded JSON scanned for `validationConfig`/`expectedRows`/`expectedRowsHash`/hidden specs/answer keys/reference queries/comparator diagnostics/secrets/banned claims → **zero hits** in a real browser. The button serializes the route output verbatim and renders no field, so the client adds no leak channel; the server-side assembly chokepoint remains the guarantee. The e2e fixture's `files` shape mirrors the real generator (faithful contract double).

## 11. Evidence-Honesty Verification
The browser-rendered copy + downloaded payload make only the single allowed claim ("Atlas verified that submitted runtime output or artifacts matched the enabled validation checks") and the LIMITATIONS disclaimer ("did not verify independent authorship … does not guarantee employment"). No tamper-proof/cheat-proof/job-guaranteed/verified-authorship/certified-competence strings in DOM or payload. Backend runtime `findBannedClaims` guard unchanged.

## 12. Independent Review Results
- **atlas-architect-reviewer → PASS** (no P0/P1): production config preserved exactly (diff confined to env-default + async-wrapper), harness production-inert, smallest-safe fix, no leak, invariants intact. P2s: e2e/scripts outside CI typecheck → **accepted w/ note**; inaccurate `.gitignore` claim → **corrected** (`.playwright-cli/` already ignored since Phase 0.zz; no edit made).
- **code-reviewer → SHIP** (no P0/P1): traced prod fail-fast, async-factory `await import` soundness, harness isolation (grep-confirmed 0 matches in src/), `window.fetch` routing correctness, 404→safe-error. P2s: missing close-out → **FIXED**; progress.md → **FIXED**; scripts untyped → **accepted**; `pnpm serve` prod-mode throw → **documented**.

## 13. Tests and Gates Run (Node 24.16.0 + Docker PG :5434)
typecheck + check:no-heuristic-runtime **PASS** · **check:boot OK** · api-server **588/588** · atlas **165/165** · audit:csv-set-equal-bc PASS (1 opt-in) · audit:sql-resultset-bc PASS (3 dark + 1 opt-in) · audit:contains-bc 3/3 · audit:authoring exit 0 (server-graded csv 1 / sql 1) · full atlas production build succeeds (dist/public + PWA SW) · real-browser download flow verified via playwright-cli.

## 14. Failures, Fixes, and Surprises
- **vitest can't import the vite config:** a first attempt to make the boot guard a vitest test failed — node-env conflicts with the shared jsdom `setup.ts` (`Element` undefined), and jsdom-env hits esbuild's `TextEncoder` invariant. Fix: made the guard a standalone `tsx` script (pure Node) wired as `check:boot`.
- **Surprise (good):** expected to also fight the `@replit/vite-plugin-*`; they were already `REPL_ID`-gased, so the only real blocker was the two env throws.
- **Reviewer catch:** I had stated a `.gitignore (+.playwright-cli/)` change; `git status` showed none — `.playwright-cli/` was already ignored since Phase 0.zz. Corrected the close-out + this report (no gitignore edit was made).

## 15. Current Git State
Branch `main`. Feature commit **`c1327ca`** (9 files, +554/−21) on top of `0646ca1`. Archive commit follows. `git status --short` clean except hook-managed `.agentic/self-review.log`. Will push to `main` after the archive. `dist/e2e` + `.playwright-cli/` confirmed gitignored (not committed).

## 16. Remaining Risks / Blockers
- The browser run mocks **auth** (Clerk shim) + the **two read routes** (window.fetch) — a true full-stack browser run still awaits the **Phase 0.2** backend connector decouple (Stripe/Resend/Anthropic) for a bootable local API. The 60B route is supertest-verified against a mock DB.
- `e2e/` + `scripts/` are outside the app `tsconfig`/vitest include → not type-checked in CI (intentional: node vs browser tsconfig mismatch; both are runtime/browser-verified). 
- `pnpm serve` (`vite preview` = prod mode) still requires `PORT`/`BASE_PATH` — intended (it serves the production build).

## 17. Recommended Next Step
Owner approval to start **Phase 60E** — the deferred E2E tail: (1) Phase 0.2 backend connector decouple so the real API boots locally (enabling a true full-stack browser run), then (2) optional safe submission-excerpt preview behind a fresh no-leak review, then (3) GitHub export/publishing. Do not begin unprompted.

## 18. Explicit Stop Statement
**Stopped.** Phase 60D complete: frontend boot decoupled (prod-safe), regression-guarded, and the portfolio download flow browser-verified in real Chromium. Reviews PASS/SHIP, gates green, committed `c1327ca`. **Phase 60E NOT started.** Awaiting next instruction.
