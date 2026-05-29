# Atlas — Discovery

> Intent, constraints, and the decisions that govern the build. Source of truth for "why."
> Created 2026-05-29 when the build moved from Replit (coder) + ChatGPT (director) to Claude Code Opus-4.8.

## 1. What Atlas is

A project-based learning **PWA** for going from zero to job-ready across **9 courses**:

`data-engineering` · `ai-engineer` · `mlops-engineer` · `data-scientist` · `analytics-engineer` · `applied-llm-engineer` · `cloud-data-engineer` · `python-libraries` (Python Mastery) · `sql` (SQL Mastery)

> Owner listed 8 disciplines in the brief; the platform ships 9 — the 9th is `data-scientist`. Treat 9 as canonical (matches `atlas_course` enum + 57 phases of docs). **CONFIRM if data-scientist should stay.**

Core thesis (from blueprint): *"Learners become credible by completing realistic, portfolio-grade projects with guided support, progressive hints, honest validation, evidence-backed completion records, and recruiter-readable artifacts."*

Five principles: project-first · honest validation · progressive autonomy · recruiter-readable outcomes · production credibility.

## 2. Current state (measured, 2026-05-29)

- **Maturity:** 57 architect-reviewed phases. Blueprint self-estimate: **~35–55% complete**.
- **Built & solid:** pnpm monorepo (TS 5.9 / Node 24); React 19 + Vite frontend; Express 5 API; Drizzle + Postgres (~30 tables); Clerk auth; Stripe scaffold; Resend email; Monaco + **Pyodide** (Python) + **DuckDB-WASM** (SQL) in-browser editors; **Ada** SSE tutor (Haiku free / Sonnet pro) with mode-aware `tutorContract`; 4 learning modes (`guided/hint/independent/dynamic_ai_adaptive`); `/check` vs `/submit` split; 8 validation kinds; signed-run-envelope canary infra; frozen `RUBRIC_VERSION 1.0.1`; bidirectional candidate↔project lineage; ~70 authored projects, **60 visible**, hidden-first publishing.
- **Absent / stubbed:** cloud platforms (AWS/Azure/GCP/Databricks/Snowflake — TS *types only*, no SDKs/creds/mocks); real PWA (no manifest/service-worker/offline — only `InstallPrompt.tsx`); learner skill model (`learner_skill_state` designed, not built → adaptive is rule-based); GitHub export / LinkedIn share; production deployment; marketing site; `.claude/` and `.agentic/`.
- **Coupling risk:** Stripe sync, Resend, and the Anthropic proxy all read **Replit connectors**. Will not run locally as-is.

## 3. Catalog scale targets (blueprint)

| Milestone | Visible projects |
|---|---|
| Now | 60 (~5–6%) |
| v1.0 | 100–150 (≥20 flagship) |
| Serious launch | 300–400 (~50/discipline) |
| Ceiling | ~960–1,000 |

Tiers: **beginner** 4–6 steps / 60–150 min · **intermediate** 6–8 / 180–360 · **advanced** 8–12 / 360–720.
"Highly sought-after" = produces a recruiter-recognized artifact (dbt models, feature stores, CDC pipelines, semantic layers, RAG systems, model monitoring, structured-output guardrails, CI checks, portfolio deliverables).

## 4. Governing decisions (owner delegated; defaults chosen, owner may veto)

| # | Decision | Choice | Why |
|---|---|---|---|
| D1 | Hosting | **Migrate off Replit** → Neon Postgres + Fly/Vercel + direct Clerk/Stripe/Resend/Anthropic SDKs | Connectors don't run locally; blueprint targets Neon; removes lock-in |
| D2 | Cloud labs | **Sandbox-simulation first** (mock S3/Glue/Athena/BigQuery/Snowflake/Databricks + DuckDB); write BYO-cloud security spec for later | Ship cloud-flavored projects now, zero credential risk; matches blueprint |
| D3 | Ship goal | **Private beta first** (harden → evidence → export → PWA → deploy → ~100 projects → invite); marketing/legal deferred | Real usage before spend |
| D4 | Seeding | **Job-signal-driven factory** + human approval gate, hidden-first | The "scout 2026 demand → generate → score → approve" engine the owner asked for |
| D5 | Monorepo layout | **Keep** `artifacts/` (apps) + `lib/` (packages) + `scripts/`; do NOT rename to apps/packages | 780 files + 57 phase docs reference current names; rename = pure risk |
| D6 | Build approach | **Extend & surpass, never restart** | Existing trust spine is the #1 asset |

## 5. Hard constraints (inherited invariants — do not break)

- `RUBRIC_VERSION='1.0.1'` frozen. No weight edits.
- Archive = hide (`learner_visible=false`), never delete project/candidate rows.
- Learner routes filter `learner_visible=TRUE`; hidden slugs → **404, not 403** (no existence leak).
- Bidirectional candidate↔project lineage atomic; `mapToCourse` never called at runtime (guarded).
- H3 honest-claims: never "verified authorship / tamper-proof / cheat-proof / 100% verified / job guaranteed."
- New graders ship **dark** (opt-in flag, zero live rows) with a byte-for-byte BC audit before any behavior change. Architect review every phase.

## 6. Success criteria (v1.0 / beta)

100–150 visible audited projects · ≥20 flagship · validation kinds hardened or honestly classified · end-to-end project completion in-workspace · Ada works across all 4 modes · certificates + portfolio public/private as designed · zero H1/H2 overclaims · stable production deploy · auth+billing+onboarding functional · real PWA · beta learners complete projects without intervention.

## 7. Open questions for owner (non-blocking; building proceeds on defaults)

1. Keep `data-scientist` as the 9th course? (assumed yes)
2. Deploy host preference within D1 — Fly.io vs Vercel+Neon vs Render? (will recommend Fly for the Express API + Neon)
3. Any hard launch date driving sequencing? (assumed none → quality-gated cadence)
4. Budget ceiling per build session (affects how aggressively the factory fans out)?
