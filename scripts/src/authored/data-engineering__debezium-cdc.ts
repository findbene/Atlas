/**
 * Phase 9 — batch-1 upgrade. data-engineering / Debezium CDC foundations.
 * Synthetic candidate 0a2e73a8-abd8-41a1-b74c-e7de3fcb3acc (source=phase9_upgrade).
 *
 * Distinct from the Phase-7 `data-engineering-cdc-debezium` (which focuses on
 * Snowflake sink + dbt + reconciliation). This module focuses on the WAL/LSN
 * fundamentals and idempotent consumer mechanics.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const dataEngineeringDebeziumCdc: AuthoredProject = {
  slug: "data-engineering-debezium-cdc",
  candidateId: "0a2e73a8-abd8-41a1-b74c-e7de3fcb3acc",
  title: "Debezium CDC — Postgres WAL, LSN Ordering, and Idempotent Consumers",
  shortDescription:
    "The CDC fundamentals every modern DE needs: why polling is broken, how LSN ordering works, decoding the Debezium envelope, building idempotent sinks, and detecting slot-bloat before it crashes your DB.",
  fullDescription:
    "Polling-based ETL loses deletes, masks intermediate updates, and hammers your OLTP DB. Debezium reads Postgres's WAL directly and emits one Kafka event per row change. You'll build the mental model from the protocol up — LSN cursors, Debezium envelopes, idempotent consumers via `last_seen_lsn` — then implement the production landmine every CDC owner trips over: replication slot bloat that fills the disk.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Debezium", "Kafka", "PostgreSQL WAL", "Python", "Avro"],
  tags: ["cdc", "debezium", "kafka", "postgres", "streaming", "idempotency"],
  learningObjectives: [
    "Quantify the data loss in polling-based 'CDC' across the three failure modes (deletes, multi-updates, DB pressure).",
    "Parse Postgres LSN strings (`'1/16B3748'`) into comparable integers.",
    "Decode the Debezium envelope (op / before / after / source) into flat warehouse-ready rows.",
    "Implement at-most-once idempotency via per-row LSN watermarks for crash-tolerant sinks.",
    "Diagnose and alert on replication slot lag (bytes and staleness) before WAL accumulation crashes the DB.",
  ],
  estimatedMinutes: 540,
  xpReward: 700,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "You inherit a 5-minute polling job feeding Snowflake from a Postgres orders table. Finance reports deletes are 'missing' and intermediate statuses never appear. The fix is CDC — but the previous attempt brought down the primary with slot bloat.",
    hiringRelevance2026:
      "Every senior DE interview in 2026 asks about CDC. LSN math, Debezium envelopes, and slot-bloat alerting are the three sub-topics that come up cold; this project drills them in code.",
    readmeOutline: [
      "Overview & Scenario", "Polling failure modes (3 cases)",
      "Step 1 lost events math", "Step 2 LSN protocol",
      "Step 3 envelope decode", "Step 4 idempotent consumer",
      "Step 5 slot bloat detection",
      "Validation", "Operational runbook", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "GitHub repo with the pure-Python LSN parser, envelope decoder, idempotent Sink class, and slot-health probe; plus a `docker-compose` with Postgres + Debezium Connect that lets a reviewer trigger every failure mode the steps describe.",
    portfolioRelevance:
      "Showing you can REASON about the WAL protocol, not just configure a connector via YAML, is the senior-DE signal. The slot-bloat probe especially — most candidates have never thought about it.",
    repoUrl: "https://github.com/<your-handle>/debezium-cdc-foundations",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Quantify polling losses",
      instructionMd:
        "Implement `lost_events(before, after)` that counts the events a 5-minute poll would miss: deletes (rows in before but not in after), and missed intermediate updates (sum of `update_count` deltas for rows in both). Validator drives with a controlled scenario.",
      learningObjective: "Make polling's data loss concrete — not theoretical.",
      requiredSkill: "Set ops over row dicts + update-count arithmetic",
      starterCode: SRC(`def lost_events(rows_before, rows_after):
    before = {r['id']: r for r in rows_before}
    after  = {r['id']: r for r in rows_after}
    lost = 0
    # TODO: for id in before: if id not in after → lost += 1
    # TODO: for id in before & after: lost += max(0, after[id]['update_count'] - before[id]['update_count'] - 1)
    # TODO: new rows in after only → not lost; we WILL see them next poll
    return lost
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "before=[{id:1,update_count:0},{id:2,update_count:0}], after=[{id:1,update_count:3},{id:3,update_count:2}] → 4 lost (row1 2 updates missed, row2 deleted, row3 1 update missed).", {
        before: [{ id: 1, update_count: 0 }, { id: 2, update_count: 0 }],
        after: [{ id: 1, update_count: 3 }, { id: 3, update_count: 2 }],
        expectedLost: 4,
      }),
      expectedOutputs: { lost: 4 },
      datasetRefs: ["fixtures/polling_loss_scenario.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Three loss modes: (a) deletes invisible, (b) multi-update collapse, (c) row created+deleted within window invisible.",
          "Multi-update math: if a row had 0 updates and now has 3, you saw 1 final value — 2 intermediate updates lost.",
          "New rows that exist in after but not before are NOT lost (you'll see them next poll); only updates between polls vanish.",
          "Build a dict by id for O(1) lookup; set ops over keys give you the missing/new/common partitions.",
          "Reference: lost = sum(1 for id in before if id not in after) + sum(max(0, after[id]['update_count']-before[id]['update_count']-1) for id in before if id in after).",
        ],
        successFeedback: "You've put a number on the cost of polling. Now you can show stakeholders 'CDC migration recovers ~4% of order events we currently lose'.",
        failureFeedback: "Common slips: counted new rows as lost (they're not); counted final updates as lost (only intermediates are); off-by-one in the -1 (you saw the final state, so subtract 1).",
        portfolioRelevance: "The ability to QUANTIFY a CDC migration's business value (vs. just 'lower latency') is the senior signal. Stakeholders fund the project this conversation justifies.",
        finalExplanation: "Polling collapses time — every event between polls is invisible. CDC preserves the temporal granularity of the source DB.",
        misconceptionToWatchFor: "Believing 'we just need shorter poll intervals'. At 1-minute polls you still lose anything between sub-1-minute updates, and you've quadrupled DB load. The architecture is wrong, not the parameter.",
      }),
    },
    {
      stepNumber: 2,
      title: "LSN ordering",
      instructionMd:
        "Postgres LSNs are 64-bit cursors formatted as `'<hi_hex>/<lo_hex>'`. Implement `lsn_to_int(lsn)` so comparable LSNs become comparable integers — Debezium uses these to resume from exactly where it crashed.",
      learningObjective: "Operate on the Postgres LSN protocol at the bit level.",
      requiredSkill: "Hex parsing + 64-bit integer composition",
      starterCode: SRC(`def lsn_to_int(lsn):
    # TODO: hi, lo = lsn.split('/'); return (int(hi, 16) << 32) | int(lo, 16)
    pass
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "lsn_to_int across 5 representative LSNs returns the correct comparable 64-bit ints.", {
        inputs: ["0/0", "0/16B3748", "1/0", "1/16B3748", "1/A"],
        expected: [0, 23803720, 4294967296, 4318771016, 4294967306],
      }),
      expectedOutputs: { parsedLsns: 5, monotonicWhenSorted: true },
      datasetRefs: ["fixtures/lsn_examples.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "LSN format: '<hi_hex>/<lo_hex>'. Both halves are hex, no '0x' prefix.",
          "Combine: int(hi,16) << 32 gets you the high 32 bits in place; OR in the low half.",
          "Watch for case: '0/16B3748' and '0/16b3748' must produce the same int. Python int(s,16) is already case-insensitive.",
          "Test the wrap: '1/0' must be larger than '0/FFFFFFFF'. If yours isn't, you're using addition instead of shift+OR.",
          "Reference: hi, lo = lsn.split('/'); return (int(hi, 16) << 32) | int(lo, 16).",
        ],
        successFeedback: "You can now diff two LSNs to get a byte count — the foundation of every CDC lag dashboard.",
        failureFeedback: "Common slips: parsed as decimal (wildly wrong); used addition instead of shift+OR (collisions near segment boundaries); forgot to strip whitespace.",
        portfolioRelevance: "Senior DEs are expected to know the LSN protocol cold. 'I parse it as a 64-bit int' is a green-flag answer in CDC interviews.",
        finalExplanation: "LSNs are monotonic byte offsets into the WAL. Treating them as integers makes lag, restart points, and ordering trivial to reason about.",
        misconceptionToWatchFor: "Comparing LSN strings lexicographically. Works until the hex digit count changes (e.g. '0/F' vs '0/10').",
      }),
    },
    {
      stepNumber: 3,
      title: "Decode the Debezium envelope",
      instructionMd:
        "Debezium emits `{payload: {before, after, op, source: {lsn, ts_ms, table}}}`. Implement `flatten(msg)` returning `{op, pk, lsn, ts_ms, data}` — `pk` from `after.id` (or `before.id` for deletes), `data` from `after` (or `before` for deletes).",
      learningObjective: "Translate Debezium envelopes into flat warehouse-ready rows including the DELETE branch.",
      requiredSkill: "Envelope schema literacy + null handling across op types",
      starterCode: SRC(`def flatten(msg):
    p = msg['payload']
    op = p['op']  # 'c' create, 'u' update, 'd' delete, 'r' read=snapshot
    # TODO: for op in ('c','u','r'): pk = p['after']['id']; data = p['after']
    # TODO: for op == 'd': pk = p['before']['id']; data = p['before']
    # return {'op': op, 'pk': pk, 'lsn': p['source']['lsn'], 'ts_ms': p['source']['ts_ms'], 'data': data}
    pass
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Update event produces correct flat row; delete event still has pk and data populated from `before`.", {
        update: { payload: { before: { id: 7, status: "pending" }, after: { id: 7, status: "paid" }, op: "u", source: { lsn: 999, ts_ms: 1000, table: "orders" } } },
        delete: { payload: { before: { id: 7, status: "paid" }, after: null, op: "d", source: { lsn: 1000, ts_ms: 2000, table: "orders" } } },
        expectedUpdate: { op: "u", pk: 7, lsn: 999, ts_ms: 1000, data: { id: 7, status: "paid" } },
        expectedDeletePk: 7,
        expectedDeleteData: { id: 7, status: "paid" },
      }),
      expectedOutputs: { updateOk: true, deleteOk: true },
      datasetRefs: ["fixtures/debezium_envelopes.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "op codes: 'c'reate, 'u'pdate, 'd'elete, 'r'ead (initial snapshot). Treat 'r' identically to 'c' downstream.",
          "Deletes have after=null. If you read p['after']['id'] for a delete, you crash. Branch on op first.",
          "Source dict carries the LSN and ts_ms you need for ordering and lag computation; don't ignore it.",
          "Optional: handle tombstones (op==null with a null payload) — Debezium emits these after a delete if `tombstones.on.delete=true`. Filter them out at the top.",
          "Reference: if op == 'd': pk, data = p['before']['id'], p['before']; else: pk, data = p['after']['id'], p['after'].",
        ],
        successFeedback: "Your decoder handles every Debezium op cleanly. Downstream code can stop branching on op for the common path.",
        failureFeedback: "Common slips: indexed p['after'] for deletes (NoneType crash); dropped the source.lsn (lose ordering downstream); included the schema field (huge, redundant — strip it at the decoder).",
        portfolioRelevance: "Recruiters know the envelope is where most CDC implementations have bugs. A clean decoder with full op coverage is a clear seniority signal.",
        finalExplanation: "The Debezium envelope is the contract between PG and your sink. Treat it as the schema and decode defensively — sources of change can be added (rename, truncate) without breaking your code.",
        misconceptionToWatchFor: "Hardcoding `after['id']` as the PK. Composite PKs need a tuple key; some tables don't have an id column at all.",
      }),
    },
    {
      stepNumber: 4,
      title: "Idempotent consumer with last-seen LSN",
      instructionMd:
        "Kafka is at-least-once. After a consumer restart you may re-process the same message. Implement `Sink` with `apply(event)` (returns True if applied, False if skipped) and `snapshot()` (returns `{pk: data}`). Track `last_lsn[pk]` and skip events with `event.lsn <= last_lsn[pk]`. Deletes remove the pk from state.",
      learningObjective: "Build at-most-once semantics on top of at-least-once delivery using per-row LSN watermarks.",
      requiredSkill: "Per-key watermarks + state-machine sink semantics",
      starterCode: SRC(`class Sink:
    def __init__(self):
        self.state = {}     # pk -> data
        self.last_lsn = {}  # pk -> lsn
    def apply(self, event):
        pk = event['pk']
        # TODO: if event['lsn'] <= self.last_lsn.get(pk, -1): return False
        # TODO: if event['op'] == 'd': self.state.pop(pk, None) else: self.state[pk] = event['data']
        # TODO: self.last_lsn[pk] = event['lsn']; return True
        pass
    def snapshot(self):
        return dict(self.state)
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Sequence: create(lsn=10), duplicate create(lsn=10), update(lsn=20), stale update(lsn=15), delete(lsn=30). Final state empty; apply returns [True, False, True, False, True].", {
        events: [
          { op: "c", pk: 1, lsn: 10, data: { v: "a" } },
          { op: "c", pk: 1, lsn: 10, data: { v: "a" } },
          { op: "u", pk: 1, lsn: 20, data: { v: "b" } },
          { op: "u", pk: 1, lsn: 15, data: { v: "stale" } },
          { op: "d", pk: 1, lsn: 30, data: { v: "b" } },
        ],
        expectedApplied: [true, false, true, false, true],
        expectedFinalState: {},
      }),
      expectedOutputs: { applied: [true, false, true, false, true], finalEmpty: true },
      datasetRefs: ["fixtures/debezium_sink_sequence.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Use `last_lsn.get(pk, -1)` so the first event for a pk always applies (no special-case for missing keys).",
          "STRICT inequality (`<=`) on duplicate detection: same LSN means same event we've already processed.",
          "Deletes must update last_lsn AND clear state[pk] — otherwise a late update for the deleted pk re-creates it.",
          "Persist last_lsn alongside state so crash recovery resumes correctly. In-memory dict is fine for the lab; production uses RocksDB or the sink's own row.",
          "Reference: if event['lsn'] <= self.last_lsn.get(pk, -1): return False; ...; self.last_lsn[pk] = event['lsn']; return True.",
        ],
        successFeedback: "Your sink is now crash-safe: Kafka can replay the last hour and you'll converge on the same state with no duplicates.",
        failureFeedback: "Common slips: forgot to update last_lsn for deletes (zombie rows on replay); used `<` instead of `<=` (same LSN replays); didn't clear state on delete (state grows).",
        portfolioRelevance: "Idempotent sinks are THE foundation of streaming reliability. Senior interviewers ask 'how do you handle replays?' and this is the textbook answer.",
        finalExplanation: "At-most-once + at-least-once = exactly-once at the application layer. Per-row LSN watermarks are the cheapest implementation.",
        misconceptionToWatchFor: "Trying to make Kafka itself exactly-once via transactions. Even then you need idempotent sinks for the cross-system guarantee.",
      }),
    },
    {
      stepNumber: 5,
      title: "Slot bloat: the operational landmine",
      instructionMd:
        "If a consumer stalls, Postgres won't recycle WAL — eventually filling the disk. Implement `is_slot_unhealthy(slot, current_lsn_int, now_ms)` returning True when either: lag bytes > 1 GB, or last_advance_ms > 10 min ago.",
      learningObjective: "Build the operational probe that catches slot bloat before it crashes the source DB.",
      requiredSkill: "Threshold-based alerting + Postgres replication-slot metadata",
      starterCode: SRC(`LAG_THRESHOLD_BYTES = 1_000_000_000
STALENESS_THRESHOLD_MS = 600_000

def is_slot_unhealthy(slot, current_lsn_int, now_ms):
    # TODO: lag = current_lsn_int - slot['confirmed_flush_lsn_int']
    # TODO: stale_ms = now_ms - slot['last_advance_ms']
    # TODO: return lag > LAG_THRESHOLD_BYTES or stale_ms > STALENESS_THRESHOLD_MS
    pass
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Healthy slot → False; 2GB-behind slot → True; 10-minute-stale slot → True.", {
        cases: [
          { name: "healthy", slot: { confirmed_flush_lsn_int: 1000, last_advance_ms: 1000000 }, current: 2000, now: 1000100, expected: false },
          { name: "lag",     slot: { confirmed_flush_lsn_int: 0,    last_advance_ms: 1000000 }, current: 2000000000, now: 1000100, expected: true },
          { name: "stale",   slot: { confirmed_flush_lsn_int: 1000, last_advance_ms: 0 },       current: 1001, now: 700000,        expected: true },
        ],
      }),
      expectedOutputs: { healthyCase: false, lagCase: true, staleCase: true },
      datasetRefs: ["fixtures/slot_health_cases.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Both thresholds matter: lag alone misses a stuck slot at low traffic; staleness alone misses a stuck slot under high traffic.",
          "Read slot metadata from pg_replication_slots: `confirmed_flush_lsn`, `pg_current_wal_lsn`. Diff is bytes-behind.",
          "1 GB / 10 min are starter thresholds — tune to your disk headroom and traffic patterns.",
          "Wire this into your monitoring as a probe that exposes a single boolean per slot. Alert when False → True transition.",
          "Reference: SELECT slot_name, pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn) AS lag_bytes, EXTRACT(EPOCH FROM now() - confirmed_flush_time)*1000 AS stale_ms FROM pg_replication_slots;",
        ],
        successFeedback: "You ship the probe most CDC owners forget. The first time it fires, you save the team a 2am page.",
        failureFeedback: "Common slips: only checked lag (misses stuck-at-low-traffic); only checked staleness (misses fast-burst stuck); used absolute time instead of delta (TZ bugs).",
        portfolioRelevance: "Slot bloat is THE production CDC failure mode. 'I built a probe + Grafana alert for it' is a clear senior-DE differentiator.",
        finalExplanation: "Operational safety nets distinguish hobby CDC from production CDC. The protocol is the easy part; the operations is what gets you paged.",
        misconceptionToWatchFor: "Believing the connector's own metrics are enough. They don't measure the SOURCE DB's WAL pressure, which is what actually fills the disk.",
      }),
    },
  ],
};
