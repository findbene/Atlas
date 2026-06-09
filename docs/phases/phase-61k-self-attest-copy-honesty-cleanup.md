# Phase 61K — self_attest copy honesty cleanup (close-out)

**Status:** SHIPPED (pending the two review verdicts in §22). Cleans the
pre-existing misleading copy on `self_attest` steps that Phase 61J flagged as a
follow-up: ~65 self_attest steps' `instructionMd` claimed an automated
"Validator runs/asserts/drives X" (or similar) did the checking — false, since a
self_attest step performs NO grading (Atlas records the attestation, does not run
or verify the learner's code). All rewritten to honest "Self-check: … confirm …"
copy that preserves the pedagogical scenario; a catalog **honesty lint** now
prevents the class from reappearing.

**Copy-only + lint. No runtime/comparator change, no new validation kind, no
serverGrade flip (live count stays 10), no schema/migration, no Phase-52/envelope
change, no GitHub/export change.**

## 1. Baseline preflight
Branch `main`; 61J tip `7ff4ba0` (HEAD `09f583e` = a stray hook commit of
`self-review.log` only). `check:db-baseline` OK; serverGrade `sql` 8 + `csv` 2 =
**10**; C2 + SaaS + FinOps visible+approved; 0 authored json_equal/numeric_tolerance;
`audit:validation-keys` key-checks green.

## 2. Self-attest copy inventory (§13)
**220 authored self_attest steps.** A throwaway diagnostic
(`diag-self-attest-copy.ts`, deleted after use) scanned each self_attest step's
`instructionMd` + `validation.description` + pedagogy for misleading
automated-validation language with negation/learner-subject suppression. Result:
**67 flagged phrase matches in `instructionMd` across ~24 projects** (0 in
description/pedagogy — those were already honest from 61I/61J).

## 3. Misleading phrase classes found (§14)
- **66/67 = "Validator runs/asserts/drives/hits/checks X"** — an automated
  validator described doing the work (the dominant class; e.g. "Validator drives 4
  timestamps with 4 transforms", "Validator asserts post-compact … ≤ X").
- **1/67 = "the validator asserts that …"**. No `server-enforced` / `commit-grader`
  / `Atlas verifies` / `automated validation` / `graded by` instances remained in
  self_attest instructionMd (61I/61J had already removed those classes).

## 4. Copy cleanup summary (§15)
6 parallel Sonnet workers rewrote every flagged self_attest `instructionMd` clause
to honest self-check copy — flipping the subject from "Atlas/Validator does X" to
"you verify X" while **preserving the concrete scenario** (fixtures, counts,
thresholds, expected values — valuable learner guidance). Example: "Validator runs
the task twice for the same execution_date and asserts 500 rows." → "Self-check:
run the task twice for the same execution_date and confirm 500 rows…". Workers
touched ONLY self_attest steps; all `contains`/`exact`/`sql_resultset`/
`csv_set_equal`/`regex` steps (which legitimately mention "Validator"/"Atlas
checks") were left untouched. Opus reviewed every worker report.

## 5. Audit / lint guardrail added (§16)
New exported `selfAttestHonestyViolations(text)` in
`lib/curriculum-quality/src/authoring.ts` (unit-tested) returns the misleading
phrases in a string (empty = honest). It flags: `Atlas (checks|verifies|grades|
validates|confirms|runs|executes)`, `server-(verifies|confirms|enforced|…)`,
`commit-grader`, `automated (check|validation|grading|grader)`, `(graded|validated|
verified) by (atlas|the server/grader/…)`, and capital-`Validator (runs|asserts|
drives|…)` as an automated subject. **Precision guards:** a negation within ~20
chars ("Atlas does NOT run/grade…") and a learner-owned validator ("your/a/the/own
… validator") are NOT flagged. `audit:validation-keys` calls it on every
self_attest step's instructionMd and fails on any hit, so CI gates the class.
(Replaces the narrower Phase-61J "Atlas checks/verifies/grades"-only lint.)

## 6. Planted bad-copy proof (§17)
`authoring.test.ts` (+14): misleading variants ("Validator runs", "Validator
asserts", "Validator drives", "server-enforced", "Atlas verifies", "commit-grader",
"graded by Atlas", "automated validation") all flagged; honest variants (the
attestation line, "Atlas does not verify…", "Self-check: …", "your validator
runs…", empty/plain) all pass. The catalog audit, run before the sweep, flagged 65
violations; after the sweep it reports 0.

## 7. C2 / SaaS / FinOps verification (§18)
None of C2 (`analytics-engineer-semantic-layer-with-dbt-and-duckdb`), SaaS-mart
(`data-engineering-saas-usage-revenue-quality-mart`), or FinOps
(`cloud-data-engineer-finops-cost-quality-mart`) appeared in the flagged inventory
— their self_attest copy was already honest. `check:authored-{c2,saas-mart,finops}`
green; serverGrade set unchanged.

## 8. Validation contract regression (§19)
61G contains-bc 6/6; 61H exact-bc PASS; 61I/61J `audit:validation-keys` key-checks
green (contains/exact/regex/json_equal/numeric_tolerance still canonical, 0 bespoke
dead gates). No runtime/comparator file touched (copy + lint only).

## 9. ServerGrade count before/after (§20)
Unchanged: `sql_resultset` 8 + `csv_set_equal` 2 = **10**. No flip; C2 set [1,2,3,5];
no rowset/comparator drift.

## 10. Export / no-leak (§21)
Copy-only instructionMd edits; no runtime/projection/export change. Export stack:
api-server + atlas + integration unchanged + green; portfolio/repo-JSON/repo-ZIP
tests green.

## 11. Gates
typecheck+no-heuristic · api-server · atlas · integration · curriculum-quality
(incl. +14 lint tests; the 1 pre-existing env-only `.local/course-skill-maps.md`
failure remains) · audit:validation-keys (0, incl. self_attest honesty lint) ·
contains-bc 6/6 · exact-bc PASS · sql/csv-bc no drift · check:authored-{c2,saas,finops}
· check:db-baseline serverGrade=10 · audit:authoring + pedagogy exit 0.

## 12. Commits
Sweep + lint + tests in pushed session wips + a clean conventional commit; close-out
+ archive follow. The throwaway `diag-self-attest-copy.ts` was deleted before commit.

## 13. Independent reviews (§22)
- **atlas-architect-reviewer → PASS** (0 P0/P1). Re-derived every claim: 0 misleading
  self_attest copy (own broader scan of all 220 steps = 0 residual); rewrites
  product-grade + scenario-preserving; no runtime/comparator/schema/Phase-52 drift;
  serverGrade=10; H3 intact; diag deleted. 3 deferrable P2s → **all fixed**.
- **code-reviewer → SHIP** (0 P0/P1). Verified the lint compiles + behaves on Node 24
  (lookbehind, negation, learner-validator suppression), the 14 tests pin each
  pattern, only instructionMd changed across 33 files, the 3 serverGrade files
  untouched, no runtime drift. Low/informational notes → folded into the P2 fixes.

**P2 fixes applied (post-review hardening):** (1) corrected the stale "Phase 61J"
audit-lint comment; (2) broadened `selfAttestHonestyViolations` — lowercase/`The`
`validator <verb>` (case-insensitive lookbehind), `server validates/validated`,
`Atlas asserts/evaluates`, `auto-graded`, `the grader <verb>` — while still NOT
flagging a learner-owned "your/a validator runs" or a legit "the server runs in
production"; (3) the audit now lints the `validation.description` too, not just
`instructionMd`. +8 lint tests. `audit:validation-keys` still 0 (no catalog false
positives).

## 14. Remaining risks / recommended next phase (§23)
- The honesty lint covers self_attest `instructionMd`. A future pass could extend it
  to non-self_attest steps' "Validator runs" copy (a `contains` step saying
  "Validator runs your code" overstates what substring-matching does) — lower
  priority since those kinds do perform a real check.
- Real learner-code grading still needs a Pyodide execution harness (a future epic)
  — self_attest is the honest interim for code steps.
- `.gitattributes` EOL-normalize (recurring CRLF churn).

## 15. Invariants
serverGrade **= 10**; no validation runtime/comparator change; envelope OFF;
Phase 52 untouched; no schema/migration; RUBRIC frozen; C2 + SaaS + FinOps
visible+approved; 61G/61H/61I/61J regressions green; every self_attest step now
honest about what Atlas does and does not verify; honesty lint gates recurrence.
**Next phase not started.**
