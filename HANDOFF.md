# Session Handoff — Atlas (rich; written pre-compact 2026-06-07, post Phase 60B)

> Fresh session: read THIS file, then `.agentic/progress.md` (canonical live state), `docs/phases/*`,
> `CLAUDE.md`. **This file is auto-clobbered by the session-end hook into a thin git-only summary** — the
> durable record is `.agentic/progress.md` + `docs/phases/*.md` + git. A **compact ≠ session end**, so this
> rich version survives the compact you're about to run. (The hook's `build: FAIL` line is ENVIRONMENTAL —
> no clean Node-24 `pnpm install` in this Windows env; the REAL gates run green under shell-scoped Node 24
> + Docker PG — see §2.)
>
> **Workflow:** ChatGPT directs on the owner's behalf → Claude Code is sole coder. In ChatGPT prompts
> "Replit" = Claude Code; in repo docs "Replit" = legacy platform/connectors (Phase 0.2 target). Verify
> ChatGPT handoff claims vs the repo (it has drifted +1 phase before).
>
> **STANDING PROTOCOL (owner directive — every task, MANDATORY):** after EVERY Atlas task/mini-phase:
> (1) return the exact 12-section (or phase-specified) `# Claude Code Mini-Report` + explicit STOP; (2)
> archive it → add `src/NN-<slug>.md` to `Atlas_Each_Task_Mini_Reports_to_Chatgpt.html/` (single
> underscore), run `python build.py`, commit. Do NOT start the next phase unprompted.

---

## 1. The goal we're working towards

Finish + surpass the interrupted 57-phase Replit build → shippable private beta. Atlas = project-based
learning PWA, zero→job-ready across **9 courses**. Catalog target **900–1000 premium projects**
(~120/discipline); ~48 visible today. **Harden validation first, project waves later** (hidden-first,
never direct-publish). H3 honesty is law (never claim verified-authorship / no-outside-help / tamper-proof
/ cheat-proof / job-guaranteed / certified competence).

Epic arc: **E1 validation-hardening (DONE through 59B)** → **E2 evidence & portfolio (IN PROGRESS)**.
Phase ladder shipped (all on `main`, reviewed PASS/SHIP, gates green):
57B-flip → 57B-postflip → 58A → 58B → 59A → 59B → **60A** (dark portfolio-artifact generator) → **60B**
(authenticated artifact route + durable submission snapshots). **NEXT = Phase 60C** — owner approval
required; NOT started.

## 2. Current state of the code

- **HEAD = `5616a4e`** (`docs: archive mini-report 16 …Phase 60B…`), pushed to `main`. Feature commit
  `9cee53f` (Phase 60B, 21 files). Prior: `d08bb25`/`2944849` (Phase 60A). Working tree clean except
  hook-managed `.agentic/self-review.log` + `HANDOFF.md`.
- **Phase 60A** — pure, deterministic, leak-safe portfolio-artifact **generator**:
  `artifacts/api-server/src/lib/portfolioArtifact.ts` (`generatePortfolioArtifact` + `classifyEvidenceStatus`)
  + `portfolioArtifact.test.ts`. Emits README / VALIDATION_EVIDENCE / LIMITATIONS / LEARNER_REFLECTION_TEMPLATE
  (+ optional DATASET_NOTES). No-leak by construction (input model has no spec channel); H3-honest copy.
- **Phase 60B** — made it a real backend capability:
  - **NEW table `portfolio_submission_snapshots`** (append-only) — `lib/db/src/schema/progress.ts` +
    migration `lib/db/drizzle/0002_phase60b_portfolio_submission_snapshots.sql` + journal idx 2. Unique
    `(user,project,step)` index = append-only-once. Stores learner evidence (4 KB-clamped excerpt +
    sha256), NEVER specs/answer keys. **Applied + `\d`-verified on Docker PG.**
  - **`/submit` snapshot write** (`artifacts/api-server/src/routes/user.ts`) — inside the existing
    advisory-locked tx, gated on `isFreshPass`; never /check, never fail, never re-submit;
    `.onConflictDoNothing()`. No grading/XP/completion/idempotency change.
  - **Route `GET /user/projects/:projectSlug/portfolio-artifact`** (`routes/user-portfolio-artifact.ts`,
    wired in `routes/index.ts`) — authenticated, read-only, 404-not-403 for hidden/unknown/not-enrolled,
    session-only userId, runtime `findBannedClaims` fail-closed guard. Returns `{projectSlug, generatedAt,
    files}`.
  - **Assembly** `routes/../lib/portfolioArtifactAssembly.ts` — DB → safe `PortfolioArtifactInput`; reads
    validationConfig ONLY to derive the serverGrade boolean (never returned); 4 reads via Promise.all.
  - **Canonical `isServerGradeOptedIn`** in `lib/grading.ts`; `deriveServerGrade` (projects.ts) delegates →
    ONE source of truth (FE signal + grader gate + snapshot stamp + assembly).
  - **H3 guard relocated** → `lib/execution-core/src/honestClaims.ts` (canonical, byte-faithful) + subpath
    export `@workspace/execution-core/honest-claims`; `artifacts/atlas/src/lib/banned-h1h2-phrases.ts` is
    now a thin re-export (atlas guard tests preserved). New `findBannedClaims` helper.
- **Two LIVE server-graded rows, both on C2** (`analytics-engineer-semantic-layer-with-dbt-and-duckdb`,
  visible+approved): csv_set_equal = step 3; sql_resultset = step 2. Global `serverGrade=true` count =
  **exactly 2** (1 csv + 1 sql). **No new opt-ins in 60A/60B.**
- **Envelope enforcement OFF** (`envelopeGrade.ts`/`envelopeSubmit.ts` untouched). **Phase 52 json_equal
  canary untouched** (operator-pending; never agent-flipped).
- **Gates GREEN** (Node 24.16.0 shell-scoped + Docker PG `atlas-pg`:5434): typecheck +
  check:no-heuristic-runtime · api-server **587/587** · atlas H3 guard **28/28** · execution-core 83/83 ·
  audit:sql-resultset-bc PASS (3 dark + 1) · audit:csv-set-equal-bc PASS (1) · audit:contains-bc 3/3 ·
  audit:authoring exit 0 (serverGrade csv 1 / sql 1).
- **Env:** Node 24 via shell PATH prepend `C:\Users\findb\AppData\Local\nvm\v24.16.0` (NO `nvm use`).
  Docker PG `atlas-pg` (postgres:16, port 5434, throwaway `postgres:postgres`, `DATABASE_URL` in-shell
  only — NEVER committed). Python `markdown` installed for the archive `build.py`.

## 3. Files actively editing

- **None mid-edit** — all committed + pushed at `5616a4e`. Recent: `9cee53f` (60B feature) → `5616a4e`
  (archive 16).
- **DO NOT edit without owner approval:** C2 authored file's `serverGrade`/`expectedRows` (2 live rows);
  `grading.ts` `gradeRowsetSubmission` + `isServerGradeOptedIn`; `envelopeGrade.ts`/`envelopeSubmit.ts`
  (envelope must stay OFF); the Phase 52 canary; `pnpm-lock.yaml`; `honestClaims.ts` patterns (weakening
  the H3 guard is forbidden — only ADD patterns).

## 4. Everything tried that failed / gotchas

1. **vitest strict mocks throw on undefined exports** — adding the `portfolioSubmissionSnapshots` insert to
   `/submit` made 4 existing submit-test files 500 (their `@workspace/db` mock lacked the token AND their
   `.values()` mock returned a bare Promise with no `.onConflictDoNothing()`). Fix: add the table token +
   attach `onConflictDoNothing` to the mock's returned Promise in every /submit test mock.
2. **Snapshot stores the learner's SUBMISSION, which can equal the expected rows** — a first no-leak test
   wrongly asserted the excerpt must not contain `one_current`; but that's the learner's correct
   submission, not the answer key. The no-leak guarantee is about the SPEC object (validationConfig/
   expectedRows) never being persisted/served — assert that instead.
3. **Hand-typing the Unicode `normalize` regexes corrupts them** — the dash/space character-classes kept
   coming out as literal glyphs instead of `\u` escapes. Fix: `cp` the original guard file byte-for-byte,
   then append new exports. Never retype those regexes.
4. **Drizzle migrations are hand-authored here** (`.sql` + `meta/_journal.json` entry; NO per-migration
   snapshot — 0001 set the precedent). `drizzle-kit generate` would emit a huge diff vs the stale phase-31
   baseline snapshot — do NOT use it. Dev DB is synced via `drizzle-kit push`; production via `migrate.ts`.
   To test a new table: pipe the `.sql` to `docker exec -i atlas-pg psql -U postgres -d postgres`.
5. **DB-gated audits + many api-server tests need `DATABASE_URL`** (Docker PG :5434). Review subagents run
   on Node-22/no-DB so they cannot re-run those — run them yourself; reviewers verify code + test content.
6. **Start-Job doesn't persist across PowerShell tool calls**; **Vite needs `PORT` env not `--port`**;
   **`git commit -m @'…'@` in the Bash tool injects a stray `@`** → use a bash heredoc (`git commit -F -`).
7. **OpenAPI/orval regen = ~95-file CRLF churn** — the 60B route is deliberately NOT in `openapi.yaml`
   (deferred to 60C; route is supertest-tested, FE can't boot pre-0.2). Same standing deferral as the
   `serverGrade` description.
8. **Full app UI can't boot** (Replit connector coupling, Phase 0.2 pending) → integration via route-level
   supertest + the verified browser-WASM/live-grader harness, not a full boot.

## 5. Next step

**Primary: Phase 60C — owner approval required; do NOT begin unprompted.** Per the 60B close-out (§14):
(1) add `GET /user/projects/:slug/portfolio-artifact` to `openapi.yaml` + orval regen (bundle with the
deferred `serverGrade`-description regen + a `.gitattributes` EOL pass to contain CRLF churn); (2) a
frontend "Download portfolio artifact" affordance consuming the typed client; (3) optional safe
submission-excerpt preview in the artifact (snapshots now exist) — behind a fresh no-leak review; (4) then
GitHub export / publishing (the deferred E2 tail). Expect the full ritual: pre-flight invariant check →
scoped build → tests → `atlas-architect-reviewer` + `/code-review` → gates → 18-section mini-report + HTML
archive → close-out + progress.

**Before any 2nd validation opt-in:** observe the 2 live opted-in C2 rows in a real env (needs Phase 0.2
local boot or a Neon env). **Parallel low-risk cleanups (owner-approve, any time):** OpenAPI/orval regen +
`.gitattributes eol=lf` for generated/test/script files; Linux/CI `pnpm-lock.yaml` regen; Phase 0.2
Replit-connector decouple for a real `pnpm dev`.

**Inherited invariants (never break):** RUBRIC_VERSION 1.0.1 frozen · archive=hide (no row deletes) ·
hidden slugs → 404 not 403 · bidirectional candidate↔project lineage · no runtime `mapToCourse` ·
H3 honest-claims · new graders ship dark + BC audit · hidden-first publishing · Phase 52 canary
operator-pending (never agent-flipped) · envelope enforcement stays OFF until a separate owner-approved
operator canary · 9 courses exactly · after EVERY task: the mini-report + HTML archive.
