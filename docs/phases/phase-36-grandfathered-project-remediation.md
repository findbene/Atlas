# Phase 36 — Grandfathered Project Remediation Pilot

**Parent:** Phase 35 at `9f7eec0`.
**Status:** SHIPPED. Content-only (DB rows + one seed-script patch block). No schema, no migrations, no route changes, no frontend changes.
**Outcome:** Visible-catalog publish-readiness moves **54/69 → 56/69** by clearing every Phase-35 `audit:authoring` finding on the two pre-Phase-7 grandfathered originals: `csv-to-postgres-pipeline` and `dbt-data-models`. The catalog gap surfaced as a Phase-35 close-out follow-up is now closed for those two slugs.

---

## What this phase did

Phase 35 introduced `audit:authoring` (read-only, exit-0-always). It revealed exactly two visible-catalog gaps:

| Slug | Findings (before) |
| ---- | ----------------- |
| `csv-to-postgres-pipeline` | `step-missing-expected-outputs`, `all-steps-self-attest`, `course-source-legacy` |
| `dbt-data-models` | `fewer-than-four-steps`, `step-missing-expected-outputs`, `all-steps-self-attest`, `course-source-legacy` |

Both predate the `AuthoredProject` contract and the Phase-4 pedagogy ladder discipline. Pedagogy was already at 10/10 keys per step (these two were the original full-enrichment subjects), so the remaining gap was on the project shape — number of steps, validation type, expected-outputs presence, and the `course_source = 'heuristic_legacy'` sentinel.

Two paths were considered:

1. **Archive + replace.** Set `learner_visible = false` and ship new authored equivalents using the Phase-35 paved path. Larger blast radius (new candidate rows, new lineage, new slugs) and not justified for two projects that are already pedagogically well-formed.
2. **In-place remediation.** Keep the existing rows + lineage + enrollments, retro-fit the project shape to the Phase-35 contract. Lower blast radius, idempotent, reversible. **Chosen.**

The remediation is encoded as an idempotent patch block at the end of `scripts/src/seed.ts` (after the Phase-2 dbt DuckDB POC block, before the Mastery Sections). This is the same pattern the codebase already uses for the dbt POC step — a targeted slug-keyed update that runs unconditionally on every seed run and converges to the same DB state regardless of starting point.

---

## Files changed

**`scripts/src/seed.ts`** — the live convergence mechanism is the new patch block below. The inline-data tweaks (items 1-4) are documentary only because the main `projectData` INSERT path (~line 495) hardcodes `validationType: "self_attest"`, `validationConfig: {}`, and `type: "code_python"` regardless of any per-step inline fields. Both the existing-row case (re-seed: main loop skips) AND the fresh-DB case (main loop inserts but with hardcoded fields) converge correctly through the patch block.

1. Inline-data type extended with optional `validationType` / `validationConfig` / `expectedOutputs` (documentary; not honored by insert path).
2. csv-to-postgres-pipeline step 4 inline data: `validationType: "contains"`, `validationConfig: { needle: "copy_expert" }`, `expectedOutputs: { kind, mustContain, why }`.
3. dbt-data-models inline data: added steps 3 (Stage Raw Orders) and 4 (Add a dbt Schema Test).
4. dbt-data-models Phase-2 POC step 2 block: flipped `validationType: "self_attest"` → `"contains"` with `validationConfig: { needle: "GROUP BY" }`. The Phase-2 update path also propagates these on re-seed.
5. **New `// --- Phase 36 — Grandfathered project remediation (idempotent) ---` block** that on every seed run:
   - For `csv-to-postgres-pipeline`: flips `course_source` → `'authored'`; sets step 4 to `contains`/`copy_expert` with non-empty `expectedOutputs`; backfills `{}` on the remaining self_attest steps' `expectedOutputs` so the audit's null-branch finding clears.
   - For `dbt-data-models`: flips `course_source` → `'authored'`; inserts steps 3 + 4 if missing; **also pins `type: "code_sql"` on both insert AND update branches** (architect-flagged: without the update-branch fix, a fresh-DB seed would let the main loop create the rows first as `code_python`, leaving them mis-typed even though the audit passes); bumps `projects.totalSteps` to 4; backfills `{}` on self_attest steps' `expectedOutputs`.

**`scripts/src/seed-pedagogy.ts`** — added Phase-4-grade pedagogy enrichment (all 10 keys: `learningObjective`, `requiredSkill`, `misconceptionToWatchFor`, hintLevel1..5, `finalExplanation`, `successFeedback`, `failureFeedback`, `portfolioRelevance`) for the two new dbt steps (3 + 4). Required to keep `audit:pedagogy` 56/56 — that audit fires on any visible-project step lacking any of the 10 keys.

**Unchanged:** every schema file, every migration, every route (`/check`, `/submit`, cert-verify, portfolio, billing, AI tutor, hints, admin, learner-mode), every frontend file (atlas + mockup-sandbox), OpenAPI spec, all codegen output, the rubric (`RUBRIC_VERSION='1.0.1'`), anchor / wave / taxonomy files, deployment checklist, `assertAuthoredProjectComplete`, the 4-file no-heuristic allowlist, the `hintLeakSuspected` heuristic, every authored project under `scripts/src/authored/`, `audit-project-authoring.ts` itself.

---

## Strategy decisions

1. **`contains` is the only honest server-graded validation kind for these projects.** `grading.ts` only switches on `self_attest`/`exact`/`contains`/`regex`; the richer enum values (`sql_resultset`, `csv_set_equal`, etc.) fall through to an auto-pass fallback. Choosing `contains` with a keyword that must appear in the learner's submission is a real, machine-verifiable gate that doesn't require a runtime we don't have (psycopg2 + PostgreSQL aren't available in Pyodide; DuckDB-WASM doesn't grade SQL output server-side). The needles (`copy_expert`, `GROUP BY`) are non-leaky — they're the canonical method / clause the instruction already names verbatim.
2. **In-place patch, not archive-and-replace.** Existing enrollments + lineage stay intact. The patch is idempotent and reversible (each operation is a slug-keyed UPDATE/INSERT-IF-MISSING).
3. **Patch block, not a refactor of the upsert path.** The main `projectData` loop in `seed.ts` skips already-existing projects on re-seed (line 462). Refactoring the upsert path to handle in-place project shape updates would touch every other project's seed code and is out of scope for a two-slug remediation. The targeted patch block follows the exact pattern the codebase already uses for the dbt Phase-2 POC step.
4. **`course_source` flip `heuristic_legacy` → `authored` is semantically correct.** We are now explicitly authoring these projects against the Phase-35 contract, not relying on the Phase-8 heuristic course mapping. Flipping the sentinel clears the audit's `course-source-legacy` finding and matches reality.
5. **Backfilling `{}` on self_attest steps' `expectedOutputs` is a no-op for behavior.** The audit's first two branches (`null` / `undefined`) fire unconditionally — the third branch (empty object) is gated on `!== self_attest`. So `{}` + `self_attest` is the correct "this step has no expected output" representation that satisfies the audit without touching any runtime path that reads `expectedOutputs` (only the audit + frontend rendering do, and they treat empty objects the same as null).
6. **Hint-leak heuristic safety verified manually.** The new `expectedOutputs` JSON shapes are short descriptor objects; their 40-char windows either have JSON-syntax ratio >50% (skipped by the false-positive guard) or contain text fragments (`"Solution must call cursor.copy_expert"`) that do not appear in the L4/L5 hint substrings (which contain the actual code `cur.copy_expert(...`, abbreviated, no descriptive prose). `hint-leak-suspected` does not fire for either slug.
7. **No new project authored.** Phase 35's follow-up suggested "author 1–2 net-new projects using the new spec end-to-end as a paved-path smoke test" — explicitly deferred to a later phase. This phase is about closing the existing gap, not exercising the green-field path.

---

## Final gate summary (Phase 36)

| Gate | Result |
| ---- | ------ |
| `pnpm --filter @workspace/scripts run audit:authoring` | **56/69 visible publish-ready** (was 54/69). Both target slugs cleared. |
| `pnpm --filter @workspace/scripts run audit:pedagogy` | **56/56 visible** (unchanged — new dbt steps 3/4 enriched to 10/10) |
| `pnpm --filter @workspace/curriculum-quality run test` | **69/69** (unchanged) |
| `pnpm --filter @workspace/execution-core run test` | **34/34** (unchanged) |
| `pnpm --filter @workspace/api-server run test` | **273/273** (unchanged) |
| `pnpm --filter @workspace/atlas run test` | **102/102** (unchanged) |
| `pnpm --filter @workspace/api-server run test:integration` | **3/3** (unchanged) |
| `pnpm run typecheck` | clean |
| `pnpm run check:no-heuristic-runtime` | OK (4-file allowlist unchanged) |

---

## Hard-rule re-verification

- Schema / migration changes: **none**.
- `/check`, `/submit`, cert-verify, portfolio, billing, Stripe, deployment, OpenAPI codegen, hint route, learner-mode endpoints, admin endpoints, AI tutor prompt: **untouched**.
- `learner_visible = TRUE` filter on learner-facing routes: **unchanged** (404-not-403 privacy intact).
- Bidirectional candidate ↔ project lineage: **untouched** (neither slug has a candidate row; both predate the candidate pipeline — the lineage-integrity counters on `/api/admin/quality` exclude them by design).
- `RUBRIC_VERSION='1.0.1'`: **frozen**.
- 4-file no-heuristic allowlist: **not expanded**.
- 9 Atlas courses + "Atlas is a project-based learning platform for Data Engineering" framing: **unchanged**.
- No row deletes from `projects` or `project_candidates`. Archive-as-hide invariant: not exercised this phase.

## Operator notes

- The patch block is idempotent: every seed run converges to the same DB state. Safe to re-run.
- The patch is dev-DB only this session. Production DB has never been touched; Atlas remains in dev preview per Phase 31.
- If a learner has already self-attested past csv-to-postgres-pipeline step 4 prior to this phase, the flip to `contains/copy_expert` only affects FUTURE submissions. Existing `user_step_completions` rows are not invalidated (no completion-recompute path was added or invoked).
- The new dbt steps 3 + 4 will appear at the end of `dbt-data-models` for any learner who returns to that project. Existing in-progress enrollments are unaffected (step rows are inserted, not reordered).
