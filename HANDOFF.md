# HANDOFF

**Latest shipped phase:** Phase 38 — Archive Safety + Counter Hygiene.
**Working tree:** clean after `phase-38: harden archive safety gates to query user_progress`.
**Parent commit:** `bffd2292` (Phase 37 close).

---

## Phase 38 summary

Removed unsafe reliance on `projects.enrolled_count` from the three remaining archive-by-hide safety gates. Replaced with direct `user_progress` queries via a new shared helper. The column itself stays — only the archive *safety gates* stop trusting it.

**Trigger:** Phase 37's architect review found `projects.enrolled_count` has no writer in any enrollment route (just the schema default `0`). Phase 37 fixed its own gate via a live `user_progress` query; Phase 38 closes the same gap in `archive-thin-stubs.ts`, `archive-phase11-replaced.ts`, `archive-phase12b-replaced.ts`, and consolidates the four call sites through one helper.

**Files changed**

- **New:** `scripts/src/lib/enrollment-check.ts` — `getActualEnrollmentCount(id)` + batch variant `getActualEnrollmentCounts(ids)` querying `user_progress` directly.
- **Refactored:**
  - `scripts/src/archive-thin-stubs.ts` — gate split: `total_steps = 0` (schema) AND live `user_progress` count = 0; violation message now reports BOTH live count + stale counter for forensic visibility.
  - `scripts/src/archive-phase11-replaced.ts` — `enrolled_count = 0` gate → live `user_progress` count gate.
  - `scripts/src/archive-phase12b-replaced.ts` — `total_steps ≤ 1 AND enrolled_count = 0` gate → `total_steps ≤ 1 AND live user_progress count = 0`.
  - `scripts/src/seed.ts` (Phase 37 block) — inline `count(*)` Drizzle query replaced with `getActualEnrollmentCount(legacy.id)`; drops the now-redundant `userProgress` + `sql as drizzleSql` imports.
- **Docs:** `docs/phases/phase-38-archive-safety-counter-hygiene.md` (new) · `replit.md` · `docs/phases/INDEX.md` · this file.

**Hard stops respected:** no schema change, no migration, no route change, no codegen, no frontend, no content, no rubric/taxonomy/pedagogy edits, `projects.enrolled_count` NOT dropped, no production DB access.

---

## Why this shape (vs alternatives)

1. **Refactor the three archive scripts in place, don't archive-and-replace them.** They are already-applied one-shots; they ran cleanly because the dev `user_progress` rows happen to be zero. The risk is preventative — any future re-run, or copy-paste of the pattern for a slug with real enrollments, would now hit the authoritative table.
2. **Extract one shared helper rather than inline 4 copies of the same query.** Single source of truth means a future change (e.g. switching to a window function, or once Phase 39 lands a real writer, swapping back to the column) needs only one edit. Helper lives in `scripts/src/lib/` (alongside existing `batch.ts`), not in `@workspace/db`, because no other workspace package needs it.
3. **Keep `enrolledCount` selected in each archive script's `findMany`.** The diagnostic log lines (`enrolled=...` alongside `steps=...`) still print, so existing operator UX is preserved — only the *decision* uses the live count. The violation message for `archive-thin-stubs.ts` was extended to print BOTH numbers (`user_progress_rows=N, stale_counter=M`) so any future drift between the two is immediately visible.
4. **No tests added.** The helper is a thin Drizzle wrapper requiring a real DB. `@workspace/scripts` does not run vitest (Phase-35 precedent for the pedagogy audit helper). Live coverage comes from `pnpm run seed` (Phase 37 block exercises the helper every seed) + the full integration suite.
5. **`projects.enrolled_count` NOT removed in this phase.** Removing it touches schema + migration + codegen + frontend + 5 API routes — explicitly out of scope. The counter stays, but no safety code trusts it. Phase 39 candidate.

---

## Gates run (all green)

- `pnpm run typecheck` — OK
- `pnpm run check:no-heuristic-runtime` — OK
- `pnpm --filter @workspace/api-server run test` — **273/273**
- `pnpm --filter @workspace/atlas run test` — **102/102**
- `pnpm --filter @workspace/curriculum-quality run test` — green (unchanged)
- `pnpm --filter @workspace/execution-core run test` — green (unchanged)
- `pnpm --filter @workspace/api-server run test:integration` — **3/3**
- `pnpm --filter @workspace/scripts run audit:authoring` — **56/56 visible publish-ready** (unchanged from P37)
- `pnpm --filter @workspace/scripts run audit:pedagogy` — 56/56 (unchanged)
- `pnpm --filter @workspace/scripts run seed` — "Seed complete!" — Phase 37 block re-runs cleanly through the new helper

---

## Remaining risks (Phase 39 candidates)

- `projects.enrolled_count` still has no writer; reads `0` on every row. Display path (`artifacts/atlas/src/pages/domain-detail.tsx` + 5 API routes) hands a stale `0` to the UI. Low — UX papercut, not a safety risk.
- Two snapshot scripts + `phase11-final-gates.ts` write the stale value into diagnostic JSON. No action — historical artifacts should faithfully record what the column held at run time.
- No archive script checks `project_candidates` rows. No active cohort has any. Defensive add for Phase 39 if scope allows.

**Recommended Phase 39:** add either (Shape A) a one-shot `backfill-enrolled-count.ts` from `user_progress`, OR (Shape B) a writer in the enrollment route + the same backfill to seed it. See the Phase 38 close-out doc for full Shape A vs Shape B comparison.

---

## Where to look next

- Full Phase 38 close-out: [docs/phases/phase-38-archive-safety-counter-hygiene.md](docs/phases/phase-38-archive-safety-counter-hygiene.md)
- Phase 37 close-out (parent): [docs/phases/phase-37-batch-gap-project-remediation.md](docs/phases/phase-37-batch-gap-project-remediation.md)
- Full chronological phase index: [docs/phases/INDEX.md](docs/phases/INDEX.md)
- Active invariants + 9-course list: [replit.md § Active Invariants / Gates](replit.md)
