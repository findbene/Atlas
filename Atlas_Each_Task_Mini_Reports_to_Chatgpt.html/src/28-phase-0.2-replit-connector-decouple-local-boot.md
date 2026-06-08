# Phase 0.2 — Replit-connector decouple → clean local boot (Item 3)
META: 2026-06-08 · COMPLETED · feat (boot) · commit e19d0da

## 1. Task Received
Item 3 of the 4-item run: **Phase 0.2 — decouple Replit platform/connectors so `pnpm dev` boots on Node 24 with no external secrets**, without weakening production. Full phase ritual. Hard stops: no schema/migration, no grader/serverGrade change, no envelope enforcement, no Phase 52 change, no secret committed.

## 2. Completion Status
**COMPLETED.** Fixed the 3 remaining boot-blockers (60D/60E did the rest). API server + Vite frontend now boot with no secrets; production behavior byte-identical. Reviews architect **PASS** + code-reviewer **SHIP** (no P0/P1); converging P2 (missing PORT regression test) + a doc-nit fixed in-phase. All gates green. Committed `e19d0da`.

## 3. Files Changed
- `artifacts/api-server/src/lib/resolvePort.ts` — **added** (pure PORT resolver + `isProductionEnv`).
- `artifacts/api-server/src/lib/resolvePort.test.ts` — **added** (8-case regression guard).
- `artifacts/api-server/src/index.ts` — **modified** (use `resolvePort()`; dynamic-import `runMigrations` inside guarded `initStripe()`).
- `artifacts/atlas/src/App.tsx` — **modified** (Clerk throw gated `&& import.meta.env.PROD` + dev-only `MissingClerkKeyNotice`).
- `docs/phases/phase-0.2-…md` — **added** (close-out). `.agentic/progress.md` — **modified**.

## 4. Scope Control / Hard Stops Check
App code changed? **yes** (boot entry + frontend root + a new lib + test — the phase's purpose). DB schema/migration? **no.** Project content/validation_config? **no.** Env/canary? **no.** OpenAPI/codegen? **no.** Production touched? **behavior preserved** (verified: prod sets PORT+NODE_ENV; vite build → PROD=true; new prod detection strictly broader). Phase 52? **no.** Any row opted in? **no.** Unexpected file? **no.**

## 5. Implementation Details
`resolvePort(env)` centralizes PORT logic (required in prod via `NODE_ENV==="production" || REPLIT_DEPLOYMENT==="1"`; defaults 3000 in dev; NaN/empty/≤0 throw) so it's unit-testable (mirrors `resolveAllowedOrigins`); the boot-warn stays in `index.ts`. `runMigrations` from the Replit-coupled `stripe-replit-sync` is now a dynamic `await import(...)` inside `initStripe()`, after the `DATABASE_URL` + `REPLIT_CONNECTORS_HOSTNAME` guards, so it never runs on the local path. `App.tsx` keeps the prod throw (`import.meta.env.PROD`) but renders a dev notice instead of a white screen when the Clerk key is absent — `ClerkProvider`/all `ProtectedRoute`s never mount on that path (no bypass). `DATABASE_URL` deliberately kept a hard dep (point at Docker PG locally).

## 6. Tests and Gates Run (Node 24.16.0 + Docker PG :5434)
typecheck (4) + `check:no-heuristic-runtime` **OK** · `check:boot` **OK** · api-server unit **648/648** (+9 new `resolvePort`, +1 file) · atlas **170/170**. **Boot smoke (no secrets, ATLAS_E2E_AUTH=1):** logs `PORT unset — defaulting to 3000` + `Server listening port 3000`; `GET /api/healthz` → **200 {"status":"ok"}**; Stripe + signing-secret degrade gracefully.

## 7. Failures, Fixes, and Surprises
- First boot smoke hit `EADDRINUSE :::3000` — which actually *proved* the PORT decouple (it defaulted to 3000 and reached `app.listen`); re-ran on a free port for a clean "listening" + 200.
- Health route is `/api/healthz` (not `/api/health`) — initial 404/500 probes were wrong-path/clerk-gated; corrected.
- Reviewer P2 (no PORT regression test) — extracted `resolvePort` + added the vitest in-phase. Doc-nit (the dynamic import doesn't fully unload the package, only defers `runMigrations`) — comment corrected.

## 8. Current Git State
Branch `main`, commit **`e19d0da`** (4 source/test + close-out + progress). Archive commit (this report) follows. Tree clean except hook-managed `.agentic/self-review.log` + `HANDOFF.md` and 3 pre-existing untracked blueprint files.

## 9. Current Project State After This Task
`pnpm dev` boots the backend with no secrets (degraded mode: billing/email/tutor off, gracefully); the frontend boots to a config notice without a Clerk key (full app with a key). All inherited invariants intact; serverGrade still = 4; envelope OFF; Phase 52 untouched. **Item 4 (Phase 61B) can begin.**

## 10. Remaining Risks / Blockers
- P2-2 (App.tsx component test for the Clerk dev fallback) deferred — structurally guaranteed prod throw + provably inert fallback; low value vs a full-App render harness. Noted.
- Full frontend `pnpm dev` against a live backend still needs a Clerk key (auth mandatory, by design). Broader Node-24 `pnpm install` baseline remains the standing follow-up.

## 11. Recommended Next Step
Recommended next step: **Phase 61B — author 1 WASM-native rowset project (CSV fixtures, 6–8 steps, ≥4 rowset candidates all `serverGrade:false`)**, per the playbook reconnaissance. Classify: implementation (authoring + browser-WASM byte-verify + audits + reviews).

## 12. Explicit Stop Statement
Stopped on Phase 0.2 — COMPLETED + committed. Proceeding to Item 4 (Phase 61B) per the standing 4-item directive.
