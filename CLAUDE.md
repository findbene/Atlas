# Atlas — Project Instructions

Project-based learning PWA: zero → job-ready across 9 courses (data-engineering, ai-engineer,
mlops-engineer, data-scientist, analytics-engineer, applied-llm-engineer, cloud-data-engineer,
python-libraries, sql). Build continued from a 57-phase Replit build by Claude Code.

**Read first every session:** `.agentic/progress.md` (continuation state) and `HANDOFF.md` (Replit-era engineering state, currently Phase 57A).

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
