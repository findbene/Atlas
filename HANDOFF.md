# HANDOFF

**Latest shipped phase:** Phase 40 — Enrollment Counter Finalization + Archive Candidate Gate.
**Working tree:** clean after `phase-40: enrollment counter finalization + archive candidate gate`.
**Parent commit:** `4201ef6f` (Phase 39 close).

---

## Phase 40 summary

Small, additive, schema-free hardening pass closing all five Phase-39 caveats. Column NOT dropped — that's reserved for a future "decommission" phase.

**What changed and why**

1. **Backfill two-pass verification with per-row re-check.** `backfill-enrolled-count.ts` now recomputes from `user_progress` AFTER its writes and compares to live stored values. Because the initial verify reads `stored` and `live` in two separate roundtrips, a concurrent enrollment landing between them on a planned-mismatch row could otherwise be misclassified as a real write failure (architect P40 finding). Mitigation: every first-pass mismatch is re-read per-row (both stored and live) in tight succession, and only STABLE mismatches escalate. Branches: (a) all match → exit 0; (b) first-pass mismatch resolves on re-read → warn + exit 0 (transient read-skew); (c) stable mismatch on a planned row → exit 1 (real write failure); (d) stable mismatch on a not-planned row → warn + exit 0 (concurrent enrollment still moving; re-run to converge). Cleanly separates "script failed" from "learner enrolled while running, which is fine". Re-runs still fully idempotent.
2. **Legacy route direct test.** New `user-enroll.test.ts` proves `POST /api/user/projects/:projectId/enroll` increments once on first enrollment and no-ops on idempotent re-enroll. Coverage scope intentionally narrow — XP/streak/email paths are stubbed as never-called.
3. **Counter warn logs upgraded.** Both writers now log `{evt: "enrolled_count.increment_failed", route, phase: "P40", projectId, projectSlug, userId, err}` — alertable event tag + incident-response context without a DB lookup. No sensitive fields beyond what the outer route logs already include.
4. **Archive cosmetic log clarity.** `enrolled=…` → `staleCounter=…` in `archive-phase11-replaced.ts` + `archive-phase12b-replaced.ts` with inline comment explaining it's the denormalized display-only column, not the live `user_progress` count the safety gate uses. (`archive-thin-stubs.ts` already used `stale_counter=` in its violation message.)
5. **Project-candidates archive safety gate.** New `scripts/src/lib/candidate-check.ts` (`getCandidateRowCountsByPromotedProject` + `findProjectsWithCandidates`) wired into all three archive scripts AFTER the existing user_progress gate. Any candidate row pointing at an archive target → ABORT with a clear violation message. Protects the bidirectional `projects ↔ project_candidates` lineage invariant from Phase 11+ (hiding a promoted target would silently break it). Does NOT use `enrolled_count` (would re-violate the Phase-38 invariant). Does NOT filter by candidate `status` (lineage assertion doesn't care). `projectCandidates` schema already exported through the `@workspace/db` barrel — no schema change.

**Files changed**

- Backfill: `scripts/src/backfill-enrolled-count.ts` (two-pass verification)
- Writers: `artifacts/api-server/src/routes/enrollment.ts` · `artifacts/api-server/src/routes/user.ts` (structured log fields)
- Tests: `artifacts/api-server/src/routes/user-enroll.test.ts` (new, +2 P40 cases)
- New helper: `scripts/src/lib/candidate-check.ts`
- Archive scripts: `scripts/src/archive-thin-stubs.ts` · `scripts/src/archive-phase11-replaced.ts` · `scripts/src/archive-phase12b-replaced.ts` (+ candidate gate; staleCounter rename in last two)
- Docs: `docs/phases/phase-40-enrollment-counter-finalization.md` (new) · `replit.md` · `docs/phases/INDEX.md` · this file

**Hard stops respected:** no schema change · no migration · no production touch · no deployment · `enrolled_count` NOT dropped · no `/check` / `/submit` / cert-verify / portfolio / billing / Stripe / OpenAPI / codegen / frontend / project-content / seed / rubric / taxonomy / anchor / pedagogy edits. `enrolled_count` is NOT used by the new candidate gate (Phase-38 invariant intact).

---

## Why these design choices

1. **Two-pass verify reads from `user_progress`, not from `projects.enrolled_count` deltas.** A delta-based verify would just re-verify the script's own writes; recomputing from the source-of-truth catches both write failures AND in-flight concurrent enrollments.
2. **Concurrent drift is `warn`, not `error`.** Concurrent enrollment during backfill is expected under live traffic and the column is now correct — failing exit-code on it would burn the operator's pager for non-events.
3. **Candidate gate as a separate helper, not inline.** Three callsites, same shape; helper is the cheap right thing. Also keeps the gate auditable from one place.
4. **Candidate gate ignores `status`.** Even a `promoted` candidate pointing at a project we're about to archive is a violation — the lineage assertion does not care about status. Better to surface and let the operator decide than to silently allow.
5. **No unit test for the candidate-check helper.** Same scripts/no-vitest precedent as the Phase-38 enrollment-check helper. The helper is two pure SQL aggregations; live coverage comes from running the archive scripts.
6. **Legacy route test narrows to counters only.** Adding XP/streak/email coverage from scratch would balloon scope; the counter writer is the only Phase-39 change that needs a direct pin.
7. **Column NOT dropped.** That's the right shape for a focused Phase 41 (Shape A below), not piggybacked onto a hardening pass.

---

## Gates run (all green)

- `pnpm run typecheck` — OK
- `pnpm run check:no-heuristic-runtime` — OK
- `pnpm --filter @workspace/api-server run test` — **280/280** (was 278 + 2 new P40 legacy-route cases)
- `pnpm --filter @workspace/atlas run test` — 102/102 (unchanged)
- `pnpm --filter @workspace/curriculum-quality run test` — green (unchanged)
- `pnpm --filter @workspace/execution-core run test` — green (unchanged)
- `pnpm --filter @workspace/api-server run test:integration` — 3/3 (unchanged)
- `pnpm --filter @workspace/scripts run audit:authoring` — 56/56 visible publish-ready (unchanged)
- `pnpm --filter @workspace/scripts run audit:pedagogy` — 56/56 (unchanged)
- `pnpm --filter @workspace/scripts run seed` — "Seed complete!"
- `backfill:enrolled-count -- --dry-run` — converged from P39 → clean no-op
- `backfill:enrolled-count` (live) — "already converged — nothing to write"

The two-pass concurrent-drift branches did not fire end-to-end on this run (DB converged), but they're downstream of the `drift.length === 0` early-exit and the logic is pure-string transformation.

---

## Recommended Phase 41 — two shapes

- **Shape A — Decommission `enrolled_count`.** Drop the column entirely + replace 5 display-route reads with per-request `count(*)`. Eliminates the denormalized-counter drift risk class outright. Migration + codegen reflow + trivial frontend. Probably the right long-term answer.
- **Shape B — Return to project production work.** Phase 40 buttoned up the counter saga; consider resuming curriculum work (e.g. expand `audit:authoring` 56/56 toward 60+).

---

## Where to look next

- Full Phase 40 close-out: [docs/phases/phase-40-enrollment-counter-finalization.md](docs/phases/phase-40-enrollment-counter-finalization.md)
- Phase 39 close-out (parent): [docs/phases/phase-39-enrollment-counter-writer.md](docs/phases/phase-39-enrollment-counter-writer.md)
- Phase 38 close-out (grandparent — established the "use user_progress, not enrolled_count" invariant): [docs/phases/phase-38-archive-safety-counter-hygiene.md](docs/phases/phase-38-archive-safety-counter-hygiene.md)
- Full chronological phase index: [docs/phases/INDEX.md](docs/phases/INDEX.md)
- Active invariants + 9-course list: [replit.md § Active Invariants / Gates](replit.md)
