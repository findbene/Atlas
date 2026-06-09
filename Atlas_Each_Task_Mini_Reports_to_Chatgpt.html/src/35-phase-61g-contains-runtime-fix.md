# Phase 61G — Contains runtime contract fix + live honesty cleanup
META: 2026-06-08 · COMPLETED · fix(grading) · contains dead-gate fixed, 0 serverGrade drift · src in wip d5f59f1/d86e557, close-out c8a006c

## 1. Task Received
Phase 61G — fix the discovered live `contains` dead-gate (runtime passed the wrapped config instead of the inner spec; `mustContainAll` never read; bad submissions passed; false "server-enforced" copy) and clean up the false copy in the LIVE affected projects (C2 + SaaS mart). Allowed: narrowly fix the contains contract + tests + copy. Keep live serverGrade = 10. Stop after 61G.

## 2. Completion Status
**COMPLETED.** Runtime contract fixed (BC-safe spec extraction), C2 + SaaS `mustContainAll`→`needles`, SaaS false "server-enforced" claim removed, enforcement proven (rewritten audit 4/4 + 6 new unit tests + an authoring regression test). Reviews: **architect PASS + code-reviewer SHIP** (0 P0/P1). serverGrade unchanged = 10.

## 3. Files Changed
9 source: `grading.ts` (contains spec-extraction) · `grading.test.ts` (+6) · `authoring.ts` (reject `mustContainAll`) · `authoring.test.ts` (+2 regression) · `audit-contains-bc.ts` (enforcement rewrite) · C2 authored (s7 needles+copy) · SaaS authored (s7 needles + remove false claim) · `check-authored-saas-mart.ts` (needles+guard) · NEW `check-authored-c2.ts` · `package.json`. + close-out + progress. Bulk in wip `d5f59f1`/`d86e557` (pushed); close-out+test `c8a006c`.

## 4. Scope / Hard-Stops Check
New project/serverGrade flip? **no** · live count **10** · sql/csv comparator change? **no** · float/tolerance? **no** · envelope/Phase-52/schema? **untouched** · only the contains spec-EXTRACTION + tests + copy + checks changed. No leak. 61H not started.

## 5. Implementation Details
`grading.ts` contains branch now extracts `cfg.spec ?? validationConfig` (inner spec for the wrapped `validationConfig()` shape; top-level for legacy seed `{needle}` — BC). `matchContains` byte-unchanged. `assertValidContainsSpec` rejects the `mustContainAll` alias (narrow — a broad reject breaks importing the authored index, since ~15 projects use other bespoke dead keys). C2 + SaaS s7 converted to `needles` + honest copy; re-promoted (85.3 / 80.6 approved). `audit:contains-bc` rewritten from a BC-vs-auto-pass audit into an enforcement audit.

## 6. Tests and Gates Run (Node 24 + Docker PG :5434)
typecheck(4)+no-heuristic · check:boot · check:db-baseline (10) · check:authored-c2 (new) + saas-mart (needles+guard) + finops · **audit:contains-bc ENFORCEMENT PASS (4/4, 21 assertions, 0 fail)** · audit:sql-resultset-bc PASS (8 opted + 6 dark) · audit:csv-set-equal-bc PASS (2 + 1 dark) · audit:authoring (C2 85.3 + SaaS 80.6 + FinOps publish-ready) · audit:pedagogy (C2 + SaaS enriched) · api-server **654/654** (+6) · atlas **170/170** · integration **4/4** · authoring.test 59/59 (+2).

## 7. Failures, Fixes, and Surprises
- **Broad authoring guard backfired:** my first "reject all unrecognized contains keys" guard threw on import — ~15 authored projects use bespoke dead keys (`mustContain`/`userMsgMustContain`/`reportMustContain`/`expected`). Narrowed to reject ONLY `mustContainAll` (the named alias C2/SaaS used); documented the rest as a catalog-wide follow-up.
- **Discovered the `exact` dead-gate too:** C2 `exact` steps 4 + 6 have `expected_output NULL` → auto-pass while claiming an "exact-match check." Same class, different kind — documented as the **priority** follow-up (code-review flagged it).
- Architect asked for an authoring regression test for the `mustContainAll` reject → added (authoring.test 59/59).
- Session-end hook auto-committed the bulk as wip (pushed); not rewritten.

## 8. Current Git State
Branch `main`, HEAD `c8a006c` (close-out + regression test), pushed. 61G bulk in wip `d5f59f1`/`d86e557`. Tree clean except hook files.

## 9. Current Project State After This Task
The 4 live contains steps now ENFORCE (C2 s7 + SaaS s7 require their markers; the 2 legacy seed steps unchanged). C2 + SaaS + FinOps visible+approved. Global serverGrade = 10. No rowset/comparator drift.

## 10. Remaining Risks / Blockers
- **PRIORITY follow-up:** C2 `exact` steps 4 + 6 — live dead gates with false "exact-match check" copy (the `exact` runtime reads `expected_output`, which is NULL). Needs the same spec-extraction-or-population fix + copy cleanup.
- Catalog-wide bespoke-key contains (~15 mostly un-promoted projects) → content sweep to `needles`, then a hard authoring reject becomes feasible.
- Latent `regex` wrapper bug (0 live).

## 11. Recommended Next Step
Schedule the **`exact` dead-gate fix** (C2 steps 4,6 — live + inaccurate copy) as the next phase, optionally bundling the `regex` one-liner + starting the bespoke-key contains sweep. Then Phase 61H (owner-gated). Do not begin unprompted.

## 12. Explicit Stop Statement
**Stopped.** Contains dead-gate fixed + proven (enforcement audit 4/4, 654/654 tests); C2 + SaaS now enforce their markers; SaaS false claim removed; serverGrade=10; no comparator/Phase-52/envelope/schema drift; reviews PASS/SHIP. `exact` dead-gate + bespoke-key contains documented as follow-ups. **Phase 61H NOT started.**

---

## 13. Contains Defect Root Cause
`grading.ts:104-105` passed the WRAPPED `step.validationConfig` (`{kind, spec, description}`) to `matchContains`, which reads matcher fields off the TOP level (`needle`/`needles`). Authored markers live under `spec` → never read → with `expected_output NULL`, `matchContains` falls to `needle = expectedOutput ?? ""` → `includes("")` → auto-passes ANY submission. Plus `mustContainAll` is a key `matchContains` never reads (doubly dead).

## 14. Existing Contains Shape Inventory
4 visible: C2 s7 wrapped `{spec:{mustContainAll:[6]}}` (DEAD) · SaaS s7 wrapped `{spec:{mustContainAll:[5]}}` (DEAD + false copy) · csv-to-postgres s4 `{needle:"copy_expert"}` (legacy top-level, WORKS) · dbt-data-models s2 `{needle:"GROUP BY"}` (legacy, WORKS). Broader: ~15 authored projects use bespoke dead keys (follow-up).

## 15. Runtime Contract Fix
`const containsSpec = cfg.spec && typeof cfg.spec === "object" ? cfg.spec : step.validationConfig; return matchContains(containsSpec, …)`. Wrapped → inner spec (enforces); legacy top-level → config itself (unchanged). `matchContains` byte-unchanged. Authoring rejects `mustContainAll`.

## 16. Known-Bad Submission Proof
`audit:contains-bc` (enforcement, via REAL `gradeSubmission`): 4/4 marker-enforcing, 21 assertions, 0 failures — complete passes; empty + dropping ANY single marker fail closed. +6 grading.test.ts tests (wrapped needles all/missing/empty/garbage + single + legacy BC) + 2 authoring.test.ts (mustContainAll reject). All fail on the pre-61G code.

## 17. C2 Copy/Honesty Cleanup
C2 s7 `mustContainAll`→`needles` (6 markers: stakeholder headers + 3 exposures). Copy updated to "checks both files for the required marker phrases … confirms the markers are present, not that your prose is complete or expert-level, and Atlas does not verify independent authorship or professional competence." 85.3 approved. Server-graded set unchanged [1,2,3,5].

## 18. SaaS Mart Copy/Honesty Cleanup
SaaS s7 `mustContainAll`→`needles` (5 markers). **Removed** "This is server-enforced (the commit-grader evaluates your submission body)" → "Atlas checks the runbook for the required marker phrases … This confirms the markers are present, not that your prose is complete or expert-level, and Atlas does not verify independent authorship or professional competence." 80.6 approved (was 81.4).

## 19. FinOps Self-Attest Regression Result
FinOps step 7 unchanged (`self_attest`); `check:authored-finops-mart` green (6 dark + 1 self_attest + 0 contains + no false-enforcement). No re-promote needed. FinOps not affected by the contains fix.

## 20. ServerGrade Count Before/After
Unchanged: sql_resultset 8 + csv_set_equal 2 = **10** (DB-confirmed). contains is not a serverGrade kind; no flip; no rowset/comparator drift (audit:sql/csv-bc unchanged).

## 21. No-Leak and Export Stack Verification
Fix is entirely in `gradeSubmission` (server-side). Projection (`routes/projects.ts:307`) unchanged — emits only the `serverGrade` boolean; no spec/needles/expectedRows to the client. Contains-failure feedback names only a learner-STATED required marker (the exposure/check names in the instruction), not a computed answer. Export assembly unchanged: api-server 654/654 (incl. export-unit + portfolioZip) + integration 4/4; `/check` + `/submit` now enforce contains via the fixed path.

## 22. Contains BC Audit Result
`audit:contains-bc` is now an ENFORCEMENT audit (the old "byte-identical to legacy auto-pass" premise was invalidated by the fix). Result: 4/4 marker-enforcing steps, 21 assertions, 0 failures. The 2 legacy seed `{needle}` steps + the 2 converted `{needles}` steps all enforce; empty + each-marker-dropped fail closed. Known-bad case included (the brief's requirement).

## 23. Independent Review Results
- **atlas-architect-reviewer → PASS** (0 P0/P1): reproduced the dead-gate on old logic; confirmed the one-hunk BC-safe fix, enforcement audit 4/4, serverGrade=10, honest copy, no leak, defensible scope. P2 (ADDRESSED): added the `mustContainAll` authoring regression test. P2 (noted): pre-existing COURSE_TAXONOMY .local ENOENT; benign `spec:[]` fallback edge.
- **code-reviewer → SHIP** (0 P0/P1): root cause exact, BC-safe extraction, enforcement proven by the real grader, honest copy, zero drift, guard scoped to mustContainAll. **P2 (prioritize next):** C2 `exact` steps 4,6 dead gates with inaccurate copy — live, learner-facing. P2 (noted): regex latent; bespoke-key sweep.
