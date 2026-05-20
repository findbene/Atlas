### Phase 6 — Nine-Course Curriculum + Candidate Generation Pipeline

Locks the 9-course taxonomy and ships a deterministic (NO LLM) candidate generation → import → score → report pipeline. Rubric stays frozen at `RUBRIC_VERSION='1.0.1'`.

**Source-of-truth files:**
- `.local/job-demand-map.md` — 2026 job-demand anchors (authoritative).
- `.local/course-skill-maps.md` — per-course skill ladders + Py/SQL depth + tier-1 stack + portfolio outcomes.
- `lib/curriculum-quality/src/COURSE_TAXONOMY.ts` — typed `COURSE_TAXONOMY` (`COURSE_TAXONOMY_VERSION='1.0.0'`) + `skillCoverage()` helper. NOT a rubric dimension — used by the generator and report only.

**Proposal schema:** Phase-6 generator uses `proposalStrictSchema` (11 required fields incl. `pythonDepth`, `sqlDepth`, `cloudTooling`, `portfolioArtifact`, `validationIdea`, `executionMode`, `learnerOutcome`). Loose `proposalSchema` still accepts pre-Phase-6 rows. `executionMode` enum: `pyodide | sandboxed-node | external-runner | self-attest | sql-runner`.

**Candidate scoring carve-out (kept from Phase 5):** `composeScorecard(input, { steps, neighbors, stage: 'candidate' })` excludes the `pedagogy` dimension (renormalizes 5 weights to 100). `scripts/src/quality-adapter.ts candidateRowToContext` is the canonical translation: `validationType='self_attest'`, `type=code_sql` if SQL-only else `code_python`, `isMultiFile=steps.length>=4`, language inferred via regex on stack/title.

**Batch format:** `.local/candidate-batches/<YYYY-MM-DD>-<course-slug>-v<n>.json`. Schema lives in `lib/curriculum-quality/src/batchSchema.ts` (`batchFileSchema`, `parseBatchFile`). Thin FS adapter at `scripts/src/lib/batch.ts` (`loadBatch`, `findBatchByIdOrPath`, `BATCH_DIR`).

**CLI:** `pnpm --filter @workspace/scripts run candidates:batch -- {generate|import|score-batch|report} [...]`.
- `generate --course=<slug> --count=10 [--all]` — deterministic skeletons from `COURSE_TAXONOMY × archetypes × portfolio outcomes`. NO LLM, NO step authoring. Writes batch file under `.local/candidate-batches/`.
- `import <path>` — validates with `proposalStrictSchema`, inserts into `project_candidates` with `status='candidate'`, idempotent on `(proposedTitle, proposedCourse)`. One transaction per batch (≤10 rows).
- `score-batch <path>` — wraps the existing scorer for every row, prints summary (median, ≥60, ≥70, dup-flag count).
- `report` — see catalog:report below.

**Path resolution caveat:** `pnpm --filter` runs from `scripts/`, so `BATCH_DIR` and CLI path args resolve against `process.env.INIT_CWD || process.cwd()` (the user's original cwd, i.e. workspace root). Without this, `.local/candidate-batches/...` writes/reads land in `scripts/.local/...`. If you ever invoke the script outside pnpm and INIT_CWD is unset, just pass absolute paths.

**`catalog:report --include-candidates`** appends 9 new sections after the existing project report: course×difficulty, course×portfolio-kind, course×Py-depth, course×SQL-depth, course×top-stack, course×role, per-course quality distribution (R-7 linear-interpolated percentiles), projects-vs-candidates side-by-side, duplicate warnings, course×difficulty×portfolio gap detection, strongest/weakest 10. JSON shape is additive (`totals.candidates`, `candidates` object) so existing consumers don't break. `GET /api/admin/quality` returns the extended JSON automatically.

**Phase-6 baseline (90 candidates × 9 courses, 2B/3I/5A):** 0 Zod fails, 90/90 imported, **70/90 ≥60**, **20/90 ≥70**, 0% duplicate-flag, every course ≥2 candidates ≥60. Strongest cluster: ai-engineer (RAG/observability), cloud-data-engineer (Iceberg/Hudi). Weakest cluster: `sql` foundation projects + intro `data-scientist` labs — expected, both are skill-ladder primers without production-realism signals. Lib tests 48/48 pass; full `pnpm run typecheck` PASS.

**Phase-7 entry conditions (not in Phase 6):** authoring full project steps + pedagogy_config for promoted candidates, extending the DB `learning_mode` enum, mass project generation (1,080 target), candidate→project promotion path with audit-logged transitions.

