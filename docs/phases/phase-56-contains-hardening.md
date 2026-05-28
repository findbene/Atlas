# Phase 56 — `contains` Validation Hardening

**Status:** SHIPPED. Closed against R2 proposal as APPROVED by user.
**Parent:** Phase 55 (`0d89eb0` C2 promote → both C-series projects visible, catalog = 60).
**Scope tier:** narrow runtime hardening + authoring guard + audit advisory. No project content opt-in; no DB row changes; no frontend / route / OpenAPI / schema changes; no `/check` or `/submit` handler edits.

## Goal

Extend the `contains` validation kind so authors can express multi-needle AND/OR gates and case-insensitive matching, WITHOUT regressing any of the 29 live visible-catalog `contains` steps that exist today on a single `{needle}` or empty-config legacy shape. The runtime must stay byte-identical for those rows, malformed new-shape configs must fail closed (never silently pass), and the authoring side must reject the same malformed shapes at construction time so we don't ship a row that the runtime would refuse.

This phase deliberately ships ONLY the guardrails and the new code path — no existing or new project opts into `needles[]`/`match`/`caseInsensitive` in this phase. Phase 56 is the foundation; future phases (or net-new projects) may use the new fields once authors are comfortable.

## Hard stops

- Zero touches to: signed-envelope canary path, `/check` route handler, `/submit` route handler, `lib/execution-core`, schemas, migrations, OpenAPI / Orval codegen, env vars, deploys, cert / portfolio language, `RUBRIC_VERSION` (frozen at `1.0.1`), Phase 52 operator flip kit.
- Zero touches to any `csv_set_equal` / `sql_resultset` / `json_equal` / `numeric_tolerance` grader behavior — Phase 56 is `contains`-only.
- Zero project-row edits. No `learner_visible` flips. No existing step's `validation_config` is rewritten. C1 (`applied-llm-engineer-guardrails-and-structured-output-safety`) keeps its 7 `contains` steps on the legacy `{needle}` shape; no opt-in this phase.

## Semantics matrix (single source of truth)

| shape                                       | path             | behavior                                                              |
| ------------------------------------------- | ---------------- | --------------------------------------------------------------------- |
| `validationConfig === null/undefined`       | OUTER-FALLTHRU   | generic `{passed:true, "Step completed."}` — UNCHANGED (outer guard)  |
| `{}` (+ `expectedOutput`)                   | LEGACY-FALLBACK  | needle = `expectedOutput ?? ""` ; `submission.includes(needle)`       |
| `{ needle }`                                | LEGACY           | byte-identical to pre-Phase-56                                        |
| `{ needle, caseInsensitive: true }`         | LEGACY-CI        | lowercase both, includes                                              |
| `{ needles[] }` (no `match`)                | MULTI-ALL        | every needle found (default `"all"`)                                  |
| `{ needles[], match: "all" }`               | MULTI-ALL        | every needle found                                                    |
| `{ needles[], match: "any" }`               | MULTI-ANY        | ≥1 needle found                                                       |
| `{ needles[], caseInsensitive: true }`      | MULTI-CI         | combinator on lowercased strings                                      |
| `{ needle, needles[] }`                     | MULTI-\*         | **`needles` WINS**; `needle` ignored (audit advisory)                  |
| `{ needle, match: "any" }`  (no `needles`)  | LEGACY           | `match` SILENTLY IGNORED on legacy path (audit advisory)              |
| `{ caseInsensitive: "yes" }` (non-boolean)  | COERCE-FALSE     | coerced to `false` (no silent CI enablement)                          |
| `{ needles: [] }`                           | MALFORMED        | fails CLOSED with malformed feedback                                  |
| `{ needles: non-array \| non-string item }` | MALFORMED        | fails CLOSED                                                          |
| `{ needles[], match: "weird" }`             | MALFORMED        | fails CLOSED                                                          |
| `{ needles[].length > 16 }`                 | MALFORMED        | fails CLOSED (`CONTAINS_MAX_NEEDLES = 16`)                            |
| `{ needle: non-string }`                    | MALFORMED        | fails CLOSED                                                          |

**Fail-closed feedback:** `"Grading config is malformed — please report this step."`

**Critical invariant — preserve the outer guard:** the `contains` branch in `gradeSubmission` is gated on `step.validationType === "contains" && step.validationConfig`. The truthy-config check is what routes `null`/`undefined` configs to the generic fallthrough exactly as pre-Phase-56 did. Do NOT remove the `&& step.validationConfig` clause; doing so would route `null` configs into `matchContains` which would (intentionally) flag them as malformed — a behavior change.

## What landed

### Runtime grader

| File                                              | Change                                                                                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `artifacts/api-server/src/lib/grading.ts`         | Extracted `matchContains(config, submission, expectedOutput)` helper. Full semantics matrix in JSDoc. Outer `&& step.validationConfig` guard preserved verbatim. Exported for the BC audit script. |
| `artifacts/api-server/src/lib/grading.test.ts`    | +19 Phase-56 cases (BC null-config, BC empty-config, BC `{needle:''}`, multi-ALL pass/fail-with-named-missing, multi-ANY pass/fail-with-list, CI legacy, CI multi, needle+needles precedence (positive + negative), match-without-needles silently ignored (pass + fail), 6× malformed fail-closed including `{needles:[""]}` and `{needles:["ok",""]}` to enforce runtime↔authoring symmetry, CI non-boolean coercion (pass + negative)). Existing 5 contains tests untouched. |

**Test result:** `pnpm --filter @workspace/api-server test src/lib/grading.test.ts` → **32 / 32** (was 13; +19 Phase-56).
**Full api-server suite:** **417 / 417** (was 395; +22: 19 grader + 3 picked up elsewhere).

**Runtime↔authoring symmetry fix (post-architect-R1):** `matchContains` originally accepted empty-string entries in `needles[]` (only the type check `typeof n === "string"` was enforced). Architect flagged this as a P0 because `"".includes` is true for every submission, so `{needles:[""]}` would have been a silent always-pass gate — and the authoring guard already rejected it, creating asymmetry. The runtime now mirrors the authoring rule: every `needles[]` entry must be a non-empty string, otherwise the spec is treated as MALFORMED and fails closed. The legacy `{needle:""}` quirk remains the ONLY accepted empty-string asymmetry (preserved for BC; authoring guard blocks new projects from creating it).

### Authoring schema

| File                                                  | Change                                                                                                                                                                  |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/curriculum-quality/src/authoring.ts`             | `validationConfig()` now calls `assertValidContainsSpec(spec)` when `kind === "contains"`. Plain-TS guards (no Zod refinement — Zod has no warning channel). Exports `CONTAINS_MAX_NEEDLES = 16` and `ContainsSpec` type. Other kinds untouched (pass-through spec). |
| `lib/curriculum-quality/src/authoring.test.ts`        | +15 Phase-56 cases (5 accept legacy/new full/needles+match/needle+CI, 7 reject for each malformed shape, 3 explicitly verify the non-blocking shapes do NOT throw — these are advisory-only). |

**Test result:** `pnpm --filter @workspace/curriculum-quality test` → **108 / 108** (was 93; +15 Phase-56). Other 9 suites unchanged.

The authoring guard rejects the same malformed shapes the runtime grader rejects, plus a stricter rule: every entry in `needles[]` MUST be a non-empty string. The runtime allows the empty string (legacy quirk: `{needle:""}` passes for any submission, preserved for BC) but the authoring path never lets a new project ship a zero-length needle, since that would be a silent always-pass gate.

The guard DOES NOT reject the three non-blocking shapes (`needle + needles`, `match` without `needles`, `match: "any"`). Those are flagged by the audit advisory below — they are author-intent concerns, not safety concerns.

### Authoring audit advisories

| File                                            | Change                                                                                                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/src/audit-project-authoring.ts`        | New `ContainsAdvisory` type + `detectContainsAdvisories()`. Per visible step with `validation_type='contains'`, surfaces 3 advisory kinds: `needle-and-needles`, `match-without-needles`, `match-any`. NOT a `ProjectFinding`; NOT counted toward `publishReady`. Rendered as `· [advisory] step N contains: …` in `formatReport`. |

`audit:authoring` summary unchanged in shape: **60 / 60 visible publish-ready** (no opt-in this phase = zero advisories printed). The infrastructure is in place so Phase 57+ can surface intent concerns the moment a project opts into `needles[]`.

### Backward-compatibility audit (one-shot merge gate)

| File                                | Purpose                                                                                                                                                                                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/src/audit-contains-bc.ts`  | Read-only DB scan over every visible `validation_type='contains'` step. For 7 curated synthetic submissions per row (empty, whitespace, exact-needle, sandwiched, doubled, total-miss, upper-cased), asserts the new `matchContains` returns the SAME `{passed, feedback}` as a verbatim-inlined copy of the pre-Phase-56 grader. Exits non-zero on first mismatch. |
| `scripts/package.json`              | `audit:contains-bc` script entry.                                                                                                                                                                                                                                                                |
| `scripts/tsconfig.json`             | `rootDir: "src"` removed so the BC script can import `matchContains` from `artifacts/api-server/src/lib/grading.ts` (cross-package, but harmless under `--noEmit`).                                                                                                                              |

**Result on the live DB:**

```
=== Phase 56 — contains BC audit ===
Visible contains-using steps: 29
Steps checked:        29
Submissions checked:  203
BC mismatches:        0
BC PASS — 29 / 29 visible contains steps produce byte-identical legacy outcomes across 203 synthetic submissions.
```

This is the architect-cited BC proof. The script is one-shot, NOT a permanent vitest suite: it runs against project-content-specific DB rows that aren't stable across seed runs. Re-run before any future change to `matchContains`.

### Docs

| File                              | Change                                                                                                                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/validation-kind-matrix.md`  | `contains` row expanded with full Phase-56 spec (legacy fields + new fields + precedence + fail-closed) and pointer to this close-out.                                                              |
| `docs/phases/phase-56-contains-hardening.md` | This file.                                                                                                                                                                              |
| `docs/phases/INDEX.md`            | Phase 56 appended.                                                                                                                                                                                  |
| `HANDOFF.md`                      | Rotated. Phase 56 is now the live phase summary.                                                                                                                                                    |
| `replit.md`                       | Phase History rotated (Phase 56 in, Phase 53 out).                                                                                                                                                  |

## Gates (full run)

| Gate                                                                                | Result                                                       | Delta vs Phase 55                                                                          |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `pnpm run typecheck` (libs + 4 artifacts + `check:no-heuristic-runtime`)           | OK                                                           | unchanged                                                                                  |
| `pnpm --filter @workspace/api-server test`                                          | **417 / 417**                                                | +22 (19 new grader + 3 picked up elsewhere)                                                |
| `pnpm --filter @workspace/curriculum-quality test`                                  | **108 / 108**                                                | +15 Phase-56 authoring guard cases                                                         |
| `pnpm --filter @workspace/execution-core test`                                      | 83 / 83                                                      | unchanged                                                                                  |
| `pnpm --filter @workspace/atlas test`                                               | 150 / 150                                                    | unchanged                                                                                  |
| `pnpm --filter @workspace/scripts run audit:authoring`                              | **60 / 60 visible publish-ready**                            | unchanged (zero advisories printed — no opt-in this phase)                                 |
| `pnpm --filter @workspace/scripts run audit:pedagogy`                               | unchanged                                                    | unchanged                                                                                  |
| `pnpm --filter @workspace/scripts run audit:contains-bc` **(new)**                  | **29 / 29 byte-identical** across **203 submissions**       | NEW gate; required to be 0 mismatches before any future `matchContains` edit               |
| `pnpm --filter @workspace/scripts run check:no-heuristic-runtime`                   | OK                                                           | unchanged                                                                                  |
| Phase 52 status                                                                     | unchanged — operator flip kit prepared, flip NOT executed   | unchanged                                                                                  |

## User-accepted caveats

- **`contains` remains "thin" by design.** A substring check is not the same as semantic understanding; `match: "any"` is even thinner. Phase 56 makes the kind more expressive without claiming it became a stronger gate. The catalog-wide thinness of `contains` (carried over from Phase 55 and earlier) is unchanged.
- **No project opts in.** C1's 7 `contains` steps stay on the legacy `{needle}` shape. The architect-flagged option to convert C1's "list the 4 OWASP-LLM categories" step into a 4-needle `match: "all"` gate is deliberately deferred — it's a content edit, not infrastructure.
- **One-shot BC audit, not a CI gate.** `audit:contains-bc` is project-content-specific; it doesn't go into the `pnpm run typecheck` chain. Manually re-run before the next `matchContains` change.
- **`{needle:""}` legacy quirk preserved.** Empty-string needle still passes for any submission on the legacy path because removing that behavior would break BC. The authoring guard prevents new projects from creating this shape.
- **`scripts/tsconfig.json` `rootDir` removed.** Purely a logical constraint under `--noEmit`; removed so the BC script can statically import the production `matchContains`. `outDir` retained for consistency but unused by `tsc --noEmit`.

## Architect review

To be invoked at end of this commit. The BC proof (`audit:contains-bc` = 29 / 29) is the headline.

## Rollback

This phase is forward-compatible by construction. To revert:

1. Revert `artifacts/api-server/src/lib/grading.ts` to the pre-Phase-56 inline `contains` branch (one if-block, see git history). The legacy reference is preserved verbatim inside `scripts/src/audit-contains-bc.ts` for cross-check.
2. Revert `lib/curriculum-quality/src/authoring.ts` — remove `assertValidContainsSpec` call and helper.
3. Revert `scripts/src/audit-project-authoring.ts` — remove `ContainsAdvisory` + `detectContainsAdvisories` + the field on `ProjectReport`.
4. Delete `scripts/src/audit-contains-bc.ts` and the `audit:contains-bc` script entry.
5. Restore `rootDir: "src"` in `scripts/tsconfig.json`.
6. Drop the +19 grader tests and +15 authoring tests.

No DB row was changed by this phase; nothing to revert in data.
