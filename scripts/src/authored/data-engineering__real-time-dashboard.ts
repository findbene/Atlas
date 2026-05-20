/**
 * Phase 9 — batch-1 upgrade. data-engineering / Real-Time Analytics Dashboard.
 * Synthetic candidate 49f38e2b-c7ba-4e44-9374-412f0e33844e (source=phase9_upgrade).
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const dataEngineeringRealTimeDashboard: AuthoredProject = {
  slug: "data-engineering-real-time-dashboard",
  candidateId: "49f38e2b-c7ba-4e44-9374-412f0e33844e",
  title: "Real-Time Analytics Dashboard with Redis + Kafka",
  shortDescription:
    "Build the data layer for a sub-50ms KPI dashboard: a Kafka consumer maintains per-minute counters in Redis (incl. HyperLogLog uniques), a FastAPI endpoint serves them at p99 < 50ms.",
  fullDescription:
    "Replace overnight batch metrics with a streaming dashboard your stakeholders refresh during incidents. You'll wire Kafka → Python consumer → Redis (INCR for counters, PFADD for uniques) → FastAPI, then prove the p99 latency at the API layer. Every choice (bucket granularity, key TTL, HLL vs Set) is a real production trade-off explained inline.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "Redis", "Kafka", "FastAPI"],
  tags: ["kafka", "redis", "real-time", "dashboard", "hyperloglog", "fastapi"],
  learningObjectives: [
    "Maintain incrementally-updated per-minute counters in Redis from a Kafka stream.",
    "Use HyperLogLog (PFADD/PFCOUNT) for cardinality estimates at fixed 12 KB per key.",
    "Bucket metrics by epoch-minute so range queries are a single MGET round-trip.",
    "Serve aggregates over FastAPI with a p99 < 50ms latency budget.",
    "Reason about TTL, idempotency, and consumer-restart semantics in streaming aggregators.",
  ],
  estimatedMinutes: 540,
  xpReward: 650,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "The on-call team needs a CTR / signups / unique-visitors dashboard that updates within 5s of every click. The current 15-min cron job lags badly during traffic spikes — exactly when fresh numbers matter most.",
    hiringRelevance2026:
      "Real-time aggregation over Redis is the textbook streaming-DE warmup interview. Knowing why HLL beats SET for uniques (fixed memory, no GC pressure) and bucketing by epoch-minute are the signals that separate juniors from mid-level streaming engineers.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (Kafka → consumer → Redis → FastAPI)",
      "Step 1 minute-bucketed counters", "Step 2 batched writes",
      "Step 3 range query", "Step 4 HLL uniques", "Step 5 FastAPI endpoint",
      "Validation", "Latency budget", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "service",
    deliverable:
      "Public GitHub repo: docker-compose with Kafka + Redis, the consumer worker, the FastAPI service, a `locust` load test harness that verifies p99 < 50ms at 1k QPS, and a README with the bucket-choice / HLL-vs-Set trade-off matrix.",
    portfolioRelevance:
      "Recruiters can see both the streaming-aggregation primitives AND the operational discipline (latency SLO + load test). That combination is the senior streaming-DE signal.",
    repoUrl: "https://github.com/<your-handle>/realtime-redis-dashboard",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Minute-bucketed counters",
      instructionMd:
        "Implement `record_event(redis_client, metric, ts_seconds)` that increments the per-minute counter for `metric` and sets a 25-hour TTL. Key shape: `metric:<metric>:<minute_epoch>`. Implement `last_n_minutes(redis_client, metric, n, now_seconds)` that MGETs the last N minute keys and sums them (None → 0). Validator drives both with a fixed clock and checks the sums.",
      learningObjective: "Bucket counters by epoch-minute so range queries are O(1) MGET.",
      requiredSkill: "Redis INCR/EXPIRE + epoch-minute bucketing + MGET range",
      starterCode: SRC(`def record_event(redis_client, metric, ts_seconds):
    minute = (ts_seconds // 60) * 60
    # TODO: INCR f'metric:{metric}:{minute}'; EXPIRE same key, 90_000
    pass

def last_n_minutes(redis_client, metric, n, now_seconds):
    minute = (now_seconds // 60) * 60
    keys = [f'metric:{metric}:{minute - i*60}' for i in range(n)]
    # TODO: vals = redis_client.mget(keys); sum int(v) for v in vals if v is not None
    pass
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Record 5 events at minute=100 and 3 at minute=160; last_n_minutes(metric,3,160) == 8.", {
        events: [[100, 5], [160, 3]], window: 3, expectedSum: 8,
      }),
      expectedOutputs: { sum: 8, ttlSeconds: 90000 },
      datasetRefs: ["fixtures/realtime_events.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Quantise the timestamp to the start of the minute: `minute = (ts_seconds // 60) * 60`. That single number IS your bucket key suffix.",
          "TTL just over 24h (90_000s ≈ 25h) means a 24h dashboard always has fresh data and old keys self-clean.",
          "MGET returns a list aligned with the input keys; missing keys come back as None (or b'None' depending on client config). Cast valid entries to int().",
          "Use a pipeline if you're doing INCR + EXPIRE in two calls — saves a round-trip per event. Better: SET with EX option in newer Redis.",
          "Reference: pipe = r.pipeline(); pipe.incr(key); pipe.expire(key, 90_000); pipe.execute().",
        ],
        successFeedback: "You've built the streaming primitive: per-minute counts queryable in a single round-trip. Everything downstream is a thin layer on this.",
        failureFeedback: "Common slips: forgot to quantise to minute boundary (bucket count explodes); set no TTL (Redis OOMs in production); set TTL too short (24h dashboard misses early data).",
        portfolioRelevance: "Bucket-by-time is THE pattern interviewers test in streaming-DE rounds. Whiteboarding it cold with the right TTL story is the senior signal.",
        finalExplanation: "Granularity (1 minute), retention (25h TTL), and read shape (MGET) are the three knobs in every streaming aggregator. Setting them deliberately is the difference between a toy and a production service.",
        misconceptionToWatchFor: "Storing every event individually and aggregating at query time. Works at 100 QPS, dies at 10k QPS. Pre-aggregate on write.",
      }),
    },
    {
      stepNumber: 2,
      title: "Batched writes for throughput",
      instructionMd:
        "Implement `consume_batch(redis_client, events: list[tuple[str,int]])` that uses a single Redis pipeline to INCR every event then EXPIRE every touched key once. Compare round-trip count against naive per-event INCR. Validator asserts that 1000 events execute in exactly 1 pipeline (not 1000+).",
      learningObjective: "Use Redis pipelines to amortise round-trips for high-throughput consumers.",
      requiredSkill: "Redis pipelining + worst-case round-trip math + Kafka batch semantics",
      starterCode: SRC(`def consume_batch(redis_client, events):
    """events: list of (metric, ts_seconds) — assume same consumer poll batch."""
    pipe = redis_client.pipeline()
    touched_keys = set()
    for metric, ts in events:
        minute = (ts // 60) * 60
        key = f'metric:{metric}:{minute}'
        # TODO: pipe.incr(key); touched_keys.add(key)
        pass
    for key in touched_keys:
        # TODO: pipe.expire(key, 90_000)
        pass
    return pipe.execute()
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "1000 events across 3 distinct (metric,minute) buckets → 1 pipeline.execute() invocation, INCR called 1000 times, EXPIRE called 3 times.", {
        eventCount: 1000, distinctKeys: 3, expectedIncrCalls: 1000, expectedExpireCalls: 3,
      }),
      expectedOutputs: { pipelineExecutions: 1, incrCalls: 1000, expireCalls: 3 },
      datasetRefs: ["fixtures/realtime_batch.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Kafka consumers poll in batches (poll() returns up to max_poll_records). One batch = one pipeline.",
          "Track touched keys in a set so you EXPIRE each key once per batch, not once per event.",
          "redis-py's pipeline buffers commands locally; execute() ships them as a single TCP round-trip.",
          "At 10k events/sec, naive per-event INCR is 10k round-trips/sec → network-bound. Batched: ~50 round-trips/sec → CPU-bound.",
          "Reference: with redis.pipeline(transaction=False) as p: ... ; p.execute().",
        ],
        successFeedback: "Pipelined writes are how production streaming aggregators sustain 100k events/sec on a single Redis. Network latency stops being the bottleneck.",
        failureFeedback: "Common slips: forgot the touched-keys dedupe (N×EXPIRE wastes round-trips); used transaction=True (MULTI blocks the server unnecessarily); pipelined across event boundaries (back-pressure invisible).",
        portfolioRelevance: "Pipelining is the operational lever interviewers probe when they ask 'how do you scale this to 100k events/sec?'. Having the answer ready signals seniority.",
        finalExplanation: "Throughput in Redis-backed services is almost always round-trip-bound, not server-bound. Pipelining trades a tiny amount of latency for 10-100x throughput.",
        misconceptionToWatchFor: "Reaching for Redis Cluster before exhausting pipelining. Single-node Redis sustains 100k+ ops/sec with proper batching.",
      }),
    },
    {
      stepNumber: 3,
      title: "Range query: last-N-minutes",
      instructionMd:
        "Implement `range_query(redis_client, metric, n_minutes, now_seconds)` that returns a `{minute_epoch: count}` dict for the last N minutes (missing minutes → 0). One MGET round-trip. Validator drives with 5 recorded events across the window.",
      learningObjective: "Compose minute-bucketed reads into a window query usable by a dashboard renderer.",
      requiredSkill: "Range key construction + MGET + zero-fill",
      starterCode: SRC(`def range_query(redis_client, metric, n_minutes, now_seconds):
    minute = (now_seconds // 60) * 60
    minutes = [minute - i*60 for i in range(n_minutes)]
    keys = [f'metric:{metric}:{m}' for m in minutes]
    vals = redis_client.mget(keys)
    out = {}
    # TODO: zip(minutes, vals); cast None → 0, bytes/str → int
    return out
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Events at minutes [60,120,180] with counts [2,5,3]; range_query(3, now=180) == {60:2, 120:5, 180:3}.", {
        events: { "60": 2, "120": 5, "180": 3 }, window: 3,
      }),
      expectedOutputs: { rangeKeys: 3, missingMinutesFilled: true },
      datasetRefs: ["fixtures/realtime_range.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "MGET returns values in the SAME ORDER as the input keys — zip them together with the minute list to label each count.",
          "Zero-fill missing minutes — frontends choke on holes (chart gaps, NaN aggregates).",
          "Don't make this a loop of GETs. The whole point of bucketing is to make N reads one round-trip.",
          "Sort the returned dict by minute so the frontend doesn't have to: return dict(sorted(out.items())).",
          "Reference: out = {m: int(v) if v is not None else 0 for m, v in zip(minutes, vals)}.",
        ],
        successFeedback: "A 60-minute query is one round-trip to Redis. The dashboard can refresh at 1Hz without breaking a sweat.",
        failureFeedback: "Common slips: looped GETs (60 round-trips for 60 minutes); didn't zero-fill (broken charts); didn't sort (frontends iterating dict insertion order get jumbled time series).",
        portfolioRelevance: "A query that returns a clean, zero-filled, sorted time series is the bridge between your streaming aggregator and the dashboard layer. Interviewers love it.",
        finalExplanation: "The bucket-by-minute design pays off here: arbitrary windows are linear-cost reads with no aggregation work at query time.",
        misconceptionToWatchFor: "Storing counts in a SORTED SET keyed by metric and using ZRANGEBYSCORE. Works, but more memory + more CPU than the simple key-per-minute approach for this workload.",
      }),
    },
    {
      stepNumber: 4,
      title: "Unique visitors via HyperLogLog",
      instructionMd:
        "Counting unique users with a Set grows memory linearly. Use Redis HyperLogLog: PFADD to record, PFCOUNT to read, fixed 12 KB per key, ~0.81% error. Implement `record_unique(redis, metric, user_id, ts)` and `unique_last_n_minutes(redis, metric, n, now_seconds)` (PFCOUNT over multiple keys returns the union estimate). Validator inserts 10k unique IDs across 3 buckets and asserts error < 2%.",
      learningObjective: "Trade exact unique counts for fixed-memory HLL estimates at scale.",
      requiredSkill: "Redis PFADD/PFCOUNT + HLL union semantics + memory math",
      starterCode: SRC(`def record_unique(redis_client, metric, user_id, ts_seconds, ttl=86400):
    minute = (ts_seconds // 60) * 60
    key = f'unique:{metric}:{minute}'
    # TODO: redis_client.pfadd(key, user_id); redis_client.expire(key, ttl)
    pass

def unique_last_n_minutes(redis_client, metric, n, now_seconds):
    minute = (now_seconds // 60) * 60
    keys = [f'unique:{metric}:{minute - i*60}' for i in range(n)]
    # TODO: return redis_client.pfcount(*keys)
    pass
`),
      validationType: "numeric_tolerance",
      stepType: "code_python",
      validation: validationConfig("numeric_tolerance", "Insert 10000 unique users across 3 minute buckets; PFCOUNT across all 3 returns 10000 ± 2%.", {
        expectedUniques: 10000, toleranceFraction: 0.02,
      }),
      expectedOutputs: { uniques: 10000, errorBound: 0.02 },
      datasetRefs: ["fixtures/realtime_uniques.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "PFADD treats the HLL as a set; duplicate adds are no-ops at the data-structure level (but cost a round-trip).",
          "PFCOUNT over N keys returns the UNION cardinality estimate, not the sum — exactly what you want for a window query.",
          "Fixed memory: 12KB per HLL regardless of cardinality. A SET of 10M user IDs is ~700MB; the HLL is still 12KB.",
          "Error bound is ~0.81% standard, configurable. For 10k uniques expect ±81 max in practice.",
          "Reference: from redis import Redis; r.pfadd(key, user_id); r.pfcount(key1, key2, key3).",
        ],
        successFeedback: "Your unique-counter survives 1B events per day on a single Redis. SET-based counting would have OOM'd at ~10M.",
        failureFeedback: "Common slips: summed per-bucket PFCOUNTs (double-counts cross-bucket uniques); used SET (memory explodes); read inside a loop (use one PFCOUNT call across the full key list).",
        portfolioRelevance: "Probabilistic data structures (HLL, Bloom, Count-Min) are a clear senior signal in streaming/cache interviews. PFADD is the easiest one to ship in production.",
        finalExplanation: "HyperLogLog is the canonical 'I traded exactness for fixed memory' data structure. For dashboards where ±1% error is invisible to humans, it's free throughput.",
        misconceptionToWatchFor: "Worrying about the 0.81% error. For human-facing counters (visits, signups), no one can tell. For accounting (charges, payouts), use a SET.",
      }),
    },
    {
      stepNumber: 5,
      title: "FastAPI endpoint with p99 < 50ms budget",
      instructionMd:
        "Wire `GET /metrics/{metric}?minutes=5` that returns `{count, uniques, minutes}` by calling `range_query` and `unique_last_n_minutes` on the same Redis (one pipeline). Add a `/healthz` that pings Redis. Validator stubs both functions and asserts response JSON shape + that exactly 1 Redis pipeline is opened per request (latency budget).",
      learningObjective: "Compose the streaming primitives into a low-latency HTTP service.",
      requiredSkill: "FastAPI + dependency injection + Redis pipelining for read fan-out",
      starterCode: SRC(`from fastapi import FastAPI, Depends, Query, HTTPException
import time

app = FastAPI()

def get_redis():
    raise NotImplementedError  # wire to your Redis client

@app.get('/metrics/{metric}')
def get_metric(metric: str, minutes: int = Query(5, ge=1, le=1440), r = Depends(get_redis)):
    now = int(time.time())
    # TODO: pipeline range_query + PFCOUNT into one round-trip
    # counts = range_query(r, metric, minutes, now)
    # uniques = unique_last_n_minutes(r, metric, minutes, now)
    # return {"count": sum(counts.values()), "uniques": uniques, "minutes": minutes}
    raise NotImplementedError

@app.get('/healthz')
def healthz(r = Depends(get_redis)):
    if not r.ping():
        raise HTTPException(503, "redis down")
    return {"ok": True}
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "GET /metrics/clicks?minutes=5 with stubbed Redis (counts={60:2,120:5,180:3,240:0,300:0}, uniques=42) returns {count:10, uniques:42, minutes:5} and opens exactly 1 pipeline.", {
        params: { metric: "clicks", minutes: 5 },
        stubbedCount: 10, stubbedUniques: 42,
        expectedResponse: { count: 10, uniques: 42, minutes: 5 },
        expectedPipelines: 1,
      }),
      expectedOutputs: { responseStatus: 200, pipelinesOpened: 1 },
      datasetRefs: ["fixtures/realtime_api_request.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Use FastAPI's Depends() so tests can inject a stubbed Redis without touching network code.",
          "Combine both reads into one pipeline — same TCP round-trip. Without it you've doubled your latency budget.",
          "Cap `minutes` with Query(ge=1, le=1440) so users can't ask for a 100k-key range and DoS the service.",
          "Add a /healthz that pings Redis; load balancers use it to mark dead pods.",
          "Reference: with r.pipeline() as p: p.mget(metric_keys); p.pfcount(*unique_keys); count_vals, uniques = p.execute().",
        ],
        successFeedback: "p99 < 50ms achieved: 1 round-trip to Redis + JSON serialise + FastAPI overhead. Load test confirms.",
        failureFeedback: "Common slips: two sequential Redis calls (doubles latency); no upper bound on `minutes` (unbounded fan-out); no /healthz (k8s probes can't drain).",
        portfolioRelevance: "A FastAPI service that hits its latency SLO under load is the deliverable interviewers actually evaluate. The streaming pipeline is the means; this is the product.",
        finalExplanation: "Latency budgets force you to count round-trips, not lines of code. Every IO call is a budget item.",
        misconceptionToWatchFor: "Adding Redis caching ON TOP of a Redis-backed service. You're already cached — extra layers add latency without value.",
      }),
    },
  ],
};
