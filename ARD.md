# Architecture Requirements Document — Atlas Platform

**Version:** 1.0  
**Status:** Living document — update when architectural decisions change, not for feature additions.  
**Related documents:** `PRD.md` (product features), `TRD.md` (concrete versions/env-vars/schema columns), `DESIGN.md` (visual/UX specifications)

---

## 1. Purpose and Scope

This document describes the structural architecture of the Atlas platform: how its components are arranged, how data flows between them, how trust is established, what deployment topology is targeted, and the rationale behind the key architectural decisions made across the 57-phase build history. It is the reference for anyone needing to understand *why* the system is shaped the way it is and *what invariants* must be preserved as it evolves.

What this document does NOT contain:
- Concrete dependency versions, environment variable names, schema column lists — see `TRD.md`
- Product feature descriptions and user stories — see `PRD.md`
- Visual design system, component styling — see `DESIGN.md`

---

## 2. Architectural Goals and Quality Attributes

Six quality attributes drive every architecture decision in Atlas. When tradeoffs arise, decisions are evaluated against this ordered list.

### 2.1 Trustworthiness (paramount)
The platform's core promise is an honest assessment of a learner's skill. All architecture that touches grading, progress evidence, or claim language must be designed to remain honest under adversarial conditions. This means the system can claim "verified output match" (H3) but must never claim "verified authorship" or "tamper-proof". Architectural components enforce this boundary at the code level, not through convention.

### 2.2 Honesty (explicit label, not implied)
The execution architecture surfaces a `HonestyLabel` to the learner at all times — "In-Browser Simulation", "Replay (Pre-Recorded Cloud Output)", etc. — so learners always know what kind of environment they are working in. This is a first-class architectural concern enforced in `lib/execution-core`, not left to UI copy.

### 2.3 Reproducibility
Code-runs execute deterministically inside the browser sandbox (Pyodide + DuckDB-WASM). Database migrations are explicit and versioned; no boot-time schema mutation is allowed. Grading logic (`gradeSubmission`) is a pure function shared by both `/check` and `/submit`, so the result of a check is identical to a submit given the same inputs.

### 2.4 Security
Auth is enforced at every route. Authorization is checked at the data layer (ownership gates). Hidden/archived content returns 404, not 403, to prevent existence leaks. Secrets never appear in source; they are injected by the runtime environment. Input validation occurs at API boundaries using Zod-derived schemas.

### 2.5 Scalability
The system is designed for horizontal scale at the API tier with stateless request handling. Per-learner advisory locks (`pg_advisory_xact_lock`) serialize reward writes without cross-process shared state, making it safe to run multiple API instances against a single Postgres database. The XP ledger (`xp_transactions`) is append-only and idempotent. In-browser execution (Pyodide/DuckDB-WASM) eliminates server-side compute for code runs entirely.

### 2.6 Evolvability
The codebase has a 57-phase history; each new capability must not break the existing trust spine. New graders ship dark (opt-in flag, zero live rows) with a byte-for-byte backward-compatibility audit before activation. The `ExecutionMode` enum is a closed extension point: new modes are typed and present in the enum before any implementation lands. The rubric version is frozen; its weights cannot change without a deliberate architectural decision.

---

## 3. System Context

The following ASCII diagram shows Atlas in its operational environment. Every external actor or service is named.

```
                           ┌───────────────────────────────────────────────────┐
                           │              External Identity & Payments          │
                           │                                                    │
                           │  ┌──────────────┐  ┌──────────┐  ┌─────────────┐ │
                           │  │  Clerk (auth)│  │  Stripe  │  │   Resend    │ │
                           │  │  JWT issuance│  │ (billing)│  │   (email)   │ │
                           │  └──────┬───────┘  └────┬─────┘  └──────┬──────┘ │
                           │         │               │               │         │
                           └─────────┼───────────────┼───────────────┼─────────┘
                                     │  JWT verify   │ webhook/API   │ SMTP-API
                                     │               │               │
┌────────────────────────┐           │     ┌─────────▼───────────────▼─────────────────────────┐
│  Learner Browser       │           │     │              Atlas API Server                       │
│                        │           │     │              (Express 5, Node 24)                   │
│  ┌──────────────────┐  │  HTTPS    │     │                                                     │
│  │  Atlas PWA       │◄─┼───────────┘     │  Route layer → lib services → Drizzle ORM          │
│  │  (React 19/Vite) │  │  REST/SSE       │                                                     │
│  │                  ├──┼─────────────────►  POST /runs/sign                                    │
│  │  Pyodide (Python)│  │                 │  POST /check, POST /submit                          │
│  │  DuckDB-WASM(SQL)│  │                 │  GET  /ai/tutor  (SSE)                              │
│  │                  │  │                 │  GET  /projects, /courses, ...                      │
│  └──────────────────┘  │                 │                         │                           │
│                         │                └─────────────────────────┼───────────────────────────┘
│  Code runs entirely     │                                          │
│  inside this box.       │                                          │ SQL / connection pool
│  No server compute.     │                          ┌───────────────▼──────────────┐
└────────────────────────┘                           │  PostgreSQL (Neon target)     │
                                                     │                              │
                                                     │  ~30 tables, Drizzle ORM,    │
                                                     │  explicit migrations          │
                                                     └──────────────────────────────┘
                                                                     ▲
                                                     Anthropic Claude API (Ada tutor SSE)
                                                     streamed through the API server,
                                                     never directly from the browser.
```

**Key structural facts from this diagram:**
- Code execution happens 100% in the browser. The API server never runs learner code.
- Anthropic (Ada tutor) is proxied through the API server via SSE. The browser never holds the Anthropic API key.
- Clerk JWTs are verified server-side on every authenticated request; the browser presents the token, it does not generate trust.

---

## 4. Monorepo Topology

Atlas uses a pnpm workspace. The layout is defined by Decision D5 and must not be renamed.

```
Atlas/
├── artifacts/          ← deployable applications (depend on lib/*)
│   ├── atlas/          ← React 19 + Vite frontend PWA
│   ├── api-server/     ← Express 5 REST/SSE API
│   └── mockup-sandbox/ ← isolated UI prototype environment
│
├── lib/                ← shared packages (no circular deps; apps consume, packages don't know about apps)
│   ├── db/             ← Drizzle schema, migrations, test helpers
│   ├── execution-core/ ← execution contracts, envelope primitives, pedagogy, learner-mode
│   ├── curriculum-quality/ ← rubric, authoring, candidate scoring, generator, course taxonomy
│   ├── api-spec/       ← OpenAPI YAML (source of truth for the HTTP contract)
│   ├── api-client-react/ ← Orval-generated React Query hooks (do not hand-edit)
│   └── api-zod/        ← Orval-generated Zod request/response schemas (do not hand-edit)
│
└── scripts/            ← operational tooling (seed, migrate, audit, backfill, cron janitors)
```

### Dependency direction (enforced)

```
artifacts/atlas      ─────────────────────────────────────────────────────────────────►
artifacts/api-server ──────────────────────────────────────────────────────────────────►  lib/*

lib/api-spec (OpenAPI YAML)
         │
         │  Orval codegen (pnpm generate)
         ▼
lib/api-client-react   (React Query hooks — artifacts/atlas consumes)
lib/api-zod            (Zod schemas — artifacts/api-server and artifacts/atlas consume)
```

No package in `lib/` may import from `artifacts/`. No circular dependencies across packages. The codegen direction is one-way: `api-spec` is the only canonical API contract; generated clients are outputs, never inputs.

Some routes (e.g. hints, learner-mode) use plain `fetch` precedent rather than the Orval-generated client. This is an acknowledged deviation, documented here so future routes can make an explicit choice rather than discovering the inconsistency.

---

## 5. Component Architecture

### 5.1 Frontend (artifacts/atlas)

The frontend is a single-page React 19 application built with Vite. It is the entry point for all learner interaction.

```
artifacts/atlas/src/
├── App.tsx              ← Router (wouter), Clerk provider, global layout
├── pages/               ← Route-level page components
│   ├── project-workspace.tsx   ← primary learner workspace, owns run/check/submit orchestration
│   ├── dashboard.tsx
│   ├── courses.tsx / course-detail.tsx / domain-detail.tsx
│   ├── tutor.tsx               ← standalone Ada tutor view
│   ├── profile.tsx / public-profile.tsx
│   ├── onboarding.tsx
│   ├── certificates.tsx / verify.tsx
│   ├── leaderboard.tsx
│   └── ...
├── components/
│   ├── studio/          ← project workspace sub-components
│   │   ├── StudioShell.tsx      ← layout orchestrator for the workspace
│   │   ├── EditorPanel.tsx      ← Monaco editor (Python/SQL)
│   │   ├── EditorToolbar.tsx    ← Run / Check / Submit controls
│   │   ├── InstructionsPanel.tsx
│   │   ├── OutputPanel.tsx      ← stdout/stderr/tabular output
│   │   ├── ValidationFeedbackPanel.tsx  ← grading result display
│   │   ├── RemediationPanel.tsx
│   │   ├── DatasetRefsBar.tsx
│   │   ├── StepChecklist.tsx
│   │   ├── RunHistorySheet.tsx
│   │   ├── ModeSelector.tsx     ← execution mode selector (Simulated / future modes)
│   │   └── useLearningMode.ts   ← learning mode state (guided/hint/independent/dynamic_ai_adaptive)
│   ├── AiTutorPanel.tsx ← Ada SSE chat panel (embedded in workspace)
│   ├── Navbar.tsx
│   ├── InstallPrompt.tsx  ← PWA install prompt
│   └── ui/              ← shadcn/ui primitives
└── hooks/               ← shared React hooks
```

The Studio Shell is the architectural centrepiece of the learner experience. It composes all sub-panels and owns the state machine for: current step, code editor content, output display, grading results, and learning mode. `project-workspace.tsx` (the page) owns the data-fetching and run/check/submit orchestration; it passes everything down to `StudioShell` via props.

### 5.2 API Server (artifacts/api-server)

The API server is an Express 5 application. Its internal structure is layered:

```
artifacts/api-server/src/
├── index.ts             ← server bootstrap, boot-time secret validation, middleware chain
├── routes/              ← thin HTTP handlers; delegate to lib/ services
│   ├── index.ts         ← router registry (all 21 sub-routers mounted here)
│   ├── user.ts          ← /user/profile, /check, /submit (core learner flow)
│   ├── runs.ts          ← POST /runs (run history recording)
│   ├── runs-sign.ts     ← POST /runs/sign (envelope minting)
│   ├── ai.ts            ← GET /ai/tutor (Ada SSE proxy)
│   ├── projects.ts / courses.ts / domains.ts / modules.ts
│   ├── enrollment.ts / dashboard.ts / onboarding.ts
│   ├── leaderboard.ts / public-profile.ts / user-portfolio.ts
│   ├── billing.ts       ← Stripe webhook + subscription management
│   ├── hints.ts / learner-mode.ts  ← plain-fetch precedent routes
│   ├── cert-verify.ts / execute.ts
│   ├── admin.ts         ← admin-only operations (requireAdmin)
│   └── waitlist.ts / health.ts
└── lib/                 ← server-side services
    ├── auth.ts          ← requireAuth, requireAdmin, getOrCreateUser, userCache
    ├── grading.ts       ← gradeSubmission() pure function (shared by /check and /submit)
    ├── envelopeSubmit.ts ← verifyEnvelopeForSubmit, parseEnvelopeAllowList, isEnvelopeEnforcedFor
    ├── envelopeGrade.ts  ← gradeEnvelopeCapture (grades from envelope capture, not raw submission)
    ├── envelopeMetrics.ts ← recordVerifyOk/Failed/Fallback (canary telemetry)
    ├── email.ts         ← Resend integration
    ├── streak.ts        ← bumpStreak helper
    └── ...
```

Routes are intentionally thin: they validate input, call auth guards, delegate to lib services, and return responses. Business logic lives in `lib/`, not in route handlers.

### 5.3 Shared Library Packages (lib/*)

| Package | Responsibility |
|---------|----------------|
| `lib/db` | Drizzle ORM schema definitions for all ~30 tables, explicit migration files, test helpers. The single source of truth for all table shapes. |
| `lib/execution-core` | Framework-agnostic execution contracts (`ExecutionMode`, `ExecutionAdapter`, `RunInput`, `RunResult`); signed envelope primitives (`RunCapture`, `SignedRunEnvelope`, `signRunEnvelope`, `verifyRunEnvelope`); learner mode logic; pedagogy helpers. Does NOT import from any artifact. |
| `lib/curriculum-quality` | Rubric v1.0.1 (frozen), candidate authoring pipeline, scoring logic, course taxonomy (`atlasCourseEnum` values), validation enforcement, job-demand data, uniqueness checks. The quality gate for all curriculum content. |
| `lib/api-spec` | OpenAPI YAML defining the full HTTP contract between frontend and API. Source of truth; drives codegen. |
| `lib/api-client-react` | Orval-generated React Query hooks. Never hand-edited. Regenerated by `pnpm generate` when `api-spec` changes. |
| `lib/api-zod` | Orval-generated Zod request/response schemas. Used by both the API server (response validation) and the frontend (type safety). |

---

## 6. Data Architecture

Atlas uses a single PostgreSQL database (Neon in production). All schema changes go through explicit Drizzle migrations; the baseline is `lib/db/drizzle/0000_phase31_baseline.sql`. Boot-time schema mutation (`db.push`, `sync`) is permanently prohibited.

### 6.1 Migration Strategy

Migrations are applied by `scripts/migrate.ts` (the `pnpm run migrate` command), which runs as a one-off operation before a new server version goes live. The migration runner is the only path to schema changes; no ORM auto-sync runs at server startup.

### 6.2 Entity Groups

The schema is organized around six functional groups. Column-level details are in `TRD.md`.

**Identity and auth**
`users`, `subscriptions`, `processedWebhookEvents`. The `users` table is provisioned lazily on first authenticated request by `getOrCreateUser`. A per-process in-memory `userCache` reduces repeated DB lookups within a single server instance (see Section 13.1 for the multi-instance caveat).

**Curriculum structure**
`domains`, `tracks`, `projects`, `project_steps`. These tables define the learnable content tree. `projects.course` is a native enum column sourced from `atlasCourseEnum` (9 values). `projects.learner_visible` is the visibility gate; hidden projects return 404 to learners. No rows are ever deleted; archive = set `learner_visible = false`.

**Progress and evidence**
`user_progress`, `user_step_completions`, `user_code_runs`, `user_code_sessions`, `user_project_step_hints`, `xp_transactions`, `user_xp`, `user_streaks`. The XP ledger (`xp_transactions`) is append-only; idempotency is enforced by checking for an existing transaction before inserting. `user_step_completions.submission_sha256` records a SHA-256 of the full submission as forensic evidence for passing attempts.

**Trust and envelope**
`run_envelope_nonces`. Single-use nonces issued at sign time and burned at verify time. No foreign key to users or projects — the nonce is opaque and self-contained inside the signed envelope binding. A nightly janitor cron (`scripts/cleanup-run-envelope-nonces.ts`) prunes expired rows.

**Curriculum governance and lineage**
`project_candidates`, `project_status_history`. Candidates are AI-researched or human-proposed projects awaiting promotion. The `project_candidates.promoted_project_id` FK (candidate → project) and `projects.source_candidate_id` FK (project → candidate) create a bidirectional lineage that is written atomically: both FKs are set in the same transaction, with a hard-fail if either UPDATE affects a row count other than 1. `quality_status` tracks review state.

**Tutor and engagement**
`ai_tutor_messages`, `ai_chat_sessions`, `audit_logs`. Tutor messages are stored per (user, project, step). A GIN full-text index on `ai_tutor_messages.content` supports search. `audit_logs` is write-only from the API; never read back except by admin queries.

**Billing**
`subscriptions` (Stripe subscription lifecycle), `processedWebhookEvents` (idempotency guard for Stripe webhooks).

---

## 7. Execution and Code-Run Architecture

### 7.1 Browser Sandbox (current)

All code execution runs entirely inside the learner's browser. No learner code is transmitted to or executed on the API server.

```
Browser
├── Pyodide (Python runtime, WASM)
│   └── executes Python code in a sandboxed interpreter
├── DuckDB-WASM (SQL runtime, WASM)
│   └── executes SQL against in-memory or fixture-backed datasets
└── RunAdapter (artifacts/atlas/src/lib/)
    ├── wraps Pyodide/DuckDB calls into the ExecutionAdapter contract
    ├── captures output as RunCapture
    └── optionally: POST /runs/sign → receives SignedRunEnvelope
                    then: POST /submit with envelope attached
```

This design eliminates server-side compute costs for code runs and means network latency never affects the "run" experience. The tradeoff is that the server cannot independently verify that the learner's code actually produced the claimed output (see the honest-claims boundary in Section 8).

### 7.2 ExecutionMode and Platform Model

`lib/execution-core/src/types.ts` defines the closed extension points:

```typescript
ExecutionMode:
  "simulated"        ← ONLY mode currently implemented (Pyodide / DuckDB-WASM)
  "replay"           ← typed, not implemented
  "local_container"  ← typed, not implemented
  "byo_cloud"        ← typed, not implemented
  "managed_sandbox"  ← typed, not implemented

SupportedPlatform:
  "local" | "aws" | "azure" | "gcp" | "snowflake" | "databricks" | "fabric"

HonestyLabel:
  "In-Browser Simulation"
  "Replay (Pre-Recorded Cloud Output)"
  "Local Container"
  "Your Cloud Account"
  "Atlas-Managed Sandbox"
```

`ExecutionProfile` is stored as JSONB on `projects.execution_profile` and optionally on `project_steps.execution_override`. Every step knows which mode it runs in, what services it requires, and what cost label to display.

### 7.3 Future Cloud Lab Architecture (Decision D2)

Future cloud modes (replay, local_container, byo_cloud, managed_sandbox) will be implemented as adapter classes conforming to the `ExecutionAdapter` interface in `lib/execution-core/src/adapters/`. The sandbox-simulation-first principle (D2) means cloud services are initially mocked via fixtures and DuckDB: mock S3, mock Glue/Athena, mock BigQuery, mock Snowflake, mock Databricks tables loaded from parquet fixtures. Real-cloud execution is gated behind a credential-security contract defined in the adapter interface before any learner data reaches an actual cloud provider.

The `FeatureDisabledError` class in execution-core lets the UI surface an honest "this mode isn't enabled yet" message rather than an opaque error when a non-implemented adapter is requested.

---

## 8. Trust and Evidence Architecture

The trust architecture is the most consequential subsystem in Atlas. Its design spans Phases 26–52 and is the reason the platform can make honest learning-signal claims.

### 8.1 /check vs /submit boundary

```
POST /check  (provisional)
  ├── calls gradeSubmission() — pure function, same logic as /submit
  ├── returns grading result to learner
  └── WRITES NOTHING to the database
       └── safe to call repeatedly; no side effects

POST /submit  (durable)
  ├── calls gradeSubmission() — identical grading function
  ├── if passed:
  │   └── db.transaction(() => {
  │         pg_advisory_xact_lock('atlas-submit:' + userId)  ← per-learner serialization
  │         INSERT/UPDATE user_step_completions
  │         INSERT xp_transactions (idempotency-checked)
  │         UPDATE user_progress
  │         UPDATE user_xp / user_streaks
  │       })
  └── WRITES evidence atomically only on pass
```

`gradeSubmission()` in `artifacts/api-server/src/lib/grading.ts` is a pure function. It is the single source of grading truth. It is called identically by both endpoints. This means a learner can `/check` as many times as needed with zero database cost or side effects.

### 8.2 Signed Run Envelope Lifecycle

The signed envelope path (Phases 45–52) adds a layer of evidence integrity without changing the honest-claims ceiling.

```
Browser (post-run)
  RunCapture {code, stdout, stderr, rows, columns, ...}
      │
      │  POST /runs/sign
      │  (requireAuth + enrollment + visibility gate + SIGNABLE_KINDS allowlist)
      ▼
API Server: signRunEnvelope(capture, bindingInput, secret)
  ├── server derives sha256(code) → binding.submissionSha256
  ├── server derives sha256(canonicalize(outputFields)) → binding.outputSha256
  ├── server issues nonce (UUID), issuedAt, expiresAt (TTL: 10 minutes)
  └── HMAC-SHA256(secret, canonicalize(capture) + "\n" + canonicalize(binding)) → signature
      │
      │  returns SignedRunEnvelope
      ▼
Browser stores envelope for the current step session.
      │
      │  POST /submit  {..submission, signedEnvelope: {...}}
      ▼
API Server: verifyRunEnvelope(envelope, {secret, expected, isNonceSeen})
  1. Shape guard (cheap, no DB)
  2. Version check
  3. Signature verify (timingSafeEqual — constant-time)
  4. Recompute hashes, compare to binding (tamper detection)
  5. Binding context match (userId, projectId, stepId, validationKind)
  6. Expiry check
  7. Nonce seen? → INSERT into run_envelope_nonces (burns nonce on first use)
  └── Ok arm: capture is trusted for grading
      Err arm: falls back to plain-submission grading or rejects (canary-gated)
```

The canary gates (`ATLAS_ENVELOPE_REQUIRED_KINDS`, `CANARY_KINDS`, `CANARY_PERCENT`) allow gradual rollout of envelope enforcement per validation kind and by percentage of submissions. Metrics are recorded via `envelopeMetrics.ts` (recordVerifyOk / recordVerifyFailed / recordFallback).

### 8.3 Honest-Claims Boundary (H3)

The envelope architecture proves "Atlas issued this binding for these output bytes at this time" (H3: verified output match). It does NOT prove:
- H1: the learner wrote the code (unverifiable without proctoring)
- H2: the learner executed their own code rather than a copied solution
- That the learner cannot forge a RunCapture and send it to /runs/sign (A5 is a known residual; /sign is rate-limited by auth but cannot detect fabricated captures)

All product copy and certificate language MUST stay within H3. This is enforced by the `CLAUDE.md` guardrail and the `atlas-conventions` skill.

### 8.4 SIGNABLE_KINDS

Only validation kinds that produce inspectable runtime output can carry envelopes. Kinds not in the allow-list (`self_attest`, `exact`, `regex`, `contains`) return 422 from `/runs/sign` by design — they have no runtime output to hash.

Current SIGNABLE_KINDS: `json_equal`, `numeric_tolerance`, `sql_resultset`, `csv_set_equal`, `csv_ordered`.

---

## 9. Curriculum Governance Architecture

The curriculum governance subsystem ensures that only quality-reviewed content reaches learners, and that the provenance of every project is traceable.

### 9.1 Rubric

`lib/curriculum-quality` contains rubric v1.0.1, which is frozen. Its weights and quality gates CANNOT be changed without an explicit ADR and architectural review. All new curriculum content is scored against this rubric before promotion.

### 9.2 Candidate-to-Project Pipeline

```
AI authoring / human proposal
         │
         ▼
project_candidates (status: 'candidate')
         │
         │  quality scoring (rubric v1.0.1)
         │  human review
         ▼
project_candidates (status: 'approved')
         │
         │  promotion (atomic transaction):
         │    INSERT INTO projects (...)
         │    UPDATE project_candidates SET promoted_project_id = new_project.id WHERE id = candidate.id  → must affect 1 row
         │    UPDATE projects SET source_candidate_id = candidate.id WHERE id = new_project.id          → must affect 1 row
         │    (hard-fail if either UPDATE != 1 row)
         ▼
projects (learner_visible: false — hidden by default until explicitly enabled)
         │
         │  admin enable (set learner_visible = true)
         ▼
projects (learner_visible: true — reachable by learners)
```

### 9.3 Hidden-First Principle

Every promoted project starts with `learner_visible = false`. This is Decision D4's application to curriculum: content is hidden by default, human-gated before becoming visible. This applies to all new projects including job-signal authoring factory output.

### 9.4 Course Assignment

`projects.course` is stored directly as a native `atlasCourseEnum` value (9 courses). `mapToCourse` — the legacy heuristic that derived course from project metadata — is never called at runtime. The `check:no-heuristic-runtime` gate in `pnpm run typecheck` enforces this as a build-time invariant.

---

## 10. Security Architecture

### 10.1 Authentication Boundary

Clerk is the identity provider. JWTs are issued by Clerk's CDN to the browser after sign-in. Every API request requiring auth carries the JWT in the Authorization header. `requireAuth` middleware (in `artifacts/api-server/src/lib/auth.ts`) verifies the JWT server-side using `@clerk/express`. The browser never holds the verification secret.

`requireAdmin` chains after `requireAuth` and checks `user.role === 'admin'` from the local users table. Admin operations are on separate routes with a distinct middleware chain.

### 10.2 Authorization

Authorization is checked at the data layer, not just at the route level. Critical checks:
- Project/step ownership: `(id, projectId)` predicate on queries preventing cross-project FK forgery
- Visibility: hidden/archived projects are 404 to learners (no existence leak, no 403)
- Subscription tier: premium projects checked against `user.subscriptionTier === 'pro'`
- Enrollment: envelope signing requires an existing `user_progress` row

### 10.3 Secret Handling

No secrets appear in source code. All secrets are injected via environment variables at runtime (see `TRD.md` for the complete list). Secrets are read lazily at request time (e.g. `RUN_ENVELOPE_SIGNING_SECRET`) so a missing secret degrades gracefully to 503, and a boot-time hard-fail in `src/index.ts` catches missing secrets in production deploys before the server accepts connections.

### 10.4 Input Validation

All API boundaries use Zod schemas (from `lib/api-zod` or inline) to validate request shape before any database interaction. UUID format is validated with a regex before use in SQL predicates. Payload size caps are enforced at the envelope signing endpoint (code: 32KB, stdout/stderr: 64KB, rows: 5000, columns: 256).

### 10.5 SQL Injection

All database queries use Drizzle ORM's parameterized query builder. Raw SQL is used only for DDL in migration files and for tsvector expressions in index definitions, never for user-supplied data.

### 10.6 XSS / CORS

The API is a pure JSON API; it does not serve HTML. CORS is configured for the frontend origin only. Ada tutor SSE responses stream from the Anthropic API through the server; the browser receives text events, not executed scripts.

---

## 11. Deployment and Environment Architecture

### 11.1 Current State (Replit)

The platform was built and has been running on Replit. Replit provides:
- The Node.js runtime
- Postgres (via a Replit-managed database connector)
- Stripe, Resend, and Clerk via Replit Connector sidecars

This creates coupling that is incompatible with a production deployment (see Decision D1).

### 11.2 Target Topology (post-D1 migration)

```
                              ┌─────────────────────┐
                              │   CDN / Edge         │
                              │   (Vercel or CF)     │
                              │                      │
                              │  artifacts/atlas     │
                              │  (static SPA + PWA   │
                              │   service worker,    │
                              │   asset cache)       │
                              └──────────┬───────────┘
                                         │  HTTPS
                                         ▼
                              ┌─────────────────────┐
                              │   API Servers        │
                              │   (Fly.io, 2+ inst.) │
                              │                      │
                              │  artifacts/api-server│
                              │  stateless; env vars │
                              │  injected by Fly     │
                              └──────────┬───────────┘
                                         │  TLS / connection pool
                                         ▼
                              ┌─────────────────────┐
                              │   Neon Postgres      │
                              │   (serverless,       │
                              │    pooler enabled)   │
                              └─────────────────────┘
                              
External services (direct SDK, not Replit connectors):
  Clerk     → @clerk/express (server) + @clerk/react (browser)
  Stripe    → stripe SDK (server only)
  Resend    → resend SDK (server only)
  Anthropic → anthropic SDK (server only, SSE proxy)
```

The API server is designed to be stateless at the HTTP layer: the per-process `userCache` is a performance optimization (see Section 13.1), not a correctness requirement. Multiple instances can safely share the same Postgres database because all durable writes use `pg_advisory_xact_lock` for per-learner serialization.

### 11.3 Migration Runner

`scripts/migrate.ts` applies Drizzle migrations. It is run as a one-off pre-deploy step (e.g. as a Fly.io release command). It does NOT run at server startup.

### 11.4 Nonce Janitor Cron

`scripts/cleanup-run-envelope-nonces.ts` deletes expired rows from `run_envelope_nonces`. It should be scheduled as a nightly cron job (e.g. Fly Machines scheduled job or external cron). Failure of the janitor does not affect correctness — expired nonces are checked by `expiresAt` timestamp, not by deletion — but accumulation of expired rows will degrade index performance over time.

### 11.5 Private Beta (Decision D3)

The initial live deployment targets a private beta audience. Access is controlled at the Clerk level (invitations or allowlist). No architectural components are gated by this — it is an operational decision, not a code change.

---

## 12. Architecture Decision Records

### D1 — Migrate off Replit Connectors

**Context:** Atlas was built on Replit, which provides Postgres, Stripe, Resend, and Clerk via proprietary connector sidecars. These connectors are not available outside Replit's runtime, blocking production deployment to any standard hosting provider.

**Decision:** Replace all Replit connector dependencies with direct SDK calls behind an environment variable adapter. Target deployment: Neon (Postgres), Fly.io (API server), Vercel or Cloudflare Pages (frontend). No Replit-specific runtime dependencies in production code.

**Consequences:**
- All four integrations (Clerk, Stripe, Resend, Anthropic) must be wired to standard environment variables.
- Local development requires `.env` file setup (documented in `TRD.md`).
- Deployment pipeline gains portability and standard observability tooling.
- Risk: connector behavior differences may surface edge cases not covered by existing tests.

---

### D2 — Sandbox-Simulation First for Cloud Labs

**Context:** Atlas's mission includes teaching cloud data-engineering skills (AWS, Snowflake, Databricks, BigQuery, Fabric). Real cloud execution requires credential management, cost controls, and per-learner resource isolation — none of which is implemented.

**Decision:** Cloud lab exercises initially simulate cloud environments using fixtures and DuckDB-WASM in the browser. Mock S3, mock Glue/Athena, mock BigQuery, mock Snowflake, and mock Databricks are implemented via deterministic fixture datasets loaded into DuckDB. Real-cloud execution (byo_cloud, managed_sandbox modes) is gated behind a credential-security contract defined in the `ExecutionAdapter` interface. No learner data touches a real cloud provider until that contract is defined, reviewed, and tested.

**Consequences:**
- Learners can practice cloud-pattern SQL and Python today without a cloud account.
- The `HonestyLabel` "In-Browser Simulation" is displayed, so learners are not misled.
- The adapter interface in `lib/execution-core/src/adapters/` must be stable before cloud modes can ship.
- Future real-cloud modes can be added without changing the frontend or grading logic — only a new adapter implementation is required.

---

### D3 — Private Beta First

**Context:** Atlas has not been deployed to a public audience. Rushing to public launch before core trust, billing, and onboarding flows are validated creates support burden and reputational risk.

**Decision:** Initial live deployment is private beta, invitation-controlled via Clerk. Public launch is a separate decision, not a code change.

**Consequences:**
- No code changes required; access control is an operational setting.
- Beta period is used to validate the trust architecture (envelope path), payment flows, and Ada tutor quality under real load.
- Metrics and error signals from beta inform the public launch readiness decision.

---

### D4 — Job-Signal Authoring Factory: Hidden-First, Human-Gated

**Context:** The curriculum governance pipeline supports AI-assisted bulk generation of job-signal projects. Without a gating mechanism, low-quality or misaligned projects could reach learners automatically.

**Decision:** All projects produced by the authoring factory start with `learner_visible = false`. A human reviewer must explicitly set `learner_visible = true` after reviewing the rubric score, quality breakdown, and project proposal. No automated promotion to learner-visible is permitted.

**Consequences:**
- The authoring factory can run at full speed without exposing draft content.
- Human review remains the final gate for all learner-facing content.
- The `project_candidates` table and the bidirectional lineage FK enforce this pipeline structurally.

---

### D5 — Keep Monorepo Layout (artifacts/lib/scripts)

**Context:** During the build, alternative layouts (apps/packages, src/server, etc.) were considered. Renaming the top-level directories would require updating all import paths, CI configuration, and documentation.

**Decision:** The monorepo layout (`artifacts/*`, `lib/*`, `scripts/`) is frozen. Directory names and workspace roles are canonical and must not be renamed.

**Consequences:**
- All documentation, import paths, and build scripts use these names.
- New packages go into `lib/`; new deployable applications go into `artifacts/`.
- The `scripts/` directory is for operational one-off scripts and cron jobs only.

---

### D6 — Extend-Not-Restart (Preserve the 57-Phase Trust Spine)

**Context:** The platform has 57 phases of carefully accumulated trust-architecture work. Each phase built on invariants established by previous phases. A rewrite would discard this accumulated correctness.

**Decision:** All future development extends the existing architecture. Invariants established by earlier phases (rubric freeze, no-heuristic-runtime guard, honest-claims ceiling, atomic lineage, dark-shipping for graders) are non-negotiable. New phases add capabilities without relaxing existing guarantees.

**Consequences:**
- Onboarding new engineers requires reading the phase history in `docs/phases/` and `HANDOFF.md`.
- The phase ritual (`/atlas-phase-plan`, `/atlas-validate`, `/atlas-phase-close`) is the required process for all architectural changes.
- Performance of the trust invariants (nonce check latency, advisory lock contention) must be monitored as load grows, but correctness is not traded for performance.

---

## 13. Architecture Risks and Evolution

### 13.1 Per-Process User Cache (Multi-Instance Caveat)

`auth.ts` maintains a per-process in-memory `userCache` mapping Clerk IDs to local user rows. This cache is a performance optimization to reduce repeated DB lookups. With multiple API instances, a user's local row update (e.g. subscription tier change) will only be reflected immediately in the instance that processed the update. Other instances will serve stale cached data until the cache entry expires or the process restarts.

**Mitigation:** Cache entries should have a short TTL (seconds to low minutes). For subscription-tier changes that affect paywall access, the billing webhook must ensure cache invalidation or a sufficiently short TTL. The risk is documented here so it is not discovered under load.

### 13.2 Cloud Lab Adapter Complexity

Implementing real-cloud execution (D2, modes: byo_cloud, managed_sandbox) is the largest unsolved architectural problem. Key unknowns:
- Credential lifecycle management for learner BYO accounts
- Cost attribution and spend caps per learner per session
- Ephemeral resource cleanup guarantees
- Output fidelity between simulated fixtures and real cloud services

The adapter interface exists but the implementation contract has not been written. This work requires a dedicated ADR (D7) before any cloud mode ships.

### 13.3 Learner Skill State Model

The current data model tracks progress at the project/step level. A learner skill state model (mapping learner → skill → proficiency) would enable adaptive curriculum routing and personalized recommendations. The `user_progress` table and `learning_mode` enum (`dynamic_ai_adaptive`) anticipate this, but the skill state schema and the algorithm for updating it have not been designed. This is an evolution, not a patch.

### 13.4 PWA and Offline Shell

The `InstallPrompt.tsx` component and manifest exist, but a full service worker with asset caching (Pyodide runtime, DuckDB-WASM binary, critical project data) has not been implemented. A production PWA requires:
- Service worker registration and update lifecycle
- Cache-first strategy for static assets (Pyodide/DuckDB are large; network fetch on first load is acceptable, but subsequent loads should be cached)
- Offline shell: enough HTML/CSS/JS to render the workspace before the network responds
- Background sync for offline check/submit queuing (out of scope for initial PWA)

Pyodide and DuckDB-WASM binaries are large (tens of MB). The caching strategy must be designed to avoid eviction and to handle version upgrades without stale-runtime bugs.

### 13.5 Nonce Store Scale

The `run_envelope_nonces` table grows with every signed submission. The janitor cron handles cleanup, but under high submission volume the table may grow faster than nightly cleanup can prune it. If the janitor falls behind, nonce lookups (`SELECT EXISTS WHERE nonce = $1`) will slow due to table size. Mitigation: ensure the `expires_at` index is used for the janitor's DELETE (it is — the index is defined), and monitor table row count as a service metric.
