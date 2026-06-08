# Phase 60D — full-app boot decouple + portfolio download E2E verification (close-out)

**Status:** SHIPPED. Removes the long-standing Replit-env coupling that blocked
local/test frontend boot, and verifies the Phase-60C portfolio "Download
Portfolio Bundle" flow through a REAL browser. **Infra + E2E phase — no feature
expansion. No GitHub OAuth/publishing/public pages/cert-marketing, no
excerpt-preview, no new serverGrade/opt-ins, no schema/migration, envelope
enforcement OFF, Phase 52 untouched.**

Independent reviews: **`atlas-architect-reviewer` → PASS** + **`code-reviewer`
→ SHIP**, no P0/P1.

---

## 1. The boot blocker found

`artifacts/atlas/vite.config.ts` hard-`throw`ew **at config load** when `PORT`
or `BASE_PATH` env vars were absent. Replit always injected both; off-Replit
they are unset, so *every* `vite build` / `dev` / `preview` died before doing
anything. Reproduced: `pnpm --filter @workspace/atlas run build` →
`Error: PORT environment variable is required`. Setting `PORT` + `BASE_PATH`
let the **full app build cleanly** (1708 KB JS bundle + DuckDB-WASM + PWA SW),
proving these two throws were the *only* boot blocker.

**Category:** dev-server / environment coupling. **Not the blocker:** the three
`@replit/vite-plugin-*` — `cartographer` + `dev-banner` are already lazy-imported
behind `process.env.REPL_ID !== undefined`, and `runtime-error-modal` is
off-Replit-safe. `App.tsx` separately throws on a missing
`VITE_CLERK_PUBLISHABLE_KEY`, but that is **normal app config** (a dev supplies a
test key), not Replit-platform coupling, so it is out of scope for this phase.

## 2. The decoupling fix (smallest safe change)

Converted the production config to the function form
`defineConfig(async ({ mode }) => { … })`. `PORT` / `BASE_PATH` now fall back to
safe local defaults (`5173` / `/`) **only when `mode !== "production"`**, and
**still throw in production** so a misconfigured prod deploy errors loudly:

```ts
const isProduction = mode === "production";
const rawPort  = process.env.PORT      ?? (isProduction ? undefined : "5173");
const basePath = process.env.BASE_PATH ?? (isProduction ? undefined : "/");
// …each still throws when the resolved value is missing.
```

`mode` is Vite's canonical signal: `vite dev` → `"development"` (boots with
defaults), `vite build` / `vite preview` → `"production"` (fail-fast preserved).
Everything else in the config (Replit-plugin `REPL_ID` gate, VitePWA, aliases,
`server`/`preview` blocks) is **byte-identical**, only re-indented into the
returned object. No connector functionality deleted, no auth/security weakened,
no broad rewrite.

**Why it is safe:** production behavior is unchanged (verified: a prod build with
no env still throws the new message); the fallback is strictly a dev/test
convenience; `await import(...)` of the Replit plugins runs inside the async
factory and resolves before the object returns.

> Note: `pnpm serve` runs `vite preview`, which is `mode === "production"`, so it
> still requires `PORT`/`BASE_PATH` (it serves the production build — intended).
> The decouple targets `pnpm dev` (mode development) + config-load in tests.

## 3. Boot regression guard

`artifacts/atlas/scripts/check-boot-config.ts`, wired as
`pnpm --filter @workspace/atlas run check:boot`. It imports the real config
factory and asserts: (1) development + no env → `base "/"`, `port 5173`, no
throw; (2) production + no `PORT` → throws (fail-fast intact); (3) explicit
`PORT`/`BASE_PATH` honored. Exits non-zero on any regression. It runs under
`tsx` (pure Node) rather than vitest because importing the real config pulls in
`@vitejs/plugin-react` → esbuild, whose `TextEncoder` invariant breaks under
vitest's jsdom environment.

## 4. Real-browser verification path

An **isolated** `artifacts/atlas/vite.e2e.config.ts` (separate from the
production config) builds the **real** `Certificates` page + **real**
`DownloadPortfolioBundleButton` + **real** generated client, with two test-only
seams:
- `@clerk/react` aliased to `e2e/clerk-mock.tsx` (reports a signed-in test
  learner — no real Clerk keys/network), and
- the backend faked at the `window.fetch` boundary in `e2e/e2e-main.tsx`
  (frontend network interception — an explicitly allowed strategy), serving a
  completed-project portfolio list + a safe artifact bundle, and capturing the
  download into `window.__E2E_DOWNLOAD__`.

Built to `dist/e2e` (gitignored), served via `python -m http.server`, and driven
by the global `playwright-cli` in real Chromium. **`@playwright/test` was
deliberately NOT installed** — the repo lockfile is a standing hard-stop, and a
committed Playwright runner would require modifying it.

**Verified end-to-end in a real browser:**
- page loads; the completed-project **certificate card renders**;
- **"Download Portfolio Bundle" button is visible**;
- click → the **generated client** calls `/api/user/projects/:slug/portfolio-artifact`;
- success → a **real local JSON download**
  (`…-portfolio.json` written by Chromium);
- the downloaded JSON contains `projectSlug`, `generatedAt`, `files`, and all of
  `README.md` / `VALIDATION_EVIDENCE.md` / `LIMITATIONS.md` /
  `LEARNER_REFLECTION_TEMPLATE.md`, plus the single allowed Atlas-verified claim;
- **no** answer-key / spec / config tokens in the DOM **or** the payload;
- failure (404) → the generic safe error "Couldn't prepare the bundle. Please
  try again." and **no** download. The only console error is a benign
  `favicon.ico` 404.

## 5. Authentication / test strategy

Used the safest available: a **test-only Clerk shim** (module alias, present
ONLY in the isolated e2e build) + **frontend network interception** of the two
read routes. Production auth is untouched: the 60B route still derives `userId`
exclusively from `getCurrentUser(req)` (never params), stays behind
`requireAuth`, and returns 404-not-403 for hidden/unknown/unenrolled. No auth was
disabled in any production path; no route was made public; the `user_e2e` id
lives only in the isolated mock.

## 6. No-leak & honesty verification

Browser-visible DOM and the downloaded JSON were scanned for
`validationConfig` / `expectedRows` / `expectedRowsHash` / hidden specs / answer
keys / reference queries / comparator diagnostics / secrets / banned
authorship-job-certification claims — **zero hits**. The button serializes the
route output verbatim and renders no field, so the client adds no leak channel
(the server-side assembly chokepoint remains the guarantee). The e2e fixture's
`files` shape mirrors the real generator (`portfolioArtifact.ts`), so the harness
is a faithful contract double.

## 7. Production-inertness of the harness (verified by both reviewers)

`vite.e2e.config.ts` + `e2e/*` are never imported by the production
`vite.config.ts` (root `index.html` → `src/main.tsx` → `App`). `vitest.config`
`include` and the app `tsconfig` `include` are both `src/**`, so the harness +
the `window.fetch`/Clerk mocks never run in CI or ship in `dist/public`. A grep
of `src/` for `e2e-main|clerk-mock|__E2E_*|user_e2e|vite.e2e` returns nothing.

## 8. Tests & gates (Node 24 + Docker PG :5434)

typecheck + check:no-heuristic-runtime **PASS** · **check:boot OK** · api-server
**588/588** · atlas **165/165** · audit:csv-set-equal-bc PASS (1 opt-in) ·
audit:sql-resultset-bc PASS (3 dark + 1 opt-in) · audit:contains-bc 3/3 ·
audit:authoring exit 0 (server-graded csv 1 / sql 1). Real-browser download flow
verified manually via playwright-cli (§4).

## 9. Independent reviews

- **architect → PASS** (no P0/P1): production config preserved exactly,
  harness production-inert, smallest-safe fix, no leak, invariants intact. P2s:
  e2e/scripts outside CI typecheck → **accepted with note** (§10); an inaccurate
  `.gitignore` claim → **corrected** (`.playwright-cli/` was already ignored
  since Phase 0.zz; no gitignore edit was made this phase).
- **code-reviewer → SHIP** (no P0/P1): traced prod fail-fast, async-factory
  `await import` soundness, harness isolation (grep-confirmed), `window.fetch`
  routing correctness, 404→safe-error. P2s: missing close-out → **FIXED** (this
  doc); progress.md → **FIXED**; scripts untyped → **accepted** (§10);
  `pnpm serve` prod-mode throw → **documented** (§2 note).

## 10. Accepted-with-rationale (deferred P2)

`e2e/**`, `vite.e2e.config.ts`, and `scripts/check-boot-config.ts` sit outside
the app `tsconfig` `include` (`src/**`), so `pnpm run typecheck` does not
type-check them. Deliberately not "fixed": the boot guard is a **Node** script
(`import.meta.dirname`, `node:url`) that would fail type-checking under the
**browser** app tsconfig, and the e2e harness pulls the whole app + the loose
Clerk mock — type-checking either inside the app project is higher-risk than its
value. Both are runtime-verified instead (the guard runs green via `check:boot`;
the harness was browser-verified). They are test/verification scaffolding with no
production reach.

## 11. Remaining E2E limitations

- The browser verification mocks **auth** (test Clerk shim) and the **two read
  routes** (`window.fetch`) — it does not exercise real Clerk or a live API, so a
  true full-stack browser run still awaits the Phase-0.2 backend connector
  decouple (Stripe/Resend/Anthropic) for a bootable API. The 60B route itself is
  supertest-verified against a mock DB.
- The download flow is browser-proven; the artifact *contents* remain governed by
  the 60A/60B generator + assembly (already unit/contract-tested).

## 12. Final invariants (confirmed)

Exactly 1 `csv_set_equal` + 1 `sql_resultset` opted in (both in the C2 authored
file; unchanged); no new validation rows/kinds; envelope enforcement OFF; Phase
52 untouched; **no schema/migration**; 60B route still authenticated + read-only;
`/check` writes no snapshots; `/submit` snapshot behavior unchanged; the frontend
exposes only safe generated artifacts (browser-verified). Full-app frontend boot
blocker **removed** (prod-safe). Portfolio download **browser-verified**.
`RUBRIC_VERSION` frozen. **Phase 60E not started.**

## 13. Phase 60E recommendation

With the frontend bootable in dev/test and the download flow browser-proven, the
next safe layer is the deferred E2E tail — owner-gated: (1) Phase 0.2 backend
connector decouple so the real API boots locally (enabling a true full-stack
browser run); then (2) optional safe submission-excerpt preview behind a fresh
no-leak review; then (3) GitHub export / publishing. None started.
