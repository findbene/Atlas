# Atlas — Session Handoff

**HEAD:** Phase 37 — Batch Remediation of Phase-9/10 Legacy Duplicates (Archive-by-Hide).
**Last shipped:** Phase 37 (parent: Phase 36 at `0dd8479`).
**Status:** Phase 37 **SHIPPED**. Content-only, idempotent, archive-by-hide. Working tree carries Phase 37 additions only: 1 new phase doc, 1 new patch block + 1 new import in `scripts/src/seed.ts`, INDEX.md + replit.md + this HANDOFF updated.

Atlas remains deploy-ready (Phase 31 unchanged). **No deployment has occurred. No production DB has been touched.** Dev DB was re-seeded (idempotent — 13 legacy duplicate slugs flipped to `learner_visible=false`).

---

## Phase 37 working-tree changes

**New files**

- `docs/phases/phase-37-batch-gap-project-remediation.md` — close-out.

**Modified files**

- `scripts/src/seed.ts`:
  - New import: `import { PHASE9_LEGACY_SLUG_MAP, PHASE10_LEGACY_SLUG_MAP } from "./authored-lineage";`
  - **New `// --- Phase 37 — Archive superseded legacy duplicates (idempotent) ---` block** appended between the Phase 36 grandfathered-remediation block and the Mastery Sections. Iterates `{...PHASE9_LEGACY_SLUG_MAP, ...PHASE10_LEGACY_SLUG_MAP}` (13 pairs total, no overlap with already-archived P11/P12B cohorts) and flips `learner_visible=false` on the legacy slug gated by THREE safety checks: (a) upgraded row exists, (b) upgraded row is visible, (c) zero rows in `user_progress` for `legacy.id` (queried directly through Drizzle — NOT via the denormalized `projects.enrolled_count` column, which has a schema default but no writer anywhere in the route code). Any check failing → `console.warn` + skip, legacy stays visible. Legacy already-hidden → silently skipped (full idempotency). No row deletes.
- `docs/phases/INDEX.md` — Phase 37 entry appended (chronological tail).
- `replit.md` — Phase History prepended with P37 (P32 trimmed off the latest-5 window).
- `HANDOFF.md` — this file.

**Unchanged:** every schema file, every migration, every backend route (`/check`, `/submit`, cert-verify, portfolio, billing, AI tutor, hints, admin, learner-mode, dashboard, onboarding, enrollment), every frontend file (atlas + mockup-sandbox), OpenAPI spec, all codegen output, the rubric (`RUBRIC_VERSION='1.0.1'`), anchor / wave / taxonomy files, deployment checklist, `assertAuthoredProjectComplete`, `audit-project-authoring.ts` itself, the 4-file no-heuristic allowlist, `hintLeakSuspected` heuristic, every project under `scripts/src/authored/`. **No new project content authored — the work is entirely about removing already-superseded duplicates from the visible catalog.**

---

## Strategy decisions

1. **Archive-by-hide, not author 13 redundant projects.** All 13 visible gap-projects flagged by Phase-36's audit are already-superseded legacy duplicates with authored, publish-ready, currently-visible course-prefixed counterparts (mapped explicitly in `PHASE9_LEGACY_SLUG_MAP` + `PHASE10_LEGACY_SLUG_MAP`). They have 0 enrollments and 0 candidate rows. Authoring 13 net-new modules to compete with their own superseders would be content-padding against an audit metric, not honest curriculum work. Archive-by-hide is the documented "Archive = hide, not destroy" invariant and matches Phase 12A/B precedent verbatim.
2. **In-seed patch block, not a separate `archive-phase37-replaced.ts` one-shot script.** Phase 36 established this shape: convergence on every `pnpm run seed` run. A separate script would require an extra operator invocation and silently drift on re-seed. The patch is fully idempotent so re-running is safe and observable.
3. **Source the archive set from `PHASE9_LEGACY_SLUG_MAP` + `PHASE10_LEGACY_SLUG_MAP`, not a hardcoded local allowlist.** Single source of truth — if a future phase adds another legacy→authored pair to those maps, the Phase 37 block picks it up automatically (provided the safety gates pass). The two maps were already imported elsewhere in `scripts/src/` (backfill-upgrade-candidates.ts, backfill-revise-candidates.ts) so this is established consumer pattern.
4. **Query `user_progress` directly, not `legacy.enrolledCount`.** Architect-flagged in code review: the existing Phase 11/12B archive scripts read the denormalized `projects.enrolled_count` column, but repo-wide search confirms there is **no writer** for that column anywhere in the route code (only the schema default). It's correct in dev because the legacy slugs genuinely have zero `user_progress` rows, but inheriting that pattern would be a stale-false-safe gate for any future legacy→authored pair with real enrollments. Phase 37 queries `user_progress` through Drizzle so the gate reflects actual enrollment state. (Fixing the underlying counter — adding a writer or migration trigger — is a separate hygiene task, intentionally out of scope.)
5. **`PHASE11_LEGACY_SLUG_MAP` + `PHASE12B_LEGACY_SLUG_MAP` deliberately NOT included.** Those cohorts were already archived by their respective `archive-phase11-replaced.ts` + `archive-phase12b-replaced.ts` scripts — re-archiving via Phase 37 would be redundant (and harmless thanks to the `learnerVisible === false` short-circuit), but expanding the target set beyond what `audit:authoring` actually flagged would broaden the blast radius for no benefit.
6. **No new project content authored this phase.** P35's "author 1–2 net-new projects as a paved-path smoke test" remains an explicit deferred follow-up.

---

## What this phase closed

`audit:authoring` now reports **56/56 visible publish-ready** (was 56/69). The denominator dropped by exactly 13; the numerator is unchanged. Catalog has 13 fewer duplicate cards. No regression to any other gate.

---

## Final gate summary (Phase 37)

| Gate | Result |
| ---- | ------ |
| `pnpm --filter @workspace/scripts run audit:authoring` | **56/56 visible publish-ready** (was 56/69; denominator −13, numerator unchanged) |
| `pnpm --filter @workspace/scripts run audit:pedagogy` | **56/56 visible** (unchanged) |
| `pnpm --filter @workspace/curriculum-quality run test` | **69/69** (unchanged) |
| `pnpm --filter @workspace/execution-core run test` | **34/34** (unchanged) |
| `pnpm --filter @workspace/api-server run test` | **273/273** (unchanged) |
| `pnpm --filter @workspace/atlas run test` | **102/102** (unchanged) |
| `pnpm --filter @workspace/api-server run test:integration` | **3/3** (unchanged) |
| `pnpm run typecheck` | clean |
| `pnpm run check:no-heuristic-runtime` | OK (4-file allowlist unchanged) |
| Direct DB check | 56 visible / 45 hidden / 101 total; all 13 target slugs `learner_visible=f` |

## Hard-rule re-verification

- Schema / migration changes: **none**.
- `/check`, `/submit`, cert-verify, portfolio, billing, Stripe, deployment, OpenAPI codegen, hint route, learner-mode endpoints, admin endpoints, AI tutor prompt: **untouched**.
- `learner_visible = TRUE` filter on learner-facing routes: **unchanged** (404-not-403 privacy intact for newly-hidden slugs).
- Archive = hide, not destroy. **No row deletes from `projects` or `project_candidates`.** Honored — only `UPDATE projects SET learner_visible = false`.
- Bidirectional candidate ↔ project lineage: **untouched** (none of the 13 has a candidate row, so the invariant is vacuous for this cohort).
- `RUBRIC_VERSION='1.0.1'`: **frozen**.
- 4-file no-heuristic allowlist: **not expanded**.
- 9 Atlas courses + "Atlas is a project-based learning platform for Data Engineering" framing: **unchanged**.

## Reversibility

Every flip is reversible with `UPDATE projects SET learner_visible = true WHERE slug = '<legacy-slug>'`. The seed block will not re-archive a row that subsequently regains an enrollment (safety gate (c)) or whose superseder gets hidden (gate (b)).

## Untracked scratch

- `attached_assets/Pasted-*.txt` from prior sessions remain untracked. **Do not commit.**

## Known follow-ups (Phase 38 candidates)

- Author 1–2 net-new projects via the Phase-35 spec end-to-end as a green-field smoke test (carry-over from P35 and P36).
- Optional: admin UI surface for `audit:authoring` output (P35 deferred deliverable E).
- Optional: extend `hintLeakSuspected` with an embedding-based semantic check.
- Phase-34 follow-ups still open: surface `mode-usage` in admin UI; add `evt:'ai.tutor.response'` log; structured-log → time-series for `mode_usage_daily`; aggregate `hint.escalate` into per-step difficulty signal.
- Operator nicety: a `--dry-run` mode for `audit:authoring` that prints a per-slug diff between current DB state and the contract.
- Optional hygiene: prune the now-unused 13 legacy slug `INSERT` blocks from `scripts/src/seed-projects-extra.ts`, `seed-projects-2026.ts`, `seed-projects-cross-domain.ts`, and the `stubProjects` array in `seed.ts`. Leaving them in place this phase keeps the diff minimal and the convergence audit-trail intact; the inserts are no-ops on existing rows.
