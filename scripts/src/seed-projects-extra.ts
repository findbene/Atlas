// Additional fully-fleshed-out DE projects (positions 11-15).
// Same shape as the inline projectData entries in seed.ts — kept here for readability.

export type ProjectStep = {
  stepNumber: number;
  title: string;
  instruction: string;
  starterCode?: string;
  validationHint?: string;
  xpReward: number;
};

export type ProjectData = {
  slug: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedMinutes: number;
  position: number;
  isPremium: boolean;
  language: "python" | "sql";
  xpReward: number;
  tags: string[];
  learningObjectives: string[];
  techStack: string[];
  steps: ProjectStep[];
};

export const extraProjects: ProjectData[] = [
  {
    slug: "stream-processing-flink",
    title: "Stream Processing with Apache Flink",
    shortDescription: "Stateful stream processing at scale: windowed aggregations, watermarks, and exactly-once semantics.",
    fullDescription:
      "Build a real-time analytics pipeline that ingests events, aggregates them in time windows, and handles out-of-order data with watermarks. Learn the core stream-processing primitives that power systems like Uber's H3, Netflix's Mantis, and Stripe's Sigma.",
    difficulty: "advanced",
    estimatedMinutes: 600,
    position: 11,
    isPremium: true,
    language: "python",
    xpReward: 700,
    tags: ["flink", "streaming", "real-time", "windows"],
    learningObjectives: [
      "Understand event-time vs processing-time",
      "Use watermarks to handle late data",
      "Build tumbling and sliding windows",
      "Reason about exactly-once delivery",
    ],
    techStack: ["PyFlink", "Apache Flink", "Kafka", "Python"],
    steps: [
      {
        stepNumber: 1,
        title: "Event Time vs Processing Time",
        instruction:
          "## Why event time matters\n\nIn batch, time is simple — it's the timestamp on each row. In streaming, you have **two times**:\n\n- **Processing time** — when the engine sees the event\n- **Event time** — when the event actually happened\n\nA mobile app might emit an event at 10:00 but it arrives at the server at 10:03 (slow network). If you bucket by processing time, that event is in the wrong window.\n\n## Task\n\nWrite a function `extract_event_time(record: dict) -> int` that:\n1. Returns the millisecond epoch from `record['ts']` (an ISO 8601 string)\n2. Raises `ValueError` if `ts` is missing or malformed\n3. Treats naive datetimes as UTC",
        starterCode:
          "from datetime import datetime, timezone\n\ndef extract_event_time(record: dict) -> int:\n    \"\"\"\n    Return event time as ms since epoch.\n    Raise ValueError if record['ts'] is missing or malformed.\n    \"\"\"\n    ts = record.get('ts')\n    if not ts:\n        raise ValueError('record missing ts')\n    # TODO: parse with datetime.fromisoformat, treat naive as UTC, return int(ms)\n    pass\n\n# Smoke tests\nassert extract_event_time({'ts': '2024-01-01T00:00:00Z'}) == 1704067200000\nprint('ok')\n",
        validationHint:
          "datetime.fromisoformat handles 'Z' suffix in py3.11+. For earlier versions replace 'Z' with '+00:00'. If tzinfo is None, assume UTC by .replace(tzinfo=timezone.utc).",
        xpReward: 100,
      },
      {
        stepNumber: 2,
        title: "Tumbling Windows",
        instruction:
          "## Tumbling windows\n\nA tumbling window is a fixed-size, non-overlapping window. `[10:00, 10:05)`, `[10:05, 10:10)`, etc.\n\nFor each event, the window key is just the floor of its timestamp.\n\n## Task\n\nImplement `window_key(event_ms: int, size_ms: int) -> int` that returns the start ms of the tumbling window the event falls into.",
        starterCode:
          "def window_key(event_ms: int, size_ms: int) -> int:\n    \"\"\"\n    Return the start of the tumbling window of width `size_ms`\n    that contains `event_ms`.\n    \"\"\"\n    # TODO: integer-divide by size_ms then multiply\n    pass\n\nassert window_key(1_704_067_265_000, 60_000) == 1_704_067_260_000  # :05 → :04 minute floor wait recompute\nassert window_key(1_704_067_320_000, 60_000) == 1_704_067_320_000\nprint('ok')\n",
        validationHint: "return (event_ms // size_ms) * size_ms",
        xpReward: 125,
      },
      {
        stepNumber: 3,
        title: "Watermarks for Late Data",
        instruction:
          "## Watermarks\n\nA watermark is the engine's promise: 'I won't see any more events with timestamp ≤ T'. When the watermark passes a window's end, the window can fire.\n\nA common heuristic: `watermark = max_seen_ts - allowed_lateness`.\n\n## Task\n\nImplement `BoundedOutOfOrdernessTracker` that:\n- Tracks the max event time it has seen\n- Returns a watermark = max_ts - allowed_lateness_ms\n- Returns `None` until at least one event has been observed",
        starterCode:
          "class BoundedOutOfOrdernessTracker:\n    def __init__(self, allowed_lateness_ms: int):\n        self.allowed_lateness_ms = allowed_lateness_ms\n        self.max_ts = None\n    def observe(self, event_ms: int) -> None:\n        # TODO: update self.max_ts\n        pass\n    def watermark(self):\n        # TODO: return None if no events seen, else max_ts - allowed_lateness_ms\n        pass\n\nt = BoundedOutOfOrdernessTracker(allowed_lateness_ms=5_000)\nassert t.watermark() is None\nt.observe(1_000_000)\nassert t.watermark() == 995_000\nt.observe(900_000)  # late\nassert t.watermark() == 995_000\nprint('ok')\n",
        validationHint: "self.max_ts = event_ms if self.max_ts is None else max(self.max_ts, event_ms)",
        xpReward: 150,
      },
      {
        stepNumber: 4,
        title: "Stateful Aggregation",
        instruction:
          "## Stateful per-window aggregation\n\nNow combine the pieces — accept a stream of events and emit windowed counts when the watermark passes the window's end.\n\n## Task\n\nImplement `stream_aggregate(events, window_ms, allowed_lateness_ms)` that yields `(window_start, count)` tuples in window-end order.",
        starterCode:
          "from collections import defaultdict\n\ndef stream_aggregate(events, window_ms, allowed_lateness_ms):\n    \"\"\"\n    events: iterable of (event_ms, key)\n    yields: (window_start, count) pairs as windows close\n    \"\"\"\n    pending = defaultdict(int)  # window_start -> count\n    watermark = None\n    for ev_ms, _key in events:\n        wk = (ev_ms // window_ms) * window_ms\n        # TODO: update watermark, emit any windows whose end <= watermark\n        # TODO: only count events that aren't past the closed-window watermark\n        pending[wk] += 1\n    # Drain remaining windows at end-of-stream\n    for wk in sorted(pending):\n        yield wk, pending[wk]\n",
        validationHint:
          "After updating watermark, iterate sorted(pending) and pop+yield any wk where wk + window_ms <= watermark.",
        xpReward: 175,
      },
      {
        stepNumber: 5,
        title: "Exactly-Once Reasoning",
        instruction:
          "## Exactly-once is not magic\n\nFlink's exactly-once relies on **two ingredients**:\n\n1. **Checkpoints** — periodically snapshot all operator state to durable storage (S3, HDFS).\n2. **Transactional sinks** — writes to the sink are committed only when the corresponding checkpoint commits.\n\nIf the job crashes, Flink restores the last checkpoint and the sink rolls back the uncommitted writes — no duplicates, no losses.\n\n## Task\n\nWrite a 200-300 word note (Markdown) explaining:\n- Why at-least-once is easier than exactly-once\n- Why the sink must participate in the checkpoint protocol\n- One scenario where exactly-once across heterogeneous sinks (Kafka + Postgres) is harder than within Flink alone\n\nMark this step complete once you've written the note.",
        validationHint:
          "Touch on idempotent writes (UPSERT) as an alternative when the sink can't participate in a 2PC protocol.",
        xpReward: 150,
      },
    ],
  },
  {
    slug: "data-catalog-implementation",
    title: "Building a Data Catalog",
    shortDescription: "Track data assets, ownership, freshness, and column-level lineage in a queryable catalog.",
    fullDescription:
      "Every team eventually asks 'who owns this table?' and 'where does this column come from?'. Build a lightweight data catalog with a Postgres backend, lineage graph, and a Python harvester that reads dbt manifests + Airflow DAGs.",
    difficulty: "intermediate",
    estimatedMinutes: 420,
    position: 12,
    isPremium: true,
    language: "python",
    xpReward: 500,
    tags: ["metadata", "lineage", "dbt", "governance"],
    learningObjectives: [
      "Model data assets with metadata",
      "Compute upstream/downstream lineage",
      "Detect ownership gaps",
      "Surface freshness SLAs",
    ],
    techStack: ["Python", "PostgreSQL", "SQLAlchemy", "FastAPI"],
    steps: [
      {
        stepNumber: 1,
        title: "Model the Asset",
        instruction:
          "## Catalog asset model\n\nA `DataAsset` represents a table, view, or file. The minimum useful set:\n\n```\nid, name, kind ('table' | 'view' | 'file'), location, owner_team,\nupdated_at, freshness_sla_hours, tags[]\n```\n\n## Task\n\nDefine a `DataAsset` dataclass + `is_stale()` method that returns True if `updated_at` is older than `freshness_sla_hours`.",
        starterCode:
          "from dataclasses import dataclass, field\nfrom datetime import datetime, timezone, timedelta\nfrom typing import List, Literal\n\nKind = Literal['table', 'view', 'file']\n\n@dataclass\nclass DataAsset:\n    id: str\n    name: str\n    kind: Kind\n    location: str\n    owner_team: str\n    updated_at: datetime\n    freshness_sla_hours: int = 24\n    tags: List[str] = field(default_factory=list)\n\n    def is_stale(self, now: datetime | None = None) -> bool:\n        # TODO: return True if (now - updated_at) > freshness_sla_hours\n        pass\n\n# Test\nfresh = DataAsset('1','t','table','db.t','data', datetime.now(timezone.utc), 24)\nstale = DataAsset('2','t','table','db.t','data', datetime.now(timezone.utc) - timedelta(hours=48), 24)\nassert not fresh.is_stale()\nassert stale.is_stale()\nprint('ok')\n",
        validationHint: "now = now or datetime.now(timezone.utc); return now - self.updated_at > timedelta(hours=self.freshness_sla_hours)",
        xpReward: 75,
      },
      {
        stepNumber: 2,
        title: "Lineage Graph",
        instruction:
          "## Lineage as a directed graph\n\nA lineage edge says 'asset A is built from asset B'. Lineage is naturally a DAG.\n\n## Task\n\nImplement a `Lineage` class with:\n- `add_edge(downstream_id, upstream_id)`\n- `upstream(asset_id)` → set of all transitive ancestors\n- `downstream(asset_id)` → set of all transitive descendants\n\nNo external libraries — just `defaultdict(set)`.",
        starterCode:
          "from collections import defaultdict, deque\n\nclass Lineage:\n    def __init__(self):\n        self.up = defaultdict(set)    # downstream -> set(upstream)\n        self.down = defaultdict(set)  # upstream -> set(downstream)\n    def add_edge(self, downstream_id: str, upstream_id: str) -> None:\n        # TODO\n        pass\n    def upstream(self, asset_id: str) -> set:\n        # TODO: BFS over self.up\n        pass\n    def downstream(self, asset_id: str) -> set:\n        # TODO: BFS over self.down\n        pass\n\nl = Lineage()\nl.add_edge('marts.orders', 'staging.orders')\nl.add_edge('staging.orders', 'raw.orders')\nl.add_edge('marts.user_summary', 'marts.orders')\nassert l.upstream('marts.orders') == {'staging.orders', 'raw.orders'}\nassert l.downstream('raw.orders') == {'staging.orders', 'marts.orders', 'marts.user_summary'}\nprint('ok')\n",
        validationHint: "BFS from start: visited=set(); queue=[start]; while queue: n = queue.popleft(); for nb in graph[n]: if nb not in visited: visited.add(nb); queue.append(nb).",
        xpReward: 150,
      },
      {
        stepNumber: 3,
        title: "Detect Ownership Gaps",
        instruction:
          "## Find unowned assets\n\nAn 'unowned' asset has no `owner_team` set. They're risky — when something breaks, no one is paged.\n\n## Task\n\nImplement `find_unowned(assets: list[DataAsset]) -> list[str]` returning the IDs of all unowned assets, sorted.",
        starterCode:
          "def find_unowned(assets):\n    \"\"\"Return sorted list of asset IDs with empty/missing owner_team.\"\"\"\n    # TODO\n    pass\n",
        validationHint: "return sorted(a.id for a in assets if not a.owner_team)",
        xpReward: 75,
      },
      {
        stepNumber: 4,
        title: "Freshness Report",
        instruction:
          "## Freshness SLA report\n\nGiven a list of assets, produce a report grouped by team:\n```\n{ 'data':    {'total': 12, 'stale': 2, 'pct_stale': 0.17},\n  'growth':  {'total':  5, 'stale': 0, 'pct_stale': 0.0},  ... }\n```\n\n## Task\n\nImplement `freshness_report(assets) -> dict[str, dict]`.",
        starterCode:
          "from collections import defaultdict\n\ndef freshness_report(assets):\n    by_team = defaultdict(lambda: {'total': 0, 'stale': 0})\n    for a in assets:\n        team = a.owner_team or 'UNOWNED'\n        # TODO: increment total; increment stale if a.is_stale()\n        pass\n    # TODO: add pct_stale to each entry\n    return dict(by_team)\n",
        validationHint:
          "by_team[team]['total'] += 1; if a.is_stale(): by_team[team]['stale'] += 1. Then for v in by_team.values(): v['pct_stale'] = v['stale']/v['total'] if v['total'] else 0.",
        xpReward: 100,
      },
      {
        stepNumber: 5,
        title: "Impact Analysis Endpoint",
        instruction:
          "## Wire it together\n\nWrite a FastAPI endpoint `GET /assets/{id}/impact` that returns:\n```json\n{ 'asset_id': 'raw.orders',\n  'downstream': ['staging.orders', 'marts.orders', 'marts.user_summary'],\n  'team_owners': ['data', 'analytics'] }\n```\n\nUse the `Lineage` class from step 2 and a global `assets_by_id` dict for owner lookup. Mark this step complete when you can `curl http://localhost:8000/assets/raw.orders/impact` and see the JSON.",
        validationHint: "from fastapi import FastAPI, HTTPException; @app.get('/assets/{asset_id}/impact'); raise HTTPException(404) when missing.",
        xpReward: 100,
      },
    ],
  },
  {
    slug: "real-time-dashboard",
    title: "Real-Time Analytics Dashboard",
    shortDescription: "Sub-second metric queries with Redis materialized views over a Kafka event stream.",
    fullDescription:
      "Build the data layer for a real-time KPI dashboard. Events stream from Kafka, a Python consumer maintains incrementally-updated counters in Redis, and a FastAPI endpoint serves them with < 50ms latency.",
    difficulty: "advanced",
    estimatedMinutes: 540,
    position: 13,
    isPremium: true,
    language: "python",
    xpReward: 650,
    tags: ["kafka", "redis", "real-time", "dashboard"],
    learningObjectives: [
      "Maintain incremental counters",
      "Use Redis HyperLogLog for unique counts",
      "Batch writes for throughput",
      "Bucket metrics by time",
    ],
    techStack: ["Python", "Redis", "Kafka", "FastAPI"],
    steps: [
      {
        stepNumber: 1,
        title: "Time-Bucketed Counters",
        instruction:
          "## Bucket events by minute\n\nMost dashboards show 'events in the last N minutes'. Store one counter per minute bucket so range queries are cheap.\n\nKey schema: `metric:{name}:{minute_epoch}` → INCR\n\n## Task\n\nImplement `bucket_key(metric: str, ts_seconds: int) -> str` that returns the Redis key for that metric and minute bucket.",
        starterCode:
          "def bucket_key(metric: str, ts_seconds: int) -> str:\n    \"\"\"\n    metric: 'page_view'\n    ts_seconds: epoch seconds\n    Returns 'metric:page_view:<minute_epoch>'\n    \"\"\"\n    # TODO: floor ts_seconds to the minute\n    pass\n\nassert bucket_key('page_view', 1700000063) == 'metric:page_view:1700000040'\nassert bucket_key('page_view', 1700000060) == 'metric:page_view:1700000060'\nprint('ok')\n",
        validationHint: "minute = (ts_seconds // 60) * 60; return f'metric:{metric}:{minute}'",
        xpReward: 75,
      },
      {
        stepNumber: 2,
        title: "Pipelined INCRs",
        instruction:
          "## Batch writes\n\nCalling `redis.incr(key)` per event is slow — each call is a network round-trip. Use a pipeline to batch.\n\n## Task\n\nImplement `flush_batch(redis_client, batch)` where `batch` is a list of `(key, ttl_seconds)`. Use `pipeline()` to:\n1. INCR each key\n2. EXPIRE each key with the given TTL\n3. Execute the pipeline once",
        starterCode:
          "def flush_batch(redis_client, batch):\n    \"\"\"\n    batch: list of (key, ttl_seconds)\n    \"\"\"\n    if not batch:\n        return\n    pipe = redis_client.pipeline()\n    for key, ttl in batch:\n        # TODO: pipe.incr(key); pipe.expire(key, ttl)\n        pass\n    pipe.execute()\n",
        validationHint: "EXPIRE on every increment is fine — Redis treats it as 'set TTL to N from now'.",
        xpReward: 100,
      },
      {
        stepNumber: 3,
        title: "Range Query for Last N Minutes",
        instruction:
          "## Read counters across a range\n\nGiven a metric and a number of minutes, sum the per-minute counters.\n\n## Task\n\nImplement `last_n_minutes(redis_client, metric: str, n: int, now_seconds: int) -> int` that fetches the last N minute buckets via MGET and returns the sum (treating missing keys as 0).",
        starterCode:
          "def last_n_minutes(redis_client, metric, n, now_seconds):\n    minute = (now_seconds // 60) * 60\n    keys = [f'metric:{metric}:{minute - i*60}' for i in range(n)]\n    values = redis_client.mget(keys)\n    # TODO: sum values, treating None as 0; values come back as bytes/str\n    pass\n",
        validationHint: "return sum(int(v) for v in values if v is not None)",
        xpReward: 100,
      },
      {
        stepNumber: 4,
        title: "Unique Visitors with HyperLogLog",
        instruction:
          "## HLL for unique counts\n\nCounting unique users naively requires a Set per bucket — memory grows with traffic. Redis `PFADD` (HyperLogLog) gives an approximate count in **fixed 12 KB** with ~0.81% error.\n\n## Task\n\nImplement `record_unique(redis_client, metric, user_id, ts_seconds, ttl=86400)` that PFADDs the user to the bucket's HLL and sets a TTL.",
        starterCode:
          "def record_unique(redis_client, metric, user_id, ts_seconds, ttl=86400):\n    minute = (ts_seconds // 60) * 60\n    key = f'unique:{metric}:{minute}'\n    # TODO: PFADD then EXPIRE\n    pass\n\ndef unique_last_n_minutes(redis_client, metric, n, now_seconds):\n    minute = (now_seconds // 60) * 60\n    keys = [f'unique:{metric}:{minute - i*60}' for i in range(n)]\n    # TODO: PFCOUNT *keys returns the union estimate across all keys\n    pass\n",
        validationHint: "redis_client.pfadd(key, user_id); redis_client.expire(key, ttl). For union: redis_client.pfcount(*keys).",
        xpReward: 150,
      },
      {
        stepNumber: 5,
        title: "FastAPI Endpoint",
        instruction:
          "## Serve the metrics\n\nWire a FastAPI endpoint:\n```\nGET /metrics/{metric}?minutes=5\n→ { 'count': 1234, 'uniques': 482, 'minutes': 5 }\n```\n\nLatency target: p99 < 50ms (one MGET + one PFCOUNT round-trip).",
        starterCode:
          "from fastapi import FastAPI, Query\n\napp = FastAPI()\n\n@app.get('/metrics/{metric}')\ndef get_metric(metric: str, minutes: int = Query(5, ge=1, le=1440)):\n    # TODO: import time; now = int(time.time())\n    # call last_n_minutes + unique_last_n_minutes, return dict\n    pass\n",
        validationHint: "Wire up the global redis client at module load (redis.Redis(host='localhost', decode_responses=True)).",
        xpReward: 125,
      },
    ],
  },
  {
    slug: "data-mesh-design",
    title: "Data Mesh: Domain-Oriented Design",
    shortDescription: "Decentralized data ownership with self-serve infrastructure and federated governance.",
    fullDescription:
      "Design a data mesh for a hypothetical company. Define domain boundaries, design data products with SLAs and contracts, model the platform team's responsibilities, and write the governance policy that keeps it all coherent.",
    difficulty: "advanced",
    estimatedMinutes: 720,
    position: 14,
    isPremium: true,
    language: "python",
    xpReward: 900,
    tags: ["data-mesh", "architecture", "governance"],
    learningObjectives: [
      "Identify domain boundaries",
      "Design discoverable data products",
      "Specify data contracts",
      "Define federated governance",
    ],
    techStack: ["Architecture", "YAML", "Python"],
    steps: [
      {
        stepNumber: 1,
        title: "Map the Domains",
        instruction:
          "## Domain decomposition\n\nA mesh's domain boundaries should follow the business org, not the data plumbing. Common starting set for a marketplace:\n\n- `seller` — stores, listings, sellers\n- `buyer` — accounts, preferences, behavior\n- `transaction` — orders, payments, refunds\n- `marketing` — campaigns, attribution\n- `platform` — shared infra (only platform team owns this one)\n\n## Task\n\nWrite a `domains.yaml` (in your head or scratchpad) listing 4-5 domains for a SaaS company you know. For each: name, owning team, 1-line scope, 2-3 example data products (e.g. `mau_by_plan`, `subscription_changes`).\n\nMark this step complete once you've written the YAML.",
        validationHint:
          "Good test: each data product should be answerable by exactly one domain. Overlap = unclear ownership.",
        xpReward: 150,
      },
      {
        stepNumber: 2,
        title: "Data Product Contract",
        instruction:
          "## What every data product publishes\n\nA contract is a machine-readable description of a data product's interface. Minimum:\n\n- `name`, `owner_team`, `version`\n- `schema` — column names + types + nullability\n- `freshness_sla_minutes`\n- `description` per column (semantic, not technical)\n- `pii_columns: []`\n\n## Task\n\nImplement `validate_contract(contract: dict) -> list[str]` that returns a list of validation errors (empty = valid). Check that:\n1. Required top-level keys exist\n2. `version` matches semver `^\\d+\\.\\d+\\.\\d+$`\n3. Every PII column listed in `pii_columns` actually appears in `schema`",
        starterCode:
          "import re\n\nREQUIRED = {'name', 'owner_team', 'version', 'schema', 'freshness_sla_minutes', 'pii_columns'}\nSEMVER = re.compile(r'^\\d+\\.\\d+\\.\\d+$')\n\ndef validate_contract(contract: dict) -> list[str]:\n    errors = []\n    # TODO: missing required keys\n    # TODO: semver check\n    # TODO: pii_columns subset of schema column names\n    return errors\n",
        validationHint:
          "schema_cols = {c['name'] for c in contract.get('schema', [])}; bad = set(contract.get('pii_columns', [])) - schema_cols; if bad: errors.append(f'PII columns missing from schema: {bad}')",
        xpReward: 175,
      },
      {
        stepNumber: 3,
        title: "Self-Serve Platform Capabilities",
        instruction:
          "## What the platform team provides\n\nA self-serve platform reduces the cost of creating a new data product to ~hours, not weeks. Pillars:\n\n1. **Storage** — pre-provisioned warehouse schemas\n2. **Compute** — shared Spark / dbt cluster\n3. **Orchestration** — managed Airflow / Prefect\n4. **Discovery** — auto-registration in the catalog\n5. **Observability** — freshness + volume + schema-change alerts\n\n## Task\n\nWrite a 200-300 word note that argues which **one** of those 5 you'd build first if your team were 5 engineers. Explain trade-offs.",
        validationHint:
          "Hint: discovery + observability often have outsized leverage early — they reduce 'what does this column mean?' Slack thrash.",
        xpReward: 125,
      },
      {
        stepNumber: 4,
        title: "Federated Governance",
        instruction:
          "## Governance without a central bottleneck\n\nFederated governance: domains own their products, but the platform team enforces global rules.\n\nGlobal rules typically include:\n- PII columns must be tagged + accessible only via masked views\n- Tables must have an owner_team\n- Schema changes require contract version bump\n- Deprecations require 60-day notice + migration guide\n\n## Task\n\nImplement `policy_violations(catalog: list[dict]) -> list[dict]` that returns a list of `{asset_id, rule, message}` for violations. Implement at least:\n- `missing_owner` (no owner_team)\n- `untagged_pii` (column name in PII_LIKELY_NAMES not in pii_columns)\n- `no_freshness_sla` (freshness_sla_minutes missing)",
        starterCode:
          "PII_LIKELY_NAMES = {'email', 'phone', 'ssn', 'address_line1', 'tax_id', 'date_of_birth'}\n\ndef policy_violations(catalog):\n    violations = []\n    for asset in catalog:\n        aid = asset['name']\n        if not asset.get('owner_team'):\n            violations.append({'asset_id': aid, 'rule': 'missing_owner', 'message': 'no owner_team'})\n        # TODO: untagged_pii — scan schema cols vs pii_columns\n        # TODO: no_freshness_sla\n    return violations\n",
        validationHint:
          "schema_cols = {c['name'] for c in asset.get('schema', [])}; untagged = (schema_cols & PII_LIKELY_NAMES) - set(asset.get('pii_columns', []))",
        xpReward: 200,
      },
      {
        stepNumber: 5,
        title: "Mesh Adoption Roadmap",
        instruction:
          "## Sequencing the rollout\n\nMost data-mesh failures are sequencing failures, not technology failures. A common path:\n\n1. **Quarter 1** — pick 2 pilot domains; build catalog + contract validator\n2. **Quarter 2** — port their existing pipelines into the mesh; standardize ingestion\n3. **Quarter 3** — onboard 2 more domains; introduce SLA monitoring\n4. **Quarter 4** — formalize governance policy; require contracts for all new products\n\n## Task\n\nWrite a 300-500 word adoption plan tailored to a company you know (real or fictional). Identify which two domains you'd pilot and **why** (high-value + tractable, not just easy).",
        validationHint:
          "Avoid the 'finance' domain as a pilot — it usually has too much regulatory weight to move quickly.",
        xpReward: 250,
      },
    ],
  },
  {
    slug: "column-store-engine",
    title: "Build a Column-Store Engine",
    shortDescription: "Implement columnar storage from scratch — encoding, compression, and vectorized scans.",
    fullDescription:
      "Build a tiny column-store from first principles. Implement column-oriented page layout, dictionary encoding, run-length encoding, and a vectorized filter operator. By the end, your toy engine outperforms a row-store on analytical scans by 5-20x.",
    difficulty: "advanced",
    estimatedMinutes: 900,
    position: 15,
    isPremium: true,
    language: "python",
    xpReward: 1000,
    tags: ["columnar", "storage", "compression", "performance"],
    learningObjectives: [
      "Understand row vs column storage",
      "Implement dictionary encoding",
      "Implement run-length encoding (RLE)",
      "Write a vectorized filter operator",
    ],
    techStack: ["Python", "NumPy", "Storage"],
    steps: [
      {
        stepNumber: 1,
        title: "Row vs Column Layout",
        instruction:
          "## Why columnar wins for analytics\n\nA row store interleaves all columns: `[r0c0, r0c1, r0c2, r1c0, r1c1, r1c2, ...]`. Reading just `c1` still pulls in c0 and c2 from disk and into the CPU cache.\n\nA column store stores each column contiguously: `[r0c0, r1c0, r2c0, ...]` then `[r0c1, r1c1, r2c1, ...]`. A scan over `c1` reads only `c1`'s bytes.\n\n## Task\n\nImplement `to_columnar(rows: list[dict], schema: list[str]) -> dict[str, list]` that converts a list of row-dicts into a column-major layout.",
        starterCode:
          "def to_columnar(rows, schema):\n    \"\"\"\n    rows: [{'a': 1, 'b': 'x'}, ...]\n    schema: ['a', 'b']\n    Returns {'a': [...], 'b': [...]}\n    \"\"\"\n    # TODO\n    pass\n\nrows = [{'a': 1, 'b': 'x'}, {'a': 2, 'b': 'y'}]\nassert to_columnar(rows, ['a', 'b']) == {'a': [1, 2], 'b': ['x', 'y']}\nprint('ok')\n",
        validationHint: "return {col: [r[col] for r in rows] for col in schema}",
        xpReward: 100,
      },
      {
        stepNumber: 2,
        title: "Dictionary Encoding",
        instruction:
          "## Dictionary encoding\n\nFor low-cardinality string columns (country, status), replace each value with a small integer index into a dictionary. A column of 1M `'US'/'UK'/'CA'` strings collapses to 1M `int8`s + a 3-entry dictionary.\n\n## Task\n\nImplement `encode_dict(values: list)` that returns `(dictionary, codes)`. The dictionary lists distinct values in first-seen order. `codes` is a list of dictionary indices.",
        starterCode:
          "def encode_dict(values):\n    \"\"\"\n    Returns (dictionary, codes).\n    dictionary: list of distinct values in first-seen order\n    codes: list of indices into dictionary\n    \"\"\"\n    # TODO: one pass; build a value->idx dict; append idx to codes\n    pass\n\ndef decode_dict(dictionary, codes):\n    return [dictionary[c] for c in codes]\n\nd, c = encode_dict(['US', 'UK', 'US', 'CA', 'US'])\nassert d == ['US', 'UK', 'CA']\nassert c == [0, 1, 0, 2, 0]\nassert decode_dict(d, c) == ['US', 'UK', 'US', 'CA', 'US']\nprint('ok')\n",
        validationHint: "Use a dict val_to_idx; for v in values: if v not in val_to_idx: val_to_idx[v] = len(dictionary); dictionary.append(v); codes.append(val_to_idx[v]).",
        xpReward: 150,
      },
      {
        stepNumber: 3,
        title: "Run-Length Encoding",
        instruction:
          "## Run-length encoding (RLE)\n\nFor sorted or near-sorted columns, store `(value, run_length)` pairs instead of every individual value. A column of 1000 consecutive `'2024-01-01'`s becomes a single `('2024-01-01', 1000)`.\n\n## Task\n\nImplement `rle_encode(values)` and `rle_decode(runs)`.",
        starterCode:
          "def rle_encode(values):\n    \"\"\"Return list of (value, run_length) tuples.\"\"\"\n    if not values:\n        return []\n    # TODO: walk values; when value changes, emit (current, count) and reset\n    pass\n\ndef rle_decode(runs):\n    out = []\n    for v, n in runs:\n        out.extend([v] * n)\n    return out\n\nassert rle_encode(['a','a','b','b','b','c']) == [('a', 2), ('b', 3), ('c', 1)]\nassert rle_decode([('a', 2), ('b', 3)]) == ['a','a','b','b','b']\nprint('ok')\n",
        validationHint: "current, count = values[0], 1; for v in values[1:]: if v == current: count += 1 else: out.append((current, count)); current, count = v, 1; out.append((current, count)).",
        xpReward: 175,
      },
      {
        stepNumber: 4,
        title: "Vectorized Filter",
        instruction:
          "## Vectorized predicate evaluation\n\nIn a row store, you evaluate `country == 'US'` once per row in a Python loop — 100 ns per call × millions of rows = slow.\n\nIn a column store with NumPy, the same predicate runs as a single SIMD-friendly C loop.\n\n## Task\n\nGiven dictionary-encoded codes and a predicate value, return a boolean mask of which rows match.",
        starterCode:
          "import numpy as np\n\ndef filter_dict_eq(dictionary, codes, target):\n    \"\"\"\n    Return a boolean numpy array: True where codes[i] points to target.\n    \"\"\"\n    if target not in dictionary:\n        return np.zeros(len(codes), dtype=bool)\n    target_code = dictionary.index(target)\n    codes_arr = np.asarray(codes)\n    # TODO: return codes_arr == target_code\n    pass\n\nd = ['US', 'UK', 'CA']\nc = [0, 1, 0, 2, 0]\nmask = filter_dict_eq(d, c, 'US')\nassert mask.tolist() == [True, False, True, False, True]\nprint('ok')\n",
        validationHint: "Comparing the int8 codes is ~10-100x faster than comparing strings, because NumPy can use vectorized integer compare.",
        xpReward: 200,
      },
      {
        stepNumber: 5,
        title: "Page Layout & Stats",
        instruction:
          "## Pages with min/max statistics\n\nReal column stores store data in **pages** of e.g. 8K-64K values, with per-page min/max statistics. The query engine can skip an entire page if its min/max range can't satisfy the predicate.\n\n## Task\n\nImplement `make_pages(values, page_size)` returning a list of `{'min': ..., 'max': ..., 'data': [...]}` and `scan_pages(pages, lo, hi)` that returns only values from pages whose range intersects `[lo, hi]`.",
        starterCode:
          "def make_pages(values, page_size):\n    pages = []\n    for i in range(0, len(values), page_size):\n        page = values[i:i+page_size]\n        pages.append({'min': min(page), 'max': max(page), 'data': page})\n    return pages\n\ndef scan_pages(pages, lo, hi):\n    \"\"\"Yield values v where lo <= v <= hi, skipping pages whose range can't intersect.\"\"\"\n    for p in pages:\n        # TODO: skip pages whose [min, max] doesn't overlap [lo, hi]\n        # TODO: yield each v in p['data'] where lo <= v <= hi\n        pass\n\npages = make_pages(list(range(100)), page_size=10)\nresult = list(scan_pages(pages, 25, 35))\nassert result == [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35]\nprint('ok')\n",
        validationHint:
          "Skip when p['max'] < lo or p['min'] > hi. The skip is the whole point — for ordered data this is essentially free predicate filtering.",
        xpReward: 250,
      },
    ],
  },
];
