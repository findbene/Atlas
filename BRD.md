# Atlas — Business Requirements Document

**Version:** 1.0-draft
**Status:** Pre-beta (Phase 0 foundation)
**Scope:** Business lens — market, model, money, competition, risk. Product features → PRD.md. Architecture decisions → ARD.md. Technical specifications → TRD.md.
**Last updated:** 2026-06-05

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Context and Opportunity](#2-business-context-and-opportunity)
3. [Business Objectives and Success Metrics](#3-business-objectives-and-success-metrics)
4. [Target Market and Segments](#4-target-market-and-segments)
5. [Value Proposition and Positioning](#5-value-proposition-and-positioning)
6. [Competitive Landscape](#6-competitive-landscape)
7. [Monetization Strategy](#7-monetization-strategy)
8. [Go-to-Market Sequence](#8-go-to-market-sequence)
9. [Stakeholders](#9-stakeholders)
10. [Business Risks and Mitigations](#10-business-risks-and-mitigations)
11. [Assumptions and Dependencies](#11-assumptions-and-dependencies)

---

## 1. Executive Summary

Atlas is a premium project-based learning platform (Progressive Web App) that takes learners from zero to job-ready across nine technical disciplines: Data Engineering, AI Engineering, MLOps Engineering, Data Science, Analytics Engineering, Applied LLM Engineering, Cloud Data Engineering, Python Mastery, and SQL Mastery.

The central business thesis is that the gap between passive learning and demonstrable job readiness is large, growing, and commercially addressable. Employers increasingly filter on tangible project evidence rather than course completions or degree proxies. Atlas produces that evidence — recruiter-readable, portfolio-grade artifacts — through a structured learning experience that no single existing competitor delivers end-to-end.

The business is pre-revenue and pre-deployment. The engineered product is approximately 35–55% complete. The go-to-market sequence is: private beta first to validate learner completion and produce real usage evidence, followed by a public paid launch with full pricing, marketing site, and legal infrastructure.

Revenue will be generated through a combination of freemium conversion, Pro subscriptions, cohort fees, employer/team plans, and premium capstone reviews. Stripe billing is scaffolded but not yet production-live.

This document defines the business requirements governing market entry, monetization, competitive positioning, risk management, and stakeholder alignment. Product feature scope is defined in PRD.md. Infrastructure decisions are in ARD.md. Technical specifications are in TRD.md.

---

## 2. Business Context and Opportunity

### 2.1 The Passive Learning Problem

Technical education has scaled quantity without scaling outcome quality. Learners have abundant access to recorded lectures, MOOCs, tutorials, and documentation. What they lack is a structured path from "I watched the content" to "I can demonstrate I can do this work under realistic conditions." The dominant formats — video courses, multiple-choice quizzes, copy-paste exercises — produce learners who recognize concepts but cannot apply them in hiring contexts.

This creates a measurable gap: learners report course completions on resumes, but recruiters and hiring managers cannot distinguish high-effort completions from passive ones. The signal is weak. Employers increasingly require project portfolios, GitHub repositories with realistic work, or role-specific take-home demonstrations to supplement credentials.

Atlas is positioned to close that gap by producing project-grade evidence that is structured, sequenced by role path, and honest about what it verifies.

### 2.2 The 2026 Hiring Signal Shift

The platform is built for the 2026-and-beyond hiring cohort. The nine disciplines map directly to roles where hiring demand is established and where recruiters have begun to develop literacy around specific technical artifacts:

- **Data Engineering:** CDC pipelines, dbt transformations, orchestration DAGs
- **Analytics Engineering:** semantic layers, dbt models, data contracts
- **AI Engineering:** RAG systems, structured-output guardrails, evaluation frameworks
- **MLOps Engineering:** model registries, monitoring dashboards, CI/CD for ML
- **Applied LLM Engineering:** prompt engineering, fine-tuning patterns, safety guardrails
- **Cloud Data Engineering:** cloud-flavored data platform patterns (sandbox-simulated initially; see ARD.md)
- **Data Science:** end-to-end modeling, feature stores, experiment tracking
- **Python Mastery / SQL Mastery:** foundational tracks feeding all role paths

These are not hypothetical skill gaps. They are the artifacts that appear in job descriptions and technical screenings for these roles in 2026. The market timing is deliberate.

### 2.3 Why Now

Three conditions align:

1. **AI tooling lowered the cost of tutoring.** Ada (the Atlas AI tutor) delivers context-aware, mode-gated tutoring at a per-query cost that makes embedded AI assistance viable in a subscription product. Earlier, this would have required human teaching assistants at scale.

2. **Browser-native execution matured.** Pyodide (Python-in-browser) and DuckDB-WASM (SQL-in-browser) make it viable to run real code execution inside a PWA without server-side compute per learner session. This changes the unit economics of interactive coding labs.

3. **Portfolio credibility is now expected, not exceptional.** The bar has shifted. A GitHub repository with realistic project work is now a baseline filter, not a differentiator. Atlas industrializes portfolio building for learners who would otherwise spend weeks assembling proof of work ad hoc.

---

## 3. Business Objectives and Success Metrics

### 3.1 Private Beta Objectives (pre-revenue phase)

| Objective | What it measures |
|---|---|
| Validate completion rates | Beta learners complete projects end-to-end without manual intervention |
| Produce usage evidence | Real completion records, certificate events, validation runs that can be shown to early-adopter employers |
| Identify friction points | Drop-off by step, mode, project, and discipline — feeds catalog prioritization |
| Stress-test trust infrastructure | Signed run envelopes, H3 honest-claims guard, validation graders under real submissions |
| Inform pricing | Willingness-to-pay signal from beta cohort before setting public price points |

### 3.2 Public Launch Objectives (paid phase)

| Objective | Direction of movement | Notes |
|---|---|---|
| Free-to-Pro conversion rate | Target double-digit % | Freemium gate design in PRD.md |
| Monthly paid subscriber retention | Target low single-digit monthly churn | Cohort and subscription combined |
| Average revenue per user (ARPU) | Track across tiers; blended ARPU rises as employer plans activate | Not yet estimable without beta data |
| Beta-to-paid conversion | Beta participants who convert at public launch | Key early indicator of product-market fit |
| Employer/team plan pipeline | Number of teams in paid pilot | Activates after individual traction is proven |
| Catalog coverage | 100–150 projects at v1.0; 300–400 at serious launch scale | Drives retention and breadth of addressable learner |

### 3.3 What This Document Does Not Fabricate

No revenue targets, subscriber counts, or market size figures are stated here. Those will be derived from beta data and set at the time of public launch planning. Any figure stated before real usage data exists is a guess, not a business requirement.

---

## 4. Target Market and Segments

### 4.1 Primary Learner Segments

| Segment | Description | Primary need | Atlas entry point |
|---|---|---|---|
| Career switchers | Professionals moving into data/AI/ML roles; basic Python or SQL background | Build a believable portfolio fast; structured role path | Guided mode; role-path enrollment; Ada tutor |
| Junior data analysts | SQL and dashboards; want to move up into analytics engineering or data engineering | Credible technical project work; dbt, pipelines, semantic layers | Analytics Engineering and Data Engineering paths |
| Aspiring AI/LLM engineers | Python + early LLM usage; want to build production-grade systems | RAG pipelines, evals, structured outputs, guardrails | AI Engineering and Applied LLM Engineering paths |
| MLOps learners | ML course background; want deployment, monitoring, and CI/CD skills | Real MLOps project artifacts | MLOps Engineering path |
| Cloud data learners | AWS/Azure/GCP fundamentals; want to build realistic cloud data systems | Cloud-flavored project work without needing real cloud credentials | Cloud Data Engineering sandbox labs |
| Python and SQL foundations learners | Beginners and intermediates | Hands-on mastery of fundamentals through projects, not exercises | Python Mastery and SQL Mastery tracks |

### 4.2 Organizational Buyer Segments

| Segment | Description | Entry condition |
|---|---|---|
| Employer/team plans | Companies onboarding junior engineers, running internal upskilling, or screening candidates through project work | Requires individual traction and at least a beta employer proof of concept first |
| Bootcamp or program partnerships | External programs that could white-label or bundle Atlas project paths for their cohorts | Post-launch consideration; not a Day 1 requirement |

### 4.3 Market Scope

Atlas is scoped to English-language technical learners in the 2026 hiring cohort targeting roles in data, AI, ML, and cloud data engineering. Geographic scope at launch is wherever Stripe, Clerk authentication, and cloud email delivery operate without additional compliance overhead. Expansion to non-English markets, regulated credential markets (EU/UK), or enterprise procurement workflows is a post-v1.0 decision.

---

## 5. Value Proposition and Positioning

### 5.1 The Core Promise

Atlas converts learning effort into visible, credible, recruiter-aligned technical project evidence. It does not promise job placement. It does not claim to verify independent authorship. It produces artifacts that a hiring manager can inspect and a learner can honestly point to.

The honest-claims discipline is a business requirement, not only a product principle. Overclaiming (e.g., "verified authorship," "tamper-proof," "cheat-proof," "100% verified," "job guaranteed") would expose Atlas to trust liability and undermine the credibility of the evidence it produces. The platform's value is precisely that it does not overclaim. See PRD.md §2 for the H3 honest-claims ceiling and docs/phases/phase-53-launch-readiness-h3-audit.md for enforcement implementation.

### 5.2 The Three Pillars

| Pillar | What it delivers | Business function |
|---|---|---|
| Learning product | Role paths, sequenced projects, four learning modes, Ada AI tutor, in-browser IDE | Acquisition and engagement; the product learners pay for |
| Trust infrastructure | Runtime validation, signed completion records, honest-claims discipline, certificates that state exactly what was verified | Retention and credibility; why completions are worth something |
| Career platform | Portfolio surface, GitHub export, LinkedIn sharing, cloud sandbox labs, role-readiness framing | Conversion and advocacy; why learners and employers return |

### 5.3 The 6-in-1 Positioning

Atlas occupies the intersection of six product categories that currently require separate tools or providers:

1. Guided bootcamp — structured role paths with sequenced projects
2. Project portfolio builder — artifacts a learner can share and employers can read
3. Interactive coding lab — in-browser Python and SQL execution (Pyodide, DuckDB-WASM)
4. Data and AI engineering IDE — Monaco editor, cloud-flavored sandbox, realistic data tooling
5. Tutor-assisted learning environment — Ada AI tutor with mode-aware contracts and quota management
6. Recruiter-facing evidence platform — certificates, signed run records, portfolio pages with honest disclosure

No single competitor occupies all six. This is the primary positioning claim.

### 5.4 The Ten Differentiators

1. **Role-path orientation** — curriculum designed around job roles, not subject hierarchies
2. **Project-first structure** — every learning unit is a concrete project with a real scenario, not a lecture
3. **AI tutoring under strict mode contracts** — Ada operates within learner-selected scaffolding levels; the tutor does not shortcut the learning contract
4. **Progressive learner autonomy** — four modes (guided, hint, independent, dynamic-AI-adaptive) with adaptive progression tied to demonstrated performance
5. **Evidence-backed completion records** — signed run envelopes record what was submitted, when, and what the system verified — stated honestly
6. **Portfolio-grade deliverables** — completions produce inspectable artifacts (dbt models, pipelines, RAG systems) not just certificates
7. **Runtime validation with canary discipline** — new graders ship dark and roll out through a controlled canary process, never breaking existing completions
8. **Honest-claims architecture** — the platform is explicitly designed to avoid overclaiming; this is enforced at the source level with a banned-phrase guard across all user-facing surfaces
9. **Authoring factory** — a structured project authoring pipeline (prompt → generate → score → human gate → publish) enables curriculum scale without quality collapse
10. **GitHub and LinkedIn connectivity** — completions connect to the learner's existing professional presence, not a walled credential garden

---

## 6. Competitive Landscape

### 6.1 Competitor Table

| Competitor | What they do | Atlas advantage |
|---|---|---|
| DataCamp Projects | Short data science projects; notebook-based; broad catalog | Atlas has role-path sequencing, Ada tutor with mode contracts, signed completion records, and portfolio export; DataCamp projects are largely notebook exercises without career-path framing |
| Coursera Guided Projects | 1–2 hour guided tasks inside a Rhyme cloud desktop | Atlas projects are longer, role-path sequenced, produce portfolio artifacts, and use in-browser execution rather than cloud desktop sessions; Coursera projects are standalone, not cumulative |
| Maven Analytics / Bootcamp Capstones | Capstone projects with human review; analyst-focused | Atlas scales via validation automation with a human approval gate on authoring; Maven is human-reviewed at submission which caps throughput and price competitiveness |
| Codecademy-style interactive learning | Step-by-step in-browser coding exercises; beginner-friendly | Atlas targets intermediate-to-advanced role readiness; Codecademy's exercises are fragmented drills, not portfolio deliverables |
| Dataquest Project Labs | Project-based; data science focus | Narrower discipline scope; no AI tutor with mode contracts; no signed completion records or portfolio export |
| Cloud academy labs (A Cloud Guru, Linux Foundation, etc.) | Hands-on cloud labs; certification prep | Atlas targets data/AI/ML project portfolios, not infrastructure certification; different buyer intent |
| AI/LLM Engineering bootcamps | Cohort-based; human instruction; high cost | Atlas is async and lower cost; human cohort support is an optional overlay, not the primary model |
| Recruiter-facing portfolio platforms (e.g., GitHub, personal sites) | Storage and presentation of work | Atlas produces the work, not just hosts it; the integration is export-to-GitHub/LinkedIn, not competition |

### 6.2 Competitive Risk Summary

The primary competitive risk is not that a single competitor matches all six product dimensions. It is that learners assemble a DIY stack (Coursera course + GitHub repo + ChatGPT for tutoring) that is "good enough" at lower cost. The Atlas counter to this is that the assembled stack produces inconsistent, uncurated evidence, while Atlas produces structured, role-sequenced, validation-backed artifacts that a recruiter can read without interpretation.

---

## 7. Monetization Strategy

### 7.1 Overview

Atlas has five monetization models. They are introduced in sequence — not all at once. The beta phase is non-monetized (or lightly monetized) to prioritize usage evidence and product validation.

### 7.2 Model Detail

**Model 1: Freemium**

- Who pays: nobody at free tier; Pro subscribers at paid tier
- What they get (free): beginner-level projects across disciplines; basic workspace; limited Ada tutor quota; completion records without certificates
- What they get (paid): intermediate and advanced projects; full Ada tutor quota (Sonnet-class); certificates with signed evidence; portfolio export; cloud sandbox labs
- When introduced: at public launch; freemium gate configured before launch
- Business function: acquisition funnel; converts at the point where learners hit the paywall on intermediate projects

**Model 2: Pro Subscription**

- Who pays: individual learners
- What they get: full catalog access; Ada tutor at Sonnet quota; certificates; portfolio export with GitHub/LinkedIn sharing; cloud sandbox labs
- When introduced: at public launch with Stripe production-live
- Billing: monthly and annual options; annual at a discount drives retention
- Business function: primary revenue driver in Year 1

**Model 3: Cohort / Private Beta**

- Who pays: cohort participants; may be free for the private beta to generate usage evidence
- What they get: guided cohort experience with structured pacing, feedback, and cohort-specific project paths
- When introduced: private beta is the first version; paid cohort is a post-beta offering once the product handles async learners reliably
- Business function: early validation, testimonials, completion evidence, and word-of-mouth before public launch

**Model 4: Employer / Team Plans**

- Who pays: companies and teams
- What they get: team dashboards, project path assignment, admin-level reporting, progress tracking across team members, role-readiness framing for hiring pipelines
- When introduced: post-individual-traction; requires the career platform pillar to be live; not a beta deliverable
- Business function: higher ARPU, lower churn, potential referral to candidate sourcing

**Model 5: Credential / Capstone Upsell**

- Who pays: individual learners seeking premium validation
- What they get: a premium capstone project with structured rubric scoring and optional human reviewer feedback; a certificate that states what was reviewed and by whom
- When introduced: post-launch; requires human reviewer capacity and rubric standardization
- Business function: higher-margin transaction for serious job seekers; anchors the "evidence" narrative at the high end

### 7.3 Stripe Status

Stripe billing is scaffolded in the codebase (free/Pro tier structure exists). It is not yet production-live. Stripe goes live at the transition from private beta to public launch. See ARD.md for infrastructure and TRD.md for implementation scope.

---

## 8. Go-to-Market Sequence

### 8.1 Phase 1 — Private Beta (current)

**Goal:** Real learners complete real projects. Produce completion evidence, surface friction, validate the trust infrastructure under realistic submissions.

**Mechanism:** Invited beta cohort. No public marketing. No paid subscriptions. Stripe is off.

**Activities:**
- Finalize core product to beta-ready state (see PRD.md milestone definitions)
- Onboard a controlled cohort of career-switcher and junior-analyst personas
- Instrument completion funnels and drop-off by project and step
- Collect qualitative feedback on Ada tutor usefulness and mode preferences
- Validate that signed run envelopes and certificates produce records learners consider credible

**Exit criteria:** Beta learners complete projects without manual intervention; H3 honest-claims hold under real usage; no blocking technical issues in auth, billing scaffold, or validation pipeline.

### 8.2 Phase 2 — Waitlist and Pre-Launch

**Goal:** Build an audience before the paid launch. Convert beta learners and interested observers into a waitlist that can be activated at launch.

**Mechanism:** Minimal marketing site (not the full product surface) with waitlist signup. Beta testimonials and portfolio examples (with learner consent) as social proof.

**Activities:**
- Publish marketing site with pricing preview and waitlist
- Legal: terms of service, privacy policy, refund policy, certificate disclosure language
- Finalize pricing tiers (informed by beta willingness-to-pay signal)
- Activate Stripe production billing

### 8.3 Phase 3 — Public Paid Launch

**Goal:** Open enrollment; activate freemium and Pro subscription tiers; begin measuring conversion and retention.

**Mechanism:** Marketing site live; Stripe production-live; full catalog at v1.0 scope (100–150 projects); all three pillars functional.

**Activities:**
- Launch announcement to waitlist
- Employer outreach for team plan pilots (parallel track)
- Monitor free-to-Pro conversion and early churn
- Iterate catalog based on discipline demand and completion data

### 8.4 Phase 4 — Employer and Team Plans

**Goal:** Activate the organizational buyer segment.

**Condition:** Individual traction established; team dashboard and admin reporting functional (see PRD.md employer features scope).

**Mechanism:** Direct outreach to companies hiring in data/AI/ML engineering; cohort partnerships with training programs.

---

## 9. Stakeholders

| Stakeholder | Role | Primary interest | Engagement point |
|---|---|---|---|
| Owner / Founder | Single decision-maker on all product, business, and technical choices | Viable business; honest product; quality curriculum | All phases; all decisions |
| Beta learners | First real users of the product | Complete projects that advance their career; honest feedback on what was verified | Private beta; UX feedback; completion evidence |
| Hiring managers / Recruiters | Downstream consumers of Atlas-produced evidence | Project artifacts that are readable and honest about what was verified | Career platform outputs; certificate disclosure |
| Future content authors | Individuals or contractors who use the authoring factory to produce new projects | Clear authoring spec; quality rubric; fair attribution | Post-beta; authoring factory activation (see Phase 41+ docs) |
| Future employer partners | Companies paying for team plans or using Atlas for candidate screening | Reliable product; credible evidence; admin tooling | Post-individual-traction |
| Payment processor (Stripe) | Infrastructure dependency | Compliant billing integration | Public launch |
| Auth provider (Clerk) | Infrastructure dependency | Compliant user management | Beta and launch |

---

## 10. Business Risks and Mitigations

### Risk 1: Trust and Overclaim Liability

**Description:** If Atlas marketing or product copy implies stronger verification than the platform delivers (e.g., implying independent authorship, tamper-proof certificates, or job guarantees), learners, employers, or regulators could challenge the claims. Trust, once lost in the credential space, is difficult to rebuild.

**Mitigation:** The H3 honest-claims ceiling is a hard business constraint, not a preference. It is enforced at the source level via a 16-phrase banned-phrase guard across all user-facing surfaces (implemented in Phase 53; see `artifacts/atlas/src/lib/banned-h1h2-phrases.ts`). Every certificate and portfolio page links to a disclosure page that states exactly what Atlas verifies and what it does not. This discipline is the foundation of the trust infrastructure pillar and must be maintained as catalog and marketing scale.

### Risk 2: Content Quality at Catalog Scale

**Description:** The serious-launch target of 300–400 projects across nine disciplines requires a production authoring pipeline. Human-reviewed authoring at that scale is not feasible without a factory model. If quality degrades as volume scales, the evidence produced by Atlas loses credibility.

**Mitigation:** The authoring factory (seeded in Phase 41; governed by `docs/project-authoring-spec.md` and `docs/templates/project-publish-readiness-checklist.md`) applies a rubric gate and hidden-first publishing. No project is visible to learners until it passes the approval gate. The rubric version is frozen (`RUBRIC_VERSION=1.0.1`) to prevent silent quality drift. Human review remains the final gate. Scale authoring output, not the approval threshold.

### Risk 3: Cloud Cost Exposure

**Description:** Cloud sandbox labs (AWS, Azure, GCP, Databricks, Snowflake-flavored projects) carry real infrastructure cost if learners run against live cloud credentials. At scale, this could make cloud lab projects unprofitable at Pro subscription price points.

**Mitigation:** The governing decision (D2 in discovery.md) is sandbox-simulation first: cloud-flavored projects run against mock services (mock S3, Glue, Athena, BigQuery, Snowflake, Databricks) using DuckDB as the local execution layer. No real cloud credentials in v1.0. BYO-cloud extension is designed for later with an explicit security model review gate. Cost exposure is deferred until the unit economics of cloud labs are understood. See ARD.md for the infrastructure boundary.

### Risk 4: Learner Churn Before Portfolio Value is Realized

**Description:** Project-based learning has a higher time-to-value than video courses. A learner who quits after one beginner project has not experienced the portfolio value that drives retention and advocacy. Early churn before a first meaningful completion undermines the freemium funnel.

**Mitigation:** The product design addresses this through onboarding enrollment flows (Phase 21), resume-on-return behavior (Phase 23), and the beginner tier (Phase 19) designed to deliver a first completion within 60–150 minutes. Business mitigation is to track time-to-first-completion as a primary beta metric and optimize the onboarding funnel before paid launch. See PRD.md for the full onboarding scope.

### Risk 5: Competitive Response from Better-Resourced Platforms

**Description:** DataCamp, Coursera, or a well-funded AI-education startup could replicate elements of Atlas's positioning (AI tutor + project portfolio) faster than Atlas can achieve scale. The six-dimensional positioning is a moat only if all six dimensions are genuinely present and integrated.

**Mitigation:** The primary durable advantage is the trust infrastructure: the combination of signed run envelopes, H3 honest-claims discipline, rubric governance, and canary rollout rigor. This is harder to replicate quickly than a UI feature. The authoring factory is the second moat: curriculum scale at quality. Neither is a marketing claim — both are implemented engineering disciplines. Atlas should compete on evidence credibility, not feature parity. Speed of catalog growth and employer relationship depth are the lagging moats that come after.

### Risk 6: Stripe Billing Activation Risk

**Description:** Stripe is scaffolded but not production-live. Activating billing introduces compliance obligations (payment card data, refund policy, tax handling, terms of service) that do not yet exist.

**Mitigation:** Billing activation is explicitly gated to Phase 2 (pre-launch) and requires legal review of terms, privacy policy, and refund policy before going live. The private beta operates without live billing, removing this risk from the critical path. See TRD.md for the billing implementation scope.

---

## 11. Assumptions and Dependencies

### 11.1 Assumptions

| Assumption | Basis | Invalidation signal |
|---|---|---|
| Recruiter literacy for project artifacts (dbt models, CDC pipelines, RAG systems) is sufficient to make portfolio evidence valuable in 2026 | Observed job description language and interview screening patterns in these roles | If hiring managers revert to degree-and-certification filtering, portfolio value weakens |
| Browser-native execution (Pyodide, DuckDB-WASM) is reliable enough for production-grade project submissions | 57 phases of engineering on this stack; learner submissions pass validation in-browser | If execution reliability degrades at scale, server-side execution fallback is needed (cost impact) |
| Ada AI tutor (Haiku free / Sonnet Pro) operates within cost parameters that make the Pro subscription margin-positive | Anthropic pricing as of 2026; mode-gated quota management in place | If model costs rise significantly, quota configuration and tier pricing need rebalancing |
| The authoring factory produces projects that meet the rubric gate at a rate that sustains catalog growth targets | Phase 41 pilot; project-authoring-spec.md rubric | If pass rate drops below economically viable threshold, human authoring costs increase |
| Private beta participants represent the actual target learner population well enough to generate reliable product-market fit signal | Recruitment of career-switcher and junior-analyst personas | If beta is over-represented by advanced practitioners, churn and conversion data will be misleading |

### 11.2 Dependencies on Other Documents

| Dependency | Document | Nature |
|---|---|---|
| Product feature scope, user stories, catalog milestones, mode definitions, Ada quota design | PRD.md | Business objectives in Section 3 are only achievable if the feature scope in PRD.md is delivered on schedule |
| Infrastructure decisions: hosting, cloud sandbox boundary, Stripe activation gate, Clerk auth, Neon Postgres | ARD.md | Monetization activation (Section 7) depends on ARD.md infrastructure decisions being finalized and implemented |
| Technical specifications for billing integration, validation pipeline, signed envelopes, export APIs | TRD.md | Employer plan and capstone upsell (Section 7, Models 4 and 5) require TRD.md features to be built |
| Governing decisions D1–D6 | .agentic/discovery.md | The go-to-market sequence in Section 8 is predicated on D1 (off Replit), D2 (sandbox-first), and D3 (private beta first) remaining in force |

### 11.3 Out of Scope for This Document

- Product feature definitions and user stories → PRD.md
- System architecture, hosting topology, database schema → ARD.md
- API specifications, validation grader implementations, front-end component design → TRD.md
- Visual design and UX patterns → DESIGN.md
- Session-level engineering state → .agentic/progress.md and HANDOFF.md

---

*BRD owner: Biniyam Kebede. Next review: at private beta exit or when a governing assumption is invalidated.*
