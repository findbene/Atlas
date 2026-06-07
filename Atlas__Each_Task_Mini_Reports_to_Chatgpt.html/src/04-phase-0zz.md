# Phase 0.zz — C2 real-browser DuckDB-WASM byte verification
META: 2026-06-06 · PASS — 5/5 byte-identical (hidden/dark) · commit 05e5e36

## 1. Task Received
Verify the repaired hidden C2 candidate produces the exact committed expected values in the **actual browser DuckDB-WASM runtime** (not just local duckdb) before any promotion or `serverGrade:true`. Capture real `{columns,rows}` for steps 1/2/3/5/8, byte-compare, verify the step-3 flip contract, change nothing unless a mismatch is proven.

## 2. Completion Status
**DONE — PASS.** All 5 steps byte-identical in real-browser wasm. No mismatch → nothing changed in the candidate. Committed `05e5e36`, pushed.

## 3. Files Changed (4 files, +134/−6)
- **NEW** `docs/phases/phase-0zz-c2-real-browser-wasm-byte-verification.md` (10-point close-out)
- **EDIT** `.agentic/progress.md`, `CLAUDE.md`, `.gitignore` (+`.playwright-cli/`)
- **Temp, created then deleted:** `wasm-verify.html`, `wasm-verify-main.ts`, `public/wasm-verify-cases.json`, `scripts/src/_wasm_verify_extract.ts`, `.playwright-cli/` — none persisted.

## 4. Scope Control / Hard Stops Check
All honored. No candidate promotion · no `serverGrade:true` (extraction confirmed `serverGrade=null` all steps) · no row opt-in · no env/canary · no production · Phase 52 untouched · no schema/migration · no OpenAPI/codegen · no cloud/waves · **no `expectedRows` changed** (no mismatch) · no force-push · no secrets · no lockfile mutation (zero new deps).

## 5. Implementation Details
**How browser wasm ran:** booted atlas **Vite** dev (Node 24; `PORT=5199 BASE_PATH=/` via PowerShell — git-bash MSYS mangled `/`). A dev-only harness page imported the **real `duckdbAdapter`** (`@duckdb/duckdb-wasm@1.33.1-dev45.0`) and called `.run(...)` per step — the same path `project-workspace.tsx` uses on Run. Committed queries/expected were **extracted from the authored file** (tsx → cases JSON), so the harness ran the exact shipped strings. Drove headless **Chromium** via `playwright-cli`. **Zero new deps.**
**Harness needed?** Yes — candidate is hidden (404) and the full app can't boot (Replit coupling); calling the adapter directly was the smallest safe path, no promotion.

## 6. Tests and Gates Run
Focused browser/DuckDB-WASM verification **PASS (5/5)** · typecheck **PASS** · `audit:csv-set-equal-bc` **PASS (0 visible)** · `audit:contains-bc` **PASS 2/2** · `audit:authoring` **exit 0**.

## 7. Actual browser-WASM output + byte-compare
| Step | Browser-WASM rows | types | Committed expected | Result |
|---|---|---|---|---|
| 1 | `[[7,7]]` | number,number | `{n:7,nUnique:7}` | MATCH |
| 2 | `[[one_current,0],[overlap,0]]` | string,number | `[{check,value}×2 =0]` | MATCH |
| **3** | `[["2025-04-01",199,T,F,F,F]…["2025-07-01",0,F,F,F,T]]` | string,number,bool×4 | `expectedRows` | MATCH |
| 5 | `[[2746]]` | number | `{value:2746}` | MATCH |
| 8 | `[[1.05]]` | number | `{value:1.05}` | MATCH |

Mismatch/type drift/path issue: **none**. Only console noise = benign `favicon.ico` 404.

## 8. Step-3 flip safety
**SAFE.** columns exact · rows exact · `mrr_amount`=**number** (not bigint/string) · `month_start`=**string** `"2025-04-01"` · flags=**boolean** · `normalizeSqlRows(rows) === expectedRows`. Verified in the real engine.

## 9. Current Git State + Project State
HEAD `05e5e36` on `main`, pushed. Working tree clean except hook-managed files. Candidate still hidden; `serverGrade` absent; grader DARK. Engine-drift risk R1 CLOSED.

## 10. Remaining Risks / Blockers
- R1 engine-drift — CLOSED by this phase.
- R2 (advisory): enterprise-NRR filter dead-branches — future fixture-author caution.
- Broader app boot still needs Node-24 `pnpm install` + Phase 0.2 decouple.
- Lockfile still needs off-Windows regeneration.

## 11. Recommended Next Step
**57B-flip can begin** — validation now real-runtime-proven. Sequence: promote C2 → `serverGrade:true` + re-seed → resolve 2 deferred P2s → OpenAPI/Orval regen.

## 12. Explicit Stop
Stopped after verification. Candidate NOT promoted, `serverGrade` NOT set, 57B-flip not started.
