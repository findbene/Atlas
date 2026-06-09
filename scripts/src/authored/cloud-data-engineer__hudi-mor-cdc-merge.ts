/**
 * Phase 7 — Wave 1b / cloud-data-engineer (advanced).
 * Candidate e9b594d1-fe69-4bd5-b7f6-6b53456c18a7 — Hudi MoR CDC Merge.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const cloudDataEngineerHudiMorCdcMerge: AuthoredProject = {
  slug: "cloud-data-engineer-hudi-mor-cdc-merge",
  candidateId: "e9b594d1-fe69-4bd5-b7f6-6b53456c18a7",
  title: "Hudi Merge-on-Read CDC Pipeline with Spark + Kafka",
  shortDescription:
    "Stream Postgres CDC events from Kafka into an Apache Hudi Merge-on-Read (MoR) table on S3, configure record-key + precombine semantics, schedule compaction, and provision the lake with Terraform. Validate row-level consistency vs. source.",
  fullDescription:
    "Copy-on-Write lakes are fine for batch but kill latency for high-update workloads. Hudi's Merge-on-Read keeps updates in row-format log files between scheduled base-file compactions — perfect for CDC. You'll wire a streaming pipeline: Kafka → Spark Structured Streaming → Hudi MoR with the right record-key + precombine config, schedule async compaction, provision the S3 + Glue catalog with Terraform, and validate against the source DB.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Hudi", "Spark", "Kafka", "Terraform", "observability"],
  tags: ["hudi", "spark", "kafka", "cdc", "terraform", "merge-on-read", "cloud-data-engineering"],
  learningObjectives: [
    "Configure Hudi MoR table options (record_key, precombine_field, partition_path) for CDC.",
    "Wire a Spark Structured Streaming job that reads Kafka and upserts into Hudi.",
    "Schedule async compaction to bound query latency without blocking writes.",
    "Provision S3 bucket + Glue catalog + IAM via Terraform.",
    "Validate row-level consistency between source Postgres and Hudi table.",
  ],
  estimatedMinutes: 220,
  xpReward: 700,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Retail platform has 200 writes/s on orders. The current CoW lake takes 45min per batch to rewrite Parquet files. Switch to Hudi MoR so query latency stays sub-second AND ingest stays fresh.",
    hiringRelevance2026:
      "Hudi (and Iceberg) are the 2026 cloud-DE lakehouse format defaults. MoR semantics + compaction tuning is a senior-IC interview topic at every modern data team.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (Kafka → Spark SS → Hudi MoR)",
      "Step 1 Hudi table config", "Step 2 Spark Structured Streaming upsert",
      "Step 3 async compaction scheduler", "Step 4 Terraform infra", "Step 5 reconcile vs source",
      "Validation", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with the Spark CDC→Hudi pipeline, Terraform module for S3+Glue+IAM, async compaction job, reconciliation script, and a Grafana dashboard showing read-latency vs. write-throughput.",
    portfolioRelevance:
      "Hudi MoR with proper precombine + async compaction is the senior signal for cloud-DE roles in 2026. Most candidates know 'lakehouse' as a buzzword; this proves operational knowledge.",
    repoUrl: "https://github.com/<your-handle>/hudi-mor-cdc",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Hudi MoR table options — record_key + precombine",
      instructionMd:
        "Configure the Hudi write options: `hoodie.table.type=MERGE_ON_READ`, `hoodie.datasource.write.recordkey.field=id`, `hoodie.datasource.write.precombine.field=updated_at`, `hoodie.datasource.write.partitionpath.field=event_date`, `hoodie.datasource.write.operation=upsert`. Why precombine? When two records with the same key arrive in one batch, Hudi keeps the one with the larger precombine value — guaranteeing 'last write wins' deterministically. Validator instantiates these options + asserts `hoodie.table.type=MERGE_ON_READ` and `precombine.field=updated_at`.",
      learningObjective: "Choose record-key + precombine + partition-path so Hudi upserts are deterministic.",
      requiredSkill: "Hudi datasource write options + CDC semantics",
      starterCode: SRC(`# hudi_options.py
def hudi_options(table_name: str) -> dict:
    return {
        "hoodie.table.name": table_name,
        "hoodie.table.type": "MERGE_ON_READ",
        "hoodie.datasource.write.recordkey.field": "id",
        "hoodie.datasource.write.precombine.field": "updated_at",
        "hoodie.datasource.write.partitionpath.field": "event_date",
        "hoodie.datasource.write.operation": "upsert",
        "hoodie.datasource.write.table.type": "MERGE_ON_READ",
        # Compaction managed externally — disable inline for streaming throughput.
        "hoodie.compact.inline": "false",
        "hoodie.compact.schedule.inline": "false",
        # TODO: add Glue sync options for hoodie.datasource.hive_sync.*
    }
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "hudi_options('orders') returns dict with type=MERGE_ON_READ, recordkey=id, precombine=updated_at.", {
        expectedTableType: "MERGE_ON_READ", expectedRecordKey: "id", expectedPrecombine: "updated_at",
      }),
      expectedOutputs: { tableType: "MERGE_ON_READ", recordKey: "id" },
      datasetRefs: ["fixtures/hudi_options_expected.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "MoR keeps updates in row-format log files; CoW rewrites Parquet on every update. For high write rate → MoR.",
          "precombine is the tiebreaker for same-key conflicts within a batch. Without it, ingest is non-deterministic.",
          "Use a monotonic field (LSN, updated_at, ts_ms) as precombine. Random strings break ordering.",
          "Add hoodie.datasource.hive_sync.{enable,mode,database,table,partition_extractor_class} so Glue catalog auto-updates.",
          "(see reference above)",
        ],
        successFeedback: "Hudi writer config is now CDC-safe and partition-aware.",
        failureFeedback: "Common slips: used a non-monotonic precombine (last write isn't last write); set inline compaction true on streaming writes (kills throughput).",
        portfolioRelevance: "Knowing the precombine concept verbally is the senior-IC differentiator in Hudi interviews. Most candidates can't explain it.",
        finalExplanation: "MoR + precombine = deterministic upserts at high write rates. The combination is what makes Hudi viable for CDC.",
        misconceptionToWatchFor: "Treating MoR as 'just CoW with extra steps'. They have totally different read/write tradeoffs.",
      }),
    },
    {
      stepNumber: 2,
      title: "Spark Structured Streaming → Hudi upsert",
      instructionMd:
        "Write the streaming job: read Kafka topic `orders-cdc`, parse the Debezium envelope, extract `after` (or `before` for deletes), call `df.writeStream.format('hudi').options(**hudi_options('orders')).option('checkpointLocation', 's3a://lake/_chk/orders/').trigger(processingTime='30 seconds').start()`. Handle DELETE: set `_hoodie_is_deleted=true` for op='d' rows. Validator runs the stream against a fixture of 5 INSERTs, 1 UPDATE, 1 DELETE and asserts the Hudi table contains the expected 4 rows.",
      learningObjective: "Wire a Structured Streaming Kafka→Hudi pipeline with proper DELETE handling.",
      requiredSkill: "Spark Structured Streaming + Hudi sink + soft-delete semantics",
      starterCode: SRC(`# stream.py
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, from_json, when, lit
from pyspark.sql.types import StructType, StringType, LongType
from hudi_options import hudi_options

spark = SparkSession.builder.appName("hudi-cdc").getOrCreate()

schema = StructType().add("op", StringType()).add("ts_ms", LongType())  # ... add after/before structs

raw = (spark.readStream.format("kafka")
       .option("kafka.bootstrap.servers", "kafka:9092")
       .option("subscribe", "orders-cdc")
       .load())

parsed = raw.select(from_json(col("value").cast("string"), schema).alias("e")).select("e.*")

# TODO: flatten after.{id,customer_id,total_cents,status,updated_at,event_date}
# TODO: add column _hoodie_is_deleted = (op == 'd')
# TODO: writeStream to Hudi with hudi_options('orders') + checkpointLocation
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "5 INSERTs + 1 UPDATE (id=2) + 1 DELETE (id=3) → final Hudi snapshot has 4 distinct ids with the updated values for id=2 and no id=3.", {
        expectedFinalIds: [1, 2, 4, 5], expectedUpdatedId: 2, expectedDeletedId: 3,
      }),
      expectedOutputs: { rows: 4, deleted: 1 },
      datasetRefs: ["fixtures/cdc_stream_batch.jsonl"],
      pedagogy: pedagogyConfig({
        hints: [
          "Debezium envelope: {op, ts_ms, before, after}. For DELETE, after is null — flatten from before.",
          "Soft delete in Hudi: set `_hoodie_is_deleted=true` (boolean column). Hudi compaction tombstones the row.",
          "checkpointLocation MUST be unique per stream. Reusing a checkpoint across pipelines silently breaks both.",
          "df.withColumn('_hoodie_is_deleted', col('op') == 'd').writeStream.format('hudi').options(**hudi_options('orders')).option('checkpointLocation', 's3a://lake/_chk/orders').outputMode('append').trigger(processingTime='30 seconds').start()",
          "(see reference above)",
        ],
        successFeedback: "Stream upserts ship. CDC events from Kafka now land in Hudi within 30s.",
        failureFeedback: "Common slips: forgot _hoodie_is_deleted for op='d' (deletes silently become updates that reinstate the row); used outputMode complete (Hudi sink doesn't support it).",
        portfolioRelevance: "Structured Streaming + Hudi sink + DELETE handling is a senior-IC depth signal. Few candidates know the soft-delete column convention.",
        finalExplanation: "The marriage of Spark SS + Hudi MoR is the 2026 lakehouse-CDC default. checkpoints + precombine + soft-deletes make it production-safe.",
        misconceptionToWatchFor: "Issuing physical deletes via partition filter. Possible, but races with concurrent writers and loses time-travel for the deleted row.",
      }),
    },
    {
      stepNumber: 3,
      title: "Async compaction scheduler",
      instructionMd:
        "Author `compaction.py` that runs on Airflow daily: triggers `hoodie.run.compaction.async=true` + executes `org.apache.hudi.utilities.HoodieCompactor`. Configure `hoodie.compact.inline.max.delta.commits=10` (compact after 10 delta commits accumulate). Validator runs the compactor against a fixture MoR table with 12 delta commits and asserts: 1 new base file per partition + delta log files are smaller after.",
      learningObjective: "Schedule async compaction to bound read latency without blocking ingest.",
      requiredSkill: "Hudi compaction config + Airflow Spark submit + delta-commit semantics",
      starterCode: SRC(`# compaction.py — run via spark-submit from Airflow
from pyspark.sql import SparkSession

spark = (SparkSession.builder.appName("hudi-compact")
         .config("spark.serializer", "org.apache.spark.serializer.KryoSerializer")
         .getOrCreate())

# TODO: kick off compaction by writing an empty Hudi upsert with these options:
# spark.createDataFrame([], schema).write.format("hudi").options(
#   "hoodie.compact.schedule.inline", "true",
#   "hoodie.compact.inline.max.delta.commits", "10",
#   ...hudi_options('orders'),
# ).mode("append").save("s3a://lake/orders/")
# Then run executor: HoodieCompactor.main(["--base-path", "s3a://lake/orders/", "--table-name","orders"])
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Fixture: 12 delta commits, 3 partitions. After compaction: 3 new base files, log files <= 10% of pre-compact size per partition.", {
        expectedBaseFiles: 3, expectedLogShrinkRatio: 0.1,
      }),
      expectedOutputs: { baseFiles: 3, shrinkRatio: 0.1 },
      datasetRefs: ["fixtures/hudi_pre_compaction.snapshot"],
      pedagogy: pedagogyConfig({
        hints: [
          "Async compaction = separate Spark job. Don't run inline on the streaming writer or you cap throughput.",
          "max.delta.commits=10 means 'when 10 delta commits accumulate, schedule compaction'. Tune based on read-latency SLA.",
          "Compaction reads delta logs + base file → writes new base. Old files are garbage-collected on next cleaner run.",
          "Run via Airflow: SparkSubmitOperator(task_id='compact', application='compaction.py', conf={'spark.serializer': 'org.apache.spark.serializer.KryoSerializer'})",
          "(see reference above)",
        ],
        successFeedback: "Async compaction keeps read latency bounded. Snapshot queries are fast; incremental queries remain available.",
        failureFeedback: "Common slips: ran compaction inline on the writer (write throughput tanks); didn't run the cleaner (storage cost grows unbounded).",
        portfolioRelevance: "Async compaction tuning is operational depth most candidates skip. Recruiters know this is the production-realism signal.",
        finalExplanation: "MoR's tradeoff: read latency vs. write throughput. Async compaction lets you tune both knobs independently.",
        misconceptionToWatchFor: "Assuming Hudi auto-compacts perfectly out of the box. Default thresholds are workload-dependent; tune them.",
      }),
    },
    {
      stepNumber: 4,
      title: "Terraform: S3 bucket + Glue catalog + IAM",
      instructionMd:
        "Author `infra/main.tf`: `aws_s3_bucket` (lifecycle to expire old log files), `aws_glue_catalog_database` for the Hudi tables, `aws_iam_role` + policy granting the EMR/Spark executor s3:GetObject/PutObject/DeleteObject on the bucket and glue:GetTable/UpdateTable. Submit your Terraform file; Atlas checks that the required evidence markers are present in your submission — not that the program otherwise runs correctly, and not your authorship or competence.",
      learningObjective: "Provision the lake foundations (S3 + Glue + IAM) reproducibly with Terraform.",
      requiredSkill: "Terraform aws_s3_bucket + aws_glue_catalog_database + IAM policy authoring",
      starterCode: SRC(`# infra/main.tf
resource "aws_s3_bucket" "lake" { bucket = "lake-hudi-cdc" }

resource "aws_s3_bucket_lifecycle_configuration" "lake" {
  bucket = aws_s3_bucket.lake.id
  rule {
    id     = "expire-old-log-files"
    status = "Enabled"
    filter { prefix = ".hoodie/" }
    expiration { days = 30 }
  }
}

resource "aws_glue_catalog_database" "lake" { name = "hudi_cdc" }

data "aws_iam_policy_document" "spark_exec" {
  statement {
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["\${aws_s3_bucket.lake.arn}/*"]
  }
  # TODO: add s3:ListBucket on the bucket arn and glue:GetTable/UpdateTable on the database.
}

resource "aws_iam_role" "spark_exec" {
  name = "hudi-spark-exec"
  assume_role_policy = data.aws_iam_policy_document.trust.json
}

# TODO: aws_iam_role_policy attaching spark_exec policy doc.
`),
      validationType: "contains",
      stepType: "multi_file",
      validation: validationConfig("contains", "Atlas checks that the required evidence markers are present in your submission — not that the program otherwise runs correctly, and not your authorship or competence.", {
        needles: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket", "glue:GetTable", "glue:UpdateTable"],
      }),
      expectedOutputs: { actions: 6, tfValid: true },
      datasetRefs: ["fixtures/tf_iam_policy.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "S3 lifecycle on .hoodie/ prefix expires obsolete metadata after Hudi's archive interval (default 30d).",
          "Glue catalog is the metastore; Spark + Athena + Trino all read from it.",
          "Principle of least privilege: explicit Action list, no wildcards. Recruiters notice.",
          "principals { type='Service'; identifiers=['emr-serverless.amazonaws.com'] } for the trust policy.",
          "(see reference above)",
        ],
        successFeedback: "Infra provisioned. The Spark job can now read/write S3 + register Glue tables without per-deployment hand-tweaks.",
        failureFeedback: "Common slips: used wildcard Resource='*' (security review fails); forgot lifecycle policy (metadata storage grows forever); missed s3:ListBucket (Hudi can't list partitions).",
        portfolioRelevance: "Terraform-provisioned lake infra with proper IAM is a recruiter green-flag. 'cloud-data-engineer' JDs explicitly require this.",
        finalExplanation: "Infra-as-code makes the lake portable. Anyone can clone the repo and `terraform apply` to get a working environment.",
        misconceptionToWatchFor: "Wiring infra by ClickOps in the AWS console. Won't reproduce; senior reviewers won't trust it.",
      }),
    },
    {
      stepNumber: 5,
      title: "Reconcile: Postgres source vs Hudi current snapshot",
      instructionMd:
        "Write `reconcile.py` that compares `SELECT count(*), sum(hashtext(status||total_cents)) FROM orders` from Postgres against `SELECT count(*), sum(...) FROM orders` from Hudi via Spark SQL (snapshot read). Raise `DriftAlert` on mismatch. Validator stubs both DBs with controlled data, runs reconciliation, asserts no alert when matched and alert when mismatched.",
      learningObjective: "Catch CDC drift via cross-engine row-count + checksum reconciliation.",
      requiredSkill: "Spark Hudi snapshot read + Postgres adapter + structured drift detection",
      starterCode: SRC(`# reconcile.py
from dataclasses import dataclass
import psycopg
from pyspark.sql import SparkSession
import hashlib

@dataclass(frozen=True)
class Snapshot:
    rows: int
    checksum: int

class DriftAlert(Exception): pass

def stable_hash_bigint(s: str) -> int:
    return int(hashlib.md5(s.encode()).hexdigest()[:15], 16)

def pg_snapshot(conn) -> Snapshot:
    with conn.cursor() as cur:
        cur.execute("SELECT id, status, total_cents FROM orders")
        rows = cur.fetchall()
        return Snapshot(rows=len(rows),
                        checksum=sum(stable_hash_bigint(f"{r[1]}|{r[2]}") for r in rows))

def hudi_snapshot(spark, path: str) -> Snapshot:
    df = spark.read.format("hudi").load(path).select("id", "status", "total_cents").collect()
    return Snapshot(rows=len(df), checksum=sum(stable_hash_bigint(f"{r.status}|{r.total_cents}") for r in df))

def reconcile(pg, spark, hudi_path) -> None:
    # TODO: a = pg_snapshot(pg); b = hudi_snapshot(spark, hudi_path)
    # if a != b: raise DriftAlert(f"pg={a} hudi={b}")
    raise NotImplementedError
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Matched: 100 rows w/ checksum X — no exception. Mismatched: hudi checksum X+1 — DriftAlert raised.", {
        matchedCase: { rows: 100 }, mismatchedCase: true,
      }),
      expectedOutputs: { matched: true, drifted: true },
      datasetRefs: ["fixtures/reconcile_snapshots.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Hudi snapshot read = current state. Don't reconcile against incremental reads (those are deltas).",
          "Use Python-side stable hash so PG and Hudi sums agree (engine-native hashes differ).",
          "Run reconciliation hourly or after every compaction — drift detected within the SLA window.",
          "if a != b: raise DriftAlert(f'pg={a} hudi={b}')",
          "(see reference above)",
        ],
        successFeedback: "Drift detection on. The lake is now trust-but-verify.",
        failureFeedback: "Common slips: forgot to read snapshot mode on Hudi (read incremental → got delta only); didn't handle empty result (sum() of empty seq raises).",
        portfolioRelevance: "Cross-engine reconciliation is the senior-IC pattern that separates 'I built a pipeline' from 'I run a platform'.",
        finalExplanation: "MoR + async compaction = lots of moving parts. Reconciliation is the ground truth that proves the system is working.",
        misconceptionToWatchFor: "Skipping reconciliation because 'the pipeline tests pass'. Tests prove code; reconciliation proves DATA.",
      }),
    },
  ],
};
