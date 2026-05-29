# Atlas — Build Plan (Replit → Claude Code Opus-4.8)

> Phased roadmap to finish & surpass the Replit build. Each EPIC decomposes into micro-phases
> that continue the existing `Phase NN` numbering and follow the inherited ritual:
> **plan/decision-brief → build dark → BC audit → architect review → close-out → rotate HANDOFF/INDEX/replit.md.**
> Do NOT start an epic's code phases until the owner approves this plan.

## How to read this

- **EPIC E0–E7** = large outcomes. Owner approves at epic granularity.
- **Phases** inside each epic = the unit of work + the unit of git commit + architect review.
- **Skills/Commands** column = exactly what the owner invokes to drive that phase (see §Skill System).
- Sequencing rule: **E0 first** (it makes everything else executable locally), then E1 (finish in-flight trust work), then the rest can interleave — curriculum factory (E4) runs continuously in the background once E0 lands.

---

## EPIC E0 — Operating System for the Build  *(foundation, do first)*

Make the repo runnable locally, Replit-free, and drivable by Claude Code.

| Phase | Work | Invoke |
|---|---|---|
| 0.1 | Scaffold `.claude/` (settings, commands, agents, skills) + 6 root docs (CLAUDE.md, README.md, DESIGN.md, PRD.md, BRD.md; HANDOFF.md exists) + `.agentic/` (this) | `/atlas-bootstrap` |
| 0.2 | **Decouple from Replit**: replace Replit connectors with direct SDKs behind an env-driven adapter (`STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `DATABASE_URL`); keep Replit path as a fallback flag so nothing breaks | `/atlas-phase-plan E0.2` → `/atlas-validate` |
| 0.3 | Local dev runs green on Windows: Neon-compatible Postgres (local docker or Neon branch), `pnpm dev` boots api+frontend, seed runs | `/atlas-ship-check local` |

Exit: `pnpm run typecheck` + all test suites green locally with **no Replit dependency required to boot**.

---

## EPIC E1 — Validation & Trust Hardening  *(finish the in-flight chain)*

The blueprint's #1 directive: *finish validation hardening before scaling content.*

| Phase | Work | Invoke |
|---|---|---|
| 57B/C | `csv_set_equal` trust decision (signed envelope vs raw JSON) + first opt-in pilot | `/atlas-harden-grader csv_set_equal` |
| 58 | `sql_resultset` hardening — canonical result format (column norm, numeric tolerance, NULL, ordering, type coercion), BC gate, first opt-in | `/atlas-harden-grader sql_resultset` |
| 59 | `/check` vs `/submit` evidence policy finalized (check = practice-only; submit = durable signed evidence) | `/atlas-phase-plan 59` |
| 59b | Execute the Phase-52 signed-envelope canary (1% `json_equal`) in staging → ramp | `/atlas-ship-check canary` |

Exit: every validation kind is either server-hardened or **honestly labeled** client-provisional; no silent auto-pass on a kind the UI implies is graded.

---

## EPIC E2 — Evidence & Portfolio Output  *(recruiter-facing payoff)*

| Phase | Work | Invoke |
|---|---|---|
| 60 | Portfolio/GitHub artifact contract: standard deliverable (README, setup, run, tests, sample output, skills, share-safe text) | `/atlas-phase-plan 60` |
| 61 | GitHub export flow (push a completed project's artifact to learner's repo) | `/atlas-phase-plan 61` |
| 62 | LinkedIn share + certificate/portfolio page polish; public `/verify/:certId` hardening | `/atlas-phase-plan 62` |

Exit: a learner finishes a project → one click produces a recruiter-readable GitHub repo + shareable verified record.

---

## EPIC E3 — Adaptive Intelligence  *(make "adaptive" real)*

| Phase | Work | Invoke |
|---|---|---|
| 63 | `learner_skill_state` table + writer (attempts, hint usage, time-on-step, completion rate, error categories) | `/atlas-skill-model` |
| 64 | Diagnostic assessment at onboarding → recommended start point per role | `/atlas-phase-plan 64` |
| 65 | Performance-driven adaptive mode (replaces rule-only resolver with skill-model signals) | `/atlas-skill-model adaptive` |
| 66 | Prerequisite graph between projects (stop random catalog browsing) | `/atlas-phase-plan 66` |

Exit: adaptive mode chooses help level from real learner performance, not just rules.

---

## EPIC E4 — Curriculum Factory  *(the missing 95% — runs continuously)*

Job-signal-driven, human-gated, hidden-first. This is how 60 → 150 → 400 happens.

| Phase | Work | Invoke |
|---|---|---|
| 67 | **Market scout**: research live 2026 hiring demand per course (job posts, tools, role archetypes) → refresh `lib/curriculum-quality/src/archetypes.ts` | `/atlas-market-scout <course>` |
| 68 | **Authoring factory v2**: generate 6–10 candidate projects/wave from refreshed archetypes, full pedagogy + validation, scored ≥70 on rubric | `/atlas-author-wave <course> <tier>` |
| 69 | **Review + promote**: owner reviews candidate report → `/atlas-promote` flips hidden-first with lineage + audits | `/atlas-promote <candidateId>` |
| 70+ | Repeat per course/tier until v1.0 (100–150) then serious-launch (300–400). Track coverage gaps. | loop 67→68→69 |

Exit: catalog reaches 100–150 audited visible projects with balanced tier/course coverage; factory is repeatable.

---

## EPIC E5 — Cloud Labs (sandbox-first)

| Phase | Work | Invoke |
|---|---|---|
| 71 | Activate `ExecutionProfile` sandbox mode: deterministic mock S3/GCS/Blob, mock IAM, local dbt, fixture data | `/atlas-cloud-lab sandbox` |
| 72 | Per-provider mock surfaces (AWS S3+Glue+Athena, GCP GCS+BigQuery, Snowflake, Databricks Delta) backed by DuckDB + fixtures | `/atlas-cloud-lab <provider>` |
| 73 | **BYO-cloud security contract** (doc/spec only — credential vault, least-privilege templates, cost guardrails, teardown). NO real creds yet. | `/atlas-phase-plan 73` |

Exit: cloud-flavored projects run end-to-end in sandbox; real-cloud is shovel-ready but unbuilt (gated).

---

## EPIC E6 — Productization & Beta Launch

| Phase | Work | Invoke |
|---|---|---|
| 74 | **Real PWA**: manifest, service worker, offline shell, installability, asset caching for Pyodide/DuckDB | `/atlas-phase-plan 74` |
| 75 | Production deploy: Neon + Fly/Vercel, env/secrets matrix, nonce janitor cron, migrations runner | `/atlas-ship-check prod` |
| 76 | Billing production (live Stripe products/prices, webhook secret, tier gates, cancellation) | `/atlas-phase-plan 76` |
| 77 | Onboarding polish + private beta cohort invite | `/atlas-phase-plan 77` |

Exit: real users complete projects on a deployed, installable, billed product.

---

## EPIC E7 — Public Launch  *(deferred per D3)*

Marketing site · pricing page · legal (ToS/privacy) · waitlist conversion · growth. Out of scope until beta validates.

---

# Skill & Command System (phase-scoped)

Built in Phase 0.1. Stored under `.claude/`. Commands are slash-invokable; agents are subagents the commands dispatch.

## Slash commands → `.claude/commands/`

| Command | Scope | Does |
|---|---|---|
| `/atlas-bootstrap` | E0 | One-time: write 6 docs + .claude skeleton |
| `/atlas-phase-plan <id>` | all | Write a pre-build decision brief + numbered plan + acceptance criteria (mirrors `docs/phases/*-plan.md`) |
| `/atlas-validate` | all | Run the full gate chain: `typecheck` + every vitest suite + `audit:*` + BC audits; report pass/fail |
| `/atlas-harden-grader <kind>` | E1 | The extract→guard→BC-audit→document pattern for a validation kind |
| `/atlas-market-scout <course>` | E4 | Research 2026 hiring demand → propose archetype refresh |
| `/atlas-author-wave <course> <tier>` | E4 | Generate + rubric-score 6–10 candidate projects, hidden |
| `/atlas-promote <candidateId>` | E4 | Promote candidate → visible, with lineage + audits |
| `/atlas-skill-model [adaptive]` | E3 | Build/extend `learner_skill_state` + adaptive resolver |
| `/atlas-cloud-lab <provider\|sandbox>` | E5 | Scaffold a sandbox cloud surface |
| `/atlas-ship-check <local\|canary\|prod>` | E0/E6 | Deployment-readiness checklist for the target |
| `/atlas-phase-close` | all | Write close-out doc + rotate HANDOFF.md / INDEX.md / replit.md |

## Subagents → `.claude/agents/`

| Agent | Model | Role |
|---|---|---|
| `atlas-architect-reviewer` | opus | The architect-review gate every phase already uses — find P0/P1, demand fixes |
| `atlas-curriculum-author` | sonnet | Draft AuthoredProject objects (steps, pedagogy, validation) to spec |
| `atlas-rubric-scorer` | sonnet | Score candidates against rubric v1.0.1, flag <70 |
| `atlas-grader-hardener` | opus | Validation-kind hardening (security-sensitive) |
| `atlas-studio-frontend` | sonnet | React/Vite studio + panel work |
| `atlas-market-scout` | sonnet | Web research on hiring demand + tool trends |

Model routing per `~/.claude/rules/model-routing.md`: Opus orchestrates + reviews; Sonnet does bounded build; Haiku does bulk extract. Every worker output reviewed before merge.

## `.claude/` structure (created Phase 0.1)

```
.claude/
  settings.json                 # $schema, permissions, hook wiring
  commands/                     # the slash commands above (kebab-case .md)
  agents/                       # the subagents above (with description: frontmatter)
  skills/
    atlas-conventions/SKILL.md  # invariants, phase ritual, gate chain
    atlas-authoring/SKILL.md     # points to docs/project-authoring-spec.md
CLAUDE.md                        # project tier (≤100 lines): stack, commands, invariants
README.md  DESIGN.md  PRD.md  BRD.md  HANDOFF.md
.agentic/
  discovery.md  plan.md  progress.md  research.md
```

# Immediate next action

Awaiting owner go/no-go on this plan. On **go**, I execute **Phase 0.1** (`/atlas-bootstrap`): write the 6 docs + `.claude/` skill/command system, then **Phase 0.2** (decouple from Replit) so the app boots locally. No code-behavior change until then.
