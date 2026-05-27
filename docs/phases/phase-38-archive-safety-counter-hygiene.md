# Phase 38 — Archive Safety + Counter Hygiene

**Status:** SHIPPED.
**Scope:** Remove unsafe reliance on `projects.enrolled_count` from archive/hide scripts and replace it with direct `user_progress`-based enrollment checks.
**Shape:** Script-only refactor + new shared helper. No schema, no migrations, no routes, no codegen, no frontend, no content.

---

## Why this phase

Phase 37's architect review found that `projects.enrolled_count` is a denormalized integer column with a schema default of `0` and **no writer anywhere in the enrollment route code** — only the schema default and read sites. Phase 37 fixed its own archive gate by querying `user_progress` directly, but explicitly deferred the same fix on three older one-shot archive scripts that inherited the broken pattern (`archive-thin-stubs.ts`, `archive-phase11-replaced.ts`, `archive-phase12b-replaced.ts`). Phase 38 closes that gap and extracts the live check into a small shared helper so the pattern is consistent across all four call sites.

The scripts in question are one-shot phase archives that have already been applied to the dev DB; the legacy slugs they target genuinely have zero `user_progress` rows so the original runs landed correctly on dev data. The fix is preventative — any future re-run, or any copy-paste of the safety-gate pattern for a slug that *does* have real enrollments, would now hit the authoritative table.

---

## Inventory of `enrolled_count` / `enrolledCount` references

Read-only ripgrep over `*.ts` + `*.sql` (excluding `node_modules`, `dist`, `generated`):

| Classification | Files | Action |
| --- | --- | --- |
| Schema column definition | `lib/db/src/schema/domains.ts:75` · `lib/db/drizzle/0000_phase31_baseline.sql:162` | **Leave alone** (no schema change in this phase). |
| Frontend display | `artifacts/atlas/src/pages/domain-detail.tsx:151,155,156` | **Leave alone** (no frontend change). |
| Generated API DTOs | `lib/api-client-react/src/generated/api.schemas.ts` (2 hits) · `lib/api-zod/src/generated/api.ts` (10 hits) · `lib/api-zod/src/generated/types/{domain,projectSummary}.ts` | **Leave alone** (no codegen change). |
| API route pass-through (display only, not a safety gate) | `artifacts/api-server/src/routes/{user,dashboard,domains,projects,courses}.ts` | **Leave alone**. These read the column and forward it to API responses. The data is stale, but no decision is made on it. |
| Test fixtures | ~12 `*.test.ts` files setting `enrolledCount: 0` in mocks | **Leave alone**. Fixture noise. |
| Read-only snapshot scripts (output the value into JSON for diagnostic comparison) | `scripts/src/snapshot-phase13-pre.ts:24` · `scripts/src/snapshot-phase12b-pre.ts:21` · `scripts/src/phase11-final-gates.ts:29` | **Leave alone** (already-historical artifacts; the snapshots faithfully record whatever the column held at run time). |
| **Archive safety gate — UNSAFE** | `scripts/src/archive-thin-stubs.ts:73,74` (gate); `scripts/src/archive-phase11-replaced.ts:121,122` (gate); `scripts/src/archive-phase12b-replaced.ts:117,118` (gate) | **FIX**. |
| Seed convergence (Phase 37 patch block) | `scripts/src/seed.ts` (Phase 37 block) | **FIX** — already used a live `user_progress` query, but the inline implementation can be replaced with the new helper for consistency. |

The display columns in the 3 routes still hand a stale `0` to the UI. That is a separate UX cleanup, not a safety risk — explicitly out of scope for this phase (see "Remaining counter-related risks" below).

---

## Implementation

### New shared helper

`scripts/src/lib/enrollment-check.ts` (new file, ~55 lines):

```ts
export async function getActualEnrollmentCounts(
  projectIds: readonly string[],
): Promise<Map<string, number>>;

export async function getActualEnrollmentCount(
  projectId: string,
): Promise<number>;
```

The batch variant runs a single `SELECT projectId, count(*)::int FROM user_progress WHERE projectId IN (...) GROUP BY projectId`, primes the result Map with `0` for every requested id (so missing rows correctly read as zero, not `undefined`), and returns the Map. The single-id variant delegates to the batch helper. Empty input → empty Map, no DB roundtrip.

Lives in `scripts/src/lib/` (alongside the existing `batch.ts`). Promoting it to `lib/db` or `lib/curriculum-quality` was considered but rejected: only the four archive call sites need it, none are in another workspace package, and `@workspace/db` deliberately avoids exporting query helpers.

### Refactored call sites

1. **`scripts/src/archive-thin-stubs.ts`** — gate was `r.totalSteps !== 0 || r.enrolledCount !== 0`. Now reads `liveCounts.get(r.id)` from the helper instead of `r.enrolledCount`. Violation message now reports both the live `user_progress_rows` count AND the stale `stale_counter` value, so any future drift between them is immediately visible in the abort log.
2. **`scripts/src/archive-phase11-replaced.ts`** — gate was `enrolled_count = 0` only. Same swap; violation message now reads `user_progress_rows=N`.
3. **`scripts/src/archive-phase12b-replaced.ts`** — gate was `total_steps <= 1 AND enrolled_count = 0`. The `total_steps` half (a real schema column with a writer) stays; the `enrolled_count` half is swapped to the live helper.
4. **`scripts/src/seed.ts`** Phase 37 block — replaced the inline 6-line `db.select(... count(*) ...)` query (introduced during Phase 37's architect-correction round) with a single call to `getActualEnrollmentCount(legacy.id)`. Drops two now-redundant imports (`userProgress` from `@workspace/db`, `sql as drizzleSql` from `drizzle-orm`).

JSDoc on each script now explicitly mentions Phase 38 and why the column was unsafe. The `enrolledCount` field is **still selected** from the `projects.findMany({ columns })` call in each script so the existing diagnostic log lines (which print `enrolled=...` alongside `steps=...` for human-readable output) keep working — only the **decision** uses the live count.

### Tests

No new tests were added. The helper is a thin Drizzle wrapper that requires a DB to exercise, and `@workspace/scripts` does not run vitest (consistent with the Phase 35 precedent for the pedagogy audit helper). The full integration suite + the re-run of `pnpm run seed` (which exercises the helper via the Phase 37 block on every seed) provides live coverage.

---

## What was deliberately NOT done

1. **No schema change.** `projects.enrolled_count` stays in the schema. Removing it would require codegen reflow + frontend changes + a Drizzle migration — all explicitly prohibited.
2. **No backfill or trigger.** The column will continue to read its schema default (`0`) for the foreseeable future. Adding a writer in the enrollment routes, a Postgres trigger, or a one-shot backfill from `user_progress` is **deferred to Phase 39** (see "Recommended Phase 39" below).
3. **No frontend change.** `artifacts/atlas/src/pages/domain-detail.tsx` still renders `domain.enrolledCount` (a domain-level field assembled in the API routes from per-project values). The displayed value is stale, but it is not a safety decision — and the user-facing copy is conditional on `enrolledCount > 0` so a stale `0` simply hides the social-proof line instead of misleading anyone.
4. **No candidate-row gate.** Phase 37's review noted that an archive script could theoretically orphan `project_candidates` rows. None of the three archive scripts target slugs with candidate rows (Phase 37 verified this for its 13-slug cohort; the Phase 10/11/12B cohorts predate the candidate table). Adding a candidate gate would broaden scope without solving an active risk — deferred.
5. **No removal of the snapshot scripts' stale reads.** Those scripts produce historical diagnostic JSON; faithfully recording whatever the column held is the correct behavior for an audit snapshot, even when the column is known to be stale.
6. **No edits to the 5 API routes that pass `enrolledCount` through to responses.** Same display-only argument as the frontend.

---

## Files changed

- **New:** `scripts/src/lib/enrollment-check.ts` (helper).
- **Refactored:** `scripts/src/archive-thin-stubs.ts` · `scripts/src/archive-phase11-replaced.ts` · `scripts/src/archive-phase12b-replaced.ts` · `scripts/src/seed.ts` (Phase 37 block + import cleanup).
- **Docs:** this file · `HANDOFF.md` · `replit.md` · `docs/phases/INDEX.md`.

---

## Gates run

| Gate | Result |
| --- | --- |
| `pnpm run typecheck` | OK (libs build + 4 leaf workspaces typecheck clean) |
| `pnpm run check:no-heuristic-runtime` | OK |
| `pnpm --filter @workspace/api-server run test` | **273/273** |
| `pnpm --filter @workspace/atlas run test` | **102/102** |
| `pnpm --filter @workspace/curriculum-quality run test` | green (no count change for this phase) |
| `pnpm --filter @workspace/execution-core run test` | green |
| `pnpm --filter @workspace/api-server run test:integration` | **3/3** |
| `pnpm --filter @workspace/scripts run audit:authoring` | **56/56 visible publish-ready** (unchanged) |
| `pnpm --filter @workspace/scripts run audit:pedagogy` | 56/56 (unchanged) |
| `pnpm --filter @workspace/scripts run seed` | "Seed complete!" — Phase 37 block re-runs cleanly through the new helper |

---

## Remaining counter-related risks

| Risk | Severity | Recommended owner |
| --- | --- | --- |
| `projects.enrolled_count` still has no writer, still reads `0` everywhere. Display on `domain-detail.tsx` hides the social-proof line for every domain. | Low (UX papercut, not a safety risk) | Phase 39 |
| The 5 API routes (`user.ts`, `dashboard.ts`, `domains.ts`, `projects.ts`, `courses.ts`) pass the stale value to clients via generated DTOs. | Low (UX papercut) | Phase 39 |
| Two snapshot scripts + `phase11-final-gates.ts` record the stale value into JSON diagnostic dumps. | None (snapshots are historical artifacts; faithful recording is correct) | No action |
| No archive script currently checks `project_candidates` rows. None of the existing archive cohorts has any. | Low (latent — would only matter if a future archive cohort included a slug with active candidates) | Optional — add to Phase 39 if scope allows |

---

## Recommended Phase 39

**Phase 39 candidate — `enrolled_count` writer + display reconciliation.**

Two cleanly-separable shapes; pick one based on appetite:

- **Shape A (smallest, additive):** add a one-shot backfill script `scripts/src/backfill-enrolled-count.ts` that recomputes `projects.enrolled_count` from `count(*) FROM user_progress GROUP BY project_id` and `UPDATE`s in place. Idempotent, reversible (re-run any time). No route change, no schema change. Leaves the column stale-by-default the moment a new enrollment lands, but at least the snapshot scripts and the UI catch up at backfill time.
- **Shape B (more work, durable):** add a Drizzle-level write in the enrollment route (`POST /api/enrollments` or whichever creates the `user_progress` row for a newly-enrolled learner) that increments `projects.enrolled_count` atomically. Couple with the Shape-A backfill to seed the counter. Or, equivalently, drop the column and replace the display path with a per-request `count(*)` (cheaper than it sounds for ≤100 projects). Either pattern would let us remove the "stale counter" caveat from Phase 38 and free up `audit:authoring`/`audit:pedagogy` reports to start trusting the column.

Shape A is the natural one-phase follow-up; Shape B is reasonable to split into Phase 39 (writer + backfill) + Phase 40 (drop column + codegen reflow + frontend cleanup).

Out-of-band hygiene candidates that would also fit a Phase 39:

- Add `project_candidates`-row gate to the three archive scripts (defensive — no active cohort would fire it today).
- Convert `display` enrolled counts in API routes to render-time `count(*)` and remove the column from generated DTOs entirely.

---

## Suggested commit message

```
phase-38: harden archive safety gates to query user_progress
```
