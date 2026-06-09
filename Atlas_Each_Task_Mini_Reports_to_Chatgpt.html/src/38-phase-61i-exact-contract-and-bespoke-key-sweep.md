# Phase 61I — Exact authoring→runtime contract + catalog-wide bespoke-key sweep
META: 2026-06-08 · COMPLETED · feat(grading) · exact contract + strict guards + regex fix + 21-file sweep · serverGrade unchanged = 10 · impl e9515d8, close-out 8afb91f

## 1. Task Received
Phase 61I — repair the authoring/promotion trust gap from 61H: authored validation steps could carry spec keys the runtime never reads (`contains`/`exact`/`regex`) → dead gates. Implement the exact authoring→runtime contract (owner-approved over "ban exact"), tighten guards, fix the latent regex wrapper, sweep all bespoke keys to canonical needles/expected or honest self_attest (forbidden/exit-code/count → self_attest, owner-approved), in parallel. Keep live serverGrade = 10.

## 2. Completion Status
**COMPLETED.** Reviews **architect PASS + code-reviewer SHIP** (0 P0/P1). All gates green. No serverGrade flip; no sql/csv/envelope/Phase-52/schema/GitHub change.

## 3. Files Changed
Contract/guards/runtime: `scripts/src/author-project.ts` (`exactExpected` + promote map) · `lib/curriculum-quality/src/authoring.ts` (exact require-`expected`+allowlist, contains allowlist, new regex guard) · `artifacts/api-server/src/lib/grading.ts` (regex inner-spec extraction). New gate: `scripts/src/audit-validation-keys.ts` + `scripts/package.json`. Tests: `authoring.test.ts` (+13), `grading.test.ts` (+3). Sweep: **21** `scripts/src/authored/*.ts` files. Docs: close-out + progress. Bulk in wip `0d08b2b`/`8cad9df`; contract+guards+guardrails+dbt-revert+tests+audit in `e9515d8`; close-out+cleanup `8afb91f`. Removed stray `.tmp_guardrails_old.ts` (hook-committed review scratch).

## 4. Scope / Hard-Stops Check
serverGrade flip? **no** (count **10**) · sql/csv comparator? **no** · float/tolerance/envelope/Phase-52/schema? **untouched** · GitHub/OAuth/publish? **no** · force-push? **no** · json_equal/numeric_tolerance? **deferred to 61J** (dbt-macros step 2 reverted to original json_equal). 61J not started.

## 5. Implementation Details
Exact: promote writes `expectedOutput: exactExpected(s)` (= `spec.expected` for exact, null else → BC); guard requires non-empty `expected` + allowlist. Contains/regex: strict allowlists at construction. Regex runtime reads `cfg.spec ?? config`. Sweep via 7 parallel Sonnet workers + an allowlist-audit-caught straggler (guardrails, 7 steps); Opus reviewed every diff; markers byte-preserved; honest copy; forbidden/exit-code/count/multi-scenario → self_attest.

## 6. Tests and Gates Run (Node 24 + Docker PG :5434)
typecheck(4)+no-heuristic · **api-server 662/662** (+3) · **atlas 170/170** · **integration 4/4** · curriculum-quality 177/178 (1 pre-existing env-only `.local/course-skill-maps.md`) · **audit:validation-keys 0 violations** (60 projects, 38 steps) · audit:contains-bc 6/6 · audit:exact-bc PASS · audit:sql-resultset-bc + csv-set-equal-bc no drift · check:authored-{c2 [1,2,3,5],saas-mart,finops} · check:db-baseline **serverGrade=10** · audit:authoring + audit:pedagogy exit 0.

## 7. Failures / Fixes / Surprises
- **Surprise:** the bespoke-key surface was bigger than the brief (21 files, not ~18); the **allowlist audit caught a straggler** (`guardrails-and-structured-output-safety`, 7 steps) my denylist greps missed — fixed.
- **Scope catch:** a worker converted dbt-macros step 2, which was originally `json_equal` (out of scope) → **reverted byte-for-byte**.
- **json_equal + numeric_tolerance are ALSO dead-gate kinds** (no runtime branch) — out of 61I scope; DB census shows **0 visible** of either → no live dead gate; deferred to 61J.
- Session-end hook auto-committed the sweep bulk as wip + a review scratch file (`.tmp_guardrails_old.ts`) — removed.

## 8. Current Git State
`main`, HEAD `8afb91f` (close-out), pushed-history clean. Tree clean except hook-managed `self-review.log` + `HANDOFF.md`.

## 9. Current Project State After This Task
0 authored bespoke contains/exact/regex keys catalog-wide (audit-gated). Exact is now a real authorable+enforceable contract. serverGrade live = 10. No visible behavior change (sweep is latent until next promote). C2 + SaaS + FinOps visible+approved.

## 10. Remaining Risks / Blockers
Conversions are **latent** — they change DB grading only on next `promote`; run `audit:contains-bc` after any future promote of a swept project (+ eyeball a reference solution where a conversion tightened the marker set, e.g. dbt-ci-state step 4). The `json_equal`/`numeric_tolerance` dead-gate kinds remain (61J).

## 11. Recommended Next Step
**Phase 61J (owner-gated):** catalog-wide `json_equal` + `numeric_tolerance` dead-gate sweep. `json_equal` overlaps the Phase-52 operator-pending canary kind — coordinate. Do not begin unprompted.

## 12. Explicit Stop Statement
**Stopped.** Phase 61I shipped, reviewed (PASS/SHIP), gates green, serverGrade=10, close-out + progress committed, stray file removed. **Phase 61J NOT started.**

---

## 13. Exact Authoring Contract Decision
Implemented the clean contract (owner-approved). Canonical `validationConfig("exact", …, {expected})`; promote maps `spec.expected` → `expected_output`; guard requires non-empty string `expected`. Runtime unchanged (61H fail-closed). Ships ready-but-unexercised (0 authored exact remain — all 6 were free-form YAML/CLI, converted) — proven by tests + audit, not live rows.

## 14. Exact Shape Inventory
6 un-promoted exact files (kserve, terraform-ml, hudi, iceberg, dbt-macros, dbt-ci-state) using bespoke `expected*` keys over free-form YAML/Terraform/CLI. 0 visible exact (DB-confirmed). 0 true full-document-exact candidates.

## 15. Bespoke Exact-Key Sweep Result
Each exact step → `contains`/`needles` where literal config markers capture the essence (e.g. `kind: ServingRuntime`, `type: prometheus`, `threshold: "10"`, IAM actions, dbt flags), or → `self_attest` where structural/behavioral with no clean literal (iceberg step 3). Markers byte-preserved. A few conversions tightened the marker set beyond the original (dead) single-key (architect P2-1, accept-with-note; un-promoted).

## 16. Bespoke Contains-Key Sweep Result
15 contains files (incl. the audit-caught guardrails straggler): positive-marker steps → `needles` (byte-preserved; `needle`+`secondaryNeedle` merged); forbidden / exit-code / count / multi-scenario steps → `self_attest` with non-empty `attestationCriteria`. Honest copy throughout. `audit:validation-keys` PASS (0 bespoke keys remain).

## 17. Promotion/Runtime Mapping Fix
`promote` stepRows now writes `expectedOutput: exactExpected(s)` — `spec.expected` string only for exact, null otherwise (byte-identical BC for every non-exact step; the 10 rowset rows + all contains/self_attest/json writes unchanged). Verified: serverGrade=10, sql/csv-bc no drift, `validationType`↔`kind` agree on all 310 authored steps (reviewer).

## 18. Known-Bad Exact Proof
`audit:exact-bc` (real `gradeSubmission`): 0 visible exact dead gates + synthetic fail-closed. `grading.test` exact: null/empty expected → fail-closed; populated → grades. `audit:validation-keys` rejects empty/bespoke exact catalog-wide (architect planted bad specs — not a vacuous pass). New tests fail on pre-61I code.

## 19. Authoring Guard Proof
`assertValidExactSpec` (require `expected` + allowlist), `assertValidContainsSpec` (allowlist {needle,needles,match,caseInsensitive}), new `assertValidRegexSpec` (compiling non-empty `pattern`, allow pattern/flags) — all run at `validationConfig()` construction (proven: whole-index import exits 0). +13 authoring tests. Narrow-but-complete: allowlists exactly match runtime-read keys.

## 20. Copy/Honesty Cleanup
Every converted step's copy claims only what's true: contains = "Atlas checks required evidence markers are present … not that the program otherwise runs correctly, and not your authorship or competence"; self_attest = "a learner attestation — Atlas does not grade this." Grep for tamper-proof/cheat-proof/verified-authorship/100%-verified/job-guaranteed = **0 matches** (architect). check:authored-c2/saas/finops green.

## 21. ServerGrade Count Before/After
**10 → 10** (sql_resultset 8 + csv_set_equal 2, DB-confirmed). No flip; C2 set [1,2,3,5] intact; no rowset/comparator drift.

## 22. Contains Regression Result
61G holds: `audit:contains-bc` 6/6 marker-enforcing, 44 assertions, 0 failures. 61H C2 repairs intact (steps 4,6,7 contains/needles). Contains runtime branch untouched.

## 23. Export / No-Leak Verification
Runtime changes server-side only; projection unchanged. 0 visible exact → no exact-expected leak surface. Export stack unchanged: api-server 662/662 (incl. export-unit + portfolioZip) + integration 4/4.

## 24. Independent Review Results
- **atlas-architect-reviewer → PASS** (0 P0/P1). Ran all gates on Node 24 + live DB; probed the audit with planted bad specs; confirmed exact root cause+fix, known-bad fails, bespoke can't ship, 61G/61H intact, serverGrade=10, no drift, honesty ceiling, **0 visible json_equal/numeric_tolerance**. P2-1 (marker-tightening, note) + P2-2 (regex `""` fallback double-blocked).
- **code-reviewer → SHIP** (0 P0/P1). Re-ran gates; regex pin genuinely fails on old code; guards narrow-yet-complete; `exactExpected` BC-safe; `validationType`↔`kind` agree on 310 steps; needles byte-preserved; honesty accurate; tests pin fixes. P2: remove temp file (done) + run audit:contains-bc after future promote.

## 25. Remaining Risks / Recommended Next Phase
Latent sweep — re-audit after any future promote. **Phase 61J (owner-gated):** json_equal + numeric_tolerance catalog-wide sweep (json_equal overlaps Phase-52 canary). 0 live dead gates today. Do not begin 61J unprompted.
