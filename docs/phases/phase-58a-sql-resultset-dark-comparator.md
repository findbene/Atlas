# Phase 58A — `sql_resultset` DARK server-grading comparator foundation (close-out)

**Status:** SHIPPED (build-DARK). A real server-side rowset comparator for `sql_resultset`,
opt-in via `spec.serverGrade: true`. **Zero rows opt in. Zero learner-visible behavior change.
Envelope enforcement OFF. Phase 52 untouched.** Mirrors the Phase-57A `csv_set_equal` arc.

Independent reviews: **`atlas-architect-reviewer` → PASS** and **`code-reviewer` → SHIP**, no P0/P1.
Both byte-verified the shared-core extraction against HEAD (162-line exact match) and confirmed the
DARK invariant, the live-csv BC guarantee, authoring↔runtime symmetry, H3 honesty, no-FE-leak, and
scope discipline. Two accept-with-note P2s (below).

---

## 1. Why this phase

`sql_resultset` is the most-used "real result" validation kind after `self_attest` — 25 authored
steps across 8 projects (4 currently visible, all in the C2 semantic-layer project). Before 58A it had
**no case** in `gradeSubmission`; it fell through to the generic `{passed:true,"Step completed."}`
auto-pass (client-provisional: the DuckDB-WASM Run gives honest UI feedback, but Submit always passes).
58A lays the server-side comparator + audit + tests so a later **Phase 58B** can flip exactly one vetted
row — using the same dark→verify→flip discipline the `csv_set_equal` arc used (57A→0.z→0.zz→57B-flip→57B-postflip).

## 2. Files changed

- `artifacts/api-server/src/lib/grading.ts`
  - Extracted the Phase-57A `gradeCsvSetEqual` comparison body **verbatim** into a shared
    `gradeRowsetSubmission(s, submission)` core (spec validation → submission parse → column/row compare
    → multiset / order-sensitive / hash paths). `gradeCsvSetEqual` is now a thin opt-in-gate wrapper that
    delegates to it (byte-identical behavior; the live C2 step-3 csv row depends on it).
  - Added `gradeSqlResultset(spec, submission)` — same opt-in gate (`spec.serverGrade === true`), same
    `RowsetSpec` shape, same shared core. One comparator, two entry points (the 57A architect's anti-drift ask).
  - Added the `sql_resultset` dispatch case in `gradeSubmission` (after `csv_set_equal`, before `regex`;
    outer `&& step.validationConfig` guard preserved). Updated the dispatch JSDoc.
- `artifacts/api-server/src/lib/envelopeGrade.ts` — Added a DARK `sql_resultset` envelope branch identical
  in pattern to the existing dark `csv_set_equal` branch (structured `columns`/`rows` → canonical JSON →
  `gradeSubmission`; else `capture.stdout` fall-through). `sql_resultset` is deliberately **NOT** added to
  `PILOT_RUNTIME_KINDS` (provenance, not enforcement).
- `lib/curriculum-quality/src/authoring.ts` — Extracted `assertValidCsvSetEqualSpec`'s body into a shared
  `assertValidRowsetSpec(spec, kindLabel)` (error-prefix parameterized; logic unchanged).
  `assertValidCsvSetEqualSpec` + new `assertValidSqlResultsetSpec` are thin wrappers. Wired `sql_resultset`
  into `validationConfig`. The guard only validates when `serverGrade === true`, so the 25 legacy free-form
  sql_resultset specs pass through untouched.
- `artifacts/api-server/src/lib/grading.test.ts` — `sql_resultset` block: BC auto-pass for every live
  shape, opt-in positive, all fail-closed negatives, normalization edge cases (null/empty, numeric coercion,
  order sensitivity, boolean vs string), dispatch symmetry, and a "shares one comparator with csv_set_equal"
  assertion.
- `artifacts/api-server/src/lib/envelopeGrade.test.ts` — dark + opted-in `sql_resultset` envelope blocks.
- `lib/curriculum-quality/src/authoring.test.ts` — `sql_resultset` guard block (BC pass-through + opt-in
  accept/reject, with the `sql_resultset` error label).
- `scripts/src/audit-sql-resultset-bc.ts` (NEW) + `scripts/package.json` (`audit:sql-resultset-bc`).
- `docs/validation-kind-matrix.md` — `sql_resultset` row updated (dark foundation shipped).

## 3. Comparator semantics (when opted in — `serverGrade: true`)

Identical to `csv_set_equal` (one shared comparator). Submission contract: JSON
`{columns: string[], rows: (string|number|boolean|null)[][]}` — the DuckDB-WASM adapter capture shape.

- **column order** — positional; must match `spec.columns` order (case-sensitive unless `caseInsensitive`).
- **row order** — multiset (order-insensitive) by default; `orderSensitive: true` enforces positional
  comparison (for ORDER BY result-set contracts).
- **duplicate rows** — multiset cardinality matters by default; `dedupe: "expected" | "both" | false`.
- **numeric normalization** — numbers distinct from numeric strings by default; `coerceNumericStrings: true`.
- **null handling** — `null` distinct from `""` by default; `nullEqualsEmpty: true` collapses both to null.
- **date/string handling** — dates arrive as strings from the WASM capture; compared as strings;
  `trimStrings` / `caseInsensitive` knobs apply to string cells.
- **boolean handling** — booleans compared as booleans (`true` ≠ `"true"`).
- **Fails CLOSED** on: malformed JSON, raw SQL (non-JSON string), empty submission, wrong/missing columns,
  wrong row width, missing rows, extra unmatched rows, invalid spec shape (missing columns/expected,
  non-boolean flags, bad hex, `orderSensitive` + hash-only).
- **No answer-key exposure**: `expectedRows`/`expectedRowsHash` live only in `validation_config` server-side.
  `routes/projects.ts deriveServerGrade` is still gated to `csv_set_equal` only — `sql_resultset` surfaces
  no serverGrade signal to the client in 58A (FE wiring is a 58B concern).

## 4. Trust boundary (H3)

When a row eventually opts in, the strongest allowed claim is **"Atlas verified that the submitted result
rows matched the enabled SQL result validation checks."** Forbidden: independent authorship, no-outside-help,
cheat-proof, tamper-proof, job-readiness guarantee. Envelope **provenance** stays separate from envelope
**enforcement** (`sql_resultset` not in `PILOT_RUNTIME_KINDS`; `ATLAS_ENVELOPE_REQUIRED_KINDS` empty).
The `envelopeGrade.test.ts` H3 audit pins feedback strings against overclaim language.

## 5. Tests & gates (Node 24.16.0 + Docker PG :5434)

- `pnpm run typecheck` + `check:no-heuristic-runtime` — **PASS**.
- api-server vitest — **497/497** (was 466; +31 sql_resultset grading + envelope tests).
- curriculum-quality vitest — 143/144 (the 1 failure is the pre-existing env-only `COURSE_TAXONOMY` ENOENT —
  missing gitignored `.local/course-skill-maps.md`; unrelated).
- `audit:sql-resultset-bc` — **PASS**: 4 visible dark rows byte-identical to legacy auto-pass across
  28 bare-string + 12 envelope captures; 0 opted-in DB rows; synthetic opt-in simulation 7/7 (positive +
  6 fail-closed negatives).
- `audit:csv-set-equal-bc` — **PASS** (regression gate): the 1 LIVE opted-in csv row grades correctly
  through the refactored shared core → byte-identity proof.
- `audit:contains-bc` — **PASS** 3/3. `audit:authoring` — exit 0 (100 visible steps; histogram now lists
  `4 × sql_resultset [client-provisional]`, correct while dark).
- NOT run (not touched): execution-core, atlas frontend (zero FE changes), OpenAPI/Orval (no codegen change).

## 6. Inventory + the 58B candidate (do NOT flip yet)

Of 25 authored `sql_resultset` steps, only the **C2 semantic-layer** project
(`analytics-engineer-semantic-layer-with-dbt-and-duckdb`, now visible) has WASM-runnable steps with
self-contained inline DuckDB queries over committed seed CSVs (steps 1, 2, 5, 8). The other 21 target
Snowflake / PostgreSQL-procedural / Iceberg / external constructs the sandbox cannot run, or carry no inline
query (scalar-assertion specs only).

**Recommended single 58B candidate: C2 step 2 (SCD-2 invariants).** It already carries `expectedRows`
(array-of-objects `[{check:"one_current",value:0},{check:"overlap",value:0}]`), runs over `seeds/customers`,
and produces a deterministic 2-row invariant output that is `0/0` by construction (robust to numeric-fidelity
surprises). **Reshape needed for the flip** (58B, not now): add `columns: ["check","value"]`, convert
`expectedRows` to positional `[["one_current",0],["overlap",0]]`, set `serverGrade: true`, then byte-verify
in real browser DuckDB-WASM (the 0.zz process) before opting in. Alternates: step 5 (scalar `[[2746]]`) or
step 1 (`[[7,7]]`) — simpler but single-cell numeric-fidelity-sensitive.

## 7. Remaining risks / deferred

- **P2 (deferred R1, shared with csv):** `audit:authoring` still labels `sql_resultset` "client-provisional"
  (the classifier is not serverGrade-aware). Accurate while dark; revisit when teaching the classifier.
- **P2 (accept-with-note):** the audit's `extra-unmatched-row` / `wrong-columns` negatives use synthetic
  sentinel strings; collision-proof against any realistic expected row and unreachable today (0 opted-in
  sql rows). Non-blocking.
- 58B prerequisites (not done — deliberate): reshape one C2 step's spec → byte-verify in real browser WASM
  → extend `deriveServerGrade` to `sql_resultset` (FE signal) → flip exactly one row → post-flip review.
  Owner approval required to start 58B.

## 8. Hard-stops honored

No `serverGrade:true` added; no row opt-in; no envelope enforcement; no Phase 52 change; no env/canary; no
schema/migration; no OpenAPI/Orval codegen; no production change; no cloud; no waves; no certificate/portfolio/
marketing copy; no force-push; no secrets. `RUBRIC_VERSION` frozen.
