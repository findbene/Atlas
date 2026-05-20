### Phase 7 — Promoted Candidates → Authored Projects

Authored 18 candidates (2/course nominal — actual distribution skewed to candidate availability) into fully-authored, learner-facing projects under frozen rubric v1.0.1. NO rubric edits, NO bulk auto-approval, NO placeholder steps.

**Authoring pipeline:**
- `scripts/src/authored/<course>__<slug>.ts` — each project is a `AuthoredProject` const (typed in `lib/curriculum-quality/src/authoring.ts`) with `projectMeta`, 5 fully-authored steps, each carrying `starter_code`, `validation_config`, `expected_outputs`, and a `pedagogy_config` (L0–L5 hint ladder + success/failure feedback + portfolio_relevance + misconception + finalExplanation).
- `scripts/src/authored/index.ts` — barrel that exports `AUTHORED_PROJECTS[]` + `findAuthored(slug)`.
- `scripts/src/author-project.ts` — CLI: `pnpm --filter @workspace/scripts run author:project -- {promote|audit|wave-report} <slug>`. `promote` upserts the project + steps; `audit` re-scores under stage='project' (full pedagogy weight); `wave-report` writes `.local/phase7-wave-report.{md,json}`.
- Helper template tags: `SRC()` (identity), `pedagogyConfig()`, `validationConfig()`, `portfolioArtifact()`, `projectMeta()` from `@workspace/curriculum-quality`.
- **Template-literal escape gotcha:** any `${...}` in HCL / Jinja / GitHub-Actions snippets inside SRC() blocks must be escaped as `\${...}`; backticks inside snippets must be removed or escaped (broke `data-engineering__cdc-debezium.ts` and `data-scientist__notebook-to-production.ts` until fixed).

**Phase 7 final gate (all PASS):**
- 18/18 authored projects score ≥70 under rubric v1.0.1 (range 75.3–90.9, mean ~84.6).
- Anchor drift: `csv-to-postgres-pipeline=70.5` (unchanged), `dbt-data-models=72.7` (unchanged) — 0.0 drift on both.
- Validation coverage: 100% — every step has a typed `validation_config` (`json_equal | sql_resultset | exact | numeric_tolerance`).
- Pedagogy completeness: 100% — every step has objective + required_skill + 5-level hint ladder + success/failure feedback + portfolio_relevance.
- Portfolio readiness: 100% — every project has a typed `portfolioArtifact` (kind `repo|service`) with README outline.
- Full `pnpm run typecheck` PASS. `curriculum-quality` tests 54/54 PASS. `api-server` tests 45/45 PASS. `audit:pedagogy` reports 20/65 fully enriched (was 10/65 — the +10 increase matches the 10 new Phase-7 modules with full enrichment; legacy projects remain on the `hints[]` fallback).
- All 18 candidate rows transitioned `candidate → approved` via `candidates approve --reason` (each transition is a single CLI call; `--force` used because candidate-stage scoring excludes pedagogy and several land below 70 in that stage even though they audit ≥70 as authored projects with pedagogy).

**Wave outputs:** `.local/phase7-wave-report.{md,json}` is the canonical Phase-7 result. `.local/catalog-quality-report.{md,json}` (run with `--include-candidates`) shows the Phase-7 cohort dominates the strongest-10 candidates list.

**Course-domain mapping (Phase 7):** the DB only ships 4 `domains` rows (`ai-engineering`, `ai-mlops`, `data-engineering`, `data-science`) and one track per domain, but Phase 7 spans 9 Atlas courses. `scripts/src/author-project.ts` owns the authoritative `COURSE_FOR_AUTHORED_SLUG` map (per-slug course intent) + `COURSE_TO_DOMAIN_SLUG` (course → DB domain) to write the correct FK on promote. The earlier behavior (`defaultDomainAndTrack` returning the first row) silently misclassified every promoted project — fixed in Phase 7 final gate. Wave-report now prints both `Intended Course` (authored intent) and `Mapped (heuristic)` (whatever `mapToCourse` re-derives from domain+tags); the `⚠` next to a mapped value flags a heuristic disagreement (e.g., `data-scientist-notebook-to-production` is intentionally `data-scientist` but `mapToCourse` routes it to `mlops-engineer` because of the `mlflow` tag). The disagreement is expected for cross-cutting topics and is informational.

**Known gaps before Phase 8:**
1. Candidate→project promotion path is still manual — the authoring pipeline writes directly into `projects`/`project_steps`; we have not yet stamped the source `candidate_id` onto the resulting project row (audit trail relies on the approve log + the `authored/<file>.ts` candidateId comment).
2. DB `learning_mode` enum still lacks `dynamic_ai_adaptive` (Phase-6 carry-over). All Phase-7 modules use `guided` as the alias.
3. 45/65 catalog projects still on `hints[]` fallback; needs to be rolled into a Phase-8 mass-author pass.
4. `requireAdmin` middleware promotion (Phase-5 carry-over) still pending — `/api/admin/quality` reuses `requireAuth`.
5. `mapToCourse` (in `lib/curriculum-quality/src/courses.ts`) prioritizes stack keywords (e.g., Snowflake → cloud-data-engineer, mlflow → mlops-engineer) over the authored intent course. For Phase 8, either (a) extend the DB taxonomy to model the 9 courses natively, or (b) thread the authored course onto the project row so reports don't need to re-derive it heuristically.
6. Audit-score inflation risk: `pythonSqlDepth` and `pedagogy` dimensions are partly heuristic (instruction-length + keyword regex; field presence vs conceptual correctness). Scores are reliable as a floor but should not be read as a ceiling on quality.

