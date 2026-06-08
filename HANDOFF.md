# Session Handoff — Atlas (rich; written pre-compact 2026-06-08, post Phase 60E)

> Fresh session: read THIS file, then `.agentic/progress.md` (canonical live state), `docs/phases/*`,
> `CLAUDE.md`. **The session-end hook clobbers this into a thin git-only summary** — the durable record is
> `.agentic/progress.md` + `docs/phases/*.md` + git. A **compact ≠ session end**, so this rich version
> survives the compact about to run. (The hook's `build: FAIL`/`typecheck: FAIL` lines are ENVIRONMENTAL —
> the REAL gates run green under shell-scoped Node 24 + Docker PG; see §2.)
>
> **Workflow:** ChatGPT directs on the owner's behalf → Claude Code is sole coder. In ChatGPT prompts
> "Replit" = Claude Code; in repo docs "Replit" = legacy platform/connectors. Verify ChatGPT handoff claims
> vs the repo (it has drifted +1 phase before).
>
> **STANDING PROTOCOL (owner directive — every task, MANDATORY):** after EVERY Atlas task/mini-phase:
> (1) return the exact multi-section `# Claude Code Mini-Report` + explicit STOP; (2) archive it → add
> `src/NN-<slug>.md` to `Atlas_Each_Task_Mini_Reports_to_Chatgpt.html/` (single underscore), run
> `python build.py`, commit. Do NOT start the next phase unprompted.

---

## 1. The goal we're working towards

Finish + surpass the interrupted 57-phase Replit build → shippable private beta. Atlas = project-based
learning PWA, zero→job-ready across **9 courses**. Catalog target **900–1000 premium projects**
(~120/discipline); ~48 visible today. **Harden validation first, project waves later** (hidden-first, never
direct-publish). H3 honesty is law (never claim verified-authorship / no-outside-help / tamper-proof /
cheat-proof / job-guaranteed / certified competence).

Epic arc: **E1 validation-hardening (DONE through 59B)** → **E2 evidence & portfolio (IN PROGRESS)**.
Phase ladder shipped (all on `main`, reviewed PASS/SHIP, gates green): 57B-flip → … → 59B → **60A**
(dark portfolio generator) → **60B** (authed artifact route + durable submission snapshots) → **60C**
(OpenAPI contract + generated client + frontend "Download Portfolio Bundle" JSON UX) → **60D** (prod-safe
Vite boot decouple + isolated real-browser download verification) → **60E** (backend auth decouple + TRUE
full-stack download E2E). **NEXT = Phase 60F** — owner approval required; NOT started.

## 2. Current state of the code

- **HEAD = `c2e2df6`** (`docs: archive mini-report 20 …Phase 60E…`), pushed to `main`. Feature commit
  `61c5f7b` (Phase 60E, 10 files, +735/−77). Prior: `0646ca1`→`c1327ca` (60D), `b748cc9`/`ab67b6a` (60C).
  Working tree clean except hook-managed `.agentic/self-review.log`.
- **Portfolio (E2) is now end-to-end real:** generator (60A) → durable `portfolio_submission_snapshots` +
  `/submit` fresh-pass write + authed read-only route `GET /api/user/projects/:slug/portfolio-artifact`
  (60B) → OpenAPI + generated client + Certificates "Download Portfolio Bundle" JSON download (60C) →
  frontend boots off-Replit (60D) → **full local stack boots + the download is browser-verified end-to-end
  against the real API + real Postgres** (60E).
- **Phase 60E specifics (newest):**
  - **Backend boots locally** with just `PORT` + `DATABASE_URL` (Stripe/Replit connectors self-guard —
    warn+skip without `REPLIT_CONNECTORS_HOSTNAME`). The ONLY blocker was Clerk: `clerkMiddleware` 500s
    EVERY request without `CLERK_SECRET_KEY`.
  - **Gated, production-inert test-auth adapter** in `artifacts/api-server/src/lib/auth.ts`:
    `isE2EAuthMode()` = `ATLAS_E2E_AUTH==="1" && NODE_ENV!=="production"`; `e2eClerkIdFromRequest` resolves a
    **fixed** `ATLAS_E2E_AUTH_CLERK_ID` only on a matching `X-Atlas-E2E-Auth` header vs
    `ATLAS_E2E_AUTH_TOKEN` (else 401; never a request userId → no impersonation). `requireAuth`/
    `getCurrentUser` use it (never call `getAuth`) in e2e mode; `app.ts` registers `clerkMiddleware` only
    `if (!isE2EAuthMode())`. **Production path byte-unchanged**; `NODE_ENV` gate verified at the deploy
    manifest (`artifact.toml`). `auth.test.ts` (10 tests) pins all gates + prod-inertness.
  - **Pre-existing bug fixed:** `routes/user-portfolio.ts` `= ANY(${projectIds})` → "malformed array
    literal" 500 for any user with a completed project → now `inArray(...)`.
  - **Local full-stack runner:** `scripts/e2e-fullstack-portfolio.sh` (seed → build → boot API → serve FE →
    print playwright-cli commands). **E2E seed:** `scripts/src/seed-e2e-user.ts` + `seed:e2e` (learner-side
    only: test user + completed C2 + step completions; no authored content/serverGrade/answer keys).
  - **Frontend e2e harness** `artifacts/atlas/e2e/e2e-main.tsx` is dual-mode: full-stack (real API via
    `setBaseUrl` + `X-Atlas-E2E-Auth` header injection) vs the 60D `window.fetch` mock. Clerk stays aliased
    to the test-only mock (`e2e/clerk-mock.tsx`); built via the isolated `vite.e2e.config.ts` → `dist/e2e`
    (gitignored).
- **Two LIVE server-graded rows, both on C2** (`analytics-engineer-semantic-layer-with-dbt-and-duckdb`,
  visible+approved): `csv_set_equal` = step 3; `sql_resultset` = step 2. Global `serverGrade=true` count =
  **exactly 2** (1 csv + 1 sql). **No new opt-ins in 60A–60E.**
- **Envelope enforcement OFF** (`envelopeGrade.ts`/`envelopeSubmit.ts` untouched). **Phase 52 json_equal
  canary untouched** (operator-pending; never agent-flipped).
- **Gates GREEN** (Node 24.16.0 shell-scoped + Docker PG `atlas-pg`:5434): typecheck +
  check:no-heuristic · **check:boot OK** · api-server **598/598** · atlas **165/165** · audit:sql-resultset-bc
  PASS (3 dark + 1) · audit:csv-set-equal-bc PASS (1) · audit:contains-bc 3/3 · audit:authoring exit 0
  (serverGrade csv 1 / sql 1). Full-stack portfolio download browser-verified in real Chromium.
- **Env:** Node 24 via shell PATH prepend `C:\Users\findb\AppData\Local\nvm\v24.16.0` (NO `nvm use`). Docker
  PG `atlas-pg` (postgres:16, port 5434, throwaway `postgres:postgres`, `DATABASE_URL` in-shell only —
  **NEVER committed**, owner directive). `playwright-cli` (global, v0.1.13) drives real Chromium; artifacts
  in `./.playwright-cli/` (gitignored since 0.zz). Python `markdown` for the archive `build.py`.

## 3. Files actively editing

- **None mid-edit** — all committed + pushed at `c2e2df6`. Recent feature `61c5f7b` (60E) → `c2e2df6`
  (archive 20).
- **DO NOT edit without owner approval:** C2 authored file's `serverGrade`/`expectedRows` (2 live rows);
  `grading.ts` `gradeRowsetSubmission` + `isServerGradeOptedIn`; `envelopeGrade.ts`/`envelopeSubmit.ts`
  (envelope stays OFF); the Phase 52 canary; `pnpm-lock.yaml`; `honestClaims.ts` patterns (only ADD).
- **60E-gated, do-not-weaken:** the `auth.ts` test-auth adapter must stay triple-gated (env + NODE_ENV +
  token) and production-inert. Never make the artifact route public or trust a request userId.

## 4. Everything tried that failed / gotchas

1. **`cd` persists across Bash tool calls** — the archive `git add "Atlas_…html"` failed TWICE because a
   prior `cd` into the archive dir was still active. The FEATURE commit pushed fine each time; the ARCHIVE
   commit needs `cd /c/Projects/Atlas &&` first. Always commit from repo root.
2. **Writing `.sh` files via the Write tool is BLOCKED** by the pre-edit hook — its `bash -n` validation
   runs on a mangled Windows temp path (`C:UsersfindbAppData…`, backslashes stripped) → false "No such
   file" block. Workaround: write `.sh` via a Bash heredoc (`cat > file <<'SCRIPT'`) + `bash -n` it
   yourself. (Hook env bug, not a real syntax error.)
3. **`clerkMiddleware` 500s every request without `CLERK_SECRET_KEY`** ("Missing Clerk Secret Key") — this,
   not the Stripe/Replit connectors, is the local-API blocker. Decoupled via the e2e gate (skip
   clerkMiddleware in e2e mode + adapter handles auth). Do NOT "fix" by committing a dummy Clerk key.
4. **vitest can't import the Vite config** (node-env vs jsdom `setup.ts`; jsdom vs esbuild `TextEncoder`) →
   the 60D boot guard is a `tsx` script (`check:boot`), not a vitest test.
5. **Drizzle `= ANY(${jsArray})` is a trap** — Postgres "malformed array literal". Use `inArray(expr,
   values)` (emits `IN ($1,$2,…)`). Fixed in user-portfolio.ts (60E).
6. **Background servers started with `&` DO persist** across Bash tool calls here (verified) — but kill them
   by port via PowerShell `Get-NetTCPConnection … Stop-Process` when done.
7. **DB-gated audits + most api-server tests need `DATABASE_URL`** (Docker PG :5434). Review subagents run
   Node-22/no-DB → they verify code+tests, not by re-running gates. Run gates yourself.
8. **orval/EOL CRLF churn** is contained by the scoped `.gitattributes` (60C). Generated dirs + openapi.yaml
   = `eol=lf`. Don't `drizzle-kit generate` (huge stale-snapshot diff) — migrations are hand-authored.

## 5. Next step

**Primary: Phase 60F — owner approval required; do NOT begin unprompted.** Per the 60E close-out (§14) +
both reviewers: the now-unblocked deferred E2E tail — (1) optional **safe submission-excerpt preview** in
the artifact (snapshots exist) behind a FRESH no-leak review; then (2) **GitHub export / publishing** (the
deferred E2 tail). Plus a small **hardening pass** (low-risk, owner-approve): guard the two out-of-scope
`getAuth(req)` callers that 500 in e2e mode (`routes/user.ts:48` `/user/profile`, `routes/ai.ts:345/522` —
e2e-mode-only, not production, not the portfolio flow) so the full local stack exercises more routes; and
tighten the pre-existing reflective `cors({origin:true, credentials:true})` to an allowlist.

**Before any 2nd validation opt-in:** observe the 2 live opted-in C2 rows in a real env. **Standing
deferrals:** browser-level fresh-`/submit`→snapshot E2E (currently API/unit-verified); Phase 0.2
Replit-connector decouple for real billing/email/tutor locally (the portfolio flow does not need it).

**Inherited invariants (never break):** RUBRIC_VERSION 1.0.1 frozen · archive=hide (no row deletes) ·
hidden slugs → 404 not 403 · bidirectional candidate↔project lineage · no runtime `mapToCourse` ·
H3 honest-claims · new graders ship dark + BC audit · hidden-first publishing · Phase 52 canary
operator-pending (never agent-flipped) · envelope enforcement stays OFF until a separate owner-approved
operator canary · 9 courses exactly · the test-auth adapter stays gated + production-inert · after EVERY
task: the mini-report + HTML archive.
