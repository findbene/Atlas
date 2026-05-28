# HANDOFF

**Latest shipped phase:** Phase 56 — `contains` Validation Hardening (runtime + authoring guard + audit advisory + BC proof). **No project opted in; legacy rows untouched.**
**Working tree:** clean after Phase 56 commit (this commit). Visible catalog count: 60 (unchanged from Phase 55).
**Parent commit chain:** Phase 56 ← Phase 55 (C2 visible) ← `0d89eb0` (C2 promote) ← `f12fe95` (C1 promote) ← `82e473d` (phase-54) ← `b0667ec` (phase-53) ← `efa4ddf` (phase-52 operator kit) ← `27e70c6` (phase-51) ← `5278fec` (phase-50).

**Phase 52 status (unchanged):** operator flip kit prepared; the production flip has NOT been executed by the agent. Phase 56 is `contains`-only runtime hardening, NOT the 10% ramp evaluation; touches none of the canary path's prerequisites.

---

## Phase 56 summary

Phase 56 hardens the `contains` validation kind so authors can express multi-needle AND/OR gates and case-insensitive matching, without regressing any of the 29 live visible-catalog `contains` steps that exist today on a legacy single-`{needle}` or empty-config shape. The runtime stays byte-identical for those rows; malformed new-shape configs fail CLOSED; the authoring side rejects the same malformed shapes at construction time. Three non-blocking author-intent concerns surface as audit advisories (NOT findings). No existing or new project opts into `needles[]`/`match`/`caseInsensitive` in this phase — Phase 56 is the foundation only.

See `docs/phases/phase-56-contains-hardening.md` for the full semantics matrix and rollback steps.

### What landed — files

| File | Change |
|---|---|
| `artifacts/api-server/src/lib/grading.ts` | Extracted `matchContains(config, submission, expectedOutput)` helper. Full Phase-56 semantics matrix in JSDoc. Outer `&& step.validationConfig` guard preserved verbatim so null/undefined configs still fall through to generic "Step completed.". Exported for the BC audit script. |
| `artifacts/api-server/src/lib/grading.test.ts` | +19 Phase-56 cases (BC null/empty/`{needle:''}`, multi-ALL pass/fail-with-named-missing, multi-ANY pass/fail-with-list, legacy CI + multi CI, needle+needles precedence positive+negative, match-without-needles silently ignored pass+fail, 6× malformed fail-closed including the runtime↔authoring symmetry pair `{needles:[""]}` + `{needles:["ok",""]}`, CI non-boolean coercion pass+negative). |
| `lib/curriculum-quality/src/authoring.ts` | `validationConfig()` calls new `assertValidContainsSpec(spec)` when `kind==='contains'`. Plain-TS guards (no Zod refinement — Zod has no warning channel). Exports `CONTAINS_MAX_NEEDLES=16` + `ContainsSpec`. Other kinds untouched. |
| `lib/curriculum-quality/src/authoring.test.ts` | +15 Phase-56 cases. |
| `scripts/src/audit-project-authoring.ts` | New `ContainsAdvisory` + `detectContainsAdvisories()`. Surfaces 3 advisory kinds per visible step: `needle-and-needles`, `match-without-needles`, `match-any`. NOT a `ProjectFinding`; NOT counted toward `publishReady`. |
| `scripts/src/audit-contains-bc.ts` | NEW one-shot BC audit. 7 curated submissions × every visible `contains` step. Inlines verbatim copy of pre-Phase-56 grader as reference. Exits non-zero on first mismatch. |
| `scripts/package.json` | `audit:contains-bc` script entry. |
| `scripts/tsconfig.json` | Removed `rootDir: "src"` so BC script can statically import the production `matchContains` (cross-package; safe under `--noEmit`). `outDir` retained but unused. |
| `docs/validation-kind-matrix.md` | `contains` row expanded with full Phase-56 spec. |
| `docs/phases/phase-56-contains-hardening.md` | NEW close-out. |
| `docs/phases/INDEX.md` | Phase 56 appended + latest-pointer rotated. |
| `replit.md` | Phase History rotated (Phase 56 in, Phase 53 out). |

Zero touches to: signed-envelope canary path, `/check`, `/submit`, `lib/execution-core`, other validation-kind graders (`json_equal`, `numeric_tolerance`, `csv_set_equal`, `sql_resultset`, `regex`, `exact`, `self_attest`), schemas, migrations, OpenAPI / Orval codegen, env vars, deploys, cert / portfolio language, `RUBRIC_VERSION` (frozen `1.0.1`), Phase 52 operator flip kit, project rows, project step rows, `learner_visible` flags.

### Gates

| Gate | Result | Delta vs Phase 55 |
|---|---|---|
| `pnpm run typecheck` (libs + 4 artifacts + `check:no-heuristic-runtime`) | OK | unchanged |
| `pnpm --filter @workspace/api-server test` | **417 / 417** | +22 (19 grader + 3 elsewhere) |
| `pnpm --filter @workspace/curriculum-quality test` | **108 / 108** | +15 |
| `pnpm --filter @workspace/execution-core test` | 83 / 83 | unchanged |
| `pnpm --filter @workspace/atlas test` | 150 / 150 | unchanged |
| `pnpm --filter @workspace/scripts run audit:authoring` | **60 / 60 visible publish-ready** | unchanged (zero advisories printed — no opt-in this phase) |
| `pnpm --filter @workspace/scripts run audit:pedagogy` | unchanged | unchanged |
| `pnpm --filter @workspace/scripts run audit:contains-bc` **(new)** | **29 / 29 byte-identical** across **203 submissions** | NEW gate |
| `pnpm --filter @workspace/scripts run check:no-heuristic-runtime` | OK | unchanged |
| Phase 52 status | unchanged — operator flip kit prepared, flip NOT executed | unchanged |

### Architect review history

Pending at end of this commit (must be invoked via `architect({task, relevantFiles, includeGitDiff: true})` per the code_review skill). BC proof (29 / 29) is the headline.

### Known caveats (user-accepted per R2 proposal)

1. `contains` remains "thin" by design — substring matching is not semantic understanding; `match:"any"` is even thinner. Phase 56 makes the kind more expressive without claiming it became a stronger gate.
2. **No project opts in.** C1's 7 `contains` steps stay on legacy `{needle}` shape. The architect-flagged option to convert C1 step 1 ("list the 4 OWASP-LLM categories") into a 4-needle `match:"all"` gate is deliberately deferred — that is a content edit, not infrastructure.
3. `{needle:""}` legacy quirk preserved (empty-string needle still passes any submission on the legacy path). Authoring guard prevents new projects from creating this shape.
4. `audit:contains-bc` is project-content-specific and NOT in the `typecheck` chain. Re-run manually before the next `matchContains` change.
5. `scripts/tsconfig.json` `rootDir` removed — purely a logical `--noEmit` constraint that the BC script legitimately needs to cross.

### Hard stops respected

| Surface | Touched? |
|---|---|
| Signed-envelope canary path | NO |
| Production env vars | NO |
| `/check` and `/submit` route handlers | NO |
| Grading logic for non-`contains` kinds | NO |
| `lib/execution-core` | NO |
| Schema / migrations | NO |
| OpenAPI / codegen | NO |
| Frontend / Atlas UI / mockup-sandbox | NO |
| Project rows / step rows / `learner_visible` | NO |
| Cert / portfolio semantics | NO |
| `RUBRIC_VERSION` | FROZEN at `1.0.1` |
| Phase 52 operator flip kit | NOT TOUCHED |
| Any net-new project content | NO |

---

## What unblocks the next phase

User decision pending, same four-option menu carried over from Phase 55 close (Phase 56 satisfied none of them — it is a separate "safe lane" hardening track):

- **A.** Phase 56 follow-on: opt one or more existing visible `contains` steps into the new structured shape (`needles[]`/`match`/`caseInsensitive`). C1 step 1 is the architect-flagged candidate.
- **B.** Grader / platform hardening for `sql_resultset`, `csv_set_equal`, `json_equal`, `numeric_tolerance` — converts the catalog-wide auto-pass weaknesses into real server-side enforcement (matches Phase 55's option B).
- **C.** Another small net-new project phase (one at a time, next-thinnest course/difficulty cell).
- **D.** Return to Phase 52 operator canary evidence — run the flip kit and 1% / 10% ramp evaluation phases that have been waiting since Phase 52.

The Phase 52 unblock criteria are UNCHANGED:

1. Operator runs `docs/phases/phase-52-canary-1pct-flip-kit.md` §§1–10.
2. 48h / 500-success hold confirmed at kit §10.
3. Operator records sign-off + recommendation (hold / rollback / 10% ramp evaluation).

Only then does the 10% ramp evaluation phase open.

---

## Commits

- `f12fe95` — phase-55 C1: applied-llm-engineer guardrails and structured output safety
- `0d89eb0` — phase-55 C2: analytics-engineer semantic layer with dbt and DuckDB
- _(pending)_ — phase-56: `contains` validation hardening
