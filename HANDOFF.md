# HANDOFF

**Latest shipped phase:** Phase 39 — Durable Enrollment Counter Writer + Backfill.
**Working tree:** clean after `phase-39: durable enrolled_count writer + backfill`.
**Parent commit:** `bf6c6c51` (Phase 38 close).

---

## Phase 39 summary

Added a durable writer for `projects.enrolled_count` on the two enrollment-creation routes, plus a one-shot idempotent backfill to reconcile the historical zeroes. The column itself is unchanged — but it is now actually accurate. Phase 38's archive-safety helper is **not** touched; archive decisions still query `user_progress` directly.

**Audit findings:**

- Exactly 2 routes insert into `user_progress`: `POST /api/enrollments` (Phase 21 slug-based, race-safe via unique-index + 23505 catch) and legacy `POST /api/user/projects/:id/enroll` (idempotent existence-check, not race-protected).
- The `progress_user_project_idx (user_id, project_id)` unique index makes duplicate enrollments impossible at the DB level.
- `enrolled_count` is exposed by 5 API routes + rendered by `domain-detail.tsx` (gated on `> 0`); it's display/social-proof metadata, NOT a safety gate (P38 made that explicit).
- Safest writer: atomic SQL-level `enrolled_count + 1`, fires only on the successful-insert branch.

**Files changed**

- **Writer:**
  - `artifacts/api-server/src/routes/enrollment.ts` — Phase 21 route. Added `sql` import; wraps the increment in a try/catch and logs `warn` on counter-write failure (non-fatal; enrollment still 200s).
  - `artifacts/api-server/src/routes/user.ts` — Legacy UUID route. Same increment + try/catch + warn pattern. (`projects`, `sql`, `eq` already imported.)
  - Increment fires inside the **successful-insert branch only** — never on `existing` (idempotent re-enroll) and never on 23505 recovery (the winner already incremented for the same row).
  - Uses an atomic SQL-level `${projects.enrolledCount} + 1` expression — not JS read-modify-write — so concurrent first-enrollments by different users race-safely sum at the DB layer.
- **Backfill:** `scripts/src/backfill-enrolled-count.ts` (new) + `backfill:enrolled-count` npm alias in `scripts/package.json`.
  - Reads via the Phase-38 `getActualEnrollmentCounts` helper (single source of truth).
  - `--dry-run` mode prints planned drift without writes; default mode writes; `--allow-prod` flag required when `REPLIT_DEPLOYMENT` is set (refusal exit code `2`, distinguishable from "actual failure" `1`).
  - Prints per-project drift list BEFORE writes (forensic trail on partial failure).
  - Per-row try/catch — one row's failure doesn't abort the rest.
  - Post-write verification re-read; mismatches → `exit 1`.
  - Already-converged → "nothing to write" early exit.
- **Tests:** `artifacts/api-server/src/routes/enrollment.test.ts` (+5 P39 cases): first-enroll increments once · idempotent re-enroll no-ops · 23505 recovery no-ops · counter-write failure does NOT 500 the enrollment · two different users each increment once. Mock additions: `updateFn`/`updateSet`/`updateWhere` triad + `sql` tagged-template stub.
- **Docs:** `docs/phases/phase-39-enrollment-counter-writer.md` (new) · `replit.md` · `docs/phases/INDEX.md` · this file.

**Hard stops respected:** no schema change · no migration · no production DB touch · no deployment · no `/check` / `/submit` / cert-verify / portfolio / billing / Stripe / OpenAPI / codegen / frontend-redesign / project-content / seed / rubric / taxonomy / anchor / pedagogy edits. `enrolled_count` is NOT reintroduced into any archive safety decision.

---

## Why this shape (vs alternatives)

1. **Atomic SQL `+ 1`, not a trigger or counter table.** A trigger needs a migration (out of scope). A counter table doubles the read cost on display surfaces with no real benefit for a ≤100-row catalog. The atomic update is correct under concurrency, costs one extra UPDATE per first-enrollment, and stays inside the existing schema.
2. **Non-fatal counter writes.** Enrollment is learner-facing; bumping a social-proof number isn't. Counter-write failure → `warn` log + 200 to the learner + backfill reconciles later. Failing the enrollment because we couldn't bump a display number would be the wrong tradeoff.
3. **Helper reuse.** Backfill reads use the Phase-38 `getActualEnrollmentCounts` helper instead of re-implementing the `count(*)` query — single source of truth across all 5 callsites (3 archive scripts + seed.ts P37 block + this backfill).
4. **Tests on the Phase-21 route only.** The legacy route has no existing test file; adding one just for the writer would balloon scope. The 5 new pins cover all behavioral shapes; live coverage of the legacy route comes from the backfill re-converging to zero drift after a real seed run.
5. **Column NOT removed.** Removing it touches schema + migration + codegen + 5 routes + frontend — explicitly out of scope. Reserved for Phase 40 Shape A.
6. **Backfill prod-safety via env+flag, not interactive prompt.** `REPLIT_DEPLOYMENT && !--allow-prod` → exit 2. Operation is fully idempotent + only touches one display column, so a confirmation prompt would be ceremony without value.

---

## Gates run (all green)

- `pnpm run typecheck` — OK
- `pnpm run check:no-heuristic-runtime` — OK
- `pnpm --filter @workspace/api-server run test` — **278/278** (was 273 + 5 new P39 cases)
- `pnpm --filter @workspace/atlas run test` — 102/102 (unchanged)
- `pnpm --filter @workspace/curriculum-quality run test` — green (unchanged)
- `pnpm --filter @workspace/execution-core run test` — green (unchanged)
- `pnpm --filter @workspace/api-server run test:integration` — 3/3 (unchanged)
- `pnpm --filter @workspace/scripts run audit:authoring` — 56/56 (unchanged)
- `pnpm --filter @workspace/scripts run audit:pedagogy` — 56/56 (unchanged)
- `pnpm --filter @workspace/scripts run seed` — "Seed complete!"
- `backfill:enrolled-count -- --dry-run` (dev) — surfaced 9 drift rows from seeded data (e.g. `csv-to-postgres-pipeline 0 → 5`, `dbt-data-models 0 → 3`)
- `backfill:enrolled-count` (dev, live write) — updated 9, failed 0, post-write verification clean
- `backfill:enrolled-count` re-run (idempotency proof) — "already converged — nothing to write."

---

## Operational note (one-time, when next deploying)

After deploying Phase 39 to prod, the prod counter column will still be stale until reconciled. Run once:

```
pnpm --filter @workspace/scripts run backfill:enrolled-count -- --allow-prod
```

The script refuses without `--allow-prod` when `REPLIT_DEPLOYMENT` is set. Idempotent — safe to re-run any time.

---

## Remaining risks (Phase 40 candidates)

- Counter-write failure (rare) silently undercounts until the next backfill. Mitigated by structured `warn` log + idempotent reconciliation. Low.
- Legacy `POST /api/user/projects/:id/enroll` route has no dedicated test file (writer is identical to the covered Phase-21 one). Low.
- Two archive scripts (P11/P12B) still print operator-facing `enrolled=` log lines referring to the stale stored column. Cosmetic. Phase-38 architect already flagged.
- No `project_candidates`-row gate on the 3 archive scripts. Latent — no current cohort has any. Defensive add candidate.
- `enrolled_count` is a denormalized column — any future code path that writes `user_progress` outside the 2 known routes would silently desync. None exists today.

**Recommended Phase 40 — two shapes:**

- **Shape A (decommission):** drop the column entirely + replace 5 display routes with per-request `count(*)`. Eliminates the drift risk class. Requires migration + codegen reflow + trivial frontend change. Probably the right long-term answer.
- **Shape B (tighten):** keep the column; extract the increment to a tiny helper, add a dedicated test for the legacy route, relabel the cosmetic `enrolled=` log lines in the two archive scripts. Smaller, additive, no schema touch.

---

## Where to look next

- Full Phase 39 close-out: [docs/phases/phase-39-enrollment-counter-writer.md](docs/phases/phase-39-enrollment-counter-writer.md)
- Phase 38 close-out (parent): [docs/phases/phase-38-archive-safety-counter-hygiene.md](docs/phases/phase-38-archive-safety-counter-hygiene.md)
- Full chronological phase index: [docs/phases/INDEX.md](docs/phases/INDEX.md)
- Active invariants + 9-course list: [replit.md § Active Invariants / Gates](replit.md)
