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

## Next steps

1. **Phase 0.x local-green baseline** (Node 24 + `pnpm install` + **Phase 0.2** decouple Replit
   platform connectors + Neon `DATABASE_URL` in gitignored `.env`) — now the critical path. Unblocks:
   (a) the DB-gated audits (`audit:csv-set-equal-bc` must run green); (b) byte-verifying C2 step-3
   `expectedRows` vs real DuckDB-WASM output (57C §7). Invoke: `senior-devops`, `env-secrets-manager`,
   `/atlas-phase-plan E0.2`.
2. **Phase 57B-flip** — set `serverGrade:true` on the single candidate step
   (`analytics-engineer__semantic-layer-with-dbt-and-duckdb` step 3) + re-seed, ONLY after (1).
   At flip: resolve the 2 deferred P2s (popstate clear, `needs-run` UX) + add `serverGrade` to
   OpenAPI ProjectStep + Orval regen for type-honesty.
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
