# Phase 20 — Decision Brief (NOT IMPLEMENTED — awaiting approval)

**Status:** PLANNING ONLY. No code, schema, or content changes proposed in this document.

## Confirmed post-Phase-19 state

- Final Phase 19 commit: `89432f8` ("Phase-19 shipped") on `main`. Latest Replit checkpoint: `2ecf42d`.
- Working tree: clean.
- `docs/phases/phase-19-beginner-foundations-pilot.md` exists.
- `replit.md` Phase 19 = CLOSED · SHIP; Phase 20 = NOT STARTED.
- Catalog: 54 visible · 32 hidden · 6/1/45 beginner-int-adv · 8 beginner visible.
- Zero-beginner courses remaining: **`ai-engineer`**, **`mlops-engineer`**.
- Start Here state: cloud-DE = `start_here`, applied-LLM = `start_here`, ai-eng = `most_approachable_available`, mlops-eng = `most_approachable_available`.
- KPIs: wave 52/52 · pedagogy 54/54 visible · anchorCount 2 · drift 0.00 · lineage 0/0/0/0 · 218/218 tests.

---

## Option A — Complete beginner/foundations coverage for the final 2 zero-beginner courses

### 1. Goal
Author beginner/foundations projects for the last two zero-beginner courses so all 9 Atlas courses surface a true `start_here` recommendation.

### 2. Why it matters now
Phase 18 introduced an honest fallback (`most_approachable_available` + "beginner projects coming soon") specifically because 4 courses had no beginner. Phase 19 closed 2 of them. Leaving the last 2 perpetuates a sub-optimal landing experience for two highly-trafficked tracks (AI Engineer and MLOps) — the courses that learners arriving from generic "AI / ML jobs" intent are most likely to click first.

### 3. Expected learner impact
- 4/9 → 0/9 zero-beginner courses (every course gets a true "Start Here").
- A learner who clicks into AI Engineer or MLOps for the first time gets a beginner-safe local-only first project instead of "your most approachable option is `mlops-platform-feature-store-and-online-serving`" (currently — advanced).

### 4. Catalog-quality impact
- Visible 54 → 56; beginner 8 → 10; advanced unchanged at 45; int unchanged at 1.
- Wave-report 52/52 → 54/54 if both score ≥70 (target).
- Pedagogy 54/54 → 56/56 visible.

### 5. Risk level
**Medium-high** (highest of all options). AI Engineer and MLOps are objectively harder domains to make beginner-honest than cloud-DE (DuckDB) and applied-LLM (single-turn JSON output). Concrete fake-beginner failure modes to guard against:

- **AI Engineer** — tempting to slap "beginner" on what's really intermediate (e.g. fine-tuning, vector DB setup, agentic tool use). To be honestly beginner this needs to be **"AI Foundations"** framing, NOT "beginner AI engineering": something like *"Run a small classifier locally with scikit-learn and explain its predictions"* (train/test split, confusion matrix, simple model card). Local-only (no API keys, no GPU), portfolio-artifact = repo + README + model card markdown.
- **MLOps Engineer** — real MLOps requires serving infrastructure, monitoring, model registries — all multi-service. To be honestly beginner this needs to be **"MLOps Foundations"** framing: something like *"Reproducible local model training pipeline with versioned data + model artifact"* (mlflow local file backend OR pure Python + pickle + a small validation harness). Local-only, no Docker/K8s/cloud.

If either project drifts into anything that requires API keys, cloud creds, multi-process orchestration, or non-deterministic mock-LLM output, the scope has failed the beginner-honesty test and should be rejected.

### 6. Implementation complexity
Same shape as Phase 19 (proven pattern): 2 new authored modules, lineage map extension, `backfill:phase20-candidates` script, 2 promote + anchor-check loops, ~10 new route tests, docs. Estimate: ~1 session.

### 7. Likely files touched
- `scripts/src/authored/ai-engineer__foundations-<name>.ts` (NEW)
- `scripts/src/authored/mlops-engineer__foundations-<name>.ts` (NEW)
- `scripts/src/authored/index.ts` (register both)
- `scripts/src/authored-lineage.ts` (extend `COURSE_FOR_AUTHORED_SLUG`, `CANDIDATE_FOR_AUTHORED_SLUG`, new `BEGINNER_CANDIDATE_FOR_SLUG_PHASE20` map)
- `scripts/src/backfill-phase20-candidates.ts` (NEW, idempotent)
- `scripts/package.json` (register `backfill:phase20-candidates`)
- `artifacts/api-server/src/routes/projects-coverage-phase20.test.ts` (NEW)
- `docs/phases/phase-20-foundations-final-coverage.md` (NEW)
- `replit.md` (Current Phase Status + Phase History updates)

### 8. Required DB/schema changes
**None.** Pure additive content + lineage rows. Same as Phase 19.

### 9. Tests required
~10 tests mirroring `projects-coverage-phase19.test.ts`: slug reachability ×2, admin beginner=10 + course attribution ×2, anchorCount=2 unchanged, hidden=32 unchanged, visible 56, lineage clean, Start Here flip ×2.

### 10. Expected effect on metrics
| Metric | Before | After |
|---|---|---|
| Learner-visible | 54 | 56 |
| Hidden/archive | 32 | 32 |
| Pedagogy KPI | 54/54 | 56/56 |
| Wave-report | 52/52 | 54/54 |
| Difficulty distribution | 8/1/45 | 10/1/45 |
| Beginner coverage | 8 | 10 |
| Start Here flips | 7/9 `start_here` | **9/9 `start_here`** |
| Learner trust | High | Higher (no "coming soon" copy anywhere) |
| Product readiness | Catalog-complete-foundation | Same (no productization) |
| Implementation cost | — | ~1 session |

### 11. Stop conditions (halt the phase immediately if any trip)
- Any single promote scores <70.
- Anchor drift > ±1.0 on `csv-to-postgres-pipeline` or `dbt-data-models`.
- A project ends up needing an API key, cloud cred, GPU, Docker, K8s, or any external service to run.
- Mock-LLM determinism cannot be guaranteed (applied-LLM phase 19 used a deterministic mock — same standard required for AI Engineer).
- Wave 52/52 regresses anywhere.

### 12. Why this option should or should not be chosen
**For:** smallest scope that creates the largest learner-facing improvement — same proven pattern as Phase 19, finishes a clearly-scoped curriculum-coverage goal, eliminates the "coming soon" fallback entirely, and zero schema risk.

**Against:** AI Engineer and MLOps are genuinely harder to make honest-beginner than cloud-DE and applied-LLM. The fake-beginner failure mode is real and would damage learner trust more than the current honest fallback does. Mitigated by strict "foundations" framing + hard stop conditions, but the risk floor is higher than Phase 19.

---

## Option B — Product onboarding readiness

### 1. Goal
First-run onboarding flow: course enrollment, dashboard, resume behavior, recommended-first-project. Shift from catalog-building to learner-engagement.

### 2. Why it matters now
Catalog is now strong (54 visible · 8 beginners · 7/9 courses have a true Start Here). The current learner flow has no real "where do I start across all courses?" surface — Start Here is per-course only. There's no enrollment, no dashboard, no resume-where-you-left-off, no streak/progress.

### 3. Expected learner impact
**Very high** — first-time visitors get a personalized path, not "browse 9 courses and figure it out." Returning learners resume in one click instead of re-navigating.

### 4. Catalog-quality impact
None directly. Catalog stays at 54/32.

### 5. Risk level
**High.** This is genuinely a multi-phase product surface — onboarding alone usually breaks into: profile/goal capture, recommendation algorithm, enrollment data model, dashboard, resume API, progress visualization. Trying to ship all of it in one phase has historically been the riskiest pattern.

### 6. Implementation complexity
**High.** Schema additions (`user_course_enrollments`, possibly `user_onboarding_state`), new API routes, frontend dashboard, recommendation logic. 3–5 sessions minimum if scoped tightly; 8+ if scope creeps.

### 7. Likely files touched
- `lib/db/src/schema/*` — new `user_course_enrollments` table (+ migration)
- `artifacts/api-server/src/routes/enrollments.ts` (NEW), `dashboard.ts` (NEW)
- `artifacts/atlas/src/pages/dashboard.tsx` (NEW), `onboarding.tsx` (NEW)
- Many UI components, new hooks, new OpenAPI spec entries.

### 8. Required DB/schema changes
**Yes** — at least one new table (`user_course_enrollments`), possibly `user_onboarding_state`. First schema change since Phase 13.

### 9. Tests required
Tens of new tests across API + frontend + integration.

### 10. Expected effect on metrics
| Metric | Effect |
|---|---|
| Learner-visible / hidden / pedagogy / wave / difficulty / beginner / Start Here | **No change** |
| Learner trust | Significant uplift |
| Product readiness | Major step toward live product |
| Implementation cost | High (3–5 sessions) |

### 11. Stop conditions
- Any schema migration with non-trivial backfill cost.
- Recommendation logic creeps into ML/scoring territory.
- Scope expands to include streaks, achievements, or social features.

### 12. Why this option should or should not be chosen
**For:** catalog is strong enough to justify productization work; this is what real learners would notice next.
**Against:** too broad for one phase. Better split into sub-phases (B1 enrollment + dashboard, B2 onboarding flow, B3 recommendation). Premature without first finishing Option A — adding onboarding while 2 courses still say "coming soon" is awkward.

---

## Option C — Course/project card polish

### 1. Goal
Visual hierarchy improvements to course and project browsing: card clarity, step count/duration/difficulty/portfolio-artifact visibility, CTA wording.

### 2. Why it matters now
Phases 16 (badges/filters) and 18 (Start Here) added information density. The cards may now be over-loaded or under-organized.

### 3. Expected learner impact
Medium — incremental clarity improvement, no new capability. Possibly meaningful for first-impression conversion.

### 4. Catalog-quality impact
None — pure presentation.

### 5. Risk level
**Low** if scoped to existing components; **Medium** if redesign creeps in.

### 6. Implementation complexity
Low-medium. Frontend-only.

### 7. Likely files touched
`artifacts/atlas/src/components/ProjectCard.tsx`, `CourseCard.tsx`, related styles. No backend.

### 8. Required DB/schema changes
None.

### 9. Tests required
A few UI smoke tests; nothing API-side.

### 10. Expected effect on metrics
Catalog metrics unchanged. Learner trust marginally improved.

### 11. Stop conditions
- Scope expands beyond cards (full page redesign).
- Any change requires new API fields.

### 12. Why this option should or should not be chosen
**For:** low risk, visible improvement.
**Against:** harder to know it's the right next thing without learner feedback or analytics. Easy to over-invest in pixel polish before the catalog gap (Option A) is closed.

---

## Option D — Search/sort improvements

### 1. Goal
Catalog search + sort (by difficulty, recommended, duration, course, newest).

### 2. Why it matters now
54 visible projects is borderline. Phase 16's difficulty filter partially covers this.

### 3. Expected learner impact
Low-medium. 54 items is roughly the threshold where browse becomes painful, but the difficulty filter already cuts that meaningfully.

### 4. Catalog-quality impact
None.

### 5. Risk level
Low if client-side, medium if server-side.

### 6. Implementation complexity
Low-medium. Likely client-side only at this catalog size.

### 7. Likely files touched
`artifacts/atlas/src/pages/courses.tsx`, search component(s), possibly a small hook.

### 8. Required DB/schema changes
None (client-side filter over existing fetch).

### 9. Tests required
A few search/sort interaction tests.

### 10. Expected effect on metrics
Catalog metrics unchanged.

### 11. Stop conditions
- Scope expands to server-side full-text search (premature at 54 items).
- Sort options proliferate beyond 4–5.

### 12. Why this option should or should not be chosen
**For:** modest UX win, low risk.
**Against:** 54 items doesn't justify it strongly; the difficulty filter already handles the most common narrowing intent. Sort-by-Start-Here-rank is more interesting than sort-by-newest at this scale.

---

## Option E — Admin/reporting rider

### 1. Goal
Add `startHereCoverage` + extend `beginnerCoverageByCourse` on admin route.

### 2. Why it matters now
Admin lacks a single number for "how many courses have a real beginner Start Here vs. fallback." Phase 19 brief flagged this as deferred-but-easy.

### 3. Expected learner impact
Zero (admin-only).

### 4. Catalog-quality impact
Zero (read-only reporting).

### 5. Risk level
**Very low.** Single read-only counter computed from `projects` + `pickStartHere`.

### 6. Implementation complexity
**Very low.** 30 minutes to 1 hour. ~30 lines + 2 tests.

### 7. Likely files touched
`artifacts/api-server/src/routes/admin.ts`, `admin.test.ts`.

### 8. Required DB/schema changes
None.

### 9. Tests required
2–3 admin route tests.

### 10. Expected effect on metrics
All learner metrics unchanged. Adds 1 admin metric.

### 11. Stop conditions
- Scope expands beyond a single derived counter.

### 12. Why this option should or should not be chosen
**For:** trivial, low risk, gives a clean admin number that proves Option A's outcome.
**Against:** doesn't move any learner-visible metric. Better bundled with Option A than shipped standalone.

---

## Option F — Phase 20 pause / stabilization

### 1. Goal
No feature work; run a deeper stabilization audit (docs, scripts, test coverage, admin reports, dependency hygiene).

### 2. Why it matters now
20+ phases of high-velocity work have accumulated. Worth checking if anything has drifted.

### 3. Expected learner impact
None directly.

### 4. Catalog-quality impact
Indirect — could catch latent bugs.

### 5. Risk level
Very low.

### 6. Implementation complexity
Low (audit-only) or open-ended (depending on findings).

### 7. Likely files touched
Possibly many small touches; possibly none.

### 8. Required DB/schema changes
None.

### 9. Tests required
Possibly new test coverage for under-tested areas.

### 10. Expected effect on metrics
None expected.

### 11. Stop conditions
- Audit findings should be tracked separately from any fixes.

### 12. Why this option should or should not be chosen
**For:** the codebase is at a natural pause point.
**Against:** Phase 17 already did a closure-hardening pass; Phase 18 architect-passed; Phase 19 architect-passed. No specific evidence of accumulated debt. Stabilization without a known target tends to be open-ended. Better to wait until a specific concern surfaces.

---

## RECOMMENDATION — Phase 20 Scope

**Recommend: Option A bundled with Option E (admin rider).**

### Rationale (preference: smallest scope, largest learner-facing improvement)

- Option A is the **only option that closes a known curriculum gap** (`0/9 zero-beginner courses` is a clean, measurable end-state).
- Option A reuses the **proven Phase 19 pattern** end-to-end (lineage map → backfill → authored module ×2 → promote → anchor-check → route tests → docs). Same shape, low marginal risk.
- Option E is **30 min of work** and gives an admin-visible counter (`startHereCoverage`) that proves Option A landed cleanly. Bundling avoids a follow-up admin-only phase.
- Options B/C/D are all worthy but premature: B is too broad, C lacks learner-feedback signal, D doesn't move enough at 54 items.
- Option F is unjustified without a specific concern.

### Fake-beginner risk — how the recommendation mitigates it

The recommendation is conditional on both projects passing an honesty bar **before promote**:

- **AI Engineer Foundations** (proposed slug: `ai-engineer-foundations-classify-and-explain-locally`): scikit-learn `LogisticRegression` on a small built-in dataset (e.g. iris or 20-newsgroups subset, deterministic seed). 5 steps: load → train/test split → fit → confusion matrix → write a 1-page model card (markdown). Validation: `json_equal` on accuracy bucket, `contains` on model-card sections. Local-only, no API keys, no GPU, no network calls. Portfolio: repo + README + model_card.md.
- **MLOps Engineer Foundations** (proposed slug: `mlops-engineer-foundations-reproducible-local-training-pipeline`): pure-Python pipeline that pins data version (checksum), trains a tiny model, writes a versioned artifact + metrics JSON, then a smoke-test script that loads the artifact and asserts metrics within tolerance. 5 steps: data fingerprint → train script → artifact write → metrics write → reproducibility validator. Validation: `json_equal` on metrics-within-tolerance, `contains` on artifact manifest. Local-only, no Docker/K8s/cloud, no mlflow-server (file backend optional but not required).

If either of these proposed shapes feels stretched (i.e. the architect or a learner-perspective review judges them as "intermediate-in-disguise"), the project should be **rejected at planning time** and that course should stay in the honest fallback rather than ship a fake beginner.

### Exact scope

| # | Item | Type |
|---|---|---|
| 1 | Author `ai-engineer-foundations-classify-and-explain-locally` (foundations) | New authoring |
| 2 | Author `mlops-engineer-foundations-reproducible-local-training-pipeline` (foundations) | New authoring |
| 3 | Extend `authored-lineage.ts` (`COURSE_FOR_AUTHORED_SLUG`, `CANDIDATE_FOR_AUTHORED_SLUG`, new `BEGINNER_CANDIDATE_FOR_SLUG_PHASE20` map) | Metadata |
| 4 | `scripts/src/backfill-phase20-candidates.ts` (mirrors P19 pattern, `source='phase20_foundations_final'`) | New script |
| 5 | Register `backfill:phase20-candidates` in `scripts/package.json` | Metadata |
| 6 | `artifacts/api-server/src/routes/projects-coverage-phase20.test.ts` (~10 tests) | Tests |
| 7 | Admin `startHereCoverage: { totalCourses, withBeginner, withFallback, zeroBeginnerCourses }` on `GET /api/admin/quality` | API logic |
| 8 | 2 admin tests for `startHereCoverage` shape + values | Tests |
| 9 | `docs/phases/phase-20-foundations-final-coverage.md` | Docs |
| 10 | `replit.md` Current Phase Status + Phase History updates | Docs |

### Exact slugs / courses involved

| Course | Slug | Kind |
|---|---|---|
| `ai-engineer` | `ai-engineer-foundations-classify-and-explain-locally` | **foundations** (not "beginner AI engineering") |
| `mlops-engineer` | `mlops-engineer-foundations-reproducible-local-training-pipeline` | **foundations** (not "beginner MLOps") |

### Work breakdown by type
- **New authoring**: 2 modules (5 steps each, full pedagogyConfig, real validation, deterministic).
- **Frontend UX**: none.
- **API logic**: small admin route extension (`startHereCoverage` derived counter only).
- **Metadata/reporting**: lineage map + backfill script + admin counter.
- **Tests**: 1 new test file (~10 tests) + 2 admin tests.
- **Docs cleanup**: phase-20 doc + replit.md updates.

### Required files (NEW unless noted)
- `scripts/src/authored/ai-engineer__foundations-classify-and-explain-locally.ts`
- `scripts/src/authored/mlops-engineer__foundations-reproducible-local-training-pipeline.ts`
- `scripts/src/authored/index.ts` (modify — register both)
- `scripts/src/authored-lineage.ts` (modify — extend 2 maps + add BEGINNER_CANDIDATE_FOR_SLUG_PHASE20)
- `scripts/src/backfill-phase20-candidates.ts`
- `scripts/package.json` (modify — register backfill script)
- `artifacts/api-server/src/routes/admin.ts` (modify — add `startHereCoverage`)
- `artifacts/api-server/src/routes/admin.test.ts` (modify — 2 new tests)
- `artifacts/api-server/src/routes/projects-coverage-phase20.test.ts`
- `docs/phases/phase-20-foundations-final-coverage.md`
- `replit.md` (modify)

### Required scripts
- `pnpm --filter @workspace/scripts run backfill:phase20-candidates` (idempotent)
- `pnpm --filter @workspace/scripts run author:project -- promote <slug>` (×2)
- `pnpm --filter @workspace/scripts run author:project -- anchor-check` (after each promote)
- `pnpm --filter @workspace/scripts run author:project -- wave-report`
- `pnpm --filter @workspace/scripts run audit:pedagogy`
- `pnpm --filter @workspace/scripts run audit:difficulty-labels`

### Required tests
- 2 × `GET /projects/:slug` 200-reachability.
- 5 × admin regressions: `difficultyDistribution.visible.beginner=10`, course attribution, anchorCount=2 unchanged, hiddenCount=32 unchanged, visible 56.
- 2 × `GET /api/courses/:slug` Start Here `kind='start_here'` / `reasonKey='beginner_available'` for both new courses.
- 2 × admin `startHereCoverage` shape and values (9 total / 9 withBeginner / 0 withFallback / 0 zeroBeginnerCourses).
- Lineage integrity 0/0/0/0 preserved.

### Required reports (must produce after promotes)
- `pnpm run typecheck` (chains `check:no-heuristic-runtime`) — green.
- All 3 test suites — green (target ≥230 total).
- `wave-report` — 54/54.
- `audit:pedagogy` — 56/56 visible.
- `anchor-check` — drift 0.00 on both anchors.
- Live curl on both new course endpoints — `kind=start_here`.
- Live curl on `/api/admin/quality` — `startHereCoverage.withBeginner=9, withFallback=0, zeroBeginnerCourses=[]`.

### Final gates
| Gate | Target |
|---|---|
| Wave-report | 54/54 |
| Pedagogy visible | 56/56 |
| Visible / hidden | 56 / 32 |
| Difficulty distribution | 10 / 1 / 45 |
| Anchor count / drift | 2 / 0.00 |
| Lineage integrity | 0 / 0 / 0 / 0 |
| Tests | ≥230 / ≥230 |
| Typecheck + heuristic-runtime guard | green |
| `startHereCoverage.zeroBeginnerCourses` | `[]` |

### Expected final metrics
- Visible projects: **56** (was 54)
- Beginner-tier visible: **10** (was 8)
- Zero-beginner courses: **0** (was 2)
- Wave-report: **54/54**
- Pedagogy visible: **56/56**
- Test count: **~230** (was 218)
- All other invariants unchanged.

### Hard stop conditions (halt and re-plan)
- Either authored project scores **<70** on first promote.
- Anchor drift > **±1.0** on `csv-to-postgres-pipeline` or `dbt-data-models`.
- Either project requires a network call, API key, cloud cred, GPU, Docker, K8s, or non-deterministic mock.
- An architect or learner-perspective review judges either project as "intermediate-in-disguise" (fake-beginner) — that course should ship with no Phase 20 beginner and remain on honest fallback.
- Wave 52/52 regresses on any pre-existing project.
- Any new `mapToCourse` runtime call appears outside the 4-file allowlist.

### Out-of-scope boundaries (explicit)
- **No** schema changes / migrations.
- **No** rubric edits; `RUBRIC_VERSION` stays at `1.0.1`.
- **No** edits to `pickStartHere` / `startHere.ts` / `StartHereCard` / `DifficultyFilter` / `DifficultyBadge` / `course-detail.tsx`.
- **No** mutation of existing project difficulty labels.
- **No** archive flips (`learner_visible` writes are zero net).
- **No** new anchors; no anchor recalibration.
- **No** edits to `csv-to-postgres-pipeline` or `dbt-data-models`.
- **No** changes to candidateId requirement.
- **No** changes to the 9-course taxonomy.
- **No** row deletes.
- **No** cloud credential touches.
- **No** Stripe / AI tutor / Atlas Studio / onboarding / dashboard work.
- **No** new front-end components.

---

## What I would do next if approved

Exact first 10 implementation steps (NOT EXECUTED):

1. **Validate beginner-honesty of both proposed shapes** by drafting the 5-step skeleton for each (titles + 1-line objectives only — no full step bodies yet) and self-reviewing for hidden complexity. If either skeleton needs network calls, API keys, GPU, multi-service orchestration, or non-deterministic outputs, reject that project and proceed with only the other (or abort the phase if both fail).
2. **Pick frozen candidate UUIDs** for both slugs (one per slug) and add them to `scripts/src/authored-lineage.ts` under a new `BEGINNER_CANDIDATE_FOR_SLUG_PHASE20: Record<string, string>` map, mirroring the Phase 19 structure.
3. **Extend** `COURSE_FOR_AUTHORED_SLUG` and `CANDIDATE_FOR_AUTHORED_SLUG` in `authored-lineage.ts` with both new entries.
4. **Create** `scripts/src/backfill-phase20-candidates.ts` (copy Phase 19 pattern; change `source` to `'phase20_foundations_final'`; assert exactly 2 entries; idempotent on `findFirst` by candidate ID).
5. **Register** `backfill:phase20-candidates` in `scripts/package.json`.
6. **Run** `pnpm --filter @workspace/scripts run backfill:phase20-candidates` and verify exactly 2 candidate rows are created.
7. **Author** `scripts/src/authored/ai-engineer__foundations-classify-and-explain-locally.ts` — 5 steps, full pedagogyConfig, real validation only, `portfolioArtifact.kind='repo'`, `course='ai-engineer'`, `difficultyLevel='beginner'`, `candidateId` from the new map.
8. **Register** the new module in `scripts/src/authored/index.ts`.
9. **Promote and anchor-check**: `pnpm --filter @workspace/scripts run author:project -- promote ai-engineer-foundations-classify-and-explain-locally` then `anchor-check`. **HALT** if score <70 or drift > ±1.0.
10. **Repeat steps 7–9 for the MLOps Foundations module.** Then proceed to admin `startHereCoverage`, tests, and docs.

(Steps 11+: admin rider, tests, full gate run, docs, architect review.)

---

**END OF BRIEF. Awaiting approval before any Phase 20 implementation.**
