/**
 * Phase 12B — data-engineering (skeleton rebuild).
 * Candidate e5364fb1-46cd-4277-9aab-a3142536475b — Production PySpark batch
 * processing: partitioned reads, skew handling via salting, Adaptive Query
 * Execution (AQE), optimal output file sizing, Spark UI gates.
 *
 * Legacy: `spark-batch-processing` (1-step skeleton, score 43.8). Full rebuild.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const dataEngineeringSparkBatchProcessing: AuthoredProject = {
  slug: "data-engineering-spark-batch-processing",
  candidateId: "e5364fb1-46cd-4277-9aab-a3142536475b",
  title: "PySpark Batch — Skew, AQE, Optimal File Sizes, UI-Gated CI",
  shortDescription:
    "Build a production PySpark batch job that reads partitioned Parquet with predicate pushdown, handles 1000x-skewed joins with salting + broadcast hints, leverages Adaptive Query Execution, writes 128MB output files, and gates CI on Spark-UI shuffle metrics.",
  fullDescription:
    "Most PySpark jobs work on the 1GB dev sample and explode on the 1TB prod data. You'll write a job that respects partition pruning, recognizes and fixes the inevitable 1000:1 join skew with salting, turns on AQE for the rest, writes output files that aren't 50,000 tiny files or 1 giant 30GB file, and ships with a Spark-UI gate in CI that fails the build if shuffle bytes regress > 20%. The final job is fast, predictable, and reviewable.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "pyspark", "parquet", "spark-sql", "delta-lake", "AQE"],
  tags: ["pyspark", "spark", "skew", "aqe", "partitioning", "shuffle", "file-sizing"],
  learningObjectives: [
    "Read partitioned Parquet with predicate + projection pushdown (only what you need).",
    "Diagnose join skew via the Spark UI and fix with salting + broadcast hints.",
    "Configure AQE (skew, coalesce-shuffle, dynamic-join-switch) and prove the wins.",
    "Write output with `maxRecordsPerFile` + `coalesce` to land on ~128MB files.",
    "Gate CI on Spark-UI shuffle bytes + spill bytes so regressions can't merge.",
  ],
  estimatedMinutes: 230,
  xpReward: 740,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "DE at a 60-person mid-stage SaaS. Nightly aggregation job hit 4 hours runtime last week (was 45 min two months ago) and the Spark UI shows one executor at 90% CPU + the other 49 idle. You're rebuilding the pipeline to actually use the cluster and ship a CI gate so this regression can't recur.",
    hiringRelevance2026:
      "PySpark skew + AQE + output file sizing are the most-asked production-Spark interview topics. Senior DE candidates are expected to read the Spark UI like a debugger.",
    readmeOutline: [
      "Overview & Slow-Job Postmortem", "Architecture (read → join → write)",
      "Step 1 partitioned read", "Step 2 skew + salt + broadcast", "Step 3 AQE",
      "Step 4 output file sizing", "Step 5 CI shuffle-bytes gate", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo: PySpark job + before/after Spark-UI screenshots showing the 1000:1 skew → balanced post-salt, a CI workflow that reads `metrics.json` from the job run and fails on shuffle-bytes regression > 20%, and a local docker-compose with Spark + 10GB fixture data.",
    portfolioRelevance:
      "A repo with before/after Spark-UI evidence + a CI shuffle-budget gate is a senior-DE differentiator. Most candidates can't read the UI; you can prove you can.",
    repoUrl: "https://github.com/<your-handle>/spark-batch-processing",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Partitioned Parquet read — predicate + projection pushdown",
      instructionMd:
        "Read `s3://events/year=2026/month=*/day=*/*.parquet` for a single month (`2026-05`), selecting only `(user_id, event_type, amount, event_date)` from a 20-column source. Self-check: run read_may_2026 against the fixture and call assert_pushdown — confirm partitionFiltersFired=True (Spark plan shows `PartitionFilters [year=2026, month=5]`), readSchemaColumns has exactly 4 columns, and the bytes-scanned metric is ≤10% of the full-corpus size.",
      learningObjective: "Partition pruning + column projection are free wins — the planner does them only if you write the filter the right way.",
      requiredSkill: "Spark partitioned-read semantics + when pushdown fires + reading the physical plan",
      starterCode: SRC(`# read.py
from pyspark.sql import SparkSession
from pyspark.sql import functions as F

def read_may_2026(spark: SparkSession, base_path: str):
    # TODO: filters MUST reference partition columns by name; using F.col on
    # nested expressions can defeat partition pruning.
    df = (
        spark.read
             .parquet(base_path)
             .where((F.col("year") == 2026) & (F.col("month") == 5))
             .select("user_id", "event_type", "amount", "event_date")
    )
    return df

def assert_pushdown(df) -> dict:
    plan = df._jdf.queryExecution().toString()
    return {
        "partitionFiltersFired": "PartitionFilters: [year#" in plan and "month#" in plan,
        "readSchemaColumns": [f.name for f in df.schema.fields],
    }
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Run read_may_2026 against the fixture and call assert_pushdown. Confirm partitionFiltersFired=True, readSchemaColumns has exactly 4 columns (user_id, event_type, amount, event_date), and the bytes-scanned metric from the Spark UI is ≤10% of the full-corpus size. Show df.explain('formatted') output containing PartitionFilters and ReadSchema lines.",
      }),
      expectedOutputs: { partitionFiltersFired: true, columns: 4 },
      datasetRefs: ["fixtures/partitioned_events.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Partition columns MUST appear in the .where() — Spark cannot prune what it doesn't see.",
          "Use `.select(...)` BEFORE expensive transforms — Parquet reads only the projected columns.",
          "Verify with `df.explain('formatted')` — look for `PartitionFilters:` and `ReadSchema:` lines.",
          "Filters on derived columns (cast, expr) can defeat pushdown — keep them on raw partition cols.",
          ".where((F.col('year') == 2026) & (F.col('month') == 5)).select('user_id', ...)",
        ],
        successFeedback: "Read now scans 5% of the bytes. The rest of the pipeline runs on a real-size dataset, not the full corpus.",
        failureFeedback: "Common slips: cast in the filter (no pushdown); select after expensive transforms (full-row read); filtering on a non-partition column (full-scan).",
        portfolioRelevance: "Demonstrating pushdown via `explain()` output is a senior-DE habit. Show before/after bytes-scanned.",
        finalExplanation: "Partition pruning + projection pushdown are the cheapest wins in Spark. If they're not firing, the rest doesn't matter.",
        misconceptionToWatchFor: "Trusting the dev-data runtime. Pushdown bugs hide until prod data is 100x larger.",
      }),
    },
    {
      stepNumber: 2,
      title: "Skew handling — diagnose, salt, broadcast",
      instructionMd:
        "Join `events` (1B rows) with `users` (10M rows) where 0.1% of user_ids account for 90% of events (the 'whales'). Step 2a: profile with `events.groupBy('user_id').count().orderBy(F.desc('count')).show(20)` — confirm top-20 skew. Step 2b: salt the skewed keys by adding a random suffix (`user_id || '_' || (rand()*N).cast('int')`) on the events side, and explode the matching rows N times on the users side. Step 2c: add `broadcast(small_dim)` hint where applicable. Self-check: run salt_skewed_join against the fixture with engineered skew — verify in the Spark UI that the slowest task is under 1.5× the median task duration (vs ~50× before salting), and confirm the salted join row-count matches the naive join row-count exactly.",
      learningObjective: "Skew is the #1 cause of slow Spark jobs. Salting + broadcast are the two main tools.",
      requiredSkill: "Skew diagnosis from Spark UI + salting strategy + broadcast-join hints + result-equivalence proof",
      starterCode: SRC(`# skew.py
from pyspark.sql import functions as F, DataFrame
from pyspark.sql.functions import broadcast

SKEW_FACTOR = 100  # split each skewed key into 100 partitions

def salt_skewed_join(events: DataFrame, users: DataFrame, skewed_keys: list[str]) -> DataFrame:
    # Tag events: hot keys get a random salt; cold keys get salt=0.
    salted_events = events.withColumn(
        "salt",
        F.when(F.col("user_id").isin(skewed_keys),
               (F.rand() * SKEW_FACTOR).cast("int"))
         .otherwise(F.lit(0)),
    ).withColumn("join_key", F.concat_ws("_", F.col("user_id"), F.col("salt")))

    # Users: explode hot rows SKEW_FACTOR times so every salted event finds a match.
    salts = F.array([F.lit(i) for i in range(SKEW_FACTOR)])
    exploded_users = users.withColumn(
        "salt",
        F.when(F.col("user_id").isin(skewed_keys), F.explode(salts)).otherwise(F.lit(0)),
    ).withColumn("join_key", F.concat_ws("_", F.col("user_id"), F.col("salt")))

    # TODO: broadcast the exploded_users only if it's still small enough.
    # With SKEW_FACTOR=100 and 10M base, exploded ≈ 10M + (whales * 100) — usually
    # still under the broadcast threshold (default 10MB; can raise to ~256MB).
    return salted_events.join(broadcast(exploded_users), on="join_key", how="inner")
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Run salt_skewed_join against the fixture and verify in the Spark UI that the slowest task is under 1.5× the median task duration (vs ~50× before salting). Confirm the salted join row-count matches the naive join row-count exactly. Confirm the query plan shows a BroadcastHashJoin node.",
      }),
      expectedOutputs: { slowestRatio: 1.4, rowsMatch: true },
      datasetRefs: ["fixtures/skewed_join.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Diagnose first: `df.groupBy(key).count().orderBy(desc('count')).show(20)` — top 20 skewed keys.",
          "Salt = randomly split hot keys into N sub-keys; explode the dim side N times to match.",
          "Broadcast the small side when it fits — eliminates shuffle entirely for that join.",
          "Always row-count-check post-salt vs pre-salt — salting bugs silently produce wrong joins.",
          "F.when(col.isin(skewed_keys), (F.rand() * N).cast('int')).otherwise(F.lit(0))",
        ],
        successFeedback: "Skew is now spread across N partitions. The slow executor is no longer slow.",
        failureFeedback: "Common slips: salting only one side (cartesian explosion); broadcast on too-large dim (driver OOM); no row-count check (silent wrong join).",
        portfolioRelevance: "Before/after Spark UI screenshots of the slow-executor → balanced is a powerful artifact. Show it.",
        finalExplanation: "Salting + broadcast are the two tools for skew. Master diagnosing skew first; the fixes are mechanical.",
        misconceptionToWatchFor: "Trying to fix skew with `repartition` alone. Repartition reshuffles randomly; skew survives unless you salt the join key.",
      }),
    },
    {
      stepNumber: 3,
      title: "Adaptive Query Execution — skew, coalesce, dynamic join switch",
      instructionMd:
        "Enable AQE with `spark.sql.adaptive.enabled=true` + `spark.sql.adaptive.skewJoin.enabled=true` + `spark.sql.adaptive.coalescePartitions.enabled=true`. Re-run a join that has post-shuffle partition imbalance (some 5MB, one 2GB). Self-check: call configure_aqe and assert_aqe_fired on the fixture job — confirm adaptiveFired=True (AdaptiveSparkPlan in plan), skewSplitApplied=True (OptimizeSkewedJoin or isSkew in plan), coalesceApplied=True (CoalesceShufflePartitions in plan), and post-shuffle partition count coalesces from 200 → ~50.",
      learningObjective: "AQE auto-applies most of the manual optimizations from step 2 — if you turn it on.",
      requiredSkill: "AQE configuration + reading the AQE-rewritten plan + skewJoin threshold tuning",
      starterCode: SRC(`# aqe.py
from pyspark.sql import SparkSession

def configure_aqe(spark: SparkSession) -> None:
    spark.conf.set("spark.sql.adaptive.enabled", "true")
    spark.conf.set("spark.sql.adaptive.skewJoin.enabled", "true")
    spark.conf.set("spark.sql.adaptive.coalescePartitions.enabled", "true")
    # Lower this if you have very small post-shuffle partitions you want merged.
    spark.conf.set("spark.sql.adaptive.advisoryPartitionSizeInBytes", "128MB")
    # The skew threshold (default 5x median + 256MB). Lower → more aggressive splitting.
    spark.conf.set("spark.sql.adaptive.skewJoin.skewedPartitionFactor", "5")
    spark.conf.set("spark.sql.adaptive.skewJoin.skewedPartitionThresholdInBytes", "256MB")

def assert_aqe_fired(df) -> dict:
    # AdaptiveSparkPlan node only appears when AQE actually rewrote.
    plan = df._jdf.queryExecution().executedPlan().toString()
    return {
        "adaptiveFired": "AdaptiveSparkPlan" in plan,
        "skewSplitApplied": "OptimizeSkewedJoin" in plan or "isSkew" in plan,
        "coalesceApplied": "CoalesceShufflePartitions" in plan,
    }
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Call configure_aqe and assert_aqe_fired on the fixture job. Confirm adaptiveFired=True (AdaptiveSparkPlan in plan), skewSplitApplied=True (OptimizeSkewedJoin or isSkew in plan), coalesceApplied=True (CoalesceShufflePartitions in plan), and final post-shuffle partition count ≤60.",
      }),
      expectedOutputs: { aqeFired: true, skewSplit: true },
      datasetRefs: ["fixtures/aqe_imbalance.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "AQE is OFF by default in Spark < 3.2; ON by default in 3.2+ — always check spark.version.",
          "AQE skew-handling subsumes most manual salting from step 2 — but only for sort-merge join skew.",
          "`coalescePartitions` collapses tiny shuffles — saves task-overhead at the end of a stage.",
          "`advisoryPartitionSizeInBytes` is the target post-shuffle partition size — tune to 128-256MB.",
          "spark.conf.set('spark.sql.adaptive.enabled', 'true')",
        ],
        successFeedback: "AQE now auto-applies the salting + coalesce + join-strategy tuning that used to be manual.",
        failureFeedback: "Common slips: AQE off (no rewrites); too-high skewedPartitionFactor (skew not detected); too-small advisorySize (re-creates small-file problem).",
        portfolioRelevance: "Showing the AQE plan with OptimizeSkewedJoin firing is the easiest senior-DE signal in a repo.",
        finalExplanation: "AQE is the biggest free Spark performance win since Tungsten. Turn it on; tune the thresholds; trust the planner.",
        misconceptionToWatchFor: "Believing AQE makes manual skew handling obsolete. AQE handles join skew well, but groupBy skew + serialization skew still need salting.",
      }),
    },
    {
      stepNumber: 4,
      title: "Output file sizing — `coalesce` + `maxRecordsPerFile`",
      instructionMd:
        "Write the joined output to `s3://output/normalized/` partitioned by `event_date`. Configure so the average output file size is ~128MB (typical sweet spot for downstream readers: not too small to swamp metadata, not too large to hurt parallelism). Use `coalesce(n)` AFTER the last shuffle and `.option('maxRecordsPerFile', N)` for hard cap. Self-check: run write_sized against the 10GB fixture — inspect the output files and confirm the average file size is between 100MB and 150MB, no individual file exceeds 256MB, and no file is smaller than 32MB.",
      learningObjective: "Output file sizing is downstream's problem until it's yours — Iceberg/Delta compaction + query planners both punish small + huge files.",
      requiredSkill: "coalesce vs repartition + maxRecordsPerFile + partition-by-write semantics",
      starterCode: SRC(`# write.py
from pyspark.sql import DataFrame
from pyspark.sql import functions as F

TARGET_FILE_BYTES = 128 * 1024 * 1024  # 128MB

def write_sized(df: DataFrame, out_path: str, est_bytes_per_row: int = 256) -> None:
    # Estimate partitions from total rows + target file size.
    total_rows = df.count()
    target_files = max(1, total_rows * est_bytes_per_row // TARGET_FILE_BYTES)
    max_per_file = TARGET_FILE_BYTES // est_bytes_per_row

    # TODO: coalesce REDUCES partitions without shuffle; repartition reshuffles.
    # After AQE coalesce, calling coalesce here is a safe final trim.
    (
        df.coalesce(int(target_files))
          .write
          .mode("overwrite")
          .partitionBy("event_date")
          .option("maxRecordsPerFile", str(max_per_file))
          .parquet(out_path)
    )
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Run write_sized against the 10GB fixture and inspect the output files. Confirm the average file size is between 100MB and 150MB, no individual file exceeds 256MB, and no file is smaller than 32MB. Show the file-size histogram or a per-file listing in your README.",
      }),
      expectedOutputs: { avgFile: "120MB", oversized: 0, undersized: 0 },
      datasetRefs: ["fixtures/output_sizing.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "`coalesce(N)` shrinks partitions without a shuffle; `repartition(N)` reshuffles.",
          "`maxRecordsPerFile` is the per-file hard cap — combine with coalesce for soft + hard sizing.",
          "partitionBy creates one subdirectory per value; mix with too-low `coalesce` = empty partitions.",
          "Target 100-256MB files for Parquet — smaller swamps metadata, larger hurts parallelism.",
          "df.coalesce(n).write.partitionBy(...).option('maxRecordsPerFile', n).parquet(path)",
        ],
        successFeedback: "Output files are now downstream-friendly. Iceberg/Delta compaction has nothing to fix.",
        failureFeedback: "Common slips: no coalesce (200 partitions × N event_dates = thousands of tiny files); repartition instead (unnecessary shuffle); no maxRecordsPerFile (giant files when one date dominates).",
        portfolioRelevance: "File-size discipline at the write step is a senior-DE signal. Show the histogram of output file sizes.",
        finalExplanation: "Output file sizing is the contract with downstream readers. Get it right at write time; pay later if you don't.",
        misconceptionToWatchFor: "Letting partitionBy decide file count for you. Without coalesce + maxRecordsPerFile, you get whatever the last stage's partition count happened to be — usually wrong.",
      }),
    },
    {
      stepNumber: 5,
      title: "CI gate — shuffle bytes + spill bytes regression budget",
      instructionMd:
        "Emit `metrics.json` at end of run with `{ shuffleWriteBytes, shuffleReadBytes, spillBytes, runtimeSec, inputBytes }` pulled from `spark.sparkContext.statusTracker()` + `_jsc.sc().listenerBus()`. Write a CI script that compares to a committed baseline `metrics.baseline.json` and fails if `shuffleWriteBytes` regressed > 20% OR `spillBytes` > 0. Run the gate against a perturbed job (intentionally `repartition(10000)`) so it reports a regression. Paste the gate's stderr output into the submission field. Atlas checks that the required evidence markers appear in your submission — not that the gate ran correctly or that your exit code was 1, and not your authorship or competence.",
      learningObjective: "A shuffle-bytes regression budget in CI is the only way to keep a Spark job fast over time — without it, every PR adds 5% and you wake up at 4 hours.",
      requiredSkill: "Spark listener metrics + simple regression-budget script + CI exit-code discipline",
      starterCode: SRC(`# metrics.py
import json, sys
from pathlib import Path
from pyspark.sql import SparkSession

def emit_metrics(spark: SparkSession, out_path: str) -> None:
    sc = spark.sparkContext
    # Sum across all stages of the active job.
    statuses = sc.statusTracker().getJobIdsForGroup() or []
    total = {"shuffleWriteBytes": 0, "shuffleReadBytes": 0, "spillBytes": 0, "inputBytes": 0}
    for jid in statuses:
        for sid in sc.statusTracker().getJobInfo(jid).stageIds:
            si = sc.statusTracker().getStageInfo(sid)
            if si is None: continue
            total["shuffleWriteBytes"] += si.shuffleWriteBytes()
            total["shuffleReadBytes"]  += si.shuffleReadBytes()
            total["spillBytes"]        += si.diskBytesSpilled() + si.memoryBytesSpilled()
            total["inputBytes"]        += si.inputBytes()
    total["runtimeSec"] = int(spark.conf.get("spark.app.runtimeSec", "0"))
    Path(out_path).write_text(json.dumps(total, indent=2))

def gate(current_path: str, baseline_path: str, shuffle_budget_ratio: float = 1.20) -> int:
    cur = json.loads(Path(current_path).read_text())
    base = json.loads(Path(baseline_path).read_text())
    failures = []
    if base["shuffleWriteBytes"] > 0:
        ratio = cur["shuffleWriteBytes"] / base["shuffleWriteBytes"]
        if ratio > shuffle_budget_ratio:
            failures.append(f"shuffleWriteBytes {ratio:.1f}x baseline (budget {shuffle_budget_ratio:.1f}x)")
    if cur["spillBytes"] > 0:
        failures.append(f"spillBytes={cur['spillBytes']} (budget=0)")
    if failures:
        print("CI gate FAILED:\\n  " + "\\n  ".join(failures), file=sys.stderr)
        return 1
    print("CI gate OK")
    return 0
`),
      validationType: "contains",
      stepType: "code_python",
      validation: validationConfig("contains", "Atlas checks that the required evidence markers are present in your submission — not that the gate otherwise executed correctly, and not your authorship or competence. Paste your gate's stderr output. Markers: 'CI gate FAILED', 'shuffleWriteBytes', and 'baseline' must all appear.", {
        needles: ["CI gate FAILED", "shuffleWriteBytes", "baseline"],
      }),
      expectedOutputs: { exitCode: 1, mentions: ["shuffleWriteBytes"] },
      datasetRefs: ["fixtures/metrics_perturbed.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Spark statusTracker exposes per-stage metrics — sum them across the job's stages.",
          "Track shuffle bytes, NOT runtime — runtime varies with cluster load; bytes are deterministic.",
          "Set spillBytes budget = 0 — any disk spill is a sign of memory pressure regression.",
          "Commit the baseline to the repo so reviewers can see the budget drift in the PR diff.",
          "if ratio > shuffle_budget_ratio: failures.append(...)",
        ],
        successFeedback: "CI now enforces a shuffle budget. Regressions can't merge silently.",
        failureFeedback: "Common slips: gating on runtime (noisy); no spillBytes check (memory pressure hidden); baseline never updated (false positives forever).",
        portfolioRelevance: "A CI workflow + committed `metrics.baseline.json` in the repo is uncommon and very senior. Show it.",
        finalExplanation: "Performance regressions are silent without a gate. A shuffle-bytes budget is the cheapest possible insurance.",
        misconceptionToWatchFor: "Treating CI as 'green = ship'. Without a perf gate, green means 'tests pass on the dev sample' — not 'prod won't regress'.",
      }),
    },
  ],
};
