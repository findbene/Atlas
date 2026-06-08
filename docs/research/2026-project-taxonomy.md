# Atlas — 2026 In-Demand Project Taxonomy (researched)

**Status:** Research deliverable (Item 2 of the 2026-06-08 owner run). Web-grounded via 4 parallel
research agents (DE/AE/Cloud · AI/LLM/MLOps · DS/Python/SQL · cross-cutting hiring signal),
2025–2026 sources. Synthesized + curated by the orchestrator.
**Purpose:** Ground `docs/ATLAS-MASTER-PLAN.md` §6 (the factory taxonomy) in real hiring signal and
give the authoring factory (E4) an executable, runtime-tier-prioritized backlog.
**Caveat:** Archetype demand is web-grounded; exact Pyodide/DuckDB-WASM gradeability per archetype is
an engineering claim to confirm in the factory's WASM-verify step before any project ships.

---

## 1. Three strategic findings (these change the plan)

1. **The Tier-A backbone is bigger and more concentrated than assumed.** Of the DS+Python+SQL cluster,
   **24 of 26** researched archetypes are Tier A (WASM-native, deterministic, auto-gradeable in
   DuckDB-WASM / Pyodide). Analytics Engineering (dbt-core-over-DuckDB in Pyodide) is also dense Tier A.
   → **SQL, Python, Data Science, Analytics Engineering = the auto-gradeable catalog backbone.** Flood
   these for the 100–150 beta catalog; they are exactly where Atlas's server-grade evidence loop is
   strongest.

2. **Every discipline has a deterministic "Tier-A carve-out."** Even AI Engineer / Applied LLM / MLOps /
   Cloud DE — mostly Tier B/C as whole projects — contain a deterministic sub-step that IS
   server-gradeable in Pyodide with fixtures and **no live model/cloud call**: retrieval precision/recall,
   RAG-metric math (faithfulness/NDCG), statistical tests (t-test, Mann-Whitney U, KS, PSI, JS-divergence),
   token-cost math, chunking logic, feature-transform math, Pydantic schema validation, PEFT-param math,
   embedding cosine-similarity, metric-gate computation. → **The factory can give *every* discipline a
   server-graded evidence step** by carving out the deterministic core, with the live/cloud portion graded
   as Tier-B/C artifact evidence. This is the single most important design lever to come out of the research.

3. **The H3 honesty posture is validated as correct — with a specific upgrade.** The cross-cutting pass
   found platform credentials are broadly distrusted by 2026 hiring managers (84% of HR leaders suspect
   skill exaggeration; the 85%-claim-vs-0.14%-hire skills-based-hiring paradox). What they *do* trust is a
   **narrow, falsifiable, machine-verified claim linked to an inspectable artifact**. Atlas already refuses
   to overclaim — the upgrade is to make the evidence statement *specific* ("submitted output matched the
   server-side expected result on step N of project X on [date]") and *linkable* (badge → the exact graded
   commit in the GitHub-ready repo), and to align with **Open Badges 3.0 / W3C Verifiable Credentials** for
   one-click employer verification. This is a marketing + portfolio-loop refinement, not a grading change.

---

## 2. Runtime-tier distribution → factory priority

| Discipline | Tier A density | Whole-project default tier | Beta priority |
|---|---|---|---|
| **SQL Mastery** | Very high (9/9) | A | **1 — backbone** |
| **Python Mastery** | Very high (24/26 cluster) | A | **1 — backbone** |
| **Data Science** | Very high | A (Pyodide: numpy/pandas/scikit/statsmodels/lifelines/StatsForecast) | **1 — backbone** |
| **Analytics Engineering** | High | A (dbt-core + DuckDB in Pyodide) | **1 — backbone** |
| **Data Engineering** | Mixed | A (dbt+DuckDB) / B (Docker: Kafka/Flink/Dagster) | 2 |
| **AI Engineer** | Carve-out only | B/C + Tier-A deterministic sub-step | 2 (carve-out) |
| **Applied LLM Engineer** | Carve-out only | B/C + Tier-A deterministic sub-step | 2 (carve-out) |
| **MLOps Engineer** | Carve-out only | B/C + Tier-A deterministic sub-step | 3 |
| **Cloud Data Engineer** | Carve-out only | C (BYO-cred) + Tier-A transform sub-step | 3 (needs labs) |

**Sequencing:** beta catalog (100–150) = mostly Tier-1 backbone (gradeable in-browser today) + a thin
set of Tier-2 carve-out projects to prove the per-discipline evidence step. Tier-3 (Cloud DE, full MLOps
K8s) comes online with the labs epic (E6).

---

## 3. Validated archetype backlog (factory input)

Curated from the research. Each is a flagship the factory expands into beginner/intermediate/advanced
variants. Tier = whole-project; **(A*)** = Tier-A deterministic carve-out available within a B/C project.

### SQL Mastery — all Tier A (exact deterministic rowsets; ideal server-grade)
| Archetype | Difficulty | Tier |
|---|---|---|
| Cohort retention matrix (window funcs) | Int | A |
| Funnel conversion + drop-off | Int | A |
| Top-N per group + latest-record dedup (ROW_NUMBER/RANK) | Beg–Int | A |
| Rolling metrics + period-over-period (LAG, window frames) | Int | A |
| Gap-and-island sessionization (30-min gap) | Adv | A |
| SCD Type 2 temporal range join | Adv | A |
| Query optimization + EXPLAIN rewrite | Int–Adv | A |
| Recursive CTE org hierarchy | Adv | A |
| Data-quality audit query (dup/null/RI/outlier) | Int | A |

### Python Mastery — Tier A (Pyodide; modern 2026 stack: uv/ruff/Polars/Pydantic v2/3.13)
| Archetype | Difficulty | Tier |
|---|---|---|
| Typed data-transformation package (Polars + Pydantic + pytest + packaging) | Int | A |
| Idempotent ETL pipeline (resumable, dedup) | Int | A |
| Reproducible statistical-analysis module (typed report) | Beg–Int | A |
| Web-scraping pipeline (httpx + BS4 + tenacity, fixture-served) | Beg–Int | A |
| Polars/pandas dual-backend metrics library (Protocol typing) | Int–Adv | A |
| CLI data-profiling tool (Typer + packaging, `uv tool install`) | Int | A |
| NumPy vectorization + perf benchmark | Int | A |
| Async fetcher + rate-limit/backoff | Adv | B (A with sync mock) |
| Custom data-validation framework (rule set, ValidationReport) | Int–Adv | A |

### Data Science — Tier A (Pyodide; experiment-centric, leakage-proof, modern)
| Archetype | Difficulty | Tier |
|---|---|---|
| Classification w/ leakage-proof eval (Pipeline + nested CV + calibration + SHAP) | Int | A |
| A/B test analysis (SRM check, power, effect size, CI) | Int | A |
| Churn / survival analysis (lifelines fallback for WASM) | Adv | A |
| Multi-SKU demand forecasting (Nixtla StatsForecast) | Int | A |
| Collaborative-filtering recsys (TruncatedSVD, NDCG@k, user-level split) | Adv | A |
| NLP text classification + SHAP token explanations | Int | A |
| Unsupervised anomaly detection (IsolationForest/LOF, PR curve) | Int | A |
| Causal inference / observational study (IPW/PSM via statsmodels+sklearn) | Adv | A |

### Analytics Engineering — Tier A backbone (dbt-core + DuckDB), some B/C
| Archetype | Difficulty | Tier |
|---|---|---|
| End-to-end dbt star schema + tests + docs | Beg | A |
| Semantic layer / MetricFlow metric definitions (`mf query` CSV) | Int | A |
| dbt model contracts + unit tests (data-as-code) | Int | A |
| Multi-source mart + lineage/exposures | Int | A |
| SCD Type 2 via dbt snapshots | Int | A |
| Data-quality framework (dbt tests + Elementary) | Int | A (tests) / B (report) |
| Freshness/SLA observability (Elementary) | Beg–Int | B |
| dbt + semantic-layer LLM/NL-query integration | Adv | C |

### Data Engineering — A (dbt+DuckDB) and B (local Docker)
| Archetype | Difficulty | Tier |
|---|---|---|
| ELT pipeline dbt + DuckDB → star schema + tests | Beg–Int | A |
| Pipeline CI/CD + contracts + unit tests + lineage | Int | A (dbt) / B (CI) |
| Lakehouse bronze/silver/gold on Iceberg + time-travel | Int | B |
| Orchestrated pipeline + data-quality gates (Dagster + GE) | Int | B |
| CDC → SCD2 marts (Debezium + dbt snapshots) | Int–Adv | B |
| Streaming lakehouse + Iceberg compaction (Kafka/Flink/Nessie) | Adv | B |
| Feature pipeline (DuckDB feature compute + Feast serving) | Adv | A* / B |

### AI Engineer — B/C with Tier-A carve-out (deterministic sub-step in fixtures)
| Archetype | Difficulty | Tier | Tier-A carve-out |
|---|---|---|---|
| Production RAG + eval harness (Ragas/DeepEval) | Int | B | chunking math; retrieval precision/recall@k |
| Agentic research assistant (LangGraph ReAct) | Int | C | ReAct state-transition logic w/ mocked tools |
| LLM eval pipeline (eval-as-code, CI gate) | Int | B | BLEU/ROUGE/cosine metric math |
| Structured-output extraction API (Pydantic) | Beg–Int | A* | schema validation + field accuracy vs fixtures |
| Fine-tuning (LoRA/QLoRA) | Adv | C | tokenization analysis; PEFT param math |
| Multi-agent orchestration (LangGraph) | Adv | C | graph topology validation; state-transition table |
| LLM gateway + cost control + fallback (LiteLLM) | Int | B | token-cost math; cache-threshold logic |
| Guardrails/safety layer (PII/jailbreak, OWASP LLM Top 10) | Int–Adv | B | regex PII match; schema validation; threat scoring |

### Applied LLM Engineer — B/C with Tier-A carve-out
| Archetype | Difficulty | Tier | Tier-A carve-out |
|---|---|---|---|
| Prompt registry + A/B testing | Int | B | significance-test math; prompt diff |
| RAG eval harness (Ragas + DeepEval CI) | Int | B | faithfulness / context-precision / NDCG math |
| LLM observability (OpenTelemetry + Langfuse) | Int | B | cost math; P50/P95/P99 latency computation |
| Production guardrail layer (Presidio/LLM Guard) | Int–Adv | B | regex PII; schema validation; threat scoring |
| Semantic cache + multi-provider router | Int | B | cosine-similarity cache-hit math |
| Multimodal document intelligence | Int–Adv | C | deterministic table extract + schema validation |
| Agentic/Corrective RAG (CRAG, LangGraph) | Adv | C | relevance-grading + route-decision math |
| MCP-native CI code-review agent | Adv | C | diff parse; severity classify; schema validation |

### MLOps Engineer — B/C with Tier-A carve-out
| Archetype | Difficulty | Tier | Tier-A carve-out |
|---|---|---|---|
| Training + experiment tracking (MLflow + DVC) | Beg–Int | B | best-run selection; metric comparison; Pareto |
| Containerized serving API (FastAPI + Docker + health) | Beg–Int | A* | Pydantic validation; input range checks |
| ML CI/CD + quality gates (GE + metric gate) | Int | B | data-contract validation; metric-gate math |
| Feature pipeline + store (Feast offline/online) | Int–Adv | B | feature-transform math (norm/bucket/lag) |
| Drift detection + retraining trigger (Evidently) | Int–Adv | B | PSI / KS / JS-divergence computation |
| Canary + shadow deploy (KServe + Istio) | Adv | B | A/B stats (Mann-Whitney U, MDE) |
| Self-hosted LLM inference (vLLM + Prom/Grafana) | Adv | C | throughput/memory/quantization math |
| LLMOps pipeline (prompt+model versioning, cost, eval CI) | Adv | B | cost attribution; regression-delta math |
| Kubernetes ML platform (Kubeflow/KServe + GitOps) | Adv | C | resource-quota + autoscaling-threshold math |

### Cloud Data Engineer — mostly Tier C (BYO-cred); transform sub-steps A*
| Archetype | Difficulty | Tier |
|---|---|---|
| Terraform-provisioned data platform (IaC) | Int | C |
| Databricks medallion + Unity Catalog | Int–Adv | C |
| Snowflake Dynamic Tables + Cortex | Int–Adv | C |
| AWS serverless data lake (S3+Glue+Athena+Lake Formation) | Int | C |
| Cloud streaming → Iceberg (Kinesis/Flink) | Adv | C |
| Pipeline CI/CD (GitHub Actions + dbt Cloud) | Int | A* (dbt) / B |
| Multi-cloud governance (Unity Catalog + Delta Sharing) | Adv | C |
| Cost-optimized stack + FinOps instrumentation | Int | C (transform A*) |

---

## 4. Tier-A deterministic carve-out master list (highest-value auto-grade steps)

These run in Pyodide/DuckDB-WASM with fixtures and **no live model/cloud call** — the factory should
build a server-graded step around one of these inside every Tier-B/C project:

1. Retrieval precision/recall/NDCG@k from fixture (query → retrieved → relevant)
2. RAG-metric math: faithfulness (claim-overlap), context precision, answer relevancy
3. Statistical significance: t-test, Mann-Whitney U, KS-test, PSI, Jensen-Shannon divergence
4. Token-cost math: tokens × price table → per-call cost, budget utilization, cache savings
5. Chunking logic: tokenizer-based chunk + overlap, chunk count, token distribution
6. Feature-transform math: normalization, bucketing, lag features, timestamp windowing
7. Pydantic schema validation: fixture JSON → validate → field-level error counts
8. PEFT parameter math: LoRA rank/alpha/trainable-param computation
9. Embedding cosine similarity: similarity matrix, top-k retrieval, cache-hit threshold
10. Metric-gate computation: best-run selection, baseline comparison, pass/fail gate

---

## 5. Hiring-signal → factory project-template requirements

The cross-cutting pass found what makes a project credible to a 2026 hiring manager. Bake these into the
factory's project template so every authored project lands in the "rising" quadrant:

| Requirement | Why (2026 signal) |
|---|---|
| **Architecture diagram + README business framing** | First thing screened; "30-second test"; missing diagram closes the repo |
| **Realistic/messy data** (not Titanic/Iris/MNIST) | Toy datasets are recognized on sight and kill credibility |
| **≥1 test/quality-check artifact** | No tests = "never maintained production code" red flag |
| **"What failed / what I'd do differently" section** | The single strongest anti-AI-slop authenticity signal in 2026 |
| **Reproducible setup** (pinned deps, seed, `.env.example`) | Reproducibility is the proxy for production discipline |
| **Genuine multi-step commit history** | Bulk single-commit repos read as "copied and uploaded" |
| **Eval artifact for AI/LLM projects** | "RAG without evals" is the new red flag; eval = #1 LLM-experience signal |
| **Cost-per-run estimate for agent/LLM projects** | Cost literacy is a named, premium-paid specialization |
| **Documented tradeoff decisions** ("chose X over Y because Z") | Hard to fake; reads senior regardless of level; answers the "can you explain it" screen |
| **Narrow, linkable completion claim** | "output matched server-side expected result on step N" + link to graded commit |

The "can you explain it" problem (AI assistants everywhere) means 2026 hiring probes *ownership*, not
authorship. Atlas projects that require a written design-rationale + failure-analysis deliverable
alongside code are structurally harder to fake than clean code — exactly what differentiates an Atlas
project from a raw GitHub dump. (Atlas grades the output, honestly; the learner explains the process in
the interview — and the project taught them how.)

---

## 6. Recommendation for the beta catalog (100–150 projects)

- **~70% Tier-1 backbone** (SQL, Python, Data Science, Analytics Engineering) — auto-gradeable today in
  DuckDB-WASM / Pyodide, strongest evidence loop, fastest to author + verify.
- **~20% Tier-2 carve-out** (Data Engineering dbt+DuckDB; one AI/LLM/MLOps project per discipline built
  around a Tier-A deterministic step) — proves the per-discipline server-graded evidence pattern.
- **~10% Tier-3 placeholder/authored-dark** (Cloud DE, full MLOps) — authored hidden, unlocked when the
  labs epic (E6) ships BYO-cred + local-sandbox providers.
- Every project carries the §5 template requirements. Every flipped server-grade row follows the existing
  dark-ship + BC-audit + browser-WASM byte-verify discipline (no naive flips).

This keeps the beta catalog on the projects Atlas can *prove*, across all 9 courses, while the labs epic
unlocks the cloud-heavy tail.

---

## 7. Sources (consolidated)

Data Engineering / Analytics / Cloud: Data Engineer Academy 2026 portfolio checklist; The Data Forge
senior-DE-portfolio-2026; dataexpert.io DE/Databricks portfolio; Iceberg Lakehouse 2026 guide;
analyticsengineering.com; StackFYI semantic-layer 2026; dbt Labs Semantic Layer docs; Terraform-for-DE
(DE Academy); folio3 cloud-data 2026.
AI / LLM / MLOps: DEV "5 AI portfolio projects 2026"; AgenticCareers; LLMOps Engineer (Second Talent);
MLOps Roadmap 2026 (MLOps Lab); RAG Evaluation 2026 (DatavLab); RAGAS/TruLens/DeepEval (Atlan); Agentic
AI hiring boom 280% (JobsByCulture); MCP 2026 guide (SurePrompts); vLLM Prometheus/Grafana (DEV); KServe
vs Seldon vs BentoML (Spheron); fine-tuning LoRA/QLoRA/PEFT (Introl).
Data Science / Python / SQL: 365 Data Science job market 2026; Careery DS/analyst portfolio 2026;
"Causal inference is eating ML" (TDS); DuckDB retention cohorts (Jan–Feb 2026, multiple); DuckDB-WASM
tutorial (LakeClient); StrataScratch dedup; Dataquest 60 SQL questions 2026; sql-practice.online;
DataDriven SCD; KDnuggets Python tooling 2026 (uv/ruff/ty/Polars); AlgoMart "year of Polars 2026";
Nixtla StatsForecast; Glinteco Pyodide 2026.
Cross-cutting hiring signal: dbt Labs 2026 State of Analytics Engineering; Sertifier skills-based-hiring
2026 + credentials 2026; vbeyond credible-tech-portfolio 2026; learnist AI/Kaggle red-flags 2026; Karat
detect-AI-in-interviews; Exponent Google AI-coding-interview 2026; alexeygrigorev AI-engineering field
guide Q4'25/Q1'26; Fortune/Coursera microcredential 2026; HeroHunt fastest-growing AI roles 2026.

*(Full per-archetype source URLs are in the run's research-agent transcripts.)*
