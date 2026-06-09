# Session Handoff — Atlas (rich; written pre-compact 2026-06-08, post Phase 61H)

> Fresh session: read THIS file, then `.agentic/progress.md` (canonical live state),
> `docs/phases/phase-61{d,e,f,g,h}-*.md`, `CLAUDE.md`, `docs/ATLAS-MASTER-PLAN.md`.
> **The session-end hook clobbers this into a thin git-only summary** (its
> `build:FAIL`/`typecheck:FAIL` lines are ENVIRONMENTAL — the REAL gates run green
> under shell-scoped Node 24 + Docker PG; see §2). A **compact ≠ session end**, so
> this rich version survives the compact.
>
> **Workflow:** ChatGPT directs on the owner's behalf → Claude Code is sole coder.
> In ChatGPT prompts "Replit" = Claude Code; in repo docs "Replit" = legacy
> platform/connectors. **Verify ChatGPT handoff claims vs the repo** (memory
> `atlas-chatgpt-director` — it has drifted/re-sent before). Check git log before
> re-executing.
>
> **STANDING PROTOCOL (owner directive — every task, MANDATORY):** after EVERY
> Atlas task/mini-phase: (1) return the exact multi-section `# Claude Code
> Mini-Report` + explicit STOP; (2) archive it → add `src/NN-<slug>.md` to
> `Atlas_Each_Task_Mini_Reports_to_Chatgpt.html/` (single underscore), run `python
> build.py`, commit FROM REPO ROOT. Do NOT start the next phase unprompted.

---

## 1. The goal we're working towards

Finish + surpass the interrupted 57-phase Replit build → shippable private beta.
Atlas = project-based learning PWA, zero→job-ready across **9 courses**. Strategy:
`docs/ATLAS-MASTER-PLAN.md` (extend-not-rebuild monorepo, 6–8 wk roadmap, runtime
tier A/B/C, 4 tutor modes). Locked owner decisions: tiered local+BYO cloud;
freemium B2C; private beta ~6–8 wk, all 9 courses, 100–150 projects; authoring
factory + 2026 taxonomy. **H3 honesty is law** (never claim verified-authorship /
cheat-proof / tamper-proof / job-guaranteed / certified competence /
server-enforced-when-it-isn't).

Immediate track this session = **grow server-graded evidence density + fix the
honesty/grader defects** that the density work surfaced. The moat: "Atlas verified
the learner's captured output matched the expected result" — claimed only where TRUE.

## 2. Current state of the code

- **HEAD = `af8f2ba`** (wip auto-commit) on `main`, pushed; tip phase commit
  `b094894` (archive 36). Clean tree except hook-managed `self-review.log` +
  `HANDOFF.md`.
- **This session shipped (all on `main`, reviewed architect-PASS + code-SHIP, gates green):**
  - **61D** — flipped SaaS-mart steps 3+4 → `serverGrade:true` (browser-WASM
    byte-verified; step-4 `cast(sum as bigint)` closed the HUGEINT deferral).
    serverGrade 8→10.
  - **61E** — restored the local DB baseline. Root cause: a **journal timestamp
    defect** (`0000_phase31_baseline` `when`=2026, out of order) made `pnpm migrate`
    skip `0002_portfolio_submission_snapshots`. Fixed the journal + un-poisoned the
    local `created_at`; integration restored 4/4. New guard `check:db-baseline`.
  - **61F** — authored `cloud-data-engineer-finops-cost-quality-mart` (6 DARK rowset
    candidates + a `self_attest` runbook; browser-verified; count still 10). The
    first architect pass FAILED a dead `contains` runbook → fixed via self_attest →
    which **surfaced the contains runtime dead-gate**.
  - **61G** — fixed the `contains` dead-gate: `grading.ts` now extracts the inner
    `spec` (`cfg.spec ?? validationConfig`) before `matchContains`; C2 s7 + SaaS s7
    `mustContainAll`→`needles`; removed SaaS's false "server-enforced" copy;
    `audit:contains-bc` rewritten as an enforcement audit. **Surfaced the `exact`
    dead-gate.**
  - **61H** — fixed the `exact` dead-gate: `grading.ts` exact now FAILS CLOSED on
    null/empty `expected_output` (was auto-pass — the authoring path never populates
    it); authoring guard rejects marker-key exact specs; **C2 steps 4+6
    `exact`→`contains`** (mustContainAll→needles) + honest copy. New `audit:exact-bc`.
- **serverGrade live = 10** (DB-confirmed): `sql_resultset` 8 (C2 1,2,5 + SaaS-mart
  1,2,3,4,6) + `csv_set_equal` 2 (C2 3 + SaaS-mart 5). FinOps's 6 rowset = DARK.
- **C2** (`analytics-engineer-semantic-layer-with-dbt-and-duckdb`): 8 steps; sql
  1,2,5 + csv 3 server-graded; step 8 dark (NRR float); **steps 4,6,7 now `contains`
  with `needles`** (4+6 converted from dead exact in 61H, 7 from dead mustContainAll
  in 61G). 85.3 approved.
- **SaaS mart** (`data-engineering-saas-usage-revenue-quality-mart`): 6 live rowset
  (1-6) + step-7 `contains`/needles. 80.6 approved.
- **FinOps** (`cloud-data-engineer-finops-cost-quality-mart`): 6 DARK rowset + step-7
  `self_attest`. ~79 approved.
- **Gates GREEN** (Node 24.16.0 shell-scoped + Docker PG `atlas-pg`:5434):
  typecheck(4)+no-heuristic · check:boot · check:db-baseline(10) · check:authored-{c2,saas-mart,finops} ·
  **audit:contains-bc 6/6 enforcing** · **audit:exact-bc PASS** · audit:sql-resultset-bc
  (8 opted+6 dark) · audit:csv-set-equal-bc (2+1 dark) · audit:authoring (all publish-ready) ·
  audit:pedagogy · **api-server 659/659** · **atlas 170/170** · **integration 4/4** ·
  **authoring.test 64/64**.
- **Envelope enforcement OFF · Phase 52 json_equal canary untouched (operator-pending).**
- **Env:** Node 24 via PATH prepend `C:\Users\findb\AppData\Local\nvm\v24.16.0`
  (NO `nvm use`; default shell Node 22). Docker PG `atlas-pg` (postgres:16, :5434,
  `postgres:postgres`, DB `atlas`, `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/atlas`
  — **in-shell only, NEVER committed**). `playwright-cli` (global). Python `duckdb`
  1.5.3 + `zipfile`/`markdown`.

## 3. Files actively editing

- **None mid-edit** — all committed + pushed. The session-end hook sweeps work into
  `chore: wip` commits; the clean conventional commit + close-out follows each phase.
- **Grader files now FIXED + load-bearing (do not regress):**
  - `artifacts/api-server/src/lib/grading.ts` — `contains` branch (61G: extracts
    `cfg.spec ?? validationConfig`) + `exact` branch (61H: fails closed on no
    expected). `matchContains` + the rowset comparators are byte-frozen.
  - `lib/curriculum-quality/src/authoring.ts` — `assertValidContainsSpec` rejects
    `mustContainAll`; `assertValidExactSpec` rejects marker keys on exact. Both
    NARROW (broad rejects break the authored-index import).
- **DO NOT edit without owner approval / re-verification:** the 10 live serverGrade
  rows' authored `serverGrade`/`columns`/`expectedRows` (need real-browser
  DuckDB-WASM byte-verify); `grading.ts` rowset comparators; envelope files; the
  Phase 52 canary; `pnpm-lock.yaml`; `honestClaims.ts` (only ADD).

## 4. Everything tried / gotchas (carry forward)

1. **Authored grading is structurally dead for non-rowset kinds unless fixed per-kind.**
   `author-project.ts` promote NEVER populates the DB `expected_output` column, and
   pre-61G/H the `contains`+`exact` runtime branches read the wrong place. Fixed for
   `contains` (61G) + `exact` (61H). **STILL BROKEN catalog-wide (un-promoted):**
   ~15 authored `contains` steps use bespoke keys (`mustContain`/`userMsgMustContain`/
   `reportMustContain`/`expected`); ~6 authored `exact` steps use bespoke `expected*`
   keys. **Latent `regex`** branch has the same wrapper bug (0 live). See §5.
2. **Authoring guards must stay NARROW.** A broad "reject all unrecognized keys"
   throws at module construction (validationConfig runs for EVERY authored step on
   import) → breaks `promote`/checks/audits for the whole catalog. Reject only the
   specific named dead alias.
3. **Session-end hook auto-commits as `chore: wip` + pushes** before the manual
   conventional commit. Don't rewrite (pushed `main` = no force-push). Land the
   close-out/verdicts as a follow-up `fix(...)`/`docs(...)` commit.
4. **`cd` persists across Bash calls** → commit the archive FROM `/c/Projects/Atlas`
   (the cd-into-archive-dir trap breaks `git add`).
5. **Browser-WASM verify harness** (for any future serverGrade flip): tsx extractor →
   `artifacts/atlas/public/wasm-verify-cases.json`; `artifacts/atlas/wasm-verify.html`
   + `src/wasm-verify-main.ts` import the REAL `@/lib/duckdb/duckdbRunner` +
   `normalizeSqlRows`; boot Vite via **PowerShell** `pnpm --filter @workspace/atlas
   exec vite --port 5199 --strictPort` (NO `BASE_PATH` — git-bash mangles `/` →
   `/Program Files/Git/`); `playwright-cli open …/wasm-verify.html`; read the console
   `[wasm-verify] DONE` line; delete all harness files after.
6. **`cast(sum(...) as bigint)`** for any integer SUM in a rowset candidate — bare
   `sum(INTEGER)` → HUGEINT → adapter `String()` → string `"4950"` ≠ Number (the 61C
   step-4 bug).
7. Re-promote a changed authored project: `pnpm --filter @workspace/scripts exec tsx
   ./src/author-project.ts promote <slug>` then `audit --commit <slug>` (Node 24 +
   DATABASE_URL). `node` can't import `@workspace/db` (use tsx). Integration tests:
   `$env:INTEGRATION_TEST_DB_ALLOW="1"` + `vitest run --config vitest.integration.config.ts`.

## 5. The next step I would take

- **Primary: Phase 61I — owner-gated; do NOT begin unprompted.** The documented
  follow-up (61G §11 + 61H §14): the **catalog-wide bespoke-key sweep** — convert the
  ~15 un-promoted `contains` (bespoke keys → `needles`) + ~6 un-promoted `exact`
  (bespoke `expected*` → `contains`/`self_attest`) authored steps to canonical
  honest shapes; optionally fix the latent `regex` wrapper one-liner; THEN a hard
  authoring reject of all unrecognized keys becomes feasible. Alternatively, add an
  authoring→`expected_output` path so true `exact`-match is authorable. All under the
  full phase ritual (diagnose → fix → audit:contains-bc/exact-bc → 2 reviewers →
  close-out → mini-report).
- **Standing density work:** FinOps's 6 DARK rowset candidates are ready for a future
  controlled flip (re-verify in-browser at flip time). Catalog target 100–150 → 900–1000.
- **Bigger rocks (master plan):** E4 factory v2 (scout-core); E5 Ada tutor
  (tutor-core, 4 modes); E6 tiered labs (labs-core); IDE shell; billing/onboarding;
  PWA/beta. `.gitattributes` EOL-normalize (CRLF churn, recurring reviewer P2).
- **Operator-pending (agent never executes):** Phase 52 signed-envelope canary;
  production/Neon migration-state verify (if stuck in the 61E poisoned partial state,
  apply the same `created_at` correction).
