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
> **STANDING PROTOCOL (owner directive — every task):** after EVERY Atlas task/mini-phase: (1) return the
> exact 12-section `# Claude Code Mini-Report` (format: `.claude/atlas-mini-report-template.md`); (2) archive
> it → add `src/NN-<slug>.md` to `Atlas_Each_Task_Mini_Reports_to_Chatgpt.html/` (single underscore), run
> `python build.py`, commit. Wired in CLAUDE.md + memory + that template + a SessionStart hook. Never skip.

---

## 1. The goal we're working towards

Finish + surpass the interrupted 57-phase build → shippable private beta. Atlas = project-based learning
PWA, zero→job-ready across **9 courses** (data-engineering, ai-engineer, mlops-engineer, data-scientist,
analytics-engineer, applied-llm-engineer, cloud-data-engineer, python-libraries, sql). Catalog target
**900–1000 premium projects** (~120/discipline); ~60 today (48 visible after C2 promote). **Harden
validation first, project waves later** (hidden-first, never direct-publish). H3 honesty is law (never
claim verified-authorship / tamper-proof / cheat-proof / job-guaranteed).

**Immediate arc — `csv_set_equal` server-grading, rolled out safely, NOW LIVE for 1 row:**
57C decided Option C → 57B-prereq built it dark → 0.x/0.y local-green baseline → 0.z repaired the C2
candidate (WASM-native, execution-derived) → 0.zz byte-verified in real browser wasm → **57B-flip
promoted C2 + opted in exactly 1 step.** Hardening sequence next: 58 `sql_resultset` → 59 evidence →
60 portfolio → 61 factory v2 → 62 cloud-lab. Maps to `.agentic/plan.md` epics E1→E5.

## 2. Current state of the code

- **Last shipped: Phase 57B-flip** (commit `055049b`). FIRST LIVE `csv_set_equal` server-grade opt-in:
  - C2 (`analytics-engineer-semantic-layer-with-dbt-and-duckdb`) **promoted to visible + qualityStatus=approved (rubric 85.3)**.
  - **`serverGrade: true` on C2 step 3 ONLY** (`scripts/src/authored/...semantic-layer...ts:379`) — the only opt-in in all of `scripts/src/authored/`. Graded by the COMMIT path (`gradeSubmission`→`gradeCsvSetEqual`).
  - **Envelope enforcement OFF** — `csv_set_equal` NOT in `PILOT_RUNTIME_KINDS` (`envelopeGrade.ts:47` = `{json_equal}`); `ATLAS_ENVELOPE_REQUIRED_KINDS` empty. envelopeGrade/envelopeSubmit/user.ts untouched. **Phase 52 canary untouched** (operator-pending).
  - needs-run UX P2 fixed (neutral toast, not red); popstate P2 deferred (replaceState-only nav → unreachable + per-step keying). OpenAPI `ProjectStep.serverGrade` added + Orval regen (focused). `audit-csv-set-equal-bc` extended to partition dark vs opted-in.
- **Gates GREEN** (Node 24.16.0 shell-scoped + Docker PG `atlas-pg`:5434): typecheck + check:no-heuristic-runtime · execution-core 83/83 · atlas 159/159 · api-server 466/466 · curriculum-quality 132 (1 env-only `COURSE_TAXONOMY` ENOENT) · `audit:authoring` exit 0 (48 visible projects, 100 steps) · `audit:csv-set-equal-bc` PASS (**1 opted-in, dark 0, 5/5 grading checks**) · `audit:contains-bc` 3/3.
- **Since the flip (non-engineering):** HTML mini-report archive added (`43381bb`); mini-report+archive protocol wired + archive folder renamed double→single underscore (`293c62b`).
- **Env:** Node 24 via shell-scoped PATH prepend (`C:\Users\findb\AppData\Local\nvm\v24.16.0`; no `nvm use`). Docker PG `atlas-pg` (postgres:16, port 5434, throwaway `postgres:postgres`, `DATABASE_URL` in-shell only — never committed). Python `duckdb` + `markdown` installed as local dev tools (do NOT touch the JS lockfile).
- **Git:** branch `main`, HEAD `293c62b` pushed (+ possible session-end `chore: wip` auto-commits). Working tree clean except hook-managed `.agentic/self-review.log` + `HANDOFF.md`.

## 3. Files actively editing

- **None mid-edit** — all committed + pushed. Last touched (all committed): `.claude/atlas-mini-report-template.md`, `.claude/hooks/atlas-mini-report-reminder.sh`, `.claude/settings.json`, `CLAUDE.md`, `Atlas_Each_Task_Mini_Reports_to_Chatgpt.html/**`, `.agentic/progress.md`.
- **NOT to edit without approval:** the C2 authored file's `serverGrade` / `expectedRows` (live now); `envelopeGrade.ts`/`envelopeSubmit.ts` (envelope must stay off); the Phase 52 canary; `pnpm-lock.yaml`.

## 4. Everything tried that failed / gotchas

1. **Architect + code-review subagents 529'd (API overload) on 57B-flip** — twice, no findings. Did a rigorous Opus self-review (grader fail-closed traced + live-verified). **Independent review is the one gate still PENDING — re-run `/code-review` + `atlas-architect-reviewer` now that the API has recovered.**
2. **Bash safety-classifier outage** mid-flip (same Opus overload) blocked git/Bash temporarily; Edit/Write/Read kept working; recovered later.
3. **git-bash MSYS mangles `BASE_PATH=/`** into a Windows path → boot Vite via PowerShell with `$env:BASE_PATH='/'`, not git-bash.
4. **autocrlf=true → orval generated files churn EOL-only** (orval 8.5.3 wrote LF; repo CRLF) → ~95 `lib/api-zod/.../types/*.ts` flagged modified with no content change. `git add` re-normalizes so only real serverGrade content stages. **Durable fix (pending): `.gitattributes` `eol=lf` for `lib/*/src/generated/**`.**
5. **Owner renamed the archive folder** `Atlas__Each…` → `Atlas_Each…` (single underscore) — now canonical everywhere.
6. **Lockfile not frozen-clean** (`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`); reconcile is Linux/CI-targeted — regen `pnpm-lock.yaml` off-Windows (unchanged from 0.y).
7. **HANDOFF.md auto-clobbered + verbose `chore: wip` auto-commits** by session-end hooks. Durable record = `.agentic/` + `docs/phases/` + git.
8. **DB-gated audits need a DB** (Docker PG, no Neon URL); **`COURSE_TAXONOMY` test** needs gitignored `.local/course-skill-maps.md` (absent) — both environmental, not code defects.
9. **ChatGPT handoffs overstate progress (+1 phase, twice)** — always verify vs repo first.

## 5. Next step

**Primary (the one open gate on the live flip):** re-run `/code-review` + the `atlas-architect-reviewer`
subagent on Phase 57B-flip (diff = commit `055049b`), since both 529'd during the phase. Then **observe
the single opted-in C2 step 3 in a real env** (staging / private beta) before opting in any more
`csv_set_equal` rows or considering envelope enforcement.

**Then, only after the flip is reviewed + observed:** Phase 58 (`sql_resultset` server grading) — same
dark→verify→flip discipline. **Do NOT start 58 before that.**

**Parallel low-risk cleanups (owner-approve):** (a) add `.gitattributes` `eol=lf` for
`lib/*/src/generated/**` to kill the orval CRLF churn; (b) regenerate `pnpm-lock.yaml` on Linux/CI;
(c) optionally teach the `audit:authoring` kind-classifier that `serverGrade:true` csv_set_equal is
server-enforced (it currently labels it "client-provisional" — informational only).

**Inherited invariants (never break):** RUBRIC_VERSION 1.0.1 frozen · archive=hide (no row deletes) ·
hidden slugs → 404 not 403 · bidirectional candidate↔project lineage · no runtime `mapToCourse` ·
H3 honest-claims · new graders ship dark + BC audit · hidden-first publishing · Phase 52 canary
operator-pending (never agent-flipped) · 9 courses exactly · envelope enforcement stays OFF until a
separate owner-approved operator canary.
