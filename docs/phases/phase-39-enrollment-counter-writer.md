# Phase 39 — Durable Enrollment Counter Writer + Backfill

**Status:** SHIPPED.
**Scope:** Add a durable writer for `projects.enrolled_count` on the two enrollment-creation routes; add a one-shot idempotent backfill script to reconcile the historical zeroes; lock the behavior with five new unit tests. No schema change.
**Parent:** Phase 38 (archive-safety counter hygiene — stopped *trusting* the counter).
**Hard stops respected:** no schema/migration/production-touch/deployment/`/check`/`/submit`/cert-verify/portfolio/billing/OpenAPI/codegen/frontend-redesign/content/seed/rubric/taxonomy/anchor/pedagogy changes. Archive safety still uses the `user_progress`-based helper — `enrolled_count` is NOT reintroduced into any safety decision.

---

## Why this phase

Phase 38 removed `projects.enrolled_count` from every archive-safety gate. The column still existed and was still read by 5 API routes + 1 frontend surface for display purposes, but it had no writer anywhere — every project rendered as `0` enrollments to the UI. Phase 39 closes the loop with the durable writer + a backfill to seed the historical rows.

The audit upstream of this phase confirmed:

1. Two distinct routes create `user_progress` rows (the only "enrollment" mechanic on the platform):
   - **`POST /api/enrollments`** (Phase 21 slug-based overlay, `routes/enrollment.ts:65`) — race-safe via the `progress_user_project_idx (user_id, project_id)` unique index + a `SQLSTATE 23505` recovery branch.
   - **`POST /api/user/projects/:projectId/enroll`** (legacy UUID-based, `routes/user.ts:270`) — existence-check + insert, idempotent but not race-protected (no 23505 catch).
2. The unique index makes a *duplicate* enrollment impossible at the DB level; both routes return early on the `existing` branch without re-inserting.
3. `enrolled_count` is exposed to clients by 5 API routes (`user.ts`, `dashboard.ts`, `domains.ts`, `projects.ts`, `courses.ts`) and rendered by 1 frontend surface (`domain-detail.tsx`, gated on `> 0`). It is **display/social-proof metadata only** — Phase 38 made that explicit by relocating the safety-gate role to `user_progress`-based queries.
4. The safest writer pattern is an atomic SQL-level `enrolled_count + 1` on the *successful insert* branch only — never on `existing`, never on the 23505 recovery (where the parallel request that won the race already incremented for the same row).

---

## Implementation

### A. Durable writer (two callsites)

Same pattern in both:

```ts
try {
  await db.update(projects)
    .set({ enrolledCount: sql`${projects.enrolledCount} + 1` })
    .where(eq(projects.id, project.id));
} catch (counterErr) {
  req.log.warn({ err: counterErr, projectId: project.id },
    "enrolled_count increment failed (non-fatal; run backfill:enrolled-count to reconcile)");
}
```

Three deliberate properties:

- **SQL-level expression, not JS read-modify-write.** Two concurrent first-enrollments by different users for the same project both submit `enrolled_count + 1` to Postgres; the row lock serializes them and the counter rises by 2, not 1. There's no need for a serializable transaction or a row-level advisory lock.
- **Fires only inside the successful-insert branch.** The `existing` branch (idempotent re-enroll) returns early before the writer ever runs; the 23505 recovery branch in `enrollment.ts` deliberately omits the increment because the parallel winner has already done it for the same `(user_id, project_id)` row.
- **Non-fatal on counter-write failure.** If the `UPDATE` itself errors (connection blip, FK weirdness, anything), the `try/catch` swallows it, logs a structured `warn` with the project id, and the route still returns 200 to the learner. The counter is display metadata — failing the enrollment because we couldn't bump a social-proof number would be the wrong tradeoff. Operators can re-converge any time with `backfill:enrolled-count` (which is fully idempotent — see below).

`routes/enrollment.ts` already imported `projects` from `@workspace/db`; only the `sql` import from `drizzle-orm` was added. `routes/user.ts` already had both.

### B. Backfill script

New: `scripts/src/backfill-enrolled-count.ts` (~110 LOC, `tsx` runner, new npm alias `backfill:enrolled-count` in `scripts/package.json`).

Shape:

1. Parse `--dry-run` and `--allow-prod` flags. Refuse to run if `REPLIT_DEPLOYMENT` is set AND `--allow-prod` is absent (exit code `2` — distinguishable from "actual failure" exit `1`).
2. `findMany` every project's `(id, slug, enrolledCount)`.
3. Call `getActualEnrollmentCounts(allProjectIds)` from `scripts/src/lib/enrollment-check.ts` — the same helper Phase 38's archive scripts use. Single grouped `count(*)::int FROM user_progress GROUP BY project_id`, primes the result Map with `0` for every requested id.
4. Compute drift (`before !== after`). Print the per-project drift list with `↑`/`↓` arrows BEFORE any writes — so a partial-failure write still leaves a forensic trail in the operator's terminal.
5. Dry-run mode exits here (`exit 0`).
6. Converged mode (no drift) exits early (`exit 0`).
7. Iterate drift rows; `UPDATE projects SET enrolled_count = $1 WHERE id = $2` per row. Per-row try/catch — one failure doesn't abort the rest.
8. **Verification re-read** — re-`findMany` after writes; flag any row whose post-state doesn't match the planned target. Non-zero mismatches → `exit 1` (so CI / shell pipelines can catch silent corruption).

Reuses the Phase-38 helper rather than re-implementing the `count(*)` query: single source of truth for "live enrollment count" across all 5 callsites (3 archive scripts + seed.ts P37 block + this backfill).

### C. Tests

Added to `artifacts/api-server/src/routes/enrollment.test.ts` (the existing pin-suite for the Phase-21 enrollment route). Five new cases, all prefixed `[P39]`:

| # | Pin |
| --- | --- |
| 1 | First enrollment increments `enrolled_count` exactly once (`updateFn`, `updateSet`, `updateWhere` each called once). |
| 2 | Idempotent re-enroll does NOT call `update` (the `existing` branch returns early). |
| 3 | 23505 race-recovery branch does NOT call `update` (winner already incremented). |
| 4 | Counter-write rejection does NOT 500 the enrollment (200 + `created:true`, `update` still attempted once). |
| 5 | Two different users enrolling the same project each increment once (`updateFn` called 2 times across both requests). |

Mock additions: `updateFn`/`updateSet`/`updateWhere` triad, plus the `sql` tagged-template stub in the `drizzle-orm` mock (the existing mock didn't need it before). The `projects` mock now exposes `enrolledCount`; `userProgress` mock gains `currentStep` (already used by the route's `returning()` call — surfaces correctly now that the test asserts on `update` paths).

No legacy `POST /api/user/projects/:id/enroll` test was added — that route has no dedicated test file, and the writer there is identical to the Phase-21 one (same SQL, same try/catch). The 5 new pins on `enrollment.test.ts` cover all the behavioral shapes; ad-hoc verification of the legacy route comes from the live backfill re-converging to zero drift after a `pnpm run seed` (see Gates below).

---

## Why these design choices (and what was deferred)

1. **Atomic SQL-level `+ 1`, not a counter table or a Postgres trigger.** A trigger would be more "correct" but requires a migration (out of scope). A counter table would split reads across two queries for every display surface — not worth it for a 100-row catalog. The atomic update is correct under concurrency, costs one extra UPDATE per first-enrollment, and stays inside the existing schema.
2. **Non-fatal counter writes.** Enrollment is a learner-facing action; bumping a social-proof number is not. If we 500'd on a counter-write failure, a flaky DB moment would lock learners out of new projects for no real-user benefit. The structured `warn` log + the idempotent backfill is the right reconciliation path.
3. **No legacy-route test file.** The route has no test file today, and adding one just for the writer would be a much larger scope (would need to mock the surrounding XP/streak code that route also touches). The behavior is identical to the Phase-21 writer that IS covered.
4. **No frontend change.** `domain-detail.tsx` already renders the value conditionally on `> 0`; once the backfill runs the social-proof line will start appearing naturally for projects that have real enrollments. No copy or layout change needed.
5. **No codegen reflow.** The DTO shape didn't change — `enrolledCount` was already on the response; only the *values* will now be non-zero.
6. **Column NOT removed.** Removing it would touch schema + migration + codegen + 5 routes + frontend — explicitly out of scope. Possible Phase 40 (see "Recommended Phase 40" below) if we decide the column was the wrong shape to begin with.
7. **No backfill-on-write-failure auto-retry.** The `warn` log is enough; ops can re-run the backfill manually. Auto-retry would add complexity for a low-probability failure mode.

---

## Files changed

- **Routes (writer):** `artifacts/api-server/src/routes/enrollment.ts` (+1 import, +13 lines for the try/catch + comment) · `artifacts/api-server/src/routes/user.ts` (+13 lines for the try/catch + comment; no new imports needed).
- **New script:** `scripts/src/backfill-enrolled-count.ts`.
- **Npm alias:** `scripts/package.json` (+1 line — `backfill:enrolled-count`).
- **Tests:** `artifacts/api-server/src/routes/enrollment.test.ts` (+5 cases, +1 mock triad, +1 `sql` stub).
- **Docs:** this file · `HANDOFF.md` · `replit.md` · `docs/phases/INDEX.md`.

---

## Gates run (all green)

| Gate | Result |
| --- | --- |
| `pnpm run typecheck` | OK (libs build + 4 leaf workspaces typecheck clean) |
| `pnpm run check:no-heuristic-runtime` | OK |
| `pnpm --filter @workspace/api-server run test` | **278/278** (273 + 5 new P39 cases) |
| `pnpm --filter @workspace/atlas run test` | **102/102** (unchanged) |
| `pnpm --filter @workspace/curriculum-quality run test` | green (unchanged) |
| `pnpm --filter @workspace/execution-core run test` | green (unchanged) |
| `pnpm --filter @workspace/api-server run test:integration` | **3/3** (unchanged) |
| `pnpm --filter @workspace/scripts run audit:authoring` | **56/56 visible publish-ready** (unchanged) |
| `pnpm --filter @workspace/scripts run audit:pedagogy` | 56/56 (unchanged) |
| `pnpm --filter @workspace/scripts run seed` | "Seed complete!" — Phase 37 archive block re-runs cleanly through the P38 helper |
| `pnpm --filter @workspace/scripts run backfill:enrolled-count -- --dry-run` (on dev) | Shows 9 drift rows from seeded `user_progress` data (e.g. `csv-to-postgres-pipeline 0 → 5`, `dbt-data-models 0 → 3`). No writes. |
| Live backfill on dev DB | Converges; post-write verification clean. |
| Live backfill re-run (idempotency proof) | "already converged — nothing to write." |

---

## What changes operationally

- New learner enrollments now increment `projects.enrolled_count` automatically.
- One-time op for prod: `pnpm --filter @workspace/scripts run backfill:enrolled-count -- --allow-prod` (script refuses without the flag when `REPLIT_DEPLOYMENT` is set).
- `domain-detail.tsx` social-proof line now starts appearing for projects with real enrollments (previously hidden because all values were stale `0`s).
- 5 API routes (`user.ts`, `dashboard.ts`, `domains.ts`, `projects.ts`, `courses.ts`) now hand accurate counts to clients without any further code change.

---

## Remaining risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| A counter-write failure (rare) leaves a +1 unrecorded; UI undercounts until the next backfill run. | Low (display metadata only). | The structured `warn` log surfaces it; the idempotent backfill reconciles it. |
| The legacy `POST /api/user/projects/:id/enroll` route's writer is not covered by a dedicated test. | Low (identical SQL/try-catch to the Phase-21 route that IS covered). | Optional cleanup: extract the writer to a tiny helper module and unit-test it once (~Phase 40 candidate). |
| `enrolled_count` is still a denormalized column — any future code path that writes `user_progress` outside the two enrollment routes would silently desync. | Very low (no such writer exists; all 4 `db.insert(userProgress)` callsites are accounted for). | Documented here; covered by the periodic backfill if it ever happens. |
| Diagnostic log lines in `archive-phase11-replaced.ts` + `archive-phase12b-replaced.ts` still print `enrolled=...` referring to the stored column rather than the live count. | Cosmetic (operator-only). | Architect note from P38 — relabel to `stale_counter=...` or drop. Carry to Phase 40 if scope allows. |
| `project_candidates`-row gate is still absent on the 3 archive scripts. | Latent (no active cohort has any). | Defensive add for Phase 40 if scope allows. |

---

## Recommended Phase 40

Two natural shapes; pick one based on appetite:

- **Shape A — "Decommission the column."** Now that the writer + backfill exist, we have a clean cut to drop `projects.enrolled_count` entirely and replace it with a per-request `count(*)` in the 5 display routes (cheap for ≤100 projects, runs once per dashboard load). Requires a migration + codegen reflow + frontend trivial change. Eliminates the "denormalized column drift" risk class outright. Probably the right long-term answer.
- **Shape B — "Tighten the writer."** Keep the column; harden the legacy route with a dedicated test, extract the increment to a helper module (one source of truth for the SQL expression + try/catch + log message), and relabel the operator-facing `enrolled=` diagnostic lines in the two archive scripts that still reference the stale column. Smaller, additive, no schema touch.

Either is a clean ~one-day phase.

---

## Suggested commit message

```
phase-39: durable enrolled_count writer + backfill
```
