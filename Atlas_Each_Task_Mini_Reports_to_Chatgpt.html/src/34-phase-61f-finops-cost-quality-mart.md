# Phase 61F — Author Cloud FinOps cost-quality mart (6 dark candidates)
META: 2026-06-08 · COMPLETED · feat(curriculum) · NEW project, 0 live flips · src in wip 12b5fdd/dbbd1e8, close-out 08975be

## 1. Task Received
Phase 61F — author ONE new portfolio-worthy, WASM-native project expanding rowset evidence supply beyond C2 + the SaaS mart. ≥5 (prefer 6) dark rowset candidates, ALL `serverGrade:false`; browser-WASM byte-verify each; keep live serverGrade count exactly 10. Stop after 61F.

## 2. Completion Status
**COMPLETED.** Authored `cloud-data-engineer-finops-cost-quality-mart` — 6 dark rowset candidates (5 sql + 1 csv) + 1 self_attest runbook, all 6 browser-WASM byte-verified, live count unchanged = 10. **The first architect review FAILED** on the runbook step (dead `contains` gate + false claim); both P1 fixed (→ self_attest); re-reviews **architect PASS + code-review SHIP**.

## 3. Files Changed
NEW: `scripts/src/authored/cloud-data-engineering__finops-cost-quality-mart.ts` · `artifacts/atlas/public/datasets/finops-cost-mart/{raw_cloud_billing,account_owners,service_catalog}.csv` · `scripts/src/backfill-phase61f-candidates.ts` · `scripts/src/check-authored-finops-mart.ts`. MODIFIED (additive): `scripts/src/authored/index.ts`, `scripts/src/authored-lineage.ts`, `scripts/package.json`. + close-out + progress.md. Bulk in wip `12b5fdd`/`dbbd1e8` (pushed); close-out `08975be`. No grader/route/comparator/schema change.

## 4. Scope / Hard-Stops Check
New serverGrade flip? **no** (all 6 dark) · live count still **10** · comparator/validation-kind-runtime/envelope/Phase-52/schema? **untouched** · external API/cloud creds/network/dbt? **none** · leak? **no** · 61G? **not started**. Slug uses `cloud-data-engineer-` (9-course taxonomy; brief recommended `cloud-data-engineering-` — deviated for consistency).

## 5. Implementation Details
Raw cloud billing → dedupe(latest-load-wins) → clean(positive cost) → normalize env → service spend mart → team allocation → untagged/unallocated detection → cost-quality audit → self_attest runbook. Money = integer cents; every SUM `cast(... as bigint)`. 6 rowset candidates dark; browser byte-verified; promote+audit → 77.9 approved + visible.

## 6. Tests and Gates Run (Node 24 + Docker PG :5434)
typecheck(4)+no-heuristic · check:boot · check:db-baseline (10) · **check:authored-finops-mart (6 dark, 1 self_attest, 0 contains, no false-enforcement, no leak, no H3)** · check:authored-saas-mart · audit:sql-resultset-bc PASS (8 opted + 6 dark byte-identical) · csv-bc PASS (2+1 dark) · contains-bc PASS (4/4) · authoring+pedagogy finops publish-ready/enriched · api-server 648/648 · atlas 170/170 · integration 4/4.

## 7. Failures, Fixes, and Surprises
- **Architect FAIL → fix (the important one):** step 7 was authored `contains` with a `mustContainAll` spec. The `contains` RUNTIME (`grading.ts:104-105`) passes the WRAPPED validationConfig (not `cfg.spec`) to `matchContains`, which reads top-level `needle`/`needles` — so the authored spec is NEVER read → legacy `needle=""` → **auto-passes any submission** (dead gate). Step 7 also falsely claimed "server-enforced." **Both P1 fixed:** converted step 7 to honest `self_attest` (auto-passes by design, no verification claimed) + removed the claim + added a false-enforcement guard to the check.
- **Discovered pre-existing platform defect (escalate):** the SAME dead `contains` + false "server-enforced" copy ships LIVE on C2 (since 57B-flip) + the SaaS mart (61D). 61F documented it (close-out §16) + recommended a dedicated dark/BC grader-fix phase. This is a **live H3 honesty debt on two shipped projects** — the architect flagged it must be scheduled as priority.
- self_attest needs a non-empty spec (`assertAuthoredProjectComplete:488`) → gave it an inert `attestationChecklist` metadata spec.
- Session-end hook auto-committed the bulk as wip (pushed) before manual commit; not rewritten (no force-push to main).

## 8. Current Git State
Branch `main`, HEAD `08975be` (close-out), pushed. 61F source in wip `12b5fdd`/`dbbd1e8`. Tree clean except hook-managed files. Browser harness deleted.

## 9. Current Project State After This Task
New project visible + approved (77.9); steps 1-6 dark rowset, step 7 self_attest. Global live serverGrade = 10 unchanged. C2 + Mart unchanged. Candidate supply now spans a third discipline (cloud-data-engineer).

## 10. Remaining Risks / Blockers
- **PRIORITY follow-up:** the `contains`/`regex` runtime defect (passes wrapped config, not `cfg.spec`) leaves C2 + SaaS mart shipping a dead gate + a false "server-enforced" claim (live H3 debt). Needs a dedicated dark/BC grader-fix phase (fix the branch to pass `cfg.spec` + use canonical `needles` + add a known-bad-submission gate + correct the C2/SaaS copy).
- 6 new finops candidates ready for a future controlled flip (re-verify in-browser at flip time).

## 11. Recommended Next Step
Schedule the **contains-runtime grader-fix phase** (priority — live H3 debt on C2 + SaaS). Then Phase 61G (owner-gated): next density / flip / authoring. Do not begin unprompted.

## 12. Explicit Stop Statement
**Stopped.** New FinOps project authored with 6 browser-verified DARK rowset candidates + an honest self_attest runbook; live serverGrade = 10 unchanged; reviews PASS/SHIP after fixing the step-7 dead-gate + false claim; pre-existing contains defect documented + escalated. **Phase 61G NOT started.** Awaiting next instruction.

---

## 13. Baseline Preflight Result
`check:db-baseline` OK; global serverGrade sql 8 + csv 2 = 10; C2 + SaaS mart both visible + approved; integration not env-blocked; tree clean + pushed. Authored only on a green baseline.

## 14. New Project Summary
`cloud-data-engineer-finops-cost-quality-mart` (course `cloud-data-engineer`, intermediate, candidateId f1f05a3c…). A DuckDB-WASM-native FinOps cost-quality mart: raw daily cloud billing → trusted, team-allocated, audited cost mart. 7 steps. No AWS/Azure/GCP calls, no SDKs, no credentials, no network. Integer cents. Promote → audit 77.9 approved + visible.

## 15. Dataset and Fixture Design
`artifacts/atlas/public/datasets/finops-cost-mart/`: `raw_cloud_billing.csv` (15 rows — 3 duplicate resource-day load groups, 2 missing team tags, mixed env labels prod/Prod/PROD/Production + dev/Dev + staging/Staging, 1 unknown account A-999 with an anomalous 99000-cent row, 2 invalid-cost rows [-100, 0]); `account_owners.csv` (4 accounts → owner_team + business_unit); `service_catalog.csv` (5 services → family + criticality, reference surface). Deterministic; integer cents; no tz ambiguity. (Note: `service_catalog.csv` + columns usage_quantity/business_unit/criticality are realistic seed surface, unused by the 7 steps — code-review P2.)

## 16. Step-by-Step Project Flow
1. Dedupe billing (latest-load-wins) — sql — `[[12,8]]`.
2. Normalize environment — sql — `[[dev,2],[prod,7],[staging,1]]`.
3. Daily service spend mart — sql — `[[cloudfront,99000],[ec2,24300],[lambda,1050],[rds,16200],[s3,7800]]`.
4. Team allocation mart — csv — `[[data,6200],[ml,16200],[platform,25900],[web,1050]]`.
5. Untagged + unallocated spend — sql — `[[unallocated_account_cents,99000],[untagged_cents,16200],[untagged_rows,2]]`.
6. Cost-quality audit (CI gate) — sql — `[[dup_resource_day_loads,3],[invalid_cost_rows,2],[unknown_account_rows,1],[untagged_rows,2]]`.
7. FinOps runbook — **self_attest** writeup (names 4 checks + dedupe rule + cost-quality intent; not auto-graded).

## 17. Dark Rowset Candidate Inventory
6 candidates, ALL `serverGrade:false`: steps 1,2,3,5,6 `sql_resultset` + step 4 `csv_set_equal`. `check:authored-finops-mart` pins darkCount===6, liveCount===0. DB confirms each rowset serverGrade=false. 0 live flips.

## 18. Browser-WASM Verification Table
Real Chromium (playwright-cli) · real atlas Vite (Node 24) · real `duckdbAdapter` (`@duckdb/duckdb-wasm@1.33.1-dev45.0`) + `normalizeSqlRows` · committed seeds · exact FE capture→submit transform. All 6 `byteMatch=true`:
| Step | kind | cell types | byteMatch |
|---|---|---|---|
| 1 | sql | number,number | ✅ |
| 2 | sql | string,number ×3 | ✅ |
| 3 | sql | string,**number** ×5 | ✅ |
| 4 | csv | string,number ×4 | ✅ |
| 5 | sql | string,**number** ×3 | ✅ |
| 6 | sql | string,number ×4 | ✅ |
Steps 3 & 5 cent totals returned as `number` (the `cast(... as bigint)` avoided the 61C HUGEINT→string class). Harness deleted. All kept DARK despite byte-matching.

## 19. Type-Stability Decisions
Integer cents (no decimal dollars → no float/tolerance). Every SUM `cast(... as bigint)` → lossless Number. Counts → BIGINT → Number. Categorical outputs = exact normalized strings (env/team/check/metric names). Timestamps ordered via `cast(... as timestamp)` but never returned. Every multi-row query has ORDER BY. `check:authored-finops-mart` asserts every expectedRows cell is integer/string (no floats).

## 20. No-Leak and Evidence-Honesty Verification
6 dark rows → projection emits `serverGrade:false`; no spec/expectedRows/query to the client. `check:authored-finops-mart` asserts no distinctive cent-total appears in learner prose (now scanning ALL pedagogy fields — code-review P2-a) AND no false server-enforcement claim (the H3 gap the architect caught). Step 7 honestly states "Atlas records your submission; it does not auto-grade prose." No authorship/tamper/cheat/job/certification claims.

## 21. ServerGrade Count Before/After
Unchanged: **sql 8 + csv 2 = 10** before AND after 61F (DB-confirmed). The 6 finops rowset rows are dark → candidate supply, not live count.

## 22. DB Baseline Postflight Result
`check:db-baseline` OK (3/3 migrations, required tables, C2 + Mart visible/approved with their server-graded sets, global = 10). Integration 4/4. serverGrade = 10.

## 23. Export Stack Compatibility Result
Export assembly unchanged. api-server 648/648 (incl. export-unit + portfolioZip ZIP-validity) + integration 4/4 (the /submit snapshot round-trip) green with the new project in the DB. Artifact / repository JSON / repository ZIP routes assemble from the same unchanged path; finops dark steps classify non-server-graded, leak-free. No live finops ZIP seeded (no completion); unit + integration coverage stands in.

## 24. Independent Review Results
- **First architect pass → FAIL** (gate worked): step 7 dead `contains` gate + false "server-enforced" claim (2 P1). Fixed → self_attest + claim removed + guard.
- **atlas-architect-reviewer re-review → PASS** (0 P0/P1): verified self_attest non-enforcing (`grading.ts:92-97`), non-empty-spec contract, DB state, 6 rowsets byte-untouched, count = 10. **P2 (must-not-drop):** C2 + SaaS mart's live dead-contains + false copy = H3 debt → schedule the grader-fix phase as priority.
- **code-reviewer re-review → SHIP** (0 P0/P1/P2): self_attest genuinely non-enforcing, false-enforcement guard is a true regression gate, 6 rowsets byte-untouched. (First-pass code-review also SHIP'd + re-computed all 6 expectedRows from fixtures.)
