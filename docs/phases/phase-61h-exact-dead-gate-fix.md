# Phase 61H — Exact validation dead-gate fix + C2 honesty cleanup (close-out)

**Status:** SHIPPED. Fixed the live `exact` dead-gate (C2 steps 4 + 6, surfaced
in 61G): the `exact` runtime now **fails closed** when no expected output is
configured, an authoring guard rejects marker-key exact specs, and C2 steps 4 + 6
were converted from the dead `exact` shape to honest `contains` marker checks
(reusing the 61G-fixed path). **No `serverGrade` flip (live count stays 10), no
sql_resultset/csv_set_equal comparator change, no envelope, no Phase 52, no
schema/migration.** Reviews: **`atlas-architect-reviewer` → PASS** +
**`code-reviewer` → SHIP** (§ below).

---

## 1. Baseline preflight
`check:db-baseline` OK; serverGrade sql 8 + csv 2 = 10; C2 + SaaS + FinOps
visible+approved; integration 4/4; tree clean+pushed.

## 2. Exact defect root cause (§13)
The `exact` runtime (`grading.ts:99`) gated on `validationType === "exact" &&
expected` — when `expected` (the DB `expected_output` column) is null/missing it
**fell through to the generic auto-pass** below. The authoring→promote path
(`author-project.ts`) **never populates `expected_output`** (it maps
`validationConfig`/`expectedOutputs` but not the `expected_output` text column),
so EVERY authored exact step shipped with `expected_output = NULL` → auto-passed
ANY submission (a dead gate). C2 steps 4 + 6 also carried a `mustContainAll` spec
the exact runtime never reads, and copy claiming "the server commit-grader does an
exact-match check against the submission body" — a false H3 claim.

## 3. Exact shape inventory (§14)
**2 VISIBLE exact steps** — both C2 (4, 6), both `expected_output = NULL`, both
`{kind:"exact", spec:{mustContainAll:[…]}}` (DEAD + false copy). **No other
visible project** has exact steps. Broader (tracked follow-up, NOT fixed): ~5
*authored, un-promoted* projects (`analytics-engineer__dbt-ci-state-modified`,
`cloud-data-engineer__dbt-macros-mastery` / `__hudi-mor-cdc-merge` /
`__iceberg-compaction-rewrite`, `mlops__kserve-multi-model`, …) carry exact steps
with bespoke `expected*` keys (`expectedSchemaPattern`, `singleColumnExpected`, …)
the runtime also never reads — catalog-wide exact dead gates, structurally
unfixable without an authoring→`expected_output` path. They are not live; a hard
guard against them would break the authored-index import (same constraint 61G hit
with contains).

## 4. Runtime / authoring contract fix (§15)
- **Runtime** (`grading.ts`): the exact branch now produces a definite verdict —
  if `expected` is missing/empty it **FAILS CLOSED** (`passed:false` with an
  authoring-defect message); a populated `expected` grades unchanged
  (`submission.trim() === expected`). No silent auto-pass.
- **Authoring** (`authoring.ts` `assertValidExactSpec`, wired into
  `validationConfig`): **rejects marker keys** (`mustContainAll`/`needle`/`needles`)
  on `exact`, pointing the author to `contains` with `needles`. Narrow (only
  marker keys) — the bespoke-`expected*` exact specs are tolerated (a broad reject
  breaks the index import) and surfaced as the §3 follow-up.

## 5. Known-bad exact submission proof (§16)
New `audit:exact-bc` (`audit-exact-bc.ts`) — read-only, via the REAL
`gradeSubmission`: asserts NO visible exact step has null/empty `expected_output`
(a step that can't grade must not ship; **0 after the C2 conversion**), plus a
DB-independent synthetic proof that a missing/empty expected FAILS and a populated
expected grades correctly. Result: **0 visible exact steps, 0 violations,
synthetic fail-closed proof PASS.** Plus 5 new `grading.test.ts` exact tests
(valid→pass, wrong→fail w/ expected in feedback, empty→fail, null expected→FAIL
CLOSED, empty expected→FAIL CLOSED) and 5 `authoring.test.ts` exact-guard tests —
all fail on the pre-61H code.

## 6. C2 step 4 repair (§17)
"Define 5 canonical SaaS metrics in metrics.yml." `exact`→`contains`;
`{mustContainAll:[10]}`→`{needles:[10]}` (the 5 `name:` + 5 `expression:` markers,
unchanged). Honest copy: "Atlas checks that your `metrics.yml` contains all 5
canonical metric markers … verbatim; every required marker must be present. This
confirms the required markers are present, not that the file is otherwise complete
or expert-level, and Atlas does not verify independent authorship or professional
competence." DB-confirmed `contains`; enforces (audit:contains-bc).

## 7. C2 step 6 repair (§18)
"Schema tests + 4 singular tests." `exact`→`contains`;
`{mustContainAll:[9]}`→`{needles:[9]}` (schema test declarations + 4 test
filenames, unchanged). Honest copy mirroring step 4. DB-confirmed `contains`;
enforces.

## 8. Copy / honesty cleanup (§19)
Removed both "server commit-grader does an exact-match check against the submission
body" claims (steps 4 + 6). The C2 file docblock updated (3 of 8 use `contains`
with `needles`; steps 4 + 6 converted from a dead exact gate). No
server-enforcement / exact-match / authorship / certification overclaim remains
(`check:authored-c2` scans all step instructions → none).

## 9. ServerGrade count before/after (§20)
Unchanged: **sql_resultset 8 + csv_set_equal 2 = 10** (DB-confirmed). exact and
contains are not serverGrade kinds; no flip; C2 server-graded set unchanged
`[1,2,3,5]`. No rowset/comparator drift (`audit:sql-resultset-bc` 8 opted + 6
dark, `audit:csv-set-equal-bc` 2 + 1 dark — unchanged).

## 10. Contains regression (§21)
61G contains fix holds: `audit:contains-bc` now **6/6 marker-enforcing, 44
assertions, 0 failures** (C2 4,6,7 + SaaS 7 + the 2 legacy seed steps). C2 steps
4 + 6 (new contains) enforce their needles with no substring collisions. SaaS mart
+ FinOps unchanged (checks green).

## 11. No-leak + export stack (§22)
The runtime fix is server-side (`gradeSubmission`); projection
(`routes/projects.ts`) unchanged — no spec/expected to the client. Exact-fail
feedback reveals the configured `expected_output`, but there are 0 visible exact
steps so no live leak surface; contains feedback names only learner-stated
markers. Export assembly unchanged: api-server **659/659** (incl. export-unit +
portfolioZip) + integration **4/4**; `/check` + `/submit` enforce contains via the
unchanged 61G path.

## 12. Gates (Node 24 + Docker PG :5434)
typecheck(4)+no-heuristic · check:boot · check:db-baseline (10) · check:authored-c2
(3 contains needles + 0 exact + no false claims + set [1,2,3,5]) ·
check:authored-saas-mart + finops · **audit:exact-bc PASS (0 dead gates + synthetic
fail-closed)** · **audit:contains-bc 6/6 enforcing** · audit:sql-resultset-bc PASS
(8 opted + 6 dark) · audit:csv-set-equal-bc PASS (2 + 1 dark) · audit:authoring (C2
85.3 publish-ready) · audit:pedagogy (C2 enriched) · api-server **659/659** (+5) ·
atlas **170/170** · integration **4/4** · authoring.test **64/64** (+5).

## 13. Reviews
- **atlas-architect-reviewer → PASS** (0 P0/P1). Re-derived every claim against
  the live DB + code: exact fails closed on null/empty expected (traced both
  paths); **zero live BC blast radius** (visible AND hidden exact = 0 after the C2
  conversion); C2 4,6,7 all `contains` with `needles` (markers byte-unchanged),
  step 4 enforces via real `gradeSubmission`; 61G contains branch untouched
  (`audit:contains-bc` 6/6); serverGrade=10, C2 set [1,2,3,5]; no
  sql/csv/Phase-52/envelope/schema drift; the guard rejects only marker keys
  (imported all 6 other exact projects — bespoke `expected*` keys pass through).
  - **P2 (close-out hygiene):** the source landed in a `chore: wip` auto-commit,
    not a conventional phase commit → this follow-up commit + close-out is the
    clean record (pushed wip not rewritten — no force-push to main).
  - **P2 (noted):** integration 4/4 was run by the orchestrator this phase (the
    architect ran unit only). Optional: a populated-expected-with-config synthetic
    case in `audit-exact-bc` (harmless — exact ignores validationConfig).
- **code-reviewer → SHIP** (0 P0/P1). Confirmed root cause via the real `/submit`
  route (`user.ts:859`), known-bad fails on old code, the guard rejects ONLY the 3
  marker keys (audited all other exact projects — bespoke `expected*` pass
  through), C2 needles byte-identical to the old `mustContainAll`, honest copy,
  61G contains intact, serverGrade=10, no comparator/Phase-52/envelope/schema
  drift, audit read-only + injection-free. grading.test 113/113, authoring 64/64.
  P2s = the documented catalog-wide bespoke-`expected*` follow-up + the
  deliberately-narrow guard (both accept-with-note).

## 14. Tracked follow-ups (NOT fixed in 61H)
- **Catalog-wide bespoke-`expected*` exact** (~5 un-promoted projects, §3): convert
  to `contains`/`self_attest`, OR add an authoring→`expected_output` path so true
  exact-match is authorable, then a hard exact-spec reject becomes feasible.
- The contains bespoke-key sweep (from 61G §11.1) + the latent `regex` wrapper bug
  remain open.

## 15. Invariants
Live serverGrade **= 10** (unchanged); exact now fails closed (no silent
auto-pass); `matchContains` + sql/csv comparators byte-unchanged; envelope OFF;
Phase 52 untouched; no schema/migration; RUBRIC frozen; C2 + SaaS + FinOps
visible+approved; no rowset drift; no leak; contains (61G) regression-green.
**Phase 61I not started.**
