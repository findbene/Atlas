# Atlas Project — Publish-Readiness Checklist

> Use this BEFORE flipping `learner_visible = true` on any new project.
> Companion to [`docs/project-authoring-spec.md`](../project-authoring-spec.md) and [`docs/templates/project-template.md`](./project-template.md).
>
> Every gate is binary. If ANY gate is unchecked, the project is NOT publish-ready.

---

## Project: `<slug>` · Course: `<course>` · Difficulty: `<beginner | intermediate | advanced>`

Reviewer: `<name>`  ·  Date: `<YYYY-MM-DD>`  ·  Promote commit: `<git sha or "pending">`

---

## A. Identity & lineage

- [ ] `slug` is globally unique and follows `<course>-<descriptor>` convention.
- [ ] `course` ∈ the 9 Atlas courses; slug prefix matches.
- [ ] `candidateId` is a real `project_candidates.id` (not a placeholder).
- [ ] Slug → course pinned in `scripts/src/authored-lineage.ts` (`COURSE_FOR_AUTHORED_SLUG`).
- [ ] Slug → candidate UUID pinned in `scripts/src/authored-lineage.ts` (`CANDIDATE_FOR_AUTHORED_SLUG`).
- [ ] `course_source` will be `'authored'` after promote (not `'heuristic_legacy'`).
- [ ] `tags[0]` equals the course slug.

## B. Scenario & framing

- [ ] `meta.scenario` names a concrete role + concrete workplace pain (not generic "you are a data engineer").
- [ ] `meta.hiringRelevance2026` calls out the SPECIFIC 2026 hiring signal (not "useful skill").
- [ ] `meta.readmeOutline` has ≥4 h2 sections (Overview, Setup, Steps, Validation minimum).
- [ ] `fullDescription` sets the scene without spoiling the steps.

## C. Step structure

- [ ] `steps.length >= 4`.
- [ ] Every `stepNumber` is unique and 1-indexed (1, 2, 3, …).
- [ ] Every step has a `title`, `instructionMd`, `learningObjective`, `requiredSkill`.
- [ ] Step titles are action-oriented and scannable.
- [ ] No step is a no-op or filler.

## D. Validation — every step has a verifiable path

- [ ] Every step has a `validationType` ≠ `self_attest`, OR a justified `self_attest` with an author comment.
- [ ] **At least one step in the project is machine-verifiable** — i.e. NOT every step is `self_attest`. (Enforced by `audit:authoring` as `all-steps-self-attest`.)
- [ ] Every step has `validation.spec` non-empty (enforced by `assertAuthoredProjectComplete`).
- [ ] Every step has `expectedOutputs` non-empty (enforced by `assertAuthoredProjectComplete`).
- [ ] `expectedOutputs` is **deterministic** — no timestamps, no random IDs, no environment-dependent values.
- [ ] Validation kind matches the data shape (csv_set_equal for unordered, csv_ordered for ordered, etc.).
- [ ] Walked each step end-to-end against the live runner once: `[ ]`.

## E. Hint ladder — all 5 levels, no leakage

- [ ] Every step has `hintLevel1` through `hintLevel5` populated (non-empty strings).
- [ ] **L1–L4 do NOT paste the literal expected output anywhere.**
- [ ] **L1–L4 do NOT paste a copy-paste-able final answer.**
- [ ] L5 may show "almost-solution shape" — verified it is NOT a complete answer.
- [ ] `failureFeedback` does NOT echo the literal expected fixture; describes the failure mode.
- [ ] `successFeedback` celebrates the right thing.
- [ ] `portfolioRelevance` (per step) is one concrete sentence; no Atlas marketing.

## F. Ada tutor context (Phase 34)

- [ ] Every step's `learningObjective` is concrete enough that Ada has a real teaching target (not "do this step").
- [ ] Every step's `requiredSkill` names the specific API / concept (not "code").
- [ ] The hint ladder, when read top-to-bottom, would not embarrass Ada in any of the 4 modes.
- [ ] Mentally simulated an `independent` learner failing the step: would the dampened-diff remediation + tutor's `diagnostic-only` boundary still feel helpful? `[ ]`

## G. Mode compatibility (Phase 32/33)

- [ ] **Guided mode:** hint ladder reads continuously L1 → L5 without leaving conceptual gaps.
- [ ] **Hint mode:** L5 stops short of a full answer.
- [ ] **Independent mode:** `instructionMd` alone is sufficient — verified by reading instructions WITHOUT looking at hints.
- [ ] **Adaptive mode:** L1–L3 are conservative enough not to trigger rescue prematurely.
- [ ] Long-instruction disclosure (P33) considered: very long instructions are organized with subheadings so collapse-for-independent is graceful.

## H. Difficulty alignment (spec §7)

- [ ] `difficulty` label matches the calibration table:
  - **beginner:** ≤180min, 4–5 steps, no cloud / Docker / API-key dependencies.
  - **intermediate:** 180–360min, 5–8 steps, one local external system at most.
  - **advanced:** 360+min, 6–10 steps, multi-system orchestration acceptable.
- [ ] `estimatedMinutes >= 60` (realism scorer threshold).
- [ ] Self-walked time ≤ `estimatedMinutes × 1.5`.

## I. Hidden costs & environment

- [ ] No hidden paid dependency. If there is one (OpenAI key, Snowflake trial, cloud account), it is disclosed BOTH in `meta.scenario` AND `fullDescription`.
- [ ] No required local install beyond what Atlas's browser environment + Pyodide provide, UNLESS:
  - disclosed explicitly; AND
  - difficulty is `intermediate` or `advanced`; AND
  - `meta.scenario` calls it out in plain language.
- [ ] No reliance on the public internet beyond explicitly-listed datasets / package CDNs.

## J. Portfolio + recruiter signal

- [ ] `portfolio.deliverable` lists CONCRETE artifacts (filenames, table names, endpoints) — no vague "a working pipeline".
- [ ] `portfolio.portfolioRelevance` is ≥20 chars and recruiter-readable.
- [ ] `portfolio.repoUrl` (if set) uses `<your-handle>` placeholder so the learner forks it.
- [ ] GitHub README seed copy (template §11) is ≤120 words and free of Atlas marketing language.
- [ ] LinkedIn seed copy (template §12) is humble + concrete + link-friendly.

## K. Rubric compatibility

- [ ] `assertAuthoredProjectComplete(project)` passes — this is a **runtime** check, not a typecheck-time one. It is invoked by the promote flow (`pnpm --filter @workspace/scripts run author:project`) before the DB write; run promote (or invoke the assert directly in a quick unit test) to actually exercise it.
- [ ] No proposal to change `RUBRIC_VERSION` (frozen at `1.0.1`).
- [ ] No proposal to weaken any quality gate.
- [ ] `is_anchor` left `false` unless this project is being intentionally seeded as a rubric anchor (rare; coordinate with rubric owner).

## L. Static audits (run BEFORE flipping `learner_visible`)

- [ ] `pnpm --filter @workspace/scripts run audit:authoring` reports this slug as **publish-ready** (no missing fields, no leaks flagged).
- [ ] `pnpm --filter @workspace/scripts run audit:pedagogy` shows this slug under "fully enriched" (5/5 per step).
- [ ] `pnpm --filter @workspace/scripts run audit:difficulty-labels` does not flag this slug.
- [ ] `pnpm run typecheck` clean (validates the `AuthoredProject` static type — note: typecheck does NOT run `assertAuthoredProjectComplete`; that runtime gate is exercised by the promote flow per §K above).
- [ ] `pnpm run check:no-heuristic-runtime` OK (allowlist unchanged).

## M. Existing tests still green

- [ ] `pnpm --filter @workspace/execution-core run test`
- [ ] `pnpm --filter @workspace/api-server run test`
- [ ] `pnpm --filter @workspace/atlas run test`
- [ ] `pnpm --filter @workspace/api-server run test:integration` (the `/submit` concurrency suite — should never regress when adding content)

## N. Final manual sign-off

- [ ] Walked the project end-to-end as a real learner once, in each of the 4 modes: `[ ] guided  [ ] hint  [ ] independent  [ ] adaptive`.
- [ ] Triggered `/check` at least once per step (preview, no XP write).
- [ ] Triggered `/submit` at least once per step (graded, XP write).
- [ ] Verified the cert is issued on completion and `/api/verify/:certId` shows correct evidence.
- [ ] Verified the project appears correctly in the catalog, dashboard, and (post-completion) the portfolio surface.

---

## Decision

- [ ] **PUBLISH** — flip `learner_visible = true`. All gates above are checked.
- [ ] **HOLD** — gaps listed below; fix and re-review.

### Open gaps (if HOLD)

1. <…>
2. <…>

---

**Reviewer signature:** `<name>` · `<YYYY-MM-DD>`
