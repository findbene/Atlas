# Atlas — Master Plan to Private Beta & Top-of-Class

**Status:** Strategic finish-and-win plan. Written 2026-06-08, post Phase 61A.
**Purpose:** The single top-down plan that reconciles the original product vision with the
**real** repo state (61 phases shipped) and sequences the path to a private beta and a
top-of-class public launch.
**Authority:** Strategic layer. Operating manual = `CLAUDE.md`. Live state = `.agentic/progress.md`.
Business = `BRD.md` · Product = `PRD.md` · Architecture = `ARD.md` · Tech spec = `TRD.md` ·
Design = `DESIGN.md` · Data = `DRD.md`. This doc points to them; it does not replace them.

---

## 0. Locked decisions (owner, 2026-06-08)

These four forks were decided explicitly and govern everything below. They are consistent with
the pre-existing governing decisions D1–D6 in `.agentic/discovery.md`.

| # | Decision | Choice | Consistent with |
|---|---|---|---|
| 1 | Cloud labs | **Tiered: local sandbox + BYO-credentials.** Local/emulated engines (DuckDB/MotherDuck/LocalStack/dbt-core/Pyodide) cover the backbone at zero Atlas cloud spend; advanced cloud projects use the learner's **own free-tier keys** (Snowflake/Databricks/AWS trials), encrypted, scoped, revocable, never Atlas-owned. | D2 sandbox-first (extends it with the BYO-cred tier) |
| 2 | Monetization | **Freemium subscription (B2C).** Free tier (starter projects, limited tutor) → Pro unlocks full catalog, tutor, labs, portfolio export. | BRD §7 Models 1–2 |
| 3 | First release | **Private beta, ~6–8 weeks, all 9 courses, ~100–150 curated projects.** | D3 private-beta-first, BRD §8.1 |
| 4 | Project engine | **Authoring factory + a researched 2026 in-demand taxonomy** (sourced from real hiring signals), hidden-first. | D4 job-signal factory, BRD §10 Risk 2 |

---

## 1. Honest current-state map (vision vs reality)

The original brief read as "build from zero." Reality is the opposite: the **hardest, most
defensible** part is already built. The gaps are catalog depth, cloud labs, tutor maturity,
the adaptive mode, local boot, and observability — not the engine.

| Capability | State | Truth |
|---|---|---|
| Monorepo (pnpm/Node24/TS) | ✅ Built | `artifacts/*` + `lib/*` + `scripts/` is the right shape. Keep + extend. |
| Validation / grading engine | ✅ Strong | `sql_resultset` / `csv_set_equal` / `contains`, server-grade opt-in, dark-ship + BC-audit discipline. **This is the moat.** |
| Evidence → portfolio loop | ✅ Built (60A–60H) | Snapshot → artifact → GitHub-ready repo → one-click ZIP, leak-free, H3-honest. |
| In-browser editors | 🔶 Partial | Monaco + Pyodide (Python) + DuckDB-WASM (SQL) work. No multi-file IDE, no cloud labs yet. |
| Catalog | 🔶 ~60 of 1000 | The real bottleneck. ~5% done; server-grade coverage concentrated in one project (C2). |
| AI tutor (Ada) | 🔶 Partial | Anthropic SSE + mode contract (Phase 34) exist; "at every step" + 4 modes + adaptive policy not finished. |
| 4 learning modes | 🔶 Partial | Guided/hint/independent scaffolded (Phase 32–33); **adaptive** (AI-chosen) not built. |
| Local boot / Replit decouple | ❌ Blocked | **Phase 0.2** — still Replit-connector-coupled; clean `pnpm dev` not yet green. |
| Cloud labs | ❌ Not started | Decision 1 (tiered) defines the build. |
| Scaffolding/business docs | ✅ Exist | README/DESIGN/PRD/BRD/ARD/TRD/DRD + CLAUDE.md + HANDOFF.md all present (Phase 0.1b). |

**Strategic read:** not 5% done — ~5% on *catalog*, ~70% on the *engine that makes the catalog
valuable*. Winning move: **industrialize authoring** (so depth stops being hand-work) while
finishing tutor + adaptive + local boot, then open a private beta on a curated thin catalog.
**Do not chase 1000 projects before beta.**

---

## 2. Target monorepo architecture (keep, extend — do not rebuild)

The workspace is already correct. The vision needs **three net-new packages**, not a restructure:

```
atlas/
├─ artifacts/                      # deployable apps
│  ├─ atlas/                       # React 19 PWA (learner)  ── EXTEND: IDE shell, labs UI, mode switcher
│  ├─ api-server/                  # Express 5 + Drizzle      ── EXTEND: tutor orchestration, labs broker
│  └─ studio/            [NEW]     # internal authoring/review console (factory cockpit, not public)
├─ lib/
│  ├─ db/                          # schema + migrations
│  ├─ execution-core/              # runtime/envelope/modes (WASM exec)
│  ├─ curriculum-quality/          # rubric/authoring/scoring
│  ├─ api-spec/ → api-client-react/ + api-zod/   # OpenAPI → codegen
│  ├─ tutor-core/        [NEW]     # Ada: prompt graphs, mode policies, adaptive signals, hint ladder
│  ├─ labs-core/         [NEW]     # cloud-lab abstraction: local-sandbox + BYO-cred providers, artifact capture
│  └─ scout-core/        [NEW]     # authoring factory: taxonomy, spec synthesis, fixture-gen, verify harness
└─ scripts/                        # seeds, audits, author-project, factory CLIs
```

Why packages, not folders: each carries its own tests/audits, can be driven by its own
phase-scoped skill, and isolates blast radius (a labs bug can't touch grading).

---

## 3. `.claude/` structure — skills & commands scoped by phase/epic

Stable **rituals as commands** (every phase) + **epic-scoped skills** (domain knowledge loaded
only for that epic). The ritual layer exists today; extend with epic skills.

```
.claude/
├─ CLAUDE.md · settings.json · atlas-mini-report-template.md         # (exist)
├─ commands/   atlas-phase-plan · atlas-validate · atlas-phase-close · atlas-mini-report
├─ agents/     atlas-architect-reviewer (exists) · atlas-evidence-auditor [NEW: leak/H3 gate]
└─ skills/
   ├─ atlas-conventions/         # invariants (exists) — ALWAYS
   ├─ atlas-grader-authoring/    [E4]  ship a grader dark + BC audit
   ├─ atlas-project-factory/     [E4]  taxonomy → spec → fixtures → WASM-verify → rubric
   ├─ atlas-tutor-design/        [E5]  Ada prompt graphs, hint ladder, mode policies
   ├─ atlas-labs-integration/    [E6]  local-sandbox + BYO-cred provider patterns
   └─ atlas-adaptive-policy/     [E5]  signal collection → mode selection
```

**Invocation map:**

| Stage | Invoke | Produces |
|---|---|---|
| Start any phase | `/atlas-phase-plan <id>` | scoped plan in `.agentic/` |
| Authoring | load skill `atlas-project-factory` | new hidden candidate(s) |
| Tutor work | load skill `atlas-tutor-design` | Ada graph changes |
| Before close | `/atlas-validate` → `atlas-architect-reviewer` + `atlas-evidence-auditor` → `/code-review` | PASS/FAIL gate |
| Close | `/atlas-phase-close` + `/atlas-mini-report` | close-out + archived report |

Principle: **one ritual spine, swappable epic skill.** Rituals never change as scope grows.

---

## 4. How to direct Claude Code Opus-4.8 (operating model)

1. **ChatGPT = director, Claude Code = sole coder.** One phase brief at a time with explicit
   hard-stops + a required report shape. Claude verifies ChatGPT's claims vs the repo (it has
   drifted +1 phase before).
2. **One logical change per phase/commit.** Conventional commits. Never bundle.
3. **Every grader/behavior change ships dark + BC-audited** before any live flip. This is *why*
   Atlas can claim honesty.
4. **Model routing:** Opus orchestrates + reviews; Sonnet does CRUD/components/tests; Haiku does
   extraction/summaries. Architecture, grading, security stay on Opus.
5. **Two-reviewer gate every phase:** `atlas-architect-reviewer` + `/code-review`; add
   `atlas-evidence-auditor` whenever a phase touches export/grading/tutor (leak + H3 honesty).
6. **Mini-report + archive after every task** (hook-enforced).

---

## 5. The 6–8 week private-beta roadmap

Continues the epic arc (E1 done, E2 done through 60H, E4 in progress).

| Wk | Epic / Phase | Goal | Exit gate |
|---|---|---|---|
| 1 | **Phase 0.2** (unblock) | Decouple Replit connectors → clean `pnpm dev` on Node 24; Neon branch wired | App boots locally, gates green |
| 1–2 | **E4 — factory v2** | Build `scout-core`: taxonomy → spec → fixtures → WASM-verify → rubric gate (hidden-first) | 10 projects authored in one run, all pass rubric, all hidden |
| 2–4 | **E4 — catalog push** | Drive factory to ~100–150 curated projects across 9 courses (runtime-tier A first) | ≥12/course, hidden→reviewed→visible, server-gradeable backbone live |
| 3–4 | **E5 — Ada tutor** | `tutor-core`: at-every-step hints, 4 modes incl. adaptive policy | Tutor on every step; mode switch + adaptive selection working |
| 4–5 | **E6 — labs (tiered)** | `labs-core`: local sandbox + BYO-cred provider | Learner runs a local-lab + a BYO-cred project, artifacts captured leak-free |
| 5 | **E7 — IDE shell** | Multi-file editor, Python+SQL, run/test panel over execution-core | A 5-file project edits + runs in-browser |
| 5–6 | **E8 — billing + onboarding** | Stripe freemium gating, free-tier limits, signup, paywall | Free→paid flow end-to-end |
| 6 | **E9 — beta hardening** | PWA polish, perf, a11y, observability, security pass | Lighthouse/a11y green; security review PASS |
| 6–8 | **Private beta** | Invite cohort; instrument; iterate | Real-learner completion + portfolio export in the wild |

`scout-core` and `tutor-core` float in parallel after Phase 0.2 (different packages, no collision).

---

## 6. Project scaling engine + the 2026 taxonomy

**The key insight competitors miss:** map every in-demand project to a **runtime/grading tier**,
and build the deterministically-gradeable backbone first. Demand alone isn't enough — a project
is only *premium-on-Atlas* if Atlas can **prove** the learner did it.

**Runtime/grading tiers (the factory's prioritization key):**

- **Tier A — WASM-native, server-gradeable** (SQL, DuckDB analytics, dbt-core local, pandas/Pyodide,
  data modeling). Deterministic, fixture-backed, server-graded. **Catalog backbone — build first.**
  Also what makes the evidence/portfolio loop sing.
- **Tier B — local-tool, artifact-graded** (Spark-local, Airflow/Dagster local, Docker pipelines,
  ML training). Runs locally; graded by captured artifacts + `contains` + structure checks.
- **Tier C — BYO-cloud, evidence-graded** (Snowflake/Databricks/AWS/GCP/Azure). Learner brings
  free-tier creds; graded by exported artifacts + honest "Atlas verified output matched" claims —
  never "we provisioned this."

**Factory pipeline (`scout-core`):**

```
2026 hiring signal → archetype taxonomy → spec synthesis → fixture generation
  → WASM/local execution & byte-verify → rubric gate (1.0.1) → HIDDEN candidate
  → human batch review (studio console) → visible/approved → live
```

Every stage is a phase-scoped skill step; nothing auto-publishes (hidden-first invariant). The
~60 hand-seeded gold projects become the bar the factory learns from.

**2026 in-demand taxonomy** (flagship archetypes/discipline; factory expands each into
beginner/intermediate/advanced → ~120/discipline → 900–1000). Grounded in current hiring signal;
**a live-research validation pass refines this before locking** (see `docs/research/`).

| Course | Flagship 2026 archetypes | Tier |
|---|---|---|
| **Data Engineering** | Incremental lakehouse (Iceberg/Delta + time-travel/compaction); CDC → SCD2 marts; streaming→batch + data contracts | A/B |
| **Analytics Engineering** | Full dbt project staging→marts + tests/docs/exposures; semantic layer / MetricFlow KPIs; Kimball dimensional model | **A** |
| **SQL Mastery** | Window-function cohort/retention/funnel; query optimization & indexing; advanced CTEs + DQ assertions | **A** |
| **Python Mastery** | Typed/tested package + CLI + packaging; async data-processing service; profiling + vectorization perf | **A** |
| **Data Scientist** | Leakage-proof predictive model + experiment tracking; A/B test design + analysis; modern time-series forecasting | A/B |
| **MLOps Engineer** | Train→registry→serve→monitor + drift retraining; feature store (Feast); serving + canary (BentoML/Ray) | B/C |
| **AI Engineer** | Production RAG (ingest→embed→retrieve→generate→eval); tool-using agent workflow; AI API w/ guardrails + cost/latency | B/C |
| **Applied LLM Engineer** | LLM eval + red-team harness (LLM-as-judge); structured-output prompt pipeline; LoRA fine-tune + eval | B/C |
| **Cloud Data Engineer** | Warehouse-native pipeline + Terraform IaC; serverless ETL (Glue/Lambda/Functions); Databricks lakehouse + cost/governance | **C** |

**Sequencing rule:** flood Tier-A (Analytics-Eng, SQL, Python, much of Data-Eng) for beta — it's
gradeable, portfolio-strong, in-browser-verifiable. Tier-B/C come online with the labs epic.

---

## 7. IDE / SQL editor / cloud labs (per Decision 1, tiered)

- **Python IDE:** evolve Monaco+Pyodide into a multi-file shell over `execution-core` — file tree,
  run, test panel, package preload. Pyodide handles numpy/pandas/scikit in-browser for Tier-A.
- **SQL editor:** DuckDB-WASM is already the engine — add schema explorer, result grid, history.
  The most polished surface; lean in.
- **Local sandbox (Tier B):** a `labs-core` provider giving a reproducible local stack (Docker
  compose templates: dbt-core, LocalStack for AWS APIs, local Spark/DuckDB). Atlas grades the
  captured artifacts, not the infra.
- **BYO-cred (Tier C):** learner pastes their own free-tier key, stored **encrypted at rest,
  scoped, revocable, never Atlas-owned**. Grading = exported-artifact verification. Honesty line:
  "Atlas verified your exported output matched the expected result" — never "Atlas ran this in the
  cloud for you." Zero Atlas cloud spend; minimal credential blast radius.

---

## 8. AI tutor (Ada) + the 4 learning modes

`tutor-core` makes Ada present at every step with a **hint ladder** (escalating disclosure that
never leaks the answer key — same no-leak discipline as grading):

```
L0  nudge (restate goal, point at the relevant concept)
L1  conceptual hint (what technique, not the code)
L2  structural hint (shape of the solution / which function)
L3  worked-analogous example (different data, same pattern)
 └─ NEVER the literal expected output / validation spec / answer
```

**The 4 modes** = where Ada starts on that ladder:

| Mode | Ada behavior |
|---|---|
| **Guided** | Proactive, starts at L0–L1, walks each step |
| **Hint-based** | Reactive, learner pulls hints up the ladder |
| **Independent** | Silent unless asked; only validation feedback |
| **Adaptive** | AI picks per-learner from signals below |

**Adaptive policy (`atlas-adaptive-policy`):** collect signals (attempts/step, time-on-step,
hint-pulls, fail streaks, idle gaps) → select the mode that keeps the learner in productive
struggle. Start rules-based (transparent, debuggable), graduate to learned once cohort data
exists. Always show *why* a mode was chosen and let the learner override.

---

## 9. Ship top-of-class — the differentiators & go-to-market

Competitors teach. **Atlas proves.** Lean into the three things already built that they can't
easily copy:

1. **Verifiable, server-graded evidence** — "Atlas verified the learner's actual output matched
   the expected result." Most platforms grade nothing or trivially. This is the wedge with
   hiring managers.
2. **Portfolio-as-output** — every completion emits a GitHub-ready, leak-free repo + ZIP. The
   learner walks away with *artifacts a hiring manager can inspect*, not a certificate. Make this
   the marketing headline.
3. **Radical honesty (H3)** — never "cheat-proof," never "job guaranteed." In a market of
   inflated promises, *credible* claims are a brand moat. Keep it sacred.

**Go-to-market:** private beta → collect real completion + portfolio data → publish honest outcome
evidence → recruit a hiring-manager advisory loop that tells you which projects they actually
screen for (feeds the factory taxonomy) → public launch with proof, not promises.

---

## 10. Risks & first move

| Risk | Mitigation |
|---|---|
| Catalog hand-work doesn't scale | Factory v2 (E4) before any big wave |
| Local boot blocked (0.2) | **Do this first** — nothing else unblocks without it |
| Tutor/labs leak the answer key | Reuse the grading no-leak chokepoint + `atlas-evidence-auditor` gate |
| Taxonomy drifts from real demand | Live-research validation pass + hiring-manager advisory loop |
| Scope creep before beta | Hard cap: 100–150 Tier-A-first projects, 9 courses, ship |

**First concrete step:** **Phase 0.2 — Replit-connector decouple + clean Node-24 `pnpm dev` boot.**
It gates everything else (factory, tutor, labs all need a booting local app). **Phase 61B**
(author next WASM project) runs in parallel — pure authoring, doesn't need boot.

---

*Master plan owner: Biniyam Kebede. Cross-references: `BRD.md`, `PRD.md`, `ARD.md`, `TRD.md`,
`DESIGN.md`, `DRD.md`, `.agentic/discovery.md`, `.agentic/plan.md`. Revisit at private-beta exit
or when a locked decision changes.*
