# HANDOFF

**Latest shipped phase:** Phase 57A — `csv_set_equal` DARK Server-Side Comparator (runtime helper + canonical hash + dispatch case + authoring guard + BC proof). **No project opted in; legacy rows untouched.**
**Working tree:** clean after Phase 57A commit (this commit). Visible catalog count: 60 (unchanged from Phase 56).
**Parent commit chain:** Phase 57A ← Phase 56 ← Phase 55 (C2 visible) ← `0d89eb0` (C2 promote) ← `f12fe95` (C1 promote) ← `82e473d` (phase-54) ← `b0667ec` (phase-53) ← `efa4ddf` (phase-52 operator kit) ← `27e70c6` (phase-51) ← `5278fec` (phase-50).

**Phase 52 status (unchanged):** operator flip kit prepared; the production flip has NOT been executed by the agent. Phase 57A is `csv_set_equal`-only runtime + authoring foundation, NOT the 10% ramp evaluation; touches none of the canary path's prerequisites.

---

## Phase 57A summary

Phase 57A ships the **dark foundation** for real server-side row-set grading on `csv_set_equal` steps: a runtime comparator `gradeCsvSetEqual()` + a symmetric authoring guard `assertValidCsvSetEqualSpec()` + a one-shot BC audit `audit:csv-set-equal-bc`. The flag for entering real grading is `spec.serverGrade === true`, and **no live row sets it** — every one of the 15 visible `csv_set_equal` steps continues producing the legacy `{passed:true, feedback:"Step completed."}` byte-for-byte. The Atlas client's instant DuckDB-WASM Run feedback is untouched; only Submit semantics gain a path that today is unreachable from any project. Mirrors Phase 56's pattern exactly: extract → guard → audit BC → document → ship.

See `docs/phases/phase-57a-csv-set-equal-comparator.md` for the full semantics matrix, hash design, submission contract, deferred-scope rationale, and the recommended 57B plan.

### What landed — files

| File | Change |
|---|---|
| `artifacts/api-server/src/lib/grading.ts` | NEW `gradeCsvSetEqual(spec, submission): GradingOutcome` + NEW `computeCsvSetEqualHash(columns, rows, opts): string`. Dispatch case added after `contains`, before `regex`, with the outer `&& step.validationConfig` guard preserved verbatim so null/undefined configs still hit generic `"Step completed."`. Full Phase-57A semantics matrix in block comment (8 normalization knobs + opt-in gate + scope exclusions). Uses `node:crypto` SHA-256 for the multiset fingerprint. Exports both helpers for the BC audit and any future hash-generation script. |
| `artifacts/api-server/src/lib/grading.test.ts` | +24 Phase-57A cases (BC: null config / no flag / `serverGrade:false` / non-boolean flag / shape E / fixture-only; malformed: missing rows-or-hash, missing columns, empty columns, bad hex, invalid `dedupe`, non-boolean flag, hash+orderSensitive; submission shape: empty / non-JSON / wrong shape; happy paths: exact, out-of-order multiset, ordered correct, ordered wrong; headers: count / name / caseInsensitive; duplicates: multiset fail, dedupe='both' pass, dedupe='expected' pass; whitespace + trimStrings; null-vs-empty + nullEqualsEmpty; '42'-vs-42 + coerceNumericStrings; caseInsensitive cells; row width; extra row; hash-only PASS + FAIL + order-insensitive fingerprint; direct-helper-vs-dispatch symmetry). |
| `lib/curriculum-quality/src/authoring.ts` | `validationConfig()` calls new `assertValidCsvSetEqualSpec(spec)` when `kind === "csv_set_equal"`. Exports `CsvSetEqualSpec`, `CsvSetEqualCell`, `CsvSetEqualRow`. Legacy fixture shapes A–E continue to pass through unchanged (no `serverGrade` → guard validates only types of any known new fields that are present). Forward-compat: unknown spec keys tolerated (Phase 56 pattern). Other kinds untouched. |
| `lib/curriculum-quality/src/authoring.test.ts` | +24 Phase-57A cases (BC: shapes A–E + shape D; opt-in happy paths: minimum / hash / all flags; minimum-contract rejections: no columns / no rows-or-hash / orderSensitive+hash-only / row-width mismatch; type rejections: serverGrade / orderSensitive / trimStrings / nullEqualsEmpty / coerceNumericStrings / caseInsensitive / dedupe-invalid / columns non-string / columns empty-string / expectedRows non-cell / hash non-hex / hash uppercase). |
| `scripts/src/audit-csv-set-equal-bc.ts` | NEW one-shot BC audit. 7 curated submissions × every visible `csv_set_equal` step (15 → 105 synthetic submissions). Inlines verbatim pre-57A reference (`{passed:true, feedback:"Step completed."}`). Defensive `WARN` log if any row has accidentally opted in (zero today). Exits non-zero on first BC divergence. |
| `scripts/package.json` | NEW `audit:csv-set-equal-bc` script entry. |
| `docs/validation-kind-matrix.md` | `csv_set_equal` row expanded with full Phase-57A spec (opt-in gate, submission contract, knobs, malformed-fail-closed behavior, link to close-out, 57B next-step hint). |
| `docs/phases/phase-57a-csv-set-equal-comparator.md` | NEW close-out (this phase). |
| `docs/phases/INDEX.md` | Latest-pointer rotated to Phase 57A. |
| `HANDOFF.md` | This rewrite. |
| `replit.md` | Phase History rotated (Phase 57A in, Phase 54 out). |

Zero touches to: signed-envelope canary path, `/check`, `/submit`, `lib/execution-core`, other validation-kind graders (`json_equal`, `numeric_tolerance`, `sql_resultset`, `regex`, `exact`, `self_attest`, `contains`), schemas, migrations, OpenAPI / Orval codegen, env vars, deploys, cert / portfolio language, `RUBRIC_VERSION` (frozen `1.0.1`), Phase 52 operator flip kit, project rows, project step rows, `learner_visible` flags, frontend / Atlas UI, mockup-sandbox.

### Gates

| Gate | Result | Delta vs Phase 56 |
|---|---|---|
| `pnpm run typecheck` (libs + 4 artifacts + `check:no-heuristic-runtime`) | OK | unchanged |
| `pnpm --filter @workspace/api-server test` | **459 / 459** | +42 (27 `csv_set_equal` incl. 3 architect-fix + 15 incidental in same `gradeSubmission` describe) |
| `pnpm --filter @workspace/curriculum-quality test` | **133 / 133** | +25 (architect-fix symmetry pass) |
| `pnpm --filter @workspace/execution-core test` | 83 / 83 | unchanged |
| `pnpm --filter @workspace/atlas test` | 150 / 150 | unchanged |
| `pnpm --filter @workspace/scripts run audit:authoring` | **60 / 60 visible publish-ready** | unchanged (zero opt-ins → zero advisories) |
| `pnpm --filter @workspace/scripts run audit:pedagogy` | unchanged | unchanged |
| `pnpm --filter @workspace/scripts run audit:contains-bc` | 29 / 29 byte-identical across 203 submissions | unchanged |
| `pnpm --filter @workspace/scripts run audit:csv-set-equal-bc` **(new)** | **15 / 15 byte-identical across 105 submissions** | NEW gate |
| `pnpm --filter @workspace/scripts run check:no-heuristic-runtime` | OK | unchanged |
| Phase 52 status | unchanged — operator flip kit prepared, flip NOT executed | unchanged |

### Architect review history

Round 1 (evaluate_task, full git diff): verdict FAIL on one P1 symmetry gap — authoring guard validated Phase-57A comparator fields even when `serverGrade !== true`, while runtime auto-passed in that branch. Architect's prescribed fix applied verbatim: `assertValidCsvSetEqualSpec` now early-returns when `serverGrade !== true`, mirroring runtime exactly. `serverGrade` type-check is preserved as a strictly additive author lint (rejecting `serverGrade:"true"` typos that would silently leave a row on the BC auto-pass path; does NOT diverge runtime since runtime treats `!== true` as opt-out regardless). Two architect-recommended runtime tests added: (1) submission `rows` containing nested object cells fail closed, (2) submission `rows` containing array cells fail closed, (3) opt-in `expectedRows` width mismatch with `columns` count → MALFORMED. Authoring tests rewritten: 8 type-check rejection cases now consolidated into a single "lax pass-through" test (matches runtime BC), and 11 type-check rejection cases moved behind explicit `serverGrade: true` opt-in.

### Known caveats (user-accepted per R2 proposal)

1. **No opt-ins this phase.** All 15 visible `csv_set_equal` steps remain client-provisional (DuckDB-WASM Run feedback) + server auto-pass at Submit. Phase 57A is foundation-only.
2. **Shape E deferred.** The Phase-7-era multi-output rows (`cleanColumns` / `expectedClean` / `rejectColumns` / `expectedRejects`) pass the authoring guard via legacy fall-through and auto-pass at runtime. A 57C phase will either extend the spec or migrate them to opt-in pairs.
3. **Hash is multiset-only.** `orderSensitive: true` requires inline `expectedRows` (positional source-of-truth). Both runtime and authoring guard enforce this; hash-only ordered comparison would need a separately authored ordered-hash field — out of scope.
4. **Submission contract is `{columns, rows}` JSON.** When the first project opts in, the Atlas frontend must serialize the captured DuckDB-WASM run output as this shape on Submit. Chosen to match the future Phase-57B `RunCapture` envelope so the comparator survives the 57B refactor unchanged. **Decision required before 57B:** raw JSON vs. signed envelope (Phase 44 / Shape γ trust-boundary caveat applies verbatim).
5. **`audit:csv-set-equal-bc` is content-specific.** Queries live DB rows; NOT in the `typecheck` chain. Re-run manually before any change to `gradeCsvSetEqual` or any change to a project's `csv_set_equal` step config.
6. **Forward-compat keys tolerated.** Both runtime and authoring guard ignore unknown spec keys (`expectedCsv`, `validateQuery`, `query`, `cleanColumns`, etc. — all pass through).

### Next phase recommendation

**Phase 57B — first opt-in / envelope pilot.** Pre-build decision brief should cover: (1) submission-shape decision (raw `{columns, rows}` JSON vs. signed `RunCapture` envelope) + threat-model addendum per Phase 44 / Shape γ caveat; (2) pilot project selection (likely C2 step 6 — `analytics-engineer-semantic-layer-with-dbt-and-duckdb`, which already authored inline `expectedRows`); (3) Atlas frontend wiring for the opt-in submission shape; (4) architect review before merge (1–3 rounds expected, operator-facing change). Defer to a separate phase — Phase 57A is locked at zero behavior change.
