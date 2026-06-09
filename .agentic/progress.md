# Atlas — Progress

> Live state for context recovery. Read this first every session. Update after every task/decision.
> Live engineering state of the *Replit-era code* remains in `HANDOFF.md` (Phase 57A). This file
> tracks the *Claude Code continuation* (the build-to-finish).

## Current state — 2026-05-29

- **Phase:** Phase 0 (Foundation) in progress. Owner approved plan + decisions 100%.
- **Last Replit-era shipped phase:** 57A (`csv_set_equal` dark comparator). Product behavior unchanged.
- **Decisions locked:** D1 migrate off Replit · D2 sandbox-cloud first · D3 private-beta first · D4 job-signal factory · D5 keep monorepo layout · D6 extend-not-restart. See `discovery.md §4`.
- **Plan:** `plan.md` — 8 epics (E0–E7). Owner-facing phase→invoke map delivered.

### Phase 0.1a — DONE (executable spine)
Created: `CLAUDE.md` (project tier, 47 lines) · `.claude/settings.json` · `.claude/commands/{atlas-phase-plan,atlas-validate,atlas-phase-close}.md` · `.claude/agents/atlas-architect-reviewer.md` · `.claude/skills/atlas-conventions/SKILL.md`. `.gitignore` updated for Claude local files. The build is now drivable by the universal commands.

### Phase 0.1b — DONE (root docs)
Wrote 7 docs via parallel Sonnet agents (one per file, no shared-file conflict), Opus-reconciled against code: `README.md` (245), `PRD.md` (685), `BRD.md` (384), `ARD.md` (653), `TRD.md` (735), `DESIGN.md` (702), `DRD.md` (465). With CLAUDE.md + HANDOFF.md, the full requested doc set exists.
**Reconciliation fixes (Opus review vs ground truth):** README Pyodide `0.28.4`→`0.29` (package.json says `^0.29.3`; `replit.md` was stale) · README Clerk env var `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`→`CLERK_PUBLISHABLE_KEY` (Vite app, not Next; dev script maps to `VITE_CLERK_PUBLISHABLE_KEY`). **Confirmed real:** `/submit` per-user advisory lock at `artifacts/api-server/src/routes/user.ts:584` (`pg_advisory_xact_lock(hashtextextended('atlas-submit:'||user.id,0))`); `vite-plugin-pwa`+`workbox-window` installed but not configured (so "PWA = configure, not add" at Phase 7).

## 2026-06-06 — ChatGPT handoff reconciled vs actual repo (drift caught)

ChatGPT (now my director; "Replit" in its prompts = Claude Code) handed a status report claiming **Phase 57B-prereq (csv_set_equal frontend submission-shape wiring) SHIPPED + architect-approved**. **Verified false against `main`:**
- `gradeCsvSetEqual` / `matchContains` / `computeCsvSetEqualHash` present in `grading.ts` → 56 + 57A real ✓
- `audit-csv-set-equal-bc.ts` present → 57A audit real ✓
- `csvSetEqualSubmit.ts` **absent** (repo-wide); `projects.ts` exposes **no** `serverGrade`; `project-workspace.tsx` has **no** `capturedSqlByStepId`; **no** `phase-57b-*` doc; **no** 57B commit in git log.
- **True last-shipped = 57A** + a committed Phase 57 proposal doc (`52cfae9`). ChatGPT overstates by one phase. My HANDOFF (last shipped = 57A) was the accurate record.

Consequence: ChatGPT's proposed Phase 57C premise ("FE wiring already done") is wrong — FE wiring is still TODO.

Two reconciliations adopted:
- **Project-scale target = 900–1000 premium (~120/discipline)** — sharper than prior "~95% missing". Update plan E4.
- **"Replit" is now ambiguous:** ChatGPT means the coder-role (= me). My D1/Phase-0.2 "migrate off Replit" means the **Replit platform/connectors/hosting** (real infra dep) — that task is unaffected by the rename and still required for local boot.

Phase-map: ChatGPT 57C→57B-flip→58→59 = my **E1**; 60 = **E2**; 61 = **E4**; 62 = **E5**. ChatGPT's report omits my **E0** (Claude Code op-system + decouple Replit platform + local green) and **E3** (adaptive skill model) and **E6** (PWA/deploy/beta).

## 2026-06-06 — Phase 57C proposal delivered (read-only; awaiting approval)

`docs/phases/phase-57c-csv-set-equal-trust-decision.md`. Grounded in code inspection of grading.ts, runEnvelope.ts, runs-sign.ts, envelopeSubmit/envelopeGrade.ts, user.ts submit, duckdbRunner.ts, project-workspace.tsx, authoring.ts, and the candidate authored file. Key verified facts:
- **57B-prereq FE wiring confirmed ABSENT** (premise correction). Today code steps submit raw SQL as `submission`; the signed envelope (which already carries `{columns,rows}`) rides along but `csv_set_equal` is not enforced and `gradeEnvelopeCapture` only special-cases `json_equal`.
- **Core tension:** `serverGrade:true` flips BOTH paths → raw-SQL commit submit fails CLOSED; envelope path routes stdout (summary) → fails CLOSED. So a naive flip breaks every learner on the step.
- **Recommendation: Option C (staged hybrid, provenance-biased)** — FE submits canonical `{columns,rows}` JSON on the commit path (soft-fail-safe), envelope rides along as provenance, `gradeEnvelopeCapture` gains a dark `csv_set_equal` branch; envelope *enforcement* is a later, separate, operator canary (independent of the parked Phase 52 `json_equal` canary).
- **Flip is gated on local execution verification** of step-3 `expectedRows` (numeric-type fidelity R2 + fixture row-set R3) — needs the Node 24 + pnpm install local-green baseline. Proposal/57B-prereq build do not.

No code/DB/schema/env/canary/codegen change. Stopped for owner approval.

## 2026-06-06 — Phase 57B-prereq SHIPPED (DARK; Option C approved + built)

Owner approved Option C. Built the staged-hybrid foundation — **zero rows opted in, no envelope
enforcement**. Close-out: `docs/phases/phase-57b-prereq-csv-set-equal-foundation.md`.
- **8 source files** (route `serverGrade` boolean · FE `csvSetEqualSubmit.ts` helper + tests ·
  `project-workspace.tsx` per-step DuckDB capture w/ run-gen guard + lifecycle clears + Check/Submit
  routing · dark `csv_set_equal` branch in `envelopeGrade.ts` + tests · shared `normalizeSqlRows` ·
  extended `audit:csv-set-equal-bc`). Commits `3e6dc8b` → `ff5f9d9` (lockfile restore) → `3cc3187`
  (review P2 fixes). Pushed to `main`.
- **Reviews: architect-reviewer PASS + code-reviewer SHIP-ready, no P0/P1.** Fixed 2 P2 now
  (shared cell-normalizer so envelope vs JSON paths can't drift; `isSqlStep` gate on the JSON path).
  Deferred 2 P2 to flip (popstate clear gap — shared w/ Phase-49 envelope, unreachable via
  replaceState-only nav; `needs-run` red-state vs neutral-hint = owner UX call).
- **Gates:** typecheck PASS · `check:no-heuristic-runtime` OK · atlas 159/159 · api-server 440
  (envelopeGrade 28/28) · execution-core 83/83 · csvSetEqualSubmit 9/9. Ran on **Node 22**.
  NOT RUN (env): DB-gated audits (`authoring`, `csv-set-equal-bc`, `contains-bc`) + `envelopeSubmit`
  / `COURSE_TAXONOMY` suites (no `DATABASE_URL` / gitignored `.local` file).
- **OpenAPI/Orval: not required** (matches route-only `hasPedagogy` precedent; FE reads via StepVM).
- **DARK proof:** `serverGrade=false` for all rows ⇒ raw path byte-identical to `6c26cd2`; envelope
  branch auto-passes; `csv_set_equal` NOT in `PILOT_RUNTIME_KINDS` nor `ATLAS_ENVELOPE_REQUIRED_KINDS`.

## 2026-06-06 — Phase 0.x local-green ATTEMPTED → PARTIAL / BLOCKED

Owner approved start. Real work done; 3 hard blockers found (flip remains blocked, now with a sharper reason).
- **Node 24.16.0 DOWNLOADED** via nvm-windows (`nvm install`), **NOT activated.** `C:\Program Files\nodejs` is a real dir (system Node 22), not an nvm symlink → `nvm use` needs admin + would clobber the working install. Owner must activate deliberately (or reinstall Node 24 cleanly). Gates so far ran on Node 22.
- **Lockfile is NOT frozen-clean.** `pnpm install --frozen-lockfile` → `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` ("overrides" config ≠ lockfile). `pnpm-workspace.yaml` declares the esbuild-prune `overrides:` but the committed lockfile doesn't match it (shipped inconsistent from Replit; neither my earlier clobber nor the `ff5f9d9` restore matches). **Did NOT modify/commit the lockfile** (hard stop). Reconcile = `pnpm install --no-frozen-lockfile` on **Node 24**, owner-committed.
- **`.gitignore` had NO `.env` entry** (secret-leak risk w/ auto-commit hooks). Fixed: added `.env`/`.env.local`/`.env.*.local` + `!.env.example` negation + committed secret-free `.env.example` (commit `f3256e1`).
- **`DATABASE_URL` unset, no `.env`** → the 3 DB-gated audits (`authoring`, `csv-set-equal-bc`, `contains-bc`) **NOT RUN.** Owner provides Neon URL in gitignored `.env`, OR approve a local Docker Postgres + migrate + seed (Docker is available).
- **CRITICAL — C2 step-3 expectedRows CANNOT be verified: the fixture is ABSENT.** DuckDB-WASM loads datasets from `artifacts/atlas/public/datasets/<ref>.csv` (`duckdbRunner.ts:47`). That dir contains **only `orders.csv`** — no `subscriptions.csv`/`customers.csv`. Step-3 datasetRef `seeds/subscriptions.csv` → 404. So the `csv_set_equal` check has **no backing data in the repo**; the C-100 `expectedRows` are hand-authored and unrunnable, and a `serverGrade:true` flip would **fail-closed for every learner**. This is a deeper blocker than 57C §7 anticipated (it assumed data existed and only numeric fidelity was at risk). Did NOT author a fixture or change expectedRows (hard stop).
- Hook noise: more verbose-message auto-commits appeared (`5aad187`, `bddbe15`). A stray template `docs/HANDOFF_Script.md` (not mine) is untracked — left untouched.

## 2026-06-06 — Phase 0.y local-baseline unblock + C2 fixture proposal

- **Node 24 activated SHELL-SCOPED** (non-destructive): prepend `C:\Users\findb\AppData\Local\nvm\v24.16.0` to `$env:PATH` per-command → `node v24.16.0`, pnpm `9.15.0`. System Node 22 untouched; no `nvm use`, no admin, no clobber.
- **Lockfile mismatch UNDERSTOOD + fix identified, NOT committed.** `pnpm-lock.yaml` `overrides:` is a **stale subset** — missing entries `pnpm-workspace.yaml` added since (`@esbuild-kit/esm-loader`, `@expo/ngrok-bin>*`, `@tailwindcss/oxide>*`, `esbuild: 0.27.3` pin, esbuild `aix/android/*`). `pnpm install --lockfile-only` (Node 24) reconciles it (+1188/−94). **NOT committed** — the prune list keeps only `linux-x64` (Linux/CI-targeted); regenerating from Windows risks contaminating the deploy target. Working-tree change **reverted**. Owner should regen + commit on Linux/CI/WSL.
- **DB-gated audits RAN GREEN** via local Docker Postgres (ephemeral container `atlas-pg`, `postgres:16`, port **5434**, throwaway `postgres:postgres` cred — not committed/not a prod secret). Sequence: `docker run` → migrate (OK 1.2s) → seed (OK; 5 Phase-37 SKIPs are pre-existing) → audits:
  - `audit:csv-set-equal-bc` — **PASS**, but **0 visible csv_set_equal steps** (C2 is a hidden candidate).
  - `audit:contains-bc` — **PASS**, 2/2 steps, 14 submissions, 0 mismatches.
  - `audit:authoring` — **PASS** (exit 0); visible catalog = 92 steps, **90 self_attest + 2 contains**, zero sql_resultset/csv_set_equal.
  - Teardown: `docker rm -f atlas-pg`. (Left running for reuse; DB lost on removal → re-seed needed.)
- **C2 fixture repair PROPOSAL delivered** (read-only): `docs/phases/phase-0y-c2-fixture-repair-proposal.md`. Found it's **not a 1-file add**: (B1) datasetRef double-`.csv`; (B3) validation queries target dbt models (`mart_subscription_monthly`, `stg_*`) that the DuckDB-WASM sandbox never builds → checks can't run; (B4) hand-authored expected values internally inconsistent (step 5 says $5,847 but its breakdown = $3,891); (B5) existing `orders.csv` is the wrong shape. Repair = author 3 fixtures + fix refs + re-architect checks to be WASM-native + regenerate ALL expected values from real execution + promote candidate. No fixture created, no expectedRows changed (hard stop).
- `docs/HANDOFF_Script.md` — placeholder handoff template, **auto-committed by the hook** (`3c2a68b`); not deleted (origin unconfirmed). Owner: `git rm` if unwanted.
- **57B-flip: STILL BLOCKED** — 3 layers (candidate hidden · fixtures absent + path bug · queries target unbuilt dbt models + inconsistent expected values).

## 2026-06-06 — Phase 0.z C2 WASM-native fixture + validation repair — SHIPPED (hidden/dark)

Close-out: `docs/phases/phase-0z-c2-wasm-native-validation-repair.md`. Executed Repair A on the hidden C2
candidate. **No promotion, no `serverGrade`, no row opt-in, no schema/migration.**
- **3 fixtures authored** under `artifacts/atlas/public/datasets/seeds/` (`customers.csv` 8 rows incl 1 dup
  → 7 distinct; `subscriptions.csv` 10 rows w/ C-100 arc + June cohort; `orders.csv` realism-only).
- **5 `code_sql` steps (1,2,3,5,8) rewritten** in `analytics-engineer__semantic-layer-with-dbt-and-duckdb.ts`:
  dbt-Jinja starterCode + `validation.query` → self-contained **WASM-native inline-CTE** SQL over the seed
  tables; `datasetRefs` de-bugged (dropped double-`.csv` + bogus `.py`/`.yml`/`.sql` refs → `seeds/customers`,
  `seeds/subscriptions`); **all expected values regenerated from real DuckDB-1.5.3 execution**; prose reconciled.
- **B4 fixed**: step-5 June MRR `5847` → `2746` (real sum; per-customer enterprise contracts dissolve the
  tier×price contradiction). Step-3 C-100 arc reconciled to canonical tiers `199/999/199/0`. Steps 1/2/8
  values unchanged but now genuinely fixture-backed. `expectedOutputs.metricMrr202506` → 2746.
- **Execution-verified**: the exact committed `validation.query` strings, run against the repo seeds, produce
  the committed `expectedRows`/`expectedRow` byte-for-byte (step-3 starterCode output == expectedRows — the
  flip contract). Both reviewers independently reproduced this.
- **Gates GREEN** (Node 24 + Docker PG): typecheck + no-heuristic-runtime PASS · execution-core 83/83 · atlas
  159/159 · api-server 466/466 · curriculum-quality 132 (1 env-only `COURSE_TAXONOMY` ENOENT, pre-existing) ·
  `audit:authoring` exit 0 · `audit:csv-set-equal-bc` PASS **(0 visible — dark preserved)** · `audit:contains-bc`
  PASS 2/2. Architect-reviewer **PASS** + code-reviewer **SHIP** (no P0/P1; 2 advisory P2s documented).
- **57B-flip data/validation blocker RESOLVED.** Remaining for flip (NOT done — deliberate): promote candidate
  → set `serverGrade:true` → resolve 2 deferred 57B P2s → OpenAPI/Orval regen → byte-verify in real browser
  WASM (engine `1.33.1-dev45.0` vs 1.5.3 used here).

## 2026-06-06 — Phase 0.zz C2 real-browser DuckDB-WASM byte verification — PASS (hidden/dark)

Close-out: `docs/phases/phase-0zz-c2-real-browser-wasm-byte-verification.md`. Resolved 0.z **R1** (engine
drift). **No mismatch → no expectedRows changed. Candidate still hidden, `serverGrade` absent, no opt-in.**
- **Real-runtime path:** booted atlas **Vite** (Node 24; `PORT=5199 BASE_PATH=/` via PowerShell — git-bash
  MSYS mangled `/`), a dev-only harness page called the **real `duckdbAdapter`** (`@duckdb/duckdb-wasm`
  **1.33.1-dev45.0**) over the seed CSVs, driven by **playwright-cli** in headless Chromium. Committed
  queries extracted from the authored file (ran the exact shipped strings). **Zero new deps** (lockfile
  frozen); all harness/extractor artifacts deleted after.
- **Result: 5/5 byte-identical** to committed expected. Step 3 (csv_set_equal) flip contract verified:
  columns exact · rows exact · `mrr_amount`=**number** (no bigint/Decimal drift) · `month_start`=**string**
  `"2025-04-01"` · flags=**boolean** · `normalizeSqlRows(rows) === expectedRows`. Steps 1/2/5/8 also match
  (`[[7,7]]`, `[[one_current,0],[overlap,0]]`, `[[2746]]`, `[[1.05]]`).
- **Gates:** focused WASM verify PASS · typecheck PASS · `audit:csv-set-equal-bc` PASS (0 visible) ·
  `audit:contains-bc` PASS 2/2 · `audit:authoring` exit 0. Only persistent change: `.gitignore` += `.playwright-cli/`.
- **57B-flip is now validation-safe in the real runtime.** Remaining = product/mechanics only (promote →
  `serverGrade:true` + re-seed → 2 deferred P2s → OpenAPI/Orval regen).

## 2026-06-06 — Phase 57B-flip — SHIPPED (first LIVE csv_set_equal opt-in; 1 row)

Close-out: `docs/phases/phase-57b-flip-csv-set-equal-opt-in.md`. **Exactly ONE row opted in** (C2 step 3);
candidate promoted + rubric-approved; **envelope enforcement OFF**; Phase 52 untouched.
- **Opt-in:** `serverGrade: true` on C2 step-3 csv_set_equal spec (only hit in `scripts/src/authored/`).
- **Promotion:** `backfill:phase55-candidates` (created C2 candidate `c2dbc2db`) → `author:project promote`
  (visible project, `learnerVisible` default true; 8 steps; atomic lineage stamp) → `audit --commit`
  **85.3 → approved**. Learner routes gate on `learnerVisible` only (not qualityStatus).
- **P2s:** P2b (needs-run) RESOLVED — neutral `toast` instead of red CHECK/SUBMIT_FAIL. P2a (popstate clear)
  DEFERRED — nav is replaceState-only (popstate unreachable for step changes) + capture is per-stepId keyed,
  so no stale/cross-step submission is possible; clearing would risk discarding a valid capture.
- **OpenAPI/Orval:** added optional `ProjectStep.serverGrade` + regen (focused: serverGrade only).
- **Audit extended:** `audit-csv-set-equal-bc` now partitions DARK (legacy auto-pass BC, preserved) vs
  OPTED-IN (correct capture passes; raw SQL / malformed / wrong-rows / empty fail closed). Result:
  **1 (dark:0, opted-in:1), 5/5 grading checks pass.**
- **Gates:** typecheck + no-heuristic-runtime PASS · execution-core 83/83 · atlas 159/159 · api-server
  466/466 · curriculum-quality 132 (1 env-only ENOENT) · audit:authoring exit 0 (48 visible, 100 steps) ·
  audit:contains-bc PASS 3/3 · audit:csv-set-equal-bc PASS.
- **Reviews:** architect + code-review subagents **529'd** (API overload) → Opus self-review performed
  (grader fail-closed traced + live-verified). **Re-run `/code-review` + architect when API recovers.**
- **Step-3 flip safety:** Phase-0.zz browser-WASM output == expectedRows → FE commit submission == audit's
  passing capture. Verified end-to-end.
- **Known:** (a) authoring-audit kind-classifier still labels csv_set_equal "client-provisional" (ignores
  serverGrade) — informational; (b) orval 8.5.3 EOL churn on ~95 generated files (CRLF) — focused commit
  stages serverGrade-only; needs a `.gitattributes` normalization pass.

## 2026-06-07 — Phase 57B-postflip-review — COMPLETED (governance gap closed)

Close-out via archive report `Atlas_Each_Task_Mini_Reports_to_Chatgpt.html/src/08-…`. Re-ran the independent
reviews that 529'd during the flip + did focused post-flip verification + end-to-end integration.
- **Reviews clean:** `atlas-architect-reviewer` **PASS** (ran grading.test.ts 74/74 itself), `code-reviewer`
  **SHIP**. No P0/P1. One shared P2 (audit opt-in negative mutated a cell in place → could false-green for a
  future collision-prone multiset) → **FIXED** (commit `cb424f1`): collision-proof "extra-unmatched-row"
  (appends a guaranteed-novel sentinel row). Audit-only; no grader/live change. Second P2 (authoring
  classifier mislabels csv_set_equal "client-provisional", ignores serverGrade) → DEFERRED (known R1, exit 0).
- **Post-flip DB verify:** C2 `visible=true, approved, 85.30`; global `serverGrade=true` count = **1** (C2
  step 3); 0 other visible csv_set_equal rows; envelope off; Phase 52 untouched.
- **End-to-end integration:** real `duckdbAdapter` (wasm 1.33.1-dev45.0) in headless Chromium produced the
  step-3 `{columns,rows}`; that exact capture fed to the **live DB** server grader → `passed:true "Correct!"`;
  tampered + raw SQL → fail closed. Browser→server accept proven (full app UI still blocked by Phase 0.2 →
  used the verified adapter+live-grader harness). All temp harness files deleted.
- **Gates:** typecheck + check:no-heuristic-runtime · audit:csv-set-equal-bc PASS (1 opted-in, 5/5) ·
  audit:contains-bc 3/3 · audit:authoring exit 0. **Phase 57B fully CLOSED.**

## 2026-06-07 — Phase 58A `sql_resultset` DARK comparator foundation — SHIPPED (dark)

Close-out: `docs/phases/phase-58a-sql-resultset-dark-comparator.md`. Built the server-side `sql_resultset`
rowset comparator + audit + tests, build-DARK. **Zero rows opt in; zero learner-visible change; envelope
enforcement OFF; Phase 52 untouched.** Mirrors the 57A csv_set_equal arc.
- **Architecture:** extracted the Phase-57A `gradeCsvSetEqual` comparison body **verbatim** into a shared
  `gradeRowsetSubmission` core; `gradeCsvSetEqual` + new `gradeSqlResultset` are thin opt-in-gate wrappers
  (one comparator, two entry points — the 57A architect's anti-drift ask). Added `sql_resultset` dispatch
  case + a DARK `sql_resultset` envelope branch (NOT in `PILOT_RUNTIME_KINDS`). Authoring guard DRY'd into
  shared `assertValidRowsetSpec`; new `assertValidSqlResultsetSpec` wired into `validationConfig`.
- **Files:** `grading.ts`, `envelopeGrade.ts`, `authoring.ts` + 3 `*.test.ts` + NEW
  `scripts/src/audit-sql-resultset-bc.ts` (`audit:sql-resultset-bc`) + `validation-kind-matrix.md`.
  **routes/projects.ts `deriveServerGrade` left csv-only** (FE signal is a 58B concern). No schema/migration/
  OpenAPI/codegen/env/Phase-52 change.
- **Reviews:** `atlas-architect-reviewer` **PASS** + `code-reviewer` **SHIP**, no P0/P1 (both ran clean — no
  529 this time). Byte-verified the 162-line extraction against HEAD. 2 accept-with-note P2s (DB audits need
  PG, which I ran on Node 24; sentinel collision-proofing confirmed sound).
- **Gates GREEN (Node 24 + Docker PG :5434):** typecheck + check:no-heuristic-runtime · api-server **497/497**
  (+31) · curriculum-quality 143/144 (1 env-only COURSE_TAXONOMY ENOENT) · `audit:sql-resultset-bc` PASS
  (4 dark rows byte-identical across 40 checks; synthetic opt-in 7/7) · `audit:csv-set-equal-bc` PASS
  (live opted-in csv row regression-safe through the refactored core) · `audit:contains-bc` 3/3 ·
  `audit:authoring` exit 0.
- **58B candidate (NOT flipped):** C2 semantic-layer **step 2** (SCD-2 invariants) — already has `expectedRows`,
  deterministic 0/0 output, WASM-runnable over `seeds/customers`. Flip needs spec reshape to positional
  `{columns, expectedRows}` + real-browser WASM byte-verify + extend `deriveServerGrade` to sql_resultset.

## 2026-06-07 — Phase 58B first `sql_resultset` server-grade flip — SHIPPED

Close-out: `docs/phases/phase-58b-sql-resultset-flip.md`. First LIVE `sql_resultset` opt-in — **exactly ONE
row** (C2 `analytics-engineer-semantic-layer-with-dbt-and-duckdb` step 2, SCD-2 invariants). Same
dark→verify→flip discipline as the csv 57B-flip.
- **Reshape:** step 2 spec → `serverGrade:true`, `columns:["check","value"]`, positional `expectedRows
  [["one_current",0],["overlap",0]]` (was array-of-objects). starterCode/query/instructions/pedagogy
  unchanged — learner task identical. Landed via `author:project promote` + `audit --commit` (87.30 approved).
- **Server signal:** `deriveServerGrade` (routes/projects.ts) widened to `csv_set_equal | sql_resultset`
  (narrow boolean only — never spec/answer keys). FE routing already kind-agnostic (`serverGrade && isSqlStep`);
  2 comment-only FE edits. No OpenAPI/Orval change (serverGrade existed since 57B).
- **Browser-WASM byte-verify (real engine 1.33.1-dev45.0, headless Chromium):** step 2 starterCode →
  columns ["check","value"], rows [["one_current",0],["overlap",0]], types [string,number] = expectedRows.
- **End-to-end (live DB grader):** real capture → "Correct!"; 7 negatives (raw SQL/malformed/wrong-cols/
  missing/extra/wrong-value/empty) fail closed; step-1 BC auto-pass; csv step-3 regression pass. Harness deleted.
- **Reviews:** architect **PASS** + code **SHIP**, no P0/P1. Architect P2-1 (no route test for the no-leak
  property) **FIXED** → new `artifacts/api-server/src/routes/projects-server-grade.test.ts`. Code P2 (stale
  grading.ts comment) FIXED. Deferred: OpenAPI description polish (avoid codegen churn); authoring classifier R1.
- **Gates GREEN (Node 24 + Docker PG):** typecheck + check:no-heuristic-runtime · api-server **502/502** (+5) ·
  atlas 159/159 · curriculum-quality 143/144 (env-only COURSE_TAXONOMY) · audit:sql-resultset-bc PASS
  (3 dark + 1 opted-in) · audit:csv-set-equal-bc PASS · audit:contains-bc 3/3 · audit:authoring exit 0.
- **Invariants:** sql_resultset opted-in = 1, csv_set_equal opted-in = 1, no others; C2 visible+approved;
  envelope OFF; Phase 52 untouched; no schema/env/canary/cloud/wave/cert change; RUBRIC_VERSION frozen.

## 2026-06-07 — Phase 59A `/check`-vs-`/submit` evidence parity — SHIPPED (audit + tests)

Close-out: `docs/phases/phase-59a-check-submit-evidence-parity.md`; contract matrix:
`docs/check-submit-evidence-contract.md`. **Audit/hardening phase — no behavior change, no defect found.**
- **Conclusion:** `/check` + `/submit` share ONE pure comparator (`gradeSubmission`→`gradeRowsetSubmission`).
  Parity holds for the 2 live rows: `/submit`'s envelope branch is unreachable (enforcement OFF) → both grade
  `gradeSubmission(step, submission)` on the same `{columns,rows}` JSON. `/check` = zero side effects;
  `/submit` = durable completion+XP only on fresh pass. No answer-key leak on either route (PASS or FAIL).
- **Shipped:** `docs/check-submit-evidence-contract.md` (per-kind evidence matrix) + NEW
  `artifacts/api-server/src/routes/user-check-submit-parity.test.ts` (grading parity + fail-closed parity for
  6 negatives × 2 kinds; `/check` no-write even on passing server-graded row; `/submit` durable on pass;
  no-leak on PASS+FAIL incl. expected row-set absence; non-opted sql+csv BC). **No route/comparator/schema/env
  change.**
- **Reviews:** architect **PASS** + code **SHIP**, no P0/P1. P2s fixed this phase: strengthened no-leak test
  (was OK-path-only) to cover the failing path + assert the expected row-set never leaks; added non-opted csv
  BC case; wrote close-out + this progress entry. Deferred P2: `/submit` completed-transition path not
  re-covered by the parity file (covered by `user-submit.test.ts` H2).
- **Gates GREEN (Node 24 + Docker PG):** typecheck + check:no-heuristic-runtime · api-server **524/524** (+22) ·
  audit:sql-resultset-bc PASS (3 dark + 1 opted-in) · audit:csv-set-equal-bc PASS · audit:contains-bc 3/3 ·
  audit:authoring exit 0. atlas + curriculum-quality not run (untouched). serverGrade counts csv:1 / sql:1.
- **Invariants:** 1 csv + 1 sql opted in (unchanged); no new serverGrade/flips; C2 visible+approved; envelope
  OFF; Phase 52 untouched; no schema/env/canary/cloud/wave/cert change; RUBRIC_VERSION frozen.

## Next steps

1. ✅ **DONE (57B-flip + 57B-postflip-review):** C2 promoted + 1 csv_set_equal row server-graded (envelope
   OFF); independently reviewed (architect PASS + code-review SHIP) + end-to-end verified; P2 audit fix landed.
2. ✅ **DONE (58A):** `sql_resultset` DARK comparator + audit + tests; reviewed (architect PASS + code SHIP).
3. ✅ **DONE (58B):** first `sql_resultset` server-grade flip — C2 step 2 (1 row); browser-WASM + end-to-end
   verified; reviewed (architect PASS + code SHIP); no-leak route test added.
4. ✅ **DONE (59A):** `/check`-vs-`/submit` evidence-parity baseline — contract matrix + parity/no-leak/BC
   tests; reviewed (architect PASS + code SHIP); no behavior change.
5. ✅ **DONE (59B):** evidence-parity cleanup — serverGrade-aware `audit:authoring` (opted-in rows now
   `enforced`), `/submit` completed-transition + idempotency tests, stale-comment fixes; reviewed (architect
   PASS + code SHIP); no grading/route/schema change. **NEXT = Phase 60** (portfolio/GitHub artifact, E2).
   **Owner approval required to start 60.** Before any 2nd opt-in: observe the live rows in a real env.

## 2026-06-07 — Phase 59B evidence-parity cleanup + deferred-P2 closure — SHIPPED

Close-out: `docs/phases/phase-59b-evidence-parity-cleanup.md`. Cleanup phase; **no grading/route/schema
behavior change** (reporting + tests + comments only).
- **Closed P2s:** (a) `audit:authoring` serverGrade-awareness — NEW pure helpers in
  `validationEnforcement.ts` (`isServerGradedRowset`, `classifyValidationKindWithSpec`,
  `tallyValidationKindsWithSpec`); audit now reports the 2 opted-in rows as `enforced` (97% enforced / 3%
  client-provisional; histogram splits `<kind> (server-graded) [enforced]`). (b) `/submit`
  completed-transition + idempotency tests for a server-graded row added to the 59A parity file. (c)
  stale-comment fixes (csv/sql BC audits, authored-lineage) + a `deriveServerGrade`→`isServerGradedRowset`
  cross-reference comment (drift-prevention for the 4-copy opt-in predicate).
- **Deferred (rationale):** OpenAPI `serverGrade` description polish (embedded in yaml + 3 generated files →
  orval regen = ~95-file CRLF churn; current text accurate) — ride next regen. `.gitattributes` EOL for
  test/script files — separate tracked follow-up.
- **Reviews:** architect **PASS** + code **SHIP**, no P0/P1. Both confirmed `isServerGradedRowset` is
  logically identical to the runtime `deriveServerGrade` (no false-enforced) and the new tests are
  non-vacuous. Applied code P2-a (cross-ref comment); deferred P2-b.
- **Gates GREEN (Node 24 + Docker PG):** typecheck + check:no-heuristic-runtime · api-server **526/526** (+2) ·
  curriculum-quality **152/153** (+9; env-only COURSE_TAXONOMY) · audit:authoring exit 0 (97% enforced) ·
  audit:sql-resultset-bc PASS (3 dark + 1 opted-in) · audit:csv-set-equal-bc PASS · audit:contains-bc 3/3.
- **Invariants:** 1 csv + 1 sql opted in (unchanged); no new serverGrade/flips; envelope OFF; Phase 52
  untouched; C2 visible+approved; no schema/env/canary/cloud/portfolio/cert change; RUBRIC_VERSION frozen.
3. **Parallel low-risk cleanups (owner-approve):** `.gitattributes` `eol=lf` for `lib/*/src/generated/**`
   (orval CRLF churn) · Linux/CI `pnpm-lock.yaml` regen · teach authoring-audit classifier serverGrade-awareness.
4. Later E1→E5: 59 `/check`-vs-`/submit` evidence · 60 portfolio/GitHub · 61 authoring factory v2 · 62 cloud-lab.

## 2026-06-07 — Phase 60A evidence-safe portfolio artifact MVP foundation — SHIPPED (dark)

Close-out: `docs/phases/phase-60a-portfolio-artifact-mvp.md`. First Epic-E2 phase. A PURE,
deterministic portfolio-artifact **generator** + 45 tests + close-out. **No route, no schema/migration,
no GitHub OAuth, no publishing, no new serverGrade/opt-ins, envelope OFF, Phase 52 untouched.** The
dark-foundation half of E2 (same dark→expose discipline as the graders); the exposing route is deferred
to 60B.
- **New files (3):** `artifacts/api-server/src/lib/portfolioArtifact.ts` (pure `generatePortfolioArtifact`
  + `classifyEvidenceStatus` + safe input types — NO db/net/env), `…/portfolioArtifact.test.ts` (45 tests),
  `docs/phases/phase-60a-portfolio-artifact-mvp.md`. **Zero edits to existing routes/graders/audits/schema/
  OpenAPI** — the module is an unreferenced leaf (zero behavior change).
- **Safety by construction:** input model has NO channel for validationConfig/expectedRows/expectedRowsHash/
  query/comparator/raw-submission/secret → no-leak-by-construction (tested incl. a structural "extra
  spec-like props never surface" case). Copy makes ONLY the allowed claim ("Atlas verified that submitted
  runtime output or artifacts matched enabled validation checks") and avoids every forbidden H3 phrasing
  even in negation. `classifyEvidenceStatus` mirrors runtime `deriveServerGrade` (only csv_set_equal|
  sql_resultset + `spec.serverGrade===true` → server-graded; never false-upgrades).
- **Generated files:** README.md, VALIDATION_EVIDENCE.md, LIMITATIONS.md, LEARNER_REFLECTION_TEMPLATE.md
  (always) + DATASET_NOTES.md (conditional). Non-passed steps render `unavailable`. `requiredSkill`
  rendered. Author fields md-escaped (`mdCell`/`mdHeading`) so a `|`/`#` can't corrupt the table.
- **Data inventory:** safe to generate today from existing records (completion evidence via the Phase-29
  portfolio assembly + project/step metadata: title/summary/skills(`learning_objectives`)/tools(`tech_stack`)/
  role/course/difficulty/validation_type/required_skill/pass+completedAt/evidence-hash count). **Cannot
  generate yet (→ 60B):** the learner's submitted CODE + runtime OUTPUT are NOT durably stored
  (`submission_excerpt` truncated+forbidden, `submission_sha256` = hash, `user_code_sessions` overwritten,
  `user_code_runs` pruned) → needs a durable append-only submission store (schema = out of 60A scope).
- **Reviews:** `atlas-architect-reviewer` **PASS** + `code-reviewer` **SHIP**, no P0/P1. Fixed in-phase:
  close-out spec-path bug (`->>'serverGrade'` → `->'spec'->>'serverGrade'`); dead fields removed (generator
  now derives status incl. `unavailable`); markdown-injection escaping + test; structural no-leak test;
  §10 review outcomes filled. Deferred to 60B: canonical `BANNED_H1H2_PATTERNS` guard wiring (cross-package;
  guard passes today — architect ran it, 0 hits), durable submission store, the authenticated route.
- **Gates GREEN (Node 24 + Docker PG :5434):** typecheck + check:no-heuristic-runtime · api-server
  **571/571** (+45) · audit:sql-resultset-bc PASS (3 dark + 1 opted-in) · audit:csv-set-equal-bc PASS
  (1 opted-in) · audit:contains-bc 3/3 · audit:authoring exit 0. serverGrade counts csv:1 / sql:1.
- **Invariants:** 1 csv + 1 sql opted in (unchanged); no new serverGrade/flips/kinds; envelope OFF;
  Phase 52 untouched; C2 visible+approved; no schema/env/canary/cloud/GitHub-OAuth/cert-marketing change;
  RUBRIC_VERSION frozen. **Phase 60B NOT started.**

## 2026-06-07 — Phase 60B portfolio-artifact route + durable submission snapshots — SHIPPED

Close-out: `docs/phases/phase-60b-portfolio-artifact-route-and-snapshots.md`. Turns the 60A dark
generator into a real authenticated backend capability + adds the minimum durable storage for future
artifacts. **No GitHub OAuth/publishing, no new serverGrade/opt-ins, envelope OFF, Phase 52 untouched.**
- **Schema (additive):** NEW append-only `portfolio_submission_snapshots` (`lib/db/src/schema/progress.ts`)
  + migration `lib/db/drizzle/0002_phase60b_…sql` + journal idx 2. Unique `(user,project,step)` index →
  append-only-once. Stores learner evidence (4KB-clamped excerpt + sha256), NEVER specs/answer keys.
  Applied + verified on Docker PG.
- **/submit:** writes ONE snapshot inside the existing tx, gated on `isFreshPass` (never /check, never
  fail, never re-submit; `.onConflictDoNothing()`). No grading/XP/completion/idempotency change.
- **Route:** NEW `GET /user/projects/:slug/portfolio-artifact` (authenticated, read-only) → assembly →
  60A generator → `{projectSlug, generatedAt, files}`. 404-not-403 for hidden/unknown/not-enrolled;
  session-only userId; runtime `findBannedClaims` fail-closed guard on the bundle (defense-in-depth).
- **Assembly:** NEW `portfolioArtifactAssembly.ts` — DB → safe `PortfolioArtifactInput`; reads
  validationConfig ONLY for the serverGrade boolean (never returned); snapshot rows read presence-only;
  cert-verify clamps; 4 independent reads via Promise.all.
- **Canonical predicate:** `isServerGradeOptedIn` added to `grading.ts`; `deriveServerGrade` delegates →
  one source of truth (FE signal + grader gate + snapshot stamp + assembly).
- **H3 guard relocated (canonical):** patterns+normalize → `lib/execution-core/src/honestClaims.ts`
  (+ subpath export); atlas `banned-h1h2-phrases.ts` = thin re-export (atlas 28/28 preserved); new
  `findBannedClaims`. Route output checked against it in tests AND at runtime.
- **Reviews:** architect **PASS** + code **SHIP**, no P0/P1. Fixed in-phase: runtime honesty guard,
  query parallelization, evidence-source clarity comment. Deferred to 60C: OpenAPI/orval regen (CRLF),
  optional excerpt preview, GitHub export.
- **OpenAPI:** route NOT in openapi.yaml — deferred to 60C (supertest-tested; FE can't boot pre-0.2;
  avoids ~95-file orval CRLF churn).
- **Gates GREEN (Node 24 + Docker PG :5434):** typecheck + check:no-heuristic-runtime · api-server
  **587/587** · atlas H3 guard 28/28 · execution-core 83/83 · audit:sql-resultset-bc PASS (3 dark + 1) ·
  audit:csv-set-equal-bc PASS (1) · audit:contains-bc 3/3 · audit:authoring exit 0. serverGrade csv 1 / sql 1.
- **Invariants:** 1 csv + 1 sql opted in (unchanged); no new serverGrade/flips/kinds; envelope OFF; Phase 52
  untouched; additive schema only; no env/canary/cloud/GitHub-OAuth/cert change; RUBRIC_VERSION frozen.
  **Phase 60C NOT started.**

## 2026-06-07 — Phase 60C portfolio-artifact client contract + frontend manual download UX — SHIPPED
- **What:** made the 60B authenticated artifact route consumable from the FE. (1) Added
  `GET /user/projects/{projectSlug}/portfolio-artifact` + `PortfolioArtifactResponse` schema to
  `lib/api-spec/openapi.yaml`; (2) ran orval codegen (`pnpm --filter @workspace/api-spec run codegen`) →
  purely ADDITIVE (+316 lines, 0 deletions; the feared ~95-file CRLF churn did not occur — index already
  LF); (3) NEW scoped `.gitattributes` (eol=lf for the two generated dirs + openapi.yaml only) to contain
  future churn; (4) NEW `DownloadPortfolioBundleButton.tsx` on the Certificates page — on-click (never on
  mount) calls the generated raw `getPortfolioArtifact(slug)`, serialises the response verbatim → JSON
  download `${slug}-portfolio.json`; idle/loading/error; all failures collapse to one safe message.
- **No-leak/honesty:** client serialises only route output, reads no field, renders none of the bundle;
  no new leak channel (server assembly chokepoint unchanged). Only static labels — no over-claiming copy.
- **Download format:** JSON (no ZIP — not trivial/tested, out of scope).
- **Tests:** +6 FE (client-called-on-click; download===verbatim route output via captured Blob; no
  spec/answer-key tokens; bundle not rendered; no forbidden claims; safe error + no file written) · +1
  api-server contract test (live 200 validated against generated zod `GetPortfolioArtifactResponse` +
  non-vacuous negative control).
- **Reviews:** architect **PASS** + code-reviewer **SHIP**, no P0/P1. Fixed P2s: missing close-out
  (added `docs/phases/phase-60c-portfolio-artifact-client-and-download.md`); test-hygiene global URL
  restore. Deferred P2: unmount-mid-fetch abort guard (React 18 no-warn, cosmetic).
- **Gates GREEN (Node 24 + Docker PG :5434):** typecheck + check:no-heuristic-runtime · api-server
  **588/588** · atlas **165/165** · orval codegen clean + typecheck:libs · audit:csv-set-equal-bc PASS (1) ·
  audit:sql-resultset-bc PASS (3 dark + 1) · audit:contains-bc 3/3 · audit:authoring exit 0.
- **Invariants:** 1 csv + 1 sql opted in (unchanged); no new serverGrade/flips/kinds; envelope OFF;
  Phase 52 untouched; **no schema/migration**; route still authenticated/read-only; `/check` writes no
  snapshots; `/submit` snapshot behavior unchanged; RUBRIC_VERSION frozen. **Phase 60D NOT started.**

## 2026-06-08 — Phase 60D frontend boot decouple + portfolio download E2E verification — SHIPPED
- **Boot blocker (root cause):** `artifacts/atlas/vite.config.ts` hard-`throw`ew at config load when the
  Replit-injected `PORT`/`BASE_PATH` env were absent → blocked every local `vite build`/`dev`/`preview`.
  (The `@replit/vite-plugin-*` are NOT the blocker — cartographer/dev-banner already gated behind `REPL_ID`.)
- **Fix:** converted to `defineConfig(async ({ mode }) => …)`; `PORT`/`BASE_PATH` default to `5173`/`/` when
  `mode !== "production"`, still throw in production (fail-fast preserved). Rest of config byte-identical.
  Verified: prod build no-env still throws; dev mode → base "/" + port 5173; explicit env honored.
- **Regression guard:** `scripts/check-boot-config.ts` via `pnpm --filter @workspace/atlas run check:boot`
  (tsx, not vitest — importing the real config pulls esbuild which breaks under jsdom).
- **Real-browser E2E:** isolated `vite.e2e.config.ts` + `e2e/{index.html,e2e-main.tsx,clerk-mock.tsx}` builds
  the REAL Certificates page + REAL download button + REAL generated client; `@clerk/react` aliased to a
  test-only mock, backend faked at `window.fetch`. Served via `python -m http.server`, driven by global
  `playwright-cli` (no `@playwright/test` install — lockfile is a hard-stop). **Verified in real Chromium:**
  card renders, button visible, click → generated-client call → real JSON download with
  projectSlug/generatedAt/files{README,VALIDATION_EVIDENCE,LIMITATIONS,LEARNER_REFLECTION_TEMPLATE};
  DOM + payload leak-free; 404 → safe error + no download. Only console error = benign favicon 404.
- **Production-inert:** `vite.e2e.config.ts` + `e2e/*` never imported by prod `vite.config.ts`; outside
  tsconfig + vitest include; grep of `src/` for the mocks → 0 matches. No auth weakened, no prod userId.
- **Reviews:** architect **PASS** + code-reviewer **SHIP**, no P0/P1. Fixed close-out + this progress entry.
  Deferred P2 (rationale): e2e/ + scripts/ outside CI typecheck (node vs browser tsconfig mismatch; both
  runtime/browser-verified). Corrected an inaccurate `.gitignore` claim (`.playwright-cli/` already ignored
  since Phase 0.zz — no edit made this phase). Noted `pnpm serve` (vite preview = prod mode) still needs PORT.
- **Gates GREEN (Node 24 + Docker PG :5434):** typecheck + check:no-heuristic · **check:boot OK** ·
  api-server **588/588** · atlas **165/165** · audit:csv-set-equal-bc PASS (1) · audit:sql-resultset-bc PASS
  (3 dark + 1) · audit:contains-bc 3/3 · audit:authoring exit 0 (csv 1 / sql 1).
- **Invariants:** 1 csv + 1 sql opted in (unchanged); no new serverGrade/flips/kinds; envelope OFF; Phase 52
  untouched; no schema/migration; 60B route still authenticated/read-only; `/check` writes no snapshots;
  `/submit` unchanged; boot blocker removed (prod-safe); download browser-verified. **Phase 60E NOT started.**

## 2026-06-08 — Phase 60E backend decouple + TRUE full-stack portfolio download E2E — SHIPPED
- **Blocker (real):** the API already boots locally (connectors self-guard); the true blocker was AUTH —
  `clerkMiddleware` (app.ts) 500s EVERY request ("Missing Clerk Secret Key") without real Clerk creds.
- **Fix (gated, production-inert):** test-auth adapter in `lib/auth.ts` — `isE2EAuthMode()` = `ATLAS_E2E_AUTH==="1"
  && NODE_ENV!=="production"`; `e2eClerkIdFromRequest` (matching `X-Atlas-E2E-Auth` header vs `ATLAS_E2E_AUTH_TOKEN`
  → FIXED `ATLAS_E2E_AUTH_CLERK_ID`, else null — no impersonation). requireAuth/getCurrentUser use it (never call
  getAuth) in e2e mode; `app.ts` registers clerkMiddleware only `if (!isE2EAuthMode())`. Production path byte-unchanged.
- **Bug fixed (needed for E2E):** `user-portfolio.ts` `= ANY(${projectIds})` → malformed-array-literal 500 for any
  user with a completed project → changed to `inArray(...)`. Scoping preserved.
- **Seed:** `scripts/src/seed-e2e-user.ts` (+`seed:e2e`) — learner-side only (user + completed C2 progress + step
  completions); no authored content/serverGrade/answer keys; idempotent. Runner: `scripts/e2e-fullstack-portfolio.sh`.
- **Frontend:** `e2e/e2e-main.tsx` dual-mode — full-stack (real API via setBaseUrl + token-header injection) vs 60D mock.
- **TRUE full-stack browser E2E (real Chromium):** real frontend → real API → real Postgres → real route → real
  generator → real JSON download. Card showed the REAL DB project title; payload had projectSlug/generatedAt/4 files;
  VALIDATION_EVIDENCE showed step2 sql_resultset + step3 csv_set_equal server-graded (real predicate); LIMITATIONS
  honestly degraded (no snapshot → "code not included"); DOM+payload leak-free (one_current/secretval/expectedRows
  absent; "overlap" = false positive from "overlapping"); API-level healthz 200 / 401-no-token / 200-token / 404-unknown.
- **Reviews:** architect **PASS** + code-reviewer **SHIP**, no P0/P1 (code-reviewer verified NODE_ENV=production at the
  deploy manifest `artifact.toml` → adapter dead in prod). Fixed P2: getCurrentUser e2e branch tested (+2). Deferred P2
  (rationale): `getAuth` throws in e2e mode in out-of-scope prod routes (user.ts:48, ai.ts) — not the portfolio flow,
  not production; reflective CORS (pre-existing). Both logged for a future hardening pass.
- **Gates GREEN (Node 24 + Docker PG :5434):** typecheck + no-heuristic · check:boot OK · api-server **598/598**
  (+10 auth) · atlas **165/165** · audit:csv-set-equal-bc PASS (1) · audit:sql-resultset-bc PASS (3 dark + 1) ·
  audit:contains-bc 3/3 · audit:authoring exit 0 (csv 1 / sql 1).
- **Invariants:** 1 csv + 1 sql opted in (unchanged); no new serverGrade/flips/kinds; envelope OFF; Phase 52
  untouched; no schema/migration; route authenticated/read-only; `/check` no snapshots; `/submit` unchanged; backend
  local boot blocker removed (prod-inert); full-stack download browser-verified. **Phase 60F NOT started.**

## 2026-06-08 — Phase 60F SHIPPED (fresh-submit snapshot E2E + auth/CORS hardening)

Close-out: `docs/phases/phase-60f-fresh-submit-snapshot-e2e-and-auth-cors-hardening.md`. Reviews
**architect PASS + code-reviewer SHIP** (no P0/P1). Two thrusts, no production behaviour change.
- **Auth hardening (both = removals):** `user.ts` `/user/profile` dropped a DEAD `getAuth(req)` (result
  unused; response uses `user.clerkId`); `ai.ts` finalize + mark-read now `invalidateUserCache(user.clerkId)`
  instead of `getAuth(req).userId` (equivalent in prod — same cache key; works under gated E2E mode where
  `getAuth` throws). Removed both `getAuth` imports. No route made public; no request userId trusted.
- **CORS hardening:** `lib/cors.ts` — env allowlist (`ATLAS_ALLOWED_ORIGINS`), localhost defaults in non-prod,
  PRODUCTION-INERT legacy reflective fallback when unset in prod (+ boot warn). Unknown origin → `cb(null,false)`
  (no header, no 500); never wildcard+credentials. `lib/cors.test.ts` pins 3 branches. **Verified live:** allowed
  origin gets ACAO, disallowed gets none.
- **Evidence loop proven 2 ways (real Postgres, no mocks):** (1) API-level `user-fresh-submit-snapshot.integration.test.ts`
  (throwaway schema, synthetic opted-in `sql_resultset` step — NOT a catalog opt-in) proves /check-no-write
  (correct+invalid), /submit one safe snapshot, idempotency (no dup XP/snapshot), monotonic pass, artifact
  before/after reflection, 404-not-403, and no-leak via a `secretSentinel` spec key. (2) TRUE full-stack browser:
  real `/submit` of C2 step-2 rows → real snapshot → Certificates **Download Portfolio Bundle** in real Chromium →
  downloaded JSON reflects the snapshot (code-included flips on), leak-free (`one_current` absent; `overlap` = the
  authored "no overlapping…" false positive), honest claims only.
- **Latent 60B defect found + fixed:** `lib/db/src/test-helpers.ts` `CLONED_TABLES` lacked
  `portfolio_submission_snapshots`; 60B's /submit snapshot write made the unqualified INSERT fall through to
  public's FK-bearing table → 500. This had silently broken the Phase-30B integration test (4 fail → 4 pass after).
- **Files (10):** `routes/user.ts`, `routes/ai.ts`, `routes/ai.test.ts`, `lib/cors.ts`(new), `lib/cors.test.ts`(new),
  `app.ts`, `routes/user-fresh-submit-snapshot.integration.test.ts`(new), `lib/db/src/test-helpers.ts`,
  `scripts/src/seed-e2e-user.ts` (fresh-submit mode), `scripts/e2e-fullstack-portfolio.sh` (ATLAS_ALLOWED_ORIGINS),
  `.gitattributes` (`*.sh eol=lf`). P2s fixed in-phase (sh-EOL + 4178 dev default).
- **Gates GREEN (Node 24 + Docker PG :5434):** typecheck(4) + no-heuristic · check:boot OK · api-server **604/604** ·
  atlas **165/165** · **integration 4/4** · audit:authoring exit 0 · sql-resultset-bc PASS (3 dark + **1**) ·
  csv-set-equal-bc PASS (**1**) · contains-bc 3/3 · browser download verified.
- **Invariants:** 1 csv + 1 sql opted in (unchanged); no new serverGrade/flips/kinds; envelope OFF; Phase 52
  untouched; no schema/migration; route authenticated/read-only; `/check` no snapshots; `/submit` unchanged.
  **Phase 60G NOT started** (owner-gated: safe excerpt preview → GitHub export; + set ATLAS_ALLOWED_ORIGINS in deploy).

## 2026-06-08 — Phase 60G SHIPPED (GitHub-ready local portfolio repository export)

Close-out: `docs/phases/phase-60g-github-ready-repository-export.md`. Reviews **architect PASS +
code-reviewer SHIP** (no P0/P1). Additive export feature; NO GitHub OAuth/token/push/publishing.
- **Thin export layer** `lib/portfolioRepository.ts` over the 60A generator: reuses the MD files verbatim,
  adds `atlas-portfolio.json` (safe metadata — counts incl. `serverGradedSteps`, NOT the spec flag) +
  optional `evidence/submission-summary.md` (only when a snapshot exists; labelled learner-submitted
  evidence, NOT an answer key; no raw excerpt/hash/spec). `assertSafeRepoPaths` traversal guard (exported +
  negative-tested). Pure/deterministic.
- **Route** `GET /api/user/projects/:slug/portfolio-repository` (sibling of the 60B artifact route): same
  auth + 404-not-403 + fail-closed `findBannedClaims`. Returns `{projectSlug, generatedAt,
  format:"github-ready-repository", files}`.
- **OpenAPI + orval**: added path + `PortfolioRepositoryResponse`; regenerated (additive +184, 0 deletions);
  `getPortfolioRepository` + `GetPortfolioRepositoryResponse` generated.
- **Frontend**: `DownloadGithubRepoButton` ("Download GitHub-Ready Repo") next to the existing button →
  saves `<slug>-github-ready-repo.json` verbatim; on-click only; renders nothing; generic error.
- **CORS deploy manifest**: commented (documentation-only) `ATLAS_ALLOWED_ORIGINS` note in api-server
  `artifact.toml` — prod origin unknown, no domain invented, no runtime change.
- **No-leak/honesty**: layer + route (answer-key-bearing fixture, incl. snapshot-present path) + frontend +
  real-data live route scan (booted API + real C2 + 60F e2e learner): 401/404 correct, all 6 files,
  serverGradedSteps=2, no spec tokens, `one_current` absent, no banned claims, summary learner-labelled.
- **Files (12 +gen):** `lib/portfolioArtifact.ts` (export claim const), `lib/portfolioRepository.ts`(new)+test,
  `routes/user-portfolio-repository.ts`(new)+test, `routes/index.ts`, `lib/api-spec/openapi.yaml`+generated,
  `components/DownloadGithubRepoButton.tsx`(new)+test, `pages/certificates.tsx`, `.replit-artifact/artifact.toml`.
  3 P2s (snapshot-path route test, path-guard negative test, metadata-files assertion) fixed in-phase.
- **Gates GREEN (Node 24 + Docker PG):** typecheck(4)+no-heuristic · check:boot OK · api-server **621/621** ·
  atlas **170/170** · integration **4/4** · audit:authoring exit 0 · sql-resultset-bc PASS (3 dark + **1**) ·
  csv-set-equal-bc PASS (**1**) · contains-bc 3/3.
- **Invariants:** 1 csv + 1 sql opt-in (unchanged, total serverGrade=2); no new opt-ins/kinds; envelope OFF;
  Phase 52 untouched; no schema/migration; routes auth/read-only; `/check`+`/submit` unchanged; no
  OAuth/token/push/publishing. **Phase 60H NOT started** (owner-gated: ZIP; guarded GitHub publishing).

## 2026-06-08 — Phase 60H SHIPPED (one-click ZIP export for the GitHub-ready repository)

Close-out: `docs/phases/phase-60h-one-click-zip-export.md`. Reviews **architect PASS + code-reviewer SHIP**
(no P0/P1). Turns the 60G repository JSON into a true one-click ZIP. NO GitHub OAuth/token/push/publishing.
- **Dependency-free ZIP writer** `lib/portfolioZip.ts` (Node `zlib` only): DEFLATE method 8 + table CRC-32 +
  local/central/EOCD records; FIXED DOS timestamp + sorted entries → byte-deterministic. `safeRootFolder`
  slug sanitize + `assertSafeEntryName` traversal guard; files nested under `<slug>/`. Python
  `zipfile.testzip()`=None on live + browser output (standards-valid).
- **Route** `GET …/portfolio-repository.zip` (sibling of the JSON route, distinct literal): same
  auth/404-not-403/fail-closed-`findBannedClaims`/read-only; `application/zip` + safe Content-Disposition +
  Content-Length; built from the SAME `generatePortfolioRepository` files.
- **OpenAPI decision**: binary NOT added to codegen (avoids friction) → frontend uses `customFetch<Blob>`
  (responseType blob); `customFetch` additively exported from the api-client-react barrel. No codegen churn.
- **Frontend**: "Download GitHub-Ready Repo" now downloads ZIP by default via customFetch blob → saves
  `<slug>-github-ready-repo.zip` (client filename sanitized to match server). On-click only; renders nothing.
- **No-leak/honesty**: zip-layer test (round-trip), route test (real-ZIP extract + token scan +
  findBannedClaims), frontend test, live API `.zip` scan, and TRUE full-stack browser ZIP download (real
  Chromium → real route → real DB → 7926-byte .zip) — all leak-free, honest, 6 files under slug root.
- **Files (7):** `lib/portfolioZip.ts`(new)+test, `routes/user-portfolio-repository.ts`(+.zip handler)+test,
  `lib/api-client-react/src/index.ts` (export customFetch), `components/DownloadGithubRepoButton.tsx`+test.
  P2 fixed: client/server filename consistency. Documented/accepted: no-codegen-binary, cross-Node deflate.
- **Gates GREEN (Node 24 + Docker PG):** typecheck(4)+no-heuristic · check:boot OK · api-server **630/630** ·
  atlas **170/170** · integration **4/4** · audit:authoring exit 0 · sql-resultset-bc PASS (3 dark + **1**) ·
  csv-set-equal-bc PASS (**1**) · contains-bc 3/3 · browser ZIP verified.
- **Invariants:** 1 csv + 1 sql opt-in (unchanged, total serverGrade=2); no new opt-ins/kinds; envelope OFF;
  Phase 52 untouched; no schema/migration; routes auth/read-only; `/check`+`/submit` unchanged; no new dep;
  no OAuth/token/push/publishing. **Phase 60I NOT started** (owner-gated: guarded GitHub publishing).

## 2026-06-08 — Phase 61A SHIPPED (server-graded evidence coverage expansion: +2 rows)

Close-out: `docs/phases/phase-61a-server-graded-coverage-expansion-batch.md`. Reviews **architect PASS +
code-reviewer SHIP** (no P0/P1). First live server-grade expansion beyond the original 2 rows.
- **Flipped C2 steps 1 + 5 (`sql_resultset`) dark → serverGrade:true.** Entire rowset universe is in C2
  (only WASM-native fixture-backed project). Candidates were steps 1/5/8.
- **Flip = spec conversion**: added `serverGrade:true` + `columns` + `expectedRows` (browser-verified
  shapes) to steps 1 (`["n","n_unique"]`→`[[7,7]]`) and 5 (`["value"]`→`[[2746]]`); kept `query` +
  scalar `expectedRow`. Integer-valued outputs → robust exact-match.
- **Deferred step 8** (NRR `1.05` float): byte-verified clean but float exact-match is brittle (no
  comparator tolerance = out of scope). Stays dark + BC-clean.
- **Browser-WASM re-verification** (real Chromium, real duckdbAdapter, engine 1.33.1-dev45.0, dev-only
  harness deleted after): step1=[[7,7]], step5=[[2746]], step8=[[1.05]] — all number-typed, byte-identical
  to 0.zz. So expectedRows == the real FE capture.
- **DB propagation** via `author:project promote` (delete+reinsert steps from authored source; preserved
  visibility+approved). No schema/migration. Committed source = the authored .ts.
- **serverGrade count 2 → 4** (csv 1 unchanged; sql 1 → 3 = steps 1,2,5). H3: step-1 instruction "auto-passes"
  claim corrected; stale project-header docblock fixed (the reviewers' P2).
- **Audits PASS**: sql-resultset-bc dark 1 (step 8) / opted-in 3 (steps 1,2,5), 19 opt-in checks 0 failures
  (correct captures pass, negatives fail closed); csv 1; contains 3/3; authoring exit 0. New durable test
  `grading-c2-flip.test.ts` (9) pins the flip contract.
- **Live export stack**: artifact/repo/ZIP now classify steps 1,2,3,5 as server-graded (was 2,3); no leak
  (`7,7`/`2746`/`one_current`/spec tokens all absent); ZIP valid; honest.
- **Files (2 + docs):** `scripts/src/authored/analytics-engineer__semantic-layer-with-dbt-and-duckdb.ts`
  (flip + instruction + header), `artifacts/api-server/src/lib/grading-c2-flip.test.ts`(new).
- **Gates GREEN (Node 24 + Docker PG):** typecheck(4)+no-heuristic · check:boot OK · api-server **639/639** ·
  atlas **170/170** · integration **4/4** · all 4 audits PASS.
- **Invariants:** csv 1 / sql 3 opted-in; no other kind flipped; envelope OFF; Phase 52 untouched; no
  schema/migration; comparator byte-unchanged; routes auth/read-only; `/check`+`/submit` unchanged; C2
  visible+approved. **Phase 61B NOT started** (owner-gated: author next WASM rowset project OR tolerance-aware
  comparator for float steps).

## Build note
Phase-specific commands (`/atlas-harden-grader`, `/atlas-author-wave`, `/atlas-promote`, `/atlas-cloud-lab`, `/atlas-skill-model`, `/atlas-ship-check`, `/atlas-market-scout`) are created just-in-time at the start of their phase, not upfront (YAGNI). Universal spine (`phase-plan`/`validate`/`phase-close` + architect-reviewer + conventions) is live now.

## Key decisions & reasoning log

- 2026-05-29 — Chose **extend over rebuild**: the 57-phase trust spine (signed envelopes, lineage, BC audits, frozen rubric, H3 copy guard) is the primary asset; restarting discards it. Rebuild only the gaps (cloud, PWA, skill model, export, deploy).
- 2026-05-29 — Keep `artifacts/`+`lib/`+`scripts/` layout; renaming to `apps/packages/` rejected (780 files + 57 docs reference it; pure risk, no payoff).
- 2026-05-29 — Cloud labs sandbox-first; blueprint explicitly says do not build real credential flows until security model finalized.

## Blockers / risks

- Replit connector coupling blocks local boot until Phase 0.2. (Not blocking planning.)
- Secrets needed at deploy time only (Neon, Clerk, Stripe, Anthropic, Resend) — owner provides via `! <cmd>`, never committed.

## Deviations from plan

- None yet.

---

## 2026-06-08 — Strategic master plan persisted (Item 1 of a 4-item owner run)

Owner directed a 4-item continuous run: **1) persist plan → 2) live-research pass → 3) Phase 0.2 (unblock) ∥ 4) Phase 61B (authoring)**. Item 1 (this entry) done.

- Re-collected 4 locked decisions via owner Q&A: **(1) tiered cloud = local sandbox + BYO-credentials; (2) freemium B2C; (3) private beta ~6–8 wk, all 9 courses, 100–150 projects; (4) authoring factory + researched 2026 taxonomy.** All consistent with prior D1–D6.
- **Corrected a planning error:** initial plan claimed README/DESIGN/PRD/BRD were missing. They EXIST (Phase 0.1b). Verified BRD already aligned with all 4 decisions; README/PRD/DESIGN saturated with the decision vocabulary (no contradictions). So Item 1 = write the net-new canonical plan + light additive cross-refs, NOT recreate the docs.
- Wrote `docs/ATLAS-MASTER-PLAN.md` (canonical finish-to-beta plan: honest current-state map, monorepo extend-not-rebuild w/ 3 new packages tutor-core/labs-core/scout-core, phase-scoped `.claude/` skill model, 6–8 wk roadmap E0.2→E9, runtime-tier taxonomy A/B/C, tutor hint-ladder + 4 modes, ship-top-of-class differentiators).
- Added a one-line strategic-plan cross-ref to README/PRD/BRD/DESIGN (additive, no rewrite).
- **Next:** Item 2 live-research (parallel research agents → `docs/research/2026-project-taxonomy.md`), then Items 3∥4 under the full phase ritual. Combined mini-report for Items 1+2; separate full mini-reports for Phase 0.2 and Phase 61B.

## 2026-06-08 — 2026 taxonomy research persisted (Item 2)

Ran 4 parallel web-grounded research agents (Sonnet): DE/AE/Cloud · AI/LLM/MLOps · DS/Python/SQL · cross-cutting 2026 hiring signal. Synthesized → `docs/research/2026-project-taxonomy.md`. Three findings that refine the plan:
1. **Tier-A backbone confirmed + concentrated:** 24/26 DS+Python+SQL archetypes are WASM-native/auto-gradeable; AE (dbt+DuckDB) also dense Tier A. SQL+Python+DS+AE = the auto-gradeable beta backbone.
2. **Every discipline has a deterministic "Tier-A carve-out":** even AI/LLM/MLOps/Cloud (Tier B/C whole-project) contain a Pyodide-gradeable sub-step (retrieval P/R, RAG-metric math, stats tests, token-cost math, chunking, feature transforms, Pydantic validation, PEFT math, cosine sim, metric gate). → factory can give EVERY discipline a server-graded evidence step.
3. **H3 honesty validated by 2026 hiring signal** — narrow falsifiable claim + linkable artifact + Open Badges 3.0 is what hiring managers actually trust. Upgrade = make the completion claim specific + link to the graded commit (marketing/portfolio refinement, not a grading change).
- Also captured: hiring-signal → factory project-template requirements (arch diagram, messy data, tests, "what failed" section, eval artifact, cost estimate, tradeoff rationale) and a beta-catalog mix (~70% Tier-1 backbone / ~20% Tier-2 carve-out / ~10% Tier-3 dark).
- **Next:** Items 3∥4 — Phase 0.2 (Replit decouple / local boot) ∥ Phase 61B (author 1 WASM rowset project) under the full phase ritual.

## 2026-06-08 — Phase 0.2 SHIPPED (Item 3 — Replit-connector decouple → clean local boot)

`pnpm dev` now boots the API server (and Vite frontend) on Node 24 with **NO external secrets**, without weakening any production guarantee. Completes the 60D/60E decouple. Close-out: `docs/phases/phase-0.2-replit-connector-decouple-local-boot.md`.
- **3 source + 1 test:** new `artifacts/api-server/src/lib/resolvePort.ts` (pure PORT resolver, dev-defaults to 3000, prod still required) + `resolvePort.test.ts` (8 cases, regression-guards the new behavior); `index.ts` uses `resolvePort()` and dynamic-imports `runMigrations` from `stripe-replit-sync` inside the guarded `initStripe()`; `App.tsx` gates the Clerk-key throw behind `import.meta.env.PROD` + a dev-only `MissingClerkKeyNotice` (no auth bypass — prod unchanged).
- **Verified (Node 24 + Docker PG :5434):** typecheck(4)+no-heuristic OK · check:boot OK · api-server **648/648** (+9) · atlas **170/170**. Boot smoke (no secrets, ATLAS_E2E_AUTH=1): "PORT unset — defaulting to 3000", "Server listening port 3000", `GET /api/healthz` → 200 {"status":"ok"}; Stripe + signing-secret degrade gracefully.
- **Reviews:** architect **PASS** + code-reviewer **SHIP** (no P0/P1). Converging P2 (missing PORT regression test) + doc-nit fixed in-phase; P2-2 (App.tsx component test) deferred with rationale.
- **Invariants:** no schema/migration, no grader/serverGrade change, envelope OFF, Phase 52 untouched, no secret committed, H3 preserved. DATABASE_URL kept a legitimate hard dep (point at Docker PG locally).
- **Next:** Item 4 — Phase 61B (author 1 WASM-native rowset project, all serverGrade:false).

## 2026-06-08 — Phase 61B SHIPPED (Item 4 — author next WASM-native rowset evidence project)

Authored ONE net-new intermediate Data-Engineering project `data-engineering-saas-usage-revenue-quality-mart` ("SaaS Product Usage & Revenue Quality Mart") creating **6 fresh DARK rowset candidates** (5 sql_resultset + 1 csv_set_equal, ALL serverGrade:false) for a future controlled flip — addressing the candidate-supply gap from 61A. Close-out: `docs/phases/phase-61b-author-wasm-rowset-evidence-project.md`.
- **7 steps**, DuckDB-WASM-native over 3 committed CSV fixtures (`artifacts/atlas/public/datasets/saas-mart/`): dedupe→clean→usage-by-type→active-MRR→health-mart→DQ-audit→runbook. Every validated output is an integer/distinct-count/exact-label (type-stable, no floats) — the safest future-flip class.
- **All 6 candidate queries DuckDB-verified** (python duckdb 1.5.3) against the seeds: [[7,7]],[[13,7]],usage-by-type,[[6,4950]],health-dist,DQ-audit — byte-exact. (Engine 1.5.3 not WASM 1.33.1; acceptable because dark — future flip re-verifies in-browser.)
- **Wiring:** authored .ts + `NET_NEW_FOR_SLUG_PHASE61B` + COURSE map + index export + `backfill-phase61b-candidates.ts` (minted candidate 7e9c1a2b, source=phase61b_net_new) + `check-authored-saas-mart.ts` focused authoring check. DB lives in throwaway Docker PG; committed source = truth.
- **Visible + approved** (rubric 81.4; pedagogy 100, uniqueness 95, productionRealism 90). serverGrade-true count **UNCHANGED = 4** (DB-confirmed).
- **Gates green (Node 24 + Docker PG):** typecheck+no-heuristic, check:authored-saas-mart, audit:authoring publish-ready, audit:quality 81.4 approved, audit:sql-resultset-bc PASS (6 dark + 3 opted-in), audit:csv-set-equal-bc PASS, audit:contains-bc PASS, audit:pedagogy fully-enriched, api-server 648/648, atlas 170/170.
- **Reviews:** architect **PASS** + code-reviewer **SHIP** (no P0/P1). P2 (step-6 starterCode handed the answer) fixed in-phase → stubbed to scaffold convention; re-promoted, status preserved approved.
- **Invariants:** no new serverGrade, no comparator/envelope/schema/Phase-52 change, RUBRIC frozen, additive-only registry edits, H3 honest. **All 4 items of the owner run complete.**

## 2026-06-08 — Phase 61C SHIPPED (first serverGrade flip in the SaaS mart)

Flipped **4** of the 6 Phase-61B dark rowset candidates to `serverGrade:true` — steps **1, 2, 5, 6** (3 sql_resultset + 1 csv_set_equal) — each after a real-browser DuckDB-WASM byte-verification. serverGrade **4 → 8**. Close-out: `docs/phases/phase-61c-first-servergrade-flip-saas-mart.md`.
- **Browser-WASM harness** (0.zz/61A recipe, deleted after): real Vite + real `duckdbAdapter` (@duckdb/duckdb-wasm 1.33.1-dev45.0) + playwright-cli captured all 6 queries. Steps 1`[[7,7]]`/2`[[13,7]]`/3(usage-by-type)/5(health-dist)/6(DQ-audit) byte-matched committed; **step 4 MISMATCHED** (`[[6,"4950"]]` string vs committed number — `sum(INTEGER)`→HUGEINT→adapter `String()` fallback; CLI gave Number). The browser gate caught a real WASM-vs-CLI divergence.
- **Flipped 1,2,5,6** (most type-stable + strongest evidence: dedupe/clean/final-mart(csv)/DQ-audit). **Deferred 3** (clean, capped by max-4) + **4** (HUGEINT — needs `cast(sum as bigint)` + re-verify; documented in a step-4 comment).
- **2 files:** authored .ts (4 `serverGrade:false→true` + honest server-graded instruction copy + step-4 deferral note + docblock) + `check-authored-saas-mart.ts` (pins the exact flip set: 1,2,5,6 true / 3,4 dark / 4 flipped + 2 dark).
- **Verified (Node 24 + Docker PG):** typecheck + check OK; promote updated; `audit:sql-resultset-bc` PASS (6 opted-in, 38 checks 0 failures, fail-closed on 6 negative classes); `audit:csv-set-equal-bc` PASS (2 opted-in); authoring publish-ready; contains-bc PASS; pedagogy fully-enriched; api-server 648/648; atlas 170/170; integration 4/4. DB: serverGrade **8** (csv 2 + sql 6); new project steps 1,2,5,6=true/3,4=false; **C2 unchanged** (steps 1,2,3,5); visible+approved.
- **Reviews:** architect **PASS** + code-reviewer **SHIP** (no P0/P1). P2s non-blocking (BC audits already green here; inert expectedRow pre-existing; CRLF EOL = standing .gitattributes follow-up).
- **Invariants:** comparator byte-unchanged, envelope OFF, no schema/migration, Phase 52 untouched, RUBRIC frozen, C2 unchanged. **Phase 61D NOT started.**

## 2026-06-08 — Phase 61D SHIPPED (close out the 2 deferred SaaS-mart rowset candidates)

Flipped the **last two dark rowset steps** (3 + 4) of `data-engineering-saas-usage-revenue-quality-mart` to `serverGrade:true` after a real-browser DuckDB-WASM byte-verify → **all 6 rowset steps now live**. Close-out: `docs/phases/phase-61d-saas-mart-deferred-rowset-closeout.md`.
- **Browser-WASM re-verify (harness deleted after):** real Vite + real `duckdbAdapter` (@duckdb/duckdb-wasm 1.33.1-dev45.0) + `normalizeSqlRows` + playwright-cli, replicating the exact FE capture→submit transform. All 6 byte-matched: 1`[[7,7]]` 2`[[13,7]]` 3`usage-by-type` **4`[[6,4950]]` (num,num — the cast fix)** 5`health-dist` 6`DQ-audit`.
- **Step 4 closed the 61C HUGEINT deferral:** cast `sum(mrr_amount)` → `cast(... as bigint)` in the **starterCode SELECT (outside the learner TODO)** + reference query + instruction, so every learner capture is BIGINT→lossless Number→`[[6,4950]]` (was HUGEINT→string `"4950"`). **Step 3** was already clean (deferred only by 61C max-4). `expectedRows` byte-unchanged.
- **2 files:** authored .ts (steps 3+4 `serverGrade:false→true` + cast + honest server-graded copy + comments + docblock) + `check-authored-saas-mart.ts` (`FLIPPED={1..6}`, flippedCount===6, darkCount===0).
- **Gates (Node 24 + Docker PG):** typecheck+no-heuristic OK · check:authored-saas-mart OK (all-6) · audit:sql-resultset-bc PASS (5 opted-in, 32 checks, 0 fail) · audit:csv-set-equal-bc PASS (1 opted-in) · audit:contains-bc PASS · audit:authoring publish-ready · audit:pedagogy fully-enriched · api-server 648/648 · atlas 170/170.
- **⚠ Environment finding:** local Docker `atlas` DB was RESET to base-only seed (0 candidates, no sql/csv steps, no mart, no C2) — an out-of-scope re-seed wiped the prior serverGrade=8. Reconstructed the **mart only** (backfill→promote→audit, 81.4 approved) → DB serverGrade=**6** (mart's full set). **Authored-source global = 8→10** (mart 6 + C2 4 unchanged); C2 not reconstructed (out of scope, git-unchanged). **Integration tests ENV-BLOCKED** (reset DB under-migrated — missing `portfolio_submission_snapshots`); unrelated to the diff; remediation `pnpm migrate`.
- **Reviews:** architect **PASS** + code-reviewer **SHIP** (see close-out §9).
- **Invariants:** comparator byte-unchanged, envelope OFF, no schema/migration, Phase 52 untouched, RUBRIC frozen, C2 git-unchanged, no leak, H3 honest. **Phase 61E NOT started.**

## 2026-06-08 — Phase 61E SHIPPED (restore full local DB baseline + integration gate)

Restored a fully-migrated local DB baseline; global authored-source serverGrade is now DB-observable (**sql 8 + csv 2 = 10**) and the integration gate (env-blocked in 61D) passes again. Close-out: `docs/phases/phase-61e-db-baseline-and-integration-gate.md`.
- **Root cause = journal timestamp defect (NOT a missing migration):** `lib/db/drizzle/meta/_journal.json` entry 0 (`0000_phase31_baseline`) had `when=1779790340390` (≈2026-05) — later than 0001/0002. The applied baseline poisoned `created_at=1779790340390`, which permanently exceeds 0002's `when` → `pnpm migrate` silently skipped `0002_phase60b_portfolio_submission_snapshots` → table absent → integration `createTestSchema` clone failed. Future landmine for any 0003+ too.
- **Repair:** (source) corrected entry-0 `when` → `1700000000000` (baseline now earliest); (local throwaway DB) un-poisoned the persisted baseline `created_at`, then `pnpm migrate` applied 0002 cleanly (3/3 migrations; `portfolio_submission_snapshots` created). No new migration, no schema redesign.
- **Re-promoted via the pipeline:** C2 (`analytics-engineer-semantic-layer-with-dbt-and-duckdb`, backfill:phase55 → promote → audit **85.3 approved**; server-graded sql 1,2,5 + csv 3; step 8 dark) + Mart (refresh, **81.4 approved**; 1-6). DB global confirmed sql 8 + csv 2 = **10**.
- **New guard:** `scripts/src/check-db-baseline.ts` (`check:db-baseline`, DB-gated, read-only) — asserts all journal migrations applied + required tables + C2/Mart visible/approved/server-graded-sets + global=10. 18/18 OK.
- **Gates (Node 24 + Docker PG):** typecheck+no-heuristic · check:boot · check:db-baseline 18/18 · check:authored-saas-mart · audit:sql-resultset-bc PASS (8 opted-in + 1 dark C2-s8, 0 fail) · csv-bc PASS (2) · contains-bc PASS (4) · authoring C2+Mart publish-ready · api-server 648/648 · atlas 170/170 · **integration 4/4 (RESTORED)**.
- **Diff:** `_journal.json` (1 timestamp) + new guard + package.json (1 line) + close-out. **No grader/route/authored-copy/comparator/Phase-52/envelope change** → trust/leak/H3 byte-unchanged from 61D.
- **Reviews:** architect **PASS** + code-reviewer **SHIP** (see close-out §12).
- **Prod note (operator):** if production/Neon is stuck in the identical poisoned partial state it needs the same `created_at` correction — but the live app already depends on `portfolio_submission_snapshots`, so prod is most likely fully migrated + unaffected. Flagged, not executed. **Phase 61F NOT started.**

## 2026-06-08 — Phase 61F SHIPPED (author Cloud FinOps cost-quality mart — 6 DARK candidates)

Authored ONE net-new intermediate **Cloud-Data-Engineer** project `cloud-data-engineer-finops-cost-quality-mart` (FinOps cost-quality mart) creating **6 fresh DARK rowset candidates** (5 sql_resultset + 1 csv_set_equal, ALL serverGrade:false) + 1 **self_attest** runbook writeup — expanding rowset supply into a THIRD discipline. **Live serverGrade count UNCHANGED = 10.** Close-out: `docs/phases/phase-61f-finops-cost-quality-mart.md`.
- **7 steps**, DuckDB-WASM-native over 3 committed CSV fixtures (`artifacts/atlas/public/datasets/finops-cost-mart/`): dedupe(latest-load-wins)→normalize-env→service-spend-mart→team-allocation(csv)→untagged/unallocated→cost-quality-audit→runbook. Money = **integer cents**; every SUM `cast(... as bigint)` (proactively avoids the 61C HUGEINT→string class). All outputs integer/exact-string.
- **All 6 candidates real-browser DuckDB-WASM byte-verified** (1.33.1-dev45.0) — steps 3 & 5 cent totals returned as `number` (bigint cast worked). Kept DARK per brief.
- **Slug note:** used `cloud-data-engineer-` (the 9-course taxonomy slug; brief recommended `cloud-data-engineering-`) for convention consistency.
- **Wiring:** authored .ts + index import/array + `COURSE_FOR_AUTHORED_SLUG`(cloud-data-engineer) + `NET_NEW_FOR_SLUG_PHASE61F` + `backfill-phase61f-candidates.ts` (candidate f1f05a3c) + `check-authored-finops-mart.ts` (asserts 6 dark / 0 live / integer-only / ordered / no leak / no H3). Promote → audit **79.1 approved, visible**.
- **Gates (Node 24 + Docker PG):** typecheck+no-heuristic · check:boot · check:db-baseline (10) · check:authored-finops-mart (6 dark) · check:authored-saas-mart · audit:sql-resultset-bc PASS (8 opted + 6 dark byte-identical) · csv-bc PASS (2+1 dark) · contains-bc PASS (5) · authoring+pedagogy finops publish-ready/enriched · api-server 648/648 · atlas 170/170 · integration 4/4.
- **DB:** finops steps 1-6 serverGrade=false, step 7 contains, visible+approved; global serverGrade=10 unchanged; C2+Mart unchanged.
- **Diff:** all new/additive (project + 3 fixtures + backfill + check + index/lineage/package). No grader/route/comparator/schema/Phase-52/envelope change.
- **Reviews:** first architect pass **FAILED** — step 7 was a `contains` runbook that auto-passed ANY input (the `contains` runtime at `grading.ts:104-105` passes the WRAPPED config, not `cfg.spec`, to `matchContains` → authored spec never read → dead gate) + a false "server-enforced" H3 claim. **Fixed:** step 7 → honest `self_attest` writeup, false claim removed, false-enforcement guard added to the check. **Discovered pre-existing platform defect** (same dead `contains` in C2 + SaaS mart) → documented in close-out §16 + recommended a dedicated dark/BC grader-fix phase (out of 61F's "no validation-kind runtime change" scope). Re-reviews: architect **PASS** + code-reviewer **SHIP**.
- **Invariants:** live count 10, comparator byte-unchanged, RUBRIC frozen, 9-course taxonomy respected, H3 honest (no false enforcement claim), no leak. **Phase 61G NOT started.**

## 2026-06-08 — Phase 61G SHIPPED (contains runtime contract fix + live honesty cleanup)

Fixed the `contains` dead-gate (the defect 61F surfaced) + cleaned up the false copy on the 2 LIVE affected projects. Close-out: `docs/phases/phase-61g-contains-runtime-fix.md`.
- **Root cause:** `grading.ts:104-105` passed the WRAPPED `validationConfig` to `matchContains` (which reads top-level `needle`/`needles`); authored fields live under `spec` → never read → `needle=""` fallback → auto-pass ANY submission. Plus `mustContainAll` is a key the runtime never reads.
- **Runtime fix (BC-safe):** contains branch now extracts `cfg.spec ?? validationConfig` (inner spec for wrapped shape; top-level for legacy seed `{needle}`). `matchContains` byte-unchanged. The 2 legacy seed steps (csv-to-postgres, dbt) stay working; C2 s7 + SaaS s7 now enforce.
- **Authoring guard:** `assertValidContainsSpec` now rejects the `mustContainAll` alias (→ use `needles`). Narrow (only mustContainAll) — a broad reject breaks importing the authored index (~15 projects use other bespoke dead keys → tracked follow-up).
- **Live copy cleanup:** C2 s7 + SaaS s7 `mustContainAll`→`needles`; **removed SaaS's false "server-enforced (the commit-grader evaluates your submission body)"** → honest marker-check copy ("confirms the markers are present, not that your prose is expert-level; Atlas does not verify independent authorship"). Re-promoted: C2 85.3, SaaS 80.6 approved.
- **Proof:** `audit:contains-bc` rewritten as an ENFORCEMENT audit (4/4 enforcing, 21 assertions, 0 fail — good passes, empty + dropping any marker fail) + 6 new grading.test.ts tests. api-server **654/654** (+6).
- **Gates:** typecheck · check:db-baseline (10) · check:authored-c2 (new) + saas-mart (needles+guard) + finops · audit:contains-bc enforcement PASS · audit:sql/csv-bc PASS (no rowset drift) · authoring (C2/SaaS/finops publish-ready) · pedagogy (C2/SaaS enriched) · atlas 170/170 · integration 4/4.
- **Tracked follow-ups (NOT fixed — scope):** (1) catalog-wide bespoke-key contains (`mustContain`/`userMsgMustContain`/`reportMustContain`/`expected`) on ~15 authored projects; (2) the `exact` dead-gate (C2 steps 4,6 expected_output NULL → auto-pass + false "exact-match check" copy); (3) latent `regex` wrapper bug (0 live).
- **Reviews:** architect **PASS** + code-reviewer **SHIP** (see close-out §13).
- **Invariants:** serverGrade=10 unchanged, sql/csv comparators byte-unchanged, Phase 52/envelope untouched, no schema, RUBRIC frozen, no leak. **Phase 61H NOT started.**
