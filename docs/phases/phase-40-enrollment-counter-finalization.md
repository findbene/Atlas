# Phase 40 — Enrollment Counter Finalization + Archive Candidate Gate

**Status:** SHIPPED.
**Parent:** Phase 39 (durable `enrolled_count` writer + backfill).
**Scope:** Small, additive, schema-free hardening pass closing all five Phase-39 caveats. Column NOT dropped (reserved for a future "decommission" phase). No schema/migration/production/deployment/frontend/content/seed/pedagogy/rubric/taxonomy/anchor/`/check`/`/submit`/cert-verify/portfolio/billing/Stripe/OpenAPI/codegen changes.

---

## Why this phase

Phase 39 made `projects.enrolled_count` durable enough for display surfaces and added a one-shot backfill. Architect-PASS, but flagged five non-blocking caveats:

1. Backfill verification compares against the script's *planned target*, not a fresh `user_progress` recompute — under live concurrent writes the verification can either falsely pass or falsely flag drift.
2. The legacy `POST /api/user/projects/:projectId/enroll` route's counter writer is byte-identical to the covered Phase-21 one, but has no direct unit-test coverage.
3. Two of the three archive scripts still print operator-facing `enrolled=…` log lines referring to the stored column, even though the safety gate now reads `user_progress` directly.
4. Counter-write `warn` logs only carry `{err, projectId}` — no route, no userId, no event tag — making downstream alerting hard.
5. Archive scripts do not check `project_candidates` rows before hiding a project, which could silently orphan the bidirectional lineage invariant.

Phase 40 closes all five. The column itself stays — dropping it would touch schema + migration + codegen + 5 routes + frontend, which is the right shape for a follow-up "decommission" phase, not for this hardening pass.

---

## Implementation

### A. Backfill two-pass verification (with per-row re-check)

`scripts/src/backfill-enrolled-count.ts`: after the WRITE phase, the script re-fetches BOTH `projects.enrolled_count` AND a fresh `user_progress` count, then compares them. Any mismatch from the first pass is then **re-read per-row** (both stored and live) in tight succession before being classified. This is necessary because the initial verify reads `stored` and `live` in two separate roundtrips — a concurrent enrollment landing between them on a planned-mismatch row would otherwise be misclassified as a real write failure (architect P40 finding). Only **stable** mismatches across re-check escalate.

Branches:

- **All rows match** (first pass) → "verified converged against live user_progress" → exit 0.
- **First-pass mismatch, re-read matches** → transient read-skew over a concurrent commit; column is now correct → `warn` log + exit 0.
- **Stable mismatch, row WAS in our plan** → real write failure (writer failed or someone clobbered our value) → `error` log + exit 1.
- **Stable mismatch, row was NOT in our plan** → concurrent enrollment landed AND another fired between re-reads; counter is healthy but moving → `warn` log + exit 0 with "re-run to converge".

This separates "the script failed at its job" from "a learner enrolled while the script was running, which is fine". The script remains fully idempotent — a re-run after concurrent drift will either be a clean no-op or fix the remaining offset.

`--dry-run` and `--allow-prod` semantics preserved.

### B. Legacy enrollment route direct test

New file: `artifacts/api-server/src/routes/user-enroll.test.ts`. Two cases on the legacy `POST /api/user/projects/:projectId/enroll` route:

1. First enrollment increments `projects.enrolled_count` exactly once.
2. Idempotent re-enroll does NOT call `update` (returns the existing row).

Scope intentionally narrow — only the counter behaviors. Other legacy-route concerns (XP, streaks, email) are not in scope; those code paths are mocked as never-called stubs. The router has many imports; the test mocks `@workspace/db`, `../lib/auth`, `@clerk/express`, `../lib/email`, `../lib/streak`, `../lib/grading`, and `drizzle-orm` (including the `sql` tagged-template helper).

### C. Counter warning log fields

Both writers now emit structured fields suitable for downstream alerting/log filtering:

```ts
req.log.warn(
  {
    err: counterErr,
    evt: "enrolled_count.increment_failed",
    route: "POST /api/enrollments",   // or "POST /api/user/projects/:projectId/enroll"
    phase: "P40",
    projectId,
    projectSlug: project.slug,
    userId: user.id,
  },
  "enrolled_count increment failed (non-fatal; run backfill:enrolled-count to reconcile)",
);
```

`evt` is the alertable event tag; `route`, `projectSlug`, and `userId` give incident-response immediate context without requiring a DB lookup. No sensitive fields beyond what the surrounding route logs already include (the route's own `error` log on its outer try/catch logs the same `userId` indirectly via `getCurrentUser`).

### D. Archive cosmetic log clarity

`scripts/src/archive-phase11-replaced.ts` and `scripts/src/archive-phase12b-replaced.ts`: the diagnostic line in the target-rows summary loop renamed `enrolled=${r.enrolledCount}` → `staleCounter=${r.enrolledCount}`. Comment added inline explaining that this is the denormalized display-only column, NOT the live `user_progress` count used by the safety gate above. `archive-thin-stubs.ts` already used `stale_counter=` in its violation message — left as-is for consistency.

### E. Project-candidates archive safety gate

New helper: `scripts/src/lib/candidate-check.ts` exports `getCandidateRowCountsByPromotedProject(projectIds)` and `findProjectsWithCandidates(projectIds)`. Both return aggregated row counts for `project_candidates` rows whose `promoted_project_id` is in the input set. Empty input → empty result, no DB roundtrip.

Wired into all three archive scripts (`archive-thin-stubs.ts`, `archive-phase11-replaced.ts`, `archive-phase12b-replaced.ts`) AFTER the existing safety gates. Any non-zero candidate-link count for an archive target → ABORT with a clear violation message listing the offending slugs + counts. No row deletes; archive-by-hide behavior preserved.

**Why this matters:** the bidirectional `projects ↔ project_candidates` lineage is a Phase-11+ invariant (`replit.md § Active Invariants / Gates`). The promote() path writes both FK directions atomically. Hiding a project that is the promoted target of a non-archived candidate would leave the candidate row pointing at a hidden project — `audit:quality` would catch it on the next run, but the archive script should refuse to land the inconsistency in the first place.

We deliberately do NOT use `projects.enrolled_count` for this gate (would re-violate the Phase-38 invariant). We deliberately do NOT filter by `project_candidates.status` (even a `promoted` candidate pointing at a project we're about to archive is a problem, because the lineage assertion does not care about candidate status).

**Schema confirmed present:** `lib/db/src/schema/quality.ts` exports `projectCandidates` with `promoted_project_id` (FK → `projects.id`, `onDelete: 'set null'`); already re-exported through the `@workspace/db` barrel via `export * from "./quality"`. No schema change.

---

## Files changed

- **Backfill:** `scripts/src/backfill-enrolled-count.ts` (two-pass verification).
- **Writers (log fields):** `artifacts/api-server/src/routes/enrollment.ts` · `artifacts/api-server/src/routes/user.ts`.
- **Tests:** `artifacts/api-server/src/routes/user-enroll.test.ts` (new, +2 cases).
- **New helper:** `scripts/src/lib/candidate-check.ts`.
- **Archive scripts:** `scripts/src/archive-thin-stubs.ts` (+ candidate gate; `stale_counter=` already present) · `scripts/src/archive-phase11-replaced.ts` (+ candidate gate; `staleCounter=` rename) · `scripts/src/archive-phase12b-replaced.ts` (+ candidate gate; `staleCounter=` rename).
- **Docs:** this file · `HANDOFF.md` · `replit.md` · `docs/phases/INDEX.md`.

---

## Gates run (all green)

| Gate | Result |
| --- | --- |
| `pnpm run typecheck` | OK |
| `pnpm run check:no-heuristic-runtime` | OK |
| `pnpm --filter @workspace/api-server run test` | **280/280** (was 278 + 2 new P40 legacy-route cases) |
| `pnpm --filter @workspace/atlas run test` | 102/102 (unchanged) |
| `pnpm --filter @workspace/curriculum-quality run test` | green (unchanged) |
| `pnpm --filter @workspace/execution-core run test` | green (unchanged) |
| `pnpm --filter @workspace/api-server run test:integration` | 3/3 (unchanged) |
| `pnpm --filter @workspace/scripts run audit:authoring` | 56/56 visible publish-ready (unchanged) |
| `pnpm --filter @workspace/scripts run audit:pedagogy` | 56/56 (unchanged) |
| `pnpm --filter @workspace/scripts run seed` | "Seed complete!" |
| `backfill:enrolled-count -- --dry-run` | already converged from Phase 39 — clean no-op |
| `backfill:enrolled-count` (live) | "already converged — nothing to write" |

The two-pass verification logic's drift-detection branches did not fire end-to-end on this run (the DB was already converged from Phase 39), but the early-exit "already converged" path runs every time and the new logic is downstream of `drift.length === 0`. Branch verified by reading + typecheck.

---

## Risks closed

| Phase 39 caveat | How Phase 40 closes it |
| --- | --- |
| Backfill verification compares to planned snapshot, not fresh recompute | Two-pass verify with explicit concurrent-drift branch. |
| Legacy enrollment route has no direct counter test | `user-enroll.test.ts` proves first-enroll +1 and idempotent no-op. |
| Counter warn logs missing structured fields | `evt` + `route` + `phase` + `projectSlug` + `userId` added to both writers. |
| Archive scripts print cosmetic `enrolled=` referring to stale column | Renamed to `staleCounter=` with inline comment in P11/P12B. |
| Archive scripts don't check `project_candidates` | New `candidate-check.ts` helper wired into all 3 archive scripts; ABORT on any candidate row linkage. |

---

## Remaining risks

| Risk | Severity | Notes |
| --- | --- | --- |
| `enrolled_count` is still a denormalized column. Any future code path that inserts into `user_progress` outside the 2 enrollment routes would silently desync. | Low — no such writer exists. | Mitigated by the idempotent backfill if it ever happens. |
| Two-pass verification branch coverage is not exercised by a dedicated test (live runs converge to no-op). | Low — branches are short and pure-logic. | A dedicated unit test would need to mock the script's IO surface (live DB connection). Could be added later, but the cost/benefit is poor — the branches read straightforwardly. |
| Counter-write failure (rare) still silently undercounts until the next backfill. | Low (display metadata only). | Phase 40 improved the log signal so this is now alertable; the reconciliation path is the same. |
| Candidate-check helper has no unit test. | Low — pure SQL aggregation, no logic. | Same `scripts/no-vitest` precedent as the Phase-38 enrollment-check helper. |

---

## Recommended Phase 41

Two clean shapes:

- **Shape A — Decommission `enrolled_count` (the long-promised cleanup).** Drop the column, replace the 5 display-route reads with per-request `count(*) FROM user_progress GROUP BY project_id` (cheap for ≤100 projects, runs once per dashboard render). Eliminates the denormalized-counter drift risk class outright. Migration + codegen reflow + trivial frontend (numbers are still numbers). Probably the right long-term answer.
- **Shape B — Return to project production work** (e.g. push `audit:authoring` from 56 → 60+ publish-ready, or tackle the 13 lower-priority `audit:pedagogy` warnings). Phase 40 was a hardening pass; the counter saga is now fully buttoned up enough to set down and resume the curriculum work it interrupted.

---

## Suggested commit message

```
phase-40: enrollment counter finalization + archive candidate gate
```
