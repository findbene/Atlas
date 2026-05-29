# Atlas — Progress

> Live state for context recovery. Read this first every session. Update after every task/decision.
> Live engineering state of the *Replit-era code* remains in `HANDOFF.md` (Phase 57A). This file
> tracks the *Claude Code continuation* (the build-to-finish).

## Current state — 2026-05-29

- **Phase:** Pre-build. Claude Code took over from Replit+ChatGPT. Repo + 3 blueprints read; full codebase surveyed.
- **Last Replit-era shipped phase:** 57A (`csv_set_equal` dark comparator). Working tree otherwise clean (3 untracked blueprint docs + this new `.agentic/`).
- **Decisions locked (owner-delegated, vetoable):** D1 migrate off Replit · D2 sandbox-cloud first · D3 private-beta first · D4 job-signal factory · D5 keep monorepo layout · D6 extend-not-restart. See `discovery.md §4`.
- **Plan written:** `plan.md` — 8 epics (E0–E7), phase-scoped skills/commands. **Awaiting owner go/no-go.**

## Next steps (on owner approval)

1. **Phase 0.1 `/atlas-bootstrap`** — write 6 root docs (CLAUDE.md, README.md, DESIGN.md, PRD.md, BRD.md) + `.claude/` commands/agents/skills.
2. **Phase 0.2** — decouple from Replit connectors (direct SDKs behind env adapter) so it boots locally on Windows.
3. **Phase 0.3** — local dev green (Neon/Postgres, `pnpm dev`, seed).
4. Then E1 (finish validation hardening), then E4 factory runs continuously.

## Key decisions & reasoning log

- 2026-05-29 — Chose **extend over rebuild**: the 57-phase trust spine (signed envelopes, lineage, BC audits, frozen rubric, H3 copy guard) is the primary asset; restarting discards it. Rebuild only the gaps (cloud, PWA, skill model, export, deploy).
- 2026-05-29 — Keep `artifacts/`+`lib/`+`scripts/` layout; renaming to `apps/packages/` rejected (780 files + 57 docs reference it; pure risk, no payoff).
- 2026-05-29 — Cloud labs sandbox-first; blueprint explicitly says do not build real credential flows until security model finalized.

## Blockers / risks

- Replit connector coupling blocks local boot until Phase 0.2. (Not blocking planning.)
- Secrets needed at deploy time only (Neon, Clerk, Stripe, Anthropic, Resend) — owner provides via `! <cmd>`, never committed.

## Deviations from plan

- None yet.
