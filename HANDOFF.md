# Atlas — Session Handoff

**HEAD:** Phase 31 — Deployment Readiness (working tree changes pending commit).
**Last shipped + committed:** Phase 30B at `30783bfe` → P30B+ control-plane cleanup at `621acf54`.
**Status:** Phase 31 **READY TO COMMIT**.

Atlas is now deploy-ready. **No deployment has occurred. No production DB has been touched.** Flipping the Replit Autoscale deploy switch is the operator's explicit next action.

---

## Phase 31 working-tree changes

**New files**
- `lib/db/drizzle/0000_phase31_baseline.sql` (494 lines, 30 tables, 14 enums — DDL-faithful baseline)
- `lib/db/drizzle/meta/_journal.json`
- `lib/db/drizzle/meta/0000_snapshot.json`
- `scripts/src/migrate.ts` (explicit production migration runner)
- `docs/deployment-checklist.md` (operator runbook for first deploy)
- `docs/phases/phase-31-deployment-readiness.md` (close-out)

**Modified files**
- `lib/db/drizzle.config.ts` (added `out: "./drizzle"`)
- `scripts/package.json` (`+ "migrate": "tsx ./src/migrate.ts"`)
- `HANDOFF.md` (this file — staleness refresh)
- `replit.md` (Key Commands: + migrate; Phase History: P23 rotated out, P31 added)
- `docs/phases/INDEX.md` (P31 entry appended)

**Unchanged:** every schema file, every route file, every test file, every seed / content / rubric / anchor file, `artifacts/api-server/src/index.ts` boot sequence, every FE file, every codegen output, every connector wiring.

---

## Strategy decision

**Explicit script (`scripts/src/migrate.ts`), not boot-time migration.** Reasoning in `docs/phases/phase-31-deployment-readiness.md`:

- Boot-time migration would couple migration health to api-server liveness — a bad migration hard-downs the app with no operator hand-off.
- Explicit script lets the operator see migration result, roll back deploy on failure, re-run after fix.
- The existing `stripe-replit-sync.runMigrations()` boot call is **unchanged** (different package, scoped to `stripe.*` schema, pre-empts the `subscription_status` ENUM collision).
- User-approval doc explicitly: *"If boot-time migration is too risky, prefer an explicit script such as scripts/src/migrate.ts and document it clearly."*

---

## Final gate summary (Phase 31)

| Gate | Result |
|---|---|
| Baseline migration generated | ✅ 30 tables, 14 enums, 494 lines |
| Migration parity (re-run `drizzle-kit generate`) | ✅ "No schema changes, nothing to migrate" |
| `pnpm run typecheck` | pending run |
| api-server unit tests | unchanged (246/246 expected — no route/schema/lib changes) |
| atlas unit tests | unchanged (74/74 expected — zero FE changes) |
| `test:integration` | unchanged (3/3 expected — fixture uses `LIKE public.*` which matches baseline DDL exactly) |
| `check:no-heuristic-runtime` | unchanged (no runtime code touched) |
| `audit:pedagogy` (visible) | 56/56 (no content changes) |
| Anchor drift | n/a |
| Architect | pending |

---

## Confirmations (per Phase 31 brief)

- **No deployment occurred.** Atlas remains in dev preview.
- **No production DB was touched.** `migrate.ts` is shipped but never invoked against any DB in this phase.
- **No product behavior changed.** All routes, schemas, validators, reducers, content, hints, and rubrics unchanged.
- **HANDOFF.md now reflects true state.** P30B committed `30783bfe`, P30B+ committed `621acf54`, Phase 31 active.

---

## Invariants preserved (verbatim, P21 → P30B)

visible 56 / hidden 32 / beginner 10 · wave 56/56 · pedagogy 56/56 visible · anchorCount 2 · anchor drift 0.00 · lineage 0/0/0/0 · 9-course taxonomy intact · `RUBRIC_VERSION='1.0.1'` frozen · `atlas-submit:${userId}` advisory-lock-key convention preserved.

---

## What's next (NOT this phase)

- **Operator action:** review `docs/deployment-checklist.md` → provision production Neon DB → run migrate script against prod URL → seed catalog + Stripe + admin → flip deploy switch.
- **Phase 32 candidate:** Public-Profile Evidence Surface (Candidate 1 from the Phase 31 read-only sweep). Smallest scope, highest standalone product value, completes the P28 → P29 → P32 evidence arc.
- **Phase 30** (production bad-completions audit) unblocks once real prod `/submit` traffic exists.
