# Phase 37 — Batch Remediation of Phase-9/10 Legacy Duplicates (Archive-by-Hide)

**Parent:** Phase 36 (Grandfathered Project Remediation Pilot) at `0dd8479`.
**Shape:** Content-only, idempotent, archive-by-hide. Zero schema / migration / route / frontend / codegen / OpenAPI / rubric / taxonomy / anchor / AI-tutor changes.
**Outcome:** `audit:authoring` improves from **56/69 → 56/56 visible publish-ready** (denominator drops by 13; numerator unchanged at 56).

---

## TL;DR

The 13 remaining "visible gap" projects flagged by `audit:authoring` after Phase 36 are not under-authored content. **Every one of them is an already-superseded legacy duplicate** of an authored, publish-ready, currently-visible course-prefixed counterpart. They were supposed to be removed by the Phase-9 / Phase-10 / Phase-11 upgrade pipelines but the legacy-row delete never ran in dev (the Phase-9 doc states "the legacy rows are deleted by the upgrade" — that step silently no-op'd). Phase 12B then canonicalised the safer **archive-by-hide** pattern (flip `learner_visible=false`, never row-delete).

Phase 37 applies exactly that archive-by-hide flip to all 13 legacy slugs, encoded as a new idempotent patch block at the end of `scripts/src/seed.ts` (same shape as the Phase 36 grandfathered-remediation block).

---

## Why archive, not author

Authoring 13 net-new modules to compete with their own publish-ready superseders for the same catalog slot would be **content-padding against an audit metric**, not honest curriculum work. Each of the 13 legacy slugs:

| Legacy slug                       | Superseder (publish-ready, visible)                          |
| --------------------------------- | ------------------------------------------------------------ |
| `real-time-dashboard`             | `data-engineering-real-time-dashboard`                       |
| `debezium-cdc`                    | `data-engineering-debezium-cdc`                              |
| `vector-database-search`          | `data-engineering-vector-database-search`                    |
| `stream-processing-flink`         | `data-engineering-stream-processing-flink`                   |
| `iceberg-table-format`            | `cloud-data-engineer-iceberg-table-format`                   |
| `dbt-macros-mastery`              | `cloud-data-engineer-dbt-macros-mastery`                     |
| `data-catalog-implementation`     | `analytics-engineer-data-catalog-implementation`             |
| `ai-eng-rag-pipeline`             | `ai-engineer-rag-pipeline`                                   |
| `mlops-feature-store`             | `ai-engineer-feature-store`                                  |
| `ds-causal-inference-uplift`      | `data-scientist-causal-inference-uplift`                     |
| `ds-ab-test-from-scratch`         | `data-scientist-ab-test-from-scratch`                        |
| `column-store-engine`             | `data-engineering-column-store-engine`                       |
| `data-mesh-design`                | `data-engineering-data-mesh-design`                          |

…has, per direct DB query before the seed re-ran:

- `course_source = 'heuristic_legacy'`
- 5 stub steps, all `code_python` / `self_attest` / `expected_outputs = NULL`
- **0 enrollments** (`user_progress` rows)
- **0 candidate rows** (`project_candidates.promoted_project_id`)
- The mapped superseder exists, is visible, has `course_source = 'authored'`, and passes the Phase-35 audit

The supersedence is documented as a **typed contract** in `scripts/src/authored-lineage.ts`:

- `PHASE9_LEGACY_SLUG_MAP` (6 entries — the first 6 in the table above)
- `PHASE10_LEGACY_SLUG_MAP` (7 entries — the remaining 7)

Phase 37 imports those maps directly so the archive set cannot drift from the supersedence source of truth.

---

## Implementation

### New `// --- Phase 37 — Archive superseded legacy duplicates (idempotent) ---` block

Appended to `scripts/src/seed.ts` between the Phase 36 block and the Mastery Sections. Iterates over `{...PHASE9_LEGACY_SLUG_MAP, ...PHASE10_LEGACY_SLUG_MAP}` and, for each `(legacySlug → upgradedSlug)` pair, applies **three safety gates** before flipping `learner_visible = false`:

| Gate | Behaviour on fail               | Why                                                                                       |
| ---- | ------------------------------- | ----------------------------------------------------------------------------------------- |
| `(a)` upgraded row exists       | `console.warn` + skip          | Don't archive a legacy without a working replacement.                                     |
| `(b)` upgraded row is visible   | `console.warn` + skip          | Don't hide a legacy if its superseder is itself hidden — that would leave the course empty. |
| `(c)` zero rows in `user_progress` for `legacy.id` | `console.warn` + skip          | Honor active enrollments. Query is run directly against `user_progress` via Drizzle (not via the denormalized `projects.enrolled_count` column, which has a schema default of 0 but no writer in the enrollment routes — relying on it would be a stale-false-safe gate). |

The legacy row itself being already-hidden short-circuits silently (full idempotency). No row is ever deleted — the operation is fully reversible by `UPDATE projects SET learner_visible = true`.

### One new import

```ts
import { PHASE9_LEGACY_SLUG_MAP, PHASE10_LEGACY_SLUG_MAP } from "./authored-lineage";
```

---

## Why this is the right shape (vs alternatives)

1. **In-seed patch block, not a separate one-shot script.** Phase 36 chose this shape so a fresh-DB re-seed always converges to the same final state. A separate `archive-phase37-replaced.ts` would require an extra operator invocation and would silently drift on re-seed. The Phase 37 block re-runs every time `pnpm run seed` runs; idempotency makes that safe.
2. **Read from `PHASE9_LEGACY_SLUG_MAP` + `PHASE10_LEGACY_SLUG_MAP`, not a hardcoded local list.** Single source of truth — if a future phase adds another legacy→authored pair to those maps, the Phase 37 block will pick it up automatically (provided the safety gates pass).
3. **Query `user_progress` directly, not `legacy.enrolledCount`.** The existing Phase 11/12B archive scripts read the denormalized `projects.enrolled_count` column, and it happens to be correct in dev because the legacy slugs genuinely have zero `user_progress` rows — but repo-wide search confirms there is **no writer** for `projects.enrolled_count` anywhere in the route code (only the schema default `.default(0).notNull()`). Inheriting that pattern would be a stale-false-safe gate that masks the latent bug for any future legacy→authored pair with real enrollments. Phase 37 queries `user_progress` through Drizzle (`db.select({ ct: sql\`count(*)::int\` }).from(userProgress).where(eq(userProgress.projectId, legacy.id))`) so the gate reflects actual enrollment state.
4. **No content authored.** Phase 35's "author 1–2 net-new projects as a paved-path smoke test" remains an explicit deferred follow-up, just like at end of Phase 36.

---

## What this phase does NOT touch

- Schema, migrations, Drizzle definitions.
- `/check`, `/submit`, cert-verify, portfolio, billing, Stripe, deployment, OpenAPI spec, codegen output.
- Hint route, learner-mode routes, admin route, AI tutor prompt / `tutorContract`, dashboard, onboarding, enrollment.
- `learner_visible = TRUE` filter on learner-facing routes (still in place — hidden slugs return 404, not 403, no existence leak).
- Bidirectional candidate ↔ project lineage (none of the 13 has a candidate row, so the invariant is vacuous for this cohort).
- `RUBRIC_VERSION = '1.0.1'`, anchor / wave / taxonomy files, 4-file no-heuristic allowlist, `assertAuthoredProjectComplete`, `audit-project-authoring.ts` itself, `hintLeakSuspected` heuristic.
- Every frontend file (atlas + mockup-sandbox). Every project under `scripts/src/authored/`.

---

## Hard-rule re-verification

- **Archive = hide, not destroy. No row deletes from `projects` or `project_candidates`.** Honored — only `UPDATE projects SET learner_visible = false`.
- **Hidden slugs return 404 (not 403).** Unchanged — the learner-route filter does not branch on archived-ness; it filters on `learner_visible`.
- **9 Atlas courses + "project-based learning platform for Data Engineering" framing.** Unchanged.
- **`RUBRIC_VERSION = '1.0.1'`.** Frozen, untouched.
- **4-file no-heuristic allowlist.** Not expanded.
- **Lineage integrity (`lineageIntegrity { promotedProjects, candidatesWithInverse, mismatches, inverseMismatches, duplicateCandidatePromotions }`).** Unchanged — no candidate rows touched, no FK direction written, no project promoted.

---

## Final gate summary

| Gate | Result |
| ---- | ------ |
| `pnpm --filter @workspace/scripts run audit:authoring` | **56/56 visible publish-ready** (was 56/69 — denominator down 13, numerator unchanged) |
| `pnpm --filter @workspace/scripts run audit:pedagogy` | 56/56 visible (unchanged) |
| `pnpm --filter @workspace/curriculum-quality run test` | 69/69 (unchanged) |
| `pnpm --filter @workspace/execution-core run test` | 34/34 (unchanged) |
| `pnpm --filter @workspace/api-server run test` | **273/273** (unchanged) |
| `pnpm --filter @workspace/atlas run test` | **102/102** (unchanged) |
| `pnpm --filter @workspace/api-server run test:integration` | 3/3 (unchanged) |
| `pnpm run typecheck` | clean |
| `pnpm --filter @workspace/scripts run check:no-heuristic-runtime` | OK (4-file allowlist unchanged) |
| Direct DB verification | 13 legacy slugs `learner_visible = f`; 56 visible / 45 hidden / 101 total |

---

## Architect post-fix correction (in-phase)

The initial Phase 37 draft used `legacy.enrolledCount` (the denormalized `projects.enrolled_count` column) for gate (c), inheriting the read pattern from `archive-phase12b-replaced.ts`. Architect review flagged this as a **Critical** finding: repo-wide search confirms `projects.enrolled_count` has only the schema default `.default(0).notNull()` and **no writer** in any enrollment route (`POST /api/enrollments`, `POST /api/user/projects/:projectId/enroll`) or migration trigger. The column happens to read zero in dev for these 13 legacy slugs (so the original Phase 37 archive result was correct on dev data), but the gate would be stale-false-safe for any future legacy→authored pair with real enrollments.

**Fix applied in this same phase:** gate (c) now queries `user_progress` directly through Drizzle (`db.select({ ct: sql\`count(*)::int\` }).from(userProgress).where(eq(userProgress.projectId, legacy.id))`). The seed-time cost is 13 additional `count(*)` queries — negligible. The same fix is **not** applied to the older `archive-phase11-replaced.ts` / `archive-phase12b-replaced.ts` / `archive-thin-stubs.ts` scripts; harmonising those (and either adding a writer for `enrolled_count` or replacing it with a Postgres trigger / view) is intentionally a separate hygiene phase.

Architect re-review after the fix: **PASS** (one doc-consistency follow-up applied to `replit.md` + `INDEX.md` Phase 37 blurbs in the same round).

## Known follow-ups (Phase 38 candidates)

- Author 1–2 net-new projects end-to-end via the Phase-35 spec as a green-field smoke test (carry-over from Phase 35 and Phase 36).
- Optional: admin UI surface for `audit:authoring` output (P35 deferred deliverable E).
- Optional: extend `hintLeakSuspected` with an embedding-based semantic check.
- Phase-34 follow-ups still open: surface `mode-usage` in admin UI; add `evt:'ai.tutor.response'` log; structured-log → time-series for `mode_usage_daily`; aggregate `hint.escalate` into per-step difficulty signal.
- Operator nicety: a `--dry-run` mode for `audit:authoring` that prints a per-slug diff between current DB state and the contract.
- Optional: prune the now-unused 13 legacy slug `INSERT` blocks from their respective `seed-projects-*.ts` files in a future hygiene pass. (Leaving them in place this phase keeps the diff minimal and the convergence audit-trail intact; the inserts are no-ops on existing rows.)
