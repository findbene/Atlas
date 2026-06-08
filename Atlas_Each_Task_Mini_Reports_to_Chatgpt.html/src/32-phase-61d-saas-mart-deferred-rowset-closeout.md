# Phase 61D — Close out the two deferred SaaS-mart rowset candidates
META: 2026-06-08 · COMPLETED · feat(curriculum) · live flip (+2 rows: steps 3+4) · src in wip 1f1ca1c, close-out cb15b82

## 1. Task Received
Phase 61D — close out the two deferred rowset candidates in `data-engineering-saas-usage-revenue-quality-mart`: flip **step 3** if still browser byte-verified; **fix + flip step 4** only if it becomes type-stable without comparator changes. Target serverGrade 8→10 ideal / 9 acceptable / 8 with failure report. "Correctness beats count." Hard stops: no comparator/float-tolerance/envelope/schema/Phase-52/route change; no leak; no new authoring; no broad flips; do not start 61E.

## 2. Completion Status
**COMPLETED — IDEAL outcome (+2).** Browser-WASM re-verified all 6 rowset steps; **flipped BOTH** steps 3 and 4 → all 6 rowset steps now `serverGrade:true`. Step 4's HUGEINT deferral closed via `cast(sum(mrr_amount) as bigint)`. Reviews: architect **PASS** + code-reviewer **SHIP** (0 P0/P1). Authored-source serverGrade **8 → 10**.

## 3. Files Changed
2 source: `scripts/src/authored/data-engineering__saas-usage-revenue-quality-mart.ts` (steps 3+4 `serverGrade:false→true` + step-4 BIGINT cast in instruction/starterCode/query + honest server-graded copy + comments + header docblock) · `scripts/src/check-authored-saas-mart.ts` (`FLIPPED={1,2,3,4,5,6}`, flippedCount===6, darkCount===0). + close-out `docs/phases/phase-61d-saas-mart-deferred-rowset-closeout.md` + `.agentic/progress.md`. **The 2 source files + close-out + progress landed in session-end wip `1f1ca1c` (auto-commit hook, already pushed); the close-out §9 review verdicts in `cb15b82`.** DB flip propagated via the authoring pipeline (throwaway Docker PG — not committed). Dev-only browser harness created + deleted (never committed).

## 4. Scope Control / Hard Stops Check
Only step 3+4 flipped (sql_resultset)? **yes.** Comparator change? **no** (grading.ts byte-unchanged). Float/tolerance comparator? **no** (step 4 fixed by an integer cast, not tolerance). Envelope enforcement? **no** (OFF). Schema/migration? **no.** Route/projection/export? **no.** Phase 52? **untouched.** Leak? **no** (projection emits only the serverGrade boolean). New authoring? **no.** Broad flip? **no** (exactly the 2 named candidates). C2 changed? **no** (git-unchanged). 61E started? **no.**

## 5. Implementation Details
Step 3 was a clean candidate deferred in 61C only by the max-4 budget — query/columns/expectedRows byte-unchanged, just `serverGrade:false→true`. Step 4's only query change is wrapping `sum(mrr_amount)` in `cast(... as bigint)`, applied in the starterCode SELECT (which is OUTSIDE the learner's `-- TODO`, so every completion carries the cast for free), the reference query, and the instruction prose; `expectedRows` stays `[[6,4950]]`. The cast routes the value through `duckdbRunner.ts:106-116` (BIGINT in safe range → lossless Number) instead of the `:118` `String()` fallback that produced the HUGEINT string `"4950"`. The runtime comparator is unchanged — the flips only change which path each row takes (dark auto-pass → live re-grade of the FE-captured `{columns,rows}`).

## 6. Tests and Gates Run (Node 24.16.0 + Docker PG :5434)
typecheck (4) + check:no-heuristic **OK** · `check:authored-saas-mart` **OK** (pins the all-6 set) · `audit:sql-resultset-bc` **PASS** (5 opted-in mart rows, 32 checks, 0 failures; fail-closed on raw-SQL/malformed/empty/wrong-columns/missing-row/extra-row) · `audit:csv-set-equal-bc` **PASS** (1 opted-in, 5 checks, 0) · `audit:contains-bc` **PASS** (3 steps, 21 subs, 0 mismatch) · `audit:authoring` **✓ publish-ready** (mart) · `audit:pedagogy` **✓ fully enriched** (mart) · api-server **648/648** · atlas **170/170**. **Integration tests ENV-BLOCKED** (reset DB under-migrated — see §7); the /submit grading + export/ZIP-validity contracts are covered by the api-server unit suite (648, includes 91 export-unit + portfolioZip + grading + envelopeGrade).

## 7. Failures, Fixes, and Surprises
- **DB-RESET FINDING (material):** the local Docker `atlas` DB was found reset to a base-only seed at phase start — 0 candidates, no sql/csv steps, neither mart nor C2 present. An out-of-scope re-seed had wiped the prior serverGrade=8 layered state. Reconstructed the **mart only** via the normal pipeline (backfill→promote→audit, 81.4 approved). DB now shows the mart's 6 server-graded rows. C2 not reconstructed (out of scope; git-unchanged).
- **Integration tests env-blocked:** the reset DB is under-migrated — the integration harness clones `public.portfolio_submission_snapshots`, which does not exist. Unrelated to the diff. Remediation: `pnpm migrate`.
- **git-bash mangled `BASE_PATH=/`** → `/Program Files/Git/` on the first Vite boot (harness 404); fixed by booting via PowerShell with no BASE_PATH (dev base defaults to `/`).
- **Session-end hook auto-committed the source as wip `1f1ca1c` (and pushed)** before a manual conventional commit; not rewritten (would require force-push to main — hard stop).

## 8. Current Git State
Branch `main`. HEAD `cb15b82` (close-out verdicts), pushed. 61D source in `1f1ca1c` (wip, pushed). Working tree clean except hook-managed `.agentic/self-review.log` + `HANDOFF.md`. All browser-harness artifacts deleted.

## 9. Current Project State After This Task
The mart's six rowset steps (1–6) are all live server-graded; step 7 contains. A completed learner's portfolio now classifies 6 steps in this project as server-graded. Authored-source serverGrade total **= 10** (mart 6 + C2 4). DB (this reset env) shows the mart's 6. All invariants intact; comparator + routes + Phase 52 + envelope unchanged; C2 unchanged.

## 10. Remaining Risks / Blockers
- The mart has NO dark rowset rows left. Next density work = a new authored project (E4).
- Restore a full local DB baseline before the next DB-dependent phase: `pnpm migrate` + re-promote C2 + mart so global=10 is DB-observable and integration tests run.
- `.gitattributes` EOL-normalize `scripts/src/authored/**` (standing CRLF follow-up).

## 11. Recommended Next Step
Observe the 2 newly-live rows in a real env. **Phase 61E (owner-gated):** author the next WASM-native rowset project for more candidate supply, under the full phase ritual. Do not begin unprompted.

## 12. Explicit Stop Statement
**Stopped.** Steps 3 + 4 browser-verified + flipped to server-graded; all 6 mart rowset steps live; serverGrade authored-source 8→10; no-leak + honesty preserved; C2 unchanged. Reviews PASS/SHIP, gates + audits green (integration env-blocked, disclosed). **Phase 61E NOT started.** Awaiting next instruction.

---

## 13. Deferred Candidate Reverification Table
| Step | Kind | 61C status | 61D browser capture | Types | Committed | Byte-match | 61D decision |
|---|---|---|---|---|---|---|---|
| 3 | sql_resultset | dark (max-4 cap) | `[[dashboard_view,3],[export,3],[query_run,7]]` | str,num | = | ✅ | **FLIP** |
| 4 | sql_resultset | dark (HUGEINT) | `[[6,4950]]` | **num,num** | `[[6,4950]]` | ✅ | **FLIP (cast)** |
| 1,2,5,6 | sql/csv | live (61C) | `[[7,7]]`/`[[13,7]]`/health-dist/DQ-audit | num/str,num | = | ✅ | re-confirmed live |

## 14. Step 3 Decision and Evidence
FLIP. Step 3 byte-matched cleanly in 61C and was deferred solely by that phase's max-4 budget. 61D re-verified in real-browser DuckDB-WASM: capture `columns=[event_type,event_count] rows=[[dashboard_view,3],[export,3],[query_run,7]]` (types string,number; `count(*)`→BIGINT→lossless Number), ordered by `event_type` → stable, byte-matches the committed expectedRows. No query/columns/expectedRows change — only `serverGrade:false→true` + honest copy.

## 15. Step 4 Type-Stability Fix
The 61C deferral: `sum(mrr_amount)` over an INTEGER column → HUGEINT → adapter `String()` fallback → STRING `"4950"` ≠ committed Number `4950`. Fix: `cast(sum(mrr_amount) as bigint)` so the value is BIGINT → lossless Number. Applied in the **starterCode SELECT (outside the learner TODO — the learner edits only the `where` in the `active` CTE)**, the reference query, and the instruction prose — so every learner's natural capture is type-stable. `expectedRows` unchanged `[[6,4950]]`. No comparator/tolerance change. (Architect P2: a learner who deletes the pre-filled cast can still fail closed — not a regression; the same inherent property of every server-graded step, and strictly better than the pre-61D natural-path failure.)

## 16. Browser-WASM Verification Results
Real Chromium (playwright-cli) · real atlas Vite (Node 24) · real `@/lib/duckdb/duckdbRunner` `duckdbAdapter` (`@duckdb/duckdb-wasm@1.33.1-dev45.0`) + `@/lib/envelopeClient` `normalizeSqlRows` · committed seed CSVs · queries extracted from the authored file · replicating the EXACT FE capture→submit transform (`project-workspace.tsx` stash + `decideCsvSetEqualSubmission` → `JSON.stringify({columns,rows})`). All 6 `ok:true`, `columnsMatch + rowsMatch + byteMatch = true`:
```
step1 [n,n_unique]=[[7,7]]                          number,number  MATCH
step2 [valid_events,active_accounts]=[[13,7]]       number,number  MATCH
step3 [event_type,event_count]=[[dashboard_view,3],[export,3],[query_run,7]]  string,number  MATCH
step4 [active_accounts,total_mrr]=[[6,4950]]        number,number  MATCH  (was [[6,"4950"]] pre-cast)
step5 [health_label,account_count]=[[at_risk,2],[churned,1],[healthy,4]]      string,number  MATCH
step6 [check_name,flagged_count]=[[dup_account_ids,1],[invalid_usage_events,2],[orphan_usage_accounts,0]]  string,number  MATCH
```
Harness deleted after capture.

## 17. ServerGrade Count Before/After
**Authored source of truth:** before **8** (mart 4 + C2 4) → after **10** (mart 6 + C2 4). Δ = +2 (mart steps 3,4, both sql_resultset). **DB (this reset env):** mart-scoped before 4 → after **6** (DB-confirmed: csv 1 + sql 5). The global DB total reads 6 (mart only) because C2's 4 rows were wiped by the out-of-scope re-seed and C2 is out of scope; C2's authored source is git-unchanged, so the production/seed-path global is 10.

## 18. Exact Flipped Step Numbers
`data-engineering-saas-usage-revenue-quality-mart` steps **3 and 4** → `serverGrade:true` this phase. Full live set now: steps **1, 2, 3, 4, 5, 6**. Step 7 → `contains` (untouched). DB per-step verified: 1=t,2=t,3=t,4=t,5=t,6=t,7=null. The check pins `FLIPPED={1,2,3,4,5,6}`, flippedCount===6, darkCount===0.

## 19. Remaining Dark Rowset Candidates, If Any
**None.** All 6 rowset steps in this project are now live server-graded. Zero dark rowset rows remain in the mart.

## 20. No-Leak Verification Across /check, /submit, Artifact, JSON, and ZIP
The flips change only the `serverGrade` boolean. `routes/projects.ts:306-307` derives `serverGrade` via `isServerGradeOptedIn` and returns ONLY that boolean — never `validationConfig`/`spec`/`expectedRows`/`query` (verified independently + by both reviewers). **/submit:** the BC audits prove a correct capture passes and raw-SQL/malformed/empty/wrong-columns/missing-row/extra-row FAIL CLOSED. **/check:** writes no snapshot (unchanged). **Artifact / repository JSON / ZIP:** assembly byte-unchanged (no export-code edit); a step is classified server-graded via the same `isServerGradeOptedIn` predicate, so a completed learner's evidence reflects steps 1–6 leak-free. Export unit + ZIP-validity tests pass within api-server 648/648. (DB round-trip integration variants env-blocked — §7.)

## 21. Portfolio ZIP Evidence Result
The export stack is byte-unchanged, so the ZIP path is unaffected by the flips; a completed learner's ZIP would classify steps 1–6 of this project as `server-graded` in VALIDATION_EVIDENCE (via the unchanged classifier), remain leak-free, and stay a valid archive (`portfolioZip.test.ts` covers `zipfile.testzip()=None`-equivalent validity; the export unit + 648 api-server tests pass). No new learner completion was seeded this phase (no snapshot created). The live DB ZIP round-trip is env-blocked (reset DB under-migrated).

## 22. Existing C2 Regression Result
C2 (`analytics-engineer-semantic-layer-with-dbt-and-duckdb`) authored source is **byte-unchanged** (git diff empty; last touched Phase 61A — confirmed by the architect). It was not modified, not re-promoted, not flipped. Its 4 server-graded rows are absent from THIS reset DB (wiped by the out-of-scope re-seed, not by 61D); in the production/seed path they are intact, keeping the global authored-source count at 10.

## 23. Independent Review Results
- **atlas-architect-reviewer → PASS** (0 P0/P1): hand-traced expected values against the fixtures (step 4 sum=4950 with A-007 excluded; step 3 distribution with E-14/E-15 excluded); confirmed the cast makes the natural capture type-stable (`duckdbRunner.ts:106-116` vs `:118`), no leak (`projects.ts:40-48`), comparator byte-unchanged (multiset path), C2 byte-unchanged, RUBRIC frozen, no H3 overclaim. P2s: learner-deletes-cast fail-closed (not a regression); DB-gated test files env-blocked.
- **code-reviewer → SHIP** (0 P0/P1): diff is exactly the 2 source files; step 3 byte-identical; step 4's only query change is the BIGINT cast (3 places, starterCode SELECT outside the learner TODO); expectedRows unchanged; check pins {1..6}; no H3 phrase; no leak. P2s: env-blocked integration + CRLF (pre-existing/tracked).
