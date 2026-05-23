/**
 * Phase 19 — cloud-data-engineer beginner/foundations seed (net-new).
 * Closes the Start Here gap for one of the four zero-beginner courses
 * surfaced by Phase 18. "Foundations" framing (still difficulty=beginner
 * for invariants) because cloud-DE learners typically arrive with some
 * prior SQL/Python exposure but no warehouse experience.
 *
 * Candidate c19d4e7a-1b2c-4d3e-9f5a-6b7c8d9e0f12 — DuckDB as a local,
 * zero-credential "cloud-style" warehouse. Five canonical warehouse moves
 * (load → stage → model → aggregate → publish) using DuckDB SQL only.
 * NO AWS / GCP / Snowflake creds required — every step runs against
 * fixture files in the repo. The transferable mental model
 * (staging → dim/fact → aggregates → published parquet) maps 1:1 onto
 * Redshift / BigQuery / Snowflake on day one of the next module.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const cloudDataEngineerFoundationsDuckdbLocalWarehouse: AuthoredProject = {
  slug: "cloud-data-engineer-foundations-duckdb-local-warehouse",
  candidateId: "c19d4e7a-1b2c-4d3e-9f5a-6b7c8d9e0f12",
  title: "Cloud-DE Foundations — Build a Local Warehouse with DuckDB (Load → Stage → Star → Aggregate → Publish)",
  shortDescription:
    "Build the five canonical warehouse moves on your laptop with DuckDB — no AWS / Snowflake / BigQuery credentials required. Load Parquet + CSV, stage with explicit types, model a tiny star schema (dim_customer + fact_orders), compute window-function aggregates, and publish a partitioned `gold/` Parquet dataset that a downstream BI tool could read. Every step validates against fixture-expected query results.",
  fullDescription:
    "Most cloud-DE tutorials throw you straight at Snowflake or BigQuery and you spend three days fighting IAM before writing a single SELECT. This project teaches the *transferable* warehouse mental model — staging → conformed dimensions → fact tables → aggregates → published Parquet — using DuckDB on your laptop with zero credentials. The five moves (tolerant `read_parquet` / `read_csv_auto`, schema-on-write staging tables, `CREATE TABLE AS SELECT` star modelling, `SUM() OVER (PARTITION BY ... ORDER BY ...)` running aggregates, partitioned `COPY ... TO 'gold/' (FORMAT PARQUET, PARTITION_BY (...))`) are identical to the moves you'll write in Redshift / BigQuery / Snowflake on day one of any cloud module. The portfolio artefact is a runnable repo: `make all` ingests the fixtures, builds the warehouse, and writes the published Parquet — reviewers can clone it and have it green in 60 seconds.",
  language: "sql",
  difficulty: "beginner",
  techStack: ["DuckDB", "SQL", "Parquet"],
  tags: ["cloud-data-engineer", "beginner", "foundations", "duckdb", "warehouse", "parquet", "star-schema"],
  learningObjectives: [
    "Load Parquet + CSV into DuckDB defensively with `read_parquet` / `read_csv_auto` + explicit column types.",
    "Build a staging layer with `CREATE TABLE stg_* AS SELECT ...` that pins types and renames columns to warehouse convention.",
    "Model a 2-table star schema (`dim_customer`, `fact_orders`) with surrogate / natural keys and explain why the warehouse pattern beats one wide table.",
    "Compute aggregates with `SUM() OVER (PARTITION BY customer_id ORDER BY order_date)` window functions — running totals + ranks.",
    "Publish a partitioned Parquet dataset (`COPY ... TO 'gold/' (FORMAT PARQUET, PARTITION_BY (year, month))`) ready for downstream BI / external readers.",
  ],
  estimatedMinutes: 180,
  xpReward: 540,
  isMultiFile: false,
  meta: projectMeta({
    scenario:
      "Junior cloud-DE candidate at a 2026 e-commerce startup. The platform team is still picking between Snowflake and BigQuery, but the analyst team needs a daily orders aggregate yesterday. You build the entire warehouse — staging → star schema → daily aggregates → published Parquet — locally with DuckDB, prove the model end-to-end, and the same SQL migrates to the chosen warehouse with cosmetic edits when IAM/networking are sorted.",
    hiringRelevance2026:
      "DuckDB is the 2026 'cloud-warehouse-without-the-cloud' interview vehicle — it lets you demonstrate warehouse SQL fluency (staging → star → window aggregates → published Parquet) without the reviewer needing to provision Snowflake. A polished DuckDB warehouse-foundations repo is the highest-signal junior cloud-DE artefact.",
    readmeOutline: [
      "Overview — local warehouse, transferable model",
      "Setup (uv or pip install duckdb)",
      "Step 1: load Parquet + CSV (tolerant read)",
      "Step 2: staging layer (schema-on-write, renamed cols)",
      "Step 3: star schema (dim_customer + fact_orders)",
      "Step 4: window-function aggregates",
      "Step 5: publish partitioned Parquet to gold/",
      "Portfolio Hand-off (Makefile + fixtures + queries)",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo: `sql/01_stage.sql` … `sql/05_publish.sql` (one script per step), `fixtures/customers.csv`, `fixtures/orders.parquet`, `fixtures/expected/*.json` (the five expected query results), `Makefile` (`make all` runs every script in order against `warehouse.duckdb`), README with the warehouse mental model diagram.",
    portfolioRelevance:
      "A reviewer who clones, runs `make all`, and gets a green `gold/year=2026/month=01/*.parquet` in 60 seconds — with zero cloud creds — instantly trusts you understand warehouse fundamentals. The transferability story ('this same SQL runs on Snowflake') is the closer.",
    repoUrl: "https://github.com/<your-handle>/cloud-de-foundations-duckdb",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Load Parquet + CSV — tolerant, typed reads",
      instructionMd:
        "Connect to a DuckDB file (`warehouse.duckdb`) and load the two fixtures into raw views: `raw_orders` from `fixtures/orders.parquet` using `read_parquet`, and `raw_customers` from `fixtures/customers.csv` using `read_csv_auto` with `header=true` and an explicit `types` map for the columns where you don't trust auto-inference (`customer_id BIGINT`, `signup_date DATE`). Why: `read_csv_auto` will sometimes guess `VARCHAR` for an ID column that has leading zeros — pinning types at the boundary prevents silent type-drift downstream.",
      learningObjective:
        "Defensive load: pin types at the warehouse boundary so downstream SQL doesn't inherit bad guesses.",
      requiredSkill: "read_parquet + read_csv_auto with explicit types map",
      starterCode: SRC(`-- sql/01_load.sql
-- DuckDB warehouse — Step 1: load raw fixtures as views

-- TODO: create raw_orders from fixtures/orders.parquet via read_parquet
-- CREATE OR REPLACE VIEW raw_orders AS
--   SELECT * FROM read_parquet('fixtures/orders.parquet');

-- TODO: create raw_customers from fixtures/customers.csv via read_csv_auto
--       with explicit types for customer_id (BIGINT) + signup_date (DATE)
-- CREATE OR REPLACE VIEW raw_customers AS
--   SELECT * FROM read_csv_auto('fixtures/customers.csv', header=true,
--          types={'customer_id': 'BIGINT', 'signup_date': 'DATE'});

SELECT COUNT(*) AS order_rows FROM raw_orders;
SELECT COUNT(*) AS customer_rows FROM raw_customers;
`),
      validationType: "json_equal",
      stepType: "code_sql",
      validation: validationConfig("json_equal", "raw_orders + raw_customers views resolve; raw_orders row count > 0 and raw_customers.customer_id resolves as BIGINT (not VARCHAR).", {
        expected: {
          rawOrdersExists: true,
          rawCustomersExists: true,
          customerIdTypeIsBigint: true,
          rawCustomersSignupDateIsDate: true,
        },
      }),
      expectedOutputs: { rawViewsCreated: true, explicitTypesPinned: true },
      datasetRefs: ["fixtures/orders.parquet", "fixtures/customers.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "`read_parquet('path.parquet')` and `read_csv_auto('path.csv', header=true)` are the two DuckDB scan functions you'll use 90% of the time.",
          "Wrap each scan in `CREATE OR REPLACE VIEW raw_<name> AS SELECT * FROM ...` — views (not tables) so reruns don't accumulate state.",
          "`types={'col': 'TYPE'}` is the DuckDB-specific way to pin column types at scan time (overrides auto-inference).",
          "For CSV, pin `customer_id BIGINT` and `signup_date DATE` explicitly. Auto-inference can flip `customer_id` to VARCHAR if any row has leading zeros.",
          "CREATE OR REPLACE VIEW raw_customers AS SELECT * FROM read_csv_auto('fixtures/customers.csv', header=true, types={'customer_id': 'BIGINT', 'signup_date': 'DATE'});",
        ],
        successFeedback:
          "Raw views resolve with pinned types — your warehouse boundary now has type guarantees, not type guesses.",
        failureFeedback:
          "Most common slips: omitting the `types` map (customer_id becomes VARCHAR, joins later break); using `CREATE TABLE` instead of `VIEW` (rerunning the script fails on the second invocation).",
        portfolioRelevance:
          "A README comment ('types pinned at scan to prevent drift') next to the load script is exactly the senior-junior signal cloud-DE reviewers look for.",
        finalExplanation:
          "The boundary between 'their data' and 'your warehouse' is where type discipline starts. Auto-inference is great for ad-hoc exploration; for production load scripts, pin the types you care about.",
        misconceptionToWatchFor:
          "Believing 'DuckDB is just for analysis, the real warehouse will catch type bugs'. Wrong — every warehouse inherits the type guesses you make at the load layer.",
      }),
    },
    {
      stepNumber: 2,
      title: "Staging layer — schema-on-write with warehouse conventions",
      instructionMd:
        "Materialise two staging TABLES (not views) from the raw views: `stg_orders` and `stg_customers`. Rename columns to warehouse convention (`snake_case`, suffix `_id` on FK columns, `_at` on timestamps), and pin types explicitly. Why a staging *table* not view: downstream models read it many times; materialising once is cheaper, and the staging table is the contract — if upstream schema drifts, the staging build fails loudly here rather than silently propagating.",
      learningObjective:
        "Staging layer = explicit, materialised, conventionally-named contract between raw and modelled data.",
      requiredSkill: "CREATE TABLE stg_* AS SELECT with column rename + CAST",
      starterCode: SRC(`-- sql/02_stage.sql
-- Staging layer — schema-on-write

-- TODO: CREATE OR REPLACE TABLE stg_orders AS
--   SELECT
--     CAST(order_id AS BIGINT) AS order_id,
--     CAST(customer_id AS BIGINT) AS customer_id,
--     CAST(order_ts AS TIMESTAMP) AS ordered_at,
--     CAST(amount_cents AS BIGINT) AS amount_cents,
--     CAST(status AS VARCHAR) AS status
--   FROM raw_orders;

-- TODO: CREATE OR REPLACE TABLE stg_customers AS
--   SELECT
--     customer_id,
--     LOWER(TRIM(email)) AS email,
--     TRIM(full_name) AS full_name,
--     signup_date
--   FROM raw_customers;

SELECT 'stg_orders' AS tbl, COUNT(*) AS rows FROM stg_orders
UNION ALL SELECT 'stg_customers', COUNT(*) FROM stg_customers;
`),
      validationType: "json_equal",
      stepType: "code_sql",
      validation: validationConfig("json_equal", "stg_orders + stg_customers exist as TABLEs (not views); columns renamed to convention (ordered_at, amount_cents); types are BIGINT/TIMESTAMP/VARCHAR/DATE as declared; email is lowercased + trimmed.", {
        expected: {
          stgOrdersIsTable: true,
          stgCustomersIsTable: true,
          orderedAtColumnExists: true,
          emailLowercased: true,
          amountCentsTypeBigint: true,
        },
      }),
      expectedOutputs: { stagingMaterialised: true, columnsRenamed: true },
      datasetRefs: ["fixtures/orders.parquet", "fixtures/customers.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Use `CREATE OR REPLACE TABLE stg_<name> AS SELECT ...` — `TABLE` (not VIEW) because downstream reads it many times.",
          "Rename inside the SELECT: `order_ts AS ordered_at` makes the warehouse convention explicit at the boundary.",
          "Cast every column explicitly: `CAST(x AS BIGINT) AS x` — never inherit raw types into staging.",
          "Normalise text in staging: `LOWER(TRIM(email))` once here, never again. Names: `TRIM(...)` only (case matters).",
          "CREATE OR REPLACE TABLE stg_customers AS SELECT customer_id, LOWER(TRIM(email)) AS email, TRIM(full_name) AS full_name, signup_date FROM raw_customers;",
        ],
        successFeedback:
          "Staging tables materialised with warehouse-conventional names + pinned types — the contract is explicit and the build will fail loudly if upstream drifts.",
        failureFeedback:
          "Most common slips: using `VIEW` instead of `TABLE` (recomputes on every downstream query, slow); skipping the rename (raw column names leak into your fact tables); blanket-lowercasing names (destroys capitalisation forever).",
        portfolioRelevance:
          "Showing a 02_stage.sql with explicit CASTs + renames is the cloud-DE equivalent of writing a typed contract — reviewers immediately know you've worked with warehouses before.",
        finalExplanation:
          "Staging is where you turn 'their schema' into 'your schema'. Materialise it (not a view) so the cost is paid once, and the contract is observable.",
        misconceptionToWatchFor:
          "Believing staging is a pointless extra layer 'because you could just SELECT from raw'. No — staging is the place where upstream drift becomes visible as a build failure rather than a silent semantic shift.",
      }),
    },
    {
      stepNumber: 3,
      title: "Star schema — dim_customer + fact_orders",
      instructionMd:
        "Build the canonical 2-table star schema from staging: `dim_customer` (one row per customer with `customer_id` as the natural key, plus `signup_date`, `email_domain` derived from email) and `fact_orders` (one row per order with FKs `customer_id` + `order_id`, plus measures `amount_cents`, `ordered_at`). Why star: a fat 'orders + customer-name + customer-email + signup-date in every row' table looks simpler at first but explodes in size and becomes wrong the moment a customer updates their email. The dim/fact split is the warehouse-native solution.",
      learningObjective:
        "Star schema = conformed dimensions (slow-changing customer info) + thin fact tables (measures + FKs). The pattern beats one-wide-table at scale.",
      requiredSkill: "CREATE TABLE AS SELECT with derived columns + dim/fact separation",
      starterCode: SRC(`-- sql/03_star.sql
-- Star schema — dim_customer + fact_orders

-- TODO: CREATE OR REPLACE TABLE dim_customer AS
--   SELECT
--     customer_id,                                         -- natural key
--     email,
--     SPLIT_PART(email, '@', 2) AS email_domain,           -- derived
--     full_name,
--     signup_date
--   FROM stg_customers;

-- TODO: CREATE OR REPLACE TABLE fact_orders AS
--   SELECT
--     order_id,            -- grain: one row per order
--     customer_id,         -- FK to dim_customer
--     ordered_at,
--     amount_cents,
--     status
--   FROM stg_orders;

SELECT 'dim_customer' AS tbl, COUNT(*) AS rows FROM dim_customer
UNION ALL SELECT 'fact_orders', COUNT(*) FROM fact_orders;
`),
      validationType: "json_equal",
      stepType: "code_sql",
      validation: validationConfig("json_equal", "dim_customer has one row per customer_id (unique); email_domain is the part-after-@; fact_orders.customer_id is FK-shaped (every value exists in dim_customer.customer_id).", {
        expected: {
          dimCustomerIdUnique: true,
          emailDomainDerived: true,
          factOrdersForeignKeyResolves: true,
          factOrdersGrainIsOrderId: true,
        },
      }),
      expectedOutputs: { starSchemaBuilt: true, dimUnique: true, factGrainCorrect: true },
      datasetRefs: ["fixtures/orders.parquet", "fixtures/customers.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Dimensions are 'who/what/where' (slow-changing); facts are 'how many/how much' (one row per event).",
          "Grain is sacred — declare it in a SQL comment at the top of every fact table: `-- grain: one row per order`.",
          "Derive `email_domain` once in the dim with `SPLIT_PART(email, '@', 2)` — don't recompute it in every downstream query.",
          "FK integrity is a contract you should be able to assert: `SELECT COUNT(*) FROM fact_orders WHERE customer_id NOT IN (SELECT customer_id FROM dim_customer)` should be 0.",
          "CREATE OR REPLACE TABLE fact_orders AS SELECT order_id, customer_id, ordered_at, amount_cents, status FROM stg_orders;",
        ],
        successFeedback:
          "Star schema built — dim_customer is 1-row-per-customer, fact_orders is 1-row-per-order, and the FK joins cleanly. This pattern scales to billions of rows.",
        failureFeedback:
          "Most common slips: putting customer email/name directly on fact_orders (becomes wrong the moment a customer updates email); declaring the fact at the wrong grain (e.g. one row per customer, losing order detail).",
        portfolioRelevance:
          "A README sentence — 'fact_orders grain = one row per order; dim_customer grain = one row per customer (SCD1)' — is *the* sentence cloud-DE interviewers want to see. It proves you think in warehouse terms, not in app-DB terms.",
        finalExplanation:
          "Star schema isn't a relic of pre-cloud warehouses — it's still the right answer for analytical workloads because the dim/fact split mirrors how questions actually decompose (slice by who/what, sum the how-much).",
        misconceptionToWatchFor:
          "Believing star schema is obsolete 'because we have wide tables now'. Wide tables work for some workloads (BigQuery denormalised analytics), but the dim/fact decomposition is still the right MENTAL MODEL even when you collapse it physically.",
      }),
    },
    {
      stepNumber: 4,
      title: "Window aggregates — running revenue + customer order rank",
      instructionMd:
        "Build `agg_customer_running_revenue` materialised as a TABLE: for each (customer_id, ordered_at) pair, compute `running_revenue_cents = SUM(amount_cents) OVER (PARTITION BY customer_id ORDER BY ordered_at)` and `order_rank = ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_at)`. Then build a second small table `agg_daily_revenue`: per day (`DATE_TRUNC('day', ordered_at)`), `SUM(amount_cents) AS daily_revenue_cents`, `COUNT(DISTINCT customer_id) AS active_customers`. These are the canonical analytical patterns every warehouse SQL learner must internalise.",
      learningObjective:
        "Window functions (`SUM ... OVER (PARTITION BY ... ORDER BY ...)`) compute per-row aggregates without collapsing the result set — the warehouse analyst's superpower.",
      requiredSkill: "Window functions (SUM/ROW_NUMBER OVER PARTITION BY ORDER BY) + GROUP BY day rollup",
      starterCode: SRC(`-- sql/04_aggregate.sql
-- Window functions + daily rollup

-- TODO: CREATE OR REPLACE TABLE agg_customer_running_revenue AS
--   SELECT
--     customer_id,
--     ordered_at,
--     amount_cents,
--     SUM(amount_cents)  OVER (PARTITION BY customer_id ORDER BY ordered_at) AS running_revenue_cents,
--     ROW_NUMBER()       OVER (PARTITION BY customer_id ORDER BY ordered_at) AS order_rank
--   FROM fact_orders;

-- TODO: CREATE OR REPLACE TABLE agg_daily_revenue AS
--   SELECT
--     CAST(DATE_TRUNC('day', ordered_at) AS DATE) AS order_date,
--     SUM(amount_cents)                            AS daily_revenue_cents,
--     COUNT(DISTINCT customer_id)                  AS active_customers
--   FROM fact_orders
--   GROUP BY 1
--   ORDER BY 1;

SELECT * FROM agg_daily_revenue LIMIT 5;
`),
      validationType: "json_equal",
      stepType: "code_sql",
      validation: validationConfig("json_equal", "agg_customer_running_revenue has a monotonically-non-decreasing running_revenue per customer; order_rank starts at 1 per customer; agg_daily_revenue has one row per order_date with daily_revenue_cents and active_customers populated.", {
        expected: {
          runningRevenueMonotonic: true,
          orderRankStartsAtOne: true,
          dailyRevenueOneRowPerDay: true,
          activeCustomersDistinctCount: true,
        },
      }),
      expectedOutputs: { windowAggsBuilt: true, dailyRollupBuilt: true },
      datasetRefs: ["fixtures/orders.parquet"],
      pedagogy: pedagogyConfig({
        hints: [
          "`SUM(x) OVER (PARTITION BY g ORDER BY t)` = running total of x, restarted per group g, ordered by t. No GROUP BY.",
          "`ROW_NUMBER() OVER (PARTITION BY g ORDER BY t)` = 1, 2, 3 per group g in order t. Use it to find 'first/last X per group'.",
          "`DATE_TRUNC('day', ordered_at)` rounds a timestamp down to day boundary — wrap in `CAST(... AS DATE)` for a clean date column.",
          "Daily rollup is `GROUP BY date`. `COUNT(DISTINCT customer_id)` gives daily-active-users.",
          "SUM(amount_cents) OVER (PARTITION BY customer_id ORDER BY ordered_at) AS running_revenue_cents",
        ],
        successFeedback:
          "Window-function aggregates built — running totals + ranks per customer + daily rollup. These are the patterns analysts will ask for daily.",
        failureFeedback:
          "Most common slips: forgetting `ORDER BY` inside the OVER clause (running total becomes the full per-customer total, repeated on every row); using `GROUP BY` with window functions (you don't — window functions preserve the row count).",
        portfolioRelevance:
          "Showing a single SQL file with running totals AND a daily rollup proves you can answer the two question shapes BI tools ask for: 'show me customer X's order history' (windowed) and 'show me daily revenue' (rolled up).",
        finalExplanation:
          "Window functions = aggregates that don't collapse rows. Rollups = aggregates that do. Knowing which to reach for is half of warehouse SQL.",
        misconceptionToWatchFor:
          "Believing window functions and GROUP BY are interchangeable. They aren't — one preserves the row count, the other doesn't.",
      }),
    },
    {
      stepNumber: 5,
      title: "Publish partitioned Parquet to gold/ — the warehouse → BI handoff",
      instructionMd:
        "Publish `agg_daily_revenue` as partitioned Parquet under `gold/` using DuckDB's `COPY ... TO ... (FORMAT PARQUET, PARTITION_BY (year, month))`. Add derived columns `year = YEAR(order_date)` and `month = MONTH(order_date)` so the partition keys exist. The output structure: `gold/year=2026/month=01/data_0.parquet`, etc. Then read it back with `SELECT COUNT(*) FROM read_parquet('gold/**/*.parquet')` to verify the round-trip. Why partition by year/month: it's the default partition layout every cloud query engine (Athena, BigQuery, Snowflake external tables) expects — your BI tool can prune partitions for free.",
      learningObjective:
        "COPY ... TO ... PARTITION_BY produces the same Hive-style partition layout every cloud query engine reads — your warehouse output IS a cloud-ready dataset.",
      requiredSkill: "COPY TO with FORMAT PARQUET + PARTITION_BY + read-back verification",
      starterCode: SRC(`-- sql/05_publish.sql
-- Publish partitioned Parquet for downstream BI

-- TODO: derive year/month from order_date
-- CREATE OR REPLACE TABLE agg_daily_revenue_partitioned AS
--   SELECT
--     order_date,
--     YEAR(order_date)  AS year,
--     MONTH(order_date) AS month,
--     daily_revenue_cents,
--     active_customers
--   FROM agg_daily_revenue;

-- TODO: COPY (SELECT * FROM agg_daily_revenue_partitioned)
--   TO 'gold/'
--   (FORMAT PARQUET, PARTITION_BY (year, month), OVERWRITE_OR_IGNORE);

-- Verify the round-trip:
SELECT COUNT(*) AS published_rows
FROM read_parquet('gold/**/*.parquet');
`),
      validationType: "json_equal",
      stepType: "code_sql",
      validation: validationConfig("json_equal", "gold/ directory exists with Hive-style partition layout (year=YYYY/month=MM/*.parquet); round-trip SELECT COUNT(*) FROM read_parquet('gold/**/*.parquet') equals the source agg_daily_revenue row count.", {
        expected: {
          goldDirExists: true,
          hiveStylePartitions: true,
          roundTripRowCountMatches: true,
          publishedRowsAtLeastOne: true,
        },
      }),
      expectedOutputs: { goldPublished: true, partitionedHiveStyle: true, roundTripVerified: true },
      datasetRefs: ["fixtures/orders.parquet"],
      pedagogy: pedagogyConfig({
        hints: [
          "Partition keys must be columns IN the SELECT — derive `year`/`month` upstream so they're available to `PARTITION_BY`.",
          "Hive-style layout (`year=2026/month=01/`) is the universal cloud partition standard — Athena, BigQuery, Snowflake external all read it.",
          "`OVERWRITE_OR_IGNORE` makes the COPY idempotent across reruns. Without it, the second run errors on the existing files.",
          "`read_parquet('gold/**/*.parquet')` with a glob is your verification — it should return the same row count as the source table.",
          "COPY (SELECT * FROM agg_daily_revenue_partitioned) TO 'gold/' (FORMAT PARQUET, PARTITION_BY (year, month), OVERWRITE_OR_IGNORE);",
        ],
        successFeedback:
          "Partitioned Parquet published to gold/ with Hive-style layout — this dataset can be lifted-and-shifted into S3/GCS and read by Athena/BigQuery with zero changes.",
        failureFeedback:
          "Most common slips: forgetting to derive `year`/`month` before COPY (PARTITION_BY references columns that don't exist); skipping `OVERWRITE_OR_IGNORE` (second run errors); single-file output (defeats the purpose of partitioning).",
        portfolioRelevance:
          "A reviewer who sees `tree gold/` showing `year=2026/month=01/data_0.parquet` and reads in your README 'lifts directly to S3 + Athena with zero schema changes' will trust you understand the warehouse → BI handoff.",
        finalExplanation:
          "The published Parquet IS the warehouse's output contract. Partitioned, columnar, schema-on-read — these three properties make it the universal handoff format for analytical data.",
        misconceptionToWatchFor:
          "Believing the published dataset is 'just files'. It's a contract — partition layout, column types, file format all matter to the next system reading it.",
      }),
    },
  ],
};
