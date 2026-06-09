/**
 * Phase 14 — analytics-engineer beginner-tier seed (net-new). Lifts the
 * visible `beginner` count toward 6 and gives AE learners a true entry-
 * tier on-ramp before the intermediate dbt CI / Snowflake stream work.
 *
 * Candidate 601eb400-64c3-4e5f-921b-75e4cff1606f — the canonical "we have
 * an Excel sheet, get it into the warehouse" workflow: load XLSX,
 * type-coerce, write a staging table, build a dim view, build a fct
 * aggregate. SQL only (no dbt yet — that's intermediate).
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const analyticsEngineerBeginnerSpreadsheetToSqlModels: AuthoredProject = {
  slug: "analytics-engineer-beginner-spreadsheet-to-sql-models",
  candidateId: "601eb400-64c3-4e5f-921b-75e4cff1606f",
  title: "Spreadsheet → SQL Models (Beginner AE) — From Excel to a Clean dim/fct Pair",
  shortDescription:
    "The canonical AE on-ramp: take an XLSX export from finance, load it into a typed staging table, build a `dim_customer` view, build a `fct_monthly_revenue` aggregate. SQL + a tiny Python loader — no dbt yet. Every artefact verified set-equal against expected.",
  fullDescription:
    "Before dbt, before CI, before incremental models, the analytics engineer's actual day-1 job is: 'finance emailed me a spreadsheet, please put it in the warehouse.' This project is exactly that workflow done right. You'll load an XLSX into a typed `stg_orders` table, build a single-source-of-truth `dim_customer` view with deterministic naming + dedupe, then build a `fct_monthly_revenue` aggregate that the finance team can chart from. Every artefact is verified against a known answer CSV — when a 30¢ rounding bug appears, you see it immediately. By the end you have the stg → dim → fct mental model that EVERY dbt project is built on top of.",
  language: "sql",
  difficulty: "beginner",
  techStack: ["SQL", "PostgreSQL", "Python", "pandas", "openpyxl"],
  tags: ["analytics-engineer", "beginner", "sql", "dim", "fct", "staging", "xlsx"],
  learningObjectives: [
    "Load an XLSX into a typed staging table — explicit columns, explicit dtypes, no surprises.",
    "Build a `dim_customer` view that dedupes on a natural key and gives every customer a stable surrogate key.",
    "Build an `fct_monthly_revenue` aggregate using `DATE_TRUNC('month', ordered_at)` and `SUM`.",
    "Test each model with a set-equal SQL query against an expected CSV — the AE version of unit tests.",
    "Internalise the stg → dim → fct layering that every dbt project will demand of you next.",
  ],
  estimatedMinutes: 180,
  xpReward: 540,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "AE-on-rotation at a 2026 mid-stage startup. Finance still ships a monthly orders XLSX. Your standing ticket: load it into the warehouse and ship a clean per-month revenue table the CFO's dashboard reads. You'll do it once properly, then template it for next month.",
    hiringRelevance2026:
      "Stg/dim/fct layering is the entire AE interview vocabulary. Showing a clean 3-model project on a real XLSX with set-equal tests is exactly what AE hiring loops screen for at the junior level.",
    readmeOutline: [
      "Overview — the monthly finance XLSX",
      "Setup (psql + uv + openpyxl)",
      "Step 1: load XLSX → typed pandas df",
      "Step 2: create stg_orders + insert",
      "Step 3: build dim_customer view (dedupe + surrogate key)",
      "Step 4: build fct_monthly_revenue (date_trunc + sum)",
      "Step 5: model tests (set-equal vs expected CSV)",
      "Portfolio Hand-off (SQL files + screenshots)",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with: `fixtures/orders.xlsx`, `src/load.py` (XLSX → typed df → INSERTs), `sql/01_stg_orders.sql`, `sql/02_dim_customer.sql`, `sql/03_fct_monthly_revenue.sql`, `tests/test_models.sql` running set-equal asserts vs `fixtures/dim_customer_expected.csv` + `fixtures/fct_monthly_revenue_expected.csv`. README explains the stg/dim/fct mental model in one paragraph.",
    portfolioRelevance:
      "A 3-model SQL project loaded from a real XLSX is the smallest portfolio artefact that demonstrates the full AE entry-level workflow. It's small enough to read in 5 minutes, complete enough to prove the layering.",
    repoUrl: "https://github.com/<your-handle>/spreadsheet-to-sql-beginner-ae",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Load XLSX → typed pandas DataFrame",
      instructionMd:
        "Read `fixtures/orders.xlsx` (sheet `orders`, columns: `Order ID, Customer Name, Customer Email, Ordered At, Qty, Unit Price`). Produce a DataFrame with renamed snake_case columns + explicit pandas dtypes (`order_id: str`, `customer_name: str`, `customer_email: str`, `ordered_at: datetime64[ns]`, `qty: Int64`, `unit_price_cents: Int64`). Unit price arrives in DOLLARS as float — convert to cents (Int64) to avoid floating-point comparisons downstream.",
      learningObjective:
        "XLSX → typed df is the boundary between 'finance's data' and 'your warehouse's data'. Snake-case names, integer-cent money, datetime dates.",
      requiredSkill: "pd.read_excel + column rename + dtype coercion + money-as-cents discipline",
      starterCode: SRC(`# src/load.py
import pandas as pd
from pathlib import Path

XLSX = Path("fixtures/orders.xlsx")

RENAMES = {
    "Order ID":       "order_id",
    "Customer Name":  "customer_name",
    "Customer Email": "customer_email",
    "Ordered At":     "ordered_at",
    "Qty":            "qty",
    "Unit Price":     "unit_price",  # dollars, convert below
}

def load_orders() -> pd.DataFrame:
    df = pd.read_excel(XLSX, sheet_name="orders")
    # TODO: 1) rename columns via RENAMES
    #       2) coerce types: order_id/customer_name/customer_email -> str
    #          ordered_at -> datetime64[ns]; qty -> 'Int64'
    #       3) unit_price (dollars float) -> unit_price_cents (Int64): * 100, round, then 'Int64'
    return df
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Returned df has snake_case columns + correct dtypes; unit_price_cents is Int64 and equals round(unit_price * 100).", {
        expected: {
          columns: ["order_id", "customer_name", "customer_email", "ordered_at", "qty", "unit_price_cents"],
          dtypes: { unit_price_cents: "Int64", qty: "Int64", ordered_at: "datetime64[ns]" },
          unitPriceConverted: true,
        },
      }),
      expectedOutputs: { columnsRenamed: true, dtypesCoerced: true, moneyInCents: true },
      datasetRefs: ["fixtures/orders.xlsx"],
      pedagogy: pedagogyConfig({
        hints: [
          "`pd.read_excel(path, sheet_name='orders')` needs `openpyxl` installed.",
          "`.rename(columns=RENAMES)` then `.astype({...})` is the cleanest 2-step.",
          "Money as cents (Int64) is the golden rule of analytics engineering. Float dollars compare unreliably (`0.10 + 0.20 != 0.30`).",
          "`(df['unit_price'] * 100).round().astype('Int64')` — round BEFORE astype, otherwise truncation can shave 1 cent.",
          "df['unit_price_cents'] = (df['unit_price'] * 100).round().astype('Int64')",
        ],
        successFeedback:
          "Typed, snake-cased, money-as-cents. The XLSX is now warehouse-shaped.",
        failureFeedback:
          "Most common slips: leaving money as float (downstream sum comparisons drift by cents); skipping the rename (every downstream SQL has to quote 'Order ID'); coercing without rounding (loses fractional cents).",
        portfolioRelevance:
          "Money-as-cents + explicit dtypes + a `RENAMES` constant block is the senior signal even at beginner level. Pin the RENAMES block in your README.",
        finalExplanation:
          "Loaders convert 'shape we received' to 'shape we want forever'. Every downstream model assumes you did this right. Be ruthless: types, names, units — fix all three here.",
        misconceptionToWatchFor:
          "Believing float dollars are fine because 'the rounding is tiny'. They aren't — the moment a SUM of 10,000 floats produces a $0.03 drift, finance loses trust in the warehouse forever.",
      }),
    },
    {
      stepNumber: 2,
      title: "Create stg_orders + INSERT",
      instructionMd:
        "Write SQL to `CREATE TABLE IF NOT EXISTS stg_orders` with explicit column types matching the loaded df (`order_id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, customer_email TEXT NOT NULL, ordered_at TIMESTAMP NOT NULL, qty INTEGER NOT NULL, unit_price_cents INTEGER NOT NULL`). Then in `src/load.py` write a function that does `TRUNCATE stg_orders; INSERT ... VALUES (...)` via parameterised statements (one execute-many call). Idempotent — re-running gives the same staging state.",
      learningObjective:
        "Staging tables: explicit schema, NOT NULL where the source data is reliable, TRUNCATE+INSERT for full-refresh idempotency at this scale.",
      requiredSkill: "CREATE TABLE with explicit types + TRUNCATE + parameterised INSERT execute_many",
      starterCode: SRC(`-- sql/01_stg_orders.sql
CREATE TABLE IF NOT EXISTS stg_orders (
    order_id          TEXT PRIMARY KEY,
    customer_name     TEXT      NOT NULL,
    customer_email    TEXT      NOT NULL,
    ordered_at        TIMESTAMP NOT NULL,
    qty               INTEGER   NOT NULL,
    unit_price_cents  INTEGER   NOT NULL
);

-- # src/load.py (continued)
-- import psycopg
-- def write_stg(conn, df):
--     with conn.cursor() as cur:
--         cur.execute("TRUNCATE stg_orders;")
--         cur.executemany(
--             "INSERT INTO stg_orders (order_id, customer_name, customer_email, ordered_at, qty, unit_price_cents) VALUES (%s,%s,%s,%s,%s,%s);",
--             # TODO: list of tuples from df
--         )
--     conn.commit()
`),
      validationType: "json_equal",
      stepType: "code_sql",
      validation: validationConfig("json_equal", "After write_stg(): SELECT COUNT(*) FROM stg_orders == df row count; SELECT MIN(ordered_at), MAX(ordered_at) matches input; re-running write_stg yields the same state (idempotent).", {
        expected: {
          stgRowCountMatches: true,
          idempotent: true,
          ts_min_max_matches: true,
        },
      }),
      expectedOutputs: { tableCreated: true, rowsInserted: true, idempotent: true },
      datasetRefs: ["fixtures/orders.xlsx"],
      pedagogy: pedagogyConfig({
        hints: [
          "`CREATE TABLE IF NOT EXISTS` is the migration-friendly form. Re-running the script doesn't error.",
          "`TRUNCATE` before INSERT for full-refresh staging — at small scale this is simpler than UPSERT and re-runs cleanly.",
          "Parameterised INSERT (`%s` placeholders) — NEVER f-string SQL with user data. Even staging.",
          "`executemany` is one round trip per batch; for thousands of rows it's faster than a Python loop of `execute`.",
          "cur.executemany(sql, [tuple(row) for row in df.itertuples(index=False)])",
        ],
        successFeedback:
          "Staging table loaded idempotently with explicit schema. The warehouse now has 'your' shape, not finance's.",
        failureFeedback:
          "Most common slips: forgetting TRUNCATE (re-running doubles rows); f-stringing SQL (injection-shaped even when 'just dev'); no PRIMARY KEY (duplicates sneak in next time).",
        portfolioRelevance:
          "The SQL DDL in a `.sql` file (not in a Python string) is what reviewers expect — they can read the schema in their SQL editor with syntax highlighting.",
        finalExplanation:
          "Staging is the warehouse's first-class representation of 'the source as-it-was'. Explicit schema, idempotent load, no transformations yet — those come in dim/fct.",
        misconceptionToWatchFor:
          "Mixing transformation into the staging load. Don't. Staging mirrors the source. Cleaning happens in dim/fct, where it's reviewable + testable.",
      }),
    },
    {
      stepNumber: 3,
      title: "dim_customer view — dedupe + surrogate key",
      instructionMd:
        "Create a view `dim_customer` from `stg_orders`: one row per `customer_email` (the natural key), with a `customer_sk INTEGER` surrogate key (`ROW_NUMBER() OVER (ORDER BY customer_email)`), `customer_email`, `customer_name` (the name from the LATEST order — use `DISTINCT ON` or a windowed query), and `first_ordered_at`/`last_ordered_at` derived from MIN/MAX of `ordered_at` per customer.",
      learningObjective:
        "Dimensions = one row per business entity, surrogate key for joins, deterministic source-of-truth columns (latest name) and aggregated date ranges.",
      requiredSkill: "DISTINCT ON / GROUP BY + ROW_NUMBER() surrogate key + MIN/MAX windowing",
      starterCode: SRC(`-- sql/02_dim_customer.sql
CREATE OR REPLACE VIEW dim_customer AS
-- TODO:
--   one row per customer_email
--   columns: customer_sk (ROW_NUMBER), customer_email, customer_name (latest), first_ordered_at, last_ordered_at
SELECT 1;
`),
      validationType: "csv_set_equal",
      stepType: "code_sql",
      validation: validationConfig("csv_set_equal", "SELECT * FROM dim_customer ORDER BY customer_sk equals fixtures/dim_customer_expected.csv (columns: customer_sk, customer_email, customer_name, first_ordered_at, last_ordered_at).", {
        expectedCsv: "fixtures/dim_customer_expected.csv",
        columns: ["customer_sk", "customer_email", "customer_name", "first_ordered_at", "last_ordered_at"],
        orderSensitive: true,
      }),
      expectedOutputs: { emailUnique: true, hasSurrogateKey: true, nameIsLatest: true },
      datasetRefs: ["fixtures/dim_customer_expected.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Approach 1 (Postgres `DISTINCT ON`): `SELECT DISTINCT ON (customer_email) ... FROM stg_orders ORDER BY customer_email, ordered_at DESC;`",
          "Wrap that in a CTE then add `ROW_NUMBER() OVER (ORDER BY customer_email) AS customer_sk` in the outer SELECT.",
          "MIN/MAX dates are separate: another CTE that GROUP BY customer_email and SUMs/MINs/MAXs.",
          "Surrogate keys give downstream fct tables a stable INTEGER FK that's smaller and faster than VARCHAR emails.",
          "ROW_NUMBER() OVER (ORDER BY customer_email) AS customer_sk",
        ],
        successFeedback:
          "Clean dim_customer: one row per customer, deterministic surrogate key, source-of-truth name + date range.",
        failureFeedback:
          "Most common slips: forgetting `ORDER BY customer_email, ordered_at DESC` (DISTINCT ON picks an arbitrary row); using email as the join key (slow + brittle vs an INT surrogate).",
        portfolioRelevance:
          "The dim_customer pattern (natural key + surrogate key + source-of-truth columns + date range) is the standard Kimball dimension. Naming and using it correctly is the AE basics box ticked.",
        finalExplanation:
          "Dimensions answer 'who is this customer?' once. Every fct table then asks 'who?' by joining the dim. This indirection is what makes warehouse refactors safe.",
        misconceptionToWatchFor:
          "Believing the natural key (email) should also be the join key. It can be — but a surrogate INT key is smaller, faster, and stable when emails change.",
      }),
    },
    {
      stepNumber: 4,
      title: "fct_monthly_revenue — date_trunc + SUM, joined to dim_customer",
      instructionMd:
        "Create a view `fct_monthly_revenue` with columns `month (DATE, first-of-month), customer_sk, order_count, revenue_cents (SUM of qty * unit_price_cents)`. Join `stg_orders` to `dim_customer` on `customer_email = dim_customer.customer_email` to pick up the `customer_sk`. Group by `(month, customer_sk)`. Sort by `month ASC, customer_sk ASC`.",
      learningObjective:
        "Facts = aggregated measures grouped by dim keys. `DATE_TRUNC` for the time grain. SUM for additive measures. Join to dim FIRST, then group.",
      requiredSkill: "DATE_TRUNC + JOIN to dim + GROUP BY + SUM of (qty * price_cents)",
      starterCode: SRC(`-- sql/03_fct_monthly_revenue.sql
CREATE OR REPLACE VIEW fct_monthly_revenue AS
SELECT
    DATE_TRUNC('month', o.ordered_at)::date  AS month,
    -- TODO: dim_customer.customer_sk
    -- TODO: COUNT(*) AS order_count
    -- TODO: SUM(o.qty * o.unit_price_cents)::bigint AS revenue_cents
FROM stg_orders o
-- TODO: JOIN dim_customer d ON d.customer_email = o.customer_email
GROUP BY 1, 2
ORDER BY 1, 2;
`),
      validationType: "csv_set_equal",
      stepType: "code_sql",
      validation: validationConfig("csv_set_equal", "SELECT * FROM fct_monthly_revenue ORDER BY month, customer_sk equals fixtures/fct_monthly_revenue_expected.csv: columns [month, customer_sk, order_count, revenue_cents]; revenue_cents = SUM(qty*unit_price_cents) per (month, customer_sk).", {
        expectedCsv: "fixtures/fct_monthly_revenue_expected.csv",
        columns: ["month", "customer_sk", "order_count", "revenue_cents"],
        orderSensitive: true,
      }),
      expectedOutputs: { joinedToDim: true, monthTruncated: true, revenueInCents: true },
      datasetRefs: ["fixtures/fct_monthly_revenue_expected.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "`DATE_TRUNC('month', ts)` returns a TIMESTAMP at the start of that month — cast to DATE for cleaner downstream usage.",
          "Join to dim FIRST so the fct table holds the surrogate key, not the natural one. This is the whole point of the dim.",
          "`SUM(o.qty * o.unit_price_cents)::bigint` — money summed in cents, cast to bigint to be safe at scale.",
          "GROUP BY 1, 2 is the AE shorthand — group by the first two columns in the SELECT. Some teams prefer explicit names; both are fine.",
          "JOIN dim_customer d ON d.customer_email = o.customer_email",
        ],
        successFeedback:
          "Canonical fct: time grain + dim FK + count + sum. Finance can chart this directly.",
        failureFeedback:
          "Most common slips: forgetting to cast DATE_TRUNC result (downstream tools render the timestamp at 00:00); SUMming dollars instead of cents (rounding drift); joining on email instead of using the surrogate (slow joins later).",
        portfolioRelevance:
          "stg_orders + dim_customer + fct_monthly_revenue is the smallest possible Kimball-shape mini-warehouse. Show all three SQL files side by side in the README.",
        finalExplanation:
          "Facts answer 'how much?' Dimensions answer 'about whom?' Combined via the surrogate key, you get a warehouse that's queryable, refactorable, and testable.",
        misconceptionToWatchFor:
          "Putting all aggregation in one giant SQL file. Keep stg/dim/fct in separate files — that's the layer-isolation pattern every dbt project will demand of you next.",
      }),
    },
    {
      stepNumber: 5,
      title: "Model tests — set-equal SELECT vs expected CSV",
      instructionMd:
        "Write `tests/test_models.sql` with two queries that each return ZERO rows when the model is correct: (A) `SELECT * FROM dim_customer EXCEPT SELECT * FROM expected_dim_customer UNION ALL SELECT * FROM expected_dim_customer EXCEPT SELECT * FROM dim_customer;` — the symmetric difference is empty if and only if the sets are equal. (B) Same pattern for `fct_monthly_revenue`. Each test loads its expected CSV into a temp table at the top of the file.",
      learningObjective:
        "Set-equal via symmetric difference (EXCEPT both ways) is the AE 'unit test' — it's the dbt `dbt test` mental model in raw SQL.",
      requiredSkill: "Temp table from CSV + EXCEPT-symmetric-difference set-equal pattern",
      starterCode: SRC(`-- tests/test_models.sql

-- Load expected fixtures into temp tables.
CREATE TEMP TABLE expected_dim_customer (
    customer_sk INTEGER, customer_email TEXT, customer_name TEXT,
    first_ordered_at TIMESTAMP, last_ordered_at TIMESTAMP
);
\\COPY expected_dim_customer FROM 'fixtures/dim_customer_expected.csv' WITH CSV HEADER;

CREATE TEMP TABLE expected_fct_monthly_revenue (
    month DATE, customer_sk INTEGER, order_count INTEGER, revenue_cents BIGINT
);
\\COPY expected_fct_monthly_revenue FROM 'fixtures/fct_monthly_revenue_expected.csv' WITH CSV HEADER;

-- TODO: Test A — symmetric difference between dim_customer and expected_dim_customer must be empty.
--       Test B — same for fct_monthly_revenue.
--       Each is a SELECT that should return ZERO rows when the model is correct.
`),
      validationType: "contains",
      stepType: "code_sql",
      validation: validationConfig("contains", "Atlas checks that the required evidence markers are present in your submission — not that the query/API otherwise behaves correctly, and not your authorship or competence. Specifically: the SQL file must contain EXCEPT, expected_dim_customer, expected_fct_monthly_revenue, dim_customer, and fct_monthly_revenue.", {
        needles: ["EXCEPT", "expected_dim_customer", "expected_fct_monthly_revenue", "dim_customer", "fct_monthly_revenue"],
      }),
      expectedOutputs: { dimSetEqual: true, fctSetEqual: true, testsZeroRowsOnSuccess: true },
      datasetRefs: ["fixtures/dim_customer_expected.csv", "fixtures/fct_monthly_revenue_expected.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Symmetric difference = `(A EXCEPT B) UNION ALL (B EXCEPT A)`. Empty == sets are equal.",
          "Use `\\COPY` (client-side) not `COPY` (server-side, needs file access on the DB host).",
          "CI assertion is just: 'this query returned 0 rows? pass.' That's it.",
          "Tests like these are exactly what `dbt test` runs under the hood — you're learning the foundation, not a tool.",
          "(SELECT * FROM dim_customer EXCEPT SELECT * FROM expected_dim_customer) UNION ALL (SELECT * FROM expected_dim_customer EXCEPT SELECT * FROM dim_customer);",
        ],
        successFeedback:
          "Set-equal tests in raw SQL — the AE unit-test pattern. Once you've written these, dbt's `dbt test` is just sugar over the same idea.",
        failureFeedback:
          "Most common slips: writing only one EXCEPT direction (catches extra rows in dim but not missing rows); using INTERSECT (passes for any non-empty overlap); loading CSV into the wrong column types (silent NaN comparisons).",
        portfolioRelevance:
          "Showing model tests as raw SQL — before introducing dbt — is the strongest possible signal that you understand WHY dbt test exists, not just HOW.",
        finalExplanation:
          "Models without tests are decoration. The symmetric-difference test is the smallest, most honest model test in the AE toolbox.",
        misconceptionToWatchFor:
          "Believing 'the row count matches, so the model is right'. Row count is necessary, not sufficient — a swapped customer_sk for two rows keeps the count and breaks every downstream join.",
      }),
    },
  ],
};
