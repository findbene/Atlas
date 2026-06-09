/**
 * Phase 9 — batch-1 upgrade. cloud-data-engineer / dbt macros mastery.
 * Synthetic candidate 08624753-d098-4c13-b87e-9936bb68a48c (source=phase9_upgrade).
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const cloudDataEngineerDbtMacrosMastery: AuthoredProject = {
  slug: "cloud-data-engineer-dbt-macros-mastery",
  candidateId: "08624753-d098-4c13-b87e-9936bb68a48c",
  title: "dbt Macros — Reusable, Portable, Testable SQL at Scale",
  shortDescription:
    "Master Jinja-powered dbt macros: write surrogate-key/pivot/date-spine helpers used across 40+ models, dispatch for warehouse portability, and macro unit tests that catch regressions before CI.",
  fullDescription:
    "Macros are dbt's superpower: write `dim_currency_conversion` once and call it from 40 models. You'll write `surrogate_key` that handles NULLs correctly, `pivot` that beats the built-in, a `date_spine` that fills missing days, then learn `dispatch` (warehouse portability) and macro unit testing (dbt 1.8+). The line between junior and senior analytics engineer runs straight through these patterns.",
  language: "sql",
  difficulty: "advanced",
  techStack: ["dbt", "Jinja2", "PostgreSQL", "Snowflake"],
  tags: ["dbt", "jinja", "analytics-engineering", "warehouse", "macros", "testing"],
  learningObjectives: [
    "Write Jinja macros that generate valid SQL strings across edge cases (NULLs, empty inputs, names with special chars).",
    "Use `dispatch` to write warehouse-portable macros that compile to the right SQL per adapter.",
    "Test macros with dbt 1.8+ unit tests so regressions are caught in CI.",
    "Recognise when a macro is the right abstraction — and when it's just hiding complexity.",
    "Compose macros so a `dim_*` model is 5 lines instead of 50.",
  ],
  estimatedMinutes: 480,
  xpReward: 650,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "An analytics team has 40 `dim_*` models, each with a hand-rolled MD5 surrogate key that handles NULLs differently. Bugs slip in (collisions, wrong keys). You're asked to centralise into one macro AND prove backward-compatibility with unit tests.",
    hiringRelevance2026:
      "Macros + dispatch + macro testing are the analytics-engineering senior signals. Junior dbt devs write models; senior devs write the macros every model imports.",
    readmeOutline: [
      "Overview & Scenario", "Why macros vs CTEs",
      "Step 1 surrogate_key", "Step 2 dispatch (PG vs BQ)",
      "Step 3 pivot", "Step 4 date_spine",
      "Step 5 macro unit testing",
      "Validation", "When NOT to write a macro", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "GitHub repo: a dbt project with the 5 macros, unit tests for each, and a single example `dim_customers` model that USES all of them — so reviewers see the macro library powering a real model in 8 lines of SQL.",
    portfolioRelevance:
      "Recruiters hiring analytics engineers ask 'show me your most-used macro'. A library + unit tests + a real model that depends on it is the strongest possible answer.",
    repoUrl: "https://github.com/<your-handle>/dbt-macros-mastery",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "surrogate_key — handle NULLs correctly",
      instructionMd:
        "Implement `surrogate_key(*columns)` returning a SQL string: `md5(cast(coalesce(cast(<col> as varchar), '_dbt_null_') as varchar) || '||' || ... )`. Raises on empty input. Atlas checks that the required SQL markers appear in your submission.",
      learningObjective: "Generate Jinja → SQL macros that handle the NULL-collision trap correctly.",
      requiredSkill: "Jinja-style SQL generation + COALESCE for NULL handling",
      starterCode: SRC(`SEP = "||"
NULL_SENTINEL = "_dbt_null_"

def surrogate_key(*columns):
    if not columns:
        raise ValueError('need at least one column')
    parts = []
    for col in columns:
        # TODO: parts.append(f"cast(coalesce(cast({col} as varchar), '{NULL_SENTINEL}') as varchar)")
        pass
    joined = (" || '" + SEP + "' || ").join(parts)
    return f"md5({joined})"
`),
      validationType: "contains",
      stepType: "code_sql",
      validation: validationConfig("contains", "Atlas checks that the required evidence markers are present in your submission — not that the program otherwise runs correctly, and not your authorship or competence.", {
        needles: [
          "md5(cast(coalesce(cast(email as varchar), '_dbt_null_') as varchar))",
          "md5(cast(coalesce(cast(first_name as varchar), '_dbt_null_') as varchar)",
          " || '||' || cast(coalesce(cast(last_name as varchar), '_dbt_null_') as varchar))",
        ],
      }),
      expectedOutputs: { singleColMatches: true, multiColMatches: true, emptyRaises: true },
      datasetRefs: ["fixtures/surrogate_key_cases.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "MD5(NULL || 'x') is NULL in most warehouses — that's the collision trap. COALESCE every input before concat.",
          "Use a sentinel that can't appear in real data (`_dbt_null_` is the dbt-utils convention).",
          "Cast to varchar before COALESCE so int/bool columns don't break the concat.",
          "Raise on empty input — silently returning 'md5()' creates the worst kind of downstream bug.",
          "Reference: parts = [f\"cast(coalesce(cast({c} as varchar), '_dbt_null_') as varchar)\" for c in columns]; return f\"md5({' || \\'||\\' || '.join(parts)})\".",
        ],
        successFeedback: "Every `dim_*` model can now adopt one macro and get correct NULL handling for free.",
        failureFeedback: "Common slips: forgot the inner cast (int columns crash); used a sentinel that real data contains ('' is bad); didn't raise on empty input (silent 'md5()' SQL).",
        portfolioRelevance: "Surrogate keys are dbt 101; doing them WITH NULL safety is the senior signal interviewers probe.",
        finalExplanation: "Surrogate keys decouple your dim tables from natural-key churn. The macro is the only place that decision lives.",
        misconceptionToWatchFor: "Believing surrogate keys always need to be MD5. SHA-256 or a sequence-backed surrogate are also valid; the macro lets you swap globally.",
      }),
    },
    {
      stepNumber: 2,
      title: "dispatch — warehouse-portable week_trunc",
      instructionMd:
        "Implement `dispatch(macro_name, adapter, implementations)` returning the right impl: prefer `implementations[adapter]`, fall back to `implementations['default']`, raise KeyError if neither. Validator drives Postgres (default) and BigQuery (override) for a `week_trunc` macro.",
      learningObjective: "Use dbt's dispatch pattern to write macros that compile correctly on every warehouse.",
      requiredSkill: "Adapter-aware macro resolution + safe fallback",
      starterCode: SRC(`def dispatch(macro_name, adapter, implementations):
    # TODO: if adapter in implementations: return implementations[adapter]
    # TODO: if 'default' in implementations: return implementations['default']
    # TODO: raise KeyError(f'no impl for {macro_name} on {adapter} and no default')
    pass
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "dispatch('week_trunc','postgres',{default:fn_pg, bigquery:fn_bq})('order_date') == \"date_trunc('week', order_date)\"; same for bigquery returns BQ form; missing default + missing adapter raises.", {
        cases: [
          { adapter: "postgres", expected: "date_trunc('week', order_date)" },
          { adapter: "bigquery", expected: "date_trunc(order_date, week)" },
          { adapter: "snowflake", expected: "date_trunc('week', order_date)" },
        ],
        expectErrorWhenNoDefault: true,
      }),
      expectedOutputs: { pgOk: true, bqOk: true, fallbackOk: true, missingRaises: true },
      datasetRefs: ["fixtures/dispatch_cases.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Adapter exact match first; default second; KeyError third. Order matters.",
          "In real dbt: `{{ adapter.dispatch('week_trunc', macro_namespace='my_project')(col) }}` — same semantics under the hood.",
          "Each impl is a callable that returns a SQL string. Don't evaluate at dispatch time — return the callable.",
          "Test EVERY supported adapter explicitly. Silent fallback to default is the source of warehouse-portability bugs.",
          "Reference: return implementations.get(adapter) or implementations.get('default') or (_ for _ in ()).throw(KeyError(...)).",
        ],
        successFeedback: "Your macro now ships once and runs on Postgres, BigQuery, Snowflake — analytics-engineering portability achieved.",
        failureFeedback: "Common slips: silently returned None for missing impl (NoneType crash downstream); fell through to default without logging (hard-to-debug wrong-SQL); ate the KeyError so missing dispatch was invisible.",
        portfolioRelevance: "Warehouse-portable macros are a clear differentiator on AE résumés. 'I wrote a macro that runs on 3 warehouses' is a strong interview answer.",
        finalExplanation: "Dispatch is dbt's polymorphism. It separates the contract (week_trunc takes a column) from the SQL each warehouse needs.",
        misconceptionToWatchFor: "Writing per-warehouse models instead of per-warehouse macros. You'll end up with 3 versions of every dim table.",
      }),
    },
    {
      stepNumber: 3,
      title: "pivot — rows to columns",
      instructionMd:
        "Implement `pivot(column, values, agg='sum', value_col='amount')` returning the comma-joined SUM-CASE-WHEN fragments with safe lowercase-snake aliases. Empty `values` → ValueError. Atlas checks that the required evidence markers are present in your submission — not that the program otherwise runs correctly, and not your authorship or competence.",
      learningObjective: "Replace 50-line hand-written pivots with a one-line macro call.",
      requiredSkill: "Jinja SQL generation + identifier sanitisation",
      starterCode: SRC(`import re

def pivot(column, values, agg='sum', value_col='amount'):
    if not values:
        raise ValueError('need at least one value')
    parts = []
    for v in values:
        alias = re.sub(r'[^a-z0-9_]+', '_', v.lower()).strip('_')
        # TODO: parts.append(f"{agg}(case when {column} = '{v}' then {value_col} end) as {alias}")
        pass
    return ',\\n'.join(parts)
`),
      validationType: "contains",
      stepType: "code_sql",
      validation: validationConfig("contains", "Atlas checks that the required evidence markers are present in your submission — not that the program otherwise runs correctly, and not your authorship or competence.", {
        needles: [
          "sum(case when status = 'paid' then amount end) as paid",
          "sum(case when status = 'refunded' then amount end) as refunded",
          "as north_america",
          "as emea",
        ],
      }),
      expectedOutputs: { statusOk: true, regionOk: true, emptyRaises: true },
      datasetRefs: ["fixtures/pivot_cases.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Build one CASE per value with a sanitised alias. The alias is what users SELECT — sanitisation matters.",
          "Lower-case + replace non-alphanum with underscore: re.sub(r'[^a-z0-9_]+', '_', v.lower()).strip('_').",
          "Comma-join with newlines so the generated SQL is readable in dbt's compiled output.",
          "Watch for SQL injection: values come from the model author, not user input, but escaping single quotes is still good hygiene.",
          "Reference: parts = [f\"{agg}(case when {column} = '{v}' then {value_col} end) as {alias_for(v)}\" for v in values]; return ',\\n'.join(parts).",
        ],
        successFeedback: "Pivot models go from 50 lines of repetitive SQL to one macro call. Reviewers thank you.",
        failureFeedback: "Common slips: didn't sanitise aliases (BigQuery rejects 'North America' as an identifier); forgot the comma join (one big multiline-SQL-error); allowed empty values (vacuously empty SQL).",
        portfolioRelevance: "Pivot is the single most-requested macro in real dbt projects. Owning it well = senior AE signal.",
        finalExplanation: "Pivot in SQL is structurally repetitive — perfect macro material. Centralise it; tune it once.",
        misconceptionToWatchFor: "Using a dynamic IN clause and hoping for the best. The CASE form is uglier but explicit and fast.",
      }),
    },
    {
      stepNumber: 4,
      title: "date_spine — fill missing days",
      instructionMd:
        "Implement `date_spine(start_date, end_date, granularity='day')` returning the Postgres SQL `select generate_series('<start>'::date, '<end>'::date, '<interval>'::interval)::date as date_<granularity>`. Supports day/week/month. Atlas checks that the required evidence markers are present in your submission — not that the program otherwise runs correctly, and not your authorship or competence.",
      learningObjective: "Generate the date-spine SQL every time-series model joins onto.",
      requiredSkill: "Jinja SQL generation + granularity validation",
      starterCode: SRC(`GRANULARITIES = {'day': '1 day', 'week': '1 week', 'month': '1 month'}

def date_spine(start_date, end_date, granularity='day'):
    if granularity not in GRANULARITIES:
        raise ValueError(f'unsupported granularity: {granularity}')
    interval = GRANULARITIES[granularity]
    alias = f'date_{granularity}'
    # TODO: return f"select generate_series('{start_date}'::date, '{end_date}'::date, '{interval}'::interval)::date as {alias}"
    pass
`),
      validationType: "contains",
      stepType: "code_sql",
      validation: validationConfig("contains", "Atlas checks that the required evidence markers are present in your submission — not that the program otherwise runs correctly, and not your authorship or competence.", {
        needles: [
          "generate_series('2026-01-01'::date, '2026-01-31'::date, '1 day'::interval)",
          "as date_day",
          "as date_week",
          "'1 week'::interval",
        ],
      }),
      expectedOutputs: { dayOk: true, weekOk: true, unsupportedRaises: true },
      datasetRefs: ["fixtures/date_spine_cases.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Postgres `generate_series` over a date range emits a row per granularity step — the easiest spine SQL.",
          "Cast to ::date so downstream joins don't have to deal with timestamp types.",
          "Alias the column predictably (`date_<granularity>`) so models LEFT JOIN onto a known column name.",
          "Other warehouses: BigQuery uses `generate_date_array`, Snowflake uses a recursive CTE. Use dispatch to make it portable (step 2).",
          "Reference: return f\"select generate_series('{start_date}'::date, '{end_date}'::date, '{interval}'::interval)::date as {alias}\".",
        ],
        successFeedback: "Every time-series model now joins onto a clean spine — no more chart gaps on zero-activity days.",
        failureFeedback: "Common slips: accepted any granularity string (typos silently produce empty spines); forgot the ::date cast (timestamp comparison drift); inconsistent alias naming (joins fail).",
        portfolioRelevance: "Date spines are universal — every dashboard model uses one. Owning the macro is a senior-AE pattern.",
        finalExplanation: "Date spines turn 'days with no events' from invisible into visible-with-zero. That's the difference between a correct chart and a misleading one.",
        misconceptionToWatchFor: "Hardcoding the spine inside each model. Inevitably they drift; centralise to one macro.",
      }),
    },
    {
      stepNumber: 5,
      title: "Macro testing — assert_macro_renders",
      instructionMd:
        "Implement `assert_macro_renders(macro_fn, args, expected)` that calls the macro, normalises both outputs (collapse whitespace), and raises AssertionError with a clear diff if they differ. This is a learner attestation — Atlas does not grade this; verify it yourself against the criteria.",
      learningObjective: "Lock macros into CI so a regression is caught before it propagates across 40 models.",
      requiredSkill: "SQL-string normalisation + assertion-with-diff",
      starterCode: SRC(`import re

def normalise(sql):
    return re.sub(r'\\s+', ' ', sql).strip()

def assert_macro_renders(macro_fn, args, expected):
    actual = macro_fn(*args)
    a, e = normalise(actual), normalise(expected)
    if a != e:
        # TODO: raise AssertionError(f'expected: {e!r}\\ngot: {a!r}')
        pass
    return True
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "assert_macro_renders(fn, ['order_date'], \"date_trunc('week', order_date)\") returns True when fn produces the matching string",
          "assert_macro_renders(fn, ['x'], \"date_trunc('month', x)\") raises AssertionError when fn produces a different string",
          "The AssertionError message includes both 'expected' and 'got' so the diff is clear",
        ],
      }),
      expectedOutputs: { passingReturnsTrue: true, failingRaisesWithDiff: true },
      datasetRefs: ["fixtures/macro_test_cases.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Normalise whitespace before comparing — Jinja often emits stray newlines that aren't semantic differences.",
          "Raise with a clear diff (expected vs got) so the test failure message points right at the regression.",
          "In real dbt: `dbt test --select test_type:unit` runs unit tests for macros (dbt 1.8+).",
          "Add one unit test per public macro + one per dispatch branch. Skip tests for trivial macros that just wrap a single SQL function.",
          "Reference: if normalise(actual) != normalise(expected): raise AssertionError(f'expected: {expected!r}\\ngot: {actual!r}').",
        ],
        successFeedback: "Your macros are now CI-tested. The next regression is caught before it ever lands in main.",
        failureFeedback: "Common slips: didn't normalise whitespace (false-positive failures on cosmetic changes); raised without a diff (debugging takes 10x longer); returned silently on mismatch (broken tests pass).",
        portfolioRelevance: "Tested macros are RARE in real dbt projects. A repo with macro unit tests is an instant 'this person operates senior' signal.",
        finalExplanation: "Untested macros are landmines: one of 40 models breaks for a year before someone notices. Tests prevent that.",
        misconceptionToWatchFor: "Believing dbt's `data tests` are macro tests. They're not — they test model OUTPUTS. Unit tests test macro RENDERING.",
      }),
    },
  ],
};
