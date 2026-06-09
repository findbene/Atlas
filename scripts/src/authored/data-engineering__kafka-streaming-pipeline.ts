/**
 * Phase 12B — data-engineering (skeleton rebuild).
 * Candidate c3142df9-24ab-4055-9789-819203142536 — Kafka streaming pipeline
 * with exactly-once semantics: idempotent producer, transactional read-process-
 * write, consumer rebalance, Schema Registry evolution, DLQ + observability.
 *
 * Legacy: `kafka-streaming-pipeline` (1-step skeleton, score 49.2). Full rebuild.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const dataEngineeringKafkaStreamingPipeline: AuthoredProject = {
  slug: "data-engineering-kafka-streaming-pipeline",
  candidateId: "c3142df9-24ab-4055-9789-819203142536",
  title: "Kafka Streaming Pipeline — Exactly-Once + Schema Evolution + DLQ",
  shortDescription:
    "Build a production Kafka pipeline that delivers exactly-once between two topics through a transactional read-process-write loop, evolves an Avro schema without breaking consumers, and routes poison messages to a DLQ with bounded retry.",
  fullDescription:
    "Most Kafka pipelines say 'exactly-once' and mean 'at-least-once with retries' — which is at-least-twice the moment a partition rebalances mid-batch. You'll wire the full EOS contract: idempotent producer + transactional consume-transform-produce + offset-as-part-of-the-transaction. Then you'll evolve an Avro schema the right way (forward+backward compat via Schema Registry), and add a DLQ that catches poison records without stalling the consumer group. The final pipeline is testable, recoverable, and observable.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "kafka", "confluent-kafka", "avro", "schema-registry", "docker", "prometheus"],
  tags: ["kafka", "streaming", "exactly-once", "avro", "schema-evolution", "dlq", "observability"],
  learningObjectives: [
    "Configure an idempotent + transactional producer for true exactly-once writes.",
    "Implement a consume-transform-produce loop where offsets are part of the transaction.",
    "Handle consumer-group rebalances without losing in-flight work or double-processing.",
    "Evolve Avro schemas with full backward + forward compatibility via Schema Registry.",
    "Route poison records to a DLQ with bounded retry + structured failure metadata.",
  ],
  estimatedMinutes: 240,
  xpReward: 760,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "DE on a 5-person platform team. Orders flow through a Kafka topic feeding a billing service; a recent partition-rebalance event triple-charged 1.2% of orders and the incident cost the company a week. You're rebuilding the pipeline to actually deliver exactly-once and make the next rebalance a non-event.",
    hiringRelevance2026:
      "Kafka EOS + Schema Registry evolution is the most-asked streaming interview area. Knowing the producer/consumer config matrix cold separates senior DEs from middle.",
    readmeOutline: [
      "Overview & Incident Postmortem", "Architecture (producer/consumer/SR/DLQ)",
      "Step 1 idempotent producer", "Step 2 read-process-write EOS", "Step 3 rebalance safety",
      "Step 4 Avro schema evolution", "Step 5 DLQ + observability", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo: docker-compose with Kafka + Schema Registry + Prometheus, a producer service, a transactional EOS consumer, a DLQ consumer, and a chaos test script that triggers a rebalance mid-batch + proves no duplicates land downstream. Includes a 10k-msg load test + grafana dashboard.",
    portfolioRelevance:
      "A reproducible EOS-with-rebalance-chaos-test repo is rare. Reviewers love seeing the failure injected and the contract still held.",
    repoUrl: "https://github.com/<your-handle>/kafka-streaming-pipeline",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Idempotent producer — enable.idempotence + acks=all + max.in.flight",
      instructionMd:
        "Configure a `confluent_kafka.Producer` with `enable.idempotence=true`, `acks=all`, `max.in.flight.requests.per.connection=5`, `retries=Integer.MAX_VALUE`. Write 1000 orders to topic `orders.raw` partition 0 while a chaos script restarts the broker leader mid-write. Self-verify: all 1000 distinct order_ids present in the topic exactly once (no duplicates from producer retries, no gaps from acks=1 silent drops).",
      learningObjective: "Idempotence at the producer is the foundation of EOS — without it, a retried batch becomes a duplicate batch on the broker.",
      requiredSkill: "Kafka producer config matrix + the acks/idempotence/retries interaction",
      starterCode: SRC(`# producer.py
from confluent_kafka import Producer
import json, uuid

def build_producer(bootstrap: str) -> Producer:
    return Producer({
        "bootstrap.servers": bootstrap,
        # TODO: enable.idempotence requires acks=all + retries>0 + max.in.flight<=5.
        "enable.idempotence": True,
        "acks": "all",
        "max.in.flight.requests.per.connection": 5,
        "retries": 2_147_483_647,
        "compression.type": "lz4",
        "linger.ms": 20,
    })

def emit_orders(producer: Producer, topic: str, n: int) -> list[str]:
    ids = [str(uuid.uuid4()) for _ in range(n)]
    for oid in ids:
        producer.produce(topic, key=oid.encode(), value=json.dumps({"order_id": oid, "amount": 19.99}).encode())
    producer.flush(30)
    return ids
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "Producer is configured with enable.idempotence=True, acks='all', max.in.flight.requests.per.connection=5, and retries=2_147_483_647.",
          "After writing 1000 orders and injecting a broker leader restart mid-write, consuming the topic yields exactly 1000 distinct order_ids.",
          "No duplicate order_id appears in the topic (producer retries did not create duplicate records).",
          "No order_id is missing (acks=all ensured no silent loss on leader failover).",
        ],
      }),
      expectedOutputs: { ids: 1000, duplicates: 0, missing: 0 },
      datasetRefs: ["fixtures/orders_1000.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "`enable.idempotence=true` forces acks=all + retries=∞ + max.in.flight<=5 (or library rejects).",
          "`acks=1` is a silent data-loss config — leader can ack, then die before replication.",
          "`max.in.flight > 5` breaks ordering guarantees under retry.",
          "`retries=0` defeats idempotence — the broker dedupe needs a retry to dedupe against.",
          "Producer({'enable.idempotence': True, 'acks': 'all', 'max.in.flight.requests.per.connection': 5})",
        ],
        successFeedback: "Producer is now broker-dedupe-safe. Leader restarts are non-events.",
        failureFeedback: "Common slips: acks=1 (silent loss on leader death); max.in.flight=10 (reordering on retry); retries=0 (defeats the whole dedup mechanism).",
        portfolioRelevance: "Idempotent producer config is the easiest checkbox to fail in an interview. Pin it; explain the matrix.",
        finalExplanation: "Idempotence at the producer = the broker treats two identical sends as one. Without this, retries become duplicates.",
        misconceptionToWatchFor: "Believing `acks=all` alone gives EOS. It only gives durability — duplicates can still arrive from client retries unless idempotence is on.",
      }),
    },
    {
      stepNumber: 2,
      title: "Transactional consume-transform-produce (read-process-write EOS)",
      instructionMd:
        "Build a worker that reads from `orders.raw`, normalizes amount → cents, produces to `orders.normalized`, and commits the consumed offset INSIDE the same transaction via `producer.send_offsets_to_transaction()`. Run 500 messages through, kill the worker mid-transaction at message 250, restart it, and self-verify: `orders.normalized` contains exactly the 500 records exactly once AND `orders.raw` consumer-group offset advanced exactly 500.",
      learningObjective: "EOS = consumed offset + produced messages atomic. If offset commit and produce aren't in one transaction, you get duplicates after every restart.",
      requiredSkill: "Kafka transactional API + `send_offsets_to_transaction` + transactional.id semantics",
      starterCode: SRC(`# worker.py
from confluent_kafka import Producer, Consumer, KafkaError, TopicPartition
import json

def run_worker(bootstrap: str, group_id: str, txn_id: str):
    producer = Producer({
        "bootstrap.servers": bootstrap,
        "enable.idempotence": True,
        "acks": "all",
        "transactional.id": txn_id,   # MUST be stable across restarts (worker identity)
    })
    producer.init_transactions(30)

    consumer = Consumer({
        "bootstrap.servers": bootstrap,
        "group.id": group_id,
        "enable.auto.commit": False,           # offsets committed inside the txn, not by consumer
        "isolation.level": "read_committed",   # don't see other workers' aborted txns
        "auto.offset.reset": "earliest",
    })
    consumer.subscribe(["orders.raw"])

    batch: list = []
    while True:
        msg = consumer.poll(1.0)
        if msg is None: continue
        if msg.error():
            if msg.error().code() == KafkaError._PARTITION_EOF: continue
            raise Exception(msg.error())
        batch.append(msg)
        if len(batch) >= 50:
            # TODO: begin_transaction → produce normalized rows → send_offsets_to_transaction
            #       → commit_transaction. On any error: abort_transaction + retry.
            producer.begin_transaction()
            for m in batch:
                rec = json.loads(m.value())
                rec["amount_cents"] = int(rec["amount"] * 100)
                producer.produce("orders.normalized", key=m.key(), value=json.dumps(rec).encode())
            offsets = [TopicPartition(m.topic(), m.partition(), m.offset() + 1) for m in batch]
            producer.send_offsets_to_transaction(offsets, consumer.consumer_group_metadata())
            producer.commit_transaction()
            batch.clear()
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "The worker uses begin_transaction / produce / send_offsets_to_transaction / commit_transaction in one atomic unit.",
          "After killing the worker mid-transaction at message 250 and restarting, orders.normalized contains exactly 500 distinct records with no duplicates.",
          "The consumer group offset for orders.raw advanced exactly 500 (no records were skipped).",
          "transactional.id is stable across restarts so the broker can fence the previous epoch's incomplete writes.",
          "enable.auto.commit is False and offsets are committed inside the transaction, not by a separate consumer.commit() call.",
        ],
      }),
      expectedOutputs: { normalized: 500, duplicates: 0, gap: 0 },
      datasetRefs: ["fixtures/orders_500.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "`transactional.id` MUST be stable across worker restarts — that's the identity that fences the previous epoch's writes.",
          "`isolation.level=read_committed` on the consumer hides aborted transactions; default is read_uncommitted.",
          "Offsets MUST be sent via `send_offsets_to_transaction`, not `consumer.commit()` — otherwise they're not atomic with the produces.",
          "Always wrap in try/except → `abort_transaction()` so the next attempt starts clean.",
          "producer.send_offsets_to_transaction(offsets, consumer.consumer_group_metadata())",
        ],
        successFeedback: "Restart-mid-batch is now a non-event. The transaction's atomicity covers reads + writes + offset advance.",
        failureFeedback: "Common slips: committing offsets with `consumer.commit()` (not atomic with produces → duplicates on restart); changing transactional.id on restart (no fencing → zombie writer).",
        portfolioRelevance: "Read-process-write EOS is the gold standard for Kafka pipelines. Demonstrating it with a kill test is senior signal.",
        finalExplanation: "True EOS in Kafka is consume + produce + offset commit all in one transaction. Anything less is at-least-once with marketing.",
        misconceptionToWatchFor: "Treating `enable.idempotence` as sufficient for EOS. It only protects producer→broker; you still need transactions for consumer-offset atomicity.",
      }),
    },
    {
      stepNumber: 3,
      title: "Rebalance safety — cooperative-sticky + commit-on-revoke",
      instructionMd:
        "Switch the consumer to `partition.assignment.strategy=cooperative-sticky` and register `on_revoke` + `on_assign` handlers. In `on_revoke`, finish the current transaction (or abort cleanly). Run 2 workers reading 800 messages; mid-stream, have a 3rd worker join forcing rebalance, then leave. Self-verify: 800 distinct records in `orders.normalized` exactly once; no partition processed by 2 workers simultaneously per the rebalance log.",
      learningObjective: "Cooperative rebalance keeps unaffected partitions running; commit-on-revoke prevents the partition's in-flight transaction from becoming a zombie.",
      requiredSkill: "Cooperative sticky assignor + rebalance callbacks + transactional cleanup on revoke",
      starterCode: SRC(`# rebalance.py
from confluent_kafka import Consumer, Producer, TopicPartition

def on_revoke(consumer: Consumer, revoked: list[TopicPartition], producer: Producer, in_txn: dict) -> None:
    # Called BEFORE the partition is reassigned to another worker.
    if in_txn.get("active"):
        # TODO: abort_transaction() is the safe default during revoke — the new
        # owner will reprocess from the last committed offset.
        producer.abort_transaction()
        in_txn["active"] = False

def on_assign(consumer: Consumer, assigned: list[TopicPartition]) -> None:
    # Cooperative-sticky calls this with the *incremental* assignment.
    consumer.incremental_assign(assigned)

def build_consumer(bootstrap: str, group_id: str, producer: Producer, in_txn: dict) -> Consumer:
    return Consumer({
        "bootstrap.servers": bootstrap,
        "group.id": group_id,
        "enable.auto.commit": False,
        "isolation.level": "read_committed",
        "partition.assignment.strategy": "cooperative-sticky",
        # eager (the legacy default) revokes ALL partitions on rebalance —
        # stop-the-world for every worker. Cooperative only revokes the moving ones.
    })
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "Consumer is configured with partition.assignment.strategy='cooperative-sticky'.",
          "on_revoke aborts any in-flight transaction before partitions are handed off to the new owner.",
          "After running 2 workers through 800 messages with a 3rd worker joining and then leaving mid-stream, orders.normalized contains exactly 800 distinct records.",
          "The rebalance log shows no partition was processed by two workers simultaneously (no double-processing).",
          "incremental_assign / incremental_unassign are used in the cooperative callbacks, not the eager assign.",
        ],
      }),
      expectedOutputs: { distinct: 800, doubleProcessed: 0 },
      datasetRefs: ["fixtures/orders_800.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Eager rebalancing = stop-the-world for every worker every join/leave. Cooperative = only the moving partition pauses.",
          "On `on_revoke`, ALWAYS abort the in-flight transaction — the new owner will reprocess from the last committed offset.",
          "`incremental_assign`/`incremental_unassign` are the cooperative-sticky callbacks; using `assign` here will throw.",
          "Set `session.timeout.ms` low enough (~10s) that dead workers don't hold partitions for 45+ seconds.",
          "'partition.assignment.strategy': 'cooperative-sticky'",
        ],
        successFeedback: "Rebalances no longer cascade across the group. Workers stay productive during topology changes.",
        failureFeedback: "Common slips: committing on revoke instead of aborting (creates duplicate if commit lands but produce didn't); using `consumer.assign` in cooperative mode (raises); high session.timeout (slow failover).",
        portfolioRelevance: "Cooperative-sticky + clean revoke is the modern Kafka consumer pattern. Show the rebalance log proving no double-process.",
        finalExplanation: "Rebalance is the consumer's failure-handling story. Cooperative-sticky is the only safe default for production pipelines.",
        misconceptionToWatchFor: "Believing the default assignor is fine. The library default is `range` — fine for development, brutal for production EOS.",
      }),
    },
    {
      stepNumber: 4,
      title: "Avro + Schema Registry — backward+forward compat evolution",
      instructionMd:
        "Register schema v1 for `orders.normalized` requiring `order_id`, `amount_cents`. Evolve to v2 by adding optional `currency` (default 'USD'). Self-verify: produce a v2 record, consume with v1 reader (must succeed — backward compat); produce a v1 record, consume with v2 reader (must succeed — forward compat). Then attempt v3 with a renamed field (`amount_cents` → `total_cents`); the registry should reject it as incompatible.",
      learningObjective: "Backward+forward compatible schema evolution is non-negotiable for streaming systems — incompatible changes break consumers in the middle of the night.",
      requiredSkill: "Avro schema design + Schema Registry compatibility modes (BACKWARD / FORWARD / FULL)",
      starterCode: SRC(`# schema.py
from confluent_kafka.schema_registry import SchemaRegistryClient, Schema

SCHEMA_V1 = '''{
  "type": "record", "name": "Order", "namespace": "atlas.de",
  "fields": [
    {"name": "order_id",     "type": "string"},
    {"name": "amount_cents", "type": "int"}
  ]
}'''

SCHEMA_V2 = '''{
  "type": "record", "name": "Order", "namespace": "atlas.de",
  "fields": [
    {"name": "order_id",     "type": "string"},
    {"name": "amount_cents", "type": "int"},
    {"name": "currency",     "type": "string", "default": "USD"}
  ]
}'''
# TODO: SCHEMA_V3 must FAIL compatibility — rename = breaking change.

def register_v1_v2(client: SchemaRegistryClient, subject: str) -> tuple[int, int]:
    # Compatibility level FULL = both directions must hold for every evolution.
    client.set_compatibility(subject_name=subject, level="FULL")
    v1 = client.register_schema(subject, Schema(SCHEMA_V1, "AVRO"))
    v2 = client.register_schema(subject, Schema(SCHEMA_V2, "AVRO"))
    return v1, v2
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "Schema v1 and v2 are registered under FULL compatibility mode (both backward and forward).",
          "A v2 record (with the optional 'currency' field) can be deserialized by a v1 reader without error (backward compatibility).",
          "A v1 record (without 'currency') can be deserialized by a v2 reader, defaulting currency to 'USD' (forward compatibility).",
          "Attempting to register schema v3 with a renamed field (e.g. amount_cents → total_cents) is rejected by the registry with a 409 Conflict error.",
        ],
      }),
      expectedOutputs: { backwardOk: true, forwardOk: true, v3Rejected: true },
      datasetRefs: ["fixtures/schema_compat.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "FULL compat = both forward and backward — the only safe default for shared topics.",
          "Adding a field with a default = backward+forward compat. No default = backward only.",
          "Renaming = breaking change. Use a new field + downstream rewrite + drop the old field in a later version.",
          "Removing a required field = forward-incompat. Add a default first; remove later.",
          "client.set_compatibility(subject_name=subject, level='FULL')",
        ],
        successFeedback: "Schema evolves without coordinating producer/consumer deploys. Streaming team can move independently.",
        failureFeedback: "Common slips: NONE compat (any change ok = chaos); BACKWARD only (new producers break old consumers); renaming a field (always breaking).",
        portfolioRelevance: "Schema evolution discipline is a senior streaming-DE differentiator. Show the compatibility test in CI.",
        finalExplanation: "Schema Registry + FULL compat = a contract that lets producers and consumers ship independently. The whole point of streaming at scale.",
        misconceptionToWatchFor: "Treating Schema Registry as a 'serialization detail'. It's the contract layer; treat it like an API version policy.",
      }),
    },
    {
      stepNumber: 5,
      title: "DLQ + observability — bounded retry, structured failure, consumer-lag SLO",
      instructionMd:
        "Add a try/except around the per-message transform; on N=3 retries failed, route the original message + failure metadata (error class, stacktrace, original offset, attempt count) to `orders.dlq` and continue. Expose Prometheus metrics: `consumer_lag_records`, `messages_processed_total`, `dlq_routed_total`. Self-verify by injecting 10 poison messages (invalid JSON) into a 100-message run: confirm 90 in `orders.normalized`, 10 in `orders.dlq` with structured metadata, `dlq_routed_total=10`, and that the consumer did not stall.",
      learningObjective: "DLQ + bounded retry lets the pipeline keep moving in the face of poison messages — and observability tells you when to act.",
      requiredSkill: "DLQ pattern + retry budget + Prometheus client (counter/gauge) + lag computation",
      starterCode: SRC(`# dlq.py
from confluent_kafka import Producer, Consumer
from prometheus_client import Counter, Gauge
import json, traceback

processed = Counter("messages_processed_total", "messages successfully normalized")
dlq_total = Counter("dlq_routed_total", "messages routed to DLQ after retry exhaustion", ["reason"])
lag_gauge = Gauge("consumer_lag_records", "current consumer lag per partition", ["partition"])

MAX_RETRIES = 3

def transform_or_dlq(msg, producer: Producer, attempt: int = 0) -> str:
    try:
        rec = json.loads(msg.value())
        rec["amount_cents"] = int(rec["amount"] * 100)
        producer.produce("orders.normalized", key=msg.key(), value=json.dumps(rec).encode())
        processed.inc()
        return "ok"
    except Exception as e:
        if attempt + 1 < MAX_RETRIES:
            return transform_or_dlq(msg, producer, attempt + 1)
        # TODO: route to DLQ with structured failure metadata.
        envelope = {
            "original_offset": msg.offset(),
            "original_partition": msg.partition(),
            "original_topic": msg.topic(),
            "attempts": attempt + 1,
            "error_class": e.__class__.__name__,
            "error_message": str(e),
            "stacktrace": traceback.format_exc(),
            "original_value_b64": (msg.value() or b"").hex(),
        }
        producer.produce("orders.dlq", key=msg.key(), value=json.dumps(envelope).encode())
        dlq_total.labels(reason=e.__class__.__name__).inc()
        return "dlq"
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "After sending 100 messages including 10 deliberately malformed (non-JSON) records, orders.normalized contains exactly 90 records.",
          "orders.dlq contains exactly 10 records, each with structured metadata including original_offset, original_topic, attempts, error_class, and stacktrace.",
          "The Prometheus counter dlq_routed_total reads 10 after the run.",
          "The consumer did not stall — consumer_lag_records returns 0 (or near 0) at end of run, confirming poison messages were handled and not retried infinitely.",
          "Bounded retry (MAX_RETRIES=3) was respected — each poison message was attempted at most 3 times before routing to the DLQ.",
        ],
      }),
      expectedOutputs: { normalized: 90, dlq: 10, finalLag: 0 },
      datasetRefs: ["fixtures/dlq_100_with_10_poison.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Without a DLQ, one poison record stalls the consumer group forever (retry → fail → retry).",
          "DLQ envelope MUST include enough metadata to replay the original message after a code fix.",
          "Bounded retry (3-5 attempts) handles transient errors without hiding permanent ones.",
          "Consumer lag is the SLO that matters — alert on lag > N records sustained for > T minutes.",
          "producer.produce('orders.dlq', key=msg.key(), value=json.dumps(envelope).encode())",
        ],
        successFeedback: "Poison messages no longer stall the pipeline. Operators have the metadata to fix-and-replay.",
        failureFeedback: "Common slips: infinite retry (stalls forever); DLQ without metadata (un-replayable); no lag metric (silent regressions).",
        portfolioRelevance: "Showing a DLQ replay tool + a Grafana dashboard for lag is the difference between 'I built a streaming app' and 'I operate one'.",
        finalExplanation: "DLQ + bounded retry + lag SLO = the operational toolkit for streaming. Without these, the first poison message is a 3am page.",
        misconceptionToWatchFor: "Skipping the DLQ envelope's metadata. Without `original_offset` + `original_topic`, replay is impossible.",
      }),
    },
  ],
};
