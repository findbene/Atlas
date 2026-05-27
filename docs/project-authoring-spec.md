# Atlas Project Authoring Specification

**Version:** 1.0 (Phase 35)
**Status:** Canonical. Every NEW project authored after Phase 35 MUST conform to this spec.
**Scope:** Docs-only. No schema changes. Codifies the de-facto contract already enforced by `lib/curriculum-quality/src/authoring.ts` (`AuthoredProject` + `assertAuthoredProjectComplete`) and the Phase-4 pedagogy audit (`scripts/src/audit-pedagogy.ts`).

This spec is the single source of truth for what "publish-ready" means in Atlas. It exists so the next wave of project authoring can scale to many projects without producing inconsistent shapes that break the learner-mode system (P32/P33), the Ada tutor step contract (P34), the validation runner, the portfolio surface, or the recruiter-facing certificate-verify page.

---

## 1. Why this spec exists

Atlas has 88 project rows today (56 visible, 32 archived-by-hide). The visible 56 are all fully enriched against the Phase-4 pedagogy checklist. The next bottleneck is **production quality at scale** — we cannot mass-seed hundreds of projects casually because every project must work end-to-end with:

- **Guided / Hint / Independent / Adaptive** learner modes (Phase 32).
- **Mode-aware Instructions / Validation / Remediation** panels (Phase 33).
- **Ada Tutor Step Contract** — the per-mode help boundary that ships with every `/api/ai/chat` request (Phase 34).
- The `/check` (preview) and `/submit` (graded) runners — Phase 27 transactional reward integrity.
- The cert-verify (Phase 28) and learner-portfolio (Phase 29) evidence surfaces.

A project that skips any of the requirements below will silently degrade one of those surfaces. This spec exists to prevent that.

---

## 2. Required fields — project-level

Every project MUST satisfy the `AuthoredProject` type in `lib/curriculum-quality/src/authoring.ts:174` AND `assertAuthoredProjectComplete()` in the same file. The fields below mirror that contract.

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `slug` | string | YES | Globally unique. Convention: `<course>-<descriptor>` (e.g. `data-engineering-beginner-csv-cleanup-pipeline`). Lowercase, hyphenated, no underscores. |
| `candidateId` | UUID string | YES (typed, not optional) | Originating `project_candidates.id`. Required for the bidirectional lineage invariant (P11+). Pin in `scripts/src/authored-lineage.ts`. |
| `title` | string | YES | Display title. Recruiter-readable. Can include a tagline after an em-dash. |
| `shortDescription` | string | YES | Teaser, 1–3 sentences. Shown on the project catalog card. |
| `fullDescription` | string | YES | Markdown long-form. Sets the scene; explains what's being built and why. |
| `language` | `"python" \| "sql" \| "both"` | YES | Drives the execution profile + Pyodide pre-load. |
| `difficulty` | `"beginner" \| "intermediate" \| "advanced"` | YES | One of the three values in `difficultyLevelEnum`. Must be justified — see §7. |
| `techStack` | string[] | YES | Tools/libraries used. Shown as chips. Use canonical casing: `Python`, `pandas`, `DuckDB`, `pgvector`. |
| `tags` | string[] | YES | Lowercase; the course slug MUST be the first tag. Used for filtering. |
| `learningObjectives` | string[] | YES | 3–7 specific, learner-actionable outcomes. Not vague ("learn Python") — concrete ("use `keep_default_na=False` to disable magic NA conversion"). |
| `estimatedMinutes` | integer ≥ 60 | YES | Realism scorer awards the duration bonus only at ≥60min. Be honest — pad if needed but do not lie. |
| `xpReward` | integer | YES | Roughly `estimatedMinutes × 3`. The reward ledger (P26) is the source of truth. |
| `isMultiFile` | boolean | YES | True for Phase-7+ projects (≥4 steps). False only for single-file mastery modules. |
| `meta` | `AuthoredProjectMeta` | YES | See §3. |
| `portfolio` | `AuthoredPortfolioArtifact` | YES | See §4. |
| `steps` | `AuthoredStep[]`, length ≥ 4 | YES | See §5. |

Hard `assertAuthoredProjectComplete` invariants (verbatim from `lib/curriculum-quality/src/authoring.ts:206`):

- `steps.length >= 4`.
- `estimatedMinutes >= 60`.
- `meta.scenario`, `meta.hiringRelevance2026`, `meta.readmeOutline.length >= 4` all present.
- `portfolio.portfolioRelevance.length >= 20`.
- All `stepNumber`s are unique within the project (the asserter does NOT additionally check that step numbers form a 1..N sequence — sequence/1-indexing is a strong convention enforced by `audit:authoring`, not by the type-time asserter).
- Per step: `starterCode.length >= 10`, `validation.spec` non-empty, `expectedOutputs` non-empty, and all 10 `pedagogy.*` fields are non-empty strings.

---

## 3. `meta` — recruiter-facing framing

`AuthoredProjectMeta` (`lib/curriculum-quality/src/authoring.ts:119`).

| Field | Required | Purpose |
| ----- | -------- | ------- |
| `scenario` | YES | Real workplace situation the learner steps into. 2–4 sentences. Concrete role, concrete pain. Bad: "you are a data engineer." Good: "Junior DE at a 2026 SaaS company. Marketing dumps a weekly customer export as CSV into S3 from their CRM…" |
| `hiringRelevance2026` | YES | One paragraph: why a 2026 hiring manager cares about THIS specific artifact. Not generic — call out the exact signal recruiters screen for. |
| `readmeOutline` | YES, ≥4 h2 sections | Section titles for the GitHub README the learner will publish. Minimum: Overview, Setup, Steps, Validation. Use the actual step titles where appropriate. |

---

## 4. `portfolio` — what the learner ships

`AuthoredPortfolioArtifact` (`lib/curriculum-quality/src/authoring.ts:100`).

| Field | Required | Purpose |
| ----- | -------- | ------- |
| `kind` | YES | `"repo" \| "dashboard" \| "report" \| "service" \| "notebook"` (the exact `PortfolioArtifactKind` union). Most projects → `"repo"`. Use `"service"` for a deployed HTTP service, NOT `"deployment"` (that string is not in the type). |
| `deliverable` | YES | Concrete artifact description. List actual files / table names / endpoints. Bad: "a working pipeline." Good: "Public GitHub repo: `src/clean.py` implementing the 5 steps, `fixtures/customers_raw.csv`, `fixtures/clean_expected.csv`, `tests/test_clean.py`." |
| `portfolioRelevance` | YES, ≥20 chars | Why THIS deliverable is a high-signal interview artifact — distinct from `meta.hiringRelevance2026` (that's about the topic; this is about the artifact itself). |
| `demoUrl` | optional | Live demo if applicable. |
| `repoUrl` | optional | GitHub URL placeholder; use `https://github.com/<your-handle>/<repo>` so the learner forks it. |

---

## 5. `steps[]` — per-step contract

`AuthoredStep` (`lib/curriculum-quality/src/authoring.ts:137`). Every project needs ≥4 steps.

| Field | Required | Notes |
| ----- | -------- | ----- |
| `stepNumber` | YES, unique, 1-indexed | |
| `title` | YES | Short, action-oriented ("Tolerant read — BOM, dtypes, NA control"). |
| `instructionMd` | YES | Markdown. **Long-instruction disclosure (P33) is mode-aware on the frontend** — the panel collapses long instructions for `independent` learners. Author for the guided/hint reader; the panel handles disclosure. |
| `learningObjective` | YES | One sentence. Pedagogy-audit field — see §6. |
| `requiredSkill` | YES | One short noun phrase (e.g. `"read_csv with encoding='utf-8-sig' + dtype=str + keep_default_na=False"`). Pedagogy-audit field — see §6. |
| `starterCode` | YES | Compilable scaffold the learner edits. Must have explicit `TODO` markers. |
| `stepType` | YES | `"code_python" \| "code_sql" \| "multi_file" \| "writeup"`. |
| `validationType` | YES | One of `self_attest`, `sql_resultset`, `json_equal`, `exact`, `regex`, `contains`, `numeric_tolerance`, `csv_set_equal`, `csv_ordered`. Persisted to `project_steps.validation_type`. See §5.1. |
| `validation` | YES | `AuthoredValidationConfig` — exactly three fields: `kind` (matches `validationType` 99% of the time), `description` (plain-language summary), and `spec` (kind-specific jsonb payload the runner reads). Persisted to `project_steps.validation_config`. |
| `expectedOutputs` | YES | Concrete expected fixtures (rows, JSON, file contents). Persisted to `project_steps.expected_outputs` (jsonb). |
| `datasetRefs` | optional but encouraged | Concrete filenames or table names — drives the realism scorer's `hasDatasetRefs`. |
| `pedagogy` | YES, `Required<PedagogyConfigShape>` | All 5 hint levels + feedback pair + portfolio relevance. See §6. |

### 5.1 Validation requirements

Every step MUST have a **machine-verifiable** validation OR be explicitly marked `self_attest` with a justification comment. `self_attest` is acceptable only for write-up / design steps where there is no objective right answer.

**Project-level invariant:** at least ONE step in every project must be machine-verifiable (i.e. not every step can be `self_attest`). A project where every step is `self_attest` provides no real evidence for the portfolio / cert-verify surface and is flagged by `audit:authoring` as `all-steps-self-attest`.

Validation contract:

- The runner returns a `RunResult`; the scorer in `lib/execution-core/src/validate.ts` compares against `expectedOutputs`.
- `expectedOutputs` MUST be deterministic. No timestamps, no random IDs, no environment-dependent values.
- For `csv_set_equal` / `sql_resultset`: order-insensitive comparison. Use this whenever order doesn't matter.
- For `csv_ordered`: order matters. Use only when required (e.g. ORDER BY tests).
- For `numeric_tolerance`: include the tolerance in `validation.spec`.
- For `exact` / `contains` / `regex`: prefer `contains` over `exact` to allow trivial whitespace differences; prefer `regex` only when there's a real reason.

---

## 6. Pedagogy — required for `/api/ai/chat` + hint ladder + remediation

Every step's `pedagogy` MUST satisfy the **5/5 pedagogy audit** (`scripts/src/audit-pedagogy.ts:25`). Missing any of these makes the project fail the `audit:pedagogy` gate.

| Field | Required | Used by |
| ----- | -------- | ------- |
| `learningObjective` (step-level) | YES | Ada system prompt (P34 `<step_pedagogy>` block); InstructionsPanel; pedagogy audit. |
| `requiredSkill` (step-level) | YES | Ada system prompt; pedagogy audit. |
| `pedagogy.hintLevel1` | YES, non-empty | Hint ladder L1 (gentle nudge — direction only). |
| `pedagogy.hintLevel2` | YES, non-empty | Hint ladder L2 (clarify the relevant concept). |
| `pedagogy.hintLevel3` | YES, non-empty | Hint ladder L3 (show the API / function name). |
| `pedagogy.hintLevel4` | YES, non-empty | Hint ladder L4 (give pseudocode shape — NOT the answer). |
| `pedagogy.hintLevel5` | YES, non-empty | Hint ladder L5 (almost-solution; reserved for guided + struggle-rescue). |
| `pedagogy.successFeedback` | YES | RemediationPanel; AI tutor success-path. |
| `pedagogy.failureFeedback` | YES | RemediationPanel default copy. |
| `pedagogy.portfolioRelevance` | YES | Per-step recruiter context shown in the portfolio surface (P29). |

### 6.1 Hint ladder anti-leak rules (Phase 34 invariant)

Every hint level above L4 MUST stop short of revealing the literal expected output or final code answer. The tutor contract for `independent` mode is pinned to `diagnostic-only` and will refuse to leak — but if the hint ladder itself leaks, that refusal becomes inconsistent. Anti-leak checks:

- Do not paste the expected output verbatim in any hint level.
- Do not paste the final `starterCode` solution in L1–L4.
- L5 may show "almost-solution shape" — never a copy-paste-able full answer.
- The `failureFeedback` must NOT contain the literal expected fixture; describe the failure mode, not the answer.

---

## 7. Difficulty alignment

`difficulty` ∈ `{beginner, intermediate, advanced}`. Audited by `scripts/src/audit-difficulty.ts` + `audit:difficulty-labels`.

Calibration:

- **beginner**: ≤180 min budget. 4–5 steps. No cloud / Docker / API-key dependencies. Single-file or 2-file repo. Prerequisites: language fundamentals only.
- **intermediate**: 180–360 min budget. 5–8 steps. May use one external system (DuckDB, sqlite, pgvector locally). No production secrets, no paid SaaS account.
- **advanced**: 360+ min budget. 6–10 steps. May orchestrate multiple systems (Kafka + Spark, Iceberg + Snowflake). MUST disclose any paid / cloud dependency explicitly in `meta.scenario`.

Hidden cost rule: if a project requires a paid account (Snowflake trial, OpenAI API key, paid GitHub action, etc.), it MUST be called out in BOTH `meta.scenario` AND `fullDescription`. The publish-readiness checklist gates on this.

---

## 8. Role-path / course alignment

`projects.course` is the source of truth for role-path mapping (P8). One of the 9 Atlas courses:

`data-engineering` · `ai-engineer` · `mlops-engineer` · `data-scientist` · `analytics-engineer` · `applied-llm-engineer` · `cloud-data-engineer` · `python-libraries` · `sql`

Rules:

- Slug prefix MUST match the course (e.g. `analytics-engineer-*` → course `analytics-engineer`).
- The slug → course mapping is pinned in `scripts/src/authored-lineage.ts` (`COURSE_FOR_AUTHORED_SLUG`). Adding a new project means adding the line there too.
- `course_source` MUST be `'authored'` (not `'heuristic_legacy'`) for any new Phase-35+ project.
- The `tags[]` array MUST include the course slug as its first entry.
- Per-project `job_outcomes` (jsonb) is optional but encouraged for advanced projects targeting specific role bands.

---

## 9. Learner-mode compatibility

Every authored project automatically works with all 4 learner modes (Phase 32/33/34) because mode-awareness is implemented at the panel + tutor-contract layer, not the project layer. However, authors MUST sanity-check:

| Mode | What the author needs to verify |
| ---- | ------------------------------- |
| **Guided** | Hint ladder reads top-down without leaving gaps. L1 → L2 → L3 should feel like one continuous coaching conversation. |
| **Hint** | The 5-level ladder caps correctly: L5 should NOT be a full solution. |
| **Independent** | The `instructionMd` makes sense WITHOUT the hint ladder. The independent learner sees instructions + validation feedback only — if those alone are insufficient, the project is under-specified. The dampened-diff remediation (P33) will show lengths + first-divergence index, never the expected string. |
| **Adaptive** | Default is `hint` cadence, rescuing to `guided` on struggle signals. Means: the hint ladder must be conservative at L1–L3 (won't fire rescue unless attempts/level cross thresholds). |

---

## 10. Ada tutor compatibility (Phase 34)

When the learner clicks "Ask Ada", the AI tutor request injects:

- The project context (slug, course, title).
- The current step (stepNumber, title, learningObjective, requiredSkill).
- The pedagogy block (hint ladder + feedback pair + portfolioRelevance).
- The tutor contract (helpBoundary, allowed/forbidden behaviors, validationGuidance, responseStyle).

This means: **every authored field above flows directly into Ada's system prompt.** A vague `learningObjective` or a missing `requiredSkill` makes Ada vague. A leaky `hintLevel5` makes the tutor contract internally inconsistent. Author for Ada as well as for the learner.

---

## 11. Portfolio + cert-verify compatibility

When the learner completes a project, the P28 cert-verify endpoint and P29 portfolio surface expose:

- `stepsCompleted / totalSteps` (from `project_steps.length` + `user_step_completions`).
- `evidenceHashCount` (from `submission_sha256` on each completion).
- `totalXpEarned` (from `xp_transactions` scoped to the project).
- `firstStepCompletedAt`, `durationSeconds`.

For this to be meaningful, the project MUST have:

- A non-trivial `xpReward` (per §2).
- Real validation per step (so `submission_sha256` reflects actual work).
- A concrete `portfolio.deliverable` (so the recruiter can actually click through).
- A meaningful `portfolio.portfolioRelevance` (recruiter context).

---

## 12. What is OUT of scope for the authoring spec

- **Schema changes.** The spec encodes the existing schema; it does not propose new columns.
- **Mutating existing projects.** This spec applies to NEW projects (Phase 35+). Existing 56 fully-enriched projects are grandfathered.
- **Auto-generating projects from an LLM.** Project authoring is intentionally a human craft step; this spec is the checklist a human author works against.
- **Re-running `/check` /` /submit` semantics.** The runner is governed by `execution-core` + Phase 27 transactional integrity; the authoring spec only governs the data the runner reads.
- **Cert-verify / portfolio / billing semantics.** Frozen as of P28/P29.

---

## 13. How to use this spec

1. Copy `docs/templates/project-template.md` into your scratchpad and fill it in.
2. Work through `docs/templates/project-publish-readiness-checklist.md` and check every gate.
3. Translate the filled template into a `scripts/src/authored/<course>__<slug>.ts` file using the `AuthoredProject` type.
4. Add the slug → course line to `scripts/src/authored-lineage.ts`.
5. Add the slug → candidate UUID line to `scripts/src/authored-lineage.ts` (`CANDIDATE_FOR_AUTHORED_SLUG`).
6. Promote with `pnpm --filter @workspace/scripts run author:project`.
7. Run gates:
   - `pnpm --filter @workspace/scripts run audit:pedagogy` — MUST stay at 100% visible coverage.
   - `pnpm --filter @workspace/scripts run audit:authoring` — NEW (Phase 35) DB-side authoring contract audit.
   - `pnpm --filter @workspace/scripts run audit:difficulty-labels` — difficulty alignment.
   - `pnpm run typecheck` — verifies the `AuthoredProject` static type (field presence, enum values, hint-ladder arity).
   - **Runtime gate:** `assertAuthoredProjectComplete(project)` is a runtime function that throws on contract violation. It is invoked by the promote flow (`pnpm --filter @workspace/scripts run author:project`) before the DB write — typecheck alone does NOT exercise it. Authors can invoke it directly in a unit test if they want a fast local check.
8. Manually walk the project end-to-end in all 4 learner modes before flipping `learner_visible=true`.

---

## 14. Version history

- **1.0 (Phase 35)** — initial spec. Codifies the de-facto contract already enforced by `AuthoredProject` + the Phase-4 pedagogy audit. No schema changes.
