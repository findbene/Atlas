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

## Next steps

1. **Phase 0.1b** — write remaining 4 root docs: README.md, DESIGN.md, PRD.md, BRD.md. (CLAUDE.md ✅, HANDOFF.md exists ✅.)
2. **Phase 0.2** — decouple from Replit connectors (direct SDKs behind env adapter) so it boots locally on Windows. Phase-specific commands built just-in-time.
3. **Phase 0.3** — local dev green (Neon/Postgres branch, `pnpm dev`, seed).
4. Then Phase 1 = E1 (finish validation hardening); Phase 5 = E4 factory runs continuously.

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
