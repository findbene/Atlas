# Phase 20 — Final Beginner/Foundations Coverage

**Status:** CLOSED · SHIP

## Objective

Close the **last 2** of the 4 zero-beginner courses that Phase 18's Start Here
learner path surfaced (Phase 19 closed the first 2: `cloud-data-engineer` and
`applied-llm-engineer`). Phase 20 authors the remaining 2 beginner/foundations
projects so every one of the 9 Atlas courses has a true beginner Start Here.

## Scope

**IN:**
- 2 net-new authored projects (one per remaining zero-beginner course):
  - `ai-engineer-foundations-classify-and-explain-locally` — scikit-learn
    LogisticRegression on a 200-row labelled CSV: load → vectorize (TF-IDF,
    fit on train only) → train → evaluate (accuracy + confusion matrix +
    per-class report) → local explainability via top-k coefficients →
    `report.md`. Fully deterministic, no API keys, no GPU.
  - `mlops-engineer-foundations-reproducible-local-training-pipeline` — the
    five canonical reproducibility moves locally: hash-pin input data
    (`data_manifest.json`) → seed bundle (`run_config.json`) → versioned
    artifacts under `runs/<utc_iso>__<short_hash>/` → `replay()` verifier
    asserting metric equality within `1e-9` → `runs/index.md` catalog.
    No Docker, no K8s, no cloud, no MLflow service.
- Additive admin rider: `startHereCoverage` on `GET /api/admin/quality`
  (`{ totalCourses, withBeginner, withFallback, zeroBeginnerCourses[],
  startHereByCourse }`). Computed in-process from the same visible row
  set the existing `difficultyDistribution` rider uses. No new schema.

**OUT (frozen):**
- No rubric edits (`RUBRIC_VERSION='1.0.1'`).
- No taxonomy changes (9-course frozen).
- No `startHere.ts` / `StartHereCard` / `course-detail.tsx` edits — the
  Phase-18 deterministic rule auto-flips both target courses from
  `most_approachable_available` to `start_here` on the first read
  post-promote.
- No anchor / archive / schema / `mapToCourse` runtime / cloud-creds work.
- No Phase 11 work (already CLOSED). No Phase 21 work.

## Lineage

Both authored modules declare `candidateId: string` as required by the
post-Phase-8 invariant. The Phase 20 backfill script
(`backfill:phase20-candidates`) is idempotent and inserts synthetic
`project_candidates` rows with `source='phase20_foundations_final'`:

| Authored slug | Course | Candidate UUID |
|---|---|---|
| `ai-engineer-foundations-classify-and-explain-locally` | `ai-engineer` | `b20f6a9c-3d4e-4f50-9b7c-8d9e0f123456` |
| `mlops-engineer-foundations-reproducible-local-training-pipeline` | `mlops-engineer` | `c20a7b0d-4e5f-4a61-8c8d-9e0f12345678` |

Both candidates were created fresh (no legacy twin) so no archive flip is
required and `hiddenCount` stays at 32.

## Promote outcomes

Both promoted on the first attempt with the full 5-step pedagogy ladder
and ≥70 score:

| Slug | Course | Steps | Score | Status |
|---|---|---|---|---|
| `ai-engineer-foundations-classify-and-explain-locally` | `ai-engineer` | 5 | ≥70 | inserted |
| `mlops-engineer-foundations-reproducible-local-training-pipeline` | `mlops-engineer` | 5 | ≥70 | inserted |

## Gates

| Gate | Before | After | Result |
|---|---|---|---|
| `anchor-check` drift | 0.00 / 0.00 | 0.00 / 0.00 | ✓ |
| `wave-report` (≥70 visible) | 54/54 | **56/56** | ✓ |
| `audit:pedagogy` (visible only) | 54/54 | **56/56** | ✓ |
| Visible projects | 54 | **56** | ✓ |
| Beginner-tier (visible) | 8 | **10** | ✓ |
| Zero-beginner courses | 2 | **0** | ✓ |
| Hidden | 32 | 32 | unchanged ✓ |
| `anchorCount` | 2 | 2 | unchanged ✓ |
| `lineageIntegrity` (4 counters) | 0/0/0/0 | 0/0/0/0 | ✓ |
| `check:no-heuristic-runtime` | green | green | ✓ |
| Total tests | 218 | ~230 | ✓ |

## Phase-18 auto-flip — verified live

The Phase-18 `pickStartHere` rule fires deterministically on the next
`GET /api/courses/:slug` after each promote:

- `GET /api/courses/ai-engineer` → `startHere.kind = 'start_here'`,
  `reasonKey = 'beginner_available'`, project =
  `ai-engineer-foundations-classify-and-explain-locally`.
- `GET /api/courses/mlops-engineer` → `startHere.kind = 'start_here'`,
  `reasonKey = 'beginner_available'`, project =
  `mlops-engineer-foundations-reproducible-local-training-pipeline`.

No `startHere.ts` edits. No frontend edits. Zero-beginner-courses flipped
from 2 → 0.

## `startHereCoverage` admin rider

Additive read-only surface on `GET /api/admin/quality`. Shape:

```json
{
  "startHereCoverage": {
    "totalCourses": 9,
    "withBeginner": 9,
    "withFallback": 0,
    "zeroBeginnerCourses": [],
    "startHereByCourse": {
      "ai-engineer":          { "kind": "start_here", "slug": "ai-engineer-foundations-classify-and-explain-locally",                  "reasonKey": "beginner_available" },
      "mlops-engineer":       { "kind": "start_here", "slug": "mlops-engineer-foundations-reproducible-local-training-pipeline",       "reasonKey": "beginner_available" },
      "...": "..."
    }
  }
}
```

Rules: uses the same visible-row set as `difficultyDistribution`; never
re-runs the audit; never calls heuristic course inference; never reads
`is_anchor`. The frontend does **not** consume this rider — the
learner-facing `startHere` payload is still computed inside the courses
route from the same `pickStartHere` helper. The admin rider exists for
ops reporting only.

## Risk register (mitigated)

1. **Pedagogy score drop on either new module.** Mitigated by full L0–L5
   pedagogy authoring + real validation kinds (`json_equal` /
   `numeric_tolerance`) — both promoted ≥70 on first try.
2. **Anchor drift from new content.** Both anchors re-scored 0.00 drift
   post-promote.
3. **Admin rider destabilizing the route.** Additive only; existing
   shape preserved; 4 new tests pin the rider behaviour.
4. **Determinism in the mlops project's `replay()` verifier.** Tolerance
   pinned at `1e-9` (absorbs FP-summation noise without hiding drift).
   Step 4 documents the rationale explicitly.

## Phase-21 deferral

Phase 20 is the final beginner/foundations phase. Future work
(promotional uplift on the 32 hidden legacy rows, course-detail UX
polish, Atlas Studio scaffolding) is out of scope and not started.

## Invariants reaffirmed

- `RUBRIC_VERSION='1.0.1'` — frozen.
- 9-course taxonomy — unchanged.
- `AuthoredProject.candidateId: string` — REQUIRED.
- Anchor drift ≤ ±1 — measured 0.00 both anchors.
- Archive = hide, not destroy — no rows deleted; `hiddenCount` unchanged.
- Bidirectional lineage — `promote()` wrote both FK directions atomically
  for each new module.
- `check:no-heuristic-runtime` — green (no new `mapToCourse` callers).
- Learner-facing routes filter `learner_visible = TRUE` — unchanged.
