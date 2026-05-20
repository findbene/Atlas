/**
 * Phase 7 — Wave 1c / analytics-engineer (advanced).
 * Candidate 3f258d41-44b7-4c78-8e6b-9f7d9c0e85fd — Snowflake Stream + Task Pipeline.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const analyticsEngineerSnowflakeStreamTaskPipeline: AuthoredProject = {
  slug: "analytics-engineer-snowflake-stream-task-pipeline",
  title: "Snowflake Streams + Tasks: Incremental dbt Pipeline",
  shortDescription:
    "Wire Snowflake Streams (CDC on a source table) to a Task DAG that runs incremental dbt models. Compose multiple tasks with dependencies, handle failures, and reconcile the materialized result against the source.",
  fullDescription:
    "Stitching dbt runs to Snowflake Streams is the 2026 analytics-engineering pattern for near-real-time warehouses without a Kafka/Airflow tier. You'll create a Stream that captures row-level changes on `orders`, a Task DAG that runs incremental dbt models when the Stream has data, handle failure semantics (Tasks retry independently), and write a checksum reconciliation that proves the materialized table matches the source.",
  language: "sql",
  difficulty: "advanced",
  techStack: ["Snowflake", "dbt", "SQL"],
  tags: ["snowflake", "streams", "tasks", "dbt", "incremental", "analytics-engineering", "cdc"],
  learningObjectives: [
    "Create a Snowflake STREAM on a table and explain offset semantics.",
    "Compose a TASK DAG with predecessor relationships and conditional WHEN SYSTEM$STREAM_HAS_DATA().",
    "Materialize incremental dbt models from the Stream output.",
    "Reconcile materialized data against the source with a checksum query.",
    "Surface failed-task alerts via Snowflake's TASK_HISTORY view.",
  ],
  estimatedMinutes: 180,
  xpReward: 600,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Marketing-attribution team needs `mart_orders` refreshed within 5min of every `orders` write. Current overnight dbt run leaves them 24h behind.",
    hiringRelevance2026:
      "Snowflake Streams + Tasks is the modern analytics-engineering pattern for low-latency warehouses without standing up Kafka or Airflow. Every senior AE JD lists it.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (Stream → Task DAG → dbt incremental)",
      "Step 1 STREAM on orders", "Step 2 Task DAG", "Step 3 dbt incremental",
      "Step 4 reconciliation", "Step 5 TASK_HISTORY alert", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with the Snowflake SQL (Streams + Task DAG), dbt project, reconciliation queries, and a runbook for resuming a failed task chain.",
    portfolioRelevance:
      "Streams + Tasks + dbt is a senior-AE pattern. Recruiters see this and know you can ship low-latency warehouses without unnecessary infrastructure.",
    repoUrl: "https://github.com/<your-handle>/snowflake-stream-task-pipeline",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "CREATE STREAM on orders with offsets",
      instructionMd:
        "Author SQL: `CREATE OR REPLACE STREAM orders_stream ON TABLE orders SHOW_INITIAL_ROWS = false APPEND_ONLY = false`. Why APPEND_ONLY=false? We want UPDATE + DELETE captured. Then validate by issuing 3 INSERTs and querying `SELECT METADATA$ACTION, count(*) FROM orders_stream GROUP BY 1`. Validator runs this and asserts 3 INSERT-action rows.",
      learningObjective: "Create a Snowflake Stream with the right offset + action semantics for downstream incremental processing.",
      requiredSkill: "Snowflake STREAM DDL + METADATA$ pseudo-columns + offset semantics",
      starterCode: SRC(`-- 01_stream.sql
CREATE OR REPLACE STREAM orders_stream ON TABLE orders
  SHOW_INITIAL_ROWS = FALSE
  APPEND_ONLY = FALSE;

-- After 3 INSERTs on orders, the stream surfaces them:
SELECT METADATA$ACTION, METADATA$ISUPDATE, count(*)
FROM orders_stream
GROUP BY 1, 2;
-- TODO: confirm 3 rows with METADATA$ACTION='INSERT', METADATA$ISUPDATE=false.
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig("sql_resultset", "After 3 INSERTs, stream contains 3 rows with METADATA$ACTION='INSERT'.", {
        expectedActionCounts: { INSERT: 3 },
      }),
      expectedOutputs: { insertRows: 3 },
      datasetRefs: ["fixtures/snowflake_orders_seed.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Stream offset advances only when you READ + commit the stream in a DML or task — selecting alone doesn't consume.",
          "SHOW_INITIAL_ROWS=true would include the pre-existing rows; usually you want false for CDC-style flows.",
          "APPEND_ONLY=true is faster but misses UPDATE/DELETE — use only for insert-only sources.",
          "Reset with CREATE OR REPLACE STREAM orders_stream ON TABLE orders — wipes offset.",
          "(see reference above)",
        ],
        successFeedback: "Stream tracks orders changes. Next step: drain it via a Task.",
        failureFeedback: "Common slips: SHOW_INITIAL_ROWS=true (got entire table); SELECTed without consuming inside a task (offset never advances → infinite re-reads).",
        portfolioRelevance: "Stream offset semantics is a top-3 Snowflake interview topic. Knowing CONSUME vs SELECT is the senior signal.",
        finalExplanation: "Streams are change-data on top of any table. The offset is the cursor; consuming it inside a DML advances it.",
        misconceptionToWatchFor: "Treating Stream as a queue. It's a VIEW with offset semantics — re-reading without consuming returns the same rows.",
      }),
    },
    {
      stepNumber: 2,
      title: "Task DAG with conditional WHEN",
      instructionMd:
        "Create a Task that runs every minute IF the stream has data: `CREATE TASK drain_orders WAREHOUSE = compute_wh SCHEDULE = '1 MINUTE' WHEN SYSTEM$STREAM_HAS_DATA('orders_stream') AS CALL run_dbt_models()`. Then chain a downstream Task `mart_refresh` AFTER `drain_orders` so the mart rebuilds after the staging update. Validator asserts root task + child + the SYSTEM$STREAM_HAS_DATA guard.",
      learningObjective: "Compose a Task DAG with predecessor edges and a conditional execution guard.",
      requiredSkill: "Snowflake CREATE TASK + AFTER + SYSTEM$STREAM_HAS_DATA + warehouse sizing",
      starterCode: SRC(`-- 02_tasks.sql
CREATE OR REPLACE TASK drain_orders
  WAREHOUSE = compute_wh
  SCHEDULE  = '1 MINUTE'
  WHEN SYSTEM$STREAM_HAS_DATA('orders_stream')
AS
  CALL run_dbt_models();  -- TODO: define this proc to invoke dbt incremental

-- Downstream task: refresh mart_orders AFTER drain_orders succeeds.
CREATE OR REPLACE TASK mart_refresh
  WAREHOUSE = compute_wh
  AFTER drain_orders
AS
  CALL refresh_mart_orders();

ALTER TASK mart_refresh RESUME;
ALTER TASK drain_orders RESUME;  -- root must be resumed LAST in the DAG order? No: resume children first, then root.
-- Snowflake rule: ALTER TASK ... RESUME on children before the root task.
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig("sql_resultset", "SHOW TASKS contains drain_orders (root) + mart_refresh (predecessor=drain_orders) + WHEN clause present.", {
        expectedTasks: ["drain_orders", "mart_refresh"], expectedPredecessor: "drain_orders",
      }),
      expectedOutputs: { tasks: 2, predecessor: "drain_orders" },
      datasetRefs: ["fixtures/show_tasks_expected.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "SYSTEM$STREAM_HAS_DATA short-circuits the task — saves warehouse compute when there's no change.",
          "RESUME order: children first, then root. Reverse it and Snowflake rejects.",
          "Use SHOW TASKS IN SCHEMA to inspect DAG topology + state.",
          "ALTER TASK mart_refresh RESUME; ALTER TASK drain_orders RESUME;",
          "(see reference above)",
        ],
        successFeedback: "Task DAG composed. drain_orders fires only when there's data; mart_refresh follows.",
        failureFeedback: "Common slips: forgot RESUME (tasks created in SUSPENDED state — never fire); resumed root before children (Snowflake error).",
        portfolioRelevance: "Task DAGs with conditional guards is the modern Snowflake pattern. Recruiters know this is the production-AE skill.",
        finalExplanation: "Tasks + Streams together = lightweight orchestration without Airflow. The DAG topology + RESUME order is the gotcha most candidates miss.",
        misconceptionToWatchFor: "Scheduling all tasks independently. You lose dependency guarantees; mart_refresh can race ahead of drain_orders.",
      }),
    },
    {
      stepNumber: 3,
      title: "dbt incremental from stream",
      instructionMd:
        "Build `models/stg_orders.sql` as `materialized=incremental, unique_key='id', incremental_strategy='merge'` selecting from `orders_stream` and casting METADATA$ACTION to a stable row state. CONSUMING the stream happens automatically when dbt's MERGE runs (it's a DML on a different table reading from the stream). Validator runs dbt build with 5 stream rows + asserts stg_orders has the 5 rows + stream offset advanced.",
      learningObjective: "Materialize incremental dbt models from a Snowflake Stream and explain how MERGE consumes the stream offset.",
      requiredSkill: "dbt incremental + Snowflake stream consumption + METADATA$ACTION",
      starterCode: SRC(`-- models/stg_orders.sql
{{ config(materialized='incremental', unique_key='id', incremental_strategy='merge') }}
SELECT
  id, customer_id, total_cents, status, updated_at,
  METADATA$ACTION  AS _action,
  METADATA$ISUPDATE AS _is_update
FROM {{ source('raw', 'orders_stream') }}
WHERE METADATA$ACTION = 'INSERT'
   OR (METADATA$ACTION = 'DELETE' AND METADATA$ISUPDATE = TRUE)
-- TODO: handle delete-action rows for SCD-style downstream. For now keep upserts + updates.
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig("sql_resultset", "After 5 stream rows + dbt build: stg_orders has 5 rows; SELECT count(*) FROM orders_stream = 0 (offset advanced).", {
        expectedStagingRows: 5, expectedStreamAfter: 0,
      }),
      expectedOutputs: { stagingRows: 5, streamAfterDrain: 0 },
      datasetRefs: ["fixtures/dbt_stg_orders_expected.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "The MERGE generated by dbt's incremental_strategy='merge' is a DML — it advances the stream offset as a side effect.",
          "METADATA$ACTION ∈ {INSERT, DELETE}. For UPDATEs, you get a DELETE + INSERT pair both with METADATA$ISUPDATE=true.",
          "Use the merge-pair pattern: keep INSERT rows + DELETE rows where ISUPDATE=true to get the new state of updated rows.",
          "Confirm with `SELECT SYSTEM$STREAM_HAS_DATA('orders_stream')` — should return FALSE after dbt run.",
          "(see reference above)",
        ],
        successFeedback: "dbt now consumes the stream incrementally. Each run drains exactly what's new.",
        failureFeedback: "Common slips: included DELETE rows with ISUPDATE=false (real deletes — get upserted as ghost rows); ran dbt run on a non-DML model (stream not consumed).",
        portfolioRelevance: "Knowing the METADATA$ACTION + ISUPDATE merge-pair pattern is depth most candidates skip. Senior AE differentiator.",
        finalExplanation: "Snowflake represents updates as a (delete, insert) pair in the stream. The ISUPDATE flag lets you distinguish from true deletes.",
        misconceptionToWatchFor: "Querying the stream from a non-DML SELECT and being surprised offset doesn't advance. Only DML consumption advances.",
      }),
    },
    {
      stepNumber: 4,
      title: "Reconciliation: source vs mart",
      instructionMd:
        "Write `reconcile.sql` that returns rows where `(SELECT count(*), sum(hash(status||total_cents)) FROM orders)` ≠ `(SELECT count(*), sum(hash(status||total_cents)) FROM mart_orders)`. Schedule via a third Task that runs every 15min. Alert via the next step. Validator runs the reconcile against a contrived drift scenario and asserts the result is non-empty.",
      learningObjective: "Detect drift between source and materialized mart via a row-count + checksum diff.",
      requiredSkill: "Snowflake aggregates + cross-database diff + scheduled task",
      starterCode: SRC(`-- 04_reconcile.sql
CREATE OR REPLACE PROCEDURE check_drift() RETURNS STRING LANGUAGE SQL AS $$
DECLARE
  src_rows  INT;  src_sum   BIGINT;
  mart_rows INT;  mart_sum  BIGINT;
BEGIN
  SELECT count(*), sum(hash(status || total_cents::string))
    INTO :src_rows, :src_sum FROM orders;
  SELECT count(*), sum(hash(status || total_cents::string))
    INTO :mart_rows, :mart_sum FROM mart_orders;
  IF (:src_rows != :mart_rows OR :src_sum != :mart_sum) THEN
    -- TODO: INSERT INTO drift_log VALUES (current_timestamp(), :src_rows, :mart_rows, :src_sum, :mart_sum);
    RETURN 'DRIFT';
  END IF;
  RETURN 'OK';
END;
$$;

CREATE OR REPLACE TASK reconcile_drift
  WAREHOUSE = compute_wh
  SCHEDULE  = '15 MINUTE'
AS
  CALL check_drift();
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig("sql_resultset", "Identical orders+mart_orders → CALL check_drift() returns 'OK'. Mutate one mart row's total_cents → returns 'DRIFT'.", {
        matchedReturn: "OK", driftReturn: "DRIFT",
      }),
      expectedOutputs: { matched: "OK", drifted: "DRIFT" },
      datasetRefs: ["fixtures/reconcile_inputs.sql"],
      pedagogy: pedagogyConfig({
        hints: [
          "Use Snowflake's hash() not external functions — runs in-engine, no data export.",
          "INSERT into drift_log on DRIFT so downstream alerting (next step) has a queryable signal.",
          "Schedule reconcile less often than the task DAG so the mart has time to converge.",
          "Confirm: after a synthetic data corruption, `SELECT * FROM drift_log` shows the row.",
          "(see reference above)",
        ],
        successFeedback: "Drift now detectable + logged. Next step wires the alert.",
        failureFeedback: "Common slips: reconciled DURING the task run (race — got transient false positives); used different hash functions across DBs.",
        portfolioRelevance: "Reconciliation is the AE skill. Senior interviewers ask 'how do you trust the mart?' — this is the answer.",
        finalExplanation: "Reconciliation logged-to-table + scheduled = drift becomes a queryable signal, not a midnight call.",
        misconceptionToWatchFor: "Skipping reconciliation because 'dbt tests pass'. Tests prove model logic; reconciliation proves end-to-end DATA.",
      }),
    },
    {
      stepNumber: 5,
      title: "Task failure alerts via TASK_HISTORY",
      instructionMd:
        "Author a query against `INFORMATION_SCHEMA.TASK_HISTORY(SCHEDULED_TIME_RANGE_START=>dateadd('hour',-1,current_timestamp()))` that returns any task with `STATE='FAILED'` in the last hour. Wire to a SNS notification via an external function (or stub: write to a `task_alerts` table). Validator simulates a failed task + asserts the query returns it.",
      learningObjective: "Surface failed tasks via TASK_HISTORY and route alerts.",
      requiredSkill: "Snowflake INFORMATION_SCHEMA.TASK_HISTORY + external function or table-based alerting",
      starterCode: SRC(`-- 05_alerts.sql
CREATE OR REPLACE PROCEDURE alert_failed_tasks() RETURNS INT LANGUAGE SQL AS $$
DECLARE
  cnt INT;
BEGIN
  CREATE TABLE IF NOT EXISTS task_alerts (alerted_at TIMESTAMP, task_name STRING, error_message STRING);
  INSERT INTO task_alerts
  SELECT current_timestamp(), name, error_message
  FROM TABLE(INFORMATION_SCHEMA.TASK_HISTORY(
    SCHEDULED_TIME_RANGE_START => dateadd('hour', -1, current_timestamp())))
  WHERE state = 'FAILED'
    AND name NOT IN (SELECT task_name FROM task_alerts WHERE alerted_at > dateadd('hour', -1, current_timestamp()));
  SELECT count(*) INTO :cnt FROM task_alerts WHERE alerted_at > dateadd('minute', -1, current_timestamp());
  RETURN :cnt;
END;
$$;

CREATE OR REPLACE TASK monitor_task_failures
  WAREHOUSE = compute_wh
  SCHEDULE  = '5 MINUTE'
AS CALL alert_failed_tasks();
-- TODO: ALTER TASK monitor_task_failures RESUME and verify with SHOW TASKS.
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig("sql_resultset", "Simulate a failed drain_orders task (insert into TASK_HISTORY shim) + CALL alert_failed_tasks() ≥ 1; task_alerts has the row.", {
        expectedAlerts: 1,
      }),
      expectedOutputs: { alerts: 1 },
      datasetRefs: ["fixtures/task_history_failure.sql"],
      pedagogy: pedagogyConfig({
        hints: [
          "INFORMATION_SCHEMA.TASK_HISTORY is a table function — pass a time range or it scans 7d.",
          "Dedupe alerts by checking task_alerts before re-inserting — prevents alert storms.",
          "External functions can POST to PagerDuty/Slack directly from Snowflake — best when paired with API integrations.",
          "Production: pair this with `alert_failed_tasks` as a scheduled Task that loops on the `task_alerts` table — single point of integration.",
          "(see reference above)",
        ],
        successFeedback: "Failed tasks now surface within 5min. Add downstream Slack integration via external function for paging.",
        failureFeedback: "Common slips: didn't dedupe (alert storm — 12 alerts/hour for one ongoing failure); scanned ALL TASK_HISTORY (slow + expensive).",
        portfolioRelevance: "Operational alerting is the senior signal. Every JD says 'monitor pipelines' — this is the concrete implementation.",
        finalExplanation: "TASK_HISTORY + a dedup query + scheduled task = closed-loop monitoring without external infra. Add an external function call for paging.",
        misconceptionToWatchFor: "Trusting Snowflake's email_integration as the only alerting. It works but is brittle — make sure you have a queryable log too.",
      }),
    },
  ],
};
