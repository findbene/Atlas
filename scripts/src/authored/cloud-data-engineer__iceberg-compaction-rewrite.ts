/**
 * Phase 7 — Wave 1b / cloud-data-engineer (advanced).
 * Candidate bbb58131-76b5-41f3-b2ae-7bea4e2c0981 — Iceberg Compaction + Rewrite Pipeline.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const cloudDataEngineerIcebergCompactionRewrite: AuthoredProject = {
  slug: "cloud-data-engineer-iceberg-compaction-rewrite",
  candidateId: "bbb58131-76b5-41f3-b2ae-7bea4e2c0981",
  title: "Iceberg Compaction + Rewrite Pipeline on EMR Serverless",
  shortDescription:
    "Build a Spark job that compacts small Iceberg files (rewrite_data_files), expires snapshots, and removes orphan files for a high-ingest Iceberg table. Schedule on EMR Serverless via Airflow, expose throughput + file-count metrics, and validate Athena queries get faster after compaction.",
  fullDescription:
    "Streaming-ingest Iceberg tables accumulate thousands of tiny files per partition per day, blowing up planning time and Athena query cost. The 2026 production fix is a scheduled compaction job: Spark's `rewrite_data_files` procedure coalesces small files into ~256MB targets, `expire_snapshots` reclaims unreferenced metadata, `remove_orphan_files` cleans up half-written aborts. You'll wire this on EMR Serverless (no cluster mgmt), schedule on Airflow with proper alerting, and prove it: an Athena benchmark before/after shows query speedup.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Iceberg", "Spark", "Terraform", "Athena", "observability", "Airflow"],
  tags: ["iceberg", "spark", "compaction", "terraform", "athena", "emr-serverless", "cloud-data-engineering", "observability"],
  learningObjectives: [
    "Run Iceberg's rewrite_data_files procedure on Spark to compact small files into 256MB targets.",
    "Combine compaction with expire_snapshots + remove_orphan_files to bound metadata + storage.",
    "Deploy + schedule the job on EMR Serverless via Terraform-provisioned Airflow.",
    "Benchmark Athena query speedup before/after compaction.",
    "Export file count + p99 query latency to OTel for ongoing visibility.",
  ],
  estimatedMinutes: 220,
  xpReward: 700,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Analytics team's Athena queries on the `events` Iceberg table went from 8s to 90s over 6 weeks because of small-files accumulation. Need a scheduled maintenance pipeline that keeps queries fast without manual intervention.",
    hiringRelevance2026:
      "Iceberg-on-S3 is the 2026 cloud-DE lakehouse default. Compaction + snapshot expiry + orphan cleanup is the senior-IC operational knowledge that separates production users from notebook explorers.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (Spark → EMR Serverless → Iceberg → Athena)",
      "Step 1 rewrite_data_files", "Step 2 expire + orphan cleanup",
      "Step 3 Terraform EMR Serverless + Airflow DAG", "Step 4 Athena benchmark",
      "Step 5 OTel metrics", "Validation", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with the PySpark compaction job, Terraform module for EMR Serverless + Airflow, Airflow DAG, an Athena benchmark notebook showing 8x speedup, and a Grafana dashboard JSON for file count + query latency.",
    portfolioRelevance:
      "Iceberg compaction is operational knowledge most candidates don't have. Recruiters hiring for cloud-DE roles in 2026 know this is exactly the production-realism signal they need.",
    repoUrl: "https://github.com/<your-handle>/iceberg-compaction-pipeline",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "rewrite_data_files — compact to 256MB targets",
      instructionMd:
        "Author `compact.py`: a PySpark job that calls `CALL catalog.system.rewrite_data_files(table => 'db.events', strategy => 'binpack', options => map('target-file-size-bytes', '268435456'))`. Run on partitions older than `now - 1 day` (current partition still being written). Self-check: run the job against a fixture table with 1000 × 1MB small files in one partition and confirm ≤8 files remain after compaction; also confirm the where clause excludes the active partition.",
      learningObjective: "Use Iceberg's rewrite_data_files procedure to coalesce small files into target-sized files.",
      requiredSkill: "Iceberg procedures + Spark Iceberg catalog + partition filter syntax",
      starterCode: SRC(`# compact.py
from pyspark.sql import SparkSession
from datetime import datetime, timedelta, timezone

spark = (
    SparkSession.builder
    .config("spark.sql.catalog.lake", "org.apache.iceberg.spark.SparkCatalog")
    .config("spark.sql.catalog.lake.type", "rest")
    .config("spark.sql.catalog.lake.uri", "http://iceberg-rest:8181")
    .config("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions")
    .getOrCreate()
)

cutoff = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")

# TODO: spark.sql(f"""
#   CALL lake.system.rewrite_data_files(
#     table => 'db.events',
#     strategy => 'binpack',
#     where => 'event_date < date(\\'{cutoff}\\')',
#     options => map('target-file-size-bytes', '268435456', 'min-input-files', '5')
#   )
# """)
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "After rewrite_data_files with strategy='binpack' and target-file-size-bytes=268435456, the partition containing 1000 × 1MB files has ≤8 files remaining",
          "The where clause filters to partitions older than now - 1 day (the active partition is not compacted)",
          "The CALL uses strategy='binpack' and options map with target-file-size-bytes=268435456 and min-input-files=5",
        ],
      }),
      expectedOutputs: { filesAfter: 8 },
      datasetRefs: ["fixtures/iceberg_table_before_compact.snapshot"],
      pedagogy: pedagogyConfig({
        hints: [
          "binpack = simplest strategy. Sort/zorder also exist but require column choice — start with binpack.",
          "target-file-size-bytes = 256MB is the Iceberg-team default for S3 + Parquet. Smaller = too many files; bigger = slow Athena scans.",
          "where filter is critical: never compact the actively-written partition (write+compact race causes commit conflicts).",
          "spark.sql(\"CALL lake.system.rewrite_data_files(table => 'db.events', strategy => 'binpack', where => 'event_date < current_date()', options => map('target-file-size-bytes', '268435456'))\")",
          "(see reference above)",
        ],
        successFeedback: "1000 files → 4 files for the same data. Athena planner is now happy.",
        failureFeedback: "Common slips: compacted current-day partition (concurrent write conflicts); set target too low (didn't actually reduce file count); skipped the where clause (compacts everything including hot partition).",
        portfolioRelevance: "Knowing the rewrite_data_files procedure cold is the senior-IC differentiator in Iceberg interviews.",
        finalExplanation: "Iceberg procedures are SQL-callable maintenance ops. Combined with where-filter for time-based partitioning, they're the only sane way to keep a high-ingest lake healthy.",
        misconceptionToWatchFor: "Trying to write a custom file-merging job. Possible, but you lose Iceberg's atomic snapshot semantics and risk leaving the table inconsistent.",
      }),
    },
    {
      stepNumber: 2,
      title: "expire_snapshots + remove_orphan_files",
      instructionMd:
        "Append to the same job: `CALL system.expire_snapshots(table => 'db.events', older_than => current_timestamp() - INTERVAL 7 DAYS, retain_last => 5)` then `CALL system.remove_orphan_files(table => 'db.events', older_than => current_timestamp() - INTERVAL 3 DAYS)`. Why both? expire_snapshots removes metadata pointers (allows physical cleanup); remove_orphan_files deletes files that aren't referenced (e.g. half-written aborts). Validator runs both procedures against a table with 10 snapshots + 5 orphan files and asserts post-state: ≤5 snapshots, 0 orphans.",
      learningObjective: "Combine snapshot expiry + orphan cleanup to bound storage cost without breaking time-travel.",
      requiredSkill: "Iceberg snapshot lifecycle + orphan-file detection + procedure ordering",
      starterCode: SRC(`# maintenance.py (append to compact.py)
# TODO:
# spark.sql("""
#   CALL lake.system.expire_snapshots(
#     table => 'db.events',
#     older_than => TIMESTAMP '...',  -- now - 7 days
#     retain_last => 5
#   )
# """)
# spark.sql("""
#   CALL lake.system.remove_orphan_files(
#     table => 'db.events',
#     older_than => TIMESTAMP '...'   -- now - 3 days; older threshold to avoid race with active writers
#   )
# """)
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "After expire_snapshots with older_than = now - 7 days and retain_last = 5, the table has ≤5 snapshots remaining",
          "After remove_orphan_files with older_than = now - 3 days, 0 orphan files remain in the table location",
          "expire_snapshots runs before remove_orphan_files (correct ordering)",
          "retain_last = 5 is set so at least 5 recent snapshots are preserved regardless of age",
        ],
      }),
      expectedOutputs: { snapshotsAfter: 5, orphansAfter: 0 },
      datasetRefs: ["fixtures/iceberg_with_orphans.snapshot"],
      pedagogy: pedagogyConfig({
        hints: [
          "retain_last is a SAFETY NET — always keep N most recent snapshots regardless of age. Recommend ≥5.",
          "remove_orphan_files needs a generous older_than (≥3 days) so in-flight writes aren't deleted as 'orphans'.",
          "Order matters: expire FIRST (so newly-orphaned files exist), then remove_orphan_files.",
          "Confirm in the Iceberg metadata.json: `snapshots` array length should equal retain_last (5).",
          "(see reference above)",
        ],
        successFeedback: "Storage cost capped + time-travel still works for the last 5 snapshots / 7 days.",
        failureFeedback: "Common slips: skipped retain_last (expired the only snapshot if all >7d → broken table); ran remove_orphan_files with older_than=now (deleted in-flight writes → corrupted commits).",
        portfolioRelevance: "Snapshot lifecycle is operational knowledge that separates 'Iceberg user' from 'Iceberg operator'. Senior cloud-DE roles expect this.",
        finalExplanation: "expire frees metadata pointers; remove_orphan deletes data files no metadata points to. Both are needed to actually reclaim S3 cost.",
        misconceptionToWatchFor: "Skipping orphan cleanup because 'expire handles it'. expire only handles SNAPSHOT metadata — it doesn't physically delete data files Iceberg doesn't know about.",
      }),
    },
    {
      stepNumber: 3,
      title: "Terraform EMR Serverless + Airflow DAG",
      instructionMd:
        "Provision an EMR Serverless application via Terraform (`aws_emrserverless_application` with type=Spark, release=emr-7.0.0). Write `dags/iceberg_maintenance.py` (Airflow ≥2.7) that runs daily at 03:00 UTC, submits the compaction job via `EmrServerlessStartJobOperator`, retries=2 with `retry_delay=timedelta(minutes=15)`, on_failure_callback notifies Slack. This is a learner attestation — Atlas does not grade this; verify it yourself against the criteria.",
      learningObjective: "Provision serverless Spark + schedule the maintenance pipeline with production-grade retry/alerting.",
      requiredSkill: "Terraform aws_emrserverless_application + Airflow EmrServerlessStartJobOperator",
      starterCode: SRC(`# infra/main.tf
resource "aws_emrserverless_application" "compact" {
  name          = "iceberg-compact"
  release_label = "emr-7.0.0"
  type          = "spark"
  initial_capacity {
    initial_capacity_type = "DRIVER"
    initial_capacity_config {
      worker_count = 1
      worker_configuration { cpu = "2 vCPU"; memory = "8 GB" }
    }
  }
  initial_capacity {
    initial_capacity_type = "EXECUTOR"
    initial_capacity_config {
      worker_count = 4
      worker_configuration { cpu = "4 vCPU"; memory = "16 GB" }
    }
  }
}

# dags/iceberg_maintenance.py
from airflow import DAG
from airflow.providers.amazon.aws.operators.emr import EmrServerlessStartJobOperator
from datetime import datetime, timedelta

with DAG("iceberg_maintenance", schedule="0 3 * * *",
         start_date=datetime(2026, 5, 1), catchup=False,
         default_args={"retries": 2, "retry_delay": timedelta(minutes=15)}) as dag:
    # TODO: compact = EmrServerlessStartJobOperator(
    #   task_id="compact", application_id="{{ var.value.emr_app_id }}",
    #   execution_role_arn="...", job_driver={"sparkSubmit": {"entryPoint":"s3://.../compact.py"}},
    #   on_failure_callback=slack_alert)
    pass
`),
      validationType: "self_attest",
      stepType: "multi_file",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "terraform validate passes with no errors on your infra/main.tf",
          "The Airflow DAG file parses without errors (DagBag reports 0 import errors)",
          "EmrServerlessStartJobOperator has retries=2 and on_failure_callback configured",
          "auto_suspend is omitted or inapplicable (EMR Serverless is event-driven, no idle clusters)",
        ],
      }),
      expectedOutputs: { tfValid: true, dagErrors: 0, retries: 2 },
      datasetRefs: ["fixtures/tf_plan_emr.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "EMR Serverless costs only when jobs run — perfect for daily maintenance vs. always-on clusters.",
          "Airflow on_failure_callback is the standard way to ping Slack. Define it once in plugins/ and import everywhere.",
          "Don't bake AWS credentials into the operator — use IRSA via execution_role_arn.",
          "EmrServerlessStartJobOperator(task_id='compact', application_id=app_id, execution_role_arn=role, job_driver={'sparkSubmit': {'entryPoint': 's3://bucket/compact.py'}}, on_failure_callback=slack_alert)",
          "(see reference above)",
        ],
        successFeedback: "Maintenance job now runs nightly with retries + Slack alerts. On-call doesn't need to babysit.",
        failureFeedback: "Common slips: hard-coded application_id (breaks across envs); set catchup=True (Airflow tries to backfill every missed run → expensive); no retries (transient EMR API errors fail the job permanently).",
        portfolioRelevance: "EMR Serverless + Airflow + Terraform is a senior cloud-DE stack. Recruiters see the combination and know you can ship infra, not just notebooks.",
        finalExplanation: "Daily maintenance jobs are the OPS layer of a data platform. Ship them with retries + alerts from day one or you'll be on-call every night.",
        misconceptionToWatchFor: "Running compaction in the same pipeline as ingest. They have different schedules + failure modes; keep them separate DAGs.",
      }),
    },
    {
      stepNumber: 4,
      title: "Athena benchmark — prove the speedup",
      instructionMd:
        "Write `benchmark.py` that issues 3 representative queries against `db.events` via Athena, before and after a manual compaction run. Capture `QueryExecution.Statistics.{DataScannedInBytes, EngineExecutionTimeInMillis}`. Validator asserts post-compact EngineExecutionTimeInMillis ≤ 25% of pre-compact (4x speedup target) for at least 2 of 3 queries.",
      learningObjective: "Quantify the impact of compaction with an Athena benchmark — turn 'felt faster' into a measurable artifact.",
      requiredSkill: "boto3 Athena start_query_execution + result polling + statistics extraction",
      starterCode: SRC(`# benchmark.py
import boto3, time

athena = boto3.client("athena")

QUERIES = [
    "SELECT count(*) FROM db.events WHERE event_date = DATE '2026-05-01'",
    "SELECT user_id, count(*) FROM db.events WHERE event_date = DATE '2026-05-01' GROUP BY user_id LIMIT 100",
    "SELECT * FROM db.events WHERE event_date = DATE '2026-05-01' AND user_id = 42",
]

def run_and_measure(q: str) -> dict:
    qid = athena.start_query_execution(
        QueryString=q,
        WorkGroup="primary",
        ResultConfiguration={"OutputLocation": "s3://lake-tmp/athena/"}
    )["QueryExecutionId"]
    while True:
        r = athena.get_query_execution(QueryExecutionId=qid)["QueryExecution"]
        if r["Status"]["State"] in ("SUCCEEDED", "FAILED", "CANCELLED"):
            break
        time.sleep(1)
    stats = r["Statistics"]
    # TODO: return {"ms": stats["EngineExecutionTimeInMillis"], "bytes": stats["DataScannedInBytes"]}
    raise NotImplementedError
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "run_and_measure returns a dict with 'ms' (EngineExecutionTimeInMillis) and 'bytes' (DataScannedInBytes) from Athena Statistics",
          "Post-compaction EngineExecutionTimeInMillis is ≤25% of pre-compaction for at least 2 of the 3 benchmark queries (4x speedup)",
          "ResultReuseConfiguration is disabled so cached results don't fake a speedup",
          "Benchmark results are recorded (printed or written to CSV) showing before/after ms and bytes scanned",
        ],
      }),
      expectedOutputs: { speedupQueries: 2, ratio: 0.25 },
      datasetRefs: ["fixtures/athena_benchmark_results.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Athena charges per byte scanned, so DataScannedInBytes is the cost proxy. EngineExecutionTimeInMillis is the latency proxy.",
          "Always run each query 3x and take the median — Athena cold cache vs warm cache distorts a single measurement.",
          "Set `ResultReuseConfiguration={'ResultReuseByAgeConfiguration': {'Enabled': False}}` so result caching doesn't fake a speedup.",
          "Run benchmark with --skip-cache flag; record results to a CSV; post the before/after table in the PR.",
          "(see reference above)",
        ],
        successFeedback: "Numbers in hand. The PR description writes itself.",
        failureFeedback: "Common slips: didn't disable result cache (post-compact runs are just cached results, not real speedup); benchmarked queries that don't even scan the compacted partition.",
        portfolioRelevance: "Quantified before/after is what separates 'I built a thing' from 'I shipped a measurable win'. Senior interviewers eat this up.",
        finalExplanation: "Benchmarking IS the deliverable for ops work. Without numbers, you're trusting vibes; with numbers, you have a PR-worthy artifact.",
        misconceptionToWatchFor: "Eyeballing the Athena console. Console-displayed times include UI overhead; the Statistics block is the truth.",
      }),
    },
    {
      stepNumber: 5,
      title: "OTel: file count + p99 query latency",
      instructionMd:
        "Emit two OTel metrics: (a) `iceberg.table.files` gauge — read from `db.events.files` metadata table after each compaction run; (b) `athena.query.duration_ms` histogram — record from benchmark.py for ongoing visibility. Wire to OTLP. Validator asserts both metrics are exported with expected dimensions {table, query_id}.",
      learningObjective: "Make compaction effectiveness visible long-term with structured metrics.",
      requiredSkill: "OTel histogram + gauge + Iceberg metadata tables",
      starterCode: SRC(`# metrics.py
from opentelemetry import metrics
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter

reader = PeriodicExportingMetricReader(OTLPMetricExporter(endpoint="otel-collector:4317"), 10_000)
metrics.set_meter_provider(MeterProvider(metric_readers=[reader]))
meter = metrics.get_meter("iceberg.ops")

duration_hist = meter.create_histogram("athena.query.duration_ms", unit="ms")

# TODO: meter.create_observable_gauge(
#   "iceberg.table.files",
#   callbacks=[lambda opts: [Observation(count_files("db.events"), {"table": "db.events"})]]
# )
# count_files reads spark.sql("SELECT count(*) FROM lake.db.events.files").collect()[0][0]
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "iceberg.table.files observable gauge emits a value ≤8 after compaction (read from lake.db.events.files metadata table)",
          "athena.query.duration_ms histogram has ≥3 recorded observations after the benchmark run",
          "Both metrics include the 'table' dimension attribute (e.g. {'table': 'db.events'})",
          "Metrics are exported via OTLPMetricExporter to the configured endpoint",
        ],
      }),
      expectedOutputs: { files: 8, histogramObs: 3 },
      datasetRefs: ["fixtures/otel_iceberg_dump.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Histograms aggregate distributions (p50/p95/p99 over time). Use for any latency measurement.",
          "Iceberg exposes a `.files` metadata table — query it with SELECT count(*) FROM lake.db.events.files.",
          "Observable gauges run their callback on each export — keep them cheap (cache the count if scrape interval ≥ compaction interval).",
          "duration_hist.record(ms, {'query_id': qid, 'table': 'db.events'}); meter.create_observable_gauge('iceberg.table.files', callbacks=[cb])",
          "(see reference above)",
        ],
        successFeedback: "Metrics shipped. Alert when iceberg.table.files > 1000 OR athena.query.duration_ms p99 > 30s.",
        failureFeedback: "Common slips: used a counter for file count (file count goes down after compaction — counters can't); didn't include the table label (multi-table deployments mush).",
        portfolioRelevance: "OTel histograms + Iceberg metadata queries is operational depth most candidates skip. The combination signals senior production experience.",
        finalExplanation: "Metrics over time turn 'I compacted once' into 'compaction keeps the lake healthy continuously'. That's the difference between a project and a platform.",
        misconceptionToWatchFor: "Skipping observability because 'the job works'. Without metrics you'll discover the job is broken the day Athena is slow again.",
      }),
    },
  ],
};
