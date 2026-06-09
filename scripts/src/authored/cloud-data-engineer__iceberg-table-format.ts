/**
 * Phase 9 — batch-1 upgrade. cloud-data-engineer / Apache Iceberg fundamentals.
 * Synthetic candidate 52e7704a-c3a1-4e56-bfcd-36f102ad6e6c (source=phase9_upgrade).
 *
 * Distinct from the Phase-7 `cloud-data-engineer-iceberg-compaction-rewrite`
 * (which focuses on the compaction job). This module focuses on the table-
 * format mental model: snapshots, hidden partitioning, schema evolution, time
 * travel.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const cloudDataEngineerIcebergTableFormat: AuthoredProject = {
  slug: "cloud-data-engineer-iceberg-table-format",
  candidateId: "52e7704a-c3a1-4e56-bfcd-36f102ad6e6c",
  title: "Apache Iceberg — Snapshots, Hidden Partitioning, and Time Travel",
  shortDescription:
    "Master the Iceberg table-format mental model: the snapshot/manifest hierarchy, why hidden partitioning replaces explicit columns, safe schema evolution by field id, and time travel for rollback.",
  fullDescription:
    "Hive-style tables fail at modern data scale: silent schema drift, partition-pruning gone wrong, and no way to roll back a bad write. Iceberg replaces them with an explicit catalog → snapshot → manifest list → manifest → data file hierarchy. You'll implement each layer in pure Python (so PyIceberg becomes legible), then use the model to design partition transforms, schema evolutions, and rollback queries that survive real production failures.",
  language: "python",
  difficulty: "advanced",
  techStack: ["PyIceberg", "Apache Iceberg", "Parquet", "MinIO / S3", "Python"],
  tags: ["iceberg", "lakehouse", "table-format", "object-storage", "schema-evolution"],
  learningObjectives: [
    "Reason about the Iceberg snapshot → manifest list → manifest → file hierarchy.",
    "Derive partition values from event-time using hidden partition transforms (year/month/day/hour).",
    "Classify schema changes by safety: add, drop, rename, reorder, widen.",
    "Find the right rollback target snapshot given a 'bad write happened at T'.",
    "Quantify when Iceberg compaction (file count) becomes the next bottleneck.",
  ],
  estimatedMinutes: 540,
  xpReward: 700,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "A bad upstream deploy at 14:00 wrote garbage into the `orders` lakehouse table. Stakeholders are panicking because the existing Hive-style table has no rollback. You're brought in to migrate to Iceberg and prove the rollback flow works.",
    hiringRelevance2026:
      "Iceberg is the 2026 default lakehouse table format (Netflix, Apple, AWS Athena). Senior cloud-DE interviews probe the snapshot model, hidden partitioning, and schema-evolution rules specifically.",
    readmeOutline: [
      "Overview & Scenario", "Iceberg hierarchy",
      "Step 1 snapshot summary", "Step 2 partition transforms",
      "Step 3 schema evolution", "Step 4 time travel rollback",
      "Step 5 file-count health probe",
      "Validation", "Compared to Hudi / Delta", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "GitHub repo: pure-Python implementations of the four core Iceberg operations + a docker-compose with MinIO + PyIceberg that materialises a real Iceberg table and demonstrates the rollback flow end-to-end.",
    portfolioRelevance:
      "Recruiters who run lakehouse stacks at scale ask about file-count math and rollback flows. A working rollback demo + the file-count probe is a clear senior signal.",
    repoUrl: "https://github.com/<your-handle>/iceberg-fundamentals",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Snapshot summary: count files and rows",
      instructionMd:
        "Given a snapshot's manifest list `[{manifest_path, added_files, deleted_files, added_rows, deleted_rows}, ...]`, implement `snapshot_summary(manifests)` returning `{total_files, total_rows}` (deltas summed across manifests, never going negative). Validator: 3 manifests with mixed adds/deletes produce the expected totals.",
      learningObjective: "Read the Iceberg manifest-list aggregate and derive a snapshot's row/file count.",
      requiredSkill: "Manifest-list literacy + non-negative aggregate math",
      starterCode: SRC(`def snapshot_summary(manifests):
    total_files = 0
    total_rows = 0
    for m in manifests:
        # TODO: total_files += m['added_files'] - m['deleted_files']
        # TODO: total_rows  += m['added_rows']  - m['deleted_rows']
        pass
    return {
        'total_files': max(0, total_files),
        'total_rows':  max(0, total_rows),
    }
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "3 manifests: (+5 files, +1000 rows), (+2 files, +500 rows, -1 file, -100 rows), (+0 files, +0 rows, -1 file, -50 rows) → {total_files: 5, total_rows: 1350}.", {
        manifests: [
          { manifest_path: "m1", added_files: 5, deleted_files: 0, added_rows: 1000, deleted_rows: 0 },
          { manifest_path: "m2", added_files: 2, deleted_files: 1, added_rows: 500, deleted_rows: 100 },
          { manifest_path: "m3", added_files: 0, deleted_files: 1, added_rows: 0, deleted_rows: 50 },
        ],
        expected: { total_files: 5, total_rows: 1350 },
      }),
      expectedOutputs: { total_files: 5, total_rows: 1350 },
      datasetRefs: ["fixtures/iceberg_manifests.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "A snapshot points at one manifest-list, which lists N manifests, each describing a batch of added + deleted data files.",
          "Each manifest carries pre-aggregated counts so you don't have to scan all the data files to summarise a snapshot.",
          "Clamp at zero — bad data or partial writes can make raw sums negative; the table physically can't have negative files.",
          "PyIceberg exposes this via `table.current_snapshot().summary` — your function is the manual version.",
          "Reference: total_files = sum(m['added_files'] - m['deleted_files'] for m in manifests); same for rows; max(0, ...) at the end.",
        ],
        successFeedback: "You can now answer 'how big is this snapshot?' without scanning a single data file. That's the Iceberg metadata advantage.",
        failureFeedback: "Common slips: treated `added_*` as the snapshot total (ignored deletes); didn't clamp at zero (got negative file counts); summed manifest_path strings by mistake.",
        portfolioRelevance: "Reading the manifest-list is the foundation for every Iceberg ops tool. Knowing it cold is a clear senior signal in lakehouse interviews.",
        finalExplanation: "Iceberg metadata is just files in object storage; reading them with arithmetic is enough for 90% of monitoring.",
        misconceptionToWatchFor: "Believing you need a query engine to inspect Iceberg. The metadata layer is plain JSON/Avro — you can read it with `boto3` and a parser.",
      }),
    },
    {
      stepNumber: 2,
      title: "Hidden partition transforms",
      instructionMd:
        "Implement `partition_value(ts_ms, transform)` for transforms `'hour'`, `'day'`, `'month'`, `'year'`. Returns ISO-style strings: day → `'YYYY-MM-DD'`, hour → `'YYYY-MM-DDTHH'`, month → `'YYYY-MM'`, year → `'YYYY'`. Use UTC. Validator drives 4 timestamps with 4 transforms.",
      learningObjective: "Derive partition values from event-time so queries on the source column get pruned automatically.",
      requiredSkill: "Iceberg partition-transform contract + datetime UTC arithmetic",
      starterCode: SRC(`from datetime import datetime, timezone

def partition_value(ts_ms, transform):
    dt = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
    # TODO: if transform == 'year':  return dt.strftime('%Y')
    # TODO: if transform == 'month': return dt.strftime('%Y-%m')
    # TODO: if transform == 'day':   return dt.strftime('%Y-%m-%d')
    # TODO: if transform == 'hour':  return dt.strftime('%Y-%m-%dT%H')
    raise ValueError(f'unknown transform: {transform}')
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "ts_ms=1747315200000 (2025-05-15T12:00:00Z) → year='2025', month='2025-05', day='2025-05-15', hour='2025-05-15T12'.", {
        ts_ms: 1747315200000,
        expected: { year: "2025", month: "2025-05", day: "2025-05-15", hour: "2025-05-15T12" },
      }),
      expectedOutputs: { year: "2025", month: "2025-05", day: "2025-05-15", hour: "2025-05-15T12" },
      datasetRefs: ["fixtures/iceberg_partition_cases.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Always use UTC — local timezones in partition values create silent inconsistency across regions.",
          "ISO-8601 strings sort lexicographically, so partition pruning via range filters works without parsing.",
          "Iceberg's actual partition format under the hood is integer (days-since-epoch); the string is for readability and SQL display.",
          "Tag the transform in the partition spec, not the source column — that's how hidden partitioning works.",
          "Reference: dt = datetime.fromtimestamp(ts_ms/1000, tz=timezone.utc); return dt.strftime(fmt_for[transform]).",
        ],
        successFeedback: "Your transforms match PyIceberg's output character-for-character — queries on event_ts auto-prune.",
        failureFeedback: "Common slips: forgot UTC tz (local-machine drift); used '/' separators (breaks lexicographic sort); accepted unknown transforms silently.",
        portfolioRelevance: "Hidden partitioning is THE Iceberg differentiator from Hive. Demonstrating it in a working repo is the senior cloud-DE signal.",
        finalExplanation: "Hidden partitioning means users never need to know the partition exists. They filter on event_ts; the engine prunes.",
        misconceptionToWatchFor: "Adding event_date as an explicit column (Hive habit). Iceberg derives it from event_ts at query time; explicit columns just become stale.",
      }),
    },
    {
      stepNumber: 3,
      title: "Safe schema evolution by field id",
      instructionMd:
        "Implement `is_safe_evolution(old, new)` where each schema is `{field_id: (name, type)}`. Allowed transitions: add (id only in new), drop (id only in old), rename (same id, type unchanged), widen (`int→long`, `float→double`). Anything else is unsafe. Validator drives 5 transitions.",
      learningObjective: "Classify schema changes by safety so production migrations can run without rewriting historical files.",
      requiredSkill: "Iceberg field-id semantics + allowed type widening",
      starterCode: SRC(`ALLOWED_WIDENING = {('int', 'long'), ('float', 'double')}

def is_safe_evolution(old, new):
    for fid, (_name_old, type_old) in old.items():
        if fid not in new:
            continue  # drop — safe
        _name_new, type_new = new[fid]
        if type_old == type_new:
            continue  # rename or no-op — safe
        # TODO: if (type_old, type_new) in ALLOWED_WIDENING: continue
        # TODO: else: return False
        pass
    return True
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "is_safe_evolution({1:['a','int']}, {1:['a','long']}) returns True (int→long widening is safe)",
          "is_safe_evolution({1:['a','long']}, {1:['a','int']}) returns False (long→int narrowing is unsafe)",
          "is_safe_evolution({1:['a','int']}, {1:['a','int'],2:['b','string']}) returns True (add column is safe)",
          "is_safe_evolution({1:['a','string']}, {1:['a_renamed','string']}) returns True (rename via same id is safe)",
          "is_safe_evolution({1:['a','string']}, {1:['a','int']}) returns False (arbitrary type change is unsafe)",
        ],
      }),
      expectedOutputs: { passedCases: 5, allCorrect: true },
      datasetRefs: ["fixtures/iceberg_schema_cases.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Field IDs are the contract. Names are aliases; an Iceberg `rename` is just an alias change with the id preserved.",
          "Widening is safe because every existing file's data still fits in the new type (an int fits in a long).",
          "Narrowing is unsafe because existing files may have values that no longer fit (a long > 2^31 doesn't fit in an int).",
          "Drops are safe because Iceberg readers ignore unknown ids in old files.",
          "Reference: allowed_widening = {(int,long), (float,double), (decimal X,Y → decimal X+a,Y+b for a,b ≥ 0)}. Decimal handling is the trickier extension.",
        ],
        successFeedback: "Your classifier catches every common dangerous schema change. You can wire it into CI as a migration gate.",
        failureFeedback: "Common slips: matched on name instead of id (renames flagged unsafe); permitted narrowing (silent data loss); forgot to allow type-equal transitions (every rename rejected).",
        portfolioRelevance: "Schema-evolution governance is the unsexy but production-critical detail interviewers probe. A working classifier is rare and valued.",
        finalExplanation: "Iceberg's field-id model decouples physical layout from logical schema. Rename and reorder become metadata edits, not table rewrites.",
        misconceptionToWatchFor: "Believing 'just rewrite the table' is acceptable. For 10TB tables, the rewrite is hours of compute; field-id evolution is seconds of metadata.",
      }),
    },
    {
      stepNumber: 4,
      title: "Time travel: find the rollback target",
      instructionMd:
        "Given snapshots `[{id, committed_ms}, ...]` (oldest-first), implement `find_rollback_target(snapshots, bad_after_ts)` returning the snapshot id of the latest snapshot committed at or before `bad_after_ts` — or `None` if none qualifies. Validator: 4 snapshots, 2 reference timestamps.",
      learningObjective: "Use the snapshot timeline to recover from a bad write with a single metadata op.",
      requiredSkill: "Snapshot timeline traversal + rollback semantics",
      starterCode: SRC(`def find_rollback_target(snapshots, bad_after_ts):
    target = None
    for s in snapshots:
        # TODO: if s['committed_ms'] <= bad_after_ts: target = s['id']
        # TODO: else: break  # snapshots are sorted oldest-first
        pass
    return target
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "find_rollback_target(snapshots, 300) returns 'b' (latest snapshot committed at or before 300ms is id='b' at 200ms)",
          "find_rollback_target(snapshots, 50) returns None (no snapshot committed before 50ms)",
          "find_rollback_target(snapshots, 400) returns 'd' (latest snapshot at boundary 400ms)",
          "Snapshots input: [{id:'a',committed_ms:100},{id:'b',committed_ms:200},{id:'c',committed_ms:350},{id:'d',committed_ms:400}]",
        ],
      }),
      expectedOutputs: { rollbackTargets: ["b", null, "d"] },
      datasetRefs: ["fixtures/iceberg_rollback_cases.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Snapshots arrive oldest-first; walk them and remember the last qualifying id.",
          "Iceberg keeps old snapshots until garbage-collected. Rollback is a metadata write, not a data rewrite.",
          "Production: GC retention determines how far back you can roll. Default ~5 days; tune to your incident-response window.",
          "PyIceberg: `table.rollback_to_snapshot(snapshot_id)` — millisecond operation regardless of table size.",
          "Reference: target = None; for s in snapshots: if s['committed_ms'] <= bad_after_ts: target = s['id']; else: break.",
        ],
        successFeedback: "You can recover from any bad write within your retention window in seconds — the lakehouse promise made real.",
        failureFeedback: "Common slips: returned the FIRST qualifying snapshot (you want the latest); kept iterating past the break point (wasted work); off-by-one on the inclusive boundary.",
        portfolioRelevance: "Demoing a 'bad write at T, rolled back at T+5min' flow is the highest-impact lakehouse demo you can give an interviewer.",
        finalExplanation: "Time travel turns 'database disaster' into 'metadata edit'. Every lakehouse format that survives 2026 has it.",
        misconceptionToWatchFor: "Believing you can rollback past the retention window. You can't — old snapshots and their data files have been GC'd.",
      }),
    },
    {
      stepNumber: 5,
      title: "File-count health probe",
      instructionMd:
        "High file counts in object storage kill query planning latency. Implement `needs_compaction(total_files, partition_count)` returning True when avg files per partition > 50 OR total files > 10_000. Validator drives 4 scenarios.",
      learningObjective: "Build the operational signal that triggers Iceberg compaction before query latency degrades.",
      requiredSkill: "File-count thresholds + ratio-based health checks",
      starterCode: SRC(`MAX_AVG_FILES_PER_PARTITION = 50
MAX_TOTAL_FILES = 10_000

def needs_compaction(total_files, partition_count):
    if partition_count <= 0:
        raise ValueError('partition_count must be > 0')
    avg = total_files / partition_count
    # TODO: return avg > MAX_AVG_FILES_PER_PARTITION or total_files > MAX_TOTAL_FILES
    pass
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "needs_compaction(100, 10) returns False (avg=10 per partition, total=100 — both within thresholds)",
          "needs_compaction(5000, 200) returns False (avg=25 per partition — within threshold)",
          "needs_compaction(600, 10) returns True (avg=60 per partition — exceeds MAX_AVG_FILES_PER_PARTITION=50)",
          "needs_compaction(12000, 1000) returns True (total=12000 — exceeds MAX_TOTAL_FILES=10000)",
        ],
      }),
      expectedOutputs: { decisions: [false, false, true, true] },
      datasetRefs: ["fixtures/iceberg_compaction_cases.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Two thresholds matter: per-partition (slow scans within a partition) and total (slow planning across partitions).",
          "Both are starter values — tune to your engine. Athena chokes at lower total counts than Spark.",
          "Wire this into your monitoring as a probe that exposes a single boolean per table.",
          "Trigger Iceberg's `rewrite_data_files` action when this returns True — see Phase-7's iceberg-compaction-rewrite for the action design.",
          "Reference: return (total_files / partition_count) > 50 or total_files > 10_000.",
        ],
        successFeedback: "Your table-health probe gives ops a single signal to decide when to run compaction — no more guessing.",
        failureFeedback: "Common slips: divided by zero on empty tables; only checked total (missed per-partition pressure); only checked avg (missed planning-time blowup).",
        portfolioRelevance: "Compaction triggering is unglamorous but production-critical. An automated probe IS the senior cloud-DE artifact.",
        finalExplanation: "Iceberg's small-file problem is the next bottleneck after you've nailed everything else. Health probes catch it before users complain.",
        misconceptionToWatchFor: "Believing Iceberg auto-compacts. It doesn't — you schedule the action yourself, gated on a signal like this.",
      }),
    },
  ],
};
