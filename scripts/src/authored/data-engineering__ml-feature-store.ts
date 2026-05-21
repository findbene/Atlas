/**
 * Phase 12B — data-engineering (skeleton rebuild).
 * Candidate d4253ea0-35bc-4166-989a-92031425364a — ML Feature Store with
 * offline/online split, point-in-time-correct training joins, materialization,
 * online low-latency serving, and feature drift monitoring (PSI).
 *
 * Legacy: `ml-feature-store` (1-step skeleton, score 47.7). Full rebuild.
 *
 * Note: stays in `data-engineering` per the user's explicit Phase-12B decision.
 * The cross-course mlops-engineer recategorization was deferred at planning time.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const dataEngineeringMlFeatureStore: AuthoredProject = {
  slug: "data-engineering-ml-feature-store",
  candidateId: "d4253ea0-35bc-4166-989a-92031425364a",
  title: "ML Feature Store — Point-in-Time Joins + Online Serving + Drift",
  shortDescription:
    "Build a Feast-style feature store: define entities + feature views over offline Parquet, generate point-in-time-correct training sets (no leakage), materialize features to a Redis online store with versioning, and detect drift via PSI on a sliding window.",
  fullDescription:
    "Most 'feature store' projects skip the one thing that makes them feature stores: point-in-time correct joins. Train on tomorrow's value of a feature, model overfits in dev and dies in prod. You'll build the offline → training-set pipeline with explicit AS-OF semantics, materialize features to Redis for <5ms online reads with version pinning, and run a drift-monitoring loop that flags Population Stability Index > 0.2 on any production feature.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "pandas", "pyarrow", "redis", "scikit-learn", "duckdb", "parquet"],
  tags: ["feature-store", "point-in-time", "online-serving", "drift", "psi", "redis", "feast"],
  learningObjectives: [
    "Define entities + feature views over an offline Parquet store.",
    "Generate point-in-time-correct training sets via AS-OF joins (no temporal leakage).",
    "Materialize features from offline → online store (Redis) with version pinning.",
    "Serve features at <5ms p99 with a clean Python client.",
    "Compute Population Stability Index (PSI) and flag drift > 0.2 per feature.",
  ],
  estimatedMinutes: 235,
  xpReward: 740,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "DE/MLE on a 4-person ML platform team. The fraud model went from 92% recall in dev to 71% recall in prod the day after launch — the post-mortem blamed temporal leakage in the training-set generator. You're rebuilding the feature pipeline so training data CAN'T see the future.",
    hiringRelevance2026:
      "Point-in-time-correct feature joins is the most-asked feature-store interview area. Feast/Tecton roles screen on it heavily.",
    readmeOutline: [
      "Overview & Leakage Postmortem", "Architecture (offline / online / drift)",
      "Step 1 entities + views", "Step 2 AS-OF training join", "Step 3 materialize to Redis",
      "Step 4 online serving p99", "Step 5 PSI drift monitor", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo: feature_store/ module + docker-compose with Redis + a fixture dataset of 50k user-events over 30 days. Includes a leakage-test harness (compares strict AS-OF vs naive join — flags the 8% recall gap), a Locust online-serving load test (10k qps, p99 < 5ms), and a PSI drift report on real vs shifted distributions.",
    portfolioRelevance:
      "A feature store with a leakage-test harness + a measured PSI drift report is the strongest possible portfolio piece for any ML-platform DE role.",
    repoUrl: "https://github.com/<your-handle>/ml-feature-store",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Define entities + feature views over offline Parquet",
      instructionMd:
        "Declare an `Entity('user', join_key='user_id', value_type=STRING)` and two `FeatureView`s: `user_7d_spend` (TTL=7d, sources from `s3://offline/spend.parquet` partitioned by `event_date`), `user_session_count_24h` (TTL=24h). Each view must declare its `event_timestamp_col` + `created_timestamp_col` + `source` + `entities`. Validator asserts: registry parses 2 views + 1 entity, schema lists exactly the right column names, TTLs in seconds.",
      learningObjective: "Feature definitions are contracts — the registry enforces them at registration so downstream training + serving share one source of truth.",
      requiredSkill: "Feature-view declaration + entity-feature relationship + TTL semantics + Parquet partitioning",
      starterCode: SRC(`# definitions.py
from dataclasses import dataclass, field
from datetime import timedelta

@dataclass
class Entity:
    name: str
    join_key: str
    value_type: str

@dataclass
class FeatureView:
    name: str
    entities: list[str]
    features: list[tuple[str, str]]    # (name, type)
    ttl: timedelta
    source_path: str
    event_timestamp_col: str
    created_timestamp_col: str = "created_at"

user = Entity(name="user", join_key="user_id", value_type="STRING")

user_7d_spend = FeatureView(
    name="user_7d_spend",
    entities=["user"],
    features=[("spend_7d", "FLOAT"), ("txn_count_7d", "INT")],
    ttl=timedelta(days=7),
    source_path="s3://offline/spend.parquet",
    event_timestamp_col="event_date",
)
user_session_count_24h = FeatureView(
    name="user_session_count_24h",
    entities=["user"],
    features=[("sessions_24h", "INT")],
    ttl=timedelta(hours=24),
    source_path="s3://offline/sessions.parquet",
    event_timestamp_col="event_ts",
)

REGISTRY: dict = {"entities": {user.name: user}, "views": {user_7d_spend.name: user_7d_spend, user_session_count_24h.name: user_session_count_24h}}
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Registry parses: 1 entity (user), 2 views with correct columns + TTLs.", {
        expected: {
          entityCount: 1, viewCount: 2,
          userJoinKey: "user_id",
          spend7dTtlSec: 7 * 24 * 3600,
          sessionsTtlSec: 24 * 3600,
          spend7dFeatures: ["spend_7d", "txn_count_7d"],
        },
      }),
      expectedOutputs: { entities: 1, views: 2, ttlsCorrect: true },
      datasetRefs: ["fixtures/registry.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Every feature view MUST declare event_timestamp_col — that's how AS-OF joins find the right row.",
          "TTL bounds how stale a feature can be at serve time; mismatched TTLs make online/offline disagree.",
          "Entities are the join keys — features are computed per entity per timestamp.",
          "Partition the Parquet source by event_date to make AS-OF joins fast (predicate pushdown).",
          "FeatureView(name='user_7d_spend', entities=['user'], ttl=timedelta(days=7), ...)",
        ],
        successFeedback: "Feature definitions are now contracts. Training and serving consume from the same registry.",
        failureFeedback: "Common slips: skipping event_timestamp_col (can't AS-OF join); shared entity with wrong join_key (silent miss); no TTL (stale features survive forever).",
        portfolioRelevance: "Declarative feature definitions are the API surface reviewers inspect first. Make them clean.",
        finalExplanation: "Feature views are how training + serving share one contract. Skipping the declarative step is how leakage creeps in.",
        misconceptionToWatchFor: "Treating feature definitions as 'just config'. They're the type system for the ML pipeline.",
      }),
    },
    {
      stepNumber: 2,
      title: "Point-in-time-correct training join (AS-OF, no leakage)",
      instructionMd:
        "Implement `get_training_set(entity_df, feature_views)` where `entity_df` has `(user_id, event_timestamp)` rows. For each row, fetch the feature value AS OF `event_timestamp - epsilon` (strictly less than, never equal/greater — that would leak). Use DuckDB ASOF JOIN with `<=` flipped to `<` for strict past-only. Validator: against a 1000-row entity_df + a feature source where each user's spend doubles at t=10, assert: rows with event_timestamp<10 see spend=$X, rows with event_timestamp>=10 see $X (not $2X) — proving the join uses past-only.",
      learningObjective: "Strict past-only AS-OF joins eliminate temporal leakage. Use `<` not `<=`.",
      requiredSkill: "AS-OF join semantics + DuckDB ASOF + the strict-less-than discipline",
      starterCode: SRC(`# training.py
import duckdb
import pandas as pd

def get_training_set(entity_df: pd.DataFrame, source_parquet: str, feature_cols: list[str], ts_col: str = "event_timestamp") -> pd.DataFrame:
    con = duckdb.connect(":memory:")
    con.register("entities", entity_df)
    feats = ", ".join(f"f.{c}" for c in feature_cols)
    sql = f"""
        SELECT e.user_id, e.{ts_col},
               {feats}
        FROM entities e
        ASOF LEFT JOIN read_parquet('{source_parquet}') f
          ON e.user_id = f.user_id
          AND e.{ts_col} > f.event_date    -- STRICT > , never >=  → past-only, no leakage
    """
    # TODO: explain why the > matters: using >= would let a feature recorded
    # AT THE SAME instant as the label leak forward into training. That's
    # the #1 source of "great in dev, terrible in prod" feature stores.
    return con.sql(sql).df()
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "1000-row entity_df: rows with ts<10 see spend=$X; rows with ts>=10 see exactly $X (not $2X). Naive (>=) join shows $2X — proves we use strict.", {
        expected: { strictJoinLeakage: 0, naiveJoinLeakage: "$2X-bleed-into-pre-event-rows", strictRows: 1000, recallGap: 0 },
      }),
      expectedOutputs: { leakage: 0, strictRows: 1000 },
      datasetRefs: ["fixtures/leakage_check.parquet"],
      pedagogy: pedagogyConfig({
        hints: [
          "AS-OF JOIN with `>=` is a footgun — at-the-instant features leak forward.",
          "Always join on STRICT past (`>`) — the AS-OF semantic is 'last value seen BEFORE this timestamp'.",
          "TTL applies after the AS-OF — drop the join row if (event_timestamp - feature_timestamp) > TTL.",
          "Use DuckDB or Polars for AS-OF — pandas merge_asof works but is slower at scale.",
          "ASOF LEFT JOIN ... ON e.user_id = f.user_id AND e.event_timestamp > f.event_date",
        ],
        successFeedback: "Training set is now leakage-free. Dev/prod recall gap closes.",
        failureFeedback: "Common slips: `>=` instead of `>` (silent leakage); no TTL filter (ancient features stick); merging on date instead of timestamp (hour-of-day leakage).",
        portfolioRelevance: "A leakage-test harness in the repo is the senior-DE signal. Show the recall gap with vs without.",
        finalExplanation: "Point-in-time correctness is the entire point of a feature store. Without the strict-< AS-OF, you've built an expensive cache.",
        misconceptionToWatchFor: "Trusting your training set because 'the timestamps look right'. Always run the leakage-test fixture as CI.",
      }),
    },
    {
      stepNumber: 3,
      title: "Materialize offline → online (Redis) with version pinning",
      instructionMd:
        "Write `materialize(feature_view, end_timestamp, version: str)`. For each entity, fetch the latest feature value AS OF `end_timestamp` from offline Parquet; write to Redis key `fs:{view_name}:{version}:{entity_id}` with TTL from the FeatureView declaration. Validator: materialize `user_7d_spend` v1 + v2 for 10k users; assert: 20k keys present, TTL correctly set to 7 days, value at v2 reflects more-recent end_timestamp than v1.",
      learningObjective: "Versioned materialization lets multiple models share the store without overwriting each other's features.",
      requiredSkill: "Redis pipelining + key schema design + TTL configuration + versioned writes",
      starterCode: SRC(`# materialize.py
import duckdb, redis, json
from datetime import datetime

def materialize(view_name: str, source_parquet: str, feature_cols: list[str], end_ts: datetime, version: str, ttl_seconds: int, r: redis.Redis) -> int:
    con = duckdb.connect(":memory:")
    feats = ", ".join(feature_cols)
    df = con.sql(f"""
        SELECT user_id, {feats}
        FROM (
            SELECT user_id, {feats}, event_date,
                   ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY event_date DESC) AS rn
            FROM read_parquet('{source_parquet}')
            WHERE event_date < TIMESTAMP '{end_ts.isoformat()}'
        )
        WHERE rn = 1
    """).df()
    pipe = r.pipeline()
    for _, row in df.iterrows():
        # TODO: key schema: fs:{view}:{version}:{entity_id}.
        # Always pipeline — single set per row is 100x slower in Python.
        key = f"fs:{view_name}:{version}:{row['user_id']}"
        pipe.set(key, json.dumps({c: row[c] for c in feature_cols}), ex=ttl_seconds)
    pipe.execute()
    return len(df)
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "v1+v2 materialized for 10k users: 20k keys, TTL=7d, v2 strictly newer than v1.", {
        expected: { totalKeys: 20000, v1Keys: 10000, v2Keys: 10000, ttlSeconds: 604800, v2NewerThanV1: true },
      }),
      expectedOutputs: { keys: 20000, ttlOk: true, v2Newer: true },
      datasetRefs: ["fixtures/materialize_10k.parquet"],
      pedagogy: pedagogyConfig({
        hints: [
          "Always pipeline Redis writes — single-key set per row dies at >1k entities.",
          "Key schema: `fs:{view}:{version}:{entity}` — version in key lets two model versions coexist.",
          "Set TTL = FeatureView.ttl_seconds; mismatched TTLs cause silent serve-time staleness.",
          "Use `ROW_NUMBER() OVER (PARTITION BY entity ORDER BY ts DESC)` to grab the latest pre-end-ts value.",
          "pipe.set(key, value, ex=ttl_seconds)",
        ],
        successFeedback: "Materialization is now versioned and fast. Multiple models share the store cleanly.",
        failureFeedback: "Common slips: no pipelining (slow); no version in key (model A overwrites model B); no TTL (cache grows unbounded).",
        portfolioRelevance: "Versioned key schema + pipelined writes are senior DE patterns. Show the design diagram + Redis MEMORY USAGE numbers.",
        finalExplanation: "Materialization bridges offline ETL → online milliseconds. Versioning makes it safe for multiple consumers.",
        misconceptionToWatchFor: "Storing features without version in the key. The day model v2 ships, it overwrites v1 mid-flight.",
      }),
    },
    {
      stepNumber: 4,
      title: "Online serving — <5ms p99 with multi-get + version pinning",
      instructionMd:
        "Implement `get_online_features(entity_ids: list[str], feature_refs: list[str], version: str)` returning a dict per entity. Use Redis MGET in a single round-trip (NOT per-key GET). Validator runs a 10k-qps load test against the populated Redis from step 3 with batch_size=16 entities × 4 features; asserts: p99 latency < 5ms, no version drift (all responses come from declared version), missing entity returns None (not error).",
      learningObjective: "Online serving is bound by network round-trips — one MGET beats 16 GETs by 16x.",
      requiredSkill: "Redis MGET pipelining + latency profiling + missing-key handling + version pinning",
      starterCode: SRC(`# serving.py
import redis, json
from typing import Optional

def get_online_features(
    entity_ids: list[str], feature_refs: list[tuple[str, str]],  # (view, feature)
    version: str, r: redis.Redis,
) -> list[dict[str, Optional[float]]]:
    # Group keys by view; one MGET per view per batch.
    keys_by_view: dict[str, list[str]] = {}
    for view, _f in feature_refs:
        keys_by_view.setdefault(view, []).extend(f"fs:{view}:{version}:{eid}" for eid in entity_ids)

    raw: dict[str, list[Optional[bytes]]] = {}
    for view, keys in keys_by_view.items():
        # TODO: MGET in one round-trip — never loop r.get(k).
        raw[view] = r.mget(keys)

    out: list[dict[str, Optional[float]]] = []
    for i, eid in enumerate(entity_ids):
        row: dict[str, Optional[float]] = {"user_id": eid}
        for view, feature in feature_refs:
            blob = raw[view][i]
            if blob is None:
                row[f"{view}__{feature}"] = None       # missing entity = None, not error
            else:
                row[f"{view}__{feature}"] = json.loads(blob)[feature]
        out.append(row)
    return out
`),
      validationType: "numeric_tolerance",
      stepType: "code_python",
      validation: validationConfig("numeric_tolerance", "10k qps load test: p99 latency < 5ms (tolerance ±1ms); missing-entity rows return None; all responses pinned to declared version.", {
        expected: { p99Ms: 4.0, missingReturnsNone: 1, versionPinned: 1, qps: 10000 },
        tolerance: 1.0,
      }),
      expectedOutputs: { p99: 4.0, errors: 0 },
      datasetRefs: ["fixtures/online_load.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "MGET batches N keys into one round-trip — the difference between p99=2ms and p99=40ms.",
          "Missing entity returns None — NEVER raise. Models need to handle the cold-start.",
          "Version pin in the key (fs:{view}:{version}:{eid}) — never read v2's keys with a v1 client.",
          "Cluster Redis = HASH TAG entity into one slot per batch (`{entity}` braces) — otherwise MGET is illegal cross-slot.",
          "r.mget(keys)  # one round-trip for the batch",
        ],
        successFeedback: "Serving is now batch-efficient and version-safe. p99 < 5ms at 10k qps.",
        failureFeedback: "Common slips: per-key GET (death by latency); raising on missing (model crashes on cold-start); ignoring version (cross-version drift).",
        portfolioRelevance: "Showing a load test + Grafana p99 chart is exactly what platform-team reviewers want to see.",
        finalExplanation: "Online serving lives or dies by round-trip count. MGET + version pinning are the two non-negotiables.",
        misconceptionToWatchFor: "Believing 'Redis is fast' is enough. Network is fast too — round-trips are what kill p99.",
      }),
    },
    {
      stepNumber: 5,
      title: "PSI drift monitoring — flag P(SI) > 0.2 per feature",
      instructionMd:
        "Implement `psi(reference: np.array, current: np.array, bins=10) -> float` using the standard PSI formula: `sum((p_curr - p_ref) * ln(p_curr / p_ref))` over `bins` equal-frequency buckets. Run on `user_7d_spend.spend_7d` for ref=last-week vs current=today. Validator: with a fixture where current = 1.5× reference, assert `0.2 < psi < 0.5` (moderate drift) within ±0.05. Then a fixture with current = 3× reference asserts psi > 0.5 (severe).",
      learningObjective: "PSI is the industry-standard drift metric — 0.1 small, 0.2 moderate, 0.5 severe. Monitor it per feature.",
      requiredSkill: "Population Stability Index + equal-frequency binning + numerical-stability epsilon",
      starterCode: SRC(`# drift.py
import numpy as np

def psi(reference: np.ndarray, current: np.ndarray, bins: int = 10, eps: float = 1e-6) -> float:
    # Equal-frequency bin edges from reference distribution.
    edges = np.percentile(reference, np.linspace(0, 100, bins + 1))
    edges[0], edges[-1] = -np.inf, np.inf  # absorb tails so all current values bin somewhere

    ref_hist, _ = np.histogram(reference, bins=edges)
    cur_hist, _ = np.histogram(current, bins=edges)

    p_ref = (ref_hist + eps) / (ref_hist.sum() + eps * bins)
    p_cur = (cur_hist + eps) / (cur_hist.sum() + eps * bins)

    # TODO: standard PSI formula. eps prevents log(0) on empty bins.
    return float(np.sum((p_cur - p_ref) * np.log(p_cur / p_ref)))

def flag_drift(p: float) -> str:
    if p < 0.1: return "ok"
    if p < 0.2: return "monitor"
    if p < 0.5: return "moderate"
    return "severe"
`),
      validationType: "numeric_tolerance",
      stepType: "code_python",
      validation: validationConfig("numeric_tolerance", "current=1.5x ref → PSI in (0.2, 0.5) ±0.05; current=3x ref → PSI > 0.5.", {
        expected: { mildPsi: 0.30, severePsiMin: 0.5, classMild: "moderate", classSevere: "severe" },
        tolerance: 0.10,
      }),
      expectedOutputs: { mildPsi: 0.3, severeClass: "severe" },
      datasetRefs: ["fixtures/drift_cases.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Equal-frequency bins from the REFERENCE distribution — equal-width bins distort skewed features.",
          "Absorb tails with -inf / +inf edges so out-of-range current values still bin.",
          "Epsilon prevents log(0) on empty bins — without it, one empty bin = inf PSI.",
          "Industry thresholds: <0.1 ok, 0.1-0.2 monitor, 0.2-0.5 moderate, >0.5 severe.",
          "np.sum((p_cur - p_ref) * np.log(p_cur / p_ref))",
        ],
        successFeedback: "Drift is now measured per feature with a clear threshold ladder. Operators can act.",
        failureFeedback: "Common slips: equal-width bins (false-positives on skewed features); no epsilon (NaN on empty bins); reporting raw histogram diff (not PSI).",
        portfolioRelevance: "A drift dashboard with PSI per feature is the platform-DE differentiator. Pair with a 'who to alert' runbook.",
        finalExplanation: "PSI is the bridge between 'ML model' and 'production system'. Without it, model rot is invisible until users complain.",
        misconceptionToWatchFor: "Using KL divergence instead — KL is unstable on small samples, PSI is the industry standard for a reason.",
      }),
    },
  ],
};
