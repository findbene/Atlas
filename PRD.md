# Atlas — Product Requirements Document

**Version:** 1.0-draft  
**Status:** Pre-beta (Phase 0 foundation)  
**Scope:** Product lens — the WHAT and WHY for users. Business model → BRD.md. Architecture decisions → ARD.md. Technical specifications → TRD.md. Visual design → DESIGN.md. Strategic finish-to-beta plan → docs/ATLAS-MASTER-PLAN.md.  
**Last updated:** 2026-06-05  

---

## Table of Contents

1. [Overview and Vision](#1-overview-and-vision)
2. [Problem Statement](#2-problem-statement)
3. [Goals and Non-Goals](#3-goals-and-non-goals)
4. [Target Users and Personas](#4-target-users-and-personas)
5. [The Learning Experience](#5-the-learning-experience)
6. [Feature Requirements](#6-feature-requirements)
7. [User Stories](#7-user-stories)
8. [Catalog Scale and Difficulty Tiers](#8-catalog-scale-and-difficulty-tiers)
9. [Success Metrics](#9-success-metrics)
10. [Release Scope and Milestones](#10-release-scope-and-milestones)
11. [Open Questions and Dependencies](#11-open-questions-and-dependencies)

---

## 1. Overview and Vision

Atlas is a project-based learning platform that takes learners from zero to job-ready across nine technical disciplines:

- Data Engineering
- AI Engineering
- MLOps Engineering
- Data Science
- Analytics Engineering
- Applied LLM Engineering
- Cloud Data Engineering
- Python Mastery
- SQL Mastery

**The central thesis:** Learners become credible by completing realistic, portfolio-grade projects with guided support, progressive hints, honest validation, evidence-backed completion records, and recruiter-readable artifacts — not by watching videos or passing multiple-choice quizzes.

**Five guiding principles:**

1. **Project-first** — every learning unit is a concrete project with a real scenario, not a lecture.
2. **Honest validation** — the platform states clearly what it checks and what it does not. No overclaiming.
3. **Progressive autonomy** — learners choose how much scaffolding they want, and the platform adapts to their demonstrated performance over time.
4. **Recruiter-readable outcomes** — completions produce artifacts that a hiring manager can inspect: dbt models, CDC pipelines, RAG systems, feature stores, model monitoring dashboards.
5. **Production credibility** — projects use real tools, real data shapes, and real engineering patterns, not toy exercises.

Atlas is a Progressive Web App (PWA) — designed to be installable and usable on any device, with offline capability planned for the beta milestone.

---

## 2. Problem Statement

### The passive learning trap

Technical learners have abundant access to courses, tutorials, and documentation. What they lack is a bridge between "I watched the videos" and "I can demonstrate I can do this work." The dominant learning formats — recorded lectures, quizzes, copy-paste tutorials — produce learners who recognize concepts but cannot apply them under realistic conditions.

### The portfolio credibility gap

Entry-level and career-switching candidates arrive at interviews with course completion certificates that hiring managers have learned to discount. The certificates attest to watching, not to doing. A learner who completed a dbt course cannot automatically show a recruiter a working dbt project with real transformations, tests, and documentation.

### The scaffolding mismatch

Most platforms offer either too much scaffolding (step-by-step walkthroughs that produce the answer before the learner struggles) or too little (open-ended projects with no support when learners get stuck). Neither serves the learner who needs challenge calibrated to their current level.

### The validation honesty gap

Platforms that do have project grading often overclaim what they verify. Checking that code ran is not the same as checking that it produced the right output. Checking that output matches a string is not the same as verifying independent authorship. Atlas treats these distinctions as first-class product requirements, not fine print.

### What Atlas does differently

Atlas builds demonstrable job readiness by combining:
- Realistic, scenario-grounded projects that produce recognizable artifacts
- In-browser execution (Python via Pyodide, SQL via DuckDB) so learners run real code
- Ada, an AI tutor aware of the learner's current step, mode, and progress
- Four calibrated learning modes so scaffolding matches the learner's need
- A `/check` (practice, no record) vs. `/submit` (durable evidence) discipline that is honest about what each does
- Evidence-backed completion records and public verification pages — stated accurately, without overclaiming
- Portfolio output designed for GitHub and LinkedIn sharing (planned for v1.0)

---

## 3. Goals and Non-Goals

### Beta goals (private beta → v1.0)

- Deliver an end-to-end project completion experience: enroll, work in the editor, get Ada's help, check output, submit evidence, receive a certificate with a public verification URL.
- Reach 100–150 visible, audited projects across all 9 disciplines, with at least 20 flagship portfolio projects.
- Harden or honestly classify all 9 validation kinds so the platform never silently passes work it did not check.
- Validate that Ada works correctly across all 4 learning modes (guided, hint, independent, dynamic_ai_adaptive).
- Complete the /check vs. /submit separation so provisional practice feedback is never confused with durable evidence.
- Deploy a stable production environment with functional auth, onboarding, and billing.
- Enable beta learners to complete projects without internal intervention.
- Ship the real PWA (installable, offline shell, Pyodide/DuckDB asset caching).
- Enable portfolio evidence to be exported to GitHub and shared to LinkedIn.

### Non-goals for beta

- Public marketing site and public launch (deferred to E7 per decision D3)
- Real cloud credential flows (AWS/Azure/GCP/Databricks/Snowflake) with live billing — sandbox-simulation first per decision D2
- Performance-driven adaptive mode (rule-based resolver ships for beta; skill-model-driven version is planned post-beta, see Section 6)
- Employer/team dashboards and admin reporting for organizations
- Diagnostic assessment at onboarding (planned for E3, post-beta)
- Prerequisite graph between projects (planned for E3)
- Mobile-native apps (PWA installability covers this use case)

---

## 4. Target Users and Personas

### Persona 1 — The Career Switcher

**Background:** Works in a non-technical field (finance, operations, marketing). Has completed one or two online Python or SQL courses. Understands basic syntax but has never shipped anything a technical team would recognize as real work.

**Goal:** Build a portfolio of 4–6 project completions across data engineering and analytics engineering that a recruiter will credit as genuine experience. Land a junior data engineer or analytics engineer role within 12 months.

**Pain points:**
- Tutorials produce toy outputs; they do not know if they could do this on real data
- No way to demonstrate project work during interviews — "I completed a Udemy course" does not satisfy technical screen questions
- Gets stuck without knowing why, and has no one to ask

**What success looks like on Atlas:** Completes a dbt data models project, a CSV-to-Postgres pipeline, and a SQL analytics project. Has a public verification URL and a GitHub repo with the project artifact they can point to in applications.

### Persona 2 — The Junior Analyst Leveling Up

**Background:** 1–2 years as a business analyst or data analyst. Comfortable with SQL, Excel, basic Python. Wants to move into a data engineering or analytics engineering role at their current company or elsewhere.

**Goal:** Demonstrate command of dbt, data pipeline design, and data modeling — the skills that distinguish an analytics engineer from a reporting analyst.

**Pain points:**
- Knows SQL well but has never built a real dbt project with tests, documentation, and a CI check
- Does not need guided hand-holding but wants to check their work against a real standard
- Available time is limited — needs to learn during evenings and weekends

**What success looks like on Atlas:** Completes intermediate and advanced analytics engineering projects in independent mode. Earns a certificate that represents something a hiring manager at their target company would recognize as real portfolio work.

### Persona 3 — The Aspiring AI/LLM Engineer

**Background:** Software developer or data scientist with Python fluency. Has used LLM APIs but has not built production-grade LLM systems: RAG pipelines, structured output guardrails, evaluation frameworks, agentic architectures.

**Goal:** Build project evidence of applied LLM engineering skills — specifically the production patterns that distinguish a junior LLM engineer from someone who has called the OpenAI API a few times.

**Pain points:**
- Most LLM tutorials are demos, not engineering projects — they do not handle errors, evals, or real data shapes
- Wants to learn at their own pace without scaffolding but needs Ada available when genuinely stuck on a concept
- Existing courses do not produce artifacts they can show to a technical interviewer

**What success looks like on Atlas:** Completes RAG system, structured-output guardrails, and model evaluation projects in independent or hint mode. Has a GitHub repository with each project artifact that a technical hiring manager can read and evaluate.

### Persona 4 — The MLOps Learner

**Background:** Has an ML background — familiar with model training and scikit-learn/PyTorch. Has not worked with MLOps infrastructure: model registries, deployment pipelines, monitoring, drift detection, CI/CD for ML.

**Goal:** Transition from "person who trains models in notebooks" to "person who can deploy and monitor models in production." Targeting MLOps engineer or ML platform roles.

**Pain points:**
- MLOps requires standing up infrastructure (registries, pipelines, monitoring dashboards) that is hard to practice without a real environment
- Gets lost in tool sprawl — does not know which tools matter for which patterns
- Needs structured project sequences, not isolated tutorials

**What success looks like on Atlas:** Completes model serving, monitoring, and CI/CD pipeline projects. Understands the production MLOps patterns well enough to discuss them in a systems design interview.

### Persona 5 — The SQL/Python Foundations Learner

**Background:** Early career or career changer. Beginner to intermediate coder. May have some exposure to Python or SQL but has not used either to solve real data problems.

**Goal:** Build genuine fluency in Python and SQL through projects, not syntax drills. Reach the point where they can take on analytics work professionally.

**Pain points:**
- Syntax-focused tutorials produce learners who can complete fill-in-the-blank exercises but freeze in front of a real problem
- Wants to understand why, not just what — gets frustrated by tutorials that do not explain the reasoning
- Needs encouragement and scaffolding but also wants to be challenged

**What success looks like on Atlas:** Completes a sequence of Python Mastery and SQL Mastery projects at beginner and intermediate tiers. Gains enough confidence to apply for junior analyst or data analyst roles.

---

## 5. The Learning Experience

This section describes the end-to-end user journey as a learner experiences it today (built) and as it will work at v1.0 (planned items marked).

### Step 1 — Choose a role path

The learner arrives at the catalog and selects a discipline (e.g., Data Engineering, Applied LLM Engineering, SQL Mastery). Each discipline has a role path describing what the learner will be able to do at the end and what projects are available.

At v1.0, a diagnostic assessment will ask the learner a short set of questions to recommend a starting project and difficulty tier based on their background. *(planned — E3)*

### Step 2 — Review the project catalog and enroll

The learner browses 60 available projects (growing to 100–150 at v1.0). Each project shows:
- Discipline and difficulty tier (beginner / intermediate / advanced)
- Estimated completion time
- Skills and tools used
- The portfolio artifact the project produces

The learner enrolls in a project. Enrollment is tracked; the learner can return to in-progress projects from their dashboard.

### Step 3 — Select a learning mode

Before entering the project workspace, or at any time during the project, the learner selects one of four modes:

- **Guided** — Ada provides proactive scaffolding after each step. Suited to learners new to the topic or to the project type.
- **Hint** — Ada is available when asked; a progressive hint ladder (5 levels) is always accessible. Suited to learners who want to try independently but want a fallback.
- **Independent** — Ada provides diagnostic questions only (Socratic, non-revealing) when the learner asks. No proactive scaffolding. Suited to learners who want to test themselves.
- **Dynamic AI adaptive** — the platform selects the appropriate underlying mode based on the learner's signals (attempt counts, hint usage, step completion rate). At beta, this resolves deterministically using rule-based logic. A skill-model-driven version is planned for post-beta. *(adaptive resolver: built — rule-based; performance-driven version: planned — E3)*

An adaptive recommender suggests a mode based on the learner's history and current performance signals. The learner can override the recommendation at any time.

### Step 4 — Work in the project workspace

The workspace contains:
- **Instructions panel** — the step description, scenario context, expected output, and acceptance criteria
- **Editor** — Monaco-based code editor with Python (Pyodide, runs in-browser) or SQL (DuckDB-WASM, runs in-browser)
- **Output panel** — the result of running the learner's code
- **Hint ladder** — up to 5 progressive hints per step, each providing more specific guidance without revealing the solution
- **Ada** — the AI tutor, available via chat. Ada knows the current project, current step, current mode, the learner's attempt count, and whether the step has been passed. Ada's behavior is governed by a per-step tutor contract that enforces the help boundary for the current mode.
- **Remediation panel** — shown after a failed check, displaying the expected output (where available) against the learner's output

Cloud lab workspaces with sandbox-simulated AWS, GCP, Snowflake, and Databricks environments are planned for E5. The sandbox approach uses mock APIs backed by DuckDB and fixture data — no real cloud credentials are involved. *(planned — E5)*

### Step 5 — Check and submit

The workspace distinguishes between two actions:

- **/check** — runs the learner's submission against the validation rules for the step, returns feedback (pass or fail with explanation), and records nothing durably. The learner can iterate without consequence.
- **/submit** — commits the result as a durable, evidence-backed completion record. On a passing submit, the step is marked complete, XP is awarded, and the evidence is recorded. Celebration and auto-advance only fire on a committed passing submit, never on a provisional check.

This distinction is surfaced clearly in the UI: check results are labeled "Provisional" and submit results are labeled with a completion confirmation.

What Atlas validates honestly varies by validation kind:
- Some steps are server-enforced (exact match, contains, regex, numeric tolerance) — the server actually checks the submission.
- Some steps are client-provisional (SQL steps: the in-browser runner checks the output; the server records the step as complete) — the UI gives accurate feedback; the server does not re-check.
- Some steps are contract-shaped (Python steps producing structured output that requires a local environment to verify) — the platform shows the expected output clearly so the learner knows the standard; the server records completion.
- Some steps are self-attested (reflection, explanation) — the learner marks complete intentionally.

The platform labels each step's validation behavior accurately. It does not represent contract-shaped or client-provisional steps as server-enforced.

Validation kinds: `exact`, `contains`, `regex`, `numeric_tolerance`, `csv_set_equal`, `csv_ordered`, `json_equal`, `sql_resultset`, `self_attest`. (9 kinds total)

### Step 6 — Earn a certificate and portfolio artifact

On project completion, the learner receives:
- A certificate with a public verification URL (`/verify/:certId`) — anyone with the link can see the learner's name, the project title, the course, the difficulty, and evidence metadata
- A portfolio evidence record on their certificates page and profile — showing steps completed, evidence-backed completions, XP earned, and duration
- Access to the portfolio artifact the project specified (README, setup instructions, sample output, skills demonstrated)

GitHub export (push the project artifact to the learner's own GitHub repository) and LinkedIn sharing are planned for v1.0. *(planned — E2)*

### Step 7 — Continue on the path

The dashboard shows in-progress projects, completed projects, XP, streak, and leaderboard standing. The learner continues to the next project in their chosen discipline or explores other disciplines.

A prerequisite graph between projects that guides learners to appropriate next steps is planned for E3. *(planned — E3)*

---

## 6. Feature Requirements

Features are grouped by functional area. Each entry includes: requirement summary, current status (built / planned), and priority for beta (P0 = must-have for beta launch; P1 = important for beta quality; P2 = valuable, can follow beta).

### 6.1 Curriculum and Projects

| Feature | Requirement | Status | Beta Priority |
|---|---|---|---|
| 9-discipline catalog | Projects organized under 9 courses with role-path framing and consistent metadata | Built | P0 |
| 60 visible projects | Current catalog baseline | Built | P0 |
| 100–150 visible projects | v1.0 target; ≥20 flagship projects | Planned (E4) | P0 |
| Difficulty tiers | Each project tagged beginner / intermediate / advanced; filter and display in catalog | Built | P0 |
| Project metadata | Each project shows scenario, tools, skills, portfolio artifact, estimated time, step count | Built | P0 |
| Flagship portfolio projects | ≥20 projects producing recruiter-recognized artifacts (dbt models, CDC pipelines, RAG systems, feature stores, model monitoring, structured-output guardrails) | Planned (E4) | P0 |
| Hidden-first publishing | New projects ship hidden (`learner_visible=false`); promoted only after author review and quality audit | Built | P0 |
| Authoring factory | Job-signal-driven generation pipeline: market scout → generate candidates → rubric score → owner review → promote | Planned (E4) | P1 |
| Diagnostic assessment | Short questionnaire at onboarding to recommend a starting project and difficulty tier | Planned (E3) | P2 |
| Prerequisite graph | Guided "next project" recommendations based on completions and skill signals | Planned (E3) | P2 |

### 6.2 Workspace and Editors

| Feature | Requirement | Status | Beta Priority |
|---|---|---|---|
| Python editor | Monaco-based editor; Pyodide in-browser execution; output panel | Built | P0 |
| SQL editor | Monaco-based editor; DuckDB-WASM in-browser execution; tabular output | Built | P0 |
| Instructions panel | Step-by-step instructions, scenario context, expected output, acceptance criteria | Built | P0 |
| Remediation panel | Post-check display of expected vs. actual output; mode-aware detail level | Built | P0 |
| Hint ladder | Up to 5 progressive hints per step; each level more specific; level persisted per learner | Built | P0 |
| Run button | Executes code in-browser; displays output; feeds provisional check if applicable | Built | P0 |
| Auto-resume | Learner returns to a project and lands on their last in-progress step | Built | P0 |
| Cloud labs (sandbox) | Mock S3/Glue/Athena, GCS/BigQuery, Snowflake, Databricks backed by DuckDB and fixture data; no real cloud credentials | Planned (E5) | P1 |
| BYO real-cloud extension | Security spec for learners providing their own cloud credentials; gated behind sandbox phase | Planned (E5, post-beta) | P2 |
| PWA installability | Web app manifest, service worker, offline shell, Pyodide/DuckDB asset caching | Planned (E6) | P0 |

### 6.3 Ada AI Tutor and Learning Modes

| Feature | Requirement | Status | Beta Priority |
|---|---|---|---|
| Ada AI tutor | SSE-streaming chat tutor; context-aware (project, step, mode, attempts, hint level, step pass state) | Built | P0 |
| Model tiering | Haiku model for free tier; Sonnet model for pro tier | Built | P0 |
| 4 learning modes | guided / hint / independent / dynamic_ai_adaptive — selectable per project, persistent | Built | P0 |
| Per-mode tutor contract | Structured per-step contract governing Ada's help boundary for each mode; enforced in system prompt outside learner-controlled context | Built | P0 |
| Adaptive resolution | dynamic_ai_adaptive resolves to a concrete underlying mode at request time using rule-based signals (attempt count, hint level, step pass state); never leaves Ada with an ambiguous mode | Built (rule-based) | P0 |
| Mode selector UX | Accessible mode picker in workspace; adaptive recommender suggests a mode; learner can override | Built | P0 |
| Performance-driven adaptive | Replace rule-based resolver with skill-model signals (attempts, hint usage, error categories, completion rate) for more accurate mode selection | Planned (E3) | P2 |
| Independent sub-modes | Pre-pass: Socratic/diagnostic only, no solution reveal. Post-pass: review-permissive (solution discussion allowed). Enforced by tutor contract. | Built | P0 |
| General-context Ada | Ada available outside step context for general questions | Built | P0 |

### 6.4 Validation, /check vs. /submit, and Evidence Integrity

| Feature | Requirement | Status | Beta Priority |
|---|---|---|---|
| /check endpoint | Practice run: server validates, returns feedback, writes nothing durably | Built | P0 |
| /submit endpoint | Durable commit: transactional, idempotent, writes evidence record on pass | Built | P0 |
| Check/submit state machine | Client-side reducer ensures confetti and auto-advance fire only on committed passing submit, never on provisional check; late async responses after step change drop silently | Built | P0 |
| 9 validation kinds | exact, contains, regex, numeric_tolerance, csv_set_equal, csv_ordered, json_equal, sql_resultset, self_attest | Built | P0 |
| Enforced server validation | exact, contains (Phase 56 structured multi-needle matcher), regex, numeric_tolerance — server actually checks submission | Built | P0 |
| Client-provisional validation | sql_resultset, csv_set_equal, csv_ordered — DuckDB-WASM checks output on Run; server records completion; UI labels results accurately | Built | P0 |
| Contract-shaped validation | json_equal, numeric_tolerance for Python steps — expected output published in instructions; server records completion; honest labeling | Built | P0 |
| Honest validation labeling | Platform never represents contract-shaped or client-provisional steps as server-enforced | Built | P0 |
| csv_set_equal server grading | Server-side grader for CSV comparison shipped dark (no live rows opt in); opt-in via spec flag for pilot projects | Built (dark) | P1 |
| Signed run-result envelopes | Infrastructure for capturing and signing Pyodide/DuckDB run output server-side; enables future server enforcement of json_equal and numeric_tolerance for Python steps | Built (canary) | P1 |
| sql_resultset server hardening | Server-side SQL result enforcement using signed envelope | Planned (E1) | P1 |

### 6.5 Certificates, Portfolio, and Sharing

| Feature | Requirement | Status | Beta Priority |
|---|---|---|---|
| Completion certificates | Issued on project completion; include project title, course, difficulty, learner name | Built | P0 |
| Public verification page | `/verify/:certId` — publicly accessible; shows learner name, project, course, difficulty, evidence metadata; no overclaiming language | Built | P0 |
| Portfolio evidence surface | Authenticated learner view on `/certificates` and `/profile` showing completion records, evidence-backed counts, XP, duration, verify links | Built | P0 |
| Evidence-backed completion language | Completion records described as "evidence-backed completion records" — never "cryptographically attested," "verified authorship," or "tamper-proof" | Built | P0 |
| GitHub export | One-click export of project artifact (README, setup, run instructions, sample output, skills) to learner's GitHub repository | Planned (E2) | P0 |
| LinkedIn share | Share certificate or portfolio artifact to LinkedIn | Planned (E2) | P1 |
| Portfolio artifact contract | Standard deliverable format for exported artifacts: scenario, setup, run instructions, sample output, skills demonstrated, share-safe text | Planned (E2) | P0 |
| Print-ready certificate | Dedicated print-optimized certificate page | Planned (follow-up) | P2 |

### 6.6 Cloud Labs (Planned)

Cloud labs are planned for E5. They are documented here for scoping clarity.

| Feature | Requirement | Status | Beta Priority |
|---|---|---|---|
| Sandbox-simulation environment | Mock AWS S3, Glue, Athena; GCS, BigQuery; Snowflake; Databricks Delta — all backed by DuckDB and fixture data; no real cloud credentials required | Planned (E5) | P1 |
| Per-provider mock surfaces | Activation profiles per provider; deterministic mock IAM; fixture data sets | Planned (E5) | P1 |
| Cloud-flavored project content | Projects using sandbox environment cover realistic AWS, GCP, Snowflake, Databricks workflows | Planned (E5) | P1 |
| BYO-cloud security spec | Document-only specification for learners providing real credentials: credential vault design, least-privilege templates, cost guardrails, teardown procedure. No real credential flows until spec is complete. | Planned (E5) | P2 |

Cross-reference: cloud lab architecture decisions → ARD.md. Security design → TRD.md.

### 6.7 Onboarding, Dashboard, and Gamification

| Feature | Requirement | Status | Beta Priority |
|---|---|---|---|
| Onboarding flow | Guided first-run experience; role/goal selection; recommended starting project | Built | P0 |
| Dashboard | In-progress projects, completed projects, XP total, streak, enrollment counts | Built | P0 |
| XP system | XP awarded per step completion and project completion; displayed on dashboard and leaderboard | Built | P0 |
| Streak tracking | Daily learning streak; displayed on dashboard | Built | P0 |
| Leaderboard | XP-based leaderboard; learner can see their rank | Built | P0 |
| Mastery tracks | Python Mastery and SQL Mastery tracks with separate progress tracking | Built | P0 |
| Enrollment counter | Tracks and displays enrollment counts per project | Built | P0 |
| Adaptive mode recommendation | Recommends a learning mode on project entry based on learner history and signals | Built | P0 |
| Diagnostic assessment | Structured onboarding questionnaire producing a recommended project and tier | Planned (E3) | P2 |

---

## 7. User Stories

### US-01 — Career switcher completes first project

**As a** career switcher with basic Python knowledge,  
**I want to** enroll in a beginner data engineering project, work through it in guided mode, and receive a certificate with a public verification URL,  
**so that** I have a concrete, shareable completion record to include in job applications.

**Acceptance criteria:**
- Learner can enroll from the catalog and land in the project workspace
- Guided mode: Ada provides proactive scaffolding after each step without revealing the answer upfront
- /check returns feedback without recording anything durable; UI labels result "Provisional"
- /submit on a passing step records the completion; confetti fires only on committed pass
- On project completion, a certificate is issued with a `/verify/:certId` URL that works publicly
- The public verify page shows the learner's name, project, course, difficulty, and evidence metadata — and uses no overclaiming language

### US-02 — Learner gets unstuck with the hint ladder

**As a** learner in hint mode who cannot figure out a SQL aggregation step,  
**I want to** request progressive hints that guide me toward the answer without giving it away,  
**so that** I solve the step myself and understand why the solution works.

**Acceptance criteria:**
- Hint button is visible in the workspace; current hint level is shown
- Each hint request reveals a more specific clue; level 1 is a conceptual nudge; level 5 is near-explicit but stops short of the solution
- Hint level is persisted per learner per step — returning later shows the same level
- Ada in hint mode does not reveal the solution unprompted; the tutor contract enforces the progressive-hints boundary

### US-03 — Experienced learner works independently

**As a** junior analyst with SQL experience who wants to test myself,  
**I want to** complete a project in independent mode where Ada gives diagnostic questions rather than answers,  
**so that** my completion reflects genuine capability, not guided hand-holding.

**Acceptance criteria:**
- Learner can select independent mode before or during the project
- Ada in independent mode (step not yet passed) responds with Socratic questions, not solutions; the "Do NOT reveal the full solution" clause is enforced
- Ada in independent mode (step passed) enters review-permissive mode and can discuss the solution and alternatives
- The mode selector shows independent as currently active; learner can switch modes at any time

### US-04 — Learner uses /check to iterate before committing

**As a** learner who wants to test my SQL query before submitting,  
**I want to** click Check to get feedback without recording a result,  
**so that** I can iterate freely without affecting my completion record.

**Acceptance criteria:**
- Check button is visible; click triggers /check and returns feedback labeled "Provisional"
- No XP is awarded, no completion is recorded, no celebration fires on a check pass
- Learner can edit and check multiple times
- Clicking Submit after a passing check commits the result durably; confetti and auto-advance fire exactly once

### US-05 — Learner views portfolio evidence

**As a** learner who has completed three projects,  
**I want to** see my evidence-backed completion records in one place with verify links,  
**so that** I can share the right URL when a recruiter asks for proof of my project work.

**Acceptance criteria:**
- `/certificates` page shows completed projects with evidence-backed completion chip, XP, duration, and a "Verify" link
- `/profile` page shows an evidence summary per completed project with a "View portfolio" link
- Evidence language uses "evidence-backed completion record" — never "cryptographically attested" or "tamper-proof"
- Public `/verify/:certId` URL is accessible without login and shows no private data (no email, no internal IDs, no submission content)

### US-06 — Learner installs Atlas as a PWA

**As a** learner who works on a commute with unreliable internet,  
**I want to** install Atlas to my home screen and load my in-progress project without a full network connection,  
**so that** I can continue learning during offline periods.

**Acceptance criteria (planned — E6):**
- Atlas shows an install prompt on compatible browsers
- Installed PWA loads the app shell offline
- Pyodide and DuckDB-WASM assets are cached so the in-browser editor works without a network request
- Active project instructions are available offline

### US-07 — Learner exports a project to GitHub

**As a** learner who has completed an applied LLM engineering project,  
**I want to** export the project artifact to my GitHub repository with one click,  
**so that** I have a recruiter-readable repository I can link in my resume.

**Acceptance criteria (planned — E2):**
- Export button is available on the project completion page and portfolio
- The exported artifact includes: scenario and README, setup instructions, run instructions, sample output, skills demonstrated
- The GitHub repository is created (or updated) in the learner's account with the artifact contents
- The export does not include Ada chat history, submission source code, or internal Atlas IDs

### US-08 — Adaptive mode learner receives automatic scaffolding adjustment

**As a** learner in adaptive mode who has failed the same step three times,  
**I want to** have the platform automatically shift toward more guided support,  
**so that** I get the help I need without having to manually switch modes.

**Acceptance criteria:**
- Adaptive mode resolves to guided-rescue mode when attempt count ≥ 2 AND last validation failed; this triggers guided-style Ada behavior on the next tutor request
- The mode selector shows the resolved effective mode (not just "adaptive")
- The learner can still manually override to any mode at any time

### US-09 — Learner completes a cloud data engineering project in the sandbox

**As a** cloud data learner who wants to practice with AWS S3 and Glue,  
**I want to** complete a project that runs against a realistic sandbox environment,  
**so that** I understand the workflow without needing an AWS account or risking cloud costs.

**Acceptance criteria (planned — E5):**
- Cloud-flavored projects run against mock S3, Glue, and Athena surfaces backed by DuckDB and fixture data
- The workspace clearly labels the environment as a sandbox simulation, not a live cloud connection
- The project produces a portfolio artifact describing the workflow and tools used
- No real cloud credentials are requested or stored

### US-10 — New learner receives a mode recommendation

**As a** learner starting my first project on Atlas,  
**I want to** receive a recommended learning mode based on my background,  
**so that** I do not start with the wrong level of scaffolding.

**Acceptance criteria:**
- On project entry, the mode selector shows a recommended mode with a brief reason (e.g., "You're new here — guided mode will give you proactive support")
- The learner can accept the recommendation or choose a different mode
- "Choose for me" CTA is not shown when the recommendation matches the current mode or when the recommender returns stay-the-course

### US-11 — Admin reviews project quality before promotion

**As a** curriculum admin reviewing a generated candidate project,  
**I want to** see the project's rubric score, validation kind breakdown, and pedagogy audit before I promote it to visible,  
**so that** only projects meeting the quality bar reach learners.

**Acceptance criteria:**
- Candidate projects ship hidden (`learner_visible=false`) automatically
- Admin review surface shows rubric score (threshold: ≥70), pedagogy audit pass/fail, validation kind classification (enforced / client-provisional / contract-shaped), and any authoring advisories
- Promotion to visible requires explicit admin approval
- Lineage (candidate → project) is recorded atomically; archived projects are hidden, never deleted

### US-12 — Learner completes a project in Python Mastery track

**As a** Python foundations learner starting from beginner level,  
**I want to** complete a sequence of Python Mastery projects that progressively build my skills,  
**so that** I develop genuine fluency through practice rather than passive reading.

**Acceptance criteria:**
- Python Mastery track is visible in the catalog with beginner, intermediate, and advanced tiers
- Each beginner project is completable in 60–150 minutes; instructions include scenario context and clear expected outputs
- Step validation for beginner Python steps uses enforced kinds (exact, contains, regex) where possible so the learner gets real feedback
- On completion, learner's Python Mastery track progress is reflected on their dashboard

---

## 8. Catalog Scale and Difficulty Tiers

### Scale targets

| Milestone | Visible projects | Notes |
|---|---|---|
| Current (Phase 57A) | 60 | ~5–6% of ceiling |
| v1.0 / private beta launch | 100–150 | ≥20 flagship portfolio projects |
| Serious public launch | 300–400 | ~50 per major discipline |
| Long-term ceiling | ~960–1,000 | Full catalog |

Projects are grown through the curriculum factory (E4): market-signal research → candidate generation → rubric scoring (threshold ≥70) → owner review → promotion. The factory runs continuously once E0 and E1 are complete.

### Difficulty tiers

| Tier | Steps per project | Estimated completion time | Learner profile |
|---|---|---|---|
| Beginner | 4–6 steps | 60–150 minutes | New to the discipline; first exposure to core tools |
| Intermediate | 6–8 steps | 180–360 minutes (3–6 hours) | Familiar with basics; building realistic workflows |
| Advanced | 8–12 steps | 360–720 minutes (6–12 hours) | Experienced; producing production-grade artifacts |

### Flagship projects

A flagship project is an advanced project that produces a recruiter-recognized artifact. Examples by discipline:

- **Data Engineering:** CDC pipeline with Debezium, CSV-to-Postgres pipeline with quality checks
- **Analytics Engineering:** dbt data models with tests and documentation, semantic layer with Cube
- **Applied LLM Engineering:** RAG system with retrieval evaluation, structured-output guardrails, agentic workflow with tool use
- **MLOps Engineering:** model monitoring with drift detection, CI/CD pipeline for ML, feature store
- **Cloud Data Engineering:** serverless ETL on sandbox-AWS, streaming pipeline on sandbox-GCP *(planned — E5)*
- **Data Science:** end-to-end modeling project with feature engineering and evaluation
- **AI Engineering:** production LLM inference with latency/cost tracking, embedding pipeline
- **Python Mastery / SQL Mastery:** capstone projects demonstrating advanced patterns

### Coverage balance requirement

The curriculum factory tracks coverage gaps per discipline and tier. The v1.0 catalog must not be concentrated in one or two disciplines. All 9 disciplines must have at least beginner and intermediate tier coverage.

---

## 9. Success Metrics

### Beta activation

| Metric | Description | Target (beta) |
|---|---|---|
| Onboarding completion rate | % of registered users who complete the onboarding flow and enroll in a first project | ≥70% |
| First project started | % of enrolled users who enter the workspace at least once | ≥85% |
| First step completed | % of users who complete at least one step | ≥60% |
| Ada usage rate | % of project sessions where the learner sends at least one Ada message | Measure; no target set for beta |

### Learning engagement

| Metric | Description | Target (beta) |
|---|---|---|
| Project completion rate | % of enrolled projects that reach the final step submitted | ≥40% for beta cohort |
| Steps completed per learner | Average steps completed per learner per week | Track; baseline from beta |
| Hint usage rate | % of steps where learner requests at least one hint | Track; indicates difficulty calibration |
| Mode distribution | % of sessions in each mode (guided / hint / independent / adaptive) | Track; no target set for beta |
| Check-to-submit conversion | % of steps where /check pass is followed by /submit | ≥80% (indicates workflow clarity) |

### Evidence and portfolio

| Metric | Description | Target (beta) |
|---|---|---|
| Certificates issued | Total certificates generated | Track; grow with cohort |
| Evidence-backed completions | % of certificates with ≥1 evidence-backed step | ≥90% |
| Public verify page visits | Times `/verify/:certId` URLs are opened | Track; indicates external sharing |
| GitHub exports | Exports initiated post-beta launch | Track *(planned — E2)* |

### Beta retention

| Metric | Description | Target (beta) |
|---|---|---|
| Week-1 retention | % of beta users active in week 2 | ≥50% |
| 30-day retention | % of beta users active in week 5 | ≥30% |
| Beta learner NPS | Net Promoter Score from beta cohort survey | Measure; establish baseline |
| Intervention rate | % of beta learner project completions that required internal support | 0% (target: zero intervention) |

### Catalog quality

| Metric | Description | Target (v1.0) |
|---|---|---|
| Audited visible projects | Projects with pedagogy audit passing, rubric ≥70, validation kind classified | 100–150 |
| Flagship project count | Advanced projects producing recruiter-recognized artifacts | ≥20 |
| Validation kind honesty | No project step with an honest grader mismatch (silent auto-pass on a kind the UI implies is graded) | 0 violations |
| Beta learner completion without intervention | Beta users who complete a project with no internal support needed | 100% |

---

## 10. Release Scope and Milestones

### Private beta (target: end of E6)

**Gate:** beta learners can complete projects without intervention.

Scope in:
- Full project workspace (editors, hints, Ada, check/submit)
- All 4 learning modes with correct tutor contract behavior
- 100–150 visible audited projects, ≥20 flagship
- Validation kinds hardened or honestly classified
- Certificates + public verify pages + portfolio evidence surface
- GitHub export and LinkedIn share *(E2)*
- Real PWA (installable, offline shell) *(E6)*
- Production deploy on Neon + Fly/Vercel *(E6)*
- Auth (Clerk), billing (Stripe live), onboarding functional *(E6)*

Scope out:
- Public marketing site and pricing page
- Diagnostic assessment and prerequisite graph
- Performance-driven adaptive mode
- Real cloud credential flows
- Employer/team dashboards

### v1.0 (private beta → gated public)

The same as private beta plus:
- All beta feedback incorporated
- Zero H1/H2 overclaims in learner-facing copy
- Stable production deployment confirmed
- Beta learner completion-without-intervention target met

### Serious public launch (post-v1.0, target: E7)

- 300–400 visible projects (~50 per discipline)
- Marketing site and pricing page
- Legal (Terms of Service, Privacy Policy)
- Waitlist conversion and growth
- Employer/team plan consideration

Cross-reference: go-to-market and monetization strategy → BRD.md.

---

## 11. Open Questions and Dependencies

### Product questions

| # | Question | Impact | Status |
|---|---|---|---|
| OQ-1 | Should `data-scientist` remain the 9th course? The owner listed 8 disciplines in the brief but the platform has shipped 9 courses since Phase 1, with `data-scientist` in the DB enum and 57 phase docs referencing it. | Affects catalog organization and persona coverage | Assumed yes — treat 9 as canonical; confirm with owner |
| OQ-2 | What is the target deploy host? Fly.io (Express API) + Neon (Postgres) is the recommended path; Vercel + Neon is an alternative. | Affects E6 scope and timeline | Owner to confirm |
| OQ-3 | Is there a hard launch date driving sequencing? | Affects E4 factory cadence and E6 deployment priority | Assumed none (quality-gated); confirm with owner |
| OQ-4 | What is the budget ceiling per factory wave (curriculum authoring)? | Affects how aggressively the factory fans out during E4 | Owner to confirm before E4 begins |
| OQ-5 | Should the diagnostic assessment (OQ-1 E3) be in scope for private beta, or post-beta? | Affects onboarding completeness and first-session experience | Currently planned as post-beta (P2); confirm |

### Technical dependencies (cross-reference TRD.md and ARD.md)

| Dependency | Blocking what | Owner |
|---|---|---|
| Replit connector decoupling (E0.2) | Local dev, all subsequent phases | Engineering — E0.2 |
| Signed run-result envelope general availability (E1 canary → ramp) | Server enforcement of json_equal and numeric_tolerance for Python steps | Engineering — E1 |
| csv_set_equal opt-in pilot (Phase 57B/C) | First server-enforced CSV grading in production | Engineering — E1 |
| GitHub OAuth integration for export | GitHub export (E2) | Engineering — E2 |
| Learner skill state table (E3) | Performance-driven adaptive mode | Engineering — E3 |
| Cloud lab sandbox environment (E5) | Cloud-flavored project content | Engineering — E5 |
| Service worker + asset caching (E6) | Real PWA installability and offline capability | Engineering — E6 |
| Production deploy (E6) | Private beta launch | Engineering — E6 |

### Design dependencies (cross-reference DESIGN.md)

- Portfolio artifact visual design — required before GitHub export UX is built
- Cloud lab workspace panel design — required before E5 implementation begins
- Onboarding diagnostic assessment UX — required before E3 implementation begins
- Print-ready certificate layout — P2, post-beta

---

*Cross-reference documents:*  
*Business model, monetization, pricing, go-to-market → BRD.md*  
*Architecture decisions and system design → ARD.md*  
*Technical specifications, API contracts, schema → TRD.md*  
*Visual design, component system, UX patterns → DESIGN.md*
