# Phase 23 — Workspace Auto-Resume / Step Deep-Link Support

**Status:** CLOSED · SHIP
**Scope:** Pure frontend overlay on `artifacts/atlas/src/pages/project-workspace.tsx`.
Closes the Phase-22-flagged gap where every workspace session started at step 0
regardless of saved progress or URL state.

## Problem

`project-workspace.tsx` initialized `currentStepIdx` with `useState(0)`, had no
`?step=N` URL parsing, no `popstate` listener, and never synced
`progress.currentStepPosition` back into the index. Returning learners always
landed on step 1, and shared/bookmarked deep-links were impossible.

## Solution

Three pieces, all frontend, all in `artifacts/atlas/src/`:

1. **`lib/workspaceStepUrl.ts` (new)** — single source of truth for the
   0↔1 indexing conversion between the server (`progress.currentStepPosition`,
   1-indexed), the URL (`?step=N`, 1-indexed for human-friendliness), and the
   UI (`currentStepIdx`, 0-indexed for array access). Exports:
   - `parseStepParam(search)` — strict positive-integer parse (rejects `0`,
     negatives, decimals, leading zeros, scientific notation, NaN).
   - `clampStepIdx(position, totalSteps)` — 1-indexed → 0-indexed with range
     clamping.
   - `idxToStepNumber(idx)` / `buildStepSearch(idx, existingSearch)` — the
     inverse, preserving any unrelated query params.
   - `resolveInitialStepIdx({ search, totalSteps, progressPosition, progressLoaded })`
     — the precedence rule: **URL → progress → null**. Returns `null` when
     we're still waiting (caller renders skeleton rather than flashing step 0).

2. **`pages/project-workspace.tsx` (edited)**
   - `currentStepIdx` is now `useState<number | null>(null)` with a
     `resumeAppliedRef` one-shot guard.
   - New `useEffect` resolves the initial step once `steps.length > 0` and
     either a URL `?step=` is present or progress has actually fetched. URL
     self-corrects via `replaceState` when we clamped out-of-range or seeded
     from progress with no URL.
   - `progressLoaded = enrolled ? progressFetched : enrollError !== null` —
     so a URL-less mount of an unenrolled project only resolves after
     enrollment actually completes (or errors). Earlier draft used
     `progressFetched || !enrolled` which fired immediately at mount (when
     `enrolled` is still `false`) and locked in step 0 before progress could
     load — defeating the whole point of the phase. (Architect round-1 catch.)
   - `popstate` listener re-clamps from URL on back/forward; missing/invalid
     params are intentionally ignored so back-button from a non-workspace
     page doesn't snap the learner back to step 0.
   - `goToStep(idx)` clamps via the helper and mirrors to URL via
     `replaceState` (NOT `pushState` — we don't model per-step history
     entries; back-button still exits the workspace).
   - Resume state (`resumeAppliedRef`, `currentStepIdx`) is reset on
     `project?.id` change inside the existing auto-enroll effect, so SPA
     navigation between two `/projects/:slug` routes without remount
     re-resolves resume for the new project. (Architect round-1 catch.)
   - The loading skeleton branch now also activates while
     `resumePending = !isLoading && project != null && currentStepIdx === null`,
     so we never paint step 0 over a learner's intended landing step.
   - `safeStepIdx = currentStepIdx ?? 0` is used for derived values only —
     the skeleton-pending branch prevents this fallback from ever painting.
     `StudioShell` + the post-submit auto-advance both use `safeStepIdx`.

3. **Tests**
   - `lib/workspaceStepUrl.test.ts` (new) — 15 pure-function unit tests
     covering parse strictness, clamp edge cases, search-string building, and
     all five precedence rows of `resolveInitialStepIdx` (URL wins, URL
     clamps, no-URL falls to progress, loading → null, no-progress → 0,
     totalSteps≤0 → null, invalid URL falls through to progress).
   - `pages/project-workspace.test.tsx` (new) — 3 component-level lifecycle
     tests for the exact regression the architect caught:
     1. Returning learner, no `?step=`, async enroll `onSuccess` +
        `isFetched: true` with `currentStepPosition: 3` → `StudioShell`
        lands on `data-step-idx="2"` and URL is rewritten to `?step=3`.
     2. `?step=999` wins over `currentStepPosition: 1` and clamps to last
        step (idx 4 / `?step=5` for a 5-step project).
     3. Enroll mutation pending + `isFetched: false` → `StudioShell` does
        NOT render (skeleton holds, no step-0 flash).

## Hard stops honored

- No schema changes.
- No server / API / OpenAPI / codegen changes.
- No content / authoring / rubric / anchor / archive / taxonomy changes.
- No Stripe / AI tutor / cloud-creds / PWA changes.

## Test counts

- api-server **192/192** (unchanged)
- curriculum-quality **60/60** (unchanged)
- execution-core **4/4** (unchanged)
- atlas **7 → 25/25** (+15 helper unit tests, +3 component lifecycle tests)
- **Total: 263 → 281/281** (floor was 267)

## Catalog invariants (unchanged)

- Visible **56**, hidden **32**, beginner **10**, zero-beginner courses **0**.
- `anchorCount=2`, anchor drift **0.00 / 0.00**.
- wave-report **54/54** passing.
- audit:pedagogy **56/56** visible.
- Lineage **0/0/0/0** (no orphans, no inverse mismatches).
- Rubric `v1.0.1` frozen, 9-course taxonomy intact.

## Architect

Round 1 → **FAIL** (resume gating fired before enrollment; project-change race
unhandled; helper-tests-only didn't cover the lifecycle).
Round 2 → **PASS** after gating fix + project-id reset + 3 lifecycle tests.

## Out of scope / not done

- Per-step `pushState` history entries (intentionally — back-button should
  exit the workspace, not walk backwards through steps).
- "URL-without-`step=` on popstate should re-resolve from progress" semantic
  — architect flagged as optional; not requested by product.
- Cross-project stale-callback hardening — enroll mutation could in theory
  resolve for a previous project after navigation; architect flagged as
  optional hardening, deferred.
