# Atlas

> Project-based learning PWA: zero → job-ready across 9 data and AI engineering tracks.

Learners become credible by completing realistic, portfolio-grade projects with guided support, progressive hints, honest validation, and evidence-backed completion records that produce recruiter-readable artifacts.

> **Strategic plan:** [`docs/ATLAS-MASTER-PLAN.md`](docs/ATLAS-MASTER-PLAN.md) — the finish-to-beta roadmap and the locked owner decisions (tiered cloud labs, freemium B2C, ~6–8 wk private beta with 100–150 projects, authoring factory + researched 2026 taxonomy).

---

## Status

| Item | Value |
|---|---|
| Current phase | 57A (`csv_set_equal` dark comparator) |
| Completion estimate | ~35–55% (blueprint self-assessment) |
| Learner-visible projects | ~60 (70 authored) |
| Build history | 57 architect-reviewed phases shipped |
| Environment | Originally Replit + ChatGPT; continued in Claude Code |

---

## What is Atlas

Atlas is a single monorepo PWA (planned; manifest/service-worker/offline not yet built) serving 9 courses:

| Slug | Track |
|---|---|
| `data-engineering` | Data Engineering |
| `ai-engineer` | AI Engineer |
| `mlops-engineer` | MLOps Engineer |
| `data-scientist` | Data Scientist |
| `analytics-engineer` | Analytics Engineer |
| `applied-llm-engineer` | Applied LLM Engineer |
| `cloud-data-engineer` | Cloud Data Engineer |
| `python-libraries` | Python Mastery |
| `sql` | SQL Mastery |

The thesis: every learner's work runs inside a real editor, is graded by deterministic validators, and is persisted as signed evidence — not just a score. Completion records are honest about what was and was not verified; certificates are portfolio artifacts, not badges.

---

## Key Features

| Feature | State |
|---|---|
| Monaco code editor (Python via Pyodide 0.29, SQL via DuckDB-WASM) | Shipped |
| 4 learning modes: `guided` / `hint` / `independent` / `dynamic_ai_adaptive` | Shipped |
| Ada AI tutor (Anthropic SSE; Haiku free tier / Sonnet pro tier), mode-aware | Shipped |
| `/check` practice runs (no DB writes) vs `/submit` durable evidence runs | Shipped |
| 9 validation kinds (see [Validation](#validation-kinds)) | Shipped |
| Signed run-result envelopes with nonce store | Shipped |
| Enrollment counters, concurrent-submit race hardening | Shipped |
| Certificate / portfolio evidence surface | Shipped |
| H3 honest-claims copy guard (see [Trust Model](#the-trust-model)) | Shipped |
| Auth via Clerk | Shipped |
| Billing via Stripe | Shipped |
| Email via Resend | Shipped |
| Real PWA (manifest, service worker, offline) | Planned |
| Real cloud-platform integration (AWS / Azure / GCP / Databricks / Snowflake) | Planned — sandbox simulation first |
| Learner skill model | Planned |
| GitHub export / LinkedIn share | Planned |
| Production deployment | Planned |
| Marketing site | Planned |

### Validation Kinds

`exact` · `regex` · `contains` · `numeric_tolerance` · `csv_set_equal` · `csv_ordered` · `json_equal` · `sql_resultset` · `self_attest`

---

## Monorepo Layout

```
atlas/
├── artifacts/
│   ├── atlas/              # React 19 + Vite 7 + Tailwind 4 + wouter + TanStack Query
│   │                       #   Monaco editor · Pyodide (Python) · DuckDB-WASM (SQL)
│   ├── api-server/         # Express 5 + Drizzle ORM + Postgres (Neon) + Zod
│   │                       #   Auth: Clerk · Billing: Stripe · Email: Resend · Tutor: Anthropic SSE
│   └── mockup-sandbox/     # Design / layout prototyping surface
│
├── lib/
│   ├── db/                 # Drizzle schema, migrations, seed helpers
│   ├── execution-core/     # Runtime envelope, signing, learning modes
│   ├── curriculum-quality/ # Rubric engine, authoring spec, scoring (RUBRIC_VERSION 1.0.1)
│   ├── api-spec/           # OpenAPI spec (source of truth)
│   ├── api-client-react/   # Orval-generated React Query hooks
│   └── api-zod/            # Orval-generated Zod validators
│
├── scripts/                # seed · migrate · audit:* · check:no-heuristic-runtime
│
├── docs/
│   ├── phases/             # Per-phase close-out documents (phases 4–57A)
│   ├── runbooks/           # Operational runbooks (envelope canary, etc.)
│   └── templates/          # Project authoring templates and checklists
│
├── .agentic/               # Agent workspace: discovery.md · plan.md · progress.md
└── .claude/                # Agent commands, skills, reviewer agent
```

---

## Quickstart

### Prerequisites

- **Node 24** (use `nvm` or `fnm`)
- **pnpm** (`npm i -g pnpm`)
- A **Neon** (or compatible Postgres) database branch

### Install

```bash
git clone <repo-url> atlas
cd atlas
pnpm install
```

### Environment

Copy or create a `.env` file at the repo root. **Never commit it.**

```bash
# Required — get from your Neon project dashboard
DATABASE_URL=postgres://...

# Auth (Clerk) — the Vite frontend reads the publishable key as
# VITE_CLERK_PUBLISHABLE_KEY; the dev script maps it from CLERK_PUBLISHABLE_KEY.
CLERK_SECRET_KEY=...
CLERK_PUBLISHABLE_KEY=...

# Billing (Stripe)
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...

# Email (Resend)
RESEND_API_KEY=...

# AI tutor (Anthropic)
ANTHROPIC_API_KEY=...
```

### Database

```bash
# Apply migrations
pnpm --filter @workspace/scripts run migrate

# Seed content
pnpm --filter @workspace/scripts run seed
```

### Run

```bash
# API server (Express 5, default port 3001)
pnpm --filter @workspace/api-server run dev
```

The React frontend (`artifacts/atlas`) has its own dev server; run it from that directory with `pnpm run dev` once the API server is up.

### Type-check and Build

```bash
pnpm run typecheck   # full workspace typecheck + no-heuristic-runtime gate
pnpm run build       # typecheck then build all packages
```

### Test

```bash
# Run tests for a specific package
pnpm --filter @workspace/api-server       run test
pnpm --filter @workspace/atlas            run test
pnpm --filter @workspace/execution-core   run test
pnpm --filter @workspace/curriculum-quality run test
```

### Content Audits

```bash
pnpm --filter @workspace/scripts run audit:authoring
pnpm --filter @workspace/scripts run audit:pedagogy
pnpm --filter @workspace/scripts run audit:quality
pnpm --filter @workspace/scripts run audit:contains-bc
pnpm --filter @workspace/scripts run audit:csv-set-equal-bc
pnpm --filter @workspace/scripts run audit:difficulty
```

---

## Architecture at a Glance

The frontend (`artifacts/atlas`) runs entirely in the browser, embedding Pyodide for Python execution and DuckDB-WASM for SQL execution — no server round-trip for code runs. `/check` submissions are ephemeral practice (no database writes); `/submit` submissions produce a signed run-result envelope (nonce-protected, persisted) that becomes the learner's durable evidence record. The API server validates, stores, and serves that evidence. Orval generates type-safe client code from the OpenAPI spec in `lib/api-spec`, so the contract between frontend and backend is always in sync.

See [ARD.md](ARD.md) for architecture requirements and [TRD.md](TRD.md) for technical requirements.

---

## The Trust Model

Atlas makes honest claims and no stronger. Completion records reflect that a learner submitted work that passed deterministic validators for the given inputs — they do not assert verified authorship, tamper-proof execution, or job guarantees. `RUBRIC_VERSION 1.0.1` is frozen; scoring weights are never silently changed. Archive operations hide projects (`learner_visible = false`) and never delete rows. Hidden slugs return 404, not 403, to avoid existence leaks. New graders ship dark (opt-in flag, zero live rows) with a byte-for-byte backward-compatibility audit before any behavior change goes live. The H3 copy guard is enforced at the code level and audited per phase.

See [docs/runtime-validation-threat-model.md](docs/runtime-validation-threat-model.md) and [docs/validation-kind-matrix.md](docs/validation-kind-matrix.md) for full detail.

---

## Repository Docs

| Document | Purpose |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Agent and build instructions — read first every session |
| [HANDOFF.md](HANDOFF.md) | Live engineering state; currently Phase 57A |
| [PRD.md](PRD.md) | Product requirements |
| [BRD.md](BRD.md) | Business requirements |
| [ARD.md](ARD.md) | Architecture requirements |
| [TRD.md](TRD.md) | Technical requirements |
| [DESIGN.md](DESIGN.md) | Design system |
| [DRD.md](DRD.md) | Design requirements |
| [.agentic/discovery.md](.agentic/discovery.md) | Intent, locked decisions, Q&A record |
| [.agentic/plan.md](.agentic/plan.md) | Epic/phase roadmap (E0–E7) |
| [.agentic/progress.md](.agentic/progress.md) | Live session state — source of truth for continuation |
| [docs/phases/INDEX.md](docs/phases/INDEX.md) | Index of all per-phase close-out documents |
| [docs/project-authoring-spec.md](docs/project-authoring-spec.md) | Spec for authoring new projects |
| [docs/validation-kind-matrix.md](docs/validation-kind-matrix.md) | All 9 validation kinds, behavior, and trust boundaries |
| [docs/runtime-validation-threat-model.md](docs/runtime-validation-threat-model.md) | Security and honesty model for validation |

---

## Contributing / Phase Ritual

Every unit of work follows the same loop:

1. `/atlas-phase-plan <id>` — plan the phase; review with architect
2. Build — one logical change per commit, conventional-commit messages (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`)
3. `/atlas-validate` — typecheck + tests + build + content audits, all green
4. `atlas-architect-reviewer` subagent — independent review, fix all findings
5. `/code-review` — final pass
6. `/atlas-phase-close` — write close-out doc to `docs/phases/`, update `.agentic/progress.md`

**Never declare a phase done with failing typecheck, tests, build, or audit.** Never weaken quality gates. Never commit secrets.

---

## License

MIT — see [package.json](package.json).
