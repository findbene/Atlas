# Phase 55 — Net-New Project Production Pilot

**Status:** CLOSED.
**Type:** Curriculum content phase. Two net-new authored projects (C1 + C2) shipped sequentially with full review pause between. Zero changes to canary/env/grading/schema/migration/deploy surfaces.
**Parent commit chain:** `0d89eb0` (C2 promote) ← `f12fe95` (C1 promote) ← `82e473d` (Phase 54).
**Phase 52 status (unchanged):** operator flip kit prepared, flip not executed. Phase 55 is **not** the 10% ramp evaluation and does not satisfy any Phase 52 operator-side prerequisite.
**Visibility status (terminal):** Both C1 and C2 remain `learner_visible=false` pending manual publish-readiness checklist sign-off. No agent-driven visibility flip.

---

## Why this phase

After 5 consecutive Atlas-side hardening phases (Phase 49–54: H3 disclosure, canary wrapper, ops readiness, operator flip kit, launch-readiness audit, copy-safety hardening), the catalog itself had not received net-new content since Phase 41. Read-only intake before authoring identified two specific gaps:

1. **Applied-LLM-Engineer course (5 visible projects)** had nothing covering the 2026 production reality: structured-output validation under prompt-injection / jailbreak / schema-fuzz pressure. Every existing applied-LLM project assumed cooperative inputs.
2. **Analytics-Engineer course (5 visible projects)** had a thin intermediate slot — only `dbt-data-models` (4 steps, basic) sat between beginner and advanced. The catalog had **zero** coverage of semantic-layer / metrics-definition work, which is the 2026 senior-AE differentiator.

Phase 55 ships one net-new project per gap, sequentially, with explicit user review pause after C1 before starting C2.

---

## Operating discipline

| Discipline | How it was honored |
|---|---|
| One project at a time, not batch | C1 fully shipped + reviewed + approved BEFORE C2 file was opened. No parallel authoring. |
| Hidden until manual sign-off | Both projects flipped to `learner_visible=false` post-promote. No agent-driven visibility flip. |
| No grader changes | Step validation kinds drawn from existing enforced/client-provisional/contract-shaped sets. Zero edits to `lib/execution-core`, `/check`, `/submit`, or any commit-grader. |
| No schema changes | Both projects insert through existing `project_candidates` + `projects` shape via the existing `promote()` path. Lineage uses existing FK columns. |
| Strongest available validation kinds | C1 deterministic Pyodide CLI keyed by SHA1 fixture mocks; C2 real DuckDB-WASM runtime feedback on 5/8 steps + 2 strong `exact` server-enforced. |
| Honest-claim discipline (Phase 49 → 54) | No instructionMd or validation description claims server-side enforcement where the kind is client-provisional or contract-shaped. |
| Catalog-wide weaknesses called out, not hidden | Inherited `contains` thinness, `sql_resultset`/`csv_set_equal` server auto-pass, difficulty-heuristic false-positive — all surfaced in the review packages instead of silently accepted. |

---

## What landed — projects

### C1 — Applied-LLM-Engineer / Guardrails and Structured Output Safety

| Field | Value |
|---|---|
| Slug | `applied-llm-engineer-guardrails-and-structured-output-safety` |
| Course | `applied-llm-engineer` (domain `data-engineering`) |
| Candidate id | `f550c1a1-…` (Phase 55 C1 marker) |
| Steps / Minutes / XP | 8 / 320 / 880 |
| Difficulty | intermediate |
| Stack | Python · Pydantic · JSON-Schema · regex · fixture-mock LLM |
| Validation distribution | 7×`contains` (enforced, thin) + 1×`numeric_tolerance` (contract-shaped) |
| Runtime feedback | Pyodide CLI runs (learner-driven, real output) |
| Determinism | SHA1-keyed fixture-mock LLM responses; zero API keys needed |
| Architect rounds | 3 (wording tightening) → PASS |
| Promoted | commit `f12fe95` |
| Status | hidden (`learner_visible=false`) pending manual checklist sign-off |

### C2 — Analytics-Engineer / Semantic Layer with dbt + DuckDB

| Field | Value |
|---|---|
| Slug | `analytics-engineer-semantic-layer-with-dbt-and-duckdb` |
| Course | `analytics-engineer` (domain `data-engineering`) |
| Candidate id | `c2dbc2db-d4e5-4f6a-9051-2b3c4d5e6f70` (Phase 55 C2 marker) |
| Steps / Minutes / XP | 8 / 340 / 920 |
| Difficulty | intermediate |
| Stack | dbt-core · DuckDB · SQL · YAML · Python |
| Validation distribution | 4×`sql_resultset` + 1×`csv_set_equal` (client-provisional, real DuckDB-WASM runtime) + 2×`exact` (enforced) + 1×`contains` (enforced, thin) |
| Contract-shaped steps | **0** (strongest of any C-series project) |
| Runtime feedback | DuckDB-WASM SQL execution graded against expected row sets |
| Architect rounds | 1 → PASS (zero P0/P1 findings) |
| Promoted | commit `0d89eb0` |
| Status | hidden (`learner_visible=false`) pending manual checklist sign-off |

---

## Files changed (this phase)

| # | File | Change |
|---|---|---|
| 1 | `scripts/src/authored/applied-llm-engineer__guardrails-and-structured-output-safety.ts` | NEW — C1 AuthoredProject module, 8 fully-authored steps with full hint ladders + feedback pairs + portfolioRelevance |
| 2 | `scripts/src/authored/analytics-engineer__semantic-layer-with-dbt-and-duckdb.ts` | NEW — C2 AuthoredProject module, 8 fully-authored steps with full hint ladders + feedback pairs + portfolioRelevance |
| 3 | `scripts/src/authored/index.ts` | EDIT — barrel imports + array entries for both C1 and C2 |
| 4 | `scripts/src/authored-lineage.ts` | EDIT — `NET_NEW_FOR_SLUG_PHASE55` (2 entries) + `COURSE_FOR_AUTHORED_SLUG` (2 entries) |
| 5 | `scripts/src/backfill-phase55-candidates.ts` | NEW — idempotent map-driven candidate-row backfill; inserts `project_candidates` rows with `source='phase55_net_new'`, `status='approved'`, `synthetic=false` |
| 6 | `scripts/package.json` | EDIT — added `backfill:phase55-candidates` script |
| 7 | DB — `project_candidates` | +2 rows (C1, C2) |
| 8 | DB — `projects` | +2 rows (both `learner_visible=false`) |
| 9 | DB — bidirectional lineage | both `projects.replace_candidate_id` and reciprocal candidate FK populated for both projects |

---

## Hard-stops respected

| Surface | Touched? |
|---|---|
| Signed-envelope canary path | NO |
| Production env vars | NO |
| `/check` route | NO |
| `/submit` route | NO |
| Grading logic / `lib/execution-core` | NO |
| Commit grader / validation-kind enforcement | NO |
| Schema / migrations | NO |
| `lib/db` columns or enums | NO |
| OpenAPI / `lib/api-spec` / codegen | NO |
| Cert / portfolio evidence semantics | NO |
| `RUBRIC_VERSION` | FROZEN at `1.0.1` |
| Phase 52 operator flip kit | NOT TOUCHED |
| Visibility of any existing project | NO |
| `learner_visible` flag on Phase 55 projects | Set FALSE; never flipped TRUE |

---

## Gates

| Gate | Result | Delta |
|---|---|---|
| `pnpm run typecheck` (libs + 4 artifacts) | OK | unchanged |
| `check:no-heuristic-runtime` | OK | unchanged |
| `audit:authoring` (visible publish-ready) | **58 / 58** | unchanged (C1 + C2 are hidden, so visible count is preserved at 58) |
| `audit:pedagogy` | both C1 + C2 fully enriched (5-hint ladder + feedback pair + portfolioRelevance × every step) | +2 hidden |
| `audit:difficulty-labels` | Anchor immutability: 0 mismatches (Rule 1 holds) | unchanged |
| `wave-report` | **58 / 58** ≥70 | +1 visible-eligible project covered (C2) once flipped; C1 also stays in the pool |
| `@workspace/curriculum-quality` vitest | 93 / 93 | unchanged |
| `@workspace/execution-core` vitest | 83 / 83 | unchanged |
| `@workspace/api-server` vitest | 395 / 395 | unchanged |
| `@workspace/atlas` vitest | 150 / 150 | unchanged |

`audit:difficulty-labels` flagged both projects as `declared=intermediate, suggested=advanced` — same false-positive that fires on every Phase-41+ project with `steps>4 OR estMin>300`. Anchors immutable; informational only.

---

## Architect review history

| Project | Round | Result | Notes |
|---|---|---|---|
| C1 | v1 | FAIL | Honest-claim overclaims in 3 instructionMd surfaces ("server enforces…"), thin `contains` substring evasions in 2 of 7 enforced steps |
| C1 | v2 | FAIL | v1 closed; 1 residual overclaim in step 5 feedback copy + 1 ambiguous "verified" word |
| C1 | v3 | PASS | All overclaims removed; thin substrings made non-bypassable for realistic learner paths |
| C2 | v1 | PASS | Zero P0/P1 issues. NRR algebra independently verified. Wiring, lineage, validation classification all correct on first round. |

---

## Known caveats (user-accepted on C2 approval; same caveats apply to C1 where shape overlaps)

1. **`sql_resultset` and `csv_set_equal` server-side enforcement** — client (DuckDB-WASM) gives real provisional feedback by actually running the learner's SQL against expected row sets; server commit-grader auto-passes. Catalog-wide condition from Phase 31; out of scope per Phase 55 no-grading-changes hard stop. Affects C2 steps 1, 2, 3, 5, 8.
2. **`contains` is a thin substring check** — passes if the needle appears anywhere in the submission body. Catalog-wide Phase-7-era limitation. C1 leans heavily on this kind (7 steps); C2 uses it once (step 7) as a guardrail on a write-up artifact that has its substantive value in the act of writing.
3. **Difficulty-heuristic false positive** — both projects flagged `inferred=advanced` because the rule fires on `steps>4 OR estMin>300`. Anchors immutable; informational only. Same advisory fires on every Phase-41 sibling.
4. **Fixtures are described, not shipped as starter files** — C2 step 3's C-100 fixture is fully specified in instructionMd; learner constructs it. Established catalog convention.
5. **C2 step 4 metric expression matching is rigid** — `exact` against the 5 canonical metric formulas verbatim. A paraphrase that reduces to the same algebra fails the gate. This is the right trade for a semantic-layer contract (the entire point is the formula text doesn't drift) but is stricter than the rest of the project. Documented in the C2 review package.

---

## What unblocks the next phase

The user paused at Phase 55 close to choose between four next-phase directions:

**A. Manual publish-readiness checklist on C1 and C2** — operator runs the existing visibility-flip checklist against both projects and flips `learner_visible=true` if they pass.

**B. Grader / platform hardening for `contains`, `sql_resultset`, `csv_set_equal`** — converts the catalog-wide weaknesses surfaced by Phase 55 into real server-side enforcement (likely via the Phase 44 signed-RunResult round-trip referenced in the json_equal advisory).

**C. Another small net-new project phase** — same operating discipline as Phase 55; pick the next-thinnest course/difficulty cell.

**D. Return to Phase 52 operator canary evidence** — run the operator flip kit and the 1% / 10% ramp evaluation phases that have been waiting since Phase 52.

Decision lives with the user.

---

## Commits

- `f12fe95` — phase-55 C1: applied-LLM-engineer guardrails and structured output safety
- `0d89eb0` — phase-55 C2: analytics-engineer semantic layer with dbt and DuckDB
