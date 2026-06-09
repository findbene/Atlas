# Phase 61H — Exact validation dead-gate fix + C2 honesty cleanup
META: 2026-06-08 · COMPLETED · fix(grading) · exact fail-closed, C2 4/6 → contains, 0 serverGrade drift · src in wip ab9353f/413c2b9, close-out 3dec3c2

## 1. Task Received
Phase 61H — fix the live `exact` dead-gate (C2 steps 4,6: `expected_output` null → auto-pass + false "exact-match check" copy, surfaced in 61G) + remove the false copy. Keep live serverGrade = 10. Stop after 61H.

## 2. Completion Status
**COMPLETED.** exact runtime fails closed on missing/empty expected; authoring guard rejects marker-key exact specs; C2 steps 4+6 converted exact→contains (honest marker checks). Reviews **architect PASS + code-reviewer SHIP** (0 P0/P1). serverGrade unchanged = 10.

## 3. Files Changed
9 source: `grading.ts` (exact fail-closed) · `grading.test.ts` (+5) · `authoring.ts` (assertValidExactSpec) · `authoring.test.ts` (+5) · NEW `audit-exact-bc.ts` · C2 authored (steps 4,6 exact→contains + copy + docblock) · `check-authored-c2.ts` · `package.json`. + close-out + progress. Bulk in wip `ab9353f`/`413c2b9` (pushed); close-out `3dec3c2`.

## 4. Scope / Hard-Stops Check
New project/flip? **no** · count **10** · sql/csv comparator? **no** · float/tolerance/envelope/Phase-52/schema? **untouched** · only the exact runtime fail-closed + authoring guard + C2 4/6 conversion + tests/audit/checks. No leak. 61I not started.

## 5. Implementation Details
exact branch: `if (exact){ if(!expected) FAIL_CLOSED; else compare }` (was `if (exact && expected){compare}` → auto-pass on null). `assertValidExactSpec` rejects `mustContainAll`/`needle`/`needles` on exact (narrow — the ~6 other authored exact projects use bespoke `expected*` keys, import-safe). C2 4,6 `exact`→`contains`, `mustContainAll`→`needles` (markers byte-unchanged), honest copy. Re-promoted C2 85.3.

## 6. Tests and Gates Run (Node 24 + Docker PG :5434)
typecheck(4)+no-heuristic · check:boot · check:db-baseline (10) · check:authored-c2 (3 contains needles, 0 exact, no false claims, set [1,2,3,5]) · saas-mart + finops · **audit:exact-bc PASS (0 visible exact dead gates + synthetic fail-closed)** · **audit:contains-bc 6/6 enforcing** (61G regression) · audit:sql/csv-bc PASS (no drift) · audit:authoring (C2 85.3 publish-ready) · audit:pedagogy (C2 enriched) · api-server **659/659** (+5) · atlas **170/170** · integration **4/4** · authoring.test **64/64** (+5).

## 7. Failures, Fixes, and Surprises
- **Discovered the exact dead-gate is catalog-wide too:** ~6 OTHER authored (un-promoted) projects (dbt-ci-state-modified, dbt-macros-mastery, hudi, iceberg, kserve, terraform-ml-platform) have exact steps with bespoke `expected*` keys the runtime never reads → same dead-gate family. Narrowed the authoring guard to marker keys only (so the index import doesn't break) + documented as a follow-up. My runtime fail-closed is safe (0 visible exact after C2 conversion).
- promote NEVER populates `expected_output` → authored exact is structurally unenforceable (the deeper root cause).
- Session-end hook auto-committed the bulk as wip (pushed); not rewritten.

## 8. Current Git State
Branch `main`, HEAD `3dec3c2` (close-out), pushed. Bulk in wip `ab9353f`/`413c2b9`. Tree clean except hook files.

## 9. Current Project State After This Task
0 visible exact steps (C2 4,6 now contains). C2 steps 4,6,7 all contains+needles, enforce. C2 + SaaS + FinOps visible+approved. serverGrade = 10. exact runtime fails closed for future misconfig.

## 10. Remaining Risks / Blockers
- **Follow-up:** catalog-wide bespoke-`expected*` exact (~6 un-promoted projects) — convert to contains/self_attest OR add an authoring→`expected_output` path. Plus the 61G contains bespoke-key sweep + latent regex bug.

## 11. Recommended Next Step
Schedule the bespoke-key sweep (contains + exact bespoke keys across the ~15+6 un-promoted authored projects) OR add an authoring→expected_output path. Then Phase 61I (owner-gated). Do not begin unprompted.

## 12. Explicit Stop Statement
**Stopped.** exact dead-gate fixed (fails closed + proven); C2 4,6 → honest contains marker checks; false "exact-match check" copy removed; serverGrade=10; 61G contains regression-green; no comparator/Phase-52/envelope/schema drift; reviews PASS/SHIP. Catalog-wide bespoke-`expected*` exact documented as follow-up. **Phase 61I NOT started.**

---

## 13. Exact Defect Root Cause
`grading.ts:99` gated on `validationType==="exact" && expected`; when `expected` (DB `expected_output`) is null it fell through to the generic auto-pass. The authoring→promote path NEVER populates `expected_output`, so every authored exact step shipped null-expected → auto-passed any submission. C2 4,6 also carried a `mustContainAll` spec exact never reads + false "exact-match check against the submission body" copy.

## 14. Exact Shape Inventory
2 VISIBLE exact steps — both C2 (4,6), both null-expected, both `{spec:{mustContainAll}}` (DEAD + false copy). No other visible project has exact. ~6 authored un-promoted projects carry exact with bespoke `expected*` keys (catalog-wide dead gates, follow-up).

## 15. Runtime/Authoring Contract Fix
Runtime: exact FAILS CLOSED when expected missing/empty; populated expected grades unchanged. Authoring: `assertValidExactSpec` rejects marker keys (`mustContainAll`/`needle`/`needles`) on exact → use contains. Narrow (bespoke `expected*` tolerated — import-safe).

## 16. Known-Bad Exact Submission Proof
New `audit:exact-bc` (real `gradeSubmission`): 0 visible exact dead gates + synthetic proof (null/empty expected → FAIL; populated → grades correctly). +5 grading.test (valid/wrong/empty/null-expected/empty-expected) + 5 authoring.test (marker-key rejection). All fail on pre-61H code. api-server 659/659; authoring 64/64.

## 17. C2 Step 4 Repair
"Define 5 canonical SaaS metrics in metrics.yml." `exact`→`contains`; `{mustContainAll:[10]}`→`{needles:[10]}` (5 name: + 5 expression: markers, unchanged). Honest copy: "Atlas checks that your metrics.yml contains all 5 canonical metric markers verbatim … not that the file is otherwise complete or expert-level, and Atlas does not verify independent authorship or professional competence." DB-confirmed contains; enforces.

## 18. C2 Step 6 Repair
"Schema tests + 4 singular tests." `exact`→`contains`; `{mustContainAll:[9]}`→`{needles:[9]}` (schema declarations + 4 test filenames). Honest copy mirroring step 4. DB-confirmed contains; enforces.

## 19. Copy/Honesty Cleanup
Removed both "server commit-grader does an exact-match check against the submission body" claims (steps 4,6). C2 docblock corrected (3 of 8 use contains; 4,6 converted from a dead exact gate). All 3 contains steps carry the "does not verify independent authorship or professional competence" disclaimer. `check:authored-c2` scans all step instructions → no false claim.

## 20. ServerGrade Count Before/After
Unchanged: sql 8 + csv 2 = **10** (DB-confirmed). exact/contains not serverGrade kinds; no flip; C2 set [1,2,3,5] unchanged; no rowset/comparator drift (audit:sql/csv-bc unchanged).

## 21. Contains Regression Result
61G contains fix holds: `audit:contains-bc` **6/6 marker-enforcing, 44 assertions, 0 failures** (C2 4,6,7 + SaaS 7 + 2 legacy seed). C2 4,6 (new contains) enforce their needles, no substring collisions. SaaS + FinOps unchanged (checks green). The contains runtime branch is untouched by 61H.

## 22. No-Leak and Export Stack Verification
Runtime fix is server-side (`gradeSubmission`); projection unchanged. 0 visible exact → no exact-expected leak surface; contains feedback names only learner-stated markers. Export unchanged: api-server 659/659 (incl. export-unit + portfolioZip) + integration 4/4; /check + /submit enforce contains via the unchanged 61G path.

## 23. Independent Review Results
- **architect → PASS** (0 P0/P1): re-derived against live DB — exact fails closed, zero live BC blast radius (visible+hidden exact = 0), C2 4,6,7 contains/needles enforce, 61G intact, serverGrade=10, no drift, guard rejects only marker keys (imported all 6 other exact projects — bespoke keys pass through). P2 (hygiene): wip-commit → clean conventional commit at close (done). P2 (noted): integration 4/4 run by orchestrator; optional audit synthetic-case polish.
- **code-reviewer → SHIP** (0 P0/P1): root cause via the real /submit route, known-bad fails on old code, guard rejects only 3 marker keys, C2 needles byte-identical, honest copy, 61G intact, no drift, audit safe. P2s = documented bespoke-`expected*` follow-up + narrow-guard (accept-with-note).
