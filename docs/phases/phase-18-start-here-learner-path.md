# Phase 18 — Start Here Learner Path

**Status:** CLOSED · SHIP

**Predecessor:** Phase 17 closure-hardening (checkpoint `8a8c306`) — `mergeQualityBreakdown` helper + 6 regression tests, wave-report 50/50, 192/192 tests.

## Goal

Convert the now-trusted content/difficulty foundation (Phases 14–17) into learner-facing first-project guidance. Help a new learner know *which* project to click first on every course page, using only existing visible-project metadata. No DB writes, no authoring, no rubric/anchor edits.

## Scope (Option A from the Phase 18 decision brief)

- Rule-based "Start Here" recommendation card surfaced on `/courses/:slug`.
- For courses with at least one beginner project → "Start Here" card with the best beginner pick.
- For the 4 zero-beginner courses (`ai-engineer`, `cloud-data-engineer`, `applied-llm-engineer`, `mlops-engineer`) → honest "Most approachable project available" card with the gentlest visible project + copy that explicitly says beginner projects are coming soon. Never re-labels an advanced project as beginner-friendly.
- Stable across difficulty-filter toggles (computed from the unfiltered visible set, not the filter result).

## Out of scope (per brief)

- No new authored projects (deferred to Phase 19 if approved).
- No difficulty relabeling, no rubric edits, no anchor recalibration.
- No DB schema changes, no archive/delete, no new tables, no new columns.
- No search, no sort, no AI-driven recommendation, no onboarding/auth/payment changes.
- No internal metadata exposure (`is_anchor`, `course_source`, `learner_visible`, quality breakdown).

## Recommendation rule (pickStartHere)

Pure deterministic function in `artifacts/api-server/src/lib/startHere.ts`:

1. **Difficulty ranking:** beginner > intermediate > advanced. Pick the lowest-ranked tier that has at least one visible project.
2. **Within that tier — approachability signal:** prefer projects whose slug or title contains `beginner`, `foundations`, `essentials`, `intro`, or `getting-started` (case-insensitive substring match).
3. **Tie-break:** lower `estimatedHours` ASC, then fewer `stepCount` ASC, then `slug` ASC for full stability.
4. **Result shape:**
   - `project`: the recommended project (public `ProjectSummary` fields only).
   - `kind`: `start_here` if a beginner exists in the course, else `most_approachable_available`.
   - `reasonKey`: `beginner_available` or `no_beginner_available`. Frontend renders human copy from this key.
   - `hasBeginner`: convenience boolean for the frontend.

The helper signature **does not accept** `is_anchor` or any internal flag. The route layer also calls `toSummary` before passing rows to the helper, so internal fields can't reach the recommendation even at runtime.

## UI surfaces updated

| Surface | Change |
|---|---|
| `GET /api/courses/:slug` | Response gains nullable `startHere` object. Difficulty filter moved to in-memory (single unfiltered visible-set fetch feeds both the filtered project list AND `startHere`). |
| `lib/api-spec/openapi.yaml` | Additive `startHere` field on `CourseDetail` + new `StartHereRecommendation` schema. |
| `artifacts/atlas/src/components/StartHereCard.tsx` (new) | Card with Sparkles/Compass icon, course-appropriate heading, project title, real `DifficultyBadge`, honest fallback copy, CTA button. |
| `artifacts/atlas/src/pages/course-detail.tsx` | Renders `StartHereCard` above `DifficultyFilter` when `course.startHere !== null`. |

## Behavior matrix

| Course has beginner? | Card heading | Body copy | Difficulty badge | CTA |
|---|---|---|---|---|
| Yes | "Start Here" | "Best first project for this course." | Beginner (green) | "Start this project" |
| No (the 4 zero-beginner courses) | "Most approachable project available" | "Beginner projects for this course are coming soon. This is the gentlest available starting point for now." | The project's actual badge (typically Advanced) | "View project" |
| Zero visible projects (defensive) | Card hidden | — | — | — |

## Tests added

**Helper (10 tests in `artifacts/api-server/src/lib/startHere.test.ts`):**
- null on empty input
- picks beginner when one exists → `kind=start_here`
- approachability signal beats raw `estimatedHours` tie-break
- tie-break order: hours → steps → slug ASC
- zero-beginner course → falls back to lowest available difficulty, `kind=most_approachable_available`
- all-advanced course → gentlest advanced
- stable across input reordering (determinism)
- ignores unknown difficulty values (defensive)
- returns null if every project has an unknown difficulty
- works on the minimal public-facing shape (no anchor metadata required)

**Route (6 new tests + 3 adapted from Phase 16 in `artifacts/api-server/src/routes/courses.test.ts`):**
- `kind=start_here` for a course with at least one beginner project
- `kind=most_approachable_available` for a zero-beginner course
- `startHere` is stable across difficulty filter changes (computed from unfiltered set)
- `startHere` is null when the course has zero visible projects
- `startHere` never exposes anchor / internal flags
- `startHere` prefers approachability-signaled beginner
- Phase 16 SQL-shape tests adapted: SQL stays 2-predicate; difficulty now applied in-memory; `learner_visible=true` invariant preserved.

## Gates

| Gate | Result |
|---|---|
| `pnpm run typecheck` | PASS |
| `check:no-heuristic-runtime` | PASS |
| api-server tests | **144/144** (128 prior + 16 new) |
| curriculum-quality tests | 60/60 (unchanged) |
| execution-core tests | 4/4 (unchanged) |
| atlas typecheck | PASS |
| `author:project wave-report` | **50/50** (unchanged) |
| `author:project anchor-check` | drift 0.00 on both anchors (unchanged) |
| `audit:pedagogy` (visible) | **52/52** (unchanged) |
| `audit:difficulty-labels` | 0 mismatches, anchor immutability 0 (unchanged) |
| Architect verdict | **PASS** — no critical findings |

**Total tests: 208/208** (192 prior + 16 new — 10 helper + 6 route).

## Invariants — all unchanged

| Metric | Before | After |
|---|---|---|
| Visible projects | 52 | **52** |
| Hidden projects | 32 | **32** |
| Difficulty distribution (beg/int/adv) | 6 / 1 / 45 | **6 / 1 / 45** |
| Anchor count | 2 | **2** |
| Anchor drift | 0.00 | **0.00** |
| Wave-report | 50/50 | **50/50** |
| Pedagogy (visible) | 52/52 | **52/52** |
| Lineage failure modes | 0 / 0 / 0 / 0 | **0 / 0 / 0 / 0** |
| 9-course taxonomy | intact | **intact** |
| Rubric version | v1.0.1 frozen | **v1.0.1 frozen** |

## Files changed

- `artifacts/api-server/src/lib/startHere.ts` — new helper.
- `artifacts/api-server/src/lib/startHere.test.ts` — 10 unit tests.
- `artifacts/api-server/src/routes/courses.ts` — wired helper into `GET /courses/:slug`; difficulty filter moved to in-memory.
- `artifacts/api-server/src/routes/courses.test.ts` — 6 new Phase-18 tests; 3 Phase-16 SQL-shape tests adapted to the in-memory-filter contract.
- `lib/api-spec/openapi.yaml` — additive `startHere` on `CourseDetail` + new `StartHereRecommendation` schema.
- `lib/api-client-react/src/generated/api.ts` (regenerated)
- `lib/api-zod/src/generated/api.ts` (regenerated)
- `artifacts/atlas/src/components/StartHereCard.tsx` — new presentational component.
- `artifacts/atlas/src/pages/course-detail.tsx` — render the card above the difficulty filter.

## DB writes performed

**Zero.** No migrations, no schema changes, no data mutations.

## Implementation note — in-memory difficulty filter

Phase 16 pushed the difficulty filter into the SQL `WHERE` clause. Phase 18 keeps the SQL predicate at the 2-predicate form `(course, learner_visible)` and applies the difficulty filter in-memory after a single fetch. This was the cleanest way to ensure `startHere` always reflects the full course (not the filtered subset). The 52-row catalog makes the in-memory pass trivially fast. The `learner_visible = TRUE` invariant from Phase 10/11 is preserved unchanged — only the difficulty layer moved.

## Closure

Phase 18 converted the clean content/difficulty foundation into learner-facing first-project guidance. **Phase 19 not started** — any further work (e.g. Option B beginner authoring for the 4 zero-beginner courses) requires explicit approval.
