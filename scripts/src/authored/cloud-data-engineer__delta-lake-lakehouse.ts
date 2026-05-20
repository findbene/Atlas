/**
 * Phase 11 batch-3 / cloud-data-engineer (skeleton rebuild).
 * Candidate d8c9e3a4-7f56-4b00-9234-3c4d5e6f7081 — Delta Lake Lakehouse with
 * Terraform IaC + ACID transactions + time travel + Z-order optimization.
 *
 * Legacy: `delta-lake-lakehouse` (1-step skeleton, score 51.8). Full rebuild.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const cloudDataEngineerDeltaLakeLakehouse: AuthoredProject = {
  slug: "cloud-data-engineer-delta-lake-lakehouse",
  candidateId: "d8c9e3a4-7f56-4b00-9234-3c4d5e6f7081",
  title: "Delta Lake Lakehouse — Terraform IaC + ACID + Time Travel + Z-Order",
  shortDescription:
    "Stand up a Delta Lake lakehouse on S3/MinIO with Terraform: ACID-safe concurrent MERGE writes, time-travel queries via VERSION AS OF, Z-order optimization for selective filters, and Unity-Catalog-equivalent table governance via Delta Sharing protocol.",
  fullDescription:
    "Lakehouse promises (ACID, time-travel, schema evolution) only hold if the table format is treated seriously. You'll provision a real S3-backed Delta table with Terraform (no notebook drift), drive concurrent MERGE INTO writes through deltalake-rs, prove ACID with conflicting writers, query historical snapshots, and run OPTIMIZE + ZORDER to cut selective-scan cost by 8x. Cloud realism, not Databricks-magic.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "delta-lake", "terraform", "S3", "MinIO", "polars", "iceberg"],
  tags: ["delta-lake", "lakehouse", "terraform", "acid", "time-travel", "z-order", "cloud"],
  learningObjectives: [
    "Provision S3 + Delta table location via Terraform with versioning + lifecycle.",
    "Perform ACID-safe concurrent MERGE INTO writes and observe conflict semantics.",
    "Query historical snapshots via VERSION AS OF + TIMESTAMP AS OF.",
    "Run OPTIMIZE + ZORDER to compact small files and accelerate predicate-pushdown scans.",
    "Expose tables via Delta Sharing protocol for cross-account read access.",
  ],
  estimatedMinutes: 240,
  xpReward: 760,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Cloud DE at a 90-person ad-tech firm migrating off a Snowflake-only stack. Goal: keep BI on Snowflake, move ML training data to Delta on S3 to cut $40k/mo compute. Your job: prove the lakehouse handles concurrent ETL + ML workloads with ACID guarantees + time-travel debugging.",
    hiringRelevance2026:
      "Cloud DE roles in 2026 expect Terraform-provisioned lakehouse, not point-and-click. Delta + Iceberg is the table-format war; pick one + own it end-to-end.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (Terraform / S3 / Delta / Sharing)",
      "Step 1 Terraform provisioning", "Step 2 concurrent MERGE", "Step 3 time travel",
      "Step 4 OPTIMIZE + ZORDER", "Step 5 Delta Sharing", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with the Terraform module (S3 bucket + IAM + lifecycle), Python scripts demonstrating concurrent MERGE + ACID conflict, a notebook showing time-travel diffing, a benchmark proving 8x Z-order speedup on a 50M-row table, and a docker-compose smoke-test using MinIO so reviewers can run it without an AWS account.",
    portfolioRelevance:
      "A lakehouse repo with Terraform + reproducible local run is a senior cloud-DE signal. Most repos handwave provisioning.",
    repoUrl: "https://github.com/<your-handle>/delta-lakehouse",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Terraform-provision S3 + IAM for Delta",
      instructionMd:
        "Write `main.tf` provisioning: an S3 bucket with versioning enabled + a 30-day non-current-version lifecycle rule + a `delta/` prefix block-public-access policy + an IAM role with `s3:GetObject/PutObject/DeleteObject/ListBucket` scoped to `arn:aws:s3:::<bucket>/delta/*`. Validator runs `terraform plan -out=tfplan` against a fixture state and asserts the plan contains: 1 `aws_s3_bucket` with `versioning=Enabled`, 1 `aws_s3_bucket_lifecycle_configuration` with 30-day expiry, 1 `aws_iam_role` with the correct policy.",
      learningObjective: "Lakehouse storage MUST be versioned + lifecycle-managed; Delta's logs accumulate fast.",
      requiredSkill: "Terraform AWS provider + S3 versioning + IAM least-privilege",
      starterCode: SRC(`# main.tf
terraform { required_providers { aws = { source = "hashicorp/aws", version = "~> 5.0" } } }
provider "aws" { region = "us-east-1" }

variable "bucket_name" { type = string }

resource "aws_s3_bucket" "lakehouse" {
  bucket = var.bucket_name
}

resource "aws_s3_bucket_versioning" "lakehouse" {
  bucket = aws_s3_bucket.lakehouse.id
  versioning_configuration { status = "Enabled" }
}

# TODO: aws_s3_bucket_lifecycle_configuration — 30-day expiry on noncurrent_version
# TODO: aws_s3_bucket_public_access_block — block_public_acls + restrict_public_buckets
# TODO: aws_iam_role + aws_iam_role_policy scoped to s3://\${bucket}/delta/*
`),
      validationType: "contains",
      stepType: "multi_file",
      validation: validationConfig("contains", "terraform plan output mentions: aws_s3_bucket, versioning Enabled, aws_s3_bucket_lifecycle_configuration with 30, aws_iam_role with s3:GetObject + s3:PutObject + s3:DeleteObject + s3:ListBucket.", {
        expected: ["aws_s3_bucket", "Enabled", "aws_s3_bucket_lifecycle_configuration", "30", "aws_iam_role", "s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
      }),
      expectedOutputs: { bucketCount: 1, lifecycleDays: 30, iamRoles: 1 },
      datasetRefs: ["fixtures/terraform_state.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Versioning is non-negotiable for Delta — recovery from accidental MERGE depends on object versions.",
          "Lifecycle on noncurrent_version, NOT current — current versions are the live log.",
          "Block-public-access at the bucket level, not just per-prefix — Delta config files leak schema otherwise.",
          "Scope IAM to the table prefix only; broad bucket access defeats per-table security.",
          "lifecycle { rule { id = 'expire-noncurrent', noncurrent_version_expiration { noncurrent_days = 30 } } }",
        ],
        successFeedback: "Storage is now versioned, lifecycle-managed, and least-privilege. Lakehouse-ready foundation.",
        failureFeedback: "Common slips: versioning off (delta log compaction is one-way); lifecycle on current (deletes live data); broad IAM (security audit fails).",
        portfolioRelevance: "Terraform-provisioned lakehouse storage is a 2026 cloud-DE table-stakes skill. Show it.",
        finalExplanation: "Cloud DE = infrastructure-as-code. Console-clicking your way to a lakehouse fails every audit.",
        misconceptionToWatchFor: "Treating Delta as 'just files'. The transaction log requires the storage layer to behave predictably.",
      }),
    },
    {
      stepNumber: 2,
      title: "Concurrent MERGE INTO with ACID conflict semantics",
      instructionMd:
        "Use `deltalake` (deltalake-rs Python binding) to run two concurrent MERGE writers against the same Delta table on MinIO. Writer A merges 1k rows targeting `partition='2026-05-20'`; writer B merges 1k rows targeting `partition='2026-05-21'`. Validator asserts: both commits succeed (non-overlapping partitions), table version increases by 2, total row count = 2k. Then run a third writer also targeting `2026-05-20` concurrently with A — validator asserts ONE of them raises `CommitFailedError` (write-write conflict on same partition).",
      learningObjective: "Delta's ACID is partition-aware — non-overlapping writes commit concurrently, overlapping ones conflict.",
      requiredSkill: "deltalake-rs Python + concurrent writers + conflict handling",
      starterCode: SRC(`# concurrent_merge.py
from deltalake import DeltaTable, write_deltalake
from deltalake.exceptions import CommitFailedError
import polars as pl, asyncio

STORAGE_OPTIONS = {
    'AWS_ENDPOINT_URL': 'http://localhost:9000',
    'AWS_ACCESS_KEY_ID': 'minioadmin',
    'AWS_SECRET_ACCESS_KEY': 'minioadmin',
    'AWS_REGION': 'us-east-1',
    'AWS_ALLOW_HTTP': 'true',
}
TABLE_URI = 's3://lakehouse/delta/events'

def merge_partition(date_str: str, n_rows: int) -> None:
    dt = DeltaTable(TABLE_URI, storage_options=STORAGE_OPTIONS)
    new = pl.DataFrame({
        'event_id': [f'{date_str}-{i}' for i in range(n_rows)],
        'partition': [date_str] * n_rows,
        'payload': ['x'] * n_rows,
    })
    # TODO: dt.merge(source=new.to_arrow(), predicate="target.event_id = source.event_id", source_alias='source', target_alias='target').when_not_matched_insert_all().execute()

async def main():
    await asyncio.gather(
        asyncio.to_thread(merge_partition, '2026-05-20', 1000),
        asyncio.to_thread(merge_partition, '2026-05-21', 1000),
    )
    final = DeltaTable(TABLE_URI, storage_options=STORAGE_OPTIONS)
    print(f"version={final.version()}  rows={final.to_pyarrow_dataset().count_rows()}")
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Non-overlapping MERGE concurrent writers: both succeed, version increases by 2, row count = 2000. Overlapping writers: one raises CommitFailedError.", {
        expected: { nonOverlappingBothSucceeded: true, versionDelta: 2, totalRows: 2000, overlappingConflict: true },
      }),
      expectedOutputs: { versionDelta: 2, rows: 2000, conflict: true },
      datasetRefs: ["fixtures/merge_seed.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Delta uses optimistic concurrency — writers read the version, then commit; conflicts are detected at commit time.",
          "Non-overlapping partitions never conflict — partition aware engines parallelize easily.",
          "ALWAYS catch CommitFailedError + retry with refreshed snapshot — that's the contract.",
          "Use `MERGE INTO` for upserts; `write_deltalake(mode='append')` for fact tables.",
          "dt.merge(source=new.to_arrow(), predicate='t.event_id = s.event_id', source_alias='s', target_alias='t').when_not_matched_insert_all().execute()",
        ],
        successFeedback: "Concurrent ETL works without data races. Lakehouse promise honored.",
        failureFeedback: "Common slips: not catching CommitFailedError (writer dies on conflict); MERGE on full table without predicate (table-wide lock); ignoring partition column in MERGE (no partition pruning).",
        portfolioRelevance: "Demonstrating ACID under concurrent writers is the demo that separates 'wrote a Delta hello-world' from 'understands the format'.",
        finalExplanation: "Optimistic concurrency + partition isolation is why lakehouses can replace warehouses for many workloads.",
        misconceptionToWatchFor: "Assuming Delta is pessimistic-locking like a DBMS. It's optimistic — writers must handle conflicts.",
      }),
    },
    {
      stepNumber: 3,
      title: "Time-travel queries — VERSION AS OF + TIMESTAMP AS OF",
      instructionMd:
        "After writing 5 commits (v0→v4) to a 100-row table, implement `read_at_version(v)` and `read_at_timestamp(ts)`. Validator asserts: read at v=0 returns 0 rows (initial empty); v=2 returns 50 rows; v=4 returns 100 rows; read_at_timestamp at the second-commit timestamp returns 50 rows.",
      learningObjective: "Time travel is the lakehouse's killer-feature for debugging + reproducibility.",
      requiredSkill: "Delta version pinning + timestamp lookup + commit-history navigation",
      starterCode: SRC(`# time_travel.py
from deltalake import DeltaTable
import polars as pl
from datetime import datetime

STORAGE_OPTIONS = {'AWS_ALLOW_HTTP': 'true'}  # filled in by env in real run

def read_at_version(table_uri: str, version: int) -> pl.DataFrame:
    # TODO: DeltaTable(uri, version=version) + .to_pyarrow_dataset() + polars
    dt = DeltaTable(table_uri, version=version, storage_options=STORAGE_OPTIONS)
    return pl.from_arrow(dt.to_pyarrow_table())

def read_at_timestamp(table_uri: str, ts: datetime) -> pl.DataFrame:
    # TODO: DeltaTable(uri).load_with_datetime(ts) then to_pyarrow_table -> polars
    dt = DeltaTable(table_uri, storage_options=STORAGE_OPTIONS)
    dt.load_with_datetime(ts.isoformat())
    return pl.from_arrow(dt.to_pyarrow_table())

def history(table_uri: str) -> list[dict]:
    return DeltaTable(table_uri, storage_options=STORAGE_OPTIONS).history()
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "100-row table with 5 commits (25 rows each from v1..v4): row count at v=0 is 0, v=2 is 50, v=4 is 100. Timestamp lookup at v2 ts returns 50 rows.", {
        expected: { v0Rows: 0, v2Rows: 50, v4Rows: 100, tsAtV2Rows: 50 },
      }),
      expectedOutputs: { v0: 0, v2: 50, v4: 100 },
      datasetRefs: ["fixtures/history.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "VERSION AS OF reads from the transaction log — no data movement, sub-second query plan.",
          "TIMESTAMP AS OF resolves to the latest commit whose `timestamp` <= input — strict ≤, not <.",
          "After OPTIMIZE compacts files, time-travel still works because the log preserves removed-file refs.",
          "Beyond RETENTION (default 7d), VACUUM may delete the underlying files — time travel breaks silently.",
          "DeltaTable(uri, version=v).to_pyarrow_table()",
        ],
        successFeedback: "Reproducible reads-as-of-yesterday are now one line of code.",
        failureFeedback: "Common slips: time travel after VACUUM (files gone); using version on a vacuumed table (silent stale read); confusing wall-clock vs commit timestamps.",
        portfolioRelevance: "Time-travel debugging is the most-asked lakehouse interview question. Show it cold.",
        finalExplanation: "Time travel = audit log + reproducibility + 'undo'. Three problems, one feature.",
        misconceptionToWatchFor: "Treating time travel as a backup. VACUUM destroys old files; backups are still your responsibility.",
      }),
    },
    {
      stepNumber: 4,
      title: "OPTIMIZE + ZORDER for selective filters",
      instructionMd:
        "On a Delta table with 50M rows written as 5000 small files (~10k rows each), run `dt.optimize.z_order(['user_id'])` and benchmark a filtered scan `WHERE user_id = 'u_42'`. Validator asserts: file count after OPTIMIZE ≤ 50 (compacted); query latency after OPTIMIZE+ZORDER is ≥8x faster than pre-OPTIMIZE; data file pruning skips ≥95% of files.",
      learningObjective: "Small-file problem + non-clustered layout are the two biggest lakehouse perf killers; OPTIMIZE + ZORDER fix both.",
      requiredSkill: "Delta OPTIMIZE + Z-order layout + predicate pushdown + file pruning",
      starterCode: SRC(`# optimize.py
from deltalake import DeltaTable
import time, polars as pl

STORAGE_OPTIONS = {'AWS_ALLOW_HTTP': 'true'}
TABLE_URI = 's3://lakehouse/delta/events'

def benchmark_filter(uri: str, user_id: str) -> tuple[float, int]:
    dt = DeltaTable(uri, storage_options=STORAGE_OPTIONS)
    start = time.perf_counter()
    df = pl.scan_pyarrow_dataset(dt.to_pyarrow_dataset()).filter(pl.col('user_id') == user_id).collect()
    return time.perf_counter() - start, len(df)

def run_optimize_zorder(uri: str) -> dict:
    dt = DeltaTable(uri, storage_options=STORAGE_OPTIONS)
    # TODO: dt.optimize.compact() then dt.optimize.z_order(['user_id'])
    files_before = len(dt.files())
    return {'files_before': files_before, 'files_after': 0}
`),
      validationType: "numeric_tolerance",
      stepType: "code_python",
      validation: validationConfig("numeric_tolerance", "50M row / 5000 file table: post-OPTIMIZE file count ≤50; filter `user_id='u_42'` latency improves ≥8x vs pre-OPTIMIZE. Tolerance ±10% on speedup.", {
        expected: { speedup: 8.0, filesAfter: 50 },
        tolerance: 0.8,
      }),
      expectedOutputs: { speedup: 8.0, filesAfter: 50 },
      datasetRefs: ["fixtures/optimize_bench.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Small files = metadata-heavy reads. OPTIMIZE compacts 5000 files into ~50 of ~1GB each.",
          "Z-ORDER co-locates rows by the chosen column, so filters can prune most files at planning time.",
          "Pick Z-ORDER columns by query pattern, not write pattern — index for reads.",
          "Run OPTIMIZE off-hours; it rewrites data, which costs IOPS.",
          "dt.optimize.compact(); dt.optimize.z_order(['user_id'])",
        ],
        successFeedback: "Selective queries are now sub-second. Lakehouse perf is competitive with warehouses.",
        failureFeedback: "Common slips: ZORDER on too many columns (no pruning benefit); OPTIMIZE without ZORDER (compaction only, no clustering); ZORDER on monotonic column (already sorted, no benefit).",
        portfolioRelevance: "Showing measured 8x speedup is concrete evidence of senior-level perf intuition.",
        finalExplanation: "The lakehouse story only holds when you accept the maintenance cost (OPTIMIZE, VACUUM, ZORDER). Skipping = degraded perf forever.",
        misconceptionToWatchFor: "Expecting Delta to auto-optimize. It doesn't (yet) — you must schedule it.",
      }),
    },
    {
      stepNumber: 5,
      title: "Delta Sharing — cross-account read access",
      instructionMd:
        "Stand up a Delta Sharing server (`delta-sharing-server`) backed by your Delta table; create a share + schema + table; generate a profile-file token. Validator uses `delta_sharing.load_as_pandas(profile_path + '#share.schema.table')` to read the table from a second 'account' (process) and asserts: read works, row count matches, and revoking the share blocks subsequent reads.",
      learningObjective: "Delta Sharing is the open protocol for cross-account access without copying data.",
      requiredSkill: "delta-sharing protocol + share/schema/table model + token-based revocation",
      starterCode: SRC(`# sharing_server.yaml + share.py
# share.yaml — passed to delta-sharing-server
# version: 1
# shares:
#   - name: lakehouse_share
#     schemas:
#       - name: events
#         tables:
#           - name: events_table
#             location: s3://lakehouse/delta/events
#             id: 1

# share.py
import delta_sharing

PROFILE = '/tmp/sharing_profile.json'  # written by delta-sharing-server CLI

def read_shared(table_url: str):
    # table_url like 'profile#share.schema.table'
    return delta_sharing.load_as_pandas(table_url)

def list_shares():
    client = delta_sharing.SharingClient(PROFILE)
    return [(s.name, t.name) for s in client.list_shares() for sc in client.list_schemas(s) for t in client.list_tables(sc)]
`),
      validationType: "json_equal",
      stepType: "multi_file",
      validation: validationConfig("json_equal", "Server up + profile generated: load_as_pandas returns same row count as direct read; after revoke (remove from share.yaml + reload), same call raises a 403/'forbidden' error.", {
        expected: { sharedReadOk: true, rowCountMatches: true, postRevokeForbidden: true },
      }),
      expectedOutputs: { sharedReadOk: true, postRevokeForbidden: true },
      datasetRefs: ["fixtures/share.yaml"],
      pedagogy: pedagogyConfig({
        hints: [
          "Delta Sharing = pre-signed URL per file. Recipient never gets AWS creds — they get signed URLs that expire.",
          "The `id` field in share.yaml is the stable identifier; the table location can move without breaking shares.",
          "Token rotation = regenerate profile-file. Old tokens stop working at TTL.",
          "Revocation is config-driven: remove from share.yaml + reload the server.",
          "client = delta_sharing.SharingClient(profile); for share in client.list_shares(): ...",
        ],
        successFeedback: "Cross-account read works without copying data. Vendors + partners can read with provider-issued tokens.",
        failureFeedback: "Common slips: shared the AWS creds instead of the profile (defeats the protocol); no TTL (tokens leak forever); revocation requires server restart (config-reload should suffice).",
        portfolioRelevance: "Delta Sharing in a portfolio repo is rare and impressive — open-protocol data sharing is the 2026 cloud-DE differentiator.",
        finalExplanation: "Lakehouse data is most valuable when shareable. The protocol matters more than the vendor.",
        misconceptionToWatchFor: "Treating Delta Sharing as Databricks-only. The open-source server runs anywhere.",
      }),
    },
  ],
};
