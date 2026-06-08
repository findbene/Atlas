# Session Handoff — Atlas (rich; written pre-compact 2026-06-08, post Phase 61C)

> Fresh session: read THIS file, then `.agentic/progress.md` (canonical live state), `docs/phases/*`,
> `CLAUDE.md`, `docs/ATLAS-MASTER-PLAN.md`. **The session-end hook clobbers this into a thin git-only
> summary** (and its `build: FAIL`/`typecheck: FAIL` lines are ENVIRONMENTAL — the REAL gates run green
> under shell-scoped Node 24 + Docker PG; see §2). A **compact ≠ session end**, so this rich version
> survives the compact.
>
> **Workflow:** ChatGPT directs on the owner's behalf → Claude Code is sole coder. In ChatGPT prompts
> "Replit" = Claude Code; in repo docs "Replit" = legacy platform/connectors. **Verify ChatGPT handoff
> claims vs the repo** — it has drifted before, and THIS session it re-issued the already-shipped Phase
> 61B brief THREE times (memory `atlas-chatgpt-director`). Always check git log before re-executing.
>
> **STANDING PROTOCOL (owner directive — every task, MANDATORY):** after EVERY Atlas task/mini-phase:
> (1) return the exact multi-section `# Claude Code Mini-Report` + explicit STOP; (2) archive it → add
> `src/NN-<slug>.md` to `Atlas_Each_Task_Mini_Reports_to_Chatgpt.html/` (single underscore), run
> `python build.py`, commit FROM REPO ROOT. Do NOT start the next phase unprompted.

---

## 1. The goal we're working towards

Finish + surpass the interrupted 57-phase Replit build → shippable private beta. Atlas = project-based
learning PWA, zero→job-ready across **9 courses**. Strategy now lives in **`docs/ATLAS-MASTER-PLAN.md`**
(written this session): honest current-state map, extend-not-rebuild monorepo (+3 new packages
tutor-core/labs-core/scout-core), phase-scoped `.claude/` skill model, 6–8 wk roadmap, the **runtime-tier
A/B/C taxonomy**, tutor hint-ladder + 4 modes, ship-top-of-class differentiators. Locked owner decisions:
**(1) tiered cloud = local sandbox + BYO-creds; (2) freemium B2C; (3) private beta ~6–8 wk, all 9
courses, 100–150 projects; (4) authoring factory + researched 2026 taxonomy.** H3 honesty is law (never
claim verified-authorship / cheat-proof / tamper-proof / job-guaranteed / certified competence).

Immediate track = **grow server-graded evidence density** (the moat: "Atlas verified the learner's
captured output matched the expected result"). E4 authoring-factory + density flips.

## 2. Current state of the code

- **HEAD = `a08a395`** (archive mini-report 30) on `main`, pushed. Phase 61C flip = **`1c3c709`**.
- **This session shipped (all on `main`, reviewed PASS/SHIP, gates green):**
  - **Item 1** `9ec70c3` — `docs/ATLAS-MASTER-PLAN.md` + reconciled README/PRD/BRD/DESIGN.
  - **Item 2** `7e28115` — `docs/research/2026-project-taxonomy.md` (4 web-grounded research agents;
    key finding: SQL/Python/DS/Analytics-Eng = the auto-gradeable Tier-A backbone; every discipline has a
    deterministic Tier-A carve-out; H3 honesty validated by 2026 hiring signal).
  - **Phase 0.2** `e19d0da` — Replit-connector decouple → clean local boot. `pnpm dev` now boots the API
    server + Vite with NO secrets. New `artifacts/api-server/src/lib/resolvePort.ts` (+test); `index.ts`
    dynamic-imports `runMigrations`; `App.tsx` gates the Clerk throw behind `import.meta.env.PROD` + a dev
    notice. Boot smoke: `/api/healthz` 200 with no secrets.
  - **Phase 61B** `94830a3` — authored `data-engineering-saas-usage-revenue-quality-mart` (the "SaaS
    usage/revenue quality mart"): 7 steps, 6 rowset candidates + 1 contains, 3 CSV fixtures at
    `artifacts/atlas/public/datasets/saas-mart/`. Visible + approved (rubric 81.4).
  - **Phase 61C** `1c3c709` (NEWEST) — flipped **4** of those 6 rows to `serverGrade:true` after a real
    browser DuckDB-WASM byte-verify. **serverGrade live count 4 → 8.**
- **ServerGrade live = 8** (DB-confirmed): `csv_set_equal` **2** (C2 step 3 + mart step 5); `sql_resultset`
  **6** (C2 steps 1,2,5 + mart steps 1,2,6).
- **New mart project per-step:** step 1 sql ✅live · 2 sql ✅live · **3 sql DARK** (clean, deferred by the
  max-4 cap) · **4 sql DARK** (deferred — HUGEINT bug, see §4) · 5 csv ✅live · 6 sql ✅live · 7 contains.
  `check:authored-saas-mart` pins this exact flip set (`FLIPPED={1,2,5,6}`, 4 flipped / 2 dark).
- **C2 unchanged** (`analytics-engineer-semantic-layer-with-dbt-and-duckdb`): server-graded steps 1,2,3,5;
  step 8 still dark (NRR float — needs a tolerance comparator).
- **Gates GREEN** (Node 24.16.0 shell-scoped + Docker PG `atlas-pg`:5434): typecheck(4)+check:no-heuristic ·
  check:boot · `check:authored-saas-mart` · api-server **648/648** · atlas **170/170** · **integration 4/4** ·
  `audit:sql-resultset-bc` PASS (6 opted-in, 38 checks 0 fail; 3 dark BC-clean) · `audit:csv-set-equal-bc`
  PASS (2 opted-in) · `audit:authoring` publish-ready · `audit:contains-bc` PASS · `audit:quality` 81.4
  approved · `audit:pedagogy` fully-enriched.
- **Envelope enforcement OFF** (untouched). **Phase 52 json_equal canary untouched** (operator-pending).
- **Env:** Node 24 via shell PATH prepend `C:\Users\findb\AppData\Local\nvm\v24.16.0` (NO `nvm use`;
  default shell is Node 22). Docker PG `atlas-pg` (postgres:16, port 5434, `postgres:postgres`,
  `DATABASE_URL` in-shell only — **NEVER committed**). `playwright-cli` (global) drives real Chromium.
  **Python `duckdb` 1.5.3** present (CLI verification). Python `zipfile`/`markdown` for the archive.

## 3. Files actively editing

- **None mid-edit** — all committed + pushed. Working tree clean except hook-managed `.agentic/self-review.log`
  + `HANDOFF.md` and 3 pre-existing untracked blueprint files (owner's, untouched).
- **DO NOT edit without owner approval / re-verification:** the mart's authored
  `serverGrade`/`columns`/`expectedRows` for the **8 live rows** (any change needs real-browser DuckDB-WASM
  byte-verification); `grading.ts` `gradeRowsetSubmission` (shared comparator — byte-frozen);
  `envelopeGrade.ts`/`envelopeSubmit.ts` (envelope OFF); the Phase 52 canary; `pnpm-lock.yaml`;
  `honestClaims.ts` patterns (only ADD).

## 4. Everything tried that failed / gotchas (carry forward)

1. **HUGEINT → string (the Phase 61C step-4 finding, IMPORTANT):** `sum(INTEGER)` in DuckDB-WASM returns
   **HUGEINT**, which the `duckdbAdapter` renders as the STRING `"4950"` (its `String(v)` fallback for
   non-bigint types) — NOT the Number the Python/CLI DuckDB yields. So mart step 4 (`sum(mrr_amount)`)
   byte-MISMATCHED its committed number `4950` → **deferred, stays dark**. `count(*)`/`count(distinct)`
   return BIGINT → lossless Number (safe). **Future fix to flip step 4:** `cast(sum(mrr_amount) as bigint)`
   (→ BIGINT → Number) + re-verify in-browser. This is WHY the browser byte-verify gate is non-negotiable
   before any live flip — the CLI lied.
2. **`cd` persists across Bash tool calls** — the archive `git add "Atlas_…html"` fails when a prior `cd`
   into the archive dir is still active. ALWAYS `git add`/commit the archive **from `/c/Projects/Atlas`**
   (hit it on reports 27/28/29/30 — re-committed from root each time).
3. **Vite boot path:** `node node_modules/vite/bin/vite.js` FAILS (pnpm workspace — vite lives under
   `.pnpm`). Boot via **`pnpm --filter @workspace/atlas exec vite --port 5199`** (PowerShell, Node 24,
   no BASE_PATH — git-bash mangles `BASE_PATH=/`).
4. **Browser-WASM verify harness recipe (reuse for every future flip):** (a) tsx extractor imports the
   authored project → writes `artifacts/atlas/public/wasm-verify-cases.json` (path via
   `resolve(import.meta.dirname,"../../...")`); (b) `artifacts/atlas/wasm-verify.html` +
   `wasm-verify-main.ts` import the REAL `@/lib/duckdb/duckdbRunner` `duckdbAdapter` + `normalizeSqlRows`,
   run each case, set `window.__RESULTS__`; (c) `pnpm exec vite --port 5199` (bg) →
   `playwright-cli open …/wasm-verify.html` → poll `eval "() => window.__RESULTS__.length"` → capture
   `eval "() => JSON.stringify(window.__RESULTS__)"`; (d) **delete all harness artifacts after** (never
   commit). DuckDB-WASM picks the MVP worker bundle; seed CSVs fetched from `/datasets/...`.
5. **Candidate minting:** a new authored project needs a `project_candidates` row before `promote` (it
   hard-fails otherwise). Pattern: add a `NET_NEW_FOR_SLUG_PHASE<NN>` map in `authored-lineage.ts` +
   `COURSE_FOR_AUTHORED_SLUG` entry + a `backfill-phase<NN>-candidates.ts` (mirror
   `backfill-phase61b-candidates.ts`, `source='phase<NN>_net_new'`, status `approved`) + a package.json
   script. Run backfill BEFORE promote.
6. **Promote defaults visible+unreviewed.** Approval = `pnpm --filter @workspace/scripts run author:project
   audit <slug> --commit` (rubric ≥70 → `approved`, atomic CAS). `audit:quality`'s "Candidates" section
   scores the thin candidate PROPOSAL (low) — NOT the promoted project; don't confuse them.
7. **`node` can't import `@workspace/db`** (ESM dir import) → use `tsx` for ad-hoc DB queries.
8. **`INTEGRATION_TEST_DB_ALLOW=1 vitest …`** (bash inline-env in the npm script) fails under PowerShell →
   run `pnpm --filter @workspace/api-server exec vitest run --config vitest.integration.config.ts` with
   `$env:INTEGRATION_TEST_DB_ALLOW="1"` set the PowerShell way.
9. **`.env` Test-Path is blocked** by the security guard — don't probe `.env` directly.

## 5. The next step I would take

- **Primary: Phase 61D — owner-gated; do NOT begin unprompted.** Options (per the 61C close-out §11 +
  master plan): (a) **fix + flip mart step 4** — `cast(sum(mrr_amount) as bigint)` + re-verify in-browser
  (1 row, recovers the headline revenue metric); (b) **flip mart step 3** (already byte-verified clean,
  only deferred by the max-4 cap — a near-free +1); (c) **author the next WASM-native rowset project**
  (more candidate supply, E4 factory track). All under the full phase ritual (browser byte-verify → flip →
  audits → 2 reviewers → close-out → mini-report).
- **Standing deferrals / bigger rocks (master plan):** Phase 0.2 broader Node-24 `pnpm install` baseline +
  full `pnpm dev`; **E4 factory v2** (`scout-core`); **E5 Ada tutor** (`tutor-core`, 4 modes incl.
  adaptive); **E6 tiered labs** (`labs-core`); IDE shell; billing/onboarding; PWA/beta hardening. Catalog
  target 100–150 (beta) → 900–1000.
- `.gitattributes` EOL-normalize `lib/*/src/generated/**` + authored files (CRLF churn — reviewers' P2).
- Observe the 4 newly-live mart rows + the 2 C2-61A rows in a real env before the next flip batch.
