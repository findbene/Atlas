# Session Handoff — Atlas

> A fresh session with no memory of prior conversation can continue from this file alone.
> Read this, then `.agentic/progress.md`, then `.agentic/plan.md`, then `CLAUDE.md`.
>
> **Coding agent = Claude Code (sole).** ChatGPT directs on the owner's behalf; in ChatGPT's prompts
> "Replit" means Claude Code. Everywhere in repo docs, "Replit" otherwise = the legacy build platform +
> its connectors (Stripe/Resend/Anthropic) that Phase 0.2 migrates off — never an agent to prompt.
>
> **Canonical records** (this file is periodically flattened by the session-end hook — content survives in):
> per-phase close-outs `docs/phases/*.md`, index `docs/phases/INDEX.md`, legacy detail `replit.md`, and git.

---

## 1. Goal

**Finish and surpass the interrupted 57-phase build → shippable private beta.** Atlas = project-based learning
PWA (zero → job-ready, 9 courses: data-engineering, ai-engineer, mlops-engineer, data-scientist,
analytics-engineer, applied-llm-engineer, cloud-data-engineer, python-libraries, sql). Roadmap in
`.agentic/plan.md` — 8 epics E0–E7. Catalog target **900–1000 premium projects** (~120/discipline); ~60 today.
**Harden validation first, project waves later** (hidden-first, never direct-publish). H3 honesty boundary is law.

Owner-approved decisions (`discovery.md §4`): D1 migrate off Replit platform · D2 sandbox-cloud first ·
D3 private-beta first · D4 job-signal factory · D5 keep monorepo layout · D6 extend-not-restart.

## 2. Current state of the codebase

- **Last shipped product phase = 57A** (`csv_set_equal` dark comparator) — verified in `main`. ~60 visible projects.
  `csv_set_equal` is DARK (0 rows opted in); learner behavior unchanged.
- **Phase 57C (read-only trust proposal) DELIVERED, awaiting owner approval** →
  `docs/phases/phase-57c-csv-set-equal-trust-decision.md`. Recommends **Option C (staged hybrid)**. No code changed by it.
- **Doc/instruction layer migrated to Claude Code** (committed `dad104e`; clean-message marker `dfe5059`, pushed):
  `CLAUDE.md` is now the authoritative operating manual; `replit.md` is banner-marked legacy (preserved);
  `.claude/commands/phase57c.md` added.
- **Does NOT build locally yet — environmental, not a defect:** `node_modules` absent + Node is **v22.17.1**
  (project targets **24**). The hook's `typecheck/build: FAIL` come from this. Do NOT "fix" code before
  `pnpm install` on Node 24. pnpm 9.15.0 present. (Machine specifics in `CLAUDE.local.md`.)
- **Still coupled to the Replit platform** (Stripe/Resend/Anthropic connectors) — blocks local boot; Phase 0.2 removes it.
- **Git:** branch `main`, pushed; working tree carries only hook-managed `.agentic/self-review.log`.

## 3. Files actively edited (this session — docs/instruction layer only, ZERO app code)

- **Created:** `docs/phases/phase-57c-csv-set-equal-trust-decision.md`, `.claude/commands/phase57c.md`,
  `CLAUDE.local.md`, global memory under `~/.claude/projects/C--Projects-Atlas/memory/` (`MEMORY.md`,
  `atlas-chatgpt-director.md`, `handoff-hook-clobbers.md`).
- **Edited:** `CLAUDE.md` (operating manual), `replit.md` (legacy banner), `HANDOFF.md` (this),
  `.agentic/progress.md` (reconciliation + 57C log).
- **No application code mid-edit.** No schema/migration/env/canary/codegen/grader/route/frontend behavior change.

## 4. What was tried that failed / gotchas (carry forward)

1. **ChatGPT handoff overstated progress by one phase — twice.** It reported "Phase 57B-prereq FE wiring
   shipped/architect-approved." Verified FALSE in `main` (no `csvSetEqualSubmit.ts`, no `serverGrade` in
   `projects.ts`, no `capturedSqlByStepId`, no doc, no commit). **Always verify handoff claims against the repo first.**
2. **`serverGrade:true` cannot be flipped naively.** It flips BOTH grade paths: the raw-SQL commit submit
   (FE sends `code` today) → JSON.parse fail → fail CLOSED; the envelope path → `gradeEnvelopeCapture` only
   handles `json_equal`, routes `stdout` summary → fail CLOSED. A flip without FE+grader wiring breaks every learner.
3. **HANDOFF.md is auto-clobbered** by the session-end hook into a thin git-only summary. Canonical state lives in
   `.agentic/` + `docs/phases/` + git. Run `/handoff` before ending for a rich one; else expect the thin version.
4. **`typecheck/build: FAIL` = environment** (Node 22 + no install), not code or docs. No gates were run this session.
5. **Auto-commit hook races the user's commit:** it WIP-committed + pushed the doc migration to `main` before a
   clean commit could be made; relabeling was impossible without force-pushing main (forbidden) → used an empty
   marker commit `dfe5059` instead.

## 5. Next step

1. **Await owner approval of Option C** (Phase 57C). On approval → `/atlas-phase-plan 57B-prereq`.
2. **Phase 57B-prereq (build, DARK, zero opt-in)** — needs NO local boot: expose narrow `step.serverGrade` boolean
   on `GET /projects/:slug`; new `artifacts/atlas/src/lib/csvSetEqualSubmit.ts`; capture last DuckDB `{columns,rows}`
   in `project-workspace.tsx` (reuse run-gen guard); add `csv_set_equal` branch to
   `artifacts/api-server/src/lib/envelopeGrade.ts`; extend `audit:csv-set-equal-bc`. Likely needs OpenAPI+Orval regen
   for the new response field. Architect PASS + `/code-review`.
3. **Phase 0.x local-green baseline** (Node 24 + `pnpm install` + Phase 0.2 decouple Replit platform + Neon
   `DATABASE_URL`) — REQUIRED before the flip, because step-3 `expectedRows` must be byte-verified against real
   DuckDB-WASM output (numeric-type fidelity + fixture row-set, see 57C §7).
4. **Phase 57B-flip** — add `serverGrade:true` to the single candidate step
   (`analytics-engineer-semantic-layer-with-dbt-and-duckdb` step 3) + re-seed, ONLY after 2+3. Then E1 continues
   (58 `sql_resultset`, 59 `/check`-vs-`/submit`), E2 (60 portfolio/GitHub), E4 (61 factory), E5 (62 cloud).

---

**Inherited invariants (never break — full list `.claude/skills/atlas-conventions/SKILL.md`):**
`RUBRIC_VERSION 1.0.1` frozen · archive=hide (no row deletes) · hidden slugs → 404 not 403 · bidirectional
candidate↔project lineage · no runtime `mapToCourse` · H3 honest-claims · graders ship dark + byte-for-byte BC
audit · hidden-first publishing · Phase 52 canary operator-pending (never agent-flipped).
