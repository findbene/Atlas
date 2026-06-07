# Phase 58B — first controlled `sql_resultset` server-grade flip (close-out)

**Status:** SHIPPED. The first LIVE `sql_resultset` server-grade opt-in. **Exactly ONE row** opted in
(C2 step 2, SCD-2 invariants). Browser-WASM byte-verified + end-to-end verified through the live grader.
Envelope enforcement remains OFF. Phase 52 untouched. Mirrors the csv_set_equal 57B-flip.

Independent reviews: **`atlas-architect-reviewer` → PASS** + **`code-reviewer` → SHIP**, no P0/P1. The
architect's P2-1 (no route test pinned the no-leak property) was **fixed this phase** (new
`projects-server-grade.test.ts`). Remaining P2s deferred with rationale (below).

---

## 1. The flip (exactly one row)

- **Project:** `analytics-engineer-semantic-layer-with-dbt-and-duckdb` (C2, visible + approved).
- **Step:** 2 — "Star schema — SCD-2 dim_customer …". `sql_resultset`, `code_sql`.
- **Spec reshape** (`scripts/src/authored/analytics-engineer__semantic-layer-with-dbt-and-duckdb.ts`):
  added `serverGrade: true` + `columns: ["check","value"]`; converted `expectedRows` from array-of-objects
  `[{check,value}]` to the positional server contract `[["one_current",0],["overlap",0]]`. The reference
  `query`, `starterCode`, instructions, and pedagogy are **unchanged** — only the server validation
  contract changed; the learner task is identical.
- **DB after `author:project promote` + `audit --commit`:** step 2 `serverGrade=true`, `columns
  ["check","value"]`, `expectedRows [["one_current",0],["overlap",0]]`; qualityScore **87.30 → approved**;
  global visible `serverGrade=true` counts = **csv_set_equal:1, sql_resultset:1** (exactly one each).

## 2. Server signal wiring (Task 5)

- `artifacts/api-server/src/routes/projects.ts` — `deriveServerGrade` gate widened from `csv_set_equal`
  only to `csv_set_equal` OR `sql_resultset`. It still returns **only a narrow boolean**; the step
  serializer is a closed allow-list that never emits `validationConfig`/`spec`/`expectedRows`/`query`.
- `artifacts/atlas/src/pages/project-workspace.tsx` — 2 comment-only updates. No logic change: the
  Check/Submit routing is already `serverGrade === true && isSqlStep` (kind-agnostic), so the flipped
  `code_sql` row routes its captured `{columns,rows}` JSON automatically. `needs-run` stays a neutral nudge.
- No OpenAPI/Orval change: `serverGrade` was added to `ProjectStep` in 57B; the field already exists.

## 3. Real browser-WASM byte verification (Task 4)

Real `@duckdb/duckdb-wasm@1.33.1-dev45.0` in headless Chromium (playwright-cli), running step 2's exact
shipped `starterCode` over the committed `seeds/customers.csv`, via the real `duckdbAdapter` (the identical
path `project-workspace.tsx` uses on Run):

```
columns  = ["check","value"]
normRows = [["one_current",0],["overlap",0]]   (after normalizeSqlRows — identity here)
cellTypes= ["string","number"]                  (value=0 is a JS number, not bigint/string)
```

**Byte-identical to the committed `expectedRows`.** (Consistent with Phase 0.zz, which first verified step 2.)
`count(*)` bigint is coerced to a JS `number` by the adapter when it round-trips losslessly (0 does).

## 4. Integration verification (Task 6) — end-to-end through the LIVE DB grader

Fed the exact real-browser capture to `gradeSubmission` against the live DB step row:

- **Positive:** real capture → `passed:true "Correct!"`.
- **Fail-closed (all 7):** raw SQL, malformed JSON, wrong columns, missing row, extra unmatched row,
  wrong row value, empty → all `passed:false`.
- **BC:** non-opted sql_resultset (step 1) → `passed:true "Step completed."` (dark preserved).
- **Regression:** live csv_set_equal (step 3) → still `passed:true "Correct!"`.

## 5. Independent reviews (Task 7)

- **architect-reviewer: PASS.** Traced authored spec → promote → DB → serialization → FE → grader. Confirmed
  no answer-key leak, exactly one opt-in, learner task preserved, envelope off, numeric fidelity, scope clean.
  - **P2-1 (fixed this phase):** no route test pinned the GET /projects/:slug no-leak property → added
    `artifacts/api-server/src/routes/projects-server-grade.test.ts` (serverGrade boolean surfaced; no
    `validationConfig`/`spec`/`expectedRows`/`query` leaked; full-body answer-key scan).
  - **P2-2 (deferred R1):** `audit:authoring` labels sql_resultset "client-provisional" (classifier not
    serverGrade-aware) — informational, carried from 58A.
- **code-reviewer: SHIP.** Same conclusions.
  - **P2 (fixed):** stale `grading.ts` comment ("deriveServerGrade … only for csv_set_equal") → updated.
  - **P2 (deferred):** `openapi.yaml` `serverGrade` description mentions only 57B/csv — reviewer confirms it
    is generic ("an opted-in SQL step") and not misleading; **deferred to avoid OpenAPI/codegen churn**
    (hard-stop: no codegen unless required).

## 6. Tests & gates (Node 24.16.0 + Docker PG :5434)

- `pnpm run typecheck` + `check:no-heuristic-runtime` — **PASS**.
- api-server vitest — **502/502** (+5: the new no-leak route test).
- atlas vitest — **159/159**. curriculum-quality — 143/144 (only failure = pre-existing env-only
  `COURSE_TAXONOMY` ENOENT).
- `audit:sql-resultset-bc` — **PASS** (3 dark rows byte-identical across 21 bare-string + 9 envelope
  captures; **1 opted-in DB row** + synthetic opt-in all grade correctly: correct capture passes; raw SQL /
  malformed / empty / wrong-columns / missing-row / extra-unmatched-row fail closed).
- `audit:csv-set-equal-bc` — **PASS** (the 1 live csv row regression-safe). `audit:contains-bc` — 3/3.
  `audit:authoring` — exit 0 (`4 × sql_resultset`, `1 × csv_set_equal`, both still labeled
  client-provisional pending the R1 classifier fix).

## 7. Final invariants (Task 9) — confirmed

- exactly **1** `sql_resultset` row opted in (C2 step 2); exactly **1** `csv_set_equal` row remains opted in
  (C2 step 3); **no other** `serverGrade:true` rows (source grep + DB).
- C2 remains visible + approved (87.30). Envelope enforcement OFF (`PILOT_RUNTIME_KINDS={json_equal}`,
  `ATLAS_ENVELOPE_REQUIRED_KINDS` empty; envelope files untouched). Phase 52 untouched.
- No schema/migration/env/canary/production/cloud/wave/cert-marketing change. `RUBRIC_VERSION` frozen.
  Hidden→404 unchanged. No row deletes. H3 honesty preserved.

## 8. Verification harness note

The browser-WASM + live-grader harness (extractor, Vite harness page/main, grader script, capture file,
`.playwright-cli/`) was temporary and **deleted after capture** — only the 5 source files + docs persist.

## 9. Remaining risks / next

- Deferred P2s: OpenAPI `serverGrade` description polish; `audit:authoring` serverGrade-awareness (R1).
- Observe the single live opted-in sql_resultset row in a real env before any second opt-in.
- Pre-existing low-risk: `.gitattributes` EOL normalization for `lib/*/src/generated/**`; Linux/CI lockfile regen.
- **Phase 59** (`/check`-vs-`/submit` evidence) is next — **owner approval required; not started.**
