# HANDOFF

**Latest shipped phase:** Phase 41 — Seed Factory Pilot (2 net-new INTERMEDIATE-tier projects).
**Working tree:** clean after `phase-41: seed factory pilot — 2 portfolio-grade INTERMEDIATE projects`.
**Parent commit:** `e58438a` (Phase 40 close).

---

## Phase 41 summary

Ran the Phase 35 authoring spec end-to-end on **2 net-new INTERMEDIATE-tier portfolio-grade projects** that close the audit-confirmed Intermediate gap in two advanced-skewed courses. Pilot proves the Phase-35 contract scales beyond beginner/foundations (Phase 19/20) into intermediate complexity without expanding the contract.

**The 2 projects**

| Slug | Course | Distinct-from |
|---|---|---|
| `data-engineering-rest-api-elt-with-staging-marts` | data-engineering | Hand-rolled (no dlt) — deliberately complementary to the dlt-driven `data-engineering-api-to-warehouse-ingestion`. Learner builds the primitives dlt abstracts over. |
| `ai-engineer-llm-output-quality-scoring` | ai-engineer | Deterministic rubric + dimension scorers + 6-class failure taxonomy. Layer-below the CI-infrastructure `ai-engineer-llm-eval-harness`. |

Both: 5 steps · `intermediate` · 210min · 630 XP · `isMultiFile: true` · all steps machine-verifiable (zero `self_attest`) · full Phase 35 contract.

### Slug-collision recovery

Originally-proposed slugs (`api-to-warehouse-elt-pipeline`, `llm-evaluation-pipeline`) collided with already-visible advanced projects in the same courses. User approved the alternates above before authoring.

**What changed and why**

1. **2 new authored modules** in `scripts/src/authored/`. DE uses 5 distinct validation kinds (`json_equal`/`json_equal`/`sql_resultset`/`json_equal`/`contains`) across its heterogeneous extract→stage→mart→DQ→CLI pipeline. AI uses `json_equal`×5 across its homogeneous score-producing dimensions. Both ship full per-step pedagogy ladders (5 hints L1-L5 + success/failure/portfolio/final/misconception).
2. **Lineage wiring** in `authored-lineage.ts`: +2 entries in `COURSE_FOR_AUTHORED_SLUG` + new `SEED_FACTORY_FOR_SLUG_PHASE41` map (naming follows Phase 13 non-beginner precedent — not `BEGINNER_CANDIDATE_*` because these are intermediate) + +2 entries in `CANDIDATE_FOR_AUTHORED_SLUG`. Pinned UUIDs `d41a8b1c-…` / `e41b9c2d-…`.
3. **Barrel entries** in `authored/index.ts`: +2 imports + +2 entries in `AUTHORED_PROJECTS`.
4. **Candidate backfill** `scripts/src/backfill-phase41-candidates.ts` + `backfill:phase41-candidates` npm script. Synthesizes `project_candidates` rows with `source='phase41_seed_factory'`, `status='approved'`. Same shape as Phase 20: idempotent ensure-then-insert, candidateId-match assertion, "expected exactly 2 entries" guard.
5. **No `seed.ts` patch block.** Authored projects flow into the DB exclusively via `author:project promote <slug>` (project + steps + inverse-lineage stamp, all transactional). Pedagogy ships INSIDE each `AuthoredProject.steps[].pedagogy`, so `audit:pedagogy` sees both new projects fully-enriched without a `seed-pedagogy.ts` edit (Phase 7+ precedent). No grandfather patch block because these are net-new, not in-place upgrades.

**Files changed**

- New: `scripts/src/authored/data-engineering__rest-api-elt-with-staging-marts.ts`
- New: `scripts/src/authored/ai-engineer__llm-output-quality-scoring.ts`
- New: `scripts/src/backfill-phase41-candidates.ts`
- Edit: `scripts/src/authored-lineage.ts` (+3 blocks: course map, lineage map, candidate map)
- Edit: `scripts/src/authored/index.ts` (+2 imports, +2 list entries)
- Edit: `scripts/package.json` (+1 npm script)
- New: `docs/phases/phase-41-seed-factory-pilot.md`
- Edit: `docs/phases/INDEX.md` (+1 line)
- Edit: `replit.md` (Phase History prepend)
- Edit: this file (rewrite for P41)

**Hard stops respected:** zero schema · migration · production · deployment · `/check` · `/submit` · cert-verify · portfolio · billing · Stripe · OpenAPI · codegen · frontend-redesign · route · admin · archive-script · `enrolled_count` · rubric · taxonomy · anchor · AI-tutor-prompt · hint-route · learner-mode edits.

---

## Why these design choices

1. **Alternate-slug pivot before authoring.** Both originally-proposed slugs collided with already-visible advanced projects in the same courses. Re-authoring on top of approved alternates is cheap; authoring 600 lines and then discovering the collision is not.
2. **INTERMEDIATE for both.** The Phase 41 audit confirmed both courses are advanced-skewed with no intermediate bridge. Beginner is healthy (P19/20); advanced is healthy; intermediate is the gap.
3. **DELIBERATELY complementary, not redundant.** Each new project's `fullDescription` + `meta.scenario` + `readmeOutline` calls out *what its sibling advanced project covers and what it deliberately does NOT*. Reviewers and learners can tell the difference in 10 seconds.
4. **`SEED_FACTORY_FOR_SLUG_PHASE41`, not `BEGINNER_CANDIDATE_FOR_SLUG_PHASE41`.** P19/P20 maps were correctly named for their beginner-tier scope. These are intermediate; naming follows Phase 13's net-new non-beginner precedent so a future operator searching for "beginner backfill" doesn't get a false match.
5. **Mixed validation kinds for DE, uniform `json_equal` for AI.** DE's stages are heterogeneous — each has a distinct natural validation shape. AI's stages all emit score dicts; one consistent validator type is honest.
6. **All steps machine-verifiable (no `self_attest`).** Phase 35's `all-steps-self-attest` finding is the soft floor; the pilot pushes past it on every step (precedent set by dlt + several Phase 11/12B projects).
7. **No `seed.ts` patch block.** Promote transaction is the entire write path for net-new projects (no in-place upgrade needed).
8. **No `enrolled_count` touch.** Phase 38/39/40 invariants intact. New projects ship with `enrolled_count=0` and increment via the P39 writer on first enrollment.
9. **No frontend / API / OpenAPI / codegen changes.** Catalog listing, course detail, project detail, learner-mode play, AI tutor, hint route all source from `projects` + `project_steps` and pick up the 2 new rows automatically.

---

## Gates run (all green)

- `pnpm run typecheck` — OK
- `pnpm run check:no-heuristic-runtime` — OK
- `pnpm --filter @workspace/scripts run audit:authoring` — **58/58 visible publish-ready (+2)** from 56/56
- `pnpm --filter @workspace/scripts run audit:pedagogy` — **58/58 visible fully enriched (+2)** from 56/56
- `pnpm --filter @workspace/api-server run test` — 280/280 (unchanged)
- `pnpm --filter @workspace/atlas run test` — 102/102 (unchanged)
- `pnpm --filter @workspace/curriculum-quality run test` — 69/69 (unchanged)
- `pnpm --filter @workspace/execution-core run test` — 34/34 (unchanged)
- `pnpm --filter @workspace/api-server run test:integration` — 3/3 (unchanged)
- `backfill:phase41-candidates` — created=2 existing=0 total=2 (idempotent on re-run)
- `author:project promote` × 2 — both `inserted` cleanly with inverse-lineage stamp; anchor drift within ±1.0

---

## Remaining risks / known limitations

1. **Validators are contract-shaped, not full-execution.** Same Phase 7+ precedent: in-browser runner can't stand up Postgres or invoke `psycopg2`. Learners execute locally (`docker-compose up` in the repo); the validator checks printed JSON / CSV against declared expected fixtures.
2. **`replit.md` is large** (~8.5k tokens). System warning is persistent across phases. Phase 42 Shape A would address.
3. **No anchor-check coverage.** The two existing anchors gate every promote; both stayed within ±1.0 across the 2 P41 promotes. The new projects are not themselves anchors.
4. **Catalog total unchanged.** 103 total → 103 total (the 2 new projects entered with `inserted`, not as upgrades). 45 hidden / 58 visible.

---

## Recommended Phase 42 — three shapes

- **Shape A — Trim `replit.md`.** Move Phase History from `replit.md` into `INDEX.md` (already mirrored), keep only "latest 3" inline. Reduces context burn on every turn.
- **Shape B — Decommission `enrolled_count`.** Phase 40's deferred Shape A. Drop the column + replace 5 display routes with `count(*)`. Eliminates the denormalized-counter drift risk class outright.
- **Shape C — Continue the Seed Factory.** Two more advanced-skewed courses likely have similar Intermediate gaps (mlops-engineer, applied-llm-engineer); the Phase 41 pilot proved the pattern repeats cheaply.

---

## Where to look next

- Full Phase 41 close-out: [docs/phases/phase-41-seed-factory-pilot.md](docs/phases/phase-41-seed-factory-pilot.md)
- Phase 40 close-out (parent): [docs/phases/phase-40-enrollment-counter-finalization.md](docs/phases/phase-40-enrollment-counter-finalization.md)
- Phase 35 authoring contract (the spec P41 implements against): [docs/project-authoring-spec.md](docs/project-authoring-spec.md)
- Full chronological phase index: [docs/phases/INDEX.md](docs/phases/INDEX.md)
- Active invariants + 9-course list: [replit.md § Active Invariants / Gates](replit.md)
