# Phase 57A — `csv_set_equal` DARK Server-Side Comparator

**Status:** shipped (this commit).
**Scope shape:** runtime helper + authoring guard + BC audit + tests + docs. **Zero opt-ins.**
**Approved scope source:** `docs/phases/phase-57-proposal-csv-set-equal-hardening.md` (R2 scope, user-approved 57A-only path; 57B + Shape E deferred).

---

## What landed

Phase 57A is the **foundation phase** for real server-side row-set grading on `csv_set_equal` steps. It ships the comparator + symmetric authoring guard + BC proof, but **no project opts in** (every visible row keeps producing `{passed: true, feedback: "Step completed."}` exactly as it did pre-57A). The opt-in flag (`spec.serverGrade: true`) is plumbed end-to-end but disabled everywhere live.

Mirrors the Phase 56 pattern exactly: extract → guard → audit BC → document → ship.

### Files

| File | Change |
|---|---|
| `artifacts/api-server/src/lib/grading.ts` | NEW `gradeCsvSetEqual(spec, submission)` + NEW `computeCsvSetEqualHash(columns, rows, opts)` (exported). Dispatch case added after `contains`, before `regex`, with the same outer `&& step.validationConfig` guard so null-config rows still hit the generic fallthrough. Full Phase-57A semantics matrix in block comment. |
| `artifacts/api-server/src/lib/grading.test.ts` | +24 Phase-57A cases (BC null/no-flag/non-boolean/shape-E/fixture-only; 7 malformed fail-closed; submission-shape failures; happy-path + ordered + multiset; header count + name + caseInsensitive; dedupe `false`/`both`/`expected`; whitespace; null-vs-empty; numeric coercion; case-insensitive cells; row width; extra row; hash-only path pass + fail + order-insensitive fingerprint; direct-helper symmetry). |
| `lib/curriculum-quality/src/authoring.ts` | `validationConfig()` calls new `assertValidCsvSetEqualSpec(spec)` when `kind === "csv_set_equal"`. Exports `CsvSetEqualSpec` + `CsvSetEqualCell` + `CsvSetEqualRow`. All optional new fields strictly type-checked; legacy fixture shapes A–E accepted unchanged (no `serverGrade` → guard skips the minimum-contract check). |
| `lib/curriculum-quality/src/authoring.test.ts` | +24 Phase-57A cases (BC shapes A/B/C/D/E; opt-in happy paths; 4 minimum-contract rejections; 11 type-check rejections including `dedupe`, hex-format, row-width). |
| `scripts/src/audit-csv-set-equal-bc.ts` | NEW one-shot BC audit. 7 curated submissions × every visible `csv_set_equal` step (15 steps → 105 synthetic submissions). Inlines verbatim pre-57A reference (`{passed:true, feedback:"Step completed."}`). Defensive `WARN` log if any row has accidentally opted in (none today). Exits non-zero on first divergence. |
| `scripts/package.json` | NEW `audit:csv-set-equal-bc` script. |
| `docs/validation-kind-matrix.md` | `csv_set_equal` row expanded to document the dark-foundation + opt-in semantics + canonicalization knobs. |
| `docs/phases/phase-57a-csv-set-equal-comparator.md` | NEW close-out (this file). |
| `docs/phases/INDEX.md` | Latest-pointer rotated to Phase 57A; chronological entry appended. |
| `HANDOFF.md` | Replaced with the Phase 57A handoff. |
| `replit.md` | Phase History rotated (Phase 57A in, Phase 54 out). |

### Comparator semantics matrix (when opted in)

| Knob | Default | When `true` / set |
|---|---|---|
| `serverGrade` | absent / `false` → **BC auto-pass** | `true` → real server grading |
| `columns` | required (non-empty string[]) | header check; positional comparison |
| `expectedRows` | OR `expectedRowsHash` required | inline 2-D cells (string\|number\|boolean\|null) |
| `expectedRowsHash` | OR `expectedRows` required | 64-char lowercase hex SHA-256 of canonical multiset fingerprint |
| `orderSensitive` | `false` (multiset) | positional per-row comparison; requires `expectedRows` (not hash-only) |
| `trimStrings` | `false` | string cells trimmed before compare |
| `nullEqualsEmpty` | `false` | `null` and `""` collapse to `null` |
| `coerceNumericStrings` | `false` | `/^-?\d+(\.\d+)?$/` strings → `Number()` |
| `caseInsensitive` | `false` | string cells AND headers lowercased |
| `dedupe` | `false` (multiset) | `"expected"` dedupes expected only; `"both"` dedupes both sides |

### Submission contract (opted-in path)

When `spec.serverGrade === true`, the server expects submission to be JSON of shape:

```json
{"columns": ["a", "b"], "rows": [[1, "x"], [2, "y"]]}
```

This mirrors the future Phase-57B `RunCapture` envelope shape, so 57B reuses this comparator unchanged. Any other submission shape → `failSubmission("...")` learner-readable error. **Zero rows opt in today**, so this contract is exercised only by tests.

### Hash semantics

`computeCsvSetEqualHash` produces a SHA-256 over `JSON.stringify({columns, rows: sortedCanonicalRows})` — order-insensitive multiset fingerprint. `orderSensitive: true` therefore **requires** inline `expectedRows` (positional source-of-truth); hash alone is multiset-only. Authoring guard + runtime both enforce this.

### BC proof

```
=== Phase 57A — csv_set_equal BC audit ===
Visible csv_set_equal steps: 15
Steps checked:        15
Submissions checked:  105
BC mismatches:        0

BC PASS — 15 / 15 visible csv_set_equal steps produce byte-identical legacy outcomes across 105 synthetic submissions.
```

7 curated submissions per row: `""`, `" "`, `"anything"`, `"not json {"`, `"{}"`, valid shape, empty-cols shape. Every row currently lacks `serverGrade`, so the auto-pass branch fires before any parsing happens.

---

## Hard stops honored (verbatim from approved 57A scope)

Zero touches to: signed-envelope canary path, `/check`, `/submit`, `lib/execution-core`, other validation-kind graders (`json_equal`, `numeric_tolerance`, `sql_resultset`, `regex`, `exact`, `self_attest`, `contains`), schemas, migrations, OpenAPI / Orval codegen, env vars, deploys, cert / portfolio language, `RUBRIC_VERSION` (frozen `1.0.1`), Phase 52 operator flip kit, project rows, project step rows, `learner_visible` flags, frontend / Atlas UI, mockup-sandbox.

**Deferred (NOT shipped in 57A, per user-approved scope):**

- **57B** — first project opt-in (envelope/round-trip pilot). Requires submission-shape decision on whether the Atlas client sends `{columns, rows}` JSON or signed envelopes. Plan separately.
- **Shape E** — multi-output `expectedClean` + `expectedRejects`. Guard currently accepts the shape (legacy pass-through) and runtime auto-passes it; opt-in would require an extended spec literal. Deferred per user decision.
- **Fixture-loader** — server-side `expectedCsv: "fixtures/..."` resolution. Out of scope: the dark comparator only consumes inline `expectedRows` or `expectedRowsHash`.

---

## Gates (this commit)

| Gate | Result | Delta vs Phase 56 |
|---|---|---|
| `pnpm run typecheck` (libs + 4 artifacts + `check:no-heuristic-runtime`) | OK | unchanged |
| `pnpm --filter @workspace/api-server test` | **459 / 459** | +42 (27 `csv_set_equal` incl. 3 architect-fix + 15 incidental in same `gradeSubmission` describe) |
| `pnpm --filter @workspace/curriculum-quality test` | **133 / 133** | +25 (architect-fix symmetry pass) |
| `pnpm --filter @workspace/execution-core test` | 83 / 83 | unchanged |
| `pnpm --filter @workspace/atlas test` | 150 / 150 | unchanged |
| `pnpm --filter @workspace/scripts run audit:authoring` | **60 / 60 visible publish-ready** | unchanged (zero opt-ins → zero advisories) |
| `pnpm --filter @workspace/scripts run audit:pedagogy` | unchanged | unchanged |
| `pnpm --filter @workspace/scripts run audit:contains-bc` | 29 / 29 byte-identical | unchanged |
| `pnpm --filter @workspace/scripts run audit:csv-set-equal-bc` **(new)** | **15 / 15 byte-identical across 105 submissions** | NEW gate |
| `pnpm --filter @workspace/scripts run check:no-heuristic-runtime` | OK | unchanged |
| Phase 52 status | unchanged — operator flip kit prepared, flip NOT executed | unchanged |

---

## Known caveats (user-accepted)

1. **No opt-ins this phase.** All 15 visible `csv_set_equal` steps remain auto-pass on Submit (client-provisional via DuckDB-WASM `validateExpected` for instant Run feedback, server auto-pass at Submit). Phase 57A is foundation-only.
2. **Shape E deferred.** The 3 visible Phase-7 multi-output rows (`cleanColumns` / `expectedClean` / `rejectColumns` / `expectedRejects`) currently pass the authoring guard (legacy fall-through) and auto-pass at runtime. A 57C phase will extend the spec or migrate them to opt-in pairs.
3. **Hash is multiset-only.** `orderSensitive: true` requires inline `expectedRows`. Hash-only positional comparison would need a separately authored ordered-hash field; out of scope.
4. **Submission contract is `{columns, rows}` JSON.** When the first project opts in, the Atlas frontend must serialize the captured DuckDB-WASM run output as this shape on Submit. The shape was chosen to match the future Phase-57B `RunCapture` envelope so the comparator survives the 57B refactor unchanged.
5. **`audit:csv-set-equal-bc` is content-specific.** It queries live DB rows and is NOT in the `typecheck` chain. Re-run manually before any change to `gradeCsvSetEqual` or any change to a project's `csv_set_equal` step config.
6. **Forward-compat keys tolerated.** Both runtime and authoring guard ignore unknown spec keys (Phase 56 pattern). Shape E, fixture references, query strings, etc. all pass through.

---

## Recommended 57B design (NOT implemented — plan separately)

Pick one of the 15 visible `csv_set_equal` rows that already has an inline `expectedRows` (shape D — there is at least one in `analytics-engineer-semantic-layer-with-dbt-and-duckdb` from Phase 55, where step 6 produces a deterministic DuckDB result set). Pre-build decision brief should cover:

1. **Submission shape decision** — does the Atlas client send `{columns, rows}` JSON directly, or sign a `RunCapture` envelope first? Phase 44 / Shape γ trust-boundary caveat applies verbatim: envelope signing alone does NOT prove the captured output came from honestly running the learner's SQL. A motivated client can request a signature on a forged payload. Decide explicit threat model before any code.
2. **Single-project pilot** — flip exactly ONE step's `spec.serverGrade: true` + add `expectedRows` (already present for shape D). Re-run `audit:csv-set-equal-bc` — it will surface a WARN (expected) and the pilot row should no longer be in the byte-identical set.
3. **Architect review** — Phase 56 + 57A precedent: 1–3 round trip before merge. 57B is operator-facing because it CHANGES learner Submit semantics for the pilot project.
4. **Frontend wiring** — `artifacts/atlas/src/pages/project-workspace.tsx` `submissionTypeForStep` may need a new branch for `csv_set_equal` opt-in rows.

Defer to a separate phase. Phase 57A ships zero behavior change.
