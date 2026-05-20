# Phase 9 — Track-split decision: defer to Phase 10

## Question

Should we split the `de-core` track into per-course tracks now (one each for
`data-engineering`, `cloud-data-engineer`, `analytics-engineer`,
`python-libraries`, `sql`), or defer until Phase 10?

## Recommendation

**Defer to Phase 10.** Phase 9 leaves `COURSE_TO_TRACK_SLUG` unchanged.

## Rationale

1. **Cohort size is too small to justify a structural change.** Phase 9
   ships 8 projects (2 grandfather + 6 upgrade) across exactly 2 of the 5
   `de-core` courses (`data-engineering` and `cloud-data-engineer`). The
   other 3 courses (`analytics-engineer`, `python-libraries`, `sql`) have
   no Phase 9 deltas — splitting their tracks now would be churn without
   payoff.

2. **`is_primary` invariant gets risky during partial splits.** The
   `tracks.is_primary` partial unique index `(domain_id) WHERE is_primary`
   permits at most one primary per domain. If we split `de-core` into 5
   children, we must atomically pick which is primary AND re-stamp every
   existing project's `track_id`. Doing that for some courses but not
   others leaves the invariant in a half-migrated state that's harder to
   reason about than the current uniform model.

3. **The lookup contract is already split-ready.** `COURSE_TO_TRACK_SLUG`
   in `scripts/src/authored-lineage.ts` is keyed by course, so a future
   split is a one-file edit of the map plus a seed migration — no consumer
   code changes. The cost of deferring is zero.

4. **Phase 10 mass-author pass will produce the demand signal.** Until
   then, the 5-course → 1-track fan-in is a defensible "we haven't
   subdivided yet" position. Once analytics-engineer / python-libraries
   / sql each accumulate 10+ projects, the case for splitting will be
   self-evident and the migration scope will be well-defined.

## What this defers

- No new pg enum values, no new seed rows in `tracks`, no `is_primary`
  re-stamping.
- `COURSE_TO_TRACK_SLUG` stays at its Phase-8 values for all 9 courses.
- The Phase-9 batch-1 upgrades (4× `data-engineering`, 2×
  `cloud-data-engineer`) all promote into `de-core` like the existing
  Phase-7 cohort — same lookup path, same row shape.

## Trigger for revisiting

When **any single course** in `de-core` reaches ≥ 12 authored projects,
re-open this decision. At that point the per-course landing page UX value
crosses the migration cost.
