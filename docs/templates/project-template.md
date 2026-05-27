# Atlas Project Authoring Template

> Copy this file into your scratchpad as `<course>-<slug>.md` and fill it in.
> Then translate to `scripts/src/authored/<course>__<slug>.ts` using the `AuthoredProject` type from `@workspace/curriculum-quality`.
>
> **Read first:** [`docs/project-authoring-spec.md`](../project-authoring-spec.md). This template is the operational form of that spec.
>
> Anything in `<angle brackets>` is a placeholder to replace. Anything in italics is author guidance — delete before submitting.

---

## Identity

- **slug:** `<course>-<short-descriptor>` *(lowercase, hyphenated, no underscores; course prefix MUST match `course` below)*
- **candidateId:** `<UUID>` *(pin in `scripts/src/authored-lineage.ts`; run `pnpm --filter @workspace/scripts run candidates` to mint one)*
- **title:** `<Recruiter-readable title — Optional tagline after em-dash>`
- **course:** `<one of: data-engineering | ai-engineer | mlops-engineer | data-scientist | analytics-engineer | applied-llm-engineer | cloud-data-engineer | python-libraries | sql>`
- **language:** `<python | sql | both>`
- **difficulty:** `<beginner | intermediate | advanced>` *(see spec §7 — calibration is enforced)*
- **estimatedMinutes:** `<integer ≥ 60>` *(be honest — pad if you have to, but no fiction)*
- **xpReward:** `<≈ estimatedMinutes × 3>`
- **isMultiFile:** `<true | false>` *(true for ≥4-step projects, which is every Phase-7+ project)*

---

## Overview

### shortDescription *(1–3 sentences; shown on the catalog card)*

<one paragraph>

### fullDescription *(markdown; long-form scene-setter)*

<2–6 paragraphs>

### Why this matters professionally

<one paragraph — what does a 2026 hiring manager actually screen for here? Be concrete about the role band and the signal.>

---

## Prerequisites & tools

### Prerequisites *(skills the learner must already have)*

- <prereq 1>
- <prereq 2>

### techStack[] *(canonical casing — `Python`, `pandas`, `DuckDB`, `pgvector`, `dbt`, `Apache Spark`, etc.)*

- <tool 1>
- <tool 2>

### tags[] *(lowercase; course slug MUST be first)*

- <course-slug>
- <topic-tag>
- <difficulty-tag>

### Hidden / external dependencies

> If this project requires a paid account, an API key, Docker, a cloud trial, or anything beyond the Atlas browser environment, list it HERE and ALSO in `meta.scenario`. This gate is enforced by the publish-readiness checklist.

- <none | or: requires OpenAI API key in `OPENAI_API_KEY`>

---

## learningObjectives[] *(3–7 specific, learner-actionable outcomes)*

1. <not "learn pandas" — "use `keep_default_na=False` to disable magic NA conversion">
2. <…>
3. <…>

---

## meta (recruiter framing)

### scenario *(real workplace situation, 2–4 sentences)*

<concrete role + concrete pain. Example: "Junior DE at a 2026 SaaS company. Marketing dumps a weekly customer export as CSV into S3 from their CRM. The CRM is old, the export is messy, and the downstream warehouse load fails on any whitespace, encoding, or duplicate issue.">

### hiringRelevance2026 *(one paragraph)*

<what specific 2026 hiring signal does this artifact map to? Bad: "useful skill." Good: "Tolerant ingest + normalisation + dedupe + reject-tracking is the canonical 'can you actually clean data' interview screen.">

### readmeOutline[] *(≥4 h2 sections — Overview, Setup, Steps, Validation minimum)*

1. Overview — <…>
2. Setup — <…>
3. <Step 1 title>
4. <Step 2 title>
5. …
6. Portfolio Hand-off

---

## portfolio

- **kind:** `<repo | dashboard | report | service | notebook>` *(exact union — note: it's `service`, not `deployment`)*
- **deliverable:** <concrete artifact — list actual files, table names, endpoints. Bad: "a working pipeline." Good: "Public GitHub repo: `src/clean.py` implementing the 5 steps, `fixtures/customers_raw.csv` with BOM + duplicates + bad dates, `tests/test_clean.py` running each step + diffing outputs against expected fixtures.">
- **portfolioRelevance:** <≥20 chars — why THIS artifact is high-signal; distinct from `hiringRelevance2026` which is about the topic>
- **repoUrl** *(optional)*: `https://github.com/<your-handle>/<repo>`
- **demoUrl** *(optional)*: <live URL if applicable>

---

## Dataset / input assumptions

> What does the learner start with? List exact filenames, table schemas, row counts, expected values. Validation depends on this being deterministic.

- <fixture 1>: <schema + size>
- <fixture 2>: <schema + size>

---

## Steps *(MUST be ≥ 4)*

> For EVERY step, fill in EVERY subsection. Missing any pedagogy field breaks `audit:pedagogy` (the 5/5 enrichment gate). Missing any validation field breaks `audit:authoring`.

### Step 1: <action-oriented title>

- **learningObjective:** <one sentence — what does this step teach?>
- **requiredSkill:** <short noun phrase — the concrete skill/API used>
- **stepType:** `<code_python | code_sql | multi_file | writeup>`
- **datasetRefs[]:** <concrete filenames or table names — drives the realism scorer>

#### instructionMd *(markdown shown to the learner)*

<the actual instructions. Long-instruction disclosure is mode-aware on the frontend (P33) — write for the guided/hint reader; the panel handles collapse.>

#### starterCode *(compilable scaffold with explicit TODO markers)*

```python
# src/file.py
import ...

def fn():
    # TODO: <what the learner does>
    pass
```

#### Validation

- **validationType:** `<self_attest | sql_resultset | json_equal | exact | regex | contains | numeric_tolerance | csv_set_equal | csv_ordered>`
- **validation.kind:** `<same as validationType 99% of the time>`
- **validation.description:** <plain-language summary of what's being checked>
- **validation.spec:** <jsonb payload the runner reads — e.g. file paths, tolerances, table names. Persisted to `project_steps.validation_config`. MUST be non-empty (enforced by `assertAuthoredProjectComplete`).>
- **expectedOutputs:** <CONCRETE expected fixture — rows, JSON, file contents. MUST be deterministic AND non-empty; no timestamps, no random IDs.>

> **Validation choice guide:**
> - `csv_set_equal` — order-insensitive CSV comparison. Default for tabular outputs where order doesn't matter.
> - `csv_ordered` — order matters (e.g. an ORDER BY test).
> - `sql_resultset` — query returns matching rows.
> - `json_equal` — exact JSON shape.
> - `numeric_tolerance` — float comparison; include `tolerance` in `validation.spec`.
> - `contains` — preferred over `exact` for forgiving whitespace.
> - `exact` — only when whitespace really matters.
> - `regex` — only when there's no better choice.
> - `self_attest` — ONLY for write-up / design steps with no objective right answer. Justify in a comment.

#### Hint ladder *(ALL 5 LEVELS REQUIRED — see spec §6.1 for anti-leak rules)*

- **hintLevel1** — gentle nudge, direction only: <…>
- **hintLevel2** — clarify the relevant concept: <…>
- **hintLevel3** — show the API / function name: <…>
- **hintLevel4** — give pseudocode shape (NOT the answer): <…>
- **hintLevel5** — almost-solution (reserved for guided + struggle rescue; MUST stop short of a copy-paste-able final answer): <…>

#### Feedback pair *(REQUIRED)*

- **successFeedback:** <what to say when the learner passes — celebrate the right thing>
- **failureFeedback:** <what to say when the learner fails — describe the failure MODE, never echo the expected fixture>

#### portfolioRelevance *(per-step recruiter context, REQUIRED)*

<one sentence — why does completing THIS specific step matter to a recruiter? Shown in the P29 portfolio surface.>

#### Common failure modes & remediation

> Author-facing notes. Helps the next author understand what learners actually trip on. Optional but encouraged.

- <failure 1>: <what to look for; what the panel will show>
- <failure 2>: …

---

### Step 2: <title>

*(same structure as Step 1)*

---

### Step 3: <title>

*(same structure)*

---

### Step 4: <title>

*(same structure — REMINDER: ≥4 steps minimum)*

---

## Final deliverable summary

> Restate the end state. What does the learner have when they finish? Should map 1:1 to `portfolio.deliverable`.

- <file/artifact 1>
- <file/artifact 2>

---

## GitHub README summary *(seed copy for the learner's repo)*

> One paragraph (~80 words) the learner can paste into their `README.md`. Recruiter-readable, concrete, no Atlas marketing language.

<paragraph>

---

## LinkedIn post draft seed

> Optional seed copy the learner can adapt when sharing the completed project. Keep it humble, concrete, and link-friendly.

> Just shipped <project>: <one-line concrete outcome>. Built with <techStack>. Repo: <link>.
>
> What I learned: <2 bullets — specific, not generic>.

---

## Admin review notes

> Author-facing — not shown to learner. The reviewer uses these + the publish-readiness checklist before flipping `learner_visible=true`.

- **Why this difficulty:** <justify per spec §7>
- **What's the riskiest step:** <…>
- **Does Ada have enough context per step:** <yes/no per step + why>
- **Walked end-to-end in all 4 learner modes:** `[ ] guided  [ ] hint  [ ] independent  [ ] adaptive`
- **No answer leakage in any hint level:** `[ ]`
- **No hidden paid/cloud dependency:** `[ ]` (or disclose where)
- **Reviewer:** <name>  **Date:** <YYYY-MM-DD>
