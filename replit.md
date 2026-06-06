> **⚠️ LEGACY — Replit-era engineering context.** Superseded by root `CLAUDE.md` as the authoritative
> Claude Code operating manual. **Preserved, not deleted** — it holds detailed, still-accurate engineering
> notes: connector wiring (Stripe/Resend/Anthropic), the Pyodide runner, auth auto-provisioning, the
> `stripe.subscription_status` enum gotcha, and inline close-outs for phases 55/56/57A.
> **Caveat:** the Billing / AI Tutor / Email sections describe the *current Replit-coupled state that
> Phase 0.2 will decouple* — treat them as current-state-to-migrate, NOT target-state. For live status,
> phase sequence, and hard stops, read `CLAUDE.md` and `.agentic/progress.md`.
>
> _Filename kept as `replit.md` intentionally — no rename this phase._

---

# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run migrate` — apply Drizzle migrations from `lib/db/drizzle/` to `$DATABASE_URL` (idempotent; use for production. See `docs/deployment-checklist.md`)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/scripts run seed:stripe` — create the Pro Plan product + monthly/annual prices in Stripe (idempotent — only run once per Stripe account)
- `pnpm --filter @workspace/scripts run backfill:course` — Phase-8 one-shot backfill of `projects.course` + `tracks.is_primary` (idempotent)
- `pnpm --filter @workspace/scripts run grant:admin -- <email>` — promote a user to admin role

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Atlas Product

Atlas is a project-based learning platform for Data Engineering. Artifacts:

- `artifacts/atlas` — React + Vite frontend at `/`
- `artifacts/api-server` — Express API at `/api`
- `artifacts/mockup-sandbox` — Canvas/component preview at `/__mockup`

### Auth

Clerk (`@clerk/react` on the client + `@clerk/express` on the server). `getCurrentUser(req)` returns the local `users` row (looked up by `clerkId`).

**Auto-provisioning:** `requireAuth` (in `artifacts/api-server/src/lib/auth.ts`) is async. On the first authed request from a new Clerk user, it calls `clerkClient.users.getUser(userId)` to read email/name/avatar and inserts a row into the local `users` table. Subsequent requests hit a per-process Map cache (`userCache`) so there is no per-request Clerk roundtrip or DB SELECT. Email-uniqueness collisions on insert fall back to a clerk-scoped placeholder email (`<clerkId>@users.atlasprojects.dev`) so the app stays functional even if a previous local account used the same address.

**Admin gate (Phase 8):** `requireAdmin` chains off `requireAuth` and rejects anyone whose `users.role !== 'admin'` with 403. Use `pnpm --filter @workspace/scripts run grant:admin -- <email>` to promote the first admin.

Trade-off: cache is per-process and never refreshed once primed. For a single-instance deployment this is fine; for multi-instance or when Clerk profile data needs to propagate, add a TTL or invalidate on a Clerk webhook.

### Code Execution (Pyodide)

Python code in the project workspace runs **entirely in the browser** via [Pyodide](https://pyodide.org/) (loaded from jsdelivr CDN on first use, ~10MB). Implementation in `artifacts/atlas/src/lib/pyodideRunner.ts`:

- Detects imports in user code and pre-loads matching wheels (numpy, pandas, scipy, matplotlib, scikit-learn, etc.) before execution.
- Serializes runs through a single promise chain so the global `setStdout`/`setStderr` handlers never interleave between concurrent calls.
- Timeouts mark the run abandoned (Pyodide can't actually be cancelled from JS — late output is dropped, and the next queued run waits for the abandoned one to finish before starting).

The legacy `POST /api/execute/python` endpoint returns a deprecation no-op since the public Piston API switched to whitelist-only in Feb 2026.

### Billing (Stripe)

Uses the Replit Stripe connector with `stripe-replit-sync`, which mirrors Stripe data into a `stripe.*` schema in our Postgres DB and provides a managed webhook.

Startup sequence in `artifacts/api-server/src/index.ts`:

1. `runMigrations` creates the `stripe` schema and tables.
2. `findOrCreateManagedWebhook` registers `https://${REPLIT_DOMAINS[0]}/api/webhooks/stripe` with Stripe.
3. `syncBackfill` pulls existing Stripe data into the `stripe.*` tables.

If Stripe init fails, the rest of the API still serves traffic — only billing routes will fail until the connector is configured.

Routes:

- `GET /api/billing/plans` — Pro Plan price IDs are sourced live from `stripe.prices` (joined to `stripe.products` where `name = 'Pro Plan'` and `active = true`). Falls back to `STRIPE_PRO_*_PRICE_ID` env vars.
- `POST /api/billing/checkout` — Validates the submitted `priceId` against the active Pro price allowlist. `ensureStripeCustomer` creates the Stripe customer with an idempotency key keyed by `user.id` and writes back to `users.stripe_customer_id` only when the column is still NULL.
- `POST /api/billing/portal` — Stripe Billing Portal session.
- `POST /api/webhooks/stripe` — Registered with `express.raw` BEFORE `express.json`. Verifies signature via `stripe-replit-sync`, calls `reconcileCustomer` to mirror state into our `users.subscriptionTier` + `subscriptions` rows, and only marks the event in `processed_webhook_events` after both sync and reconcile succeed.

`subscription_status` enum collision note: our `public.subscription_status` enum collides with the unqualified `IF NOT EXISTS` check in `stripe-replit-sync`'s 0004 migration. The fix is to pre-create `stripe.subscription_status` before `runMigrations` runs. If you reset to a fresh DB, run:

```sql
CREATE SCHEMA IF NOT EXISTS stripe;
CREATE TYPE stripe.subscription_status AS ENUM ('trialing','active','canceled','incomplete','incomplete_expired','past_due','unpaid');
```

before starting the api-server.

Environment: secret/publishable/webhook keys come from the Replit Stripe connector. `REPLIT_DEPLOYMENT` selects between development/production environments.

### AI Tutor (Anthropic)

Streamed Claude responses at `POST /api/ai/chat` (SSE) in `artifacts/api-server/src/routes/ai.ts`. Uses the Replit AI Integrations Anthropic proxy via `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` + `AI_INTEGRATIONS_ANTHROPIC_API_KEY`. Free tier → `claude-haiku-4-5`, Pro tier → `claude-sonnet-4-5`.

### Transactional Email (Resend)

`artifacts/api-server/src/lib/email.ts` fetches Resend credentials from the Replit Resend connector (`REPLIT_CONNECTORS_HOSTNAME` + `REPL_IDENTITY`), caches them in-process, and exposes `sendEmail()` + `renderWaitlistConfirmationEmail()`. Wired fire-and-forget into `POST /api/waitlist`; failures are logged via `req.log.warn`.

Free-email domains (gmail / outlook / yahoo / icloud / etc.) cannot be used as the FROM address — Resend rejects them at the API layer. The lib auto-falls-back to `onboarding@resend.dev` (Resend's sandbox sender). For production, verify a custom domain (e.g. `mail.atlasprojects.dev`) in the Resend dashboard and update the connection's `from_email`.

### Curriculum Seed Data scope

Only `csv-to-postgres-pipeline` (4 steps) and `dbt-data-models` (2 steps) were fully enriched in the v1 hint ladder. Phase 7 added 18 more fully-authored modules. The remaining ~45 catalog projects fall back to the legacy `hints[]` column. Seed: `scripts/src/seed-pedagogy.ts` (idempotent, called from `seed.ts`). Audit: `pnpm --filter @workspace/scripts run audit:pedagogy`.

### Curriculum Seed Data

`scripts/src/seed.ts` is the authoritative seed entrypoint, idempotent. Companion modules:

- `scripts/src/seed-mastery-python.ts` — 12 Python Mastery modules (fundamentals → LangChain).
- `scripts/src/seed-mastery-sql.ts` — 6 SQL Mastery modules (foundations → DB design).
- `scripts/src/seed-projects-extra.ts` — full step content for projects 11-15 (Flink, Data Catalog, Real-Time Dashboard, Data Mesh, Column-Store).

The seed handles in-place upgrades for projects that previously existed only as stubs. Run with `pnpm --filter @workspace/scripts run seed`.

## Active Invariants / Gates (Phase 11+)

- `RUBRIC_VERSION='1.0.1'` — frozen. No weight edits, no quality-gate weakening.
- `AuthoredProject.candidateId: string` — REQUIRED (typed, not a comment). All promotes need a candidate row.
- Anchor drift ≤ ±1 (target 0.00) across every promote.
- All catalog / wave / admin / triage reports MUST read `projects.course` directly. No runtime `mapToCourse` calls outside the 4-file allowlist — `check:no-heuristic-runtime` chains into `pnpm run typecheck`.
- Learner-facing routes filter `learner_visible = TRUE`. Hidden slugs return **404 (not 403)** — no existence leak.
- Admin route (`GET /api/admin/quality`) does NOT filter; exposes `hiddenCount` + `hiddenSlugs` and `lineageIntegrity { promotedProjects, candidatesWithInverse, mismatches, inverseMismatches, duplicateCandidatePromotions }` — all four lineage failure modes must read zero.
- Bidirectional candidate ↔ project lineage: `promote()` writes both FK directions atomically and hard-fails if the inverse `UPDATE` doesn't match exactly 1 row.
- Archive = hide (`learner_visible=false`), not destroy. No row deletes from `projects` or `project_candidates`. Two archive-gate patterns exist: thin-stub archives assert `total_steps=0 AND enrolled_count=0` (`archive-thin-stubs.ts`); supersedence archives (Phase 11/12B/37) assert `enrolled_count=0` AND that the upgraded counterpart exists+visible.
- The 9 Atlas courses: `data-engineering` · `ai-engineer` · `mlops-engineer` · `data-scientist` · `analytics-engineer` · `applied-llm-engineer` · `cloud-data-engineer` · `python-libraries` · `sql`. Atlas is NEVER described as a 4-domain / 4-discipline platform.

## Current Phase

Live session state (latest shipped phase, working-tree status, gate summary, commit refs) lives in **`HANDOFF.md`** — single source of truth.
Per-phase close-out records live in `docs/phases/`. The Phase History below is the chronological index.

## Phase History

Latest 3 phases below (2–3 line summaries). Full per-phase close-outs live in `docs/phases/*.md`; chronological index (oldest-first, every closed phase): [docs/phases/INDEX.md](docs/phases/INDEX.md).

- **Phase 57A — `csv_set_equal` DARK Server-Side Comparator** → [phase-57a-csv-set-equal-comparator.md](docs/phases/phase-57a-csv-set-equal-comparator.md). Runtime `gradeCsvSetEqual(spec, submission)` + canonical multiset hash helper `computeCsvSetEqualHash(columns, rows, opts)` in `artifacts/api-server/src/lib/grading.ts`. Dispatch case added after `contains`, before `regex`, with the same outer `&& step.validationConfig` guard so null-config rows still hit generic auto-pass. Opt-in via `spec.serverGrade: true`; non-boolean values are treated as opt-out at runtime (defense in depth). **No project opts in this phase** — all 15 visible `csv_set_equal` rows produce byte-identical `{passed:true, feedback:"Step completed."}` per `audit:csv-set-equal-bc` (15/15 across 105 synthetic submissions). Submission contract (opted-in path): JSON of shape `{columns: string[], rows: (string|number|boolean|null)[][]}` — mirrors future Phase-57B `RunCapture` envelope shape. Comparator accepts `expectedRows` (inline) OR `expectedRowsHash` (64-char lowercase hex SHA-256 of canonical multiset fingerprint). Canonicalization knobs: `orderSensitive` (default false → multiset; true requires inline `expectedRows`, hash-alone is multiset-only), `trimStrings`, `nullEqualsEmpty` (null and "" collapse to null), `coerceNumericStrings` (`/^-?\d+(\.\d+)?$/` strings → `Number()`), `caseInsensitive` (string cells AND headers lowercased), `dedupe: "expected"|"both"|false`. Malformed specs (missing columns/expected, non-boolean flags, bad hex, width mismatch, orderSensitive+hash-only) and malformed submissions (empty, non-JSON, wrong shape, wrong cell types) fail CLOSED with learner-readable feedback. Authoring guard `assertValidCsvSetEqualSpec` in `lib/curriculum-quality/src/authoring.ts` symmetric: rejects same malformed shapes at construction time; legacy fixture shapes A–E (`expectedCsv`, shape-E `cleanColumns`/`expectedClean`/`rejectColumns`/`expectedRejects`) pass through unchanged when `serverGrade` absent. Forward-compat: unknown spec keys ignored (Phase 56 pattern). Exports new types `CsvSetEqualSpec` / `CsvSetEqualCell` / `CsvSetEqualRow`. One-shot BC audit `scripts/src/audit-csv-set-equal-bc.ts` (NEW; `audit:csv-set-equal-bc` script) read-only scans every visible `validation_type='csv_set_equal'` step and asserts `gradeCsvSetEqual` returns SAME `{passed, feedback}` as inlined pre-57A reference for 7 curated synthetic submissions per row (empty, whitespace, garbage, malformed JSON, `{}`, valid `{columns, rows}`, empty-cols variant); live DB run = **15/15 visible steps byte-identical across 105 synthetic submissions**. Defensive WARN logged if any row accidentally opts in (zero today). Deferred per approved scope: 57B (first opt-in / envelope pilot — requires submission-shape decision + Phase 44/Shape γ threat-model addendum), Shape E (multi-output `expectedClean`/`expectedRejects`), fixture-loader (`expectedCsv` server-side resolution). Hard stops: zero canary path / env vars / `/check` / `/submit` / non-`csv_set_equal` graders / OpenAPI / schema / migrations / `lib/execution-core` / frontend / Atlas UI / mockup-sandbox / project rows / step rows / `learner_visible` / cert-portfolio language / production-deploy changes; `RUBRIC_VERSION` frozen at `1.0.1`; Phase 52 operator flip kit untouched. Gates: typecheck OK · api-server 459/459 (+42: 27 csv_set_equal incl. 3 architect-fix + 15 incidental) · curriculum-quality 133/133 (+25 — architect-fix symmetry pass) · execution-core 83/83 unchanged · atlas 150/150 unchanged · audit:authoring 60/60 visible publish-ready unchanged · audit:pedagogy unchanged · audit:contains-bc 29/29 byte-identical unchanged · audit:csv-set-equal-bc 15/15 byte-identical (NEW gate) · check:no-heuristic-runtime OK. Phase 52 status unchanged.
- **Phase 56 — `contains` Validation Hardening** → [phase-56-contains-hardening.md](docs/phases/phase-56-contains-hardening.md). Runtime `contains` grader extracted into `matchContains()` (`artifacts/api-server/src/lib/grading.ts`) with structured-literal support: optional `needles[]` (≤16, non-empty strings, `CONTAINS_MAX_NEEDLES=16`), optional `match: "all"|"any"` (default `"all"`), optional `caseInsensitive` (boolean only — non-booleans coerce to `false`). Legacy `{needle}` and empty-config `{}`+`expectedOutput` fallback shapes byte-identical to pre-Phase-56; outer `&& step.validationConfig` guard preserved verbatim so null/undefined configs still hit the generic `"Step completed."` fallthrough. Precedence: `needles[]` WINS over legacy `needle` when both present; `match` without `needles` is silently ignored (legacy single-needle path runs). Malformed shapes (`needles:[]`, non-array, non-string entry, >16 entries, invalid `match` value, non-string `needle`) fail CLOSED with `"Grading config is malformed — please report this step."`. Authoring guard `assertValidContainsSpec()` in `lib/curriculum-quality/src/authoring.ts` rejects the same malformed shapes at `validationConfig("contains", ...)` construction time, plus a stricter rule (every `needles[]` entry must be non-empty — legacy `{needle:""}` quirk preserved at runtime but blocked for new projects); other kinds untouched. Three non-blocking author-intent concerns (`needle`+`needles` both set, `match` without `needles[]`, `match:"any"` with `needles[]`) surface as audit advisories in `scripts/src/audit-project-authoring.ts` (NEW `ContainsAdvisory` type + `detectContainsAdvisories()`); NOT a `ProjectFinding`; NOT counted toward `publishReady`. One-shot BC audit `scripts/src/audit-contains-bc.ts` (NEW; `audit:contains-bc` script) read-only scans every visible `validation_type='contains'` step and asserts `matchContains` returns the SAME `{passed, feedback}` as a verbatim-inlined pre-Phase-56 grader for 7 curated synthetic submissions per row; live DB run = **29/29 visible contains steps byte-identical across 203 synthetic submissions**. `scripts/tsconfig.json` `rootDir` removed (purely a `--noEmit` logical constraint) so BC script can statically import production `matchContains`. **No project opts into the new fields this phase** — legacy `{needle}` rows untouched, including C1's 7 `contains` steps from Phase 55. Hard stops: zero canary path / env vars / `/check` / `/submit` / non-`contains` grader / OpenAPI / schema / migrations / `lib/execution-core` / frontend / Atlas UI / mockup-sandbox / project rows / step rows / `learner_visible` / cert-portfolio language / production-deploy changes; `RUBRIC_VERSION` frozen at `1.0.1`; Phase 52 operator flip kit untouched. Gates: typecheck OK · api-server 417/417 (+22: 19 grader + 3 elsewhere) · curriculum-quality 108/108 (+15) · execution-core 83/83 unchanged · atlas 150/150 unchanged · audit:authoring 60/60 visible publish-ready unchanged (zero advisories printed — no opt-in this phase) · audit:pedagogy unchanged · audit:contains-bc 29/29 byte-identical (NEW gate) · check:no-heuristic-runtime OK. Phase 52 status unchanged.
- **Phase 55 — Net-New Project Production Pilot** → [phase-55-net-new-project-production-pilot.md](docs/phases/phase-55-net-new-project-production-pilot.md). Two net-new authored projects shipped sequentially with explicit user review pause between. **C1** `applied-llm-engineer-guardrails-and-structured-output-safety` (candidate `f550c1a1…`): 8 steps / 320 min / 880 XP, intermediate, stack Python+Pydantic+JSON-Schema+regex+fixture-mock LLM, validation distribution 7×contains (enforced, thin) + 1×numeric_tolerance (contract-shaped), deterministic Pyodide CLI runs keyed by SHA1 fixture mocks (zero API keys). Architect 3 rounds → PASS (wording tightening on overclaims + thin-contains evasions). Promoted at `f12fe95`. **C2** `analytics-engineer-semantic-layer-with-dbt-and-duckdb` (candidate `c2dbc2db…`): 8 steps / 340 min / 920 XP, intermediate, stack dbt-core+DuckDB+SQL+YAML+Python, validation distribution 4×sql_resultset + 1×csv_set_equal (client-provisional with REAL DuckDB-WASM runtime feedback) + 2×exact + 1×contains (enforced), **0 contract-shaped — strongest of any C-series project**. Architect 1 round → PASS (zero P0/P1; NRR algebra verified). Promoted at `0d89eb0`. Closes two distinct catalog gaps: applied-LLM had no 2026 production-reality structured-output-safety project, analytics-engineer had a thin intermediate slot + zero semantic-layer / metrics-definition coverage. **Both projects remain `learner_visible=false` pending manual publish-readiness checklist sign-off — no agent-driven visibility flip.** User-accepted caveats: catalog-wide `contains` thinness, catalog-wide `sql_resultset`/`csv_set_equal` server auto-pass (real client feedback only), difficulty-heuristic false-positive (`steps>4 OR estMin>300` → suggested=advanced, anchors immutable), fixtures described not shipped, C2 step 4 exact-match on canonical metric formulas is rigid by design. Hard stops: zero canary/env-vars/`/check`/grading/schema/migrations/OpenAPI/cert-semantics/deploy changes; `RUBRIC_VERSION` frozen at `1.0.1`; Phase 52 operator flip kit untouched. Gates: typecheck OK · audit:authoring 58/58 visible publish-ready unchanged (both hidden) · audit:pedagogy +2 hidden fully enriched · audit:difficulty-labels anchor immutability 0 mismatches · wave-report 58/58 · curriculum-quality 93/93 unchanged · execution-core 83/83 unchanged · api-server 395/395 unchanged · atlas 150/150 unchanged. Phase 52 status unchanged.
