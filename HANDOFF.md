# Session Handoff — Atlas (rich; written pre-compact 2026-06-08, post Phase 61A)

> Fresh session: read THIS file, then `.agentic/progress.md` (canonical live state), `docs/phases/*`,
> `CLAUDE.md`. **The session-end hook clobbers this into a thin git-only summary** (and its
> `build: FAIL`/`typecheck: FAIL` lines are ENVIRONMENTAL — the REAL gates run green under shell-scoped
> Node 24 + Docker PG; see §2). A **compact ≠ session end**, so this rich version survives the compact.
>
> **Workflow:** ChatGPT directs on the owner's behalf → Claude Code is sole coder. In ChatGPT prompts
> "Replit" = Claude Code; in repo docs "Replit" = legacy platform/connectors. Verify ChatGPT handoff claims
> vs the repo (it has drifted +1 phase before).
>
> **STANDING PROTOCOL (owner directive — every task, MANDATORY):** after EVERY Atlas task/mini-phase:
> (1) return the exact multi-section `# Claude Code Mini-Report` + explicit STOP; (2) archive it → add
> `src/NN-<slug>.md` to `Atlas_Each_Task_Mini_Reports_to_Chatgpt.html/` (single underscore), run
> `python build.py`, commit FROM REPO ROOT. Do NOT start the next phase unprompted.

---

## 1. The goal we're working towards

Finish + surpass the interrupted 57-phase Replit build → shippable private beta. Atlas = project-based
learning PWA, zero→job-ready across **9 courses**. Catalog target **900–1000 premium projects**
(~120/discipline); ~48 visible today. **Harden validation + build the evidence/portfolio loop first, project
waves later** (hidden-first, never direct-publish). H3 honesty is law (never claim verified-authorship /
no-outside-help / tamper-proof / cheat-proof / job-guaranteed / certified competence).

Epic arc: **E1 validation-hardening (DONE)** → **E2 evidence & portfolio (DONE through 60H)** →
**E4 server-graded-evidence density + authoring factory (IN PROGRESS — 61A is the first density batch)**.

## 2. Current state of the code

- **HEAD = `4c97825`** ("Phase 61A —" wip/owner commit) on `main`, pushed. My Phase-61A feature commit =
  **`11e60c6`** (`feat(curriculum): server-grade C2 steps 1+5`), archive = `366c066`. Working tree clean
  except hook-managed `.agentic/self-review.log` + `HANDOFF.md`.
- **Phase ladder shipped (all on `main`, reviewed PASS/SHIP, gates green):** 57A→57B-prereq→0.z/0.zz
  (C2 WASM-native fixtures + real-browser byte-verify) → 57B-flip (csv step 3 live) → 58A/58B (sql step 2
  live) → 59A/59B (check↔submit parity) → **60A** (dark portfolio generator) → **60B** (authed artifact
  route + durable `portfolio_submission_snapshots` + `/submit` fresh-pass write) → **60C** (OpenAPI +
  generated client + "Download Portfolio Bundle" JSON) → **60D** (prod-safe Vite boot decouple) → **60E**
  (gated test-auth backend decouple + TRUE full-stack browser download) → **60F** (fresh-submit→snapshot→
  artifact→browser-download evidence loop proven; auth/CORS hardening) → **60G** (GitHub-ready repository
  JSON export: `lib/portfolioRepository.ts` + `GET …/portfolio-repository` + `atlas-portfolio.json` +
  optional `evidence/submission-summary.md` + "Download GitHub-Ready Repo" button) → **60H** (dependency-free
  ZIP: `lib/portfolioZip.ts` + `GET …/portfolio-repository.zip` + frontend `customFetch<Blob>` ZIP download)
  → **61A** (server-grade density flip).
- **Phase 61A (NEWEST):** flipped **C2 steps 1 + 5** (`sql_resultset`) dark → `serverGrade:true`.
  - Edits (2 source files): `scripts/src/authored/analytics-engineer__semantic-layer-with-dbt-and-duckdb.ts`
    (step 1 spec += `serverGrade:true, columns:["n","n_unique"], expectedRows:[[7,7]]`; step 5 spec +=
    `serverGrade:true, columns:["value"], expectedRows:[[2746]]`; kept `query`+scalar `expectedRow`; step-1
    instruction "auto-passes" claim corrected; header docblock updated) + new
    `artifacts/api-server/src/lib/grading-c2-flip.test.ts` (9 tests pinning the flip contract).
  - **Browser-WASM re-verified** (real Chromium, real `duckdbAdapter`, `@duckdb/duckdb-wasm@1.33.1-dev45.0`
    = the learner runtime, UNCHANGED since 0.zz): step1=`[[7,7]]`, step5=`[[2746]]`, step8=`[[1.05]]`, all
    number-typed, byte-identical to 0.zz → `expectedRows` == the real FE capture.
  - **Deferred step 8** (NRR `1.05` float): byte-verified clean but exact-match of a float ratio is brittle
    (no comparator tolerance = hard stop). Stays dark + BC-clean.
  - **serverGrade count 2 → 4**: csv_set_equal 1 (step 3) + sql_resultset **3** (steps 1, 2, 5). C2 stays
    visible + approved.
- **DB flip propagation:** the committed authored `.ts` is the source of truth. It reaches the DB via
  **`pnpm --filter @workspace/scripts exec tsx src/author-project.ts promote <slug>`** (delete+reinsert
  steps from the authored source, PRESERVES `qualityStatus`/visibility). The plain `seed` does NOT
  propagate spec edits (idempotent, won't overwrite existing `validation_config`). NO schema/migration, NO
  comparator change (`grading.ts` byte-unchanged).
- **Gates GREEN** (Node 24.16.0 shell-scoped + Docker PG `atlas-pg`:5434): typecheck(4) + check:no-heuristic
  · check:boot OK · api-server **639/639** · atlas **170/170** · integration **4/4** · `audit:sql-resultset-bc`
  PASS (dark 1 [step 8] / opted-in 3 [steps 1,2,5], 19 opt-in checks 0 failures) · `audit:csv-set-equal-bc`
  PASS (1) · `audit:contains-bc` 3/3 · `audit:authoring` exit 0. Live export stack (real API + re-authored
  DB): artifact/repo/ZIP now classify steps 1,2,3,5 server-graded, leak-free, valid ZIP.
- **Envelope enforcement OFF** (untouched). **Phase 52 json_equal canary untouched** (operator-pending).
- **Env:** Node 24 via shell PATH prepend `C:\Users\findb\AppData\Local\nvm\v24.16.0` (NO `nvm use`). Docker
  PG `atlas-pg` (postgres:16, port 5434, throwaway `postgres:postgres`, `DATABASE_URL` in-shell only —
  **NEVER committed**). `playwright-cli` (global, v0.1.13) drives real Chromium → `./.playwright-cli/`
  (gitignored). Python `zipfile` (gold-standard ZIP validator) + Python `markdown` (archive `build.py`).

## 3. Files actively editing

- **None mid-edit** — all committed + pushed. Phase 61A = `11e60c6` (2 source) → `366c066` (archive 25).
- **DO NOT edit without owner approval / re-verification:** the C2 authored file's `serverGrade`/`columns`/
  `expectedRows` for the **4 live rows** (steps 1,2,3,5) — any change needs real-browser DuckDB-WASM
  byte-verification; `grading.ts` `gradeRowsetSubmission` (the shared comparator — byte-frozen);
  `envelopeGrade.ts`/`envelopeSubmit.ts` (envelope stays OFF); the Phase 52 canary; `pnpm-lock.yaml`;
  `honestClaims.ts` patterns (only ADD).

## 4. Everything tried that failed / gotchas (carry forward)

1. **`cd` persists across Bash tool calls** — the archive `git add "Atlas_…html"` fails when a prior `cd`
   into the archive dir is still active. ALWAYS `cd /c/Projects/Atlas &&` before the archive commit. (Hit
   it again in 61A — re-committed from repo root.)
2. **Seed does NOT propagate authored spec edits** — `seed` is idempotent + won't overwrite existing
   `validation_config`. The flip propagation path is `author-project.ts promote <slug>` (delete+reinsert
   steps). Re-author cascade-DELETES `portfolio_submission_snapshots` (stepId FK) but `user_step_completions`
   (keyed by stepNumber) SURVIVE — so a re-authored learner stays "completed".
2b. **git-bash mangles `BASE_PATH=/`** into a Windows path (`/Program Files/Git/`) → the Vite base breaks
   (0.zz's documented MSYS quirk). FIX: unset BASE_PATH (the vite config defaults base to `/` in dev) or set
   it via PowerShell. Boot the WASM-verify harness Vite WITHOUT BASE_PATH.
3. **`clerkMiddleware` 500s every request without `CLERK_SECRET_KEY`** — gated off in e2e mode
   (`ATLAS_E2E_AUTH=1` + the `auth.ts` test-auth adapter). Do NOT commit a dummy Clerk key.
4. **vitest can't import the Vite config** → the boot guard is a `tsx` script (`check:boot`), not a test.
5. **Drizzle `= ANY(${jsArray})` is a trap** (malformed array literal). Use `inArray(...)`. Fixed in 60E.
6. **`.sh` via the Write tool is BLOCKED** by the pre-edit hook (its `bash -n` runs on a mangled Windows
   temp path). Write `.sh` via a Bash heredoc + `bash -n` it yourself. Also `.gitattributes` now forces
   `*.sh eol=lf` (60F) so CRLF can't corrupt `ATLAS_ALLOWED_ORIGINS`.
7. **DB-gated audits + most api-server tests + the integration suite need `DATABASE_URL`** (Docker PG :5434)
   + `INTEGRATION_TEST_DB_ALLOW=1` for `vitest.integration.config.ts`. Review subagents run Node-22/no-DB →
   they verify code+tests, not by re-running gates. Run gates yourself.
8. **Binary ZIP route is intentionally NOT in OpenAPI codegen** (60H) — the frontend uses `customFetch<Blob>`
   (`responseType:"blob"`), now exported from the api-client-react barrel. Don't add a binary codegen pass.
9. **Background servers (`&`) persist** across Bash calls here — kill by port via PowerShell
   `Get-NetTCPConnection … Stop-Process` when done (API :5055/:5056, FE :4178, vite-harness :5199).

## 5. Next step

**Primary: Phase 61B — owner approval required; do NOT begin unprompted.** Per the 61A close-out (§14) +
both reviewers, two owner-gated forks:
- (a) **Author the next WASM-native, fixture-backed rowset project** (3 short seed CSVs + self-contained
  inline-CTE validation SQL + execution-derived `expectedRows` + real-browser byte-verification) so there
  are FRESH server-grade flip candidates. Today the entire `sql_resultset`/`csv_set_equal` universe is ONE
  project (C2) — density can't grow further without more such projects (the authoring-factory track, E4).
- (b) **Add a dark, BC-audited numeric-tolerance / round-aware option to the rowset comparator** (a real
  `grading.ts` change, shipped dark + opt-in + BC audit) to unlock float-valued steps like C2 **step 8**
  (NRR `1.05`), which is byte-verified clean but currently un-flippable under exact-match.

**Before any further flip batch:** observe the 2 newly-live C2 rows (steps 1, 5) in a real env.
**Standing deferrals:** browser-level fresh-`/submit`→snapshot E2E (API/unit-verified); Phase 0.2
Replit-connector decouple for real billing/email/tutor locally (the portfolio flow doesn't need it); the
broader 900–1000-project catalog waves (hidden-first) gated on the authoring factory.

**Flip discipline (carry forward, non-negotiable for any serverGrade flip):** ① real-browser DuckDB-WASM
byte-verify the FE capture == `expectedRows` (number types, no bigint/Decimal/float drift); ② prefer
integer-valued outputs (exact-match robust); defer float ratios until a tolerance comparator exists; ③ keep
`query`+scalar `expectedRow`, ADD `serverGrade`+`columns`+`expectedRows`; ④ propagate via `author-project
promote`; ⑤ `audit:sql-resultset-bc`/`csv-set-equal-bc` must show the opt-in contract PASS (correct capture
passes, all negatives fail closed); ⑥ fix any now-false learner-facing "auto-passes" copy (H3).

**Inherited invariants (never break):** RUBRIC_VERSION 1.0.1 frozen · archive=hide (no row deletes from
projects/candidates) · hidden slugs → 404 not 403 · bidirectional candidate↔project lineage · no runtime
`mapToCourse` · H3 honest-claims · new graders ship dark + BC audit · hidden-first publishing · Phase 52
canary operator-pending (never agent-flipped) · envelope enforcement stays OFF · 9 courses exactly · the
gated test-auth adapter stays production-inert · after EVERY task: the mini-report + HTML archive (from
repo root) + the explicit STOP.
