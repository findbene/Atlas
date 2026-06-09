# Phase 61J — json_equal + numeric_tolerance contract + catalog-wide downgrade sweep
META: 2026-06-09 · COMPLETED · feat(grading) · json_equal+numeric_tolerance contracts + 211-step → self_attest sweep · serverGrade unchanged = 10 · Phase-52 byte-frozen · impl 21626ff, review-fix 15bf80b

## 1. Task Received
Phase 61J — repair the last two catalog-wide validation dead-gate families (`json_equal`, `numeric_tolerance`): both had no commit-path runtime branch → generic auto-pass. Build enforceable authoring/runtime contracts, tighten guards, extend the audit, and sweep the catalog — without drifting the Phase-48/52 json_equal envelope canary.

## 2. Completion Status
**COMPLETED.** Reviews **architect PASS** (after a 1-P1 H3 fix) **+ code-reviewer SHIP** (after the same P1). All gates green. No serverGrade flip; no sql/csv comparator, envelope, Phase-52, or schema change.

## 3. Files Changed
Runtime: `grading.ts` (json_equal + numeric_tolerance branches + local `deepEqualJson`). Guards: `authoring.ts` (assertValidJsonEqualSpec + assertValidNumericToleranceSpec, wired). Audit: `audit-validation-keys.ts` (both kinds + self_attest honesty lint). Tests: `grading.test.ts` (+15), `authoring.test.ts` (+13), `envelopeGrade.test.ts` (+2 canary regression). Sweep: ~16 distinct authored files (211 steps). Docs: close-out + progress. Commits: sweep/tests bulk in pushed wips `174d434`..`91cc449`; `21626ff` (residual); `15bf80b` (review fixes).

## 4. Scope / Hard-Stops Check
serverGrade flip? **no** (count **10**) · sql/csv comparator? **no** · envelope/Phase-52? **byte-frozen** (`envelopeGrade.ts` zero diff) · schema/migration? **no** · GitHub/publish? **no** · force-push? **no**. Next phase not started.

## 5. Implementation Details
json_equal runtime: parse submission as JSON, deep-equal vs `spec.expected`, fail-closed on missing expected / non-JSON. numeric_tolerance: parse submission as one number, pass iff |n−expected| ≤ tolerance, fail-closed on missing/non-finite/negative/non-numeric. Both read `validationConfig.spec` (NOT `expected_output`) → envelope canary untouched; local `deepEqualJson`. Guards = strict allowlists ({expected} / {expected,tolerance}). Sweep: 8 sweep workers + 3 correction workers (Sonnet); Opus reviewed all reports + verified the submission model.

## 6. Tests and Gates Run (Node 24 + Docker PG :5434)
typecheck+no-heuristic · **api-server 679/679** (+15 runtime, +2 canary) · **atlas 170/170** · **integration 4/4** · curriculum-quality 190/191 (1 pre-existing env-only `.local/course-skill-maps.md`) · **audit:validation-keys 0** (+ self_attest honesty lint) · contains-bc 6/6 · exact-bc PASS · sql/csv-bc no drift · check:authored-{c2 [1,2,3,5],saas,finops} · check:db-baseline **serverGrade=10** · audit:authoring + pedagogy exit 0.

## 7. Failures / Fixes / Surprises
- **Pivotal finding:** the FE submits the learner's editor CODE for these steps (`project-workspace.tsx:675-694` — raw editor contents except csv_set_equal serverGrade SQL rows), so neither comparator can grade ANY current authored step → **ALL 211 → self_attest** (0 kept; contracts ship built+tested but unexercised, the 61I exact precedent). An early pass "kept" ~30 integer-exact json_equal + 2 scalar numeric_tolerance on expected-shape alone; a correction pass downgraded them once the submission model was confirmed.
- **Both reviewers' P1 (H3):** 2 downgraded steps kept a false "Atlas checks the submitted numeric value…" instructionMd → fixed to honest self-verify copy; added a self_attest honesty lint to prevent recurrence.

## 8. Current Git State
`main`, HEAD `15bf80b`, history pushed. Tree clean except hook-managed `self-review.log` + `HANDOFF.md`.

## 9. Current Project State After This Task
0 authored json_equal/numeric_tolerance steps catalog-wide (audit-gated). Both kinds now fail-closed + authorable. serverGrade=10. No visible behavior change (latent). C2+SaaS+FinOps visible+approved.

## 10. Remaining Risks / Blockers
Contracts unexercised (forward-looking). **Phase 61K (code-review P2):** ~48 pre-existing self_attest steps retain stale "Validator runs/asserts" copy (soft honesty, not 61J-introduced). Real code grading still needs a Pyodide execution harness (future epic).

## 11. Recommended Next Step
**Phase 61K (owner-gated):** the ~48 "Validator runs/asserts" self_attest honesty cleanup, OR a learner-code execution-grading epic. Do not begin unprompted.

## 12. Explicit Stop Statement
**Stopped.** Phase 61J shipped, reviewed (architect PASS + code SHIP after the P1 fix), gates green, serverGrade=10, Phase-52 byte-frozen, close-out + progress committed. **Phase 61K NOT started.**

---

## 13. json_equal Root Cause
`gradeSubmission` had no json_equal case → generic auto-pass (dead gate). The envelope deep-equal comparator reads `expected_output` (never populated) + is gated off + operator-pending (Phase 52).

## 14. json_equal Shape Inventory
49 authored files; dominant `{expected:<object>}` mixing exact ints/bools/strings, `*_approx` floats, behavioral booleans, per-scenario `cases` + bespoke `{assert*,mocked*,expect*}`. 0 visible.

## 15. json_equal Contract Fix
Canonical `{expected:<json>}`; runtime deep-compares submission vs `spec.expected` (key-order-insensitive, array-order-significant, exact numbers), fail-closed on missing/non-JSON. Guard requires `expected`, allowlist {expected}. Reads spec (not expected_output) → envelope frozen; local deepEqualJson.

## 16. json_equal Known-Bad Proof
grading.test (real gradeSubmission): match passes; wrong/array-reorder/non-JSON/empty/missing-expected fail closed; legacy top-level works. All fail on pre-61J code.

## 17. numeric_tolerance Root Cause
No numeric_tolerance case anywhere in gradeSubmission → generic auto-pass.

## 18. numeric_tolerance Shape Inventory
21 files; dominant `{expected:<object of numbers>, tolerance:<scalar>}` with mixed ≥/≤/≈ threshold semantics + bespoke `{toleranceFraction,floors,speedupRatio,…}`. A symmetric ± band cannot honestly express thresholds/multi-field. 0 visible.

## 19. numeric_tolerance Contract Fix
Canonical scalar `{expected:<number>, tolerance:<number>}`; runtime |n−expected|≤tolerance, fail-closed on missing/non-finite/negative/non-numeric. Guard requires finite numeric expected + non-negative tolerance, allowlist {expected,tolerance}.

## 20. numeric_tolerance Known-Bad Proof
grading.test: in-tolerance + boundary pass; out-of-tolerance/non-numeric/empty/missing-expected/missing-or-negative-tolerance fail closed. All fail on pre-61J code.

## 21. Catalog Sweep Result
**211 steps → self_attest (174 json_equal + 37 numeric_tolerance) — the only validationType transitions in the phase. 0 remain** (grep + audit verified). Honest self_attest copy + non-empty attestationCriteria on each.

## 22. Promotion / Runtime Mapping Result
No promote mapping change (json_equal/numeric_tolerance read `spec`, already persisted). The FE submits editor code → neither comparator can grade a current step → all-downgrade (the honest call; "keep only where genuinely gradeable" = none).

## 23. Copy / Honesty Cleanup
Honest self_attest line on all converted steps; workers repaired false "verified via numeric_tolerance"/"Validator:"/"Every step verified" prose. The 2-step P1 false "Atlas checks the submitted numeric" claim fixed; new self_attest honesty lint guards the H3 class catalog-wide. check:authored-c2/saas/finops green.

## 24. Phase 52 / Canary Non-Drift Verification
`envelopeGrade.ts` byte-frozen (zero diff since 58A); PILOT_RUNTIME_KINDS/ATLAS_ENVELOPE_REQUIRED_KINDS untouched; expected_output not populated. Fallback split (2 new envelope tests): validationConfig-null gap still default-passes (preserved); populated-config-without-spec.expected now fails closed (fail-closed philosophy supersedes the old default-pass). Moot: canary off + 0 authored json_equal.

## 25. ServerGrade Count Before/After
Unchanged: sql 8 + csv 2 = **10** (DB-confirmed). No flip; C2 set [1,2,3,5]; no rowset/comparator drift.

## 26. Contains / Exact / Regex Regression Result
61G contains-bc 6/6; 61H exact-bc PASS; 61I validation-keys 0 (now also json_equal/numeric_tolerance). contains/exact/regex/rowset runtime branches byte-untouched.

## 27. Export / No-Leak Verification
Server-side gradeSubmission changes only; projection unchanged. 0 authored json_equal/numeric_tolerance → no spec.expected leak surface. Export stack: api-server 679/679 (incl. export-unit + portfolioZip) + integration 4/4.

## 28. Independent Review Results
- **atlas-architect-reviewer → FAIL (1 P1 H3 false-grading claim) → re-review PASS** after the 2-step copy fix + honesty lint + canary regression test + wording corrections. Verified: root cause + fail-closed, envelopeGrade byte-frozen, sweep complete+honest, serverGrade=10, no drift.
- **code-reviewer → NO-SHIP (same P1) → SHIP** after the P1 fix. Verified: runtime additive (no fail-open across 22 edge cases), deepEqualJson logic-identical to the envelope copy, guards narrow-but-complete, tests pin the fix, 211 conversions the only transitions.

## 29. Remaining Risks / Recommended Next Phase
Contracts unexercised. **Phase 61K (owner-gated):** ~48 pre-existing "Validator runs/asserts" self_attest copy cleanup, or a learner-code execution-grading harness. 0 live dead gates today. Do not begin unprompted.
