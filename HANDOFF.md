# Session Handoff — Atlas

> A fresh session with no memory of prior conversation can continue from this file alone.
> Read this, then `.agentic/progress.md`, then `.agentic/plan.md`.
>
> **Coding agent = Claude Code (sole).** ChatGPT directs on the owner's behalf. In ChatGPT's prompts,
> "Replit" means Claude Code. **Everywhere in this repo's docs, "Replit" otherwise means the legacy
> build platform + its connectors** (Stripe/Resend/Anthropic) — never an agent to hand prompts to.
> All execution guidance here is for Claude Code.
>
> **Authoritative operating manual:** root `CLAUDE.md`. **Canonical engineering records** (preserved,
> not in this file): per-phase close-outs in `docs/phases/*.md`, chronological index
> `docs/phases/INDEX.md`, legacy control-plane detail in `replit.md` (now banner-marked legacy), and
> git history. The session-end hook periodically regenerates this file thinly from `.agentic/`; if you
> find it thin, the rich record still lives in those canonical homes.

---

## 1. Goal

**Finish and surpass the interrupted 57-phase build — take Atlas to a shippable private beta.**
Atlas is a project-based learning PWA (zero → job-ready across 9 courses: data-engineering, ai-engineer,
mlops-engineer, data-scientist, analytics-engineer, applied-llm-engineer, cloud-data-engineer,
python-libraries, sql). Full roadmap in `.agentic/plan.md` — **8 epics E0–E7**: E0 Foundation (~done) →
E1 Validation hardening → E2 Evidence/GitHub export → E3 Adaptive skill model → E4 Curriculum factory
(the missing ~95% of projects; **catalog target 900–1000 premium, ~120/discipline**; today ~60) →
E5 Cloud labs (sandbox-first) → E6 PWA + deploy + billing + beta → E7 public launch (deferred).

Owner-approved decisions (`discovery.md §4`): **D1** migrate off the Replit platform · **D2** sandbox-cloud
first · **D3** private-beta first · **D4** job-signal curriculum factory · **D5** keep monorepo layout · **D6** extend-not-restart.

## 2. Current state of the code

- **Last shipped phase = 57A** (`csv_set_equal` dark comparator) — **verified in `main`** this session:
  `gradeCsvSetEqual`/`matchContains`/`computeCsvSetEqualHash` present in `grading.ts`,
  `audit-csv-set-equal-bc.ts` present, `serverGrade` gating present in `authoring.ts`. ~60 visible projects.
- **`csv_set_equal` is DARK** — zero rows opted in; learner behavior unchanged.
- **Phase 52 signed-envelope canary = OPERATOR-PENDING.** Agent never executes the production flip.
- **Does NOT build locally yet — environmental, not a code defect:** `node_modules` absent and Node is
  **v22.x but the project targets Node 24**. The hook's `typecheck: FAIL` / `build: FAIL` come from this.
  **Do NOT "fix" code before `pnpm install` on Node 24.** pnpm 9.15.0 present.
- **Still coupled to the Replit platform** (Stripe/Resend/Anthropic via Replit connectors) — blocks local
  boot; **Phase 0.2 removes it.** This is real infra work, unaffected by the agent-naming change.
- **Git:** branch `main`; recent commits are session-end WIP auto-commits.

## 3. Files actively updated (this session — doc/instruction layer only, no app code)

- **Edited:** `CLAUDE.md` (now the authoritative Claude Code operating manual: status, phase sequence,
  Phase 52 operator-pending, no-waves-yet, 57C-next, operating assumptions), `replit.md` (legacy banner),
  `.agentic/progress.md` (handoff-reconciliation log), this `HANDOFF.md`.
- **Created:** `.claude/commands/phase57c.md` (Phase 57C read-only proposal command).
- **No application code touched.** No schema/migration, no env, no canary, no OpenAPI/codegen, no flips.

## 4. What was tried that failed / gotchas

1. **ChatGPT handoff overstated progress by one phase.** It reported "Phase 57B-prereq (csv_set_equal FE
   submission-shape wiring) SHIPPED + architect-approved." **Verified false:** no `csvSetEqualSubmit.ts`
   anywhere, no `serverGrade` in `projects.ts`, no `capturedSqlByStepId` in `project-workspace.tsx`, no
   `phase-57b` doc, no commit. True last-shipped = 57A. **Lesson: verify handoff claims against the repo.**
2. **The "57B-prereq" FE wiring is downstream of Phase 57C, not a prerequisite for it.** 57C is read-only;
   it DECIDES how capture works (raw JSON vs signed envelope), which dictates the wiring. Don't build first.
3. **`typecheck/build: FAIL` at session end = environment** (Node 22 + no `node_modules`), not code or docs.
4. **Session-end hook clobbers a rich HANDOFF.md into a thin auto-gen.** Canonical records survive in
   `docs/phases/`, `INDEX.md`, `replit.md`, `progress.md`, git. Run `/handoff` before session end for richer output.

## 5. Next step

1. **Phase 57C — read-only `csv_set_equal` trust-model proposal** (the approved next action; build nothing).
   Use `/atlas-phase-plan 57C` or the `.claude/commands/phase57c.md` command. Compare raw `{columns,rows}`
   JSON vs **signed RunEnvelope** capture; inspect RunCapture shape, `/api/runs/sign`, envelope verify
   routing, and the C2 candidate's canonical `expectedRows`. Recommend an option. **Stop for owner approval.**
   (Bias: prefer signed RunEnvelope — aligns with the H3 trust spine.) Needs no Node 24 / install / Neon.
2. **Before any code FLIP** (57B-prereq build → 57B-flip): establish a true baseline — Node 24,
   `pnpm install`, `pnpm run typecheck` — and **Phase 0.2** decouple from the Replit platform so `pnpm dev` boots.
3. **Hardening sequence after 57C:** 57B-prereq build → 57B-flip → 58 `sql_resultset` → 59 `/check`-vs-`/submit`
   evidence → 60 portfolio/GitHub artifact → 61 authoring factory v2 → 62 cloud-lab safety. **No high-speed
   project waves until grader hardening + factory v2 are done.** Waves are hidden-first, never direct-publish.

---

**Inherited invariants (never break — full list in `.claude/skills/atlas-conventions/SKILL.md`):**
`RUBRIC_VERSION 1.0.1` frozen · archive=hide (no row deletes) · hidden slugs → 404 not 403 · bidirectional
candidate↔project lineage · no runtime `mapToCourse` · H3 honest-claims (no "verified authorship/tamper-proof/
cheat-proof/100% verified/job guaranteed") · graders ship dark with byte-for-byte BC audit · hidden-first publishing.
