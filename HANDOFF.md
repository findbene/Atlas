# HANDOFF

**Latest shipped phase:** Phase 55 — Net-New Project Production Pilot (C1 + C2) — **post-publish-readiness checklist, both projects VISIBLE.**
**Working tree:** clean after `0d89eb0` (C2 promote); subsequent DB-only visibility flips on C1 + C2 (no source changes after the checklist pass).
**Parent commit chain:** Phase 55 ← `0d89eb0` (C2 promote) ← `f12fe95` (C1 promote) ← `82e473d` (phase-54 copy-safety) ← `b0667ec` (phase-53 launch-readiness H3 audit) ← `efa4ddf` (phase-52 operator flip kit, no code changes) ← `27e70c6` (phase-51 ops readiness) ← `5278fec` (phase-50 canary wrapper) ← `b119bc7` (phase-49b disclosure) ← `24055ed` (phase-49a runtime wiring).

**Phase 52 status (unchanged by Phase 53 / 54 / 55):** operator flip kit prepared; the production flip has NOT been executed by the agent. None of Phase 53, 54, or 55 satisfies any of the kit's operator-side prerequisites; none is the 10% ramp evaluation.

---

## Phase 55 summary

Phase 55 is a curriculum content phase: two net-new authored projects shipped sequentially with explicit user review pause between. The catalog had not received net-new content since Phase 41; intake identified two specific gaps (applied-LLM-engineer had no structured-output-safety project for the 2026 production reality of jailbreak/injection/schema-fuzz pressure; analytics-engineer had a thin intermediate slot and zero semantic-layer coverage). One project per gap, in that order.

**Visibility status (terminal):** **Both C1 and C2 are now `learner_visible=true`** after the per-project publish-readiness checklist passed with zero blockers and zero nits each. Manual sign-off complete. Visible catalog count 58 → **60**.

### What landed — projects

| Project | Slug | Course | Steps | Min | XP | Validation distribution | Architect | Commit |
|---|---|---|---|---|---|---|---|---|
| C1 | `applied-llm-engineer-guardrails-and-structured-output-safety` | applied-llm-engineer | 8 | 320 | 880 | 7×contains (enforced, thin) + 1×numeric_tolerance (contract-shaped) | 3 rounds → PASS | `f12fe95` |
| C2 | `analytics-engineer-semantic-layer-with-dbt-and-duckdb` | analytics-engineer | 8 | 340 | 920 | 4×sql_resultset + 1×csv_set_equal (client-provisional, real DuckDB-WASM runtime) + 2×exact + 1×contains (enforced) — **0 contract-shaped** | 1 round → PASS | `0d89eb0` |

C2 has the strongest validation-kind distribution of any C-series project: 5/8 steps give real DuckDB-WASM runtime feedback, 2/8 are strong server-enforced `exact`, only 1/8 is the thin `contains` (used on a stakeholder-doc write-up where the substantive value is in writing the artifact, not in the gate).

### Files changed

| File | Change |
|---|---|
| `scripts/src/authored/applied-llm-engineer__guardrails-and-structured-output-safety.ts` | NEW — C1 AuthoredProject (8 steps, full hint ladders + feedback pairs + portfolioRelevance) |
| `scripts/src/authored/analytics-engineer__semantic-layer-with-dbt-and-duckdb.ts` | NEW — C2 AuthoredProject (8 steps, full hint ladders + feedback pairs + portfolioRelevance) |
| `scripts/src/authored/index.ts` | EDIT — barrel imports + array entries for both |
| `scripts/src/authored-lineage.ts` | EDIT — `NET_NEW_FOR_SLUG_PHASE55` + `COURSE_FOR_AUTHORED_SLUG` extended (2 entries each) |
| `scripts/src/backfill-phase55-candidates.ts` | NEW — idempotent map-driven candidate-row backfill (`source='phase55_net_new'`, `status='approved'`, `synthetic=false`) |
| `scripts/package.json` | EDIT — `backfill:phase55-candidates` script |
| DB `project_candidates` | +2 rows (C1, C2) |
| DB `projects` | +2 rows (both `learner_visible=false`) |
| DB bidirectional lineage | both directions populated for both projects |

Zero touches to: signed-envelope canary path, `/check`, `/submit`, `lib/execution-core`, grading logic, schemas, migrations, OpenAPI/codegen, env vars, deploys, `RUBRIC_VERSION` (frozen at `1.0.1`), Phase 52 operator flip kit, or any existing project's visibility.

### Gates

| Gate | Result | Delta |
|---|---|---|
| `pnpm run typecheck` (libs + 4 artifacts + `check:no-heuristic-runtime`) | OK | unchanged |
| `audit:authoring` (visible publish-ready) | **60 / 60** | +2 (C1 + C2 now visible) |
| `audit:pedagogy` | both C1 + C2 fully enriched | +2 visible |
| `audit:difficulty-labels` | 0 anchor mismatches (Rule 1 holds) | unchanged |
| `wave-report` | **58 / 58** ≥70 | unchanged (C-series outside Phase-7 wave scope) |
| `check:no-heuristic-runtime` | OK | unchanged |
| `@workspace/curriculum-quality` vitest | 93 / 93 | unchanged |
| `@workspace/execution-core` vitest | 83 / 83 | unchanged |
| `@workspace/api-server` vitest | 395 / 395 | unchanged |
| `@workspace/atlas` vitest | 150 / 150 | unchanged |

`audit:difficulty-labels` informational advisory: both projects flagged `declared=intermediate, suggested=advanced` from the `steps>4 OR estMin>300` keyword heuristic. Same false-positive that fires on every Phase-41+ sibling. Anchors immutable.

### Architect review history

| Project | Rounds | Notes |
|---|---|---|
| C1 | v1 FAIL · v2 FAIL · v3 PASS | Wording tightening — overclaims in instructionMd ("server enforces…") and thin-`contains` evasions; all closed by v3 |
| C2 | v1 PASS | Zero P0/P1 findings. NRR algebra, wiring, lineage, validation classification all correct on first round. |

### Known caveats (user-accepted on C2 approval)

1. `sql_resultset` / `csv_set_equal` — real DuckDB-WASM client feedback; server commit-grader auto-passes (catalog-wide, Phase 31 inheritance).
2. `contains` — thin substring check (catalog-wide Phase-7-era limitation).
3. Difficulty-heuristic false-positive on both projects (`steps>4 OR estMin>300`) — informational, anchors immutable.
4. Fixtures described in instructionMd rather than shipped as starter files — established catalog convention.
5. C2 step 4 metric formulas matched verbatim by `exact` — rigid by design (semantic-layer contracts should not drift); stricter than the rest of the project.

### Hard stops respected

| Surface | Touched? |
|---|---|
| Signed-envelope canary path | NO |
| Production env vars | NO |
| `/check` and `/submit` routes | NO |
| Grading logic / `lib/execution-core` | NO |
| Schema / migrations | NO |
| OpenAPI / codegen | NO |
| Cert / portfolio evidence semantics | NO |
| `RUBRIC_VERSION` | FROZEN at `1.0.1` |
| Phase 52 operator flip kit | NOT TOUCHED |
| Visibility of any existing project | NO |
| Phase 55 project visibility | `learner_visible=false`; never flipped TRUE by agent |

---

## What unblocks the next phase

User decision pending between four options at Phase 55 close:

- **A.** Manual publish-readiness checklist on C1 and C2; operator flips `learner_visible=true` if they pass.
- **B.** Grader / platform hardening for `contains`, `sql_resultset`, `csv_set_equal` — converts the catalog-wide weaknesses surfaced by Phase 55 into real server-side enforcement.
- **C.** Another small net-new project phase (same one-at-a-time discipline; next-thinnest course/difficulty cell).
- **D.** Return to Phase 52 operator canary evidence — run the flip kit and the 1% / 10% ramp evaluation phases that have been waiting since Phase 52.

The Phase 52 unblock criteria are UNCHANGED:

1. Operator runs `docs/phases/phase-52-canary-1pct-flip-kit.md` §§1–10.
2. 48h / 500-success hold confirmed at kit §10.
3. Operator records sign-off + recommendation (hold / rollback / 10% ramp evaluation).

Only then does the 10% ramp evaluation phase open.

---

## Commits

- `f12fe95` — phase-55 C1: applied-llm-engineer guardrails and structured output safety
- `0d89eb0` — phase-55 C2: analytics-engineer semantic layer with dbt and DuckDB
