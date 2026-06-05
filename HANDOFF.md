# Session Handoff — Atlas (Claude Code continuation)

> Written 2026-06-05 for a context-compact. A fresh session with no memory of this conversation
> can continue from this file alone. Read this, then `.agentic/progress.md`, then `.agentic/plan.md`.
>
> **Where the Phase 57A engineering record lives** (this file was repurposed from it by the
> session-end hook — no data lost): `docs/phases/phase-57a-csv-set-equal-comparator.md` (full
> close-out), `docs/phases/INDEX.md` (chronological index of all 57 phases), and `replit.md`
> (latest-3 phases inline + active control-plane rules). Older HANDOFF.md versions are in git history.

---

## 1. Goal

**Finish and surpass the interrupted Replit build — take Atlas from ~35–55% to a shippable private beta.**
Atlas is a project-based learning PWA (zero → job-ready across 9 courses: data-engineering, ai-engineer,
mlops-engineer, data-scientist, analytics-engineer, applied-llm-engineer, cloud-data-engineer,
python-libraries, sql). The full roadmap is `.agentic/plan.md` — **8 epics E0–E7**:

- **E0 Foundation** (current, ~done) → **E1 Validation hardening** → **E2 Evidence/GitHub export** →
  **E3 Adaptive skill model** → **E4 Curriculum factory** (the missing ~95% of projects; continuous) →
  **E5 Cloud labs (sandbox-first)** → **E6 PWA + deploy + billing + beta** → **E7 public launch (deferred)**.

Governing decisions (owner-approved, `discovery.md §4`): **D1** migrate off Replit · **D2** sandbox-cloud
first · **D3** private-beta first · **D4** job-signal curriculum factory · **D5** keep monorepo layout
(`artifacts/`+`lib/`+`scripts/`, no rename) · **D6** extend-not-restart (the 57-phase trust spine is the asset).

## 2. Current state of the codebase

- **Foundation (Phase 0) essentially complete.** Built this session: `.claude/` command/agent/skill spine,
  `.agentic/` workspace, and 9 root docs (CLAUDE, README, PRD, BRD, ARD, TRD, DESIGN, DRD + this HANDOFF).
  The build is now drivable by `/atlas-phase-plan`, `/atlas-validate`, `/atlas-phase-close`, the
  `atlas-architect-reviewer` subagent, and the `atlas-conventions` skill.
- **Product code UNCHANGED this session.** Zero behavior change. Still Phase 57A on the Replit-era spine.
- **Does NOT build locally yet — and that is expected, not a defect:**
  `node_modules` is absent (`pnpm install` never run here) and **Node is v22.17.1 but the project targets
  Node 24**. The session-end hook's `typecheck: FAIL` / `build: FAIL` are caused by this, NOT by code or by
  the markdown docs. pnpm 9.15.0 is present.
- **Still coupled to Replit** (Stripe/Resend/Anthropic via Replit connectors) — this blocks local boot and is
  exactly what Phase 0.2 removes.
- **Git:** branch `main`. Recent commits are session-end WIP auto-commits (`769347d`, `cc0b2bf`). ~15
  uncommitted changes (the new docs + `.agentic/` + `.gitignore`). Phase 0 is not yet committed as a clean unit.

### New owner inputs dropped in repo root — UNREAD, read these first next session
These arrived this session and were not yet read. They map directly to E4 (factory) and the "ship top of class"
ask, so they are priority context:
- `ATLAS AUTONOMOUS PROJECT SCOUTING, MEASUREMENT, SELECTION, AND QUALITY-CONTROL SYSTEM` → E4 factory design.
- `ATLAS TOP-TIER COMPETITIVE SYSTEMS AND ENGINES` → the "ship top of class" engines.
- `ATLAS_SYSTEMS_&_ENGINES_BUILD_GRADE_SPECIFICATIONS` → build-grade specs.
- `Master_Atlas_Systems` and `Build_Phases` → likely a master systems/phasing doc. Reconcile against `.agentic/plan.md`.

## 3. Files actively updated (this session)

- **Created:** `CLAUDE.md`; `README.md`, `PRD.md`, `BRD.md`, `ARD.md`, `TRD.md`, `DESIGN.md`, `DRD.md`;
  `.claude/settings.json`; `.claude/commands/{atlas-phase-plan,atlas-validate,atlas-phase-close}.md`;
  `.claude/agents/atlas-architect-reviewer.md`; `.claude/skills/atlas-conventions/SKILL.md`;
  `.agentic/{discovery,plan,progress}.md`.
- **Edited:** `.gitignore` (Claude local-file ignores); `README.md` (2 reconciliation fixes, see §4); `HANDOFF.md` (this).
- **Not mid-edit on any code file** — clean stopping point. No partial/uncompiled changes to product source.

## 4. What was tried that failed / gotchas

1. **`AskUserQuestion` (4 decision forks) — REJECTED by owner.** They want decide-for-me + proceed. Resolved
   by taking blueprint-aligned defaults D1–D6. Do not re-litigate; build on those.
2. **Stale fact in the doc fact-pack: Pyodide `0.28.4`** (carried from `replit.md`). Truth is `^0.29.3`
   (`artifacts/atlas/package.json:69`). Fixed in README. **Lesson: verify versions against `package.json`, not `replit.md`.**
3. **Parallel doc-agent hallucination:** README got `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (a Next.js-ism).
   Atlas is **Vite** — corrected to `CLERK_PUBLISHABLE_KEY` (dev script maps it to `VITE_CLERK_PUBLISHABLE_KEY`).
   **Lesson: always Opus-review parallel-agent output against code.**
4. **`typecheck: FAIL` / `build: FAIL` at session end = environment, not code.** Root cause: no `node_modules`
   + Node v22 instead of v24. **Do NOT "fix" code before running `pnpm install` on Node 24.**
5. **No gates were run this session** (docs/scaffolding only). **Do not assume green** — run `/atlas-validate`
   after a clean install to establish the true baseline.

## 5. Next step

0. **Read the new owner blueprints** listed in §2 (scouting system, competitive engines, systems specs,
   `Master_Atlas_Systems`, `Build_Phases`). Reconcile with `.agentic/plan.md`; they likely sharpen E4 + the
   "top of class" engines.
1. **Establish a true baseline:** switch to **Node 24** (nvm/fnm), run `pnpm install`, then `pnpm run typecheck`.
   This tells you whether the Replit-era code is actually healthy outside Replit.
2. **Phase 0.2 — cut the Replit cord** (first architect-gated code phase). Invoke before: `senior-devops`,
   `env-secrets-manager`. Run `/atlas-phase-plan E0.2` (read-only decision brief) → swap Replit connectors for
   direct Stripe/Resend/Anthropic SDKs behind an env adapter (keep Replit path as a fallback flag) →
   `/atlas-validate` → `atlas-architect-reviewer` → `/atlas-phase-close`. Goal: `pnpm dev` boots on Windows.
3. **Phase 0.3 — local green:** owner provides Neon `DATABASE_URL` → gitignored `.env` → `pnpm dev` + seed run clean.
4. Then **Phase 1 = E1** (finish validation hardening: csv_set_equal opt-in, sql_resultset, /check-vs-/submit).
5. **Optional now:** commit Phase 0 as a clean checkpoint (`feat: Claude Code operating system + foundation docs`).

---

**Inherited invariants (never break — full list in `.claude/skills/atlas-conventions/SKILL.md`):**
`RUBRIC_VERSION 1.0.1` frozen · archive=hide (no row deletes) · hidden slugs → 404 not 403 · bidirectional
candidate↔project lineage · no runtime `mapToCourse` · H3 honest-claims (no "verified authorship/tamper-proof/
cheat-proof/100% verified/job guaranteed") · graders ship dark with byte-for-byte BC audit · hidden-first publishing.
