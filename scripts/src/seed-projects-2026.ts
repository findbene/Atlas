// New advanced DE projects (positions 16-17). Same shape as `extraProjects`
// in seed-projects-extra.ts; consumed by seed.ts via the same loop.
import type { ProjectData } from "./seed-projects-extra";

export const projects2026: ProjectData[] = [
  {
    slug: "iceberg-table-format",
    title: "Apache Iceberg: Tables in Object Storage",
    shortDescription:
      "Build a production-grade lakehouse table format with schema evolution, hidden partitioning, and time travel — the engine behind Netflix, Apple, and AWS Athena.",
    fullDescription:
      "Iceberg solves the problems that have haunted Hive-style tables for a decade: silent schema drift, partition-pruning gone wrong, and the inability to roll back a bad write. You'll build the core mental model — manifest lists, manifests, snapshots, the catalog — then use it to design a slowly-changing dimension that survives upstream schema changes without rewrites.",
    difficulty: "advanced",
    estimatedMinutes: 540,
    position: 16,
    isPremium: true,
    language: "python",
    xpReward: 700,
    tags: ["iceberg", "lakehouse", "table-format", "object-storage"],
    learningObjectives: [
      "Reason about the snapshot / manifest list / manifest hierarchy",
      "Use hidden partitioning instead of explicit partition columns",
      "Apply schema evolution safely (add, drop, rename, reorder)",
      "Roll back a table to a previous snapshot",
    ],
    techStack: ["PyIceberg", "Apache Iceberg", "Parquet", "MinIO / S3", "Python"],
    steps: [
      {
        stepNumber: 1,
        title: "Why Iceberg? Hive's failure modes",
        instruction:
          "## The problem Iceberg solves\n\nA Hive-style table is essentially \"a directory of Parquet files\". The 'schema' is a separate Hive Metastore entry, and there is no transactional link between the files on disk and the metastore.\n\nThis breaks in three concrete ways:\n\n1. **Silent schema drift** — a writer adds a new column. Old files don't have it, new files do. Readers may crash or silently null-fill.\n2. **Partition-prune corruption** — partitions are encoded in the directory layout. If a writer mis-spells a partition value, queries silently skip rows.\n3. **No rollback** — once a job overwrites a partition, the previous data is gone.\n\nIceberg fixes all three by treating a table as **an immutable sequence of snapshots**. Each snapshot is a complete, atomic view of the table.\n\n## Task\n\nImplement `summarise_hive_problem(events: list[dict]) -> dict` which takes a list of write events (each `{op: 'overwrite'|'append', partition: str, n_rows: int}`) and returns `{'lost_rows': int, 'overwrites': int}`:\n- `overwrites` counts events where `op == 'overwrite'`\n- `lost_rows` sums `n_rows` of any partition that was later overwritten by a subsequent event\n\nThe insight: with Hive, those rows are gone. With Iceberg, you could time-travel back.",
        starterCode:
          "def summarise_hive_problem(events):\n    overwrites = 0\n    lost_rows = 0\n    seen = {}  # partition -> rows currently 'live'\n    for e in events:\n        # TODO: implement\n        pass\n    return {'lost_rows': lost_rows, 'overwrites': overwrites}\n\nevents = [\n    {'op': 'append',    'partition': '2026-05-15', 'n_rows': 100},\n    {'op': 'append',    'partition': '2026-05-15', 'n_rows': 50},\n    {'op': 'overwrite', 'partition': '2026-05-15', 'n_rows': 80},  # loses 150\n    {'op': 'append',    'partition': '2026-05-16', 'n_rows': 10},\n]\nassert summarise_hive_problem(events) == {'lost_rows': 150, 'overwrites': 1}\nprint('ok')\n",
        validationHint:
          "Track a dict partition -> current row count. On overwrite, add the *current* value to lost_rows then replace it; on append, increment.",
        xpReward: 100,
      },
      {
        stepNumber: 2,
        title: "Snapshot tree: manifests and manifest lists",
        instruction:
          "## Iceberg's three-layer metadata\n\n```\nCatalog → metadata.json (current snapshot id, schema, partition spec)\n             ↓\n         snapshot → manifest-list (avro)\n                       ↓\n                    manifests (avro) → data files (parquet)\n```\n\nA **snapshot** is a pointer to a manifest list. A manifest list contains entries pointing at manifests. A manifest contains entries pointing at data files. This indirection is what makes appends cheap (write new manifests, reuse old ones).\n\n## Task\n\nImplement `count_live_files(snapshot)` where snapshot is a dict shaped like:\n\n```python\n{'manifests': [\n    {'added_files': [...], 'deleted_files': [...]},\n    ...\n]}\n```\n\nReturn the number of currently live (added − deleted) data files in the snapshot. Manifests already reflect adds/deletes that happened at the time of writing.",
        starterCode:
          "def count_live_files(snapshot):\n    live = 0\n    for m in snapshot['manifests']:\n        # TODO: compute added - deleted\n        pass\n    return live\n\nsnap = {'manifests': [\n    {'added_files': ['a', 'b', 'c'], 'deleted_files': ['x']},\n    {'added_files': ['d'], 'deleted_files': []},\n]}\nassert count_live_files(snap) == 3\nprint('ok')\n",
        validationHint: "live += len(m['added_files']) - len(m['deleted_files'])",
        xpReward: 125,
      },
      {
        stepNumber: 3,
        title: "Hidden partitioning",
        instruction:
          "## Why explicit partition columns are an anti-pattern\n\nIn Hive, if a table is partitioned by `event_date`, every query has to filter on `event_date` or it scans everything. Worse, if a user filters on `event_ts >= '2026-05-01'`, the engine has no way to derive the partition automatically — it scans all partitions.\n\nIceberg fixes this with **partition transforms**: the partition is *derived* from a source column. You declare `days(event_ts)` as the partition spec; queries on `event_ts` get pruned automatically.\n\n## Task\n\nImplement `partition_value(ts_ms: int, transform: str) -> str` for transforms `'hour'`, `'day'`, `'month'`, `'year'`. Use UTC. Return ISO-style: e.g. `'2026-05-15'` for day, `'2026-05'` for month, `'2026'` for year, `'2026-05-15T13'` for hour.",
        starterCode:
          "from datetime import datetime, timezone\n\ndef partition_value(ts_ms, transform):\n    dt = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)\n    # TODO: branch on transform\n    pass\n\nassert partition_value(1747315200000, 'day')   == '2025-05-15'\nassert partition_value(1747315200000, 'month') == '2025-05'\nassert partition_value(1747315200000, 'year')  == '2025'\nassert partition_value(1747315200000, 'hour')  == '2025-05-15T12'\nprint('ok')\n",
        validationHint:
          "Use strftime: '%Y-%m-%d', '%Y-%m', '%Y', '%Y-%m-%dT%H'. The point is to derive deterministically from the source column.",
        xpReward: 125,
      },
      {
        stepNumber: 4,
        title: "Safe schema evolution",
        instruction:
          "## The compatibility matrix\n\nIceberg tracks each column by a stable **field id**, not by name. This means:\n\n- **rename** a column → safe (id is preserved, old data files still read)\n- **add** a nullable column → safe (old files return NULL for it)\n- **drop** a column → safe (old files ignore it on read)\n- **reorder** columns → safe (id-based)\n- **change type** → only widening conversions (int→long, float→double, decimal precision up). Narrowing is rejected.\n\n## Task\n\nImplement `is_safe_evolution(old: dict, new: dict) -> bool`. Each schema is `{field_id: (name, type)}`. Return True iff every field id present in both schemas has a *widening* type change (or no change). Allowed widenings: `int → long`, `float → double`. Adds and drops are always safe.",
        starterCode:
          "ALLOWED_WIDENING = {('int', 'long'), ('float', 'double')}\n\ndef is_safe_evolution(old, new):\n    for fid, (name_old, type_old) in old.items():\n        if fid not in new:\n            continue  # drop is safe\n        # TODO: check the type transition\n        pass\n    return True\n\nassert is_safe_evolution({1: ('a', 'int')}, {1: ('a', 'long')}) is True\nassert is_safe_evolution({1: ('a', 'long')}, {1: ('a', 'int')}) is False\nassert is_safe_evolution({1: ('a', 'int')}, {1: ('a', 'int'), 2: ('b', 'string')}) is True\nassert is_safe_evolution({1: ('a', 'string')}, {1: ('a', 'int')}) is False\nprint('ok')\n",
        validationHint:
          "If type_old == type_new return True for that field; else require (type_old, type_new) in ALLOWED_WIDENING.",
        xpReward: 150,
      },
      {
        stepNumber: 5,
        title: "Time travel and rollback",
        instruction:
          "## You can undo a bad write\n\nBecause each write is a new snapshot, and old snapshots are kept (until garbage collected), you can:\n\n```sql\n-- Read the table as of yesterday\nSELECT * FROM orders FOR TIMESTAMP AS OF '2026-05-14 00:00:00';\n-- Or revert to a known-good snapshot\nCALL system.rollback_to_snapshot('orders', 5293142583132);\n```\n\nThis is why every serious lakehouse stack now uses Iceberg or its cousins (Delta, Hudi).\n\n## Task\n\nImplement `find_rollback_target(snapshots, bad_after_ts)` returning the snapshot id of the latest snapshot whose `committed_ms <= bad_after_ts`. `snapshots` is a list of `{id, committed_ms}` sorted oldest-first. Return `None` if no snapshot qualifies.",
        starterCode:
          "def find_rollback_target(snapshots, bad_after_ts):\n    # TODO: walk snapshots, return id of last one with committed_ms <= bad_after_ts\n    pass\n\nsnaps = [\n    {'id': 'a', 'committed_ms': 100},\n    {'id': 'b', 'committed_ms': 200},\n    {'id': 'c', 'committed_ms': 350},  # the 'bad' write\n    {'id': 'd', 'committed_ms': 400},\n]\nassert find_rollback_target(snaps, 300) == 'b'\nassert find_rollback_target(snaps, 50) is None\nprint('ok')\n",
        validationHint:
          "target = None; for s in snapshots: if s['committed_ms'] <= bad_after_ts: target = s['id']; return target",
        xpReward: 200,
      },
    ],
  },
  {
    slug: "debezium-cdc",
    title: "Change Data Capture with Debezium",
    shortDescription:
      "Stream every row-level change out of Postgres in real time using logical replication — the foundation of every modern event-driven architecture.",
    fullDescription:
      "Instead of polling tables every 5 minutes (which misses deletes, doubles your DB load, and lags reality), Debezium reads the WAL directly and emits one Kafka event per row change. You'll learn the LSN protocol, design idempotent downstream consumers, and handle the operational landmines (snapshots, schema changes, slot-bloat).",
    difficulty: "advanced",
    estimatedMinutes: 540,
    position: 17,
    isPremium: true,
    language: "python",
    xpReward: 700,
    tags: ["cdc", "debezium", "kafka", "postgres", "streaming"],
    learningObjectives: [
      "Understand logical replication slots and LSN ordering",
      "Decode Debezium envelopes (before/after/op)",
      "Build idempotent CDC consumers using primary keys",
      "Diagnose and prevent replication slot bloat",
    ],
    techStack: ["Debezium", "Kafka", "PostgreSQL WAL", "Python", "Avro"],
    steps: [
      {
        stepNumber: 1,
        title: "Why polling is wrong",
        instruction:
          "## Polling loses information\n\nThe naive approach: `SELECT * FROM orders WHERE updated_at > :last_poll` every 5 minutes. This breaks in three ways:\n\n1. **Deletes are invisible.** A row that was deleted between two polls just... vanishes.\n2. **Multi-update collapse.** If a row is updated 4 times between polls, you only see the final state — you've lost the intermediate history.\n3. **DB pressure.** Every poll is a full index scan against a hot OLTP table.\n\nLogical replication solves all three: it gives you every row event, in commit order, from the WAL.\n\n## Task\n\nImplement `lost_events(rows_before, rows_after) -> int` that returns how many *change events* a poll-based approach would miss between two snapshots. Each row dict has an `id` and an `update_count` (number of times changed since the last poll).\n\n- A row that exists in both: missed = `update_count - 1` (only the final state observed)\n- A row in `before` but not `after`: missed = `1` (the delete is invisible)\n- A row in `after` but not `before`: missed = `update_count - 1` (only the final state observed)",
        starterCode:
          "def lost_events(rows_before, rows_after):\n    before = {r['id']: r for r in rows_before}\n    after = {r['id']: r for r in rows_after}\n    lost = 0\n    # TODO: compute losses per case\n    return lost\n\nbefore = [{'id': 1, 'update_count': 0}, {'id': 2, 'update_count': 0}]\nafter = [{'id': 1, 'update_count': 3}, {'id': 3, 'update_count': 2}]\n# row 1: 2 missed updates. row 2: deleted (1 lost). row 3: 1 missed (2-1).\nassert lost_events(before, after) == 4\nprint('ok')\n",
        validationHint:
          "For each id in (before & after): lost += max(after[id]['update_count'] - 1, 0). For id only in before: lost += 1. For id only in after: lost += max(uc-1, 0).",
        xpReward: 100,
      },
      {
        stepNumber: 2,
        title: "LSN ordering",
        instruction:
          "## The Log Sequence Number\n\nEvery change in Postgres's WAL has an **LSN** (Log Sequence Number) — a monotonic 64-bit cursor. Format: `'0/16B3748'` (two hex words separated by `/`). The first word is the file segment, the second is the byte offset.\n\nDebezium uses the LSN to:\n- Resume from exactly where it left off after a crash\n- Guarantee per-table ordering matches DB commit order\n\n## Task\n\nImplement `lsn_to_int(lsn: str) -> int` that converts `'0/16B3748'` to a single integer suitable for comparison. The upper 32 bits are the first hex word, the lower 32 bits are the second.",
        starterCode:
          "def lsn_to_int(lsn):\n    # TODO: split on '/', parse each as hex, combine as (hi << 32) | lo\n    pass\n\nassert lsn_to_int('0/0') == 0\nassert lsn_to_int('0/16B3748') == 0x16B3748\nassert lsn_to_int('1/0') == 1 << 32\nassert lsn_to_int('1/16B3748') == (1 << 32) | 0x16B3748\nassert lsn_to_int('1/A') > lsn_to_int('0/FFFFFFFF')\nprint('ok')\n",
        validationHint: "hi, lo = lsn.split('/'); return (int(hi, 16) << 32) | int(lo, 16)",
        xpReward: 125,
      },
      {
        stepNumber: 3,
        title: "Decode the Debezium envelope",
        instruction:
          "## What a Debezium message looks like\n\n```json\n{\n  \"payload\": {\n    \"before\": {\"id\": 7, \"status\": \"pending\", \"amount\": 100},\n    \"after\":  {\"id\": 7, \"status\": \"paid\",    \"amount\": 100},\n    \"op\": \"u\",\n    \"source\": {\"lsn\": 23984723, \"ts_ms\": 1715800000000, \"table\": \"orders\"}\n  }\n}\n```\n\n- `op`: `c` (create), `u` (update), `d` (delete), `r` (read — initial snapshot)\n- `before` is null for `c`/`r`; `after` is null for `d`\n\n## Task\n\nImplement `flatten(msg)` that returns a flat dict suitable for an analytics warehouse:\n\n```python\n{'op': 'u', 'pk': 7, 'lsn': 23984723, 'ts_ms': 1715800000000, 'data': {'id': 7, 'status': 'paid', 'amount': 100}}\n```\n\n- `pk` comes from `after.id` (or `before.id` for deletes)\n- `data` is `after` (or `before` for deletes)",
        starterCode:
          "def flatten(msg):\n    p = msg['payload']\n    op = p['op']\n    # TODO: derive pk and data based on op\n    pass\n\nmsg = {'payload': {\n    'before': {'id': 7, 'status': 'pending'},\n    'after':  {'id': 7, 'status': 'paid'},\n    'op': 'u',\n    'source': {'lsn': 999, 'ts_ms': 1000, 'table': 'orders'},\n}}\nresult = flatten(msg)\nassert result == {'op': 'u', 'pk': 7, 'lsn': 999, 'ts_ms': 1000, 'data': {'id': 7, 'status': 'paid'}}, result\n\ndelete = {'payload': {\n    'before': {'id': 7, 'status': 'paid'},\n    'after': None,\n    'op': 'd',\n    'source': {'lsn': 1000, 'ts_ms': 2000, 'table': 'orders'},\n}}\nassert flatten(delete)['pk'] == 7\nassert flatten(delete)['data']['status'] == 'paid'\nprint('ok')\n",
        validationHint:
          "data = p['before'] if op == 'd' else p['after']; pk = data['id']; return {'op': op, 'pk': pk, 'lsn': p['source']['lsn'], 'ts_ms': p['source']['ts_ms'], 'data': data}",
        xpReward: 150,
      },
      {
        stepNumber: 4,
        title: "Idempotent consumer",
        instruction:
          "## At-least-once means duplicates\n\nKafka guarantees at-least-once delivery. After a consumer restart, you may re-process the same message. You need **idempotent writes** in the sink.\n\nThe standard pattern: keep a per-row `last_seen_lsn`. Apply a change only if `event.lsn > last_seen_lsn[event.pk]`.\n\n## Task\n\nImplement `Sink` that:\n- `.apply(event)` applies the event if it's newer than what we've seen for that pk; returns `True` if applied, `False` if skipped\n- `.snapshot()` returns the current state as `{pk: latest_data}` (deletes remove the pk)\n\nEvents look like `{'op': 'u'|'c'|'d', 'pk': int, 'lsn': int, 'data': dict}`.",
        starterCode:
          "class Sink:\n    def __init__(self):\n        self.state = {}     # pk -> data\n        self.last_lsn = {}  # pk -> lsn\n    def apply(self, event):\n        pk = event['pk']\n        # TODO: skip if event['lsn'] <= self.last_lsn.get(pk, -1)\n        # TODO: on 'd', remove pk from state; else set state[pk] = event['data']\n        # TODO: update last_lsn[pk]\n        pass\n    def snapshot(self):\n        return dict(self.state)\n\ns = Sink()\nassert s.apply({'op': 'c', 'pk': 1, 'lsn': 10, 'data': {'id': 1, 'v': 'a'}}) is True\nassert s.apply({'op': 'c', 'pk': 1, 'lsn': 10, 'data': {'id': 1, 'v': 'a'}}) is False  # duplicate\nassert s.apply({'op': 'u', 'pk': 1, 'lsn': 20, 'data': {'id': 1, 'v': 'b'}}) is True\nassert s.apply({'op': 'u', 'pk': 1, 'lsn': 15, 'data': {'id': 1, 'v': 'stale'}}) is False\nassert s.snapshot() == {1: {'id': 1, 'v': 'b'}}\nassert s.apply({'op': 'd', 'pk': 1, 'lsn': 30, 'data': {'id': 1}}) is True\nassert s.snapshot() == {}\nprint('ok')\n",
        validationHint:
          "Check event['lsn'] > self.last_lsn.get(pk, -1) before mutating. Track last_lsn even after a delete so a late update can't 'resurrect'.",
        xpReward: 175,
      },
      {
        stepNumber: 5,
        title: "Slot bloat: the operational landmine",
        instruction:
          "## Why CDC can take down your DB\n\nA logical replication slot tells Postgres: 'Do not recycle WAL files until I've consumed past LSN X.' If the consumer stalls (network partition, slow downstream, dead worker), WAL accumulates *forever* — eventually filling the disk and crashing the DB.\n\nProduction CDC monitoring must alert on:\n- **Slot lag in bytes** above a threshold (typical: 1 GB)\n- **Slot age** older than N minutes\n\n## Task\n\nImplement `is_slot_unhealthy(slot, current_lsn_int, now_ms)`. The slot dict has `confirmed_flush_lsn_int` and `last_advance_ms`. A slot is unhealthy if EITHER:\n- `current_lsn_int - confirmed_flush_lsn_int > 1_000_000_000` (>1 GB behind)\n- `now_ms - last_advance_ms > 600_000` (slot hasn't advanced in >10 minutes)\n\nReturn `True` if unhealthy.",
        starterCode:
          "LAG_THRESHOLD_BYTES = 1_000_000_000\nSTALENESS_THRESHOLD_MS = 600_000\n\ndef is_slot_unhealthy(slot, current_lsn_int, now_ms):\n    # TODO: return True if either threshold is breached\n    pass\n\nhealthy = {'confirmed_flush_lsn_int': 1_000, 'last_advance_ms': 1_000_000}\nassert is_slot_unhealthy(healthy, current_lsn_int=2_000, now_ms=1_000_100) is False\n\nbig_lag = {'confirmed_flush_lsn_int': 0, 'last_advance_ms': 1_000_000}\nassert is_slot_unhealthy(big_lag, current_lsn_int=2_000_000_000, now_ms=1_000_100) is True\n\nstale = {'confirmed_flush_lsn_int': 1_000, 'last_advance_ms': 0}\nassert is_slot_unhealthy(stale, current_lsn_int=1_001, now_ms=700_000) is True\nprint('ok')\n",
        validationHint:
          "return (current_lsn_int - slot['confirmed_flush_lsn_int']) > LAG_THRESHOLD_BYTES or (now_ms - slot['last_advance_ms']) > STALENESS_THRESHOLD_MS",
        xpReward: 200,
      },
    ],
  },
];
