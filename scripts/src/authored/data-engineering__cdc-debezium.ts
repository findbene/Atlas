/**
 * Phase 7 — Wave 1b / data-engineering (advanced).
 * Candidate e74740b9-152a-40b7-bbdb-798a485e89e6 — CDC Replication with Debezium.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const dataEngineeringCdcDebezium: AuthoredProject = {
  slug: "data-engineering-cdc-debezium",
  title: "Postgres CDC → Snowflake with Debezium + dbt Reconciliation",
  shortDescription:
    "Set up Debezium logical-replication CDC from Postgres into Kafka, land the change stream into Snowflake raw tables, materialize current-state via dbt incremental + snapshot models, and add a row-count reconciliation job that alerts on drift.",
  fullDescription:
    "Batch ETL leaves a ~24h gap between source-of-truth and warehouse — fatal when finance or fraud teams need fresh data. Change Data Capture (CDC) via Debezium tails the Postgres WAL and emits every row change as a Kafka event in milliseconds. You'll wire the end-to-end: Postgres logical replication slot → Debezium connector → Snowflake sink → dbt incremental + snapshot models → a reconciliation script + observability hooks that detect drift before stakeholders do.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Kafka", "postgres", "snowflake", "dbt", "observability", "Debezium"],
  tags: ["cdc", "debezium", "kafka", "snowflake", "dbt", "postgres", "data-engineering", "observability"],
  learningObjectives: [
    "Enable Postgres logical replication and configure a Debezium connector for a transactional table.",
    "Land the Kafka CDC stream into Snowflake raw tables with proper key/operation handling.",
    "Materialize current-state with dbt incremental models + slowly-changing-dimension snapshots.",
    "Implement a row-count + checksum reconciliation script that catches CDC drift.",
    "Surface drift + connector lag via OpenTelemetry metrics for on-call.",
  ],
  estimatedMinutes: 210,
  xpReward: 700,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Finance team needs Snowflake to mirror the orders table within 60s of every commit, with an SCD-2 history for audit. Current overnight ETL leaves them blind during the day.",
    hiringRelevance2026:
      "CDC is the #1 DE interview topic in 2026 — every modern data team has either built it or is migrating to it. Debezium + Snowflake + dbt reconciliation is the textbook combo.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (PG WAL → Debezium → Kafka → Snowflake → dbt)",
      "Step 1 logical replication", "Step 2 Snowflake sink", "Step 3 dbt incremental + snapshot",
      "Step 4 reconciliation script", "Step 5 OTel metrics", "Validation", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with docker-compose for Postgres + Kafka + Debezium Connect + a Snowflake-compatible mock, the connector JSON configs, dbt project with incremental + snapshot models, reconciliation script, and a runbook for connector restart-from-snapshot.",
    portfolioRelevance:
      "Recruiters know CDC is hard to set up correctly. A repo that ships connector configs + reconciliation + observability is the senior-DE signal.",
    repoUrl: "https://github.com/<your-handle>/postgres-cdc-snowflake",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Enable Postgres logical replication + Debezium connector",
      instructionMd:
        "Configure Postgres for logical replication: set `wal_level=logical`, `max_replication_slots=4`, create publication `dbz_orders FOR TABLE orders`. Then submit a Debezium connector to Kafka Connect REST with `plugin.name=pgoutput`, `slot.name=debezium_orders`, `publication.name=dbz_orders`, and `tombstones.on.delete=false` (we want explicit DELETE events). Validator hits Kafka Connect REST, asserts the connector exists + RUNNING, and verifies the slot appears in `pg_replication_slots`.",
      learningObjective: "Configure Postgres WAL + Debezium connector for low-latency CDC.",
      requiredSkill: "Postgres logical replication + Debezium connector config + Kafka Connect REST",
      starterCode: SRC(`# connectors/orders-cdc.json
{
  "name": "orders-cdc",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "postgres",
    "database.port": "5432",
    "database.user": "debezium",
    "database.password": "debezium",
    "database.dbname": "app",
    "topic.prefix": "app",
    "table.include.list": "public.orders",
    "plugin.name": "pgoutput",
    "slot.name": "debezium_orders",
    "publication.name": "dbz_orders",
    "tombstones.on.delete": "false",
    "snapshot.mode": "initial"
  }
}

# submit.sh
# TODO: curl -X POST -H 'Content-Type: application/json' http://connect:8083/connectors -d @connectors/orders-cdc.json
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "GET /connectors/orders-cdc/status returns state=RUNNING and pg_replication_slots contains debezium_orders.", {
        expectedConnectorState: "RUNNING", expectedSlotName: "debezium_orders",
      }),
      expectedOutputs: { connectorState: "RUNNING", slot: "debezium_orders" },
      datasetRefs: ["fixtures/connect_status_running.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "wal_level=logical requires a Postgres restart. Set it in postgresql.conf, not just SQL.",
          "publication = list of tables to track. Slot = consumer cursor into the WAL. Both names appear in the connector config.",
          "pgoutput is the modern decoder shipped with Postgres ≥10. Older guides reference wal2json; prefer pgoutput in 2026.",
          "psql: ALTER SYSTEM SET wal_level='logical'; CREATE PUBLICATION dbz_orders FOR TABLE orders; (restart) CREATE_REPLICATION_SLOT debezium_orders LOGICAL pgoutput; — Debezium will create it if missing, but pre-creating helps you control names.",
          "(see reference above)",
        ],
        successFeedback: "WAL is now being tailed. Every commit to orders shows up as a Kafka message on app.public.orders.",
        failureFeedback: "Common slips: forgot wal_level=logical (slot creation hangs); used pgjdbc password auth without scram-sha-256 (Debezium 2.x fails); set tombstones.on.delete=true (downstream loses the DELETE payload).",
        portfolioRelevance: "Knowing the WAL+slot+publication trio cold is the senior-DE differentiator in CDC interviews.",
        finalExplanation: "Postgres logical replication exposes the WAL as a logical event stream. Debezium translates it to Kafka events; everything downstream is now a consumer.",
        misconceptionToWatchFor: "Polling-based 'CDC' on updated_at timestamps. Misses deletes, fragile under clock skew, high source DB load. True CDC requires tailing the log.",
      }),
    },
    {
      stepNumber: 2,
      title: "Snowflake sink — land raw CDC events",
      instructionMd:
        "Author SQL to land Kafka topic `app.public.orders` into `RAW.ORDERS_CDC(op, ts_ms, before, after)` using Snowflake's Kafka connector. Then write a `MERGE` statement that upserts current state into `STAGING.ORDERS_CURRENT(id, customer_id, total_cents, status, updated_at)`, including DELETE handling (op='d' → DELETE FROM STAGING.ORDERS_CURRENT). Validator runs the MERGE against a fixed batch of 5 events (3 INSERTs, 1 UPDATE, 1 DELETE) and asserts STAGING.ORDERS_CURRENT has the right rows.",
      learningObjective: "Translate Debezium envelope events into idempotent MERGE upserts in Snowflake.",
      requiredSkill: "Snowflake MERGE + Debezium envelope schema + idempotent upserts",
      starterCode: SRC(`-- staging_merge.sql
MERGE INTO STAGING.ORDERS_CURRENT t
USING (
  SELECT
    COALESCE(after:id::int, before:id::int) AS id,
    after:customer_id::int                  AS customer_id,
    after:total_cents::int                  AS total_cents,
    after:status::string                    AS status,
    TO_TIMESTAMP_NTZ(ts_ms / 1000)          AS updated_at,
    op
  FROM RAW.ORDERS_CDC
  WHERE ingest_batch_id = :batch_id
  QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY ts_ms DESC) = 1
) s
ON t.id = s.id
WHEN MATCHED AND s.op = 'd' THEN DELETE
WHEN MATCHED AND s.op IN ('u', 'r', 'c') THEN UPDATE SET
  customer_id = s.customer_id, total_cents = s.total_cents,
  status = s.status, updated_at = s.updated_at
WHEN NOT MATCHED AND s.op IN ('c', 'r', 'u') THEN INSERT
  (id, customer_id, total_cents, status, updated_at)
  VALUES (s.id, s.customer_id, s.total_cents, s.status, s.updated_at);
-- TODO: confirm QUALIFY ROW_NUMBER trims duplicate events per id within the batch.
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig("sql_resultset", "Apply 5-event batch (3 INSERT, 1 UPDATE, 1 DELETE) — final STAGING.ORDERS_CURRENT = 2 rows with expected ids/status.", {
        expectedFinalRowIds: [101, 102], expectedDeletedId: 100,
      }),
      expectedOutputs: { rows: 2, deleted: 1 },
      datasetRefs: ["fixtures/orders_cdc_batch.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Debezium envelope: { op: 'c'|'u'|'d'|'r' (read=snapshot), ts_ms, before, after }.",
          "QUALIFY ROW_NUMBER OVER (PARTITION BY id ORDER BY ts_ms DESC) keeps only the latest event per id per batch — critical for idempotency.",
          "COALESCE(after:id, before:id) because DELETE events have a null after.",
          "Three-arm MERGE: WHEN MATCHED AND op='d' THEN DELETE / WHEN MATCHED AND op IN ('u','r','c') THEN UPDATE / WHEN NOT MATCHED AND op IN ('c','r','u') THEN INSERT.",
          "(see reference above)",
        ],
        successFeedback: "Idempotent MERGE means you can re-run the same batch any number of times with the same result. That's the foundation of CDC reliability.",
        failureFeedback: "Common slips: didn't dedupe by ts_ms in the batch (multiple events for the same id during one window overwrite each other in non-deterministic order); ignored op='d' (deletes never propagate).",
        portfolioRelevance: "MERGE-based idempotent upsert is a standard whiteboard question for senior DE interviews. Solving it WITH delete handling is the differentiator.",
        finalExplanation: "Idempotency is the difference between 'I can replay 24h of CDC after a Snowflake outage' and 'I have to manually reconcile'. Build it in from day one.",
        misconceptionToWatchFor: "Using INSERT ... ON CONFLICT instead of MERGE. ON CONFLICT doesn't exist in Snowflake; even where it does (Postgres), it doesn't model the DELETE branch.",
      }),
    },
    {
      stepNumber: 3,
      title: "dbt incremental + snapshot for SCD-2 history",
      instructionMd:
        "Build two dbt models: (a) `orders_current` as `materialized=incremental, unique_key='id', incremental_strategy='merge'` reading from STAGING.ORDERS_CURRENT; (b) `snapshots/orders_snapshot.sql` using dbt's `{% snapshot %}` block with `strategy='check', check_cols=['status','total_cents']` to build SCD-2 history. Validator runs `dbt build`, asserts orders_current row count matches staging, and asserts the snapshot table has the right `dbt_valid_from`/`dbt_valid_to` rows after a status flip.",
      learningObjective: "Materialize current-state + SCD-2 history from CDC with idiomatic dbt.",
      requiredSkill: "dbt incremental models + snapshots + SCD Type 2",
      starterCode: SRC(`-- models/orders_current.sql
{{ config(materialized='incremental', unique_key='id', incremental_strategy='merge') }}
SELECT id, customer_id, total_cents, status, updated_at
FROM {{ source('staging', 'orders_current') }}
{% if is_incremental() %}
  WHERE updated_at > (SELECT COALESCE(MAX(updated_at), '1970-01-01') FROM {{ this }})
{% endif %}

-- snapshots/orders_snapshot.sql
{% snapshot orders_snapshot %}
  {{ config(target_schema='snapshots', unique_key='id',
            strategy='check', check_cols=['status', 'total_cents']) }}
  SELECT id, customer_id, total_cents, status, updated_at FROM {{ ref('orders_current') }}
{% endsnapshot %}
-- TODO: run: dbt build --select orders_current orders_snapshot
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig("sql_resultset", "After two batches (id=101 status='new' then 'shipped'), orders_snapshot has 2 rows for id=101 — first with dbt_valid_to set, second with dbt_valid_to NULL.", {
        expectedSnapshotRows: 2, expectedOpenRow: 1,
      }),
      expectedOutputs: { snapshotRows: 2, openRows: 1 },
      datasetRefs: ["fixtures/dbt_snapshot_expected.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "incremental_strategy='merge' uses Snowflake MERGE under the hood — same idempotency property as step 2.",
          "Snapshot 'check' strategy detects changes by comparing check_cols hash. 'timestamp' strategy uses an updated_at column.",
          "dbt_valid_from / dbt_valid_to are managed automatically by the snapshot block.",
          "After a status change, `select * from snapshots.orders_snapshot where id=101 order by dbt_valid_from` shows two rows: the old version with dbt_valid_to set, and the new with NULL.",
          "(see reference above)",
        ],
        successFeedback: "Current state lives in orders_current, history lives in orders_snapshot. Finance now has both fresh data and audit trail.",
        failureFeedback: "Common slips: used `materialized='table'` instead of incremental (full refresh every run, expensive); included updated_at in check_cols (every CDC event creates a new SCD row — explosion).",
        portfolioRelevance: "dbt snapshot + incremental is a senior analytics-engineering pattern. CDC pipeline → dbt models is the modern data-stack default.",
        finalExplanation: "SCD-2 is the gold standard for 'what did the row look like on day X?'. dbt snapshots automate the SCD-2 plumbing.",
        misconceptionToWatchFor: "Storing history as a giant audit log table. Possible, but you lose the 'as-of' query capability snapshots give you.",
      }),
    },
    {
      stepNumber: 4,
      title: "Reconciliation: row count + checksum drift alarm",
      instructionMd:
        "Write `reconcile.py` that every 5min: (a) queries `SELECT count(*), sum(hashtext(status||total_cents)) FROM orders` on Postgres; (b) queries the same on Snowflake (orders_current); (c) raises if either differs. Validator stubs both DBs with controlled data, runs reconciliation, asserts no alert when matched and an alert when mismatched.",
      learningObjective: "Detect CDC drift with a count+checksum reconciliation job.",
      requiredSkill: "psycopg + snowflake-connector + structured drift detection",
      starterCode: SRC(`# reconcile.py
import psycopg, snowflake.connector
from dataclasses import dataclass

@dataclass(frozen=True)
class Snapshot:
    rows: int
    checksum: int

class DriftAlert(Exception): pass

def pg_snapshot(conn) -> Snapshot:
    with conn.cursor() as cur:
        cur.execute("SELECT count(*), sum(hashtext(status||total_cents::text)) FROM orders")
        rows, chksum = cur.fetchone()
        return Snapshot(rows=rows or 0, checksum=int(chksum or 0))

def sf_snapshot(conn) -> Snapshot:
    with conn.cursor() as cur:
        cur.execute("SELECT count(*), sum(hash(status||total_cents::string)) FROM orders_current")
        rows, chksum = cur.fetchone()
        return Snapshot(rows=rows or 0, checksum=int(chksum or 0))

def reconcile(pg, sf) -> None:
    # TODO: a = pg_snapshot(pg); b = sf_snapshot(sf)
    # if a != b: raise DriftAlert(f"pg={a} sf={b}")
    raise NotImplementedError
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Stubbed pg and sf return identical snapshots → no exception. Mutate sf checksum by 1 → DriftAlert raised.", {
        matchedCase: { rows: 100, checksum: 12345 }, mismatchedCase: true,
      }),
      expectedOutputs: { matched: true, drifted: true },
      datasetRefs: ["fixtures/reconcile_snapshots.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Row count catches missing/duplicate inserts. Checksum catches silent value drift.",
          "Use the source DB's hash function (hashtext on PG, hash on Snowflake) — they produce different numbers but the COMPARISON is over identical pure-Python ints.",
          "Wait — different hashes won't match. Use a stable hash on both sides: md5(status||total_cents) → cast to bigint via substring + conv.",
          "def stable_hash(s): return int(hashlib.md5(s.encode()).hexdigest()[:8], 16) — compute on both sides client-side OR use md5() in SQL and sum the bigint cast on both engines.",
          "(see reference above)",
        ],
        successFeedback: "Drift detection ships. On-call now has a high-signal alarm instead of trusting the connector silently.",
        failureFeedback: "Common slips: compared row count only (silent value drift slips through); used engine-specific hash functions that don't agree (constant false alarms).",
        portfolioRelevance: "Reconciliation is THE production-DE pattern. Every senior-DE interview asks 'how do you know the data is right?'. This is the answer.",
        finalExplanation: "Trust-but-verify is the only correct CDC posture. Reconciliation transforms 'I hope it works' into 'I'll know within 5min if it doesn't'.",
        misconceptionToWatchFor: "Trusting connector lag metrics as the only signal. Lag tells you events are flowing, not that they're CORRECT.",
      }),
    },
    {
      stepNumber: 5,
      title: "OpenTelemetry: connector lag + drift counter",
      instructionMd:
        "Emit two OTel metrics: `cdc.connector.lag_seconds` (gauge — read from Connect REST `/connectors/orders-cdc/status` and the LSN), and `cdc.drift.count` (counter — incremented when reconcile() raises DriftAlert). Wire to OTLP. Validator scrapes after one synthetic drift and asserts both metrics appear with expected values.",
      learningObjective: "Emit structured operational metrics so CDC failures are visible before stakeholders notice.",
      requiredSkill: "OpenTelemetry + Connect REST scraping + counter vs gauge semantics",
      starterCode: SRC(`# metrics.py
from opentelemetry import metrics
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter

reader = PeriodicExportingMetricReader(OTLPMetricExporter(endpoint="otel-collector:4317"), 10_000)
metrics.set_meter_provider(MeterProvider(metric_readers=[reader]))
meter = metrics.get_meter("cdc.orders")

drift_counter = meter.create_counter("cdc.drift.count")
# TODO: create_observable_gauge('cdc.connector.lag_seconds', callbacks=[lag_cb])
# lag_cb: GET http://connect:8083/connectors/orders-cdc/status, compute now - last_committed_ts.
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "After one DriftAlert, drift counter = 1. After scrape, lag gauge present (any float).", {
        expectedDriftCount: 1, expectLagPresent: true,
      }),
      expectedOutputs: { drift: 1, lagPresent: true },
      datasetRefs: ["fixtures/otel_cdc_dump.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Counter = monotonically increasing (use for events: drift detected, retry attempt). Gauge = current value (use for lag, queue depth).",
          "Connect REST returns last_offset for the source connector — diff against now to get lag.",
          "OTLP exporter pushes metrics in OpenMetrics format. Prometheus/Tempo both consume it directly.",
          "drift_counter.add(1, {'connector': 'orders-cdc'}); meter.create_observable_gauge('cdc.connector.lag_seconds', callbacks=[lambda opts: [Observation(get_lag())]])",
          "(see reference above)",
        ],
        successFeedback: "Both metrics scrape. Add a Grafana alert: cdc.drift.count > 0 OR cdc.connector.lag_seconds > 60.",
        failureFeedback: "Common slips: used a counter for lag (counters can't go down → graph never recovers); didn't add the connector label (multi-connector deployments mush together).",
        portfolioRelevance: "Metrics-driven CDC observability is the senior signal. Most candidates ship pipelines with zero metrics; you'll ship two that on-call uses.",
        finalExplanation: "Counter vs gauge is a fundamental observability distinction. Get it wrong and your dashboards/alerts misbehave subtly.",
        misconceptionToWatchFor: "Putting drift detection inside a print(). Logs don't aggregate; one drift = one log line. A counter lets you alert on rate (drifts per hour).",
      }),
    },
  ],
};
