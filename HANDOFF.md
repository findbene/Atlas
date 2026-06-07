# Session Handoff — Atlas (rich; written pre-compact 2026-06-07, post Phase 59B)

> Fresh session: read THIS file, then `.agentic/progress.md` (canonical live state), `docs/phases/*`,
> `CLAUDE.md`. **This file is auto-clobbered by the session-end hook into a thin git-only summary** — the
> durable record is `.agentic/progress.md` + `docs/phases/*.md` + git. A **compact ≠ session end**, so this
> rich version survives the compact you're about to run.
>
> **Workflow:** ChatGPT directs on the owner's behalf → Claude Code is sole coder. In ChatGPT prompts
> "Replit" = Claude Code; in repo docs "Replit" = legacy platform/connectors (Phase 0.2 target). Verify
> ChatGPT handoff claims vs repo (it has drifted +1 phase before).
>
> **STANDING PROTOCOL (owner directive — every task, MANDATORY):** after EVERY Atlas task/mini-phase:
> (1) return the exact 12-section (or phase-specified) `# Claude Code Mini-Report`; (2) archive it → add
> `src/NN-<slug>.md` to `Atlas_Each_Task_Mini_Reports_to_Chatgpt.html/` (single underscore), run
> `python build.py`, commit. Wired in CLAUDE.md + memory + template + SessionStart hook. The auto-handoff's
> `build/typecheck FAIL` lines are ENVIRONMENTAL (no clean Node-24 `pnpm install`); real gates run green
> under the shell-scoped Node 24 + Docker PG (see §2).

---

## 1. The goal we're working towards

Finish + surpass the interrupted 57-phase Replit build → shippable private beta. Atlas = project-based
learning PWA, zero→job-ready across **9 courses**. Catalog target **900–1000 premium projects**
(~120/discipline); ~48 visible today. **Harden validation first, project waves later** (hidden-first, never
direct-publish). H3 honesty is law (never claim verified-authorship / tamper-proof / cheat-proof /
job-guaranteed). Current arc = the **E1 validation-hardening epic**: server-grade the rowset validation kinds
safely (dark → byte-verify → flip ONE row → review), then evidence-parity, then portfolio (E2).

**Phase ladder shipped this session (all on `main`, reviewed PASS/SHIP, gates green):**
57B-flip → 57B-postflip → **58A** (sql_resultset DARK comparator) → **58B** (first sql_resultset flip, C2
step 2) → **59A** (/check-vs-/submit evidence parity) → **59B** (evidence-parity cleanup). **NEXT = Phase 60**
(portfolio / GitHub artifact, E2) — **owner approval required; NOT started.**

## 2. Current state of the code

- **HEAD = `e70e387`** (`docs: archive mini-report 13 (Phase 59B…)`), pushed to `main`. Prior: `a00feb7`
  (59B cleanup). Working tree clean except hook-managed `.agentic/self-review.log` + `HANDOFF.md`.
- **Two LIVE server-graded rows, both on C2** (`analytics-engineer-semantic-layer-with-dbt-and-duckdb`,
  visible + approved, rubric 87.30):
  - **csv_set_equal** = C2 **step 3** (monthly subscription snapshot mart), serverGrade:true (Phase 57B-flip).
  - **sql_resultset** = C2 **step 2** (SCD-2 invariants), serverGrade:true (Phase 58B). expectedRows
    `[["one_current",0],["overlap",0]]`, columns `["check","value"]`.
  - Global visible `serverGrade=true` count = **exactly 2** (1 csv + 1 sql). No other opt-ins.
- **Shared comparator:** `gradeRowsetSubmission` in `artifacts/api-server/src/lib/grading.ts`; thin wrappers
  `gradeCsvSetEqual` + `gradeSqlResultset` (opt-in gate `spec.serverGrade===true`, else `BC_AUTO_PASS`).
  `/check` + `/submit` both grade via `gradeSubmission`; `/submit` adds the durable tx (completions/XP/
  progress) under `pg_advisory_xact_lock`; `/check` = zero side effects.
- **FE signal:** `deriveServerGrade` (`routes/projects.ts`) returns the narrow boolean for
  `csv_set_equal | sql_resultset` opted-in rows — NEVER the spec/expectedRows. FE routes on
  `serverGrade && isSqlStep` (`project-workspace.tsx` → `decideCsvSetEqualSubmission`) to submit
  `{columns,rows}` JSON.
- **Envelope enforcement OFF** — `PILOT_RUNTIME_KINDS={json_equal}` (`envelopeGrade.ts:47`),
  `ATLAS_ENVELOPE_REQUIRED_KINDS` empty. csv/sql have DARK envelope branches (auto-pass while off).
  **Phase 52 json_equal canary UNTOUCHED** (operator-pending; never agent-flipped).
- **audit:authoring is now serverGrade-aware** (59B): the 2 opted-in rows report `enforced`
  (97% enforced / 3% client-provisional; histogram splits `<kind> (server-graded) [enforced]`).
- **Docs:** evidence contract `docs/check-submit-evidence-contract.md`; per-phase close-outs
  `docs/phases/phase-{58a,58b,59a,59b}-*.md`; matrix `docs/validation-kind-matrix.md` updated.
- **Gates GREEN** (Node 24.16.0 shell-scoped + Docker PG `atlas-pg`:5434): typecheck +
  check:no-heuristic-runtime · api-server **526/526** · curriculum-quality **152/153** (1 env-only
  `COURSE_TAXONOMY` ENOENT) · atlas 159/159 (when touched) · audit:sql-resultset-bc PASS (3 dark + 1
  opted-in) · audit:csv-set-equal-bc PASS · audit:contains-bc 3/3 · audit:authoring exit 0.
- **Env:** Node 24 via shell-scoped PATH prepend `C:\Users\findb\AppData\Local\nvm\v24.16.0` (NO `nvm use`).
  Docker PG `atlas-pg` (postgres:16, port 5434, throwaway `postgres:postgres`, `DATABASE_URL` in-shell only).
  Python `markdown` installed for the archive `build.py` (reinstall if a fresh env lacks it).

## 3. Files actively editing

- **None mid-edit** — all committed + pushed at `e70e387`. Recent: `055049b`/`6ee7b65` (58A/58B grading) →
  `75f3930` (59A parity) → `a00feb7` (59B audit/tests) → `e70e387` (archive 13).
- **DO NOT edit without owner approval:** C2 authored file's `serverGrade`/`expectedRows` (2 live rows);
  `grading.ts` `gradeRowsetSubmission`; `envelopeGrade.ts`/`envelopeSubmit.ts` (envelope must stay off);
  the Phase 52 canary; `pnpm-lock.yaml`.

## 4. Everything tried that failed / gotchas

1. **Start-Job does NOT persist across PowerShell tool calls** (fresh shell each call) — boot long-lived
   processes (Vite) with the tool's `run_in_background:true`, then `TaskStop` to kill.
2. **Vite needs `PORT` env, not `--port`** (`vite.config.ts` reads `process.env.PORT`); also set
   `BASE_PATH=/`. Boot via PowerShell (git-bash MSYS mangles `/`).
3. **playwright-cli escapes eval'd JSON** → render results into the DOM (marker-wrapped) and read via the
   eval textContent, then strip markers; don't pipe escaped JSON into JSON.parse.
4. **Temp harness files must live OUTSIDE `scripts/src`** (cross-package `.ts` imports fail the scripts
   typecheck) and be DELETED before gates. (58B browser-verify harness: extractor + Vite page + grader,
   all deleted post-capture.)
5. **DB-gated audits + many api-server tests need `DATABASE_URL`** (Docker PG :5434). Review subagents run
   on Node-22/no-DB so they CANNOT re-run those — run them yourself on Docker PG; their diffs are often
   comment-only so behavior is unchanged.
6. **First `git commit -m @'…'@` (PowerShell here-string) in the Bash tool injects a stray `@`** — use a
   bash heredoc (`git commit -F - <<'EOF' … EOF`). Amend pre-push if it slips.
7. **OpenAPI `serverGrade` description is embedded in openapi.yaml + 3 generated files** — updating cleanly
   needs an orval regen (~95-file CRLF churn) or hand-editing 3 generated files. DEFERRED as not-worth-churn.
8. **autocrlf → CRLF warnings** on test/script files on `git add` (harmless; normalizes). `.gitattributes`
   EOL-normalize for `lib/*/src/generated/**` + test/script files is a pending cross-cutting follow-up.
9. **`COURSE_TAXONOMY` test** needs gitignored `.local/course-skill-maps.md` (absent) → 1 env-only
   curriculum-quality failure, not a defect.
10. **Full app UI can't boot** (Replit connector coupling, Phase 0.2 pending) → integration via the verified
    browser DuckDB-WASM adapter capture + live-route/grader harness + route-level supertest, not a full boot.

## 5. Next step

**Primary: Phase 60 — portfolio / GitHub artifact (E2).** New epic; first non-validation-hardening phase.
**Owner approval required to start; do NOT begin unprompted.** Expect the same ritual: pre-flight invariant
check → scoped build → tests → `atlas-architect-reviewer` + `/code-review` → gates → 17-section mini-report +
HTML archive → close-out + progress. Hard stops will include H3 honesty on any portfolio/credential copy
(NEVER claim verified-authorship / tamper-proof / job-guaranteed).

**Before any 2nd validation opt-in:** observe the 2 live opted-in C2 rows in a real env (needs Phase 0.2
local boot or a Neon env). **Parallel low-risk cleanups (owner-approve, any time):** OpenAPI `serverGrade`
description (ride next orval regen); `.gitattributes` EOL normalization (generated + test + script files);
Linux/CI `pnpm-lock.yaml` regen; Phase 0.2 Replit-connector decouple for a real `pnpm dev`.

**Inherited invariants (never break):** RUBRIC_VERSION 1.0.1 frozen · archive=hide (no row deletes) · hidden
slugs → 404 not 403 · bidirectional candidate↔project lineage · no runtime `mapToCourse` · H3 honest-claims ·
new graders ship dark + BC audit · hidden-first publishing · Phase 52 canary operator-pending (never
agent-flipped) · envelope enforcement stays OFF until a separate owner-approved operator canary · 9 courses
exactly · after EVERY task: the mini-report + HTML archive.
