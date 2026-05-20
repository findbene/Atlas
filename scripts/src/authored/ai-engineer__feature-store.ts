/**
 * Phase 10 batch-2 / ai-engineer (advanced).
 * Candidate 97562dba-7f15-4767-a2ab-89195bc02065 — Feature Store
 * (offline + online + PIT + training-serving skew monitor).
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const aiEngineerFeatureStore: AuthoredProject = {
  slug: "ai-engineer-feature-store",
  candidateId: "97562dba-7f15-4767-a2ab-89195bc02065",
  title: "Feature Store — Offline Materialization + Online Serving + Skew Monitoring",
  shortDescription:
    "Build a from-scratch feature store: declarative feature definitions, offline materialization to Parquet, online write to Redis for <10ms serving, point-in-time correct training joins, and a training-serving skew monitor that catches drift before models go bad.",
  fullDescription:
    "Tecton/Feast cost $100k+/yr; you'll build the 80% in Python. Declarative feature defs (name, entity, computation, freshness SLA), an offline materializer that lands Parquet partitions by event_ts, an online writer that mirrors the latest-per-entity row to Redis, a point-in-time join API that prevents label leakage, and a skew monitor that statistical-tests training vs serving distributions weekly. End-to-end with a real fraud-detection model.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "Parquet", "Redis", "Pandas", "Pydantic"],
  tags: ["feature-store", "mlops", "point-in-time", "parquet", "redis", "training-serving-skew", "ksdrift"],
  learningObjectives: [
    "Declare features as code with entity + computation + freshness contracts.",
    "Materialize feature values to partitioned Parquet (offline store).",
    "Write latest-per-entity rows to Redis for <10ms online lookup.",
    "Implement point-in-time joins that prevent label leakage in training.",
    "Detect training-serving skew with a KS-test monitor over feature distributions.",
  ],
  estimatedMinutes: 195,
  xpReward: 675,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "ML platform engineer at a fintech. Fraud model accuracy dropped 4pts in prod last week — root cause was training-serving skew nobody caught. CTO wants a feature store with built-in skew monitoring before the next model goes live.",
    hiringRelevance2026:
      "MLOps + AI-platform roles in 2026 list 'feature store experience' as table stakes. Building one (vs configuring Feast) is the senior differentiator.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (defs + offline + online + PIT + monitor)",
      "Step 1 feature definitions", "Step 2 offline materialize", "Step 3 online write",
      "Step 4 point-in-time join", "Step 5 skew monitor", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "GitHub repo with the feature SDK, materializer CLI, FastAPI online lookup endpoint, PIT join utility, and a notebook that trains a fraud model on point-in-time-correct features then runs the skew monitor on a perturbed serving distribution.",
    portfolioRelevance:
      "Reviewers grep ML-platform repos for 'PIT' and 'skew'. Both present + working is the senior signal that beats Feast YAML.",
    repoUrl: "https://github.com/<your-handle>/feature-store",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Declarative feature definitions",
      instructionMd:
        "Define a Pydantic `FeatureDef` model with `name`, `entity` (e.g. 'user_id'), `dtype`, `compute_fn` (callable returning a DataFrame), `source_table`, `freshness_minutes` (max staleness before serving alerts). Register 4 features (`user_txn_count_7d`, `user_txn_amount_7d_sum`, `user_account_age_days`, `user_failed_login_24h`). Validator imports the registry and asserts all 4 exist with correct dtypes + freshness ≤60min.",
      learningObjective: "Treat features as version-controlled, contract-bound artifacts — not ad-hoc Pandas code.",
      requiredSkill: "Pydantic + decorator-based registries + freshness SLA modeling",
      starterCode: SRC(`# defs.py
from pydantic import BaseModel
from typing import Callable, Literal
import pandas as pd

class FeatureDef(BaseModel):
    name: str
    entity: str               # e.g. 'user_id'
    dtype: Literal['int', 'float', 'string', 'bool']
    source_table: str
    freshness_minutes: int    # max staleness before /serve alerts
    class Config: arbitrary_types_allowed = True

REGISTRY: dict[str, FeatureDef] = {}
COMPUTE: dict[str, Callable[[pd.DataFrame], pd.Series]] = {}

def feature(name: str, **kw):
    def deco(fn):
        REGISTRY[name] = FeatureDef(name=name, **kw)
        COMPUTE[name] = fn
        return fn
    return deco

# TODO: register 4 features below using @feature(...).
# Example shape (do NOT keep this exact computation — must use the source table):
# @feature(name='user_txn_count_7d', entity='user_id', dtype='int',
#          source_table='transactions', freshness_minutes=60)
# def user_txn_count_7d(df: pd.DataFrame) -> pd.Series:
#     return df.groupby('user_id')['txn_id'].transform('count')
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "REGISTRY contains exactly 4 features: user_txn_count_7d (int), user_txn_amount_7d_sum (float), user_account_age_days (int), user_failed_login_24h (int). All freshness_minutes ≤60.", {
        expected: {
          features: ["user_txn_count_7d", "user_txn_amount_7d_sum", "user_account_age_days", "user_failed_login_24h"],
          maxFreshness: 60,
        },
      }),
      expectedOutputs: { count: 4, freshness_max: 60 },
      datasetRefs: ["fixtures/feature_registry_expected.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Pydantic gives free runtime validation — bad freshness values fail at import, not at materialization.",
          "Decorator + global REGISTRY pattern is fine for <1k features — past that, file-based discovery + Pydantic models on the side.",
          "Always require an entity column — features without entities (e.g. 'global_time_of_day') are global signals, not features.",
          "Freshness SLA is the contract between feature owner + model team — store it WITH the def so it can't drift.",
          "@feature(name='user_account_age_days', entity='user_id', dtype='int', source_table='users', freshness_minutes=1440)\\ndef user_account_age_days(df): return (pd.Timestamp.utcnow() - pd.to_datetime(df['created_at'])).dt.days",
        ],
        successFeedback: "Features are now first-class artifacts. Every downstream step (materialize, serve, monitor) reads the registry.",
        failureFeedback: "Common slips: defined features as bare functions (no metadata); skipped dtype (silent string-vs-int errors in serving); freshness in seconds (off by 60x).",
        portfolioRelevance: "Declarative feature defs are the senior MLOps idiom. Vendor stores (Tecton, Feast) all converged on this pattern.",
        finalExplanation: "The registry IS the API. Materializer, online store, monitor, and CI all read it. No drift possible.",
        misconceptionToWatchFor: "Defining features inside notebooks. They never get promoted, they get re-implemented (and skew).",
      }),
    },
    {
      stepNumber: 2,
      title: "Offline materialize → partitioned Parquet",
      instructionMd:
        "Implement `materialize(feature_name, start_ts, end_ts)` that runs the registered compute function against the source table, then writes `offline_store/<feature>/event_ts=<YYYY-MM-DD>/part-00000.parquet`. Use pyarrow for snappy compression. Validator materializes `user_txn_count_7d` over 2026-04-01..2026-04-08 and expects 8 daily partitions, each with `user_id, event_ts, value` columns, total ~12,400 rows.",
      learningObjective: "Persist feature history as partitioned columnar files so training can pull any point-in-time slice.",
      requiredSkill: "PyArrow Parquet + Hive-style partitioning + idempotent writes",
      starterCode: SRC(`# materialize.py
from pathlib import Path
import pandas as pd, pyarrow as pa, pyarrow.parquet as pq
from .defs import REGISTRY, COMPUTE

OFFLINE_ROOT = Path('offline_store')

def materialize(feature_name: str, start_ts: str, end_ts: str, source_df: pd.DataFrame):
    fdef = REGISTRY[feature_name]
    compute = COMPUTE[feature_name]
    # source_df has [entity, event_ts, ...source columns]. Compute returns a Series indexed by entity.
    df = source_df[(source_df['event_ts'] >= start_ts) & (source_df['event_ts'] < end_ts)].copy()
    df['value'] = compute(df)
    out = df[[fdef.entity, 'event_ts', 'value']].rename(columns={fdef.entity: 'user_id'})
    out['event_ts'] = pd.to_datetime(out['event_ts'])
    out['partition'] = out['event_ts'].dt.strftime('%Y-%m-%d')
    # TODO: For each partition, write to OFFLINE_ROOT/feature_name/event_ts=<date>/part-00000.parquet
    return out
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "materialize('user_txn_count_7d', '2026-04-01', '2026-04-08'): writes 8 partitions, ~12,400 total rows, schema=[user_id, event_ts, value].", {
        expected: { partitionsWritten: 8, totalRows: 12400, schema: ["user_id", "event_ts", "value"] },
        rowTolerance: 100,
      }),
      expectedOutputs: { partitions: 8, total_rows: 12400 },
      datasetRefs: ["fixtures/transactions_seed.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Hive-style `event_ts=YYYY-MM-DD` partitioning lets readers prune partitions without listing files.",
          "Always write `<partition>/part-NNNNN.parquet` — atomic rename is per-file, so partial writes don't corrupt the dataset.",
          "Snappy compression is the default for good reason — fast read+write, ~50% size of uncompressed.",
          "Idempotency: write to a `_tmp/` directory, then rename atomically — re-runs must overwrite cleanly.",
          "for part_date, group in out.groupby('partition'):\\n    out_dir = OFFLINE_ROOT/feature_name/f'event_ts={part_date}'\\n    out_dir.mkdir(parents=True, exist_ok=True)\\n    pq.write_table(pa.Table.from_pandas(group[['user_id','event_ts','value']]), out_dir/'part-00000.parquet', compression='snappy')",
        ],
        successFeedback: "Feature history is now durable + queryable. Any future model can pull point-in-time slices.",
        failureFeedback: "Common slips: wrote one giant Parquet (no partition pruning); used CSV (10x size, 30x read latency); skipped event_ts column (PIT join becomes impossible).",
        portfolioRelevance: "Hive-partitioned Parquet is THE offline-store layout. Knowing the pattern (and why) is senior signal.",
        finalExplanation: "Partitioned Parquet is the cheapest infinite-history store you can build. Better than DBs for analytical reads, worse for OLTP.",
        misconceptionToWatchFor: "Storing offline features in Postgres. Works for 10GB, falls over at 1TB. Use columnar files.",
      }),
    },
    {
      stepNumber: 3,
      title: "Online write → Redis latest-per-entity",
      instructionMd:
        "Implement `update_online(feature_name, df)` that takes the latest row per entity from a DataFrame and writes to Redis keys `feat:{feature}:{entity_id}` with a TTL of `freshness_minutes * 60`. Implement `online_get(feature, entity_id)` that reads back + returns the value (or None if missing/expired). Validator writes 500 entities + reads back 50 with 1ms p99.",
      learningObjective: "Mirror latest-per-entity feature values to a low-latency store for serving.",
      requiredSkill: "Redis SET with EX (TTL) + DataFrame → batch writes + cache-aware key naming",
      starterCode: SRC(`# online.py
import redis, json
from .defs import REGISTRY

R = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

def _key(feature: str, entity_id) -> str:
    return f'feat:{feature}:{entity_id}'

def update_online(feature_name: str, df) -> int:
    fdef = REGISTRY[feature_name]
    latest = df.sort_values('event_ts').drop_duplicates('user_id', keep='last')
    ttl_seconds = fdef.freshness_minutes * 60
    pipe = R.pipeline()
    for _, row in latest.iterrows():
        # TODO: pipe.set(_key(feature_name, row['user_id']), json.dumps({'value': row['value'], 'ts': str(row['event_ts'])}), ex=ttl_seconds)
        pass
    pipe.execute()
    return len(latest)

def online_get(feature_name: str, entity_id):
    raw = R.get(_key(feature_name, entity_id))
    if raw is None: return None
    return json.loads(raw)['value']
`),
      validationType: "numeric_tolerance",
      stepType: "code_python",
      validation: validationConfig("numeric_tolerance", "Write 500 entities via update_online; read 50 random via online_get with p99 latency <1ms (tol ±0.3ms). Verify TTL set ≤ freshness_minutes*60.", {
        expected: { entitiesWritten: 500, readP99Ms: 1.0, ttlSecondsMax: 3600 },
        tolerance: 0.3,
      }),
      expectedOutputs: { written: 500, p99_ms: 0.8 },
      datasetRefs: ["fixtures/latest_per_user.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Redis SET with EX is atomic — no race between SET + EXPIRE.",
          "Pipeline writes — single SETs are network-bound, pipelines batch 100s per round-trip.",
          "Always TTL feature values to freshness SLA — stale features should return None (and trigger an alert), not lie.",
          "Key convention `feat:<feature>:<entity_id>` allows wildcard `feat:user_txn_count_7d:*` ops for debugging.",
          "pipe.set(_key(feature_name, row['user_id']), json.dumps({'value': row['value'], 'ts': str(row['event_ts'])}), ex=ttl_seconds)",
        ],
        successFeedback: "Online lookups are now sub-millisecond + freshness-aware. Serving is unblocked.",
        failureFeedback: "Common slips: forgot TTL (stale features served forever); per-key SET without pipeline (10x slower); stored full DataFrame as one Redis blob (unbounded growth).",
        portfolioRelevance: "Latency SLOs are an interview question. <1ms p99 for online features is the right answer + the right number.",
        finalExplanation: "Online store ≠ offline store. They have different access patterns and storage tradeoffs — keep them separate.",
        misconceptionToWatchFor: "Reading Parquet for online serving. Latency is too high (~50ms even with caching).",
      }),
    },
    {
      stepNumber: 4,
      title: "Point-in-time join (training, no label leakage)",
      instructionMd:
        "Implement `pit_join(labels_df, feature_name) -> labels_df'` that for each label row picks the LATEST feature value STRICTLY BEFORE `labels.event_ts`. Use Pandas `merge_asof` with `direction='backward'` + `allow_exact_matches=False`. Validator runs against fixture labels (50 rows) + materialized features; expects every joined feature row's event_ts < its label's event_ts.",
      learningObjective: "Prevent label leakage by joining features at the label's point-in-time, never after.",
      requiredSkill: "Pandas merge_asof + temporal join semantics + leakage detection",
      starterCode: SRC(`# pit.py
import pandas as pd
import pyarrow.parquet as pq
from pathlib import Path

OFFLINE_ROOT = Path('offline_store')

def load_feature(feature_name: str) -> pd.DataFrame:
    files = list((OFFLINE_ROOT/feature_name).rglob('*.parquet'))
    df = pd.concat([pq.read_table(f).to_pandas() for f in files], ignore_index=True)
    return df.sort_values('event_ts')

def pit_join(labels_df: pd.DataFrame, feature_name: str) -> pd.DataFrame:
    feat_df = load_feature(feature_name)
    labels_sorted = labels_df.sort_values('event_ts')
    # TODO: pd.merge_asof(labels_sorted, feat_df, on='event_ts', by='user_id',
    #                     direction='backward', allow_exact_matches=False)
    raise NotImplementedError
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "pit_join over 50 labels: 100% rows joined; for every row the feature event_ts is STRICTLY BEFORE the label event_ts; no row has a feature event_ts ≥ label event_ts.", {
        expected: { joinedCount: 50, leakageCount: 0, strictlyBeforeRatio: 1.0 },
      }),
      expectedOutputs: { joined: 50, leakage: 0 },
      datasetRefs: ["fixtures/labels.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "merge_asof with direction='backward' = 'latest feature ≤ label event'. Add allow_exact_matches=False to make it strict <.",
          "Always sort BOTH frames by the as-of key (event_ts) — merge_asof requires sorted input or raises.",
          "Check: assert (joined.feature_event_ts < joined.label_event_ts).all() — one assertion guards all future training runs.",
          "If many labels join to NaN feature, you have a freshness problem — features materialized AFTER the labels' point-in-time.",
          "return pd.merge_asof(labels_sorted, feat_df.rename(columns={'event_ts': 'feature_event_ts'}), left_on='event_ts', right_on='feature_event_ts', by='user_id', direction='backward', allow_exact_matches=False)",
        ],
        successFeedback: "Training joins are now point-in-time correct. Label leakage is mechanically impossible.",
        failureFeedback: "Common slips: direction='forward' (used future features = leakage); allow_exact_matches=True (equal timestamps still leak); forgot to sort (silent random join).",
        portfolioRelevance: "Label leakage is THE feature-store interview question. merge_asof + strict < is the canonical answer.",
        finalExplanation: "PIT joins are a single primitive. Once mechanized, every model trained on the store inherits the guarantee.",
        misconceptionToWatchFor: "Joining on `<=` instead of `<`. Same-microsecond rows are often after-the-fact in practice.",
      }),
    },
    {
      stepNumber: 5,
      title: "Training-serving skew monitor",
      instructionMd:
        "Implement `detect_skew(feature_name, train_window, serve_window) -> SkewReport` that pulls feature values from the offline store for both windows + runs `scipy.stats.ks_2samp`. Returns p-value + decision (`skewed = p < 0.01`). Validator runs on matched windows → not skewed; runs on a perturbed serve window (mean shifted by 0.5σ) → skewed=True with p<0.001.",
      learningObjective: "Statistical-test feature distributions across training + serving windows to catch silent drift.",
      requiredSkill: "Kolmogorov-Smirnov 2-sample test + p-value thresholds + skew interpretation",
      starterCode: SRC(`# skew.py
from dataclasses import dataclass
from scipy.stats import ks_2samp
from .pit import load_feature

@dataclass
class SkewReport:
    feature: str
    ks_statistic: float
    p_value: float
    skewed: bool

def detect_skew(feature_name: str, train_start: str, train_end: str, serve_start: str, serve_end: str, alpha: float = 0.01) -> SkewReport:
    df = load_feature(feature_name)
    train_vals = df[(df['event_ts'] >= train_start) & (df['event_ts'] < train_end)]['value'].values
    serve_vals = df[(df['event_ts'] >= serve_start) & (df['event_ts'] < serve_end)]['value'].values
    # TODO: stat, p = ks_2samp(train_vals, serve_vals)
    # TODO: return SkewReport(feature_name, stat, p, skewed = p < alpha)
    return SkewReport(feature_name, 0.0, 1.0, False)
`),
      validationType: "numeric_tolerance",
      stepType: "code_python",
      validation: validationConfig("numeric_tolerance", "Matched windows: p ≥0.05, skewed=False. Perturbed serve window (mean shifted 0.5σ): p <0.001, skewed=True. KS stat ≥0.15 on perturbed case.", {
        expected: { matchedPMin: 0.05, perturbedPMax: 0.001, perturbedKsMin: 0.15 },
        tolerance: 0.02,
      }),
      expectedOutputs: { matched_skewed: false, perturbed_skewed: true, perturbed_ks: 0.18 },
      datasetRefs: ["fixtures/skew_windows.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "KS test is non-parametric — works for any feature distribution without assuming Gaussian.",
          "Use α=0.01 not 0.05 — at 0.05 you'll alert on noise; at 0.001 you'll miss real drift. 0.01 is the production sweet spot.",
          "Run weekly per feature; alert on Slack with the p-value + sample histograms.",
          "For categorical features, swap KS for chi-square — KS is continuous only.",
          "stat, p = ks_2samp(train_vals, serve_vals); return SkewReport(feature_name, float(stat), float(p), bool(p < alpha))",
        ],
        successFeedback: "Skew monitor is live. The next time prod drifts, you'll know in days, not after a model post-mortem.",
        failureFeedback: "Common slips: used t-test (assumes normal); set α too high (false alarms); didn't separate windows by feature (cross-feature p-value soup).",
        portfolioRelevance: "Skew monitoring is the 2026 MLOps differentiator. Most teams still don't do it; doing it is senior signal.",
        finalExplanation: "Training-serving skew is the silent killer of production ML. Monitor it like CPU usage — automated, with alerts.",
        misconceptionToWatchFor: "Trusting that retraining solves skew. It doesn't — it just resets the clock until the next drift.",
      }),
    },
  ],
};
