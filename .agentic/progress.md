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

## Next steps

1. ✅ **DONE (0.zz):** C2 step-3 `expectedRows` byte-verified in real-browser DuckDB-WASM
   (`1.33.1-dev45.0`) — 5/5 match, flip contract holds. Engine-drift risk closed. (Broader Node-24
   `pnpm install` baseline + Phase 0.2 decouple still pending for running the whole app via `pnpm dev`.)
2. **Phase 57B-flip** — DATA/VALIDATION blocker now RESOLVED (0.z). To execute: (a) **promote** the C2
   candidate to a visible project; (b) set `serverGrade:true` on step 3 + re-seed; (c) resolve the 2
   deferred P2s (popstate clear, `needs-run` UX); (d) add `serverGrade` to OpenAPI `ProjectStep` + Orval
   regen. Heed 0.z R2 (enterprise-NRR filter dead branches) when authoring future fixtures.
3. **E1 continues** — 58 `sql_resultset`, 59 `/check`-vs-`/submit` evidence. Then E2 (60 portfolio/
   GitHub), E4 (61 authoring factory v2, continuous), E5 (62 cloud-lab safety).

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
