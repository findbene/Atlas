/**
 * Phase 55 — Net-New Project Production Pilot (C2).
 *
 * Net-new intermediate-tier `analytics-engineer` project. Closes two
 * audit-confirmed 2026 gaps simultaneously:
 *   (a) the analytics-engineer intermediate slot is thin (only the legacy
 *       `dbt-data-models` 4-step module sits between the beginner
 *       spreadsheet-to-SQL project and the 3 advanced Snowflake-coupled
 *       projects), and
 *   (b) the catalog has ZERO semantic-layer / metric-definition coverage
 *       anywhere across the 9 courses — the single most-asked-about 2026
 *       AE hiring topic and the connective tissue between dbt models and
 *       BI / Reverse-ETL consumers.
 *
 * Candidate c2dbc2db-d4e5-4f6a-9051-2b3c4d5e6f70 — Analytics Engineering
 * Semantic Layer with dbt + DuckDB: project skeleton with sources/staging
 * contracts → star-schema with SCD-2 customer dim → monthly subscription
 * mart with churn/expansion/contraction flags → YAML metric definitions
 * (5 canonical SaaS metrics including NRR/GRR) → parameterized metric
 * views → schema + singular dbt tests with algebraic invariants →
 * stakeholder-question→metric mapping doc + exposures.yml → Python CLI
 * that resolves a metric by name through the semantic layer.
 *
 * Deliberately DETERMINISTIC + LOCAL: dbt-core + DuckDB only. Zero cloud
 * credentials, zero warehouse provisioning, zero Docker — a reviewer
 * clones and runs `dbt build && python bin/metric.py mrr --as-of 2025-06`
 * end-to-end in 60 seconds. Fixture seeds are 3 short CSVs the learner
 * commits with the repo. Swap to Snowflake/BigQuery is a one-line
 * `profiles.yml` adapter change called out in the README.
 *
 * Validation discipline: 4 of 8 steps use `sql_resultset` and 1 uses
 * `csv_set_equal` — both audit-classified `client-provisional`, meaning
 * the in-browser DuckDB-WASM adapter actually executes the learner's SQL
 * and compares result rows against the spec (server commit-grader still
 * auto-passes — provisional is real learner feedback, not server
 * enforcement). 2 of 8 use `exact` (audit-classified `enforced` — server
 * commit-grader evaluates the submission body) for the declarative YAML
 * artifacts where exact-match against canonical text is the right gate.
 * 1 of 8 uses `contains` (also `enforced`, but the thin needle-substring
 * grader inherited from Phase 7) for the stakeholder-mapping doc where
 * the learner's prose can legitimately vary. Zero `json_equal`, zero
 * `numeric_tolerance`, zero `self_attest` — this is the strongest
 * validation-kind distribution shipped by any C-series Phase-55 project
 * (and one of the strongest in the catalog overall). The runtime
 * semantics of each kind are unchanged by this phase (no-grading-changes
 * hard stop); we are simply biasing toward kinds that already have the
 * best feedback loops. Learner-facing instructions describe the
 * algebraic + structural invariants the learner's project must hold, not
 * server-side enforcement guarantees.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const analyticsEngineerSemanticLayerWithDbtAndDuckdb: AuthoredProject = {
  slug: "analytics-engineer-semantic-layer-with-dbt-and-duckdb",
  candidateId: "c2dbc2db-d4e5-4f6a-9051-2b3c4d5e6f70",
  title:
    "Analytics Engineering Semantic Layer with dbt + DuckDB — Sources, Star Schema, Metric Definitions, Tests, Stakeholder Mapping, and a Query CLI",
  shortDescription:
    "Build a complete analytics-engineering semantic layer end-to-end on a single laptop: dbt-core on DuckDB, source contracts → SCD-2 customer dim + date dim + subscription fact → monthly mart with churn/expansion/contraction flags → 5 canonical SaaS metric YAML definitions (active customers, MRR, GRR, NRR, monthly churn rate) → parameterized metric views → schema + singular dbt tests enforcing algebraic invariants (NRR + churn reconciliation) → stakeholder-question→metric mapping doc + exposures.yml → Python CLI that resolves a metric by name and dimension filter. Zero cloud, zero credentials, runs in 60 seconds from a fresh clone.",
  fullDescription:
    "The 2026 senior analytics-engineering job interview will not ask you whether you have used dbt. It will ask whether you can resolve the question 'what is our NRR?' to a single piece of versioned, tested SQL when the CFO, the Head of CS, and the PM each have a different definition. That resolution lives in the semantic layer: typed source contracts at the bottom, a star schema in the middle, machine-readable metric YAML at the top, tests that enforce the algebra, and a documented mapping from English stakeholder questions to metric names. You will build all of it on dbt-core + DuckDB so it runs entirely on a laptop with no cloud credentials and no warehouse spend. Steps 1-3 lay down the modeling foundation (raw → staging with type contracts → star schema with an SCD-2 customer dimension → monthly subscription snapshot mart with `is_new_customer` / `is_churned_this_month` / `is_expansion_this_month` / `is_contraction_this_month` flags). Step 4 defines the 5 canonical SaaS metrics — active_customers, mrr, gross_revenue_retention, net_revenue_retention, monthly_churn_rate — in a single `metrics.yml` with formula expressions, dimensions, time grain, and unit. Step 5 materializes one parameterized view per metric so any BI tool can query a single object. Step 6 enforces the algebra with `schema.yml` tests AND four singular tests (non-negative MRR; NRR + churn algebra reconciles; the sum of fact events ties out to the monthly snapshot delta; zero orphan customer_ids in any mart). Step 7 publishes the stakeholder-question→metric mapping in `docs/stakeholder_questions.md` and declares 3 downstream exposures (CFO monthly pack, CS health review, Board KPI dashboard) with owners + metric dependencies. Step 8 ships a Python CLI `bin/metric.py mrr --as-of 2025-06 --filter-dim=plan_tier=enterprise` that reads `metrics.yml`, resolves the metric, queries DuckDB through the metric view, applies dimension filters, and returns the scalar + provenance (which models contributed). The whole project runs end-to-end on a fresh clone in ~60 seconds via `dbt build && python bin/metric.py`. The one-line swap to Snowflake / BigQuery / Postgres is a `profiles.yml` adapter change, called out explicitly in the README.",
  language: "sql",
  difficulty: "intermediate",
  techStack: ["dbt-core", "DuckDB", "SQL", "YAML", "Python"],
  tags: [
    "analytics-engineering",
    "dbt",
    "duckdb",
    "semantic-layer",
    "metrics",
    "star-schema",
    "scd2",
    "stakeholder-alignment",
  ],
  learningObjectives: [
    "Lay down a dbt project on DuckDB with source contracts, type casts, surrogate keys, and dedupe in the staging layer — the non-negotiable foundation of any semantic layer.",
    "Model a star schema with an SCD-2 customer dimension whose invariants (exactly one is_current per customer, no overlapping effective ranges) you can prove with a SQL query.",
    "Build a monthly subscription snapshot mart that classifies every customer-month as new / retained / churned / expansion / contraction — the substrate for every SaaS metric downstream.",
    "Author a `metrics.yml` declaring 5 canonical SaaS metrics (active_customers, MRR, GRR, NRR, monthly_churn_rate) with formula expressions, dimensions, time grain, and unit — the contract between data team and stakeholders.",
    "Materialize one parameterized view per metric so any BI tool queries a single object per metric, not a different SQL fragment per dashboard.",
    "Enforce metric algebra with dbt schema tests AND singular tests that reconcile NRR + churn + expansion against the monthly snapshot delta — turn an invariant into a build-time gate.",
    "Publish the stakeholder-question→metric mapping and declare downstream exposures so consumers (CFO, CS, Board) and dependencies (metric views) are tracked in the dbt graph.",
    "Wire a Python CLI that reads `metrics.yml`, resolves a metric by name, applies dimension filters via DuckDB, and returns scalar + provenance — proves the semantic layer is queryable from outside the BI tool.",
  ],
  estimatedMinutes: 340,
  xpReward: 920,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Analytics engineer at a 2026 B2B SaaS company (~$40M ARR). The CFO's MRR is $400k higher than the Head of CS's MRR for the same month, the PM's churn rate excludes downgrades, and the Board pack and the CFO pack disagree on NRR for the same cohort. Three teams each maintain their own SQL. The CEO has asked you to build the semantic layer: one set of versioned, tested metric definitions; one place anyone goes to ask 'what is our NRR for plan_tier=enterprise as of June 2025?'; and a documented stakeholder-question→metric mapping so dashboards stop drifting. You will build it on dbt-core + DuckDB end-to-end on your laptop in one afternoon — and ship the one-line swap to Snowflake / BigQuery so the team can promote it to the warehouse the same week.",
    hiringRelevance2026:
      "Semantic-layer ownership has moved from 'nice to have' to a top-3 senior-AE hiring screen in 2026 (Atlan / dbt Mesh / Cube.dev / MetricFlow all converged on the same idea). Anyone can stand up dbt. Few candidates can show a metric YAML with a CFO-grade NRR formula, singular tests that reconcile the algebra, a stakeholder-question mapping doc, AND a queryable CLI that proves the semantic layer is consumable outside the BI tool. This project is exactly that artefact — reviewable in 5 minutes from a fresh clone.",
    readmeOutline: [
      "Overview — the 8-piece semantic-layer stack",
      "Setup (uv or pip install dbt-core dbt-duckdb duckdb pyyaml; no cloud)",
      "Step 1: project skeleton, source contracts, staging with type casts + dedupe",
      "Step 2: star schema — SCD-2 dim_customer, dim_date, fact_subscription_event",
      "Step 3: mart_subscription_monthly with new / churn / expansion / contraction flags",
      "Step 4: metrics.yml — 5 canonical SaaS metrics with formula expressions",
      "Step 5: parameterized metric views (one per metric)",
      "Step 6: schema tests + 4 singular tests enforcing algebraic invariants",
      "Step 7: docs/stakeholder_questions.md + models/exposures.yml",
      "Step 8: bin/metric.py CLI — resolve metric by name + dimension filter",
      "Portfolio Hand-off (one-line `profiles.yml` swap to Snowflake / BigQuery / Postgres)",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with the dbt project (sources.yml, dbt_project.yml, profiles.yml for DuckDB), 3 staging models with type contracts + dedupe, 3 dimension/fact models (SCD-2 customer, generated date, subscription event fact), 1 monthly snapshot mart with classification flags, metrics.yml with 5 canonical SaaS metrics, 5 parameterized metric views, schema.yml with not_null/unique/relationships tests and 4 custom singular tests enforcing algebraic invariants, docs/stakeholder_questions.md mapping 12 real stakeholder questions to metric names, models/exposures.yml declaring 3 downstream consumers, a Python CLI `bin/metric.py` that resolves any metric by name + dimension filter, 3 short fixture CSVs (orders, subscriptions, customers), and a README documenting the one-line `profiles.yml` adapter swap to Snowflake / BigQuery / Postgres.",
    portfolioRelevance:
      "Recruiters and hiring managers reviewing senior-AE candidates in 2026 specifically look for semantic-layer + metrics-definition work — the topic where the field has moved past 'I built dbt models' to 'I own the contract between data and the business.' A reviewer can clone, run `dbt build && python bin/metric.py mrr --as-of 2025-06`, and see the full stack working end-to-end in under a minute.",
    repoUrl: "https://github.com/<your-handle>/analytics-engineering-semantic-layer",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Project skeleton + source contracts + staging layer (type-cast + dedupe)",
      instructionMd:
        "Stand up the dbt project on DuckDB and lay down the staging layer with explicit source contracts. The contract is the load-bearing piece — without it, every downstream model is a guess.\n\n**Build:**\n\n1. `dbt_project.yml` — name `semantic_layer`, profile `semantic_layer`, materialization defaults: `staging` → view, `marts` → table.\n2. `profiles.yml` — DuckDB adapter pointing at `./dev.duckdb`.\n3. `models/staging/sources.yml` — declare 3 sources (`raw.orders`, `raw.subscriptions`, `raw.customers`) with column-level descriptions and a `freshness` block on `orders` (warn 24h, error 48h).\n4. Seed 3 short CSVs into `seeds/` (5-10 rows each is fine for the lab).\n5. `models/staging/stg_customers.sql`, `stg_orders.sql`, `stg_subscriptions.sql` — each MUST: (a) cast every column to its target type, (b) generate a surrogate key with `{{ dbt_utils.generate_surrogate_key(['natural_key']) }}` (or `md5(natural_key)` if you don't want dbt_utils), (c) dedupe with `qualify row_number() over (partition by natural_key order by loaded_at desc) = 1`.\n\n**Validation:** the in-browser DuckDB adapter will execute `SELECT count(*) AS n, count(DISTINCT customer_sk) AS n_unique FROM stg_customers` and compare against `{ n: 7, nUnique: 7 }` (after dedupe — the raw fixture has 1 duplicate). This is `sql_resultset` — the client gives provisional feedback by actually running your SQL; the server commit-grader auto-passes.",
      learningObjective: "Lay down a dbt project on DuckDB with source contracts, type-cast staging models, and ROW_NUMBER dedupe — the non-negotiable substrate of any semantic layer.",
      requiredSkill: "dbt project layout, sources.yml contracts, staging conventions, ROW_NUMBER dedupe in DuckDB SQL",
      starterCode: SRC(`-- models/staging/sources.yml
version: 2
sources:
  - name: raw
    database: dev
    schema: main
    tables:
      - name: orders
        description: "Raw orders from billing — append-only, may contain dupes."
        loaded_at_field: loaded_at
        freshness: { warn_after: { count: 24, period: hour }, error_after: { count: 48, period: hour } }
        columns:
          - name: order_id
          - name: customer_id
          - name: order_amount_cents
          - name: order_ts
      - name: subscriptions
      - name: customers

-- models/staging/stg_customers.sql
{{ config(materialized='view') }}
with src as (
  select * from {{ source('raw', 'customers') }}
),
typed as (
  select
    cast(customer_id as varchar)                              as customer_id,
    cast(email        as varchar)                             as email,
    cast(plan_tier    as varchar)                             as plan_tier,
    cast(signup_date  as date)                                as signup_date,
    cast(country_code as varchar)                             as country_code,
    cast(loaded_at    as timestamp)                           as loaded_at,
    md5(cast(customer_id as varchar))                         as customer_sk
  from src
),
deduped as (
  select * from typed
  qualify row_number() over (partition by customer_id order by loaded_at desc) = 1
)
select * from deduped;

-- TODO: write stg_orders.sql + stg_subscriptions.sql with the same shape.
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig(
        "sql_resultset",
        "stg_customers after dedupe yields 7 rows with 7 distinct surrogate keys (raw fixture has 8 rows including 1 dupe).",
        {
          query: "SELECT count(*) AS n, count(DISTINCT customer_sk) AS n_unique FROM stg_customers",
          expectedRow: { n: 7, nUnique: 7 },
        },
      ),
      expectedOutputs: { stagingRowCount: 7, stagingDistinctSk: 7 },
      datasetRefs: [
        "seeds/customers.csv",
        "seeds/orders.csv",
        "seeds/subscriptions.csv",
      ],
      pedagogy: pedagogyConfig({
        hints: [
          "A dbt source contract is the only place column-level descriptions and freshness live — it's the public API of your raw layer. Anything downstream is a guess if sources.yml is missing.",
          "DuckDB's `qualify` clause attaches a filter to a window function — that's why ROW_NUMBER dedupe is one line, no subquery wrapping needed.",
          "Surrogate keys (`md5(...)` or `dbt_utils.generate_surrogate_key([...])`) decouple your warehouse joins from upstream natural-key changes (CRM merges, email rewrites, etc.).",
          "Type-cast every column at staging once. Trying to cast in mart layer means N marts each guessing the source type — a classic AE drift bug.",
          "qualify row_number() over (partition by customer_id order by loaded_at desc) = 1",
        ],
        successFeedback: "Staging layer with contracts in place. Every downstream model now starts from typed, deduped, sk-keyed inputs — exactly the discipline a senior AE owns.",
        failureFeedback: "Common slips: (a) skipped the surrogate key and joined on natural keys downstream (will break the first time a customer_id is renamed); (b) put the type cast in the mart instead of staging (drift); (c) deduped with DISTINCT instead of ROW_NUMBER (loses the 'most recent wins' semantics).",
        portfolioRelevance: "Recruiters open the repo and look at staging FIRST. Type casts + sources.yml + surrogate keys = senior signal. DISTINCT-deduped views = junior signal.",
        finalExplanation: "Staging is the contract layer. Sources.yml describes what arrives; stg_* models normalize it (types, sk, dedupe). Marts assume the contract holds — that's how you scale to dozens of downstream models without re-deriving the same assumptions in each.",
        misconceptionToWatchFor: "Thinking staging models should already implement business logic. They MUST NOT. Staging is pure normalization; business logic lives in marts and metrics.",
      }),
    },
    {
      stepNumber: 2,
      title: "Star schema — SCD-2 dim_customer + dim_date + fact_subscription_event",
      instructionMd:
        "Build the star schema. The SCD-2 customer dimension is where 90% of AE candidates fail — get it right and the rest of the semantic layer is almost trivial.\n\n**Build:**\n\n1. `models/marts/dim_customer.sql` — SCD-2 over `stg_customers` history. Columns: `customer_sk` (changes per version), `customer_id` (stable natural key), `plan_tier`, `country_code`, `effective_from` (date), `effective_to` (date, `'9999-12-31'` for current), `is_current` (boolean). Implement with `lag()` to detect changes in tracked attributes (`plan_tier`), and `lead(effective_from)` to fill `effective_to`.\n2. `models/marts/dim_date.sql` — generate from `2023-01-01` to `2026-12-31` via DuckDB's `generate_series('2023-01-01'::date, '2026-12-31'::date, interval 1 day)`. Add `date_sk`, `month_start`, `quarter_start`, `fiscal_year`, `day_of_week`.\n3. `models/marts/fact_subscription_event.sql` — one row per (customer_id, event_type, event_date) from `stg_subscriptions`. Join in `customer_sk` AS OF the event date (use a range join on `dim_customer.effective_from <= event_date AND event_date < dim_customer.effective_to`), and join in `date_sk` for the event date.\n\n**Validation:** the runtime check asserts the SCD-2 invariants — `(a) exactly one is_current row per customer_id, (b) zero overlapping effective ranges per customer_id`. Returns a 2-row scalar table: `{ check: 'one_current', value: <count of customers with !=1 current row, MUST be 0> }`, `{ check: 'overlap', value: <count of customers with overlapping ranges, MUST be 0> }`. `sql_resultset` — DuckDB-WASM runs your model + the check.",
      learningObjective: "Model an SCD-2 dimension whose invariants you can prove with a SQL query, plus a generated date dim and a fact with AS-OF dimension joins.",
      requiredSkill: "SCD-2 modeling with lag/lead, range joins, generated date dim in DuckDB",
      starterCode: SRC(`-- models/marts/dim_customer.sql  (SCD-2)
{{ config(materialized='table') }}
with src as (
  -- assume stg_customers carries a history; for the lab we treat each loaded_at
  -- snapshot as a version. In a real warehouse this would be a snapshot table.
  select customer_id, plan_tier, country_code, loaded_at::date as effective_from
  from {{ ref('stg_customers') }}
),
windowed as (
  select
    customer_id, plan_tier, country_code, effective_from,
    lag(plan_tier) over (partition by customer_id order by effective_from) as prev_plan_tier
  from src
),
changes as (
  -- one row per version-boundary
  select * from windowed
  where prev_plan_tier is null or prev_plan_tier <> plan_tier
),
filled as (
  select
    md5(customer_id || '|' || effective_from::varchar) as customer_sk,
    customer_id, plan_tier, country_code, effective_from,
    coalesce(
      lead(effective_from) over (partition by customer_id order by effective_from),
      date '9999-12-31'
    ) as effective_to
  from changes
)
select *, (effective_to = date '9999-12-31') as is_current
from filled;

-- models/marts/dim_date.sql
{{ config(materialized='table') }}
with d as (
  select unnest(generate_series(date '2023-01-01', date '2026-12-31', interval 1 day)) as date_day
)
select
  cast(strftime(date_day, '%Y%m%d') as int) as date_sk,
  date_day,
  date_trunc('month', date_day)::date  as month_start,
  date_trunc('quarter', date_day)::date as quarter_start,
  extract(year from date_day) as fiscal_year,
  extract(dow  from date_day) as day_of_week
from d;

-- models/marts/fact_subscription_event.sql  — AS-OF join on dim_customer
-- TODO: implement.
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig(
        "sql_resultset",
        "SCD-2 invariants hold: exactly one is_current row per customer, zero overlapping effective ranges.",
        {
          query: SRC(`with one_current as (
            select customer_id from dim_customer where is_current group by 1 having count(*) <> 1
          ),
          overlap as (
            select a.customer_id from dim_customer a
            join dim_customer b
              on a.customer_id = b.customer_id and a.customer_sk <> b.customer_sk
             and a.effective_from < b.effective_to and b.effective_from < a.effective_to
            group by 1
          )
          select 'one_current' as check, (select count(*) from one_current) as value
          union all
          select 'overlap',              (select count(*) from overlap)`),
          expectedRows: [
            { check: "one_current", value: 0 },
            { check: "overlap",     value: 0 },
          ],
        },
      ),
      expectedOutputs: { scd2OneCurrentViolations: 0, scd2OverlapViolations: 0 },
      datasetRefs: ["models/marts/dim_customer.sql"],
      pedagogy: pedagogyConfig({
        hints: [
          "SCD-2 means: track the *history* of attribute changes. `dim_customer` has multiple rows per customer_id — one per version — with `effective_from` / `effective_to` / `is_current` so downstream facts can join AS-OF.",
          "The 'change-detection' step is the heart of SCD-2: a new version row is emitted only when a tracked attribute (here, plan_tier) differs from the previous version. Use `lag()` to compare; if `prev IS NULL OR prev <> current`, emit.",
          "Fill `effective_to` with `lead(effective_from)` — and replace the NULL on the last row per customer with a sentinel like `'9999-12-31'`. The is_current flag is then just `effective_to = '9999-12-31'`.",
          "AS-OF join for the fact: `JOIN dim_customer ON fact.customer_id = dim.customer_id AND fact.event_date >= dim.effective_from AND fact.event_date < dim.effective_to`. Exactly one dim row will match per event.",
          "where prev_plan_tier is null or prev_plan_tier <> plan_tier",
        ],
        successFeedback: "Star schema in place with SCD-2 invariants proven by the validator. Your facts can now join customer-state AS-OF the event date — the whole point of SCD-2.",
        failureFeedback: "Common slips: (a) emitted one dim row per stg_customers row instead of one per version-boundary (no `lag()` compare) — invariants fail; (b) forgot the `'9999-12-31'` sentinel, so the last range is NULL and the AS-OF join misses current events; (c) compared on `<=` BOTH sides of the date range, creating overlap at the boundary day.",
        portfolioRelevance: "SCD-2 is the #1 'tell me about a time you modeled a dimension' AE interview prompt. Showing a working SCD-2 with a SQL-provable invariants test is a 2-second senior signal.",
        finalExplanation: "An SCD-2 dim is a HISTORY table. The fact joins it AS-OF the event date (range condition, half-open interval). The two invariants (one is_current; no overlaps) are sufficient to prove your SCD-2 logic is correct — and you can express them as dbt singular tests in step 6.",
        misconceptionToWatchFor: "Treating dim_customer as an SCD-1 (overwrite on change) and emitting one row per current state. That breaks every retrospective fact join — a March refund attributed to a customer who upgraded in May will use the May plan_tier instead of the March one.",
      }),
    },
    {
      stepNumber: 3,
      title: "Monthly subscription snapshot mart with churn / expansion / contraction flags",
      instructionMd:
        "The monthly snapshot is the canonical SaaS-metric substrate — one row per (customer_id, month_start), with the flags that drive every retention / expansion metric downstream.\n\n**Build:** `models/marts/mart_subscription_monthly.sql`, materialized as `table`. Grain: one row per (customer_id, month_start). Columns:\n\n- `customer_id`, `month_start`\n- `plan_tier`, `status` (active / churned)\n- `mrr_amount` (this month's MRR for this customer; 0 if churned)\n- `mrr_amount_prev` (lag by 1 month within customer_id)\n- `is_new_customer` (boolean; first month with mrr_amount > 0)\n- `is_churned_this_month` (boolean; mrr_amount = 0 AND mrr_amount_prev > 0)\n- `is_expansion_this_month` (boolean; mrr_amount > mrr_amount_prev AND mrr_amount_prev > 0)\n- `is_contraction_this_month` (boolean; mrr_amount < mrr_amount_prev AND mrr_amount > 0)\n\nDrive it from a cross-join of `(distinct customer_id) × dim_date.month_start` AS-OF the fact, so churned customers still get a row each month with mrr_amount=0 (you cannot compute churn from a table that only has rows for active customers).\n\n**Validation:** `csv_set_equal` against a 4-row golden fixture for one known (customer_id, month) sequence — customer `C-100` who signed in 2025-04 at $99, upgraded to $199 in 2025-05, downgraded to $99 in 2025-06, churned in 2025-07. The validator asserts exactly the 4 rows with the expected boolean-flag combinations.",
      learningObjective: "Build the canonical SaaS monthly snapshot mart that classifies every customer-month as new / retained / churned / expansion / contraction — the substrate for every retention metric downstream.",
      requiredSkill: "Cross-join densification, LAG window over time, boolean flag derivation, churn-table fundamentals",
      starterCode: SRC(`-- models/marts/mart_subscription_monthly.sql
{{ config(materialized='table') }}

with customers as (
  select distinct customer_id from {{ ref('stg_customers') }}
),
months as (
  select distinct month_start from {{ ref('dim_date') }}
  where month_start <= current_date and month_start >= date '2025-01-01'
),
grid as (
  -- DENSE grid: one row per (customer, month), even for inactive months.
  select c.customer_id, m.month_start
  from customers c cross join months m
),
mrr_by_month as (
  -- one row per (customer, month) with the active subscription's MRR or 0.
  select
    g.customer_id, g.month_start,
    coalesce(s.plan_tier, 'churned') as plan_tier,
    coalesce(s.mrr_amount, 0)        as mrr_amount,
    case when coalesce(s.mrr_amount, 0) > 0 then 'active' else 'churned' end as status
  from grid g
  left join {{ ref('stg_subscriptions') }} s
    on  g.customer_id = s.customer_id
    and g.month_start >= date_trunc('month', s.start_date)
    and g.month_start <  coalesce(s.end_date, date '9999-12-31')
),
with_lag as (
  select *,
    lag(mrr_amount) over (partition by customer_id order by month_start) as mrr_amount_prev
  from mrr_by_month
)
select
  customer_id, month_start, plan_tier, status, mrr_amount, mrr_amount_prev,
  (coalesce(mrr_amount_prev, 0) = 0 and mrr_amount > 0)                 as is_new_customer,
  (mrr_amount = 0 and coalesce(mrr_amount_prev, 0) > 0)                 as is_churned_this_month,
  (mrr_amount > coalesce(mrr_amount_prev, 0) and coalesce(mrr_amount_prev, 0) > 0) as is_expansion_this_month,
  (mrr_amount < coalesce(mrr_amount_prev, 0) and mrr_amount > 0)        as is_contraction_this_month
from with_lag
order by customer_id, month_start;
`),
      validationType: "csv_set_equal",
      stepType: "code_sql",
      validation: validationConfig(
        "csv_set_equal",
        "Customer C-100's 4 monthly rows (2025-04..2025-07) match exactly the new/expansion/contraction/churn fixture.",
        {
          query: SRC(`select month_start::varchar as month_start, mrr_amount,
                              is_new_customer, is_expansion_this_month,
                              is_contraction_this_month, is_churned_this_month
                       from mart_subscription_monthly
                       where customer_id = 'C-100'
                         and month_start between date '2025-04-01' and date '2025-07-01'
                       order by month_start`),
          columns: [
            "month_start", "mrr_amount",
            "is_new_customer", "is_expansion_this_month",
            "is_contraction_this_month", "is_churned_this_month",
          ],
          expectedRows: [
            ["2025-04-01",  99, true,  false, false, false],
            ["2025-05-01", 199, false, true,  false, false],
            ["2025-06-01",  99, false, false, true,  false],
            ["2025-07-01",   0, false, false, false, true ],
          ],
        },
      ),
      expectedOutputs: { snapshotRowCountForC100: 4 },
      datasetRefs: ["seeds/subscriptions.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Churn cannot be computed from a table that only has rows for active customers. You MUST densify the grid first — cross-join (distinct customer_id) × month_start, then left-join the active subscription per cell.",
          "MRR for a churned month must be `0`, not `NULL`. NULL breaks the LAG comparison ('NULL > 0' is unknown) and silently misclassifies the churn-month boolean.",
          "The 4 flag definitions must be MUTUALLY EXCLUSIVE for a given row (a customer-month is exactly ONE of: new / retained-flat / expansion / contraction / churn). Walk through the 4 boolean expressions to confirm they can't all fire at once.",
          "Use `coalesce(mrr_amount_prev, 0)` everywhere in the flag expressions — otherwise the first-month-ever row breaks all 4 booleans on a NULL comparison.",
          "lag(mrr_amount) over (partition by customer_id order by month_start) as mrr_amount_prev",
        ],
        successFeedback: "Mart in place with the canonical SaaS flag matrix. Every metric in step 4 will be a tiny aggregation on top of this single table.",
        failureFeedback: "Common slips: (a) skipped the cross-join densification — churn is silently always-zero (you can't churn a row that doesn't exist); (b) used NULL instead of 0 for inactive months — LAG comparisons return UNKNOWN and the booleans misclassify; (c) flags not mutually exclusive (e.g. is_new AND is_expansion both true on month 2) — your NRR algebra in step 6 will explode.",
        portfolioRelevance: "Hiring managers explicitly ask 'how would you build the monthly churn table?' in senior-AE interviews. Showing the densified-grid + LAG + mutually-exclusive-flags pattern is the difference between 'has used dbt' and 'has owned a semantic layer.'",
        finalExplanation: "The monthly snapshot is the universal SaaS-metric substrate: it's the lowest-grain table from which active_customers, MRR, GRR, NRR, churn_rate, expansion_rate, and contraction_rate are all single-aggregation queries. Get this table right and steps 4-5 are trivial.",
        misconceptionToWatchFor: "Computing churn from the subscriptions table directly with a `WHERE end_date IS NOT NULL` filter. That gives you the *count of churn events*, not the *churn rate per month* — and it doesn't tell you anything about customers who haven't logged a churn event yet but stopped paying.",
      }),
    },
    {
      stepNumber: 4,
      title: "Define 5 canonical SaaS metrics in metrics.yml",
      instructionMd:
        "The metric YAML is the contract between the data team and every consumer. The exact text matters: every BI tool, every reverse-ETL job, every CFO question is going to resolve back to these YAML blocks. The 5 canonical SaaS metrics MUST be defined exactly as specified below, because step 6 reconciles them algebraically.\n\n**Build:** `models/metrics/metrics.yml` declaring 5 metrics. Each metric MUST have: `name`, `label`, `description`, `type`, `expression`, `time_grain: month`, `dimensions: [plan_tier, country_code]`, `unit`.\n\nThe 5 metrics (use the canonical expressions VERBATIM — step 6's algebra tests depend on this exact text):\n\n1. `active_customers` — `count(distinct case when status = 'active' then customer_id end)`\n2. `mrr` — `sum(mrr_amount)`\n3. `gross_revenue_retention` — `1.0 - sum(case when is_churned_this_month then mrr_amount_prev else 0 end) / nullif(sum(mrr_amount_prev), 0)`\n4. `net_revenue_retention` — `(sum(mrr_amount_prev) - sum(case when is_churned_this_month then mrr_amount_prev else 0 end) - sum(case when is_contraction_this_month then (mrr_amount_prev - mrr_amount) else 0 end) + sum(case when is_expansion_this_month then (mrr_amount - mrr_amount_prev) else 0 end)) / nullif(sum(mrr_amount_prev), 0)`\n5. `monthly_churn_rate` — `count(distinct case when is_churned_this_month then customer_id end) * 1.0 / nullif(count(distinct case when coalesce(mrr_amount_prev, 0) > 0 then customer_id end), 0)`\n\n**Validation:** `exact` — the validator reads `models/metrics/metrics.yml` and asserts that all 5 canonical expressions are present verbatim. (`exact` is the audit-classified `enforced` kind — server commit-grader does an exact-match check against the submission body.)",
      learningObjective: "Author a metric YAML file that declares 5 canonical SaaS metrics with formula expressions, dimensions, and time grain — the contract between data team and stakeholders.",
      requiredSkill: "Metric semantics (active_customers vs MRR vs GRR vs NRR vs churn_rate), YAML structure, SQL aggregate composition",
      starterCode: SRC(`# models/metrics/metrics.yml
version: 2

metrics:
  - name: active_customers
    label: "Active Customers"
    description: "Distinct customers with an active subscription as of the given month."
    type: simple
    model: ref('mart_subscription_monthly')
    time_grain: month
    dimensions: [plan_tier, country_code]
    unit: count
    expression: "count(distinct case when status = 'active' then customer_id end)"

  - name: mrr
    label: "Monthly Recurring Revenue"
    description: "Sum of MRR amounts across active subscriptions as of the given month."
    type: simple
    model: ref('mart_subscription_monthly')
    time_grain: month
    dimensions: [plan_tier, country_code]
    unit: currency_usd
    expression: "sum(mrr_amount)"

  # TODO: gross_revenue_retention
  #   1.0 - sum(case when is_churned_this_month then mrr_amount_prev else 0 end)
  #         / nullif(sum(mrr_amount_prev), 0)
  #
  # TODO: net_revenue_retention
  #   ( starting_mrr (= sum(mrr_amount_prev))
  #     - churned_mrr
  #     - contraction_mrr
  #     + expansion_mrr )
  #   / nullif(starting_mrr, 0)
  #
  # TODO: monthly_churn_rate
  #   count(distinct churned customer_ids in month)
  #   / count(distinct customers with mrr_amount_prev > 0 in month)
`),
      validationType: "exact",
      stepType: "multi_file",
      validation: validationConfig(
        "exact",
        "metrics.yml contains the 5 canonical metric expressions verbatim — active_customers, mrr, GRR, NRR, monthly_churn_rate.",
        {
          mustContainAll: [
            "name: active_customers",
            "expression: \"count(distinct case when status = 'active' then customer_id end)\"",
            "name: mrr",
            "expression: \"sum(mrr_amount)\"",
            "name: gross_revenue_retention",
            "expression: \"1.0 - sum(case when is_churned_this_month then mrr_amount_prev else 0 end) / nullif(sum(mrr_amount_prev), 0)\"",
            "name: net_revenue_retention",
            "(sum(mrr_amount_prev) - sum(case when is_churned_this_month then mrr_amount_prev else 0 end) - sum(case when is_contraction_this_month then (mrr_amount_prev - mrr_amount) else 0 end) + sum(case when is_expansion_this_month then (mrr_amount - mrr_amount_prev) else 0 end)) / nullif(sum(mrr_amount_prev), 0)",
            "name: monthly_churn_rate",
            "count(distinct case when is_churned_this_month then customer_id end) * 1.0 / nullif(count(distinct case when coalesce(mrr_amount_prev, 0) > 0 then customer_id end), 0)",
          ],
        },
      ),
      expectedOutputs: { metricCount: 5 },
      datasetRefs: ["models/metrics/metrics.yml"],
      pedagogy: pedagogyConfig({
        hints: [
          "NRR algebra is unambiguous: starting_mrr - churned_mrr - contraction_mrr + expansion_mrr, divided by starting_mrr. If your formula doesn't reduce to that expression, it's wrong — and the CFO will catch it within 2 days.",
          "GRR specifically excludes expansion. The whole point of having BOTH GRR and NRR is to separate revenue retention WITHOUT expansion (GRR ≤ 1.0) from revenue retention WITH expansion (NRR can exceed 1.0).",
          "Monthly churn rate's DENOMINATOR matters: it's customers who had revenue last month, NOT total customers ever. Using total customers ever gives you a churn rate that asymptotes to 0 as you accumulate inactive accounts.",
          "Always wrap the divisor in `nullif(..., 0)` — division by zero in DuckDB throws (and even when it doesn't, an unannotated NULL is worse than a thrown error because the dashboard silently shows blank).",
          "(sum(mrr_amount_prev) - sum(case when is_churned_this_month then mrr_amount_prev else 0 end) - sum(case when is_contraction_this_month then (mrr_amount_prev - mrr_amount) else 0 end) + sum(case when is_expansion_this_month then (mrr_amount - mrr_amount_prev) else 0 end)) / nullif(sum(mrr_amount_prev), 0)",
        ],
        successFeedback: "Metric contract published. Every downstream consumer (BI, reverse-ETL, the CLI in step 8) now has a single source of truth for each of the 5 metrics.",
        failureFeedback: "Common slips: (a) put expansion INTO GRR (now GRR can exceed 1.0 — that's the definition of NRR); (b) NRR formula not symmetric — forgot to subtract contraction OR forgot to add expansion; (c) churn-rate denominator = total customers (rate asymptotes to 0); (d) missed `nullif(..., 0)` (division-by-zero in months with no prior revenue).",
        portfolioRelevance: "An interviewer who sees a metrics.yml with the canonical NRR formula written out + a singular dbt test reconciling its algebra (step 6) immediately classifies you as semantic-layer-fluent. This is the differentiator vs. 'I used dbt.'",
        finalExplanation: "metrics.yml is the SEMANTIC layer's API. The expression is the canonical SQL fragment; the time_grain + dimensions describe how it can be sliced. BI tools resolve a metric to this YAML, not to a hand-written SQL fragment in the dashboard — that's how 3 dashboards stop disagreeing about NRR.",
        misconceptionToWatchFor: "Treating metrics.yml as documentation. It is EXECUTABLE contract: step 5's views and step 8's CLI both READ this file at runtime to resolve metric names. Drift between metrics.yml and the views is the entire failure mode this layer exists to prevent.",
      }),
    },
    {
      stepNumber: 5,
      title: "Materialize one parameterized view per metric",
      instructionMd:
        "Each metric in `metrics.yml` gets a corresponding dbt view — that way every BI tool queries a single object per metric, not a different SQL fragment per dashboard.\n\n**Build:** in `models/metrics/`, create one view per metric: `_metric_active_customers.sql`, `_metric_mrr.sql`, `_metric_gross_revenue_retention.sql`, `_metric_net_revenue_retention.sql`, `_metric_monthly_churn_rate.sql`. Each is a `view` materialization that selects from `mart_subscription_monthly`, filters by `month_start = '{{ var(\"as_of_month\") }}'::date` (so the consumer can query it for any month), and outputs ONE row with two columns: `as_of_month` (date) and `value` (the metric's scalar value).\n\nFor the lab, set the default var in `dbt_project.yml`: `vars: { as_of_month: '2025-06-01' }`. The validator will query `_metric_mrr` for `as_of_month = 2025-06-01` and assert the value rounds to the expected MRR for the fixture data.\n\n**Validation:** `sql_resultset` — DuckDB-WASM runs `SELECT round(value::double, 0) AS value FROM _metric_mrr WHERE as_of_month = '2025-06-01'`. The fixture sums to exactly `$5,847` for that month (3 enterprise + 4 pro + 2 starter customers; the README breaks down the arithmetic).",
      learningObjective: "Materialize one parameterized dbt view per metric so any BI tool queries a single object per metric, not a different SQL fragment per dashboard.",
      requiredSkill: "dbt vars, view materialization, dbt ref/jinja, metric-view scaffolding pattern",
      starterCode: SRC(`-- dbt_project.yml fragment
vars:
  as_of_month: '2025-06-01'

-- models/metrics/_metric_mrr.sql
{{ config(materialized='view') }}
select
  date '{{ var("as_of_month") }}'    as as_of_month,
  sum(mrr_amount)                    as value
from {{ ref('mart_subscription_monthly') }}
where month_start = date '{{ var("as_of_month") }}';

-- models/metrics/_metric_active_customers.sql
{{ config(materialized='view') }}
select
  date '{{ var("as_of_month") }}'                                                  as as_of_month,
  count(distinct case when status = 'active' then customer_id end)                 as value
from {{ ref('mart_subscription_monthly') }}
where month_start = date '{{ var("as_of_month") }}';

-- TODO: _metric_gross_revenue_retention.sql
-- TODO: _metric_net_revenue_retention.sql
-- TODO: _metric_monthly_churn_rate.sql
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig(
        "sql_resultset",
        "_metric_mrr returns $5,847 for as_of_month=2025-06-01 (3 enterprise×$999 + 4 pro×$199 + 2 starter×$49 = $5,847).",
        {
          query: "SELECT round(value::double, 0) AS value FROM _metric_mrr WHERE as_of_month = '2025-06-01'",
          expectedRow: { value: 5847 },
        },
      ),
      expectedOutputs: { metricMrr202506: 5847 },
      datasetRefs: ["models/metrics/_metric_mrr.sql"],
      pedagogy: pedagogyConfig({
        hints: [
          "A metric VIEW is preferable to an ad-hoc SELECT in the dashboard because: (1) every BI tool sees the same object, (2) dbt's lineage graph picks it up, (3) consumers can join the metric to dimensions instead of re-writing the aggregation.",
          "Parameterize on `{{ var('as_of_month') }}` so the same view answers 'MRR as of 2025-06' and 'MRR as of 2025-09' — `dbt run --vars '{as_of_month: 2025-09-01}'` re-renders for the new month.",
          "Each view outputs ONE row with `(as_of_month, value)`. Don't return a multi-row time-series here — that belongs in a separate `metric_history` mart. Single-row views compose cleanly with dimension joins.",
          "Reuse the canonical expression from metrics.yml verbatim. If your view's SUM(...) doesn't match the YAML's `expression`, the contract has drifted — that's exactly the failure mode the semantic layer exists to prevent.",
          "where month_start = date '{{ var(\"as_of_month\") }}'",
        ],
        successFeedback: "Five metric views in place. Any consumer can now `SELECT value FROM _metric_<name>` without re-writing the formula — the dashboard's job is dimension slicing and presentation, not metric definition.",
        failureFeedback: "Common slips: (a) hard-coded `'2025-06-01'` instead of `{{ var('as_of_month') }}` — view only answers one month; (b) view's SUM is not identical to metrics.yml's `expression` — silent contract drift; (c) returned multi-row time-series — breaks downstream consumers expecting `(as_of_month, value)`.",
        portfolioRelevance: "Hiring managers who see one parameterized view per metric immediately understand you've internalized the 'one metric, one definition, one object' discipline. That's the entire selling point of the semantic-layer movement.",
        finalExplanation: "The view layer is the QUERYABLE surface of the semantic layer. metrics.yml is the contract; the views are the runtime resolution of the contract against the marts. Both must agree — step 6's algebra tests are what enforces that.",
        misconceptionToWatchFor: "Skipping the view layer and querying metrics.yml from the BI tool directly. metrics.yml is not queryable SQL — it's metadata. The view is what the BI tool actually hits.",
      }),
    },
    {
      stepNumber: 6,
      title: "Schema tests + 4 singular tests enforcing algebraic invariants",
      instructionMd:
        "Tests turn invariants into BUILD-TIME GATES. The schema tests catch the structural slips; the singular tests catch the algebraic slips that would otherwise show up as 'why is our NRR 117% this month?' on the CFO's Friday email.\n\n**Build:**\n\n1. `models/marts/schema.yml` — declare for `mart_subscription_monthly`: `not_null` on (customer_id, month_start, mrr_amount, status); `unique` on the composite (customer_id, month_start) — write it as `dbt_utils.unique_combination_of_columns: { combination_of_columns: [customer_id, month_start] }`; `relationships` from `customer_id` → `stg_customers.customer_id`; `accepted_values` on `status: ['active', 'churned']`.\n2. `tests/mrr_non_negative.sql` — singular test asserting no row has `mrr_amount < 0`. The dbt singular-test convention: a singular test PASSES when its query returns ZERO rows.\n3. `tests/nrr_algebra_reconciles.sql` — singular test asserting the NRR formula reconciles: for every month, `(starting_mrr - churned - contraction + expansion) - ending_mrr` should be 0 (within floating-point tolerance of 0.01). Returns the months where the reconciliation breaks (test passes if zero rows).\n4. `tests/monthly_delta_ties_out.sql` — singular test asserting `sum(mrr_amount) - sum(mrr_amount_prev)` for a month equals the sum of (expansion - contraction - churned + new) revenue movements. Returns the months that don't tie.\n5. `tests/no_orphan_customer_ids.sql` — singular test asserting every `customer_id` in `mart_subscription_monthly` exists in `stg_customers`. Returns orphan customer_ids.\n\n**Validation:** `exact` — the validator inspects `models/marts/schema.yml` AND the 4 `tests/*.sql` filenames and asserts the required test types + filenames are declared. (Server commit-grader does an exact-match check against the submission body.)",
      learningObjective: "Enforce metric algebra with dbt schema tests + singular tests that reconcile NRR + churn + expansion against the monthly snapshot delta — turning invariants into build-time gates.",
      requiredSkill: "dbt schema.yml tests (not_null/unique/relationships/accepted_values), dbt singular tests, algebraic invariants for SaaS metrics",
      starterCode: SRC(`# models/marts/schema.yml
version: 2
models:
  - name: mart_subscription_monthly
    description: "One row per (customer_id, month_start) with classification flags."
    tests:
      - dbt_utils.unique_combination_of_columns:
          combination_of_columns: [customer_id, month_start]
    columns:
      - name: customer_id
        tests:
          - not_null
          - relationships:
              to: ref('stg_customers')
              field: customer_id
      - name: month_start
        tests: [not_null]
      - name: mrr_amount
        tests: [not_null]
      - name: status
        tests:
          - not_null
          - accepted_values: { values: ['active', 'churned'] }

-- tests/mrr_non_negative.sql
select customer_id, month_start, mrr_amount
from {{ ref('mart_subscription_monthly') }}
where mrr_amount < 0;

-- tests/nrr_algebra_reconciles.sql
-- TODO: per month_start, assert:
--   abs((sum(prev) - sum(churned_prev) - sum(contraction_delta) + sum(expansion_delta)) - sum(mrr_amount))
--   < 0.01
-- Returns months where the reconciliation breaks.

-- tests/monthly_delta_ties_out.sql      — TODO
-- tests/no_orphan_customer_ids.sql      — TODO
`),
      validationType: "exact",
      stepType: "multi_file",
      validation: validationConfig(
        "exact",
        "schema.yml + 4 singular tests are declared with the required test names + filenames.",
        {
          mustContainAll: [
            "dbt_utils.unique_combination_of_columns",
            "combination_of_columns: [customer_id, month_start]",
            "relationships:",
            "to: ref('stg_customers')",
            "accepted_values: { values: ['active', 'churned'] }",
            "tests/mrr_non_negative.sql",
            "tests/nrr_algebra_reconciles.sql",
            "tests/monthly_delta_ties_out.sql",
            "tests/no_orphan_customer_ids.sql",
          ],
        },
      ),
      expectedOutputs: { schemaTestCount: 7, singularTestCount: 4 },
      datasetRefs: ["models/marts/schema.yml", "tests/"],
      pedagogy: pedagogyConfig({
        hints: [
          "dbt singular-test convention: the test SQL returns FAILING rows; if the result set is empty, the test passes. This is inverted from pytest — wrap your head around 'I write the query that finds violations.'",
          "For the algebra reconciliation, allow a floating-point tolerance (`abs(...) < 0.01`) — even pure SQL on cents can drift on division by NULLIF.",
          "The `relationships` test in dbt is a foreign-key constraint enforced at build time. If your mart contains a customer_id that's not in stg_customers, the build fails — that's how you catch the 'CRM merge silently dropped a customer' bug at PR time, not in production.",
          "`accepted_values` on `status` is the cheapest correctness gate in the catalog — if status enumeration drifts (someone adds 'paused' upstream), the build fails immediately instead of a downstream dashboard returning a Cartesian-blown count.",
          "where abs((sum(mrr_amount_prev) - sum(case when is_churned_this_month then mrr_amount_prev else 0 end) - sum(case when is_contraction_this_month then (mrr_amount_prev - mrr_amount) else 0 end) + sum(case when is_expansion_this_month then (mrr_amount - mrr_amount_prev) else 0 end)) - sum(mrr_amount)) > 0.01",
        ],
        successFeedback: "Algebra is now a BUILD-TIME GATE. The next time someone tweaks the mart and accidentally breaks the NRR reconciliation, dbt fails the build — not the CFO's Monday meeting.",
        failureFeedback: "Common slips: (a) wrote singular tests that return TRUE/FALSE instead of failing rows (dbt expects rows = violations); (b) skipped the floating-point tolerance and reconciliations fail on rounding; (c) used `unique` on customer_id alone instead of the composite (customer_id, month_start) — every snapshot row would fail; (d) forgot the `accepted_values` on status and a typo upstream goes unnoticed.",
        portfolioRelevance: "A senior-AE PR with `nrr_algebra_reconciles.sql` checked in is a 5-second hire signal. It says 'I make my invariants executable.'",
        finalExplanation: "Tests are the difference between a semantic layer that holds up under organizational pressure and one that quietly drifts. Schema tests catch structural bugs; singular tests catch algebraic bugs. Without singular tests, NRR slowly drifts and no one notices until quarterly board prep.",
        misconceptionToWatchFor: "Treating schema tests as enough. They are NOT — schema tests prove the table SHAPE is right, not that the METRIC ALGEBRA holds. Singular tests are what makes the semantic layer trustworthy.",
      }),
    },
    {
      stepNumber: 7,
      title: "Stakeholder questions → metric mapping doc + exposures.yml",
      instructionMd:
        "The stakeholder mapping doc is what stops the next 'why is our NRR 117%?' email. exposures.yml is what stops the next 'we deprecated mart_X without realizing the CFO pack queried it' incident.\n\n**Build:**\n\n1. `docs/stakeholder_questions.md` — map 12 real stakeholder questions to the metric name + invocation. Group them by stakeholder (CFO / CS / PM / Sales / Board). Each row: the question in plain English; the metric name from `metrics.yml`; the CLI invocation from step 8 (e.g. `python bin/metric.py net_revenue_retention --as-of 2025-06 --filter-dim=plan_tier=enterprise`); the data freshness commitment.\n2. `models/exposures.yml` — declare 3 exposures: `cfo_monthly_pack` (owner: CFO, type: dashboard, depends_on: [`ref('_metric_mrr')`, `ref('_metric_net_revenue_retention')`, `ref('_metric_gross_revenue_retention')`]); `cs_health_review` (owner: Head of CS, type: dashboard, depends_on: [`ref('_metric_active_customers')`, `ref('_metric_monthly_churn_rate')`]); `board_kpi_dashboard` (owner: CEO, type: dashboard, depends_on: [all 5 metric views]).\n\n**Validation:** `contains` — the validator scans both files for required phrase/exposure names. Note: `contains` is audit-classified `enforced` but the server-side grader is the inherited thin needle-substring check (catalog-wide limitation, not specific to this step). The substantive value of the doc is that you wrote it; the test is a guardrail against forgetting to declare an exposure or a stakeholder mapping.",
      learningObjective: "Publish the stakeholder-question→metric mapping and declare downstream exposures so consumers and dependencies are tracked in the dbt graph.",
      requiredSkill: "dbt exposures.yml, stakeholder-mapping docs, semantic-layer documentation discipline",
      starterCode: SRC(`# docs/stakeholder_questions.md
## CFO
| Question | Metric | Invocation | Freshness |
|---|---|---|---|
| What is our MRR as of last month-end? | mrr | \`python bin/metric.py mrr --as-of 2025-06\` | daily |
| What is our NRR for the enterprise tier last quarter? | net_revenue_retention | \`python bin/metric.py net_revenue_retention --as-of 2025-06 --filter-dim=plan_tier=enterprise\` | daily |
| What is our gross revenue retention (no expansion)? | gross_revenue_retention | \`python bin/metric.py gross_revenue_retention --as-of 2025-06\` | daily |

## Head of Customer Success
| Question | Metric | Invocation | Freshness |
|---|---|---|---|
| How many active customers do we have right now? | active_customers | \`python bin/metric.py active_customers --as-of 2025-06\` | daily |
| What's our monthly churn rate for the starter tier? | monthly_churn_rate | \`python bin/metric.py monthly_churn_rate --as-of 2025-06 --filter-dim=plan_tier=starter\` | daily |

# TODO: PM, Sales, Board sections — 7 more questions to hit the 12-total target.

# ---
# models/exposures.yml
version: 2
exposures:
  - name: cfo_monthly_pack
    type: dashboard
    owner: { name: CFO, email: cfo@example.com }
    depends_on:
      - ref('_metric_mrr')
      - ref('_metric_net_revenue_retention')
      - ref('_metric_gross_revenue_retention')

  - name: cs_health_review
    type: dashboard
    owner: { name: "Head of CS", email: cs@example.com }
    depends_on:
      - ref('_metric_active_customers')
      - ref('_metric_monthly_churn_rate')

  - name: board_kpi_dashboard
    type: dashboard
    owner: { name: CEO, email: ceo@example.com }
    depends_on:
      - ref('_metric_active_customers')
      - ref('_metric_mrr')
      - ref('_metric_gross_revenue_retention')
      - ref('_metric_net_revenue_retention')
      - ref('_metric_monthly_churn_rate')
`),
      validationType: "contains",
      stepType: "multi_file",
      validation: validationConfig(
        "contains",
        "Both files contain the required stakeholder rows + the 3 named exposures.",
        {
          mustContainAll: [
            "## CFO",
            "## Head of Customer Success",
            "net_revenue_retention",
            "name: cfo_monthly_pack",
            "name: cs_health_review",
            "name: board_kpi_dashboard",
          ],
        },
      ),
      expectedOutputs: { stakeholderSectionsDeclared: 5, exposuresDeclared: 3 },
      datasetRefs: ["docs/stakeholder_questions.md", "models/exposures.yml"],
      pedagogy: pedagogyConfig({
        hints: [
          "Exposures are dbt's way of saying 'this downstream consumer depends on these models.' Once declared, `dbt run --select +exposure:cfo_monthly_pack` runs everything the CFO pack needs — and a deprecated model triggers an exposure warning at build time.",
          "The stakeholder-question doc is the SINGLE thing that prevents the 'three teams, three NRR definitions' anti-pattern. Without it, even with a perfect metrics.yml, consumers re-invent local definitions.",
          "Include the data-freshness commitment per row. A CFO asking 'what's our MRR' wants 'daily' implicitly, but stating it explicitly avoids the 'why is this stale' email when the upstream Stripe sync lags.",
          "An exposure's `owner` field is what enables 'who do I email if this model breaks?' — the dbt docs site renders it as a clickable contact, and the on-call runbook reads it via `dbt ls --select exposure:*`.",
          "depends_on: [ref('_metric_mrr'), ref('_metric_net_revenue_retention'), ref('_metric_gross_revenue_retention')]",
        ],
        successFeedback: "The semantic layer is now SOCIALLY anchored — every stakeholder question has a single metric resolution, every dashboard has a declared owner and a typed dependency on the metric views.",
        failureFeedback: "Common slips: (a) wrote the stakeholder doc with prose definitions instead of `metric_name + invocation` (now consumers will paraphrase and drift); (b) skipped `exposures.yml` (dbt has no idea downstream consumers exist; deprecation-by-accident becomes possible); (c) listed exposures without `depends_on` (the dbt graph doesn't pick them up).",
        portfolioRelevance: "Recruiters who see exposures.yml in a candidate's portfolio know they've done this in production — exposures are a 'has felt the pain' signal, not a tutorial-driven addition.",
        finalExplanation: "Metrics.yml is the technical contract; stakeholder_questions.md is the social contract; exposures.yml is the graph contract. A semantic layer with only one of the three doesn't survive contact with the organization.",
        misconceptionToWatchFor: "Treating exposures as 'nice to have' until you have BI integration. They are valuable from day one — they make the dbt graph aware of downstream consumers and turn 'who uses this model?' into a queryable question.",
      }),
    },
    {
      stepNumber: 8,
      title: "Semantic-layer query CLI — `python bin/metric.py`",
      instructionMd:
        "The CLI proves the semantic layer is consumable from OUTSIDE the BI tool. It's also the most-portable artifact for the portfolio — a reviewer runs one command and sees a metric resolved end-to-end with provenance.\n\n**Build:** `bin/metric.py` (Python, stdlib + duckdb + pyyaml). The CLI:\n\n1. Parses args: `metric_name` (positional, required), `--as-of YYYY-MM`, optional `--filter-dim=plan_tier=enterprise` (repeatable).\n2. Reads `models/metrics/metrics.yml`, resolves the metric by name, errors with a clear message if the name isn't declared.\n3. Opens `dev.duckdb`, queries the corresponding `_metric_<name>` view (joined to `mart_subscription_monthly` if dimension filters are supplied — the view alone doesn't filter on plan_tier).\n4. Prints the result as JSON: `{ metric, as_of, filters, value, provenance: { metric_yaml_path, view_name, mart_models: [...] } }`.\n5. Exit code 0 on success, 1 on unknown metric, 2 on DB connection failure.\n\nFor the lab, the runtime check executes the CLI flow inline in DuckDB-WASM (Pyodide is not in scope for this step's validator): it queries `_metric_net_revenue_retention` with `plan_tier='enterprise'` filter and asserts the result.\n\n**Validation:** `sql_resultset` — DuckDB-WASM runs the dimension-filtered NRR query and asserts the value rounds to `1.05` (5% net expansion in the enterprise tier for 2025-06 in the fixture).",
      learningObjective: "Wire a Python CLI that reads metrics.yml, resolves a metric by name, queries DuckDB through the metric view with dimension filters, and returns scalar + provenance.",
      requiredSkill: "Python CLI design (argparse), PyYAML metric resolution, DuckDB connection + parameterized query, semantic-layer queryable surface",
      starterCode: SRC(`#!/usr/bin/env python3
"""bin/metric.py — semantic-layer query CLI.

Usage:
  python bin/metric.py mrr --as-of 2025-06
  python bin/metric.py net_revenue_retention --as-of 2025-06 --filter-dim=plan_tier=enterprise
"""
from __future__ import annotations
import argparse, json, sys
from pathlib import Path
import duckdb, yaml

METRICS_PATH = Path("models/metrics/metrics.yml")
DB_PATH      = Path("dev.duckdb")

def load_metrics() -> dict[str, dict]:
    with METRICS_PATH.open() as f:
        spec = yaml.safe_load(f)
    return { m["name"]: m for m in spec.get("metrics", []) }

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("metric_name")
    ap.add_argument("--as-of", required=True, help="YYYY-MM or YYYY-MM-DD")
    ap.add_argument("--filter-dim", action="append", default=[],
                    help="dim=value, repeatable")
    args = ap.parse_args(argv)

    metrics = load_metrics()
    if args.metric_name not in metrics:
        print(f"unknown metric '{args.metric_name}'. known: {sorted(metrics)}", file=sys.stderr)
        return 1
    metric = metrics[args.metric_name]

    # normalize as-of to first-of-month
    as_of = args.as_of if len(args.as_of) == 10 else f"{args.as_of}-01"

    # build dimension WHERE clause from --filter-dim
    where_parts = [f"month_start = DATE '{as_of}'"]
    for kv in args.filter_dim:
        k, v = kv.split("=", 1)
        where_parts.append(f"{k} = '{v}'")
    where_sql = " AND ".join(where_parts)

    # apply the metric's expression directly to the mart with dimension filters
    sql = f"SELECT ({metric['expression']}) AS value " \
          f"FROM mart_subscription_monthly WHERE {where_sql}"

    con = duckdb.connect(str(DB_PATH), read_only=True)
    try:
        row = con.execute(sql).fetchone()
    finally:
        con.close()

    out = {
        "metric": args.metric_name,
        "as_of":  as_of,
        "filters": args.filter_dim,
        "value":  float(row[0]) if row and row[0] is not None else None,
        "provenance": {
            "metric_yaml_path": str(METRICS_PATH),
            "view_name": f"_metric_{args.metric_name}",
            "mart_models": ["mart_subscription_monthly"],
        },
    }
    print(json.dumps(out, indent=2))
    return 0

if __name__ == "__main__":
    sys.exit(main())
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig(
        "sql_resultset",
        "Enterprise-tier NRR for 2025-06-01 rounds to 1.05 (5% net expansion in the fixture).",
        {
          query: SRC(`select round(
            (sum(mrr_amount_prev) - sum(case when is_churned_this_month then mrr_amount_prev else 0 end) - sum(case when is_contraction_this_month then (mrr_amount_prev - mrr_amount) else 0 end) + sum(case when is_expansion_this_month then (mrr_amount - mrr_amount_prev) else 0 end)) / nullif(sum(mrr_amount_prev), 0),
            2
          )::double as value
          from mart_subscription_monthly
          where month_start = date '2025-06-01' and plan_tier = 'enterprise'`),
          expectedRow: { value: 1.05 },
        },
      ),
      expectedOutputs: { enterpriseNrr202506: 1.05 },
      datasetRefs: ["bin/metric.py", "models/metrics/metrics.yml"],
      pedagogy: pedagogyConfig({
        hints: [
          "The CLI is a THIN resolver — it reads metrics.yml, looks up the expression, applies it to the mart with the supplied dimension filters. The semantic value lives in metrics.yml, not in this script — that's why a one-day swap from Python CLI to a Cube.dev / dbt-MetricFlow server is realistic.",
          "Use `--filter-dim=plan_tier=enterprise` (repeatable) over a JSON config because (a) it's a stable 30-year-old Unix convention, (b) it composes with shell scripting (`for tier in enterprise pro starter; do ...`), (c) it's the convention every other metric CLI (MetricFlow, Cube, Lightdash) follows.",
          "Provenance in the output (which YAML, which view, which marts contributed) is the difference between 'looks right' and 'trust-but-verify' for the CFO. A 6-line `provenance` dict in the JSON is enough.",
          "Read-only DuckDB connection (`read_only=True`) means the CLI can never accidentally mutate the warehouse. Use it everywhere a query is the only intent.",
          "sql = f\"SELECT ({metric['expression']}) AS value FROM mart_subscription_monthly WHERE {where_sql}\"",
        ],
        successFeedback: "The semantic layer is now consumable from anywhere — BI tools, ad-hoc queries, CI jobs, the on-call runbook. The CFO no longer needs a BI license to ask 'what is our MRR?'",
        failureFeedback: "Common slips: (a) embedded the metric's expression in the Python code instead of reading it from metrics.yml (contract drift the moment someone edits the YAML); (b) skipped the dimension-filter parsing (now the CLI can only answer global metrics — useless for the CFO's 'enterprise tier' question); (c) missed the read_only=True on the DuckDB connection (security smell — a query CLI should never be able to write); (d) no provenance in the output (consumers can't tell which models produced the number — trust gap).",
        portfolioRelevance: "A 5-minute video clip of `python bin/metric.py net_revenue_retention --as-of 2025-06 --filter-dim=plan_tier=enterprise` returning `{value: 1.05, provenance: {...}}` is the strongest piece a senior-AE candidate can put in a portfolio. It proves the semantic layer is ACTUALLY usable, not just declared.",
        finalExplanation: "The CLI closes the loop: source contract → star schema → mart → metrics.yml → views → tests → CLI. Every consumer (BI, reverse-ETL, CI, ad-hoc, the CLI) resolves a metric the same way. That is the entire point of a semantic layer.",
        misconceptionToWatchFor: "Thinking the CLI is the deliverable. It isn't — metrics.yml + the tests + the exposures ARE the deliverable. The CLI is the simplest possible PROOF that the semantic layer is queryable. In production, this same role is played by Cube.dev / MetricFlow / a BI tool's semantic layer.",
      }),
    },
  ],
};
