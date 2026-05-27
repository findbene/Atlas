/**
 * Phase 4 — Pedagogy enrichment for the two reference projects.
 *
 * Idempotent: upserts `learning_objective`, `required_skill`, and
 * `pedagogy_config` for every named step. Steps not listed here are
 * left untouched and fall back to the legacy `hints[]` UI.
 *
 * Add new project enrichments by appending to PEDAGOGY_ENRICHMENTS.
 */
import { db } from "@workspace/db";
import { projects, projectSteps } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { PedagogyConfig } from "@workspace/execution-core";

type StepEnrichment = {
  stepNumber: number;
  learningObjective: string;
  requiredSkill: string;
  pedagogy: PedagogyConfig;
};

type ProjectEnrichment = {
  slug: string;
  steps: StepEnrichment[];
};

const CSV_TO_POSTGRES: ProjectEnrichment = {
  slug: "csv-to-postgres-pipeline",
  steps: [
    {
      stepNumber: 1,
      learningObjective: "Open a reusable PostgreSQL connection from a URL and verify it is alive.",
      requiredSkill: "psycopg2 connection management",
      pedagogy: {
        misconceptionToWatchFor: "Treating the connection as a one-shot resource instead of a long-lived object passed into subsequent functions.",
        hintLevel1: "A real ETL job opens ONE connection and reuses it. What does psycopg2 give you back when you call psycopg2.connect(...)?",
        hintLevel2: "psycopg2.connect accepts a single connection-string URL. You only need to return whatever it returns.",
        hintLevel3: "Inside connect_db(url), call psycopg2.connect(url) and return the result. After calling, conn.status should equal 1 (STATUS_READY).",
        hintLevel4: "import psycopg2\n\ndef connect_db(url: str):\n    return psycopg2.connect(url)",
        hintLevel5: "import psycopg2\n\ndef connect_db(url: str):\n    # connect() returns a Connection object kept open until .close().\n    # The caller is responsible for closing it (typically via try/finally\n    # or 'with' in production code).\n    return psycopg2.connect(url)",
        finalExplanation: "Connections are expensive — every ETL run should open ONE connection, hand it to downstream functions (create_schema, bulk_insert), then close it at the end. Building a 'managed' connection abstraction here is the foundation for the rest of the pipeline.",
        successFeedback: "Connection logic looks solid. You now have a re-usable handle every subsequent step can build on.",
        failureFeedback: "Most likely you forgot to return the connection, or you passed individual host/port/user kwargs instead of the URL. Re-read the function signature — it takes a single URL string.",
        portfolioRelevance: "Junior DE interviews routinely ask 'walk me through how you'd connect to Postgres from a Python service' — this is the bedrock answer.",
      },
    },
    {
      stepNumber: 2,
      learningObjective: "Author idempotent DDL that creates a raw events table without breaking on re-runs.",
      requiredSkill: "PostgreSQL schema design with timestamps and JSONB",
      pedagogy: {
        misconceptionToWatchFor: "Using CREATE TABLE without IF NOT EXISTS, which crashes every re-run.",
        hintLevel1: "Pipelines re-run. Your CREATE TABLE statement must survive being executed twice.",
        hintLevel2: "PostgreSQL has a built-in keyword that makes CREATE TABLE skip if the table already exists. What is it?",
        hintLevel3: "Use CREATE TABLE IF NOT EXISTS raw_events with these columns: id SERIAL PRIMARY KEY, event_type VARCHAR(50) NOT NULL, user_id INTEGER NOT NULL, event_ts TIMESTAMPTZ NOT NULL, properties JSONB, created_at TIMESTAMPTZ DEFAULT NOW(). Then conn.commit() at the end.",
        hintLevel4: "def create_schema(conn):\n    sql = \"\"\"\n    CREATE TABLE IF NOT EXISTS raw_events (\n        id SERIAL PRIMARY KEY,\n        event_type VARCHAR(50) NOT NULL,\n        user_id INTEGER NOT NULL,\n        event_ts TIMESTAMPTZ NOT NULL,\n        properties JSONB,\n        created_at TIMESTAMPTZ DEFAULT NOW()\n    );\n    \"\"\"\n    with conn.cursor() as cur:\n        cur.execute(sql)\n    conn.commit()",
        hintLevel5: "def create_schema(conn):\n    # IF NOT EXISTS is what makes this idempotent — Airflow / cron can\n    # call it on every run without blowing up. TIMESTAMPTZ everywhere\n    # avoids the classic 'midnight in which timezone?' bug. JSONB on\n    # properties keeps the schema flexible for unknown future fields.\n    sql = \"\"\"\n    CREATE TABLE IF NOT EXISTS raw_events (\n        id SERIAL PRIMARY KEY,\n        event_type VARCHAR(50) NOT NULL,\n        user_id INTEGER NOT NULL,\n        event_ts TIMESTAMPTZ NOT NULL,\n        properties JSONB,\n        created_at TIMESTAMPTZ DEFAULT NOW()\n    );\n    \"\"\"\n    with conn.cursor() as cur:\n        cur.execute(sql)\n    conn.commit()",
        finalExplanation: "Three production patterns here: IF NOT EXISTS for idempotency, TIMESTAMPTZ for timezone-safety, and JSONB for forward-compatible metadata. Every ETL you ship will use these.",
        successFeedback: "Schema is idempotent and timezone-safe — exactly what a scheduler can re-run without supervision.",
        failureFeedback: "Common slips: missed IF NOT EXISTS, used TIMESTAMP instead of TIMESTAMPTZ, or forgot conn.commit() so DDL never persisted.",
        portfolioRelevance: "When asked 'how do you handle schema migrations in your pipelines?' on an interview, this pattern is the floor.",
      },
    },
    {
      stepNumber: 3,
      learningObjective: "Load a CSV into a DataFrame and reject rows missing required fields.",
      requiredSkill: "pandas read_csv + null-handling",
      pedagogy: {
        misconceptionToWatchFor: "Calling df.dropna() without a subset, which silently drops rows for missing OPTIONAL fields too.",
        hintLevel1: "Real-world CSVs are messy. Decide which columns MUST be present, and drop only when those are null.",
        hintLevel2: "pd.read_csv supports parsing dates inline. dropna takes a `subset` argument so you don't accidentally over-filter.",
        hintLevel3: "Call pd.read_csv(filepath, parse_dates=['event_ts']). Then df = df.dropna(subset=['event_type','user_id','event_ts']). Return df.",
        hintLevel4: "import pandas as pd\n\ndef load_csv(filepath: str) -> pd.DataFrame:\n    df = pd.read_csv(filepath, parse_dates=['event_ts'])\n    return df.dropna(subset=['event_type', 'user_id', 'event_ts'])",
        hintLevel5: "import pandas as pd\n\ndef load_csv(filepath: str) -> pd.DataFrame:\n    # parse_dates= turns the event_ts column into datetime64 right at parse\n    # time — much cleaner than astype after the fact. subset= scopes the\n    # null-check to columns we actually require, preserving rows with\n    # legitimately-optional missing fields.\n    df = pd.read_csv(filepath, parse_dates=['event_ts'])\n    return df.dropna(subset=['event_type', 'user_id', 'event_ts'])",
        finalExplanation: "The two ideas here — parse types at read time, and explicitly scope null-handling — are the difference between a load function that 'works on the demo CSV' and one you trust at 2am.",
        successFeedback: "Clean separation of parse vs. validate — your DataFrame is ready for downstream loaders.",
        failureFeedback: "Either you dropped from the whole DataFrame instead of the required subset, or event_ts is still a string. Check df.dtypes after read_csv.",
        portfolioRelevance: "Resume bullet candidate: 'reduced bad-row leakage by N% by explicitly typing and validating CSV ingest.'",
      },
    },
    {
      stepNumber: 4,
      learningObjective: "Bulk-load a DataFrame into Postgres with COPY for 10-100x speedup over INSERT.",
      requiredSkill: "psycopg2 cursor.copy_expert + StringIO buffering",
      pedagogy: {
        misconceptionToWatchFor: "Looping cur.execute('INSERT ...') per row, which is the #1 source of slow ETL.",
        hintLevel1: "Individual INSERTs are slow. PostgreSQL has a much faster primitive for bulk ingest.",
        hintLevel2: "psycopg2's cursor.copy_expert lets you stream CSV bytes directly into a table. The bytes come from a StringIO buffer.",
        hintLevel3: "Write df to a StringIO buffer with df.to_csv(buf, index=False, header=False). buf.seek(0). Then cur.copy_expert(f\"COPY {table_name} ({','.join(columns)}) FROM STDIN WITH CSV\", buf). Commit. Return len(df).",
        hintLevel4: "from io import StringIO\n\ndef bulk_insert(conn, df, table_name, columns):\n    buf = StringIO()\n    df[columns].to_csv(buf, index=False, header=False)\n    buf.seek(0)\n    with conn.cursor() as cur:\n        cur.copy_expert(\n            f\"COPY {table_name} ({', '.join(columns)}) FROM STDIN WITH CSV\",\n            buf,\n        )\n    conn.commit()\n    return len(df)",
        hintLevel5: "from io import StringIO\n\ndef bulk_insert(conn, df, table_name, columns):\n    # COPY is the throughput weapon: PostgreSQL streams rows directly\n    # without per-row parsing/transaction overhead. We project to the\n    # target columns first so column-order matches; index=False/header=False\n    # keeps the buffer in the exact format COPY expects.\n    buf = StringIO()\n    df[columns].to_csv(buf, index=False, header=False)\n    buf.seek(0)\n    with conn.cursor() as cur:\n        cur.copy_expert(\n            f\"COPY {table_name} ({', '.join(columns)}) FROM STDIN WITH CSV\",\n            buf,\n        )\n    conn.commit()\n    return len(df)",
        finalExplanation: "COPY is 10-100x faster than INSERT for bulk loads because it skips per-row planning and transaction overhead. StringIO turns the in-memory DataFrame into the CSV stream COPY wants — no temp file on disk needed.",
        successFeedback: "You just shipped a bulk-loader. This single pattern handles 99% of CSV/Parquet → Postgres jobs you'll write.",
        failureFeedback: "Check three things: buf.seek(0) before passing to copy_expert (otherwise it reads empty), columns in the COPY statement match df's column order, and conn.commit() at the end.",
        portfolioRelevance: "DE/MLE interviews love the question 'why is your loader fast?' — 'COPY FROM STDIN with a StringIO buffer instead of row-by-row INSERTs' is the textbook answer.",
      },
    },
  ],
};

const DBT_DATA_MODELS: ProjectEnrichment = {
  slug: "dbt-data-models",
  steps: [
    {
      stepNumber: 2,
      learningObjective: "Aggregate orders by status with GROUP BY and return them in deterministic order with ORDER BY.",
      requiredSkill: "SQL GROUP BY + ORDER BY against a real (DuckDB) table",
      pedagogy: {
        misconceptionToWatchFor: "Counting without GROUP BY (returns 1 row), or relying on insertion order instead of an explicit ORDER BY.",
        hintLevel1: "You want one row per distinct status. What clause partitions rows into groups before COUNT runs?",
        hintLevel2: "GROUP BY status gives you the buckets; ORDER BY status enforces the alphabetical order the validator expects.",
        hintLevel3: "Add 'GROUP BY status' after FROM orders, then 'ORDER BY status' at the end. Keep the output columns exactly status and n.",
        hintLevel4: "SELECT\n  status,\n  COUNT(*) AS n\nFROM orders\nGROUP BY status\nORDER BY status;",
        hintLevel5: "SELECT\n  status,\n  COUNT(*) AS n\nFROM orders\nGROUP BY status   -- collapse rows into one bucket per status\nORDER BY status;  -- alphabetical, deterministic for the validator",
        finalExplanation: "Without GROUP BY, COUNT(*) collapses everything into one number. GROUP BY status splits rows into buckets first; ORDER BY status is what makes the result match the validator's row order. The aliased column 'n' must be exactly that — the validator compares column names.",
        successFeedback: "Clean aggregation with deterministic ordering — that's the floor for any analytics query you ship.",
        failureFeedback: "Two common slips: forgetting GROUP BY (you'll get 1 row), or ordering by COUNT(*) instead of status (alphabetical was required).",
        portfolioRelevance: "Every analytics-engineering interview includes 'show me a GROUP BY query with deterministic ordering' — this is it.",
      },
    },
    {
      stepNumber: 1,
      learningObjective: "Configure a dbt project so staging layers are cheap views and mart layers are query-fast tables.",
      requiredSkill: "dbt project configuration + medallion-architecture materialization choice",
      pedagogy: {
        misconceptionToWatchFor: "Picking materialization based on 'it feels safer' rather than the cost/perf trade-off per layer.",
        hintLevel1: "Staging and marts have different jobs. One is rebuilt constantly during dev; the other is hit by BI tools. Which should be cheap, which should be fast?",
        hintLevel2: "Materializing as a view costs nothing to rebuild but pays at every query. Materializing as a table is the opposite.",
        hintLevel3: "In dbt_project.yml under models: atlas_transforms: set staging.+materialized = 'view' and marts.+materialized = 'table'. Staging is the read-cheap iteration layer; marts must be fast for BI.",
        hintLevel4: "name: atlas_transforms\nversion: '1.0'\n\nmodels:\n  atlas_transforms:\n    staging:\n      +materialized: view\n    marts:\n      +materialized: table",
        hintLevel5: "name: atlas_transforms\nversion: '1.0'\n\nmodels:\n  atlas_transforms:\n    staging:\n      # views: rebuilt on every reference, no storage, perfect for the\n      # fast-iteration cleaning layer where models change often.\n      +materialized: view\n    marts:\n      # tables: materialized once per dbt run, much faster for the BI /\n      # dashboard workloads that hit marts hundreds of times per day.\n      +materialized: table",
        finalExplanation: "Medallion architecture maps directly to materialization: bronze/silver staging stays as views (cheap, easy to rewrite), and gold marts get tables (read-optimized for downstream consumers). This is the default convention in production dbt projects.",
        successFeedback: "Materialization choice matches medallion intent — staging stays nimble, marts stay fast.",
        failureFeedback: "Most likely you put marts as view, or used `materialized` without the leading `+`. The plus prefix is what tells dbt 'apply this to every model in the subfolder.'",
        portfolioRelevance: "When asked 'why did you pick view vs. table here?' in an analytics-engineering interview, this trade-off is the expected answer.",
      },
    },
    {
      // Phase 36 — pedagogy for the new step 3 (staging model authoring).
      stepNumber: 3,
      learningObjective: "Author a staging model that does mechanical cleanup (rename, cast, normalize) and nothing else.",
      requiredSkill: "dbt staging-layer conventions + source() macro discipline",
      pedagogy: {
        misconceptionToWatchFor: "Mixing business aggregations into staging models — every analyst on the team will then re-derive them inconsistently downstream.",
        hintLevel1: "Staging is the FIRST transformation tier. What kinds of work belong here, and what kinds belong further downstream in marts?",
        hintLevel2: "Renaming, casting, lowercasing — yes. SUM, AVG, JOIN to dimensions — no. The rule is 'one row in, one row out, no business rules.'",
        hintLevel3: "Sketch a SELECT against {{ source('raw', 'orders') }} that passes through order_id and customer_id, casts amount to numeric, lowercases status, and casts created_at to timestamp. No GROUP BY, no JOIN.",
        hintLevel4: "select\n    order_id,\n    customer_id,\n    cast(amount as numeric(12, 2)) as amount,\n    lower(status) as status,\n    cast(created_at as timestamp) as created_at\nfrom {{ source('raw', 'orders') }}",
        hintLevel5: "select\n    order_id,\n    customer_id,\n    cast(amount as numeric(12, 2)) as amount,  -- enforce money precision at the edge\n    lower(status) as status,                   -- normalize categorical at the edge\n    cast(created_at as timestamp) as created_at\nfrom {{ source('raw', 'orders') }}\n-- One row in → one row out. Aggregations belong in marts.",
        finalExplanation: "Staging is your contract with downstream models: predictable column names, predictable types, predictable normalization. When you put business logic here you make every mart model brittle and you double the surface area for bugs.",
        successFeedback: "Clean staging shape — your marts can trust column types and casing.",
        failureFeedback: "Common slips: putting a SUM/JOIN here (belongs in marts), forgetting source(), or skipping the cast on amount so monetary precision drifts.",
        portfolioRelevance: "Analytics-engineering interviews routinely ask 'walk me through your staging-vs-mart split' — this discipline is the answer.",
      },
    },
    {
      // Phase 36 — pedagogy for the new step 4 (dbt tests authoring).
      stepNumber: 4,
      learningObjective: "Declare the four built-in dbt tests (not_null, unique, accepted_values, relationships) where they actually catch real bugs.",
      requiredSkill: "dbt schema.yml authoring + matching tests to failure modes",
      pedagogy: {
        misconceptionToWatchFor: "Adding tests for show (lots of not_null on every column) instead of placing them where a real production failure mode would fire.",
        hintLevel1: "Each built-in test catches ONE specific failure mode. Match the test to the bug, not the other way around.",
        hintLevel2: "Duplicate orders → unique on order_id. Missing primary key → not_null on order_id. Typo'd status like 'shippd' → accepted_values on status. Orphan foreign key → relationships.",
        hintLevel3: "In schema.yml under models: stg_orders: columns: write tests for order_id (not_null + unique) and status (accepted_values with the canonical enum). Run `dbt test` after every `dbt run`.",
        hintLevel4: "version: 2\n\nmodels:\n  - name: stg_orders\n    columns:\n      - name: order_id\n        tests:\n          - not_null\n          - unique\n      - name: status\n        tests:\n          - accepted_values:\n              values: ['pending', 'shipped', 'cancelled']",
        hintLevel5: "version: 2\n\nmodels:\n  - name: stg_orders\n    columns:\n      - name: order_id\n        tests:\n          - not_null    # catches missing PK from a bad upstream load\n          - unique      # catches duplicate-order bugs\n      - name: status\n        tests:\n          - accepted_values:\n              values: ['pending', 'shipped', 'cancelled']   # catches 'shippd' typos / silent enum drift",
        finalExplanation: "The four built-in tests cover ~80% of the data-quality issues you'll see in practice. Wire them into CI (`dbt test` after `dbt run`) and you've turned dbt from a templating tool into a guardrail.",
        successFeedback: "Tests are placed where bugs actually originate — that's the difference between testing for show and testing for safety.",
        failureFeedback: "Watch for: testing for show (not_null on every column), forgetting accepted_values on categorical columns (where enum drift hides), or skipping `dbt test` from your CI run.",
        portfolioRelevance: "When recruiters ask 'how do you guarantee data quality?' the answer is exactly this: schema.yml tests, run on every CI build, with placement matched to known failure modes.",
      },
    },
  ],
};

const PEDAGOGY_ENRICHMENTS: ProjectEnrichment[] = [CSV_TO_POSTGRES, DBT_DATA_MODELS];

export async function seedPedagogy(): Promise<void> {
  let touched = 0;
  let skipped = 0;
  for (const p of PEDAGOGY_ENRICHMENTS) {
    const project = await db.query.projects.findFirst({ where: eq(projects.slug, p.slug) });
    if (!project) {
      console.warn(`  [pedagogy] project not found: ${p.slug} (skipping)`);
      skipped += p.steps.length;
      continue;
    }
    for (const s of p.steps) {
      const step = await db.query.projectSteps.findFirst({
        where: and(eq(projectSteps.projectId, project.id), eq(projectSteps.stepNumber, s.stepNumber)),
      });
      if (!step) {
        console.warn(`  [pedagogy] ${p.slug} step ${s.stepNumber} not found (skipping)`);
        skipped++;
        continue;
      }
      await db.update(projectSteps)
        .set({
          learningObjective: s.learningObjective,
          requiredSkill: s.requiredSkill,
          pedagogyConfig: s.pedagogy,
        })
        .where(eq(projectSteps.id, step.id));
      touched++;
    }
  }
  console.log(`  [pedagogy] enriched ${touched} steps (skipped ${skipped})`);
}
