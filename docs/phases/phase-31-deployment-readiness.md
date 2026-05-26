# Phase 31 — Deployment Readiness / Production Launch Checklist

**Status:** shipped
**Predecessor:** Phase 30B (real-PG `/submit` concurrency proof, committed `30783bfe`) → P30B+ control-plane cleanup (committed `621acf54`).
**Scope:** make Atlas deploy-ready without deploying. No production touched; no schema meaning changed; no `/submit`/`/check`/cert-verify/portfolio/FE/PWA/content/rubric/taxonomy behavior changed.

---

## What this phase shipped

1. **Drizzle baseline migration** — `lib/db/drizzle/0000_phase31_baseline.sql` (494 lines, 30 tables, 14 enums). DDL-faithful to current dev schema; round-trip parity verified (see Gates).
2. **Explicit production migration runner** — `scripts/src/migrate.ts` + `scripts/package.json:"migrate"`. Idempotent. Runs `drizzle-orm/node-postgres/migrator` against whatever DB `$DATABASE_URL` points at.
3. **Drizzle config hardening** — `lib/db/drizzle.config.ts` now declares `out: "./drizzle"` explicitly. Required for `drizzle-kit generate` re-run parity (relative path; absolute path triggers a kit 0.31.9 path-join bug).
4. **`docs/deployment-checklist.md`** — single source of truth for taking Atlas live. Covers pre-flight, secrets matrix, first-deploy procedure, Stripe/Clerk/Resend specifics, post-deploy verification (15 checks), rollback, known caveats.
5. **`HANDOFF.md` refresh** — corrected stale "Phase 30B READY TO COMMIT" claim. Now reflects: P30B committed at `30783bfe`, P30B+ cleanup committed at `621acf54`, Phase 31 active.
6. **`replit.md`** — added `pnpm --filter @workspace/scripts run migrate` to Key Commands; added Phase 31 to Phase History (latest-8 window slides P23 out).
7. **This close-out + `docs/phases/INDEX.md` entry.**

---

## Strategy decision: explicit script, NOT boot-time migration

Decision: **`scripts/src/migrate.ts` invoked manually, not at api-server boot.**

Rationale:

- Boot-time migration would couple migration health to app liveness. A bad migration would hard-down the api-server with no operator hand-off point.
- The explicit script lets the operator (a) see the migration result before traffic starts, (b) roll back the deploy if migration fails, (c) re-run after fix without restarting the app process.
- The existing `stripe-replit-sync.runMigrations()` boot call in `artifacts/api-server/src/index.ts` is **unchanged**. It's scoped to the `stripe.*` schema (external package), pre-empts the `subscription_status` ENUM collision, and is idempotent. Keeping it as-is preserves all P25–P30B behavior.
- The user-approval doc explicitly said: *"If boot-time migration is too risky, prefer an explicit script such as scripts/src/migrate.ts and document it clearly."* Both conditions met.

No `REPLIT_DEPLOYMENT` gate was added in code — the script reads `DATABASE_URL` from ambient env, so production safety is achieved by the operator pointing `DATABASE_URL` at the right DB before invoking. The deployment checklist makes this explicit.

---

## Files touched

- **New:** `lib/db/drizzle/0000_phase31_baseline.sql`, `lib/db/drizzle/meta/_journal.json`, `lib/db/drizzle/meta/0000_snapshot.json`, `scripts/src/migrate.ts`, `docs/deployment-checklist.md`, `docs/phases/phase-31-deployment-readiness.md`.
- **Modified:** `lib/db/drizzle.config.ts` (added `out: "./drizzle"`), `scripts/package.json` (`+ "migrate": "tsx ./src/migrate.ts"`), `HANDOFF.md` (staleness refresh), `replit.md` (Key Commands + Phase History), `docs/phases/INDEX.md` (Phase 31 entry).
- **Unchanged:** every schema file, every route file, every test file, every content/seed/rubric/anchor file, `artifacts/api-server/src/index.ts` boot sequence.

---

## Gates

| Gate | Result |
|---|---|
| Baseline migration generated | ✅ 30 tables, 14 enums, 494 lines, single file `0000_phase31_baseline.sql` |
| Migration parity (re-run `drizzle-kit generate` after baseline) | ✅ "No schema changes, nothing to migrate" |
| `pnpm run typecheck` | (see HANDOFF run log) |
| `pnpm --filter @workspace/api-server test` | 246/246 (unchanged) |
| `pnpm --filter @workspace/atlas test` | 74/74 (unchanged) |
| `pnpm run check:no-heuristic-runtime` | OK (unchanged) |
| `INTEGRATION_TEST_DB_ALLOW=1 pnpm --filter @workspace/api-server run test:integration` | 3/3 (unchanged — `CREATE TABLE x (LIKE public.t ...)` fixture still matches because baseline DDL matches `public.*` exactly) |
| `pnpm --filter @workspace/scripts run audit:pedagogy` | visible 56/56 (no content changes) |
| Anchor drift | n/a (no anchor-relevant changes) |
| Architect review | PASS |

---

## Invariants preserved (verbatim, P21 → P30B)

- visible 56 / hidden 32 / beginner 10
- wave 56/56, pedagogy 56/56 visible
- anchorCount 2, anchor drift 0.00
- lineage 0/0/0/0 (promoted, candidatesWithInverse, mismatches, inverseMismatches)
- 9-course taxonomy intact: `data-engineering` · `ai-engineer` · `mlops-engineer` · `data-scientist` · `analytics-engineer` · `applied-llm-engineer` · `cloud-data-engineer` · `python-libraries` · `sql`
- `RUBRIC_VERSION='1.0.1'` frozen
- `atlas-submit:${userId}` advisory-lock-key convention preserved (Phase 27)
- `/check` write-free; `/submit` transactional with `pg_advisory_xact_lock`; `/api/verify/:certId` 404-not-403; portfolio evidence chips intact

---

## Confirmations (per phase brief)

- **No deployment occurred.** Atlas remains in dev preview.
- **No production DB was touched.** `migrate.ts` is shipped but never invoked against any DB in this phase.
- **No product behavior changed.** All routes, schemas, validators, reducers, content, hints, and rubrics unchanged.
- **HANDOFF.md now reflects true state.** P30B committed, P30B+ cleanup committed, Phase 31 active.

---

## Caveats / follow-ups (deferred — not Phase 31)

- **Phase 30** (production bad-completions audit) remains parked until first deploy + real `/submit` traffic.
- **CI hook for `audit:bad-completions`** — manual today; deferred.
- **Structured-log dashboard for `/submit` lock-wait durations** — deferred; requires prod traffic to be useful.
- **Public-Profile Evidence Surface (Candidate 1 from Phase 31 read-only sweep)** — explicitly **not started** this phase per scope. Right candidate for Phase 32 if user instinct stays product-side.
- **PWA / install / offline** — explicitly not started.
