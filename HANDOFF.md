# Session Handoff — Atlas (rich; written pre-compact 2026-06-07)

> Fresh session can continue from this file alone, then read `.agentic/progress.md` (canonical live
> state), `docs/phases/*`, `CLAUDE.md`. **This file is auto-clobbered by the session-end hook into a
> thin git-only summary** — the durable record is `.agentic/progress.md` + `docs/phases/*.md` + git.
> A **compact ≠ session end**, so this rich version survives the compact you're about to run.
>
> **Workflow:** ChatGPT directs on the owner's behalf → Claude Code is sole coder. In ChatGPT prompts
> "Replit" = Claude Code; in repo docs "Replit" = legacy platform/connectors (Phase 0.2 target).
> Verify ChatGPT handoff claims vs repo (it has drifted +1 phase twice).
>
> **STANDING PROTOCOL (owner directive — every task, MANDATORY):** after EVERY Atlas task/mini-phase:
> (1) return the exact 12-section `# Claude Code Mini-Report` (format `.claude/atlas-mini-report-template.md`);
> (2) archive it → add `src/NN-<slug>.md` to `Atlas_Each_Task_Mini_Reports_to_Chatgpt.html/` (single
> underscore), run `python build.py`, commit. Wired in CLAUDE.md + memory + template + SessionStart hook.
> The build `validation: build FAIL` in the auto-handoff is ENVIRONMENTAL (no clean Node-24 `pnpm install`).

---

## 1. The goal we're working towards

Finish + surpass the interrupted 57-phase build → shippable private beta. Atlas = project-based learning
PWA, zero→job-ready across **9 courses** (data-engineering, ai-engineer, mlops-engineer, data-scientist,
analytics-engineer, applied-llm-engineer, cloud-data-engineer, python-libraries, sql). Catalog target
**900–1000 premium projects** (~120/discipline); 48 visible today. **Harden validation first, project waves
later** (hidden-first, never direct-publish). H3 honesty is law (never claim verified-authorship /
tamper-proof / cheat-proof / job-guaranteed).

**Immediate arc — `csv_set_equal` server-grading, rolled out safely, NOW LIVE for 1 row + reviewed:**
57C decided Option C → 57B-prereq built it dark → 0.x/0.y local-green → 0.z repaired C2 (WASM-native,
execution-derived) → 0.zz byte-verified in real browser wasm → **57B-flip** promoted C2 + opted in exactly 1
step → **57B-postflip-review** re-ran the independent reviews + end-to-end verified + closed the governance
gap. **Phase 57B is fully closed.** Next hardening = Phase 58 `sql_resultset` (E1) → 59 → 60 → 61 → 62
(`.agentic/plan.md` epics E1→E5).

## 2. Current state of the code

- **Last shipped: Phase 57B-flip + 57B-postflip-review (COMPLETE).** First LIVE `csv_set_equal` server-grade
  opt-in: C2 (`analytics-engineer-semantic-layer-with-dbt-and-duckdb`) **visible + qualityStatus=approved
  (rubric 85.30)**; **`serverGrade: true` on C2 step 3 ONLY** (the only opt-in repo-wide; global
  `serverGrade=true` DB count = 1). Graded by the COMMIT path (`gradeSubmission`→`gradeCsvSetEqual`,
  `artifacts/api-server/src/lib/grading.ts`).
- **Envelope enforcement OFF** — `csv_set_equal` NOT in `PILOT_RUNTIME_KINDS` (`envelopeGrade.ts:47` =
  `{json_equal}`); `ATLAS_ENVELOPE_REQUIRED_KINDS` empty. envelopeGrade/envelopeSubmit/user.ts untouched by
  the flip. **Phase 52 json_equal canary untouched** (operator-pending).
- **Independent reviews: architect-reviewer PASS + code-reviewer SHIP** (re-ran clean in 57B-postflip-review;
  the flip-session 529s are resolved). No P0/P1. One shared P2 (audit opt-in negative could false-green for a
  future collision-prone multiset) → **FIXED** `cb424f1` (collision-proof "extra-unmatched-row" sentinel
  append). Deferred P2: `audit:authoring` classifier still labels csv_set_equal "client-provisional"
  (ignores serverGrade) — informational only.
- **End-to-end verified:** real `duckdbAdapter` (wasm `1.33.1-dev45.0`) in headless Chromium produced C2
  step-3 `{columns,rows}`; that exact capture fed to the **live DB** server grader → `passed:true "Correct!"`;
  tampered + raw SQL → fail closed.
- **Gates GREEN** (Node 24.16.0 shell-scoped + Docker PG `atlas-pg`:5434): typecheck + check:no-heuristic-runtime ·
  execution-core 83/83 · atlas 159/159 · api-server 466/466 · curriculum-quality 132 (1 env-only
  `COURSE_TAXONOMY` ENOENT) · grading.test 74/74 (architect ran) · audit:authoring exit 0 (48 visible, 100
  steps) · audit:csv-set-equal-bc PASS (1 opted-in, dark 0, 5/5) · audit:contains-bc 3/3.
- **Mini-report protocol wired** (CLAUDE.md + memory + `.claude/atlas-mini-report-template.md` + SessionStart
  hook `.claude/hooks/atlas-mini-report-reminder.sh`). Archive `Atlas_Each_Task_Mini_Reports_to_Chatgpt.html/`
  holds 9 reports (00–08); `python build.py` regenerates.
- **Env:** Node 24 via shell-scoped PATH prepend (`C:\Users\findb\AppData\Local\nvm\v24.16.0`; no `nvm use`).
  Docker PG `atlas-pg` (postgres:16, port 5434, throwaway `postgres:postgres`, `DATABASE_URL` in-shell only).
  Python `duckdb` + `markdown` installed as local dev tools (do NOT touch the JS lockfile).
- **Git:** branch `main`, HEAD `570c22d` pushed (+ possible session-end `chore: wip` auto-commits). Working
  tree clean except hook-managed `.agentic/self-review.log` + `HANDOFF.md`.

## 3. Files actively editing

- **None mid-edit** — all committed + pushed. Recent commits: `055049b` (57B-flip) → `cb424f1` (postflip
  audit P2 fix) → `726cb7f` (archive report 08) → `570c22d` (progress close-out).
- **NOT to edit without approval:** C2 authored file's `serverGrade`/`expectedRows` (live); `envelopeGrade.ts`/
  `envelopeSubmit.ts` (envelope must stay off); the Phase 52 canary; `pnpm-lock.yaml`.

## 4. Everything tried that failed / gotchas

1. **Architect + code-review subagents 529'd during the FLIP** (API overload) — **now RESOLVED**: both re-ran
   clean in 57B-postflip-review (PASS + SHIP). If they 529 again on a future phase, stop + report (don't fake it).
2. **Bash safety-classifier outage** (Opus overload) blocked git/Bash temporarily mid-flip; Edit/Write/Read
   kept working; recovered.
3. **git-bash MSYS mangles `BASE_PATH=/`** into a Windows path → boot Vite via PowerShell with `$env:BASE_PATH='/'`.
4. **playwright-cli escapes eval'd JSON** (`\"`) → write the verbatim browser output to a file for the grader,
   don't pipe the escaped string into JSON.parse.
5. **Temp scripts/src harness files fail `pnpm run typecheck`** — `_postflip_*.ts`/`_wasm_verify_*.ts` with
   cross-package `.ts` imports are typechecked by the scripts tsconfig → DELETE all temp harness files before
   typecheck/commit (they are throwaway; keep them out of `scripts/src`).
6. **autocrlf=true → orval generated files EOL-only churn** (orval 8.5.3 writes LF; repo CRLF) → `git add`
   re-normalizes so only real content stages. **Durable fix (pending): `.gitattributes` `eol=lf` for
   `lib/*/src/generated/**`.**
7. **HANDOFF.md auto-clobbered + verbose `chore: wip` auto-commits** by session-end hooks. Durable record =
   `.agentic/` + `docs/phases/` + git.
8. **DB-gated audits need a DB** (Docker PG `atlas-pg`:5434, no Neon URL); **`COURSE_TAXONOMY` test** needs
   gitignored `.local/course-skill-maps.md` (absent) — both environmental, not code defects.
9. **Full app UI can't boot** (Replit connector coupling, Phase 0.2 pending) → integration done via the
   verified adapter + live-grader harness, not a full app boot.
10. **Lockfile not frozen-clean** (`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`) — regen `pnpm-lock.yaml` off-Windows
    (Linux/CI). **ChatGPT handoffs overstate progress (+1 phase, twice)** — verify vs repo first.

## 5. Next step

**Primary: Phase 58 — `sql_resultset` server grading** (E1), the next validation kind to harden. Same
discipline as the csv_set_equal arc: build DARK → byte-verify expected values in real DuckDB-WASM →
review → flip exactly one row → post-flip verify. **Owner approval required to start; do NOT begin
unprompted.** The collision-proof audit negative (this phase) is already in place for the next opt-in.

**Parallel low-risk cleanups (owner-approve, any time):** (a) `.gitattributes` `eol=lf` for
`lib/*/src/generated/**` (kills orval CRLF churn); (b) regenerate `pnpm-lock.yaml` on Linux/CI; (c) teach the
`audit:authoring` kind-classifier that `serverGrade:true` csv_set_equal is server-enforced (drops the stale
"client-provisional" label); (d) observe the single live opted-in C2 step-3 row in a real env before any 2nd
opt-in or any move toward envelope enforcement.

**Inherited invariants (never break):** RUBRIC_VERSION 1.0.1 frozen · archive=hide (no row deletes) ·
hidden slugs → 404 not 403 · bidirectional candidate↔project lineage · no runtime `mapToCourse` ·
H3 honest-claims · new graders ship dark + BC audit · hidden-first publishing · Phase 52 canary
operator-pending (never agent-flipped) · 9 courses exactly · envelope enforcement stays OFF until a separate
owner-approved operator canary · after EVERY task: the 12-section mini-report + HTML archive.
