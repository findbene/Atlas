# Atlas — Project Instructions

Project-based learning PWA: zero → job-ready across 9 courses (data-engineering, ai-engineer,
mlops-engineer, data-scientist, analytics-engineer, applied-llm-engineer, cloud-data-engineer,
python-libraries, sql). The 57-phase build was produced on Replit; **Claude Code is now the sole coding agent**, and this file is the authoritative Claude Code operating manual for Atlas.

**Read first every session:** `.agentic/progress.md` (continuation state) and `HANDOFF.md` (live session bridge).

## Status & phase sequence

- **Last shipped:** Phase 57A (`csv_set_equal` dark comparator). ~60 learner-visible projects.
- **Local build not yet green** — Node 24 + `pnpm install` pending in this environment, and the app still couples to Replit platform connectors (Stripe/Resend/Anthropic). **Phase 0.2 decouples** so `pnpm dev` boots. Do NOT "fix" code before a clean install on Node 24.
- **Phase 52 signed-envelope canary = OPERATOR-PENDING.** The agent NEVER executes the production flip — it only prepares kits. Leave untouched unless the owner brings operator evidence.
- **NEXT = Phase 57C** — read-only `csv_set_equal` trust-model proposal (raw JSON vs signed RunEnvelope). **Build nothing for it.** The frontend submission-shape wiring (the old "57B-prereq") is NOT in the repo; it is downstream of 57C's decision, not a prerequisite for it.
- **Hardening sequence:** 57C → 57B-prereq build → 57B-flip → 58 `sql_resultset` → 59 `/check`-vs-`/submit` evidence → 60 portfolio/GitHub artifact → 61 authoring factory v2 → 62 cloud-lab safety. Maps to `.agentic/plan.md` epics E1→E5.
- **HARD STOP — no high-speed project waves yet.** Finish grader hardening + factory v2 first. Catalog target is **900–1000 premium projects** (~120/discipline); today ~60. Waves are hidden-first, never direct-publish.

## Operating assumptions (Claude Code)

- Claude Code is the sole coding agent. ChatGPT directs on the owner's behalf; **in ChatGPT's prompts, "Replit" means Claude Code.**
- Everywhere else, **"Replit" = the legacy build platform + its connectors** (Stripe/Resend/Anthropic). Migrating off it is D1 / Phase 0.2 — a real infra task, not a rename.
- `replit.md` is **legacy Replit-era engineering context** (preserved, superseded by this file). Its connector wiring describes current-state to be decoupled, not target-state.

## Stack

- pnpm workspace · Node 24 · TypeScript 5.9 (strict). Layout: `artifacts/*` (apps), `lib/*` (packages), `scripts/`.
- Frontend: `artifacts/atlas` — React 19 + Vite + Tailwind 4 + wouter + TanStack Query. Editors: Monaco + Pyodide (Python) + DuckDB-WASM (SQL).
- API: `artifacts/api-server` — Express 5 + Drizzle ORM + Postgres (Neon target) + Zod. Auth: Clerk. Billing: Stripe. Email: Resend. Tutor: Anthropic (Ada, SSE).
- Packages: `lib/db` (schema/migrations), `lib/execution-core` (runtime/envelope/modes), `lib/curriculum-quality` (rubric/authoring/scoring), `lib/api-spec` (OpenAPI) → `lib/api-client-react` + `lib/api-zod` (Orval codegen).

## Commands

- `pnpm run typecheck` — full typecheck + `check:no-heuristic-runtime` gate.
- `pnpm run build` — typecheck + build all.
- `pnpm --filter @workspace/<pkg> run test` — vitest per package (`api-server`, `atlas`, `execution-core`, `curriculum-quality`).
- `pnpm --filter @workspace/scripts run audit:*` — content/quality gates (`authoring`, `pedagogy`, `quality`, `contains-bc`, `csv-set-equal-bc`, `difficulty`).
- `pnpm --filter @workspace/api-server run dev` — local API. `pnpm --filter @workspace/scripts run seed` — idempotent seed.
- `pnpm --filter @workspace/scripts run migrate` — apply Drizzle migrations (production path).

## Inherited invariants — DO NOT BREAK (see `.claude/skills/atlas-conventions/`)

- `RUBRIC_VERSION='1.0.1'` frozen. No weight edits, no quality-gate weakening.
- Archive = hide (`learner_visible=false`). Never delete rows from `projects` / `project_candidates`.
- Learner routes filter `learner_visible=TRUE`. Hidden slugs → **404, not 403** (no existence leak).
- Bidirectional candidate↔project lineage is atomic; `mapToCourse` is never called at runtime (`check:no-heuristic-runtime` enforces).
- H3 honest-claims: NEVER ship copy claiming "verified authorship / tamper-proof / cheat-proof / 100% verified / job guaranteed."
- New validation graders ship **dark** (opt-in flag, zero live rows) + a byte-for-byte BC audit before any behavior change.
- 9 courses exactly. Atlas is never described as a "4-domain/4-discipline" platform.

## Phase ritual (every phase)

`/atlas-phase-plan <id>` → build → `/atlas-validate` → `atlas-architect-reviewer` subagent → `/code-review` → fix all findings → `/atlas-phase-close`. One logical change per commit; conventional-commit messages. Update `.agentic/progress.md` after each phase.

## Workspace docs

`.agentic/discovery.md` (intent + locked decisions), `.agentic/plan.md` (epic/phase roadmap + invocation guide), `.agentic/progress.md` (live state). Per-phase close-outs: `docs/phases/`. Authoring spec: `docs/project-authoring-spec.md`.

## Guardrails

- Never commit secrets. Secrets come from env (`DATABASE_URL`, `CLERK_*`, `STRIPE_*`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`). Flag any hardcoded credential.
- Never modify more files than the phase requires. No scope creep, no unrequested refactors.
- Never declare done with failing typecheck/test/build/audit.
- Strict TS; validate inputs at boundaries with Zod; match existing conventions. Every grader/behavior change ships with a regression test that fails on the old code (graders also ship dark + BC audit).
