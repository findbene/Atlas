# Phase 57 — `csv_set_equal` Hardening — Audit & Proposal (READ-ONLY)

**Status:** Proposal, awaiting approval. No code/content/schema/OpenAPI/frontend changes have been made.
**Author lineage:** Follows Phase 56 (`contains` hardening). Phase 52 operator-pending status preserved.
**Recommendation (TL;DR):** **B — split into 57A (authoring canonicalization + server-side comparator, dark) and 57B (envelope pilot grader behind env var, mirror Phase 48).**

---

## 1. Visible-catalog usage (live DB, today)

```
visible_steps = 15   visible_projects = 6   all_steps (visible+hidden) = 15
```

All 15 live rows already use the structured `{kind, spec, description}` shape — there is **no legacy free-string variant in production**.

| Project slug                                             | Course              | Difficulty   | Est min | csv_set_equal steps | Enrolled |
| -------------------------------------------------------- | ------------------- | ------------ | ------: | ------------------: | -------: |
| `sql-beginner-select-where-join-essentials`              | sql                 | beginner     |     150 |                   5 |        0 |
| `sql-window-functions-and-cte-mastery`                   | sql                 | advanced     |     180 |                   4 |        0 |
| `analytics-engineer-beginner-spreadsheet-to-sql-models`  | analytics-engineer  | beginner     |     180 |                   2 |        0 |
| `python-libraries-beginner-pandas-essentials`            | python-libraries    | beginner     |     150 |                   2 |        1 |
| `analytics-engineer-semantic-layer-with-dbt-and-duckdb`  | analytics-engineer  | intermediate |     340 |                   1 |        0 |
| `data-engineering-beginner-csv-cleanup-pipeline`         | data-engineering    | beginner     |     165 |                   1 |        1 |

**Highest-risk:** the two **beginner** projects with non-zero `enrolled_count` (`python-libraries-beginner-pandas-essentials`, `data-engineering-beginner-csv-cleanup-pipeline`) — any behavior regression hits real learners. The 4-step **advanced** SQL Mastery project (`sql-window-functions-and-cte-mastery`) is the densest concentration but currently has zero enrolled.

**Total blast radius for any BC break: 2 enrolled learners across 2 steps.** Small enough to harden in place without a migration window.

---

## 2. Spec-shape variants observed live (15 / 15)

All 15 rows have `validation_config.kind = "csv_set_equal"` + `validation_config.spec = {...}` + `validation_config.description = "..."`. Within `spec`, four sub-shapes exist:

| Shape | Fields                                                                                                              | Live rows | Source-of-truth for expected data        |
| ----- | ------------------------------------------------------------------------------------------------------------------- | --------: | ---------------------------------------- |
| **A** | `{columns, expectedCsv}`                                                                                            |        ~7 | fixture file path                        |
| **B** | `{columns, expectedCsv, orderSensitive: true}`                                                                      |        ~5 | fixture file path (order-sensitive flag) |
| **C** | `{columns, expectedCsv, validateQuery: "B"}`                                                                        |         1 | fixture file path + which query variant  |
| **D** | `{query, columns, expectedRows: [[...], …]}`                                                                        |         1 | **inline literal rows** (semantic-layer) |
| **E** | `{cleanColumns, expectedClean, rejectColumns, expectedRejects}`                                                     |         1 | **two** fixture files (multi-output)     |

Notable: Shape **D** is the ONLY shape where expected data is server-readable today without filesystem fixture resolution. Shape **E** is multi-file and would need a 2-comparison grader.

`expected_outputs` column is populated on most rows but with **per-step ad-hoc metadata** (`rowCount`, `regions`, `revenueInCents`, `hasCustomerName`, etc., 31 distinct keys across 15 rows) — these are author-side documentation, NOT a uniform machine-comparable expected dataset.

---

## 3. Current behavior end-to-end

### 3.1 Server (`/check` and `/submit` legacy paths)

`artifacts/api-server/src/lib/grading.ts` — `gradeSubmission()` has **no case** for `csv_set_equal`; it falls through to the default `{ passed: true, feedback: "Step completed." }` (lines 88-89).

**This is a 100% server-side auto-pass.** Classified `"client-provisional"` in `lib/curriculum-quality/src/validationEnforcement.ts:117` and documented as such in the validation-kind-matrix.

### 3.2 Server (Phase 47/48 envelope path)

`artifacts/api-server/src/lib/envelopeGrade.ts` — `PILOT_RUNTIME_KINDS` contains only `json_equal` (line 47). `isPilotRuntimeKind("csv_set_equal") === false` → envelope branch also falls through to the same auto-pass.

### 3.3 Client (real comparison)

`lib/execution-core/src/validate.ts` — `validateExpected()` does the real work:
- Header check: rejects missing/extra columns (lines 60-82).
- Row canonicalization: `JSON.stringify(columns.map((c) => row[c] ?? null))` (line 26) — preserves null, no whitespace trim, JSON-native number formatting.
- Multiset comparison via `Map<string, number>` tally (lines 97-128) — duplicates respected, order-insensitive by default.
- Failure UX: surfaces structured summary ("Row mismatch: expected X rows, got Y.") + per-row feedback.

DuckDB-WASM rows are extracted by `artifacts/atlas/src/lib/duckdb/duckdbRunner.ts` (lines 106-116) with `bigint → number` coercion when safe.

### 3.4 Signing layer (Phase 46)

`csv_set_equal` IS already a `SIGNABLE_KIND` in `artifacts/api-server/src/routes/runs-sign.ts:66`. The signed envelope carries `RunCapture.{rows, columns}` (lines 155-156). Envelopes are minted today but **not consumed** for grading.

### 3.5 Phase 52 canary status

`docs/runbooks/envelope-canary.md` lists `csv_set_equal` as an eligible-for-signing kind (line 109). Phase 52 is **operator-pending** — no canary flip in progress. Phase 57 must not disturb it.

---

## 4. Proposed canonical row-set format

The canonicalization rules below are NOT new code yet — they define what 57A would implement in both `validateExpected()` (client) and the new server comparator (`gradeCsvSetEqual()`), so both ends agree byte-identically.

| Dimension              | Canonical rule                                                                                  | BC note                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Headers**            | Compared as-declared (case-sensitive); extra cols reject; missing cols reject.                  | Already current behavior client-side. Server adopts the same rule.       |
| **Row order**          | Order-insensitive by default; `orderSensitive: true` opt-in (already in spec).                  | Current client default. No change.                                       |
| **Duplicate rows**     | Multiset (cardinality preserved). New optional `dedupe: "expected" \| "both" \| false` (default `false`). | Current default = multiset. `dedupe` is additive, opt-in.    |
| **Whitespace**         | String cells: NO trim by default. New optional `trimStrings: true` (default `false`).           | Conservative — current behavior preserved.                               |
| **null vs empty `""`** | Distinct by default. New optional `nullEqualsEmpty: true` (default `false`).                    | Conservative — current behavior preserved.                               |
| **Numeric strings**    | Cell-type-preserving (`"42"` !== `42`). New optional `coerceNumericStrings: true` (default `false`). | Conservative — JSON-stringify path already distinguishes.            |
| **Quoting**            | CSV fixtures parsed with RFC-4180 reader (commas + `"` quoting + `""` escape). LF or CRLF.      | Today fixtures are read client-side by the dataset loader. Server gets parity. |
| **Case sensitivity**   | String comparison case-sensitive by default. New optional `caseInsensitive: true` (default `false`). | Conservative. Mirrors Phase 56 `contains` flag naming.              |

**Canonical row hash:** `sha256(JSON.stringify({columns, rows: sortedCanonicalRows}))` — produced identically by client and server. Used by 57B to short-circuit envelope grading: server recomputes hash from the signed `RunCapture` and compares to the hash of the canonical expected dataset.

---

## 5. Where the expected dataset comes from (server-side)

Today server cannot grade because it cannot read fixtures. Three viable sources, ordered by safety:

| # | Source                            | Pros                                                            | Cons                                                                       |
| - | --------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1 | **Inline `spec.expectedRows`**    | Zero filesystem, zero loader; deterministic; already used (shape D). | Authors must inline; bulky for >50 rows.                                  |
| 2 | **`spec.expectedRowsHash`** (new) | Tiny; canonical hash of the expected dataset; signing-friendly. | Requires authoring tool to pre-compute (or `pnpm` script to emit).         |
| 3 | **Server-side fixture read**      | No authoring change.                                            | Requires fixture-file copy or content-addressed store on the server. Defer. |

**Proposal:** 57A implements **(1) + (2) ONLY**. `expectedCsv` fixture references stay client-only for the comparator path (legacy BC); server grading activates only when `expectedRows` OR `expectedRowsHash` is present. No new fixture-loader on the server. **Zero of the 15 live rows opt in this phase** — existing fixture-based rows continue to auto-pass server-side, exactly as today.

---

## 6. Server vs envelope: which path enforces?

**Both, in two stages:**

- **57A** adds `gradeCsvSetEqual()` to `artifacts/api-server/src/lib/grading.ts`, called from the legacy `/check`+`/submit` path. Behavior:
  - If `spec.expectedRows` (or `expectedRowsHash`) present AND submission carries parseable rows → real comparison.
  - Else → preserve current `{passed:true, "Step completed."}` auto-pass (legacy BC).
  - Malformed spec → fail closed (`"Grading config is malformed — please report this step."`, matching Phase 56 wording).
- **57B** adds `csv_set_equal` to `PILOT_RUNTIME_KINDS` in `envelopeGrade.ts`, gated by env var (`ENVELOPE_PILOT_KINDS="json_equal,csv_set_equal"`). Recomputes canonical hash from signed `RunCapture` and compares vs canonical hash of `spec.expectedRows`. Off in dev by default. Mirrors Phase 48 exactly.

This split lets us land the comparator + tests + advisories independently of the canary flip, so the canary remains operator-pending.

---

## 7. Proposed `validationConfig` additions (additive, all optional, defaults preserve current behavior)

```ts
type CsvSetEqualSpec = {
  // EXISTING (untouched):
  columns?: string[];                     // header allow-list (required for any comparison)
  expectedCsv?: string;                   // fixture path (client-side)
  expectedRows?: ReadonlyArray<ReadonlyArray<string|number|boolean|null>>;
  expectedClean?: string; cleanColumns?: string[];     // shape E (data-eng beginner)
  expectedRejects?: string; rejectColumns?: string[];  // shape E
  query?: string;                         // for documentation
  orderSensitive?: boolean;               // default false
  validateQuery?: string;                 // which query variant (shape C)

  // NEW (Phase 57A; all optional, default = current behavior):
  expectedRowsHash?: string;              // sha256 hex of canonical(expectedRows). Server-checkable without inlining rows.
  trimStrings?: boolean;                  // default false
  nullEqualsEmpty?: boolean;              // default false
  coerceNumericStrings?: boolean;         // default false
  caseInsensitive?: boolean;              // default false
  dedupe?: "expected" | "both" | false;   // default false
};
```

**Authoring guard (`lib/curriculum-quality/src/authoring.ts`):** new `assertValidCsvSetEqualSpec()` mirroring the Phase 56 `contains` pattern. Rejects malformed shapes at authoring time. Booleans must be booleans (no coercion); `dedupe` must be one of the three literals; `expectedRowsHash` must be `/^[0-9a-f]{64}$/`. **Other kinds untouched.**

**Authoring CLI helper (small):** `pnpm --filter @workspace/scripts run hash:csv-rows -- <path/to/expected.csv>` — emits the canonical hash so authors can paste it into `expectedRowsHash`. Read-only utility; does not touch DB.

---

## 8. Backwards compatibility

| Existing row shape                                         | Server (57A)              | Client (57A)              | Envelope (57B, behind env var)     |
| ---------------------------------------------------------- | ------------------------- | ------------------------- | ---------------------------------- |
| `{columns, expectedCsv}` (shape A/B)                       | auto-pass (unchanged)     | unchanged                 | falls through unless opted in      |
| `{columns, expectedCsv, validateQuery}` (shape C)          | auto-pass (unchanged)     | unchanged                 | falls through unless opted in      |
| `{query, columns, expectedRows}` (shape D, semantic-layer) | **real comparison (NEW)** | unchanged                 | **real envelope grading if env on** |
| `{cleanColumns, expectedClean, …}` (shape E, csv-cleanup)  | auto-pass (unchanged)     | unchanged                 | falls through unless opted in      |
| Missing `validation_config` entirely                       | auto-pass (Phase 56 outer guard preserved) | unchanged | falls through                     |
| Malformed new fields (e.g. `dedupe: "no"`)                 | **fail closed** (NEW)     | **fail closed** (NEW)     | **fail closed** (NEW)              |

**Net learner-visible change in 57A:** exactly **1 step** (`analytics-engineer-semantic-layer-with-dbt-and-duckdb` step 3, shape D) graduates from auto-pass to real server comparison. Project has 0 enrolled learners. Acceptable. If we want to be strictly invisible: gate `expectedRows`-based server comparison behind `spec.serverGrade: true` (additional opt-in), which would make 57A zero-step. Recommend the **opt-in flag** to keep 57A truly dark.

---

## 9. `/check` vs `/submit` behavior

| Endpoint       | Current                                | Proposed (57A, with `spec.serverGrade: true` opt-in)        |
| -------------- | -------------------------------------- | ----------------------------------------------------------- |
| `POST /check`  | client provides feedback; server NOP   | unchanged — `/check` is preview only, no envelope, no grading |
| `POST /submit` | server auto-pass; XP awarded           | if opted in → real comparison; else → auto-pass (BC)         |
| Envelope path  | not a pilot kind; auto-pass            | 57B only, behind `ENVELOPE_PILOT_KINDS` env var              |

`/check` semantics are intentionally untouched — same rule we held in Phase 56.

---

## 10. Test matrix

### 57A — server comparator + authoring guard

- **`artifacts/api-server/src/lib/grading.test.ts`** (+~24 tests):
  - canonical equality: pass / row missing / extra row / wrong column / extra column / row order (sens vs insens) / duplicate cardinality / dedupe modes (3) / null vs empty (both flags) / numeric coercion (both flags) / trim (both flags) / case (both flags) / malformed spec fail-closed (≥6 shapes)
  - opt-in gating: `serverGrade=false` → auto-pass; `serverGrade=true` + no `expectedRows`/`expectedRowsHash` → fail closed.
  - hash equivalence: `expectedRowsHash` matches `sha256(canonical(expectedRows))`.
- **`lib/curriculum-quality/src/authoring.test.ts`** (+~15 tests): same malformed-spec set as runtime → symmetry (Phase 56 lesson learned).
- **NEW `scripts/src/audit-csv-set-equal-bc.ts`** (mirrors `audit-contains-bc.ts`): for each visible csv_set_equal step, assert server comparator + Phase-47 reference grader return byte-identical `{passed, feedback}` across N synthetic submissions. Acceptance: **15 / 15 byte-identical**.
- **`lib/execution-core/src/validate.test.ts`** (+~12): client-side canonicalization parity with server.

### 57B — envelope pilot

- **`artifacts/api-server/src/lib/envelopeGrade.test.ts`** (+~10): csv_set_equal pilot path on/off via env var; canonical-hash recompute from signed envelope; fail-closed on tampered rows.
- **`artifacts/api-server/src/lib/envelopeSubmit.test.ts`** (+~4): end-to-end signed submit → grade.

**Existing test suites that must stay green:** api-server full, curriculum-quality full, execution-core full, atlas full, all audits including `audit:contains-bc` (Phase 56) and the new `audit:csv-set-equal-bc`.

---

## 11. Rollback plan

- 57A is opt-in via `spec.serverGrade: true`. **Zero rows opt in this phase.** Rollback = revert the grader/authoring/audit commits; no data migration; no env-var flip.
- 57B is gated by `ENVELOPE_PILOT_KINDS`. Rollback = unset the env var (or remove `csv_set_equal` from the comma-list). Phase 52 canary status untouched throughout.
- No `RUBRIC_VERSION` bump (still `1.0.1`).
- No DB schema change → nothing to migrate down.
- BC audit script (`audit:csv-set-equal-bc`) becomes the standing pre-merge gate for any future comparator edit.

---

## 12. Files likely to change

### 57A (comparator + authoring)
- `artifacts/api-server/src/lib/grading.ts` — add `gradeCsvSetEqual()` + dispatch case.
- `artifacts/api-server/src/lib/grading.test.ts` — +~24 tests.
- `lib/curriculum-quality/src/authoring.ts` — `assertValidCsvSetEqualSpec()` + new optional fields in `CsvSetEqualSpec` type; `validationConfig("csv_set_equal", …)` calls the assert.
- `lib/curriculum-quality/src/authoring.test.ts` — +~15 tests.
- `lib/execution-core/src/validate.ts` — client canonicalization parity helpers; honor new optional flags.
- `lib/execution-core/src/validate.test.ts` — +~12 tests.
- `scripts/src/audit-csv-set-equal-bc.ts` — NEW (mirror of `audit-contains-bc.ts`).
- `scripts/package.json` — `audit:csv-set-equal-bc` script entry.
- `scripts/src/hash-csv-rows.ts` — NEW small CLI helper for authors.
- `scripts/package.json` — `hash:csv-rows` script entry.
- `docs/validation-kind-matrix.md` — update `csv_set_equal` row.
- `docs/phases/phase-57a-csv-set-equal-comparator.md` — NEW close-out.
- `HANDOFF.md`, `replit.md`, `docs/phases/INDEX.md` — rotation.

### 57B (envelope pilot)
- `artifacts/api-server/src/lib/envelopeGrade.ts` — add `csv_set_equal` to `PILOT_RUNTIME_KINDS` behind env-var read; reuse `gradeCsvSetEqual()`.
- `artifacts/api-server/src/lib/envelopeGrade.test.ts` — +~10 tests.
- `artifacts/api-server/src/lib/envelopeSubmit.test.ts` — +~4 tests.
- `docs/runbooks/envelope-canary.md` — small note that `csv_set_equal` is now grader-eligible (canary status itself unchanged).
- `docs/phases/phase-57b-csv-set-equal-envelope-pilot.md` — NEW close-out.

**NOT touched (hard stops):** project rows, project step rows, `learner_visible`, `RUBRIC_VERSION`, OpenAPI spec, generated hooks, DB schema, migrations, Phase 52 canary state, cert/portfolio language, Clerk/auth, Stripe.

---

## 13. Risk register

| Risk                                                                  | Mitigation                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Hidden BC break for the 2 enrolled learners                           | `serverGrade: true` opt-in → zero rows opt in 57A → zero behavior change.                   |
| Client/server canonicalization drift                                  | `audit:csv-set-equal-bc` enforces byte-identical `{passed,feedback}` per row at every commit. |
| Authoring guard rejects something the comparator accepts (Phase-56 lesson) | Same malformed-shape table drives BOTH `gradeCsvSetEqual` and `assertValidCsvSetEqualSpec`. Tests are paired. |
| Envelope signing accidentally activated by 57B in dev                 | env-var defaults empty; `ENVELOPE_PILOT_KINDS` must be set explicitly.                      |
| Drifting `expectedRowsHash` if authors edit `expectedRows` and forget | `pnpm run hash:csv-rows` is the only blessed way to compute; document in template + linter optional follow-up. |
| Multi-output shape E (csv-cleanup) doesn't fit one comparator         | Out of scope for 57A/57B; tracked as a follow-up — current auto-pass preserved.             |

---

## 14. Recommendation

**B — split into 57A (comparator + authoring guard + BC audit, dark via `serverGrade` opt-in) and 57B (envelope pilot grader behind env var).**

Rationale:
- 57A is mechanically a near-clone of the Phase-56 `contains` pattern (extract grader, symmetric authoring guard, BC audit script). Low risk, ~1-day shape, immediately provides a real server comparator that future projects can opt into.
- 57B is mechanically a near-clone of the Phase-48 `json_equal` envelope-pilot pattern. Gated by env var; does not affect canary state; can land independently after 57A is green.
- Splitting keeps each merge small and reviewable; either half can be reverted without touching the other.
- Doing both as a single phase ("A") would couple grader correctness to envelope-canary scheduling, which the user has explicitly held operator-pending.
- "C — defer" is unwarranted: signing infra already exists; the spec shape is uniform; no schema work is needed.

**Suggested order if approved:** 57A first → land + soak one week with BC audit green → 57B → soak behind env var → operator decides Phase 52 canary + 57B cutover together.

---

## 15. Open questions for approver

1. Confirm `serverGrade: true` opt-in (recommended) vs. **always-on once `expectedRows` present** (would graduate 1 step, 0 enrolled).
2. Confirm 57A scope **excludes** shape E (multi-output csv-cleanup) — defer to future phase.
3. Confirm `hash:csv-rows` CLI helper is in scope for 57A (vs. authors hand-paste hashes).
4. Confirm we do NOT add a server-side fixture loader in 57A (proposal: do not).
