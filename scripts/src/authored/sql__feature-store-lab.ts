/**
 * Phase 7 — Wave 1c / sql (advanced).
 * Candidate 660b9b59-d6a2-41fe-9e76-137160b06063 — SQL-Native Feature Store Lab.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const sqlFeatureStoreLab: AuthoredProject = {
  slug: "sql-feature-store-lab",
  candidateId: "660b9b59-d6a2-41fe-9e76-137160b06063",
  title: "SQL-Native Feature Store on DuckDB + Postgres",
  shortDescription:
    "Build a SQL-native feature store: window-function aggregates in DuckDB for offline training features, materialized views in Postgres for online serving, point-in-time correctness with as-of joins, and a backfill script.",
  fullDescription:
    "Real feature stores cost $100k+/yr. For most teams under 10TB, a SQL-native approach using DuckDB (offline batch features) + Postgres (online serving) covers 95% of the use case. You'll build it: window-function aggregates for time-bound features (last_7d, last_30d), point-in-time as-of joins to prevent label leakage during training, materialized views in Postgres for low-latency online lookups, and a backfill that recomputes features for any historical timestamp.",
  language: "sql",
  difficulty: "advanced",
  techStack: ["DuckDB", "Postgres", "SQL"],
  tags: ["duckdb", "postgres", "feature-store", "window-functions", "cte", "sql", "as-of-join"],
  learningObjectives: [
    "Compute time-windowed features (last_7d, last_30d) using SQL window functions + partition by.",
    "Prevent label leakage with point-in-time as-of joins.",
    "Materialize features into Postgres materialized views for online serving.",
    "Schedule incremental refresh + backfill for historical windows.",
    "Validate offline-online feature parity with a checksum query.",
  ],
  estimatedMinutes: 180,
  xpReward: 600,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "ML team is paying $120k/yr for Tecton on 50GB of features. CTO asks for a SQL-native alternative that's good enough for the current model + roadmap.",
    hiringRelevance2026:
      "Senior analytics-engineer + ML-platform roles in 2026 specifically ask 'can you build a feature store in SQL?'. Window functions + as-of joins + matviews is the recipe.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (DuckDB offline + Postgres online)",
      "Step 1 windowed features", "Step 2 as-of join",
      "Step 3 materialized view", "Step 4 incremental refresh",
      "Step 5 parity check", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with the DuckDB + Postgres SQL, a Python orchestrator, a Jupyter notebook walking through point-in-time correctness, and a benchmark vs. Tecton on the same feature set.",
    portfolioRelevance:
      "SQL-native feature stores are the 2026 cost-effective pattern. Senior AE + ML-platform roles specifically value this skill.",
    repoUrl: "https://github.com/<your-handle>/sql-feature-store-lab",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Windowed features with PARTITION BY + RANGE",
      instructionMd:
        "Author DuckDB SQL that computes for each (customer_id, event_ts): `orders_last_7d`, `orders_last_30d`, `revenue_last_30d`. Use `COUNT(*) OVER (PARTITION BY customer_id ORDER BY event_ts RANGE BETWEEN INTERVAL 7 DAY PRECEDING AND CURRENT ROW)` style. Validator runs against a fixture orders table + asserts expected values for 3 sample (customer, ts) pairs.",
      learningObjective: "Compute rolling time-window features with SQL window functions.",
      requiredSkill: "Window functions + PARTITION BY + RANGE BETWEEN INTERVAL + DuckDB",
      starterCode: SRC(`-- 01_features.sql
CREATE OR REPLACE VIEW customer_features AS
SELECT
  customer_id,
  event_ts,
  COUNT(*)        OVER w7  AS orders_last_7d,
  COUNT(*)        OVER w30 AS orders_last_30d,
  SUM(total_cents) OVER w30 AS revenue_last_30d
FROM orders
WINDOW
  w7  AS (PARTITION BY customer_id ORDER BY event_ts RANGE BETWEEN INTERVAL 7  DAY PRECEDING AND CURRENT ROW),
  w30 AS (PARTITION BY customer_id ORDER BY event_ts RANGE BETWEEN INTERVAL 30 DAY PRECEDING AND CURRENT ROW);

-- TODO: SELECT * FROM customer_features WHERE customer_id IN ('C1','C2','C3') ORDER BY customer_id, event_ts;
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig("sql_resultset", "For C1 at event_ts=2026-05-15, orders_last_7d=3, orders_last_30d=8, revenue_last_30d=85000.", {
        sampleCustomer: "C1", expectedFeatures: { orders_last_7d: 3, orders_last_30d: 8, revenue_last_30d: 85000 },
      }),
      expectedOutputs: { orders_last_7d: 3, orders_last_30d: 8, revenue_last_30d: 85000 },
      datasetRefs: ["fixtures/orders_seed.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "ROWS BETWEEN counts physical rows; RANGE BETWEEN INTERVAL counts by event_ts proximity — you want RANGE for time windows.",
          "Use named WINDOW clauses (WINDOW w7 AS ...) to avoid repeating the partition spec.",
          "PARTITION BY customer_id keeps each customer's window scoped — without it you'd aggregate across all customers.",
          "Sanity-check by computing orders_last_7d for a customer with known history manually + comparing.",
          "(see reference above)",
        ],
        successFeedback: "Time-window features compute correctly. The hard part of any feature store is done.",
        failureFeedback: "Common slips: used ROWS instead of RANGE (counts events not days — wrong for irregular frequencies); forgot PARTITION BY (window spans all customers — nonsense values).",
        portfolioRelevance: "Window functions + INTERVAL RANGE is a top-3 senior-SQL question. Showing it cold = senior signal.",
        finalExplanation: "RANGE-based windows over event_ts are the foundation of all time-bound features. Master this and the rest is composition.",
        misconceptionToWatchFor: "Computing features in Python after pulling from SQL. Slow + breaks under data growth.",
      }),
    },
    {
      stepNumber: 2,
      title: "Point-in-time as-of join (no label leakage)",
      instructionMd:
        "To train, join `labels(customer_id, churned_at)` with `customer_features(customer_id, event_ts, ...)` such that for each label row we pick the LATEST feature row STRICTLY BEFORE `churned_at`. This is the as-of join. Use a correlated subquery or LATERAL JOIN. Validator runs against a fixture + asserts each label row gets the feature snapshot from the day before churn.",
      learningObjective: "Prevent label leakage in training data by point-in-time joining features to labels.",
      requiredSkill: "Correlated subquery / LATERAL JOIN + ORDER BY DESC LIMIT 1 + temporal joins",
      starterCode: SRC(`-- 02_as_of.sql
-- Each label row gets the LATEST feature row strictly before the churn event.
SELECT
  l.customer_id,
  l.churned_at,
  f.orders_last_7d,
  f.orders_last_30d,
  f.revenue_last_30d
FROM labels l
LEFT JOIN LATERAL (
  SELECT *
  FROM customer_features f0
  WHERE f0.customer_id = l.customer_id
    AND f0.event_ts < l.churned_at
  ORDER BY f0.event_ts DESC
  LIMIT 1
) f ON TRUE
-- TODO: confirm the feature row's event_ts is < churned_at, never >=.
;
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig("sql_resultset", "For label (C2, 2026-04-10), the joined feature row's event_ts < '2026-04-10' AND is the max such row for C2.", {
        expectedNoLeak: true, expectedJoinedRowCount: 12,
      }),
      expectedOutputs: { noLeak: true, rows: 12 },
      datasetRefs: ["fixtures/labels.csv", "fixtures/features_for_asof.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Label leakage = feature row whose event_ts >= label_time. Model 'cheats' by seeing future data → val acc lies.",
          "LATERAL JOIN in Postgres/DuckDB = subquery that references the outer row — perfect for as-of.",
          "Always use < (strict), not <=. Same-timestamp rows are usually after-the-fact.",
          "LEFT JOIN LATERAL (SELECT * FROM customer_features f0 WHERE f0.customer_id = l.customer_id AND f0.event_ts < l.churned_at ORDER BY f0.event_ts DESC LIMIT 1) f ON TRUE",
          "(see reference above)",
        ],
        successFeedback: "Training data is now point-in-time correct. Models trained on this are deployable.",
        failureFeedback: "Common slips: used <= instead of < (subtle leakage); JOINed without ORDER BY DESC LIMIT 1 (got cartesian + multiple feature rows per label).",
        portfolioRelevance: "Point-in-time correctness is THE feature-store interview topic. Solving it with LATERAL JOIN = senior signal.",
        finalExplanation: "LATERAL is the SQL primitive for 'per-row subquery'. As-of joins are the canonical use case.",
        misconceptionToWatchFor: "Joining on the latest feature row globally. Different label timestamps need different feature snapshots.",
      }),
    },
    {
      stepNumber: 3,
      title: "Postgres materialized view for online serving",
      instructionMd:
        "Mirror the latest-per-customer feature snapshot to Postgres via a materialized view: `CREATE MATERIALIZED VIEW online_features AS SELECT DISTINCT ON (customer_id) customer_id, event_ts, orders_last_7d, orders_last_30d, revenue_last_30d FROM customer_features ORDER BY customer_id, event_ts DESC`. Add a unique index on customer_id so REFRESH CONCURRENTLY works. Validator creates the matview, refreshes, queries customer C1 + asserts 1 row.",
      learningObjective: "Materialize the latest-per-customer feature row for low-latency serving + enable concurrent refresh.",
      requiredSkill: "Postgres MATERIALIZED VIEW + DISTINCT ON + REFRESH CONCURRENTLY + unique index requirement",
      starterCode: SRC(`-- 03_online.sql (Postgres)
CREATE MATERIALIZED VIEW online_features AS
SELECT DISTINCT ON (customer_id)
  customer_id, event_ts, orders_last_7d, orders_last_30d, revenue_last_30d
FROM customer_features
ORDER BY customer_id, event_ts DESC;

-- Unique index is REQUIRED for REFRESH CONCURRENTLY.
CREATE UNIQUE INDEX online_features_pk ON online_features (customer_id);

-- TODO: REFRESH MATERIALIZED VIEW CONCURRENTLY online_features;
-- TODO: SELECT * FROM online_features WHERE customer_id = 'C1';
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig("sql_resultset", "After REFRESH, online_features has 1 row per customer (DISTINCT ON works) + unique index exists; query for C1 returns its latest row.", {
        expectedRowsPerCustomer: 1, expectedIndexUnique: true,
      }),
      expectedOutputs: { rowsPerCustomer: 1, indexUnique: true },
      datasetRefs: ["fixtures/expected_online_C1.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "DISTINCT ON (col) ORDER BY col, ts DESC = Postgres-native 'pick latest row per group'.",
          "REFRESH CONCURRENTLY needs a UNIQUE INDEX; otherwise Postgres rejects with an error.",
          "CONCURRENTLY lets readers see stale data during refresh — important for an online serving table.",
          "Online lookup latency: SELECT * FROM online_features WHERE customer_id = 'C1' should be <5ms with the unique index.",
          "(see reference above)",
        ],
        successFeedback: "Online serving table ready. Sub-5ms lookups via the unique index.",
        failureFeedback: "Common slips: skipped DISTINCT ON (got multiple rows per customer → ambiguous serving); used a regular VIEW (recomputed on every query — too slow).",
        portfolioRelevance: "Knowing the UNIQUE INDEX requirement for CONCURRENTLY is a Postgres-trivia interview question. Yes/no answer = signal.",
        finalExplanation: "Materialized views are 'precomputed query results'. They trade staleness for query speed — perfect for serving.",
        misconceptionToWatchFor: "Using a regular view + relying on Postgres to cache. Postgres doesn't cache view results between queries.",
      }),
    },
    {
      stepNumber: 4,
      title: "Incremental refresh + backfill",
      instructionMd:
        "Schedule `REFRESH MATERIALIZED VIEW CONCURRENTLY online_features` every 5min via pg_cron. Also write a backfill function `backfill_features(start_ts, end_ts)` that recomputes customer_features into a snapshot table for any historical range — needed when feature definitions change. Validator runs backfill for a specific 1-day window + asserts the snapshot row count matches the input.",
      learningObjective: "Schedule incremental refresh + support point-in-time backfill for historical recomputation.",
      requiredSkill: "pg_cron + Postgres PL/pgSQL function + snapshot table pattern",
      starterCode: SRC(`-- 04_refresh_backfill.sql
-- Schedule refresh every 5min.
SELECT cron.schedule('refresh_online_features', '*/5 * * * *',
  $$ REFRESH MATERIALIZED VIEW CONCURRENTLY online_features $$);

CREATE OR REPLACE FUNCTION backfill_features(start_ts TIMESTAMP, end_ts TIMESTAMP)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  inserted INT;
BEGIN
  CREATE TABLE IF NOT EXISTS feature_snapshots
    (snapshot_at TIMESTAMP, customer_id TEXT, event_ts TIMESTAMP,
     orders_last_7d INT, orders_last_30d INT, revenue_last_30d INT);
  -- TODO:
  -- INSERT INTO feature_snapshots
  -- SELECT now(), customer_id, event_ts, orders_last_7d, orders_last_30d, revenue_last_30d
  -- FROM customer_features
  -- WHERE event_ts >= start_ts AND event_ts < end_ts;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig("sql_resultset", "SELECT backfill_features('2026-05-01', '2026-05-02') returns 1500 (the number of feature rows in that window).", {
        expectedInserted: 1500,
      }),
      expectedOutputs: { inserted: 1500 },
      datasetRefs: ["fixtures/feature_window_count.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "pg_cron syntax = standard cron (5 fields). */5 * * * * = every 5min.",
          "GET DIAGNOSTICS ROW_COUNT is the PL/pgSQL way to count affected rows.",
          "Always snapshot WITH timestamps so reruns are idempotent + auditable.",
          "Run backfill_features('2024-01-01', '2024-02-01') to fill a historical month; query feature_snapshots for analysis.",
          "(see reference above)",
        ],
        successFeedback: "Refresh + backfill both work. The store can re-compute history when definitions change.",
        failureFeedback: "Common slips: forgot ROW_COUNT (return 0 even when inserted); ran refresh non-concurrently (locks reads → online serving 500s during refresh).",
        portfolioRelevance: "Backfill capability separates 'I built a feature view' from 'I built a feature store'. Senior reviewers immediately ask.",
        finalExplanation: "Snapshot + backfill is the feature-store hallmark. Without it, every definition change is a one-way trip.",
        misconceptionToWatchFor: "Refreshing the matview without CONCURRENTLY. Online queries error during refresh — outage every 5min.",
      }),
    },
    {
      stepNumber: 5,
      title: "Offline-online parity check",
      instructionMd:
        "Write a parity query: pick 10 customer_ids, compare each customer's latest features as computed offline (DuckDB customer_features) vs. online (Postgres online_features). Raise an error if any row differs by more than 1 cent on revenue or any value on counts. Validator runs against matched data → 0 mismatches; perturbs one online row → mismatch detected.",
      learningObjective: "Validate that offline (training) and online (serving) feature pipelines agree.",
      requiredSkill: "Cross-engine SQL diff + tolerance-based comparison + assertion in CTE",
      starterCode: SRC(`-- 05_parity.sql (run from Python orchestrator that targets both engines)
-- DuckDB side: latest features per sampled customer.
-- WITH sample AS (SELECT customer_id FROM online_features ORDER BY random() LIMIT 10),
--      offline AS (SELECT DISTINCT ON (customer_id) customer_id, orders_last_7d, orders_last_30d, revenue_last_30d
--                  FROM customer_features WHERE customer_id IN (SELECT customer_id FROM sample)
--                  ORDER BY customer_id, event_ts DESC)
-- SELECT * FROM offline;

-- Postgres side (online):
-- SELECT customer_id, orders_last_7d, orders_last_30d, revenue_last_30d FROM online_features
-- WHERE customer_id IN (...);

-- TODO: orchestrator pulls both sides, diffs, raises if any mismatch.
`),
      validationType: "json_equal",
      stepType: "code_sql",
      validation: validationConfig("json_equal", "Matched: 10 customers, 0 mismatches. Perturb online row for C5 → 1 mismatch returned.", {
        matchedMismatches: 0, perturbedMismatches: 1,
      }),
      expectedOutputs: { matched: 0, perturbed: 1 },
      datasetRefs: ["fixtures/parity_sample.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Random sampling 10 keeps the diff cheap + catches systematic drift.",
          "Tolerance on revenue (1 cent) accounts for engine-specific rounding; counts must match exactly.",
          "Schedule parity check as a daily Airflow task; alert Slack on any mismatch.",
          "for row in offline_rows: assert row.matches(online_row[row.customer_id], rev_tol=1)",
          "(see reference above)",
        ],
        successFeedback: "Parity proven. Training data ≡ serving data — the feature-store correctness guarantee.",
        failureFeedback: "Common slips: compared float revenue without tolerance (false-positive mismatch on every run); didn't sample (full diff is slow + noisy).",
        portfolioRelevance: "Parity check is the senior-platform pattern. 'How do you know training matches serving?' = this answer.",
        finalExplanation: "Parity testing is to feature stores what reconciliation is to CDC. Both prove the system behaves as designed.",
        misconceptionToWatchFor: "Trusting that the offline + online queries 'should match because they're the same SQL'. Engine differences + materialization timing cause drift.",
      }),
    },
  ],
};
