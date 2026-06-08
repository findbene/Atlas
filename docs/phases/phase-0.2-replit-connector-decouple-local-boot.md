# Phase 0.2 — Replit-connector decouple → clean local boot (close-out)

**Status:** SHIPPED. `pnpm dev` now boots the API server (and the Vite frontend) on
Node 24 with **no external secrets**, without weakening any production guarantee.
Completes the local-boot decouple begun in 60D (frontend config) and 60E (auth/CORS).
**No schema/migration, no grader/serverGrade change, envelope OFF untouched, Phase 52
untouched, no secret committed.** Independent reviews: **`atlas-architect-reviewer` →
PASS** + **`code-reviewer` → SHIP**, no P0/P1. The converging P2 (missing regression
test) and a doc-accuracy nit were fixed in-phase.

---

## 1. Problem

Three boot-blockers remained after 60D/60E, each crashing a no-secrets `pnpm dev`:

1. `artifacts/api-server/src/index.ts` — `PORT` was unconditionally required (hard throw
   at module load).
2. `artifacts/atlas/src/App.tsx` — a missing `VITE_CLERK_PUBLISHABLE_KEY` threw at module
   load, blanking every page.
3. `artifacts/api-server/src/index.ts:1` — `stripe-replit-sync` (a Replit-coupled package)
   was a top-level static import whose `runMigrations` ran on the boot path.

(`DATABASE_URL` is intentionally kept as a hard dependency — a data app needs a DB; that
is not Replit coupling. Local dev points it at the Docker PG `postgres:postgres@localhost:5434`.)

## 2. The change (3 source files + 1 test)

- **`artifacts/api-server/src/lib/resolvePort.ts`** (new) — pure `resolvePort(env)` +
  `isProductionEnv(env)`. PORT required in production (`NODE_ENV==="production" ||
  REPLIT_DEPLOYMENT==="1"`); defaults to 3000 in local dev. Side-effect-free (mirrors
  `resolveAllowedOrigins` in `cors.ts`). The boot-time warn log stays in `index.ts`.
- **`artifacts/api-server/src/lib/resolvePort.test.ts`** (new) — 8 cases pinning the new
  behavior (dev default 3000, explicit PORT honored, prod-without-PORT throws on both prod
  signals, NaN/empty/non-positive throw). The dev-default assertion fails against the
  pre-0.2 code (which threw unconditionally) — the required regression guard.
- **`artifacts/api-server/src/index.ts`** — uses `resolvePort()`; `runMigrations` moved to a
  dynamic `await import("stripe-replit-sync")` inside `initStripe()`, after the existing
  `DATABASE_URL` + `REPLIT_CONNECTORS_HOSTNAME` guards, so it never runs on the local path.
- **`artifacts/atlas/src/App.tsx`** — the module-level Clerk-key throw is now gated
  `&& import.meta.env.PROD` (production still fatal); `App()` renders a dev-only
  `MissingClerkKeyNotice` when the key is absent (unreachable in prod, which already threw).

## 3. Production behavior preserved (reviewer-verified)

- The Replit prod env sets **both** `PORT` and `NODE_ENV=production`
  (`artifacts/api-server/.replit-artifact/artifact.toml`), so fail-fast is intact; and the
  new prod detection is strictly broader than the existing envelope-secret check, so no prod
  path silently defaults to 3000.
- The frontend builds via plain `vite build` (no `--mode` override), so every production
  build has `import.meta.env.PROD === true` → the Clerk throw always fires; the dev notice
  path is dead in prod and `ClerkProvider`/all `ProtectedRoute`s never mount on it (no auth
  bypass, no leak).

## 4. Verification (Node 24.16.0 + Docker PG :5434)

- `pnpm run typecheck` (4 projects) + `check:no-heuristic-runtime` — **OK**
- `pnpm --filter @workspace/atlas run check:boot` — **OK**
- api-server unit **648/648** (+9 new `resolvePort` cases, +1 file) · atlas **170/170**
- **Boot smoke (no secrets):** `PORT` unset + `ATLAS_E2E_AUTH=1` + Docker PG →
  `"PORT unset — defaulting to 3000"`, `"Server listening port 3000"`, and
  `GET /api/healthz` → **200 `{"status":"ok"}`**. Stripe + `RUN_ENVELOPE_SIGNING_SECRET`
  degrade gracefully (warn + skip), confirming no boot-time dependency on either.

## 5. Reviews

- **architect → PASS** (no P0/P1): production fail-fast preserved, Clerk dev fallback has no
  leak/bypass, dynamic import sound, inherited invariants intact. P2: add the api-server PORT
  regression test (done) + a doc-accuracy correction (done).
- **code-reviewer → SHIP** (no P0/P1): traced every PORT branch (incl. `PORT=""` → fail-loud,
  unchanged), confirmed rules-of-hooks safe, no dangling import, scope = the intended files.

## 6. Invariants (confirmed)

No schema/migration; no grader/`serverGrade`/validation change; envelope enforcement OFF
(untouched); Phase 52 canary untouched; `RUBRIC_VERSION` frozen; archive=hide and 404-not-403
untouched; no secret committed; H3 honesty preserved (the dev notice copy makes no claims).

## 7. Remaining / follow-ups

- P2-2 (a component test for the `App.tsx` Clerk dev-fallback) is **deferred** — the prod
  throw is structurally guaranteed by `vite build` mode and the fallback path is provably
  inert; low value vs. a heavy full-`App` render harness. Noted, not silently dropped.
- A full clean `pnpm dev` of the **frontend** against a live backend is still gated on a
  Clerk key (auth is mandatory) — by design; the notice is the no-secrets affordance.
- The broader Node-24 `pnpm install` baseline remains the standing project follow-up.
