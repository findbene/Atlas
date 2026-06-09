/**
 * Phase 7 — Wave 1b / data-engineering (advanced).
 * Candidate 9a704771-3360-45b3-88e2-8020a627a6d6 — Flink Windowed Aggregations Pipeline.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const dataEngineeringFlinkWindowedAggregations: AuthoredProject = {
  slug: "data-engineering-flink-windowed-aggregations",
  candidateId: "9a704771-3360-45b3-88e2-8020a627a6d6",
  title: "Flink Windowed Aggregations Pipeline (Kafka → Iceberg)",
  shortDescription:
    "Build an Apache Flink streaming job that consumes user-event records from Kafka, computes tumbling + session windowed aggregations with event-time + watermarks, handles late data, and lands compact Parquet files in an Iceberg table for downstream analytics.",
  fullDescription:
    "Real streaming pipelines fail on two things: clock skew (events arrive out of order) and back-pressure (sinks can't keep up). Flink's event-time + watermark semantics give you correct windowed aggregations even when producers lag by minutes; Iceberg's atomic commits keep the lake consistent under high write fan-out. You'll wire a Flink job with KafkaSource (exactly-once), a BoundedOutOfOrderness watermark strategy, a tumbling window + a session window over user activity, partitioned writes to an Iceberg table, and OpenTelemetry metrics for back-pressure + late-event ratio.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Flink", "Kafka", "Iceberg", "Python", "observability", "opentelemetry"],
  tags: ["flink", "kafka", "iceberg", "streaming", "watermarks", "event-time", "data-engineering", "observability"],
  learningObjectives: [
    "Wire a Flink KafkaSource with exactly-once delivery and a bounded-out-of-orderness watermark strategy.",
    "Implement tumbling AND session windowed aggregations with event-time semantics.",
    "Sink windowed results to an Iceberg table partitioned by event date.",
    "Detect + redirect late data to a side output instead of silently dropping it.",
    "Export back-pressure + late-event metrics to OpenTelemetry so the on-call team sees lag before SLA breaches.",
  ],
  estimatedMinutes: 220,
  xpReward: 700,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Product-analytics team needs per-user session metrics in the warehouse within 60s of event arrival. The legacy Kafka-Connect + dbt batch pipeline is 20min behind and miscounts sessions whenever producers lag.",
    hiringRelevance2026:
      "Every 2026 cloud-data-engineering JD lists Flink + Iceberg as tier-1 stack. Event-time + watermarks + side outputs is the textbook senior question.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (Kafka → Flink → Iceberg)",
      "Step 1 KafkaSource + watermarks", "Step 2 Tumbling window", "Step 3 Session window",
      "Step 4 Iceberg sink + partitioning", "Step 5 OTel metrics", "Validation", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with the PyFlink job, docker-compose for Kafka + Iceberg REST catalog + MinIO, a producer that synthesizes late events, and a Grafana dashboard JSON showing late-event ratio + per-window throughput.",
    portfolioRelevance:
      "Recruiters hiring cloud-data-engineers in 2026 know 'I built a Flink job' is rare. A repo that demonstrates event-time correctness + Iceberg sink + observability is a senior-IC signal.",
    repoUrl: "https://github.com/<your-handle>/flink-windowed-aggregations",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "KafkaSource with exactly-once + watermarks",
      instructionMd:
        "Configure a `KafkaSource` reading from topic `user_events` with `OffsetsInitializer.earliest()`, exactly-once delivery (`setProperty('isolation.level','read_committed')`), and a `WatermarkStrategy.for_bounded_out_of_orderness(Duration.of_seconds(30))` that extracts `event.event_ts` as the event timestamp. Why 30s? Real producers (mobile clients) commonly lag 5-20s; 30s gives headroom without making windows wait forever. Validator drives a fixed list of records (some out of order by up to 25s) and asserts the source emits them all with monotonic watermarks.",
      learningObjective: "Wire Flink's exactly-once Kafka source with an event-time watermark strategy.",
      requiredSkill: "Flink WatermarkStrategy + KafkaSource + event-time semantics",
      starterCode: SRC(`# job.py — PyFlink 1.18
from pyflink.datastream import StreamExecutionEnvironment
from pyflink.datastream.connectors.kafka import KafkaSource, KafkaOffsetsInitializer
from pyflink.common import WatermarkStrategy, Duration, Types
from pyflink.common.serialization import SimpleStringSchema
import json

env = StreamExecutionEnvironment.get_execution_environment()
env.enable_checkpointing(60_000)  # 60s checkpoints for exactly-once

source = (
    KafkaSource.builder()
    .set_bootstrap_servers("kafka:9092")
    .set_topics("user_events")
    .set_group_id("flink-windowed-agg")
    .set_starting_offsets(KafkaOffsetsInitializer.earliest())
    .set_value_only_deserializer(SimpleStringSchema())
    .set_property("isolation.level", "read_committed")
    .build()
)

# TODO: build WatermarkStrategy.for_bounded_out_of_orderness(Duration.of_seconds(30))
# with a TimestampAssigner that returns int(json.loads(record)["event_ts"]) * 1000.
watermark_strategy = None  # TODO

events = env.from_source(source, watermark_strategy, "user_events")
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Using a Flink MiniCluster or local job, emit 10 events spanning 90 seconds with 3 events out-of-order by up to 25 seconds. Confirm all 10 events are delivered to the downstream operator and that watermark values advance monotonically (never decrease).",
      }),
      expectedOutputs: { delivered: 10, watermarkMonotonic: true },
      datasetRefs: ["fixtures/kafka_events_with_late.jsonl"],
      pedagogy: pedagogyConfig({
        hints: [
          "Watermarks are Flink's way of saying 'I've seen everything older than T'. They drive when windows close.",
          "Bounded-out-of-orderness = max lag you'll tolerate. 30s for mobile producers is the textbook starting point.",
          "TimestampAssigner: implement extract_timestamp(value, record_timestamp) -> int(json.loads(value)['event_ts'])*1000.",
          "ws = WatermarkStrategy.for_bounded_out_of_orderness(Duration.of_seconds(30)).with_timestamp_assigner(MyTSA())\nclass MyTSA(TimestampAssigner):\n  def extract_timestamp(self, value, record_ts):\n    return int(json.loads(value)['event_ts']) * 1000",
          "(see reference above)",
        ],
        successFeedback: "Source reads exactly-once and event-time flows through the rest of the pipeline.",
        failureFeedback: "Common slips: used processing-time (windows fire on wall clock not event clock); skipped isolation.level (read uncommitted gets duplicate events after rebalance); forgot to multiply seconds*1000 (Flink wants ms).",
        portfolioRelevance: "Most candidates know 'Flink does streaming'. Few can explain watermark semantics with a real bounded-out-of-orderness number. That's the senior signal.",
        finalExplanation: "Watermarks are the secret sauce. They decouple 'when an event happened' from 'when Flink saw it' so your windows are correct even when producers stutter.",
        misconceptionToWatchFor: "Setting bounded-out-of-orderness too high (e.g., 5min). Windows now wait 5min before closing — your dashboard is always 5min behind.",
      }),
    },
    {
      stepNumber: 2,
      title: "Tumbling 1-minute count window with side output",
      instructionMd:
        "Apply `.key_by(lambda e: json.loads(e)['user_id']).window(TumblingEventTimeWindows.of(Time.minutes(1)))` and aggregate to `(user_id, window_start, count)`. Use `OutputTag('late')` to redirect late events. The validator pushes a stream where 1 event arrives 90s after its window's watermark and asserts that event appears in the side output, not the main aggregation.",
      learningObjective: "Implement event-time tumbling windows with explicit late-data side outputs.",
      requiredSkill: "Flink Window API + OutputTag + KeyedProcessFunction or AggregateFunction",
      starterCode: SRC(`# windows.py
from pyflink.datastream.window import TumblingEventTimeWindows
from pyflink.common.time import Time
from pyflink.datastream import OutputTag

late_output = OutputTag("late", Types.STRING())

# TODO: keyed = events.key_by(lambda e: json.loads(e)['user_id'])
# TODO: windowed = keyed.window(TumblingEventTimeWindows.of(Time.minutes(1))).side_output_late_data(late_output)
# TODO: counts = windowed.apply(WindowFn()) where WindowFn returns (user_id, window_start_ms, count)
# Then: late = counts.get_side_output(late_output)
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Push 11 events (10 on-time, 1 arriving 90 seconds after its window's watermark has passed). Confirm the main output aggregation contains only the 10 on-time events, and the side output tagged 'late' contains exactly the 1 late event.",
      }),
      expectedOutputs: { mainEvents: 10, lateEvents: 1 },
      datasetRefs: ["fixtures/late_event_stream.jsonl"],
      pedagogy: pedagogyConfig({
        hints: [
          "Late data in Flink without a side output is SILENTLY DROPPED. That's the trap.",
          "OutputTag is a typed handle. Declare it once at module scope, reuse in the apply and the get_side_output call.",
          "AggregateFunction = (createAccumulator, add, getResult, merge). For count: acc=0, add=acc+1, get=acc, merge=a+b.",
          "windowed = keyed.window(TumblingEventTimeWindows.of(Time.minutes(1))).side_output_late_data(late_output)\ncounts = windowed.aggregate(CountAgg(), WindowResult())\nlate = counts.get_side_output(late_output)",
          "(see reference above)",
        ],
        successFeedback: "Tumbling counts ship + late data is captured for inspection instead of silently lost.",
        failureFeedback: "Common slips: forgot side_output_late_data (late events vanish); keyed by user_id after the window (window now spans all users → wrong counts).",
        portfolioRelevance: "Explaining late-data side outputs verbally in an interview separates real Flink users from tutorial readers.",
        finalExplanation: "Late = arrived after watermark passed window-end. By default Flink drops them. Side outputs let you log, alert, or backfill instead.",
        misconceptionToWatchFor: "Using ProcessingTimeWindows because they 'just work in tests'. They're nondeterministic in prod and you'll throw the whole job away.",
      }),
    },
    {
      stepNumber: 3,
      title: "Session window with 5-min inactivity gap",
      instructionMd:
        "On the same keyed stream apply `EventTimeSessionWindows.with_gap(Time.minutes(5))` and aggregate to `(user_id, session_start, session_end, event_count)`. Session windows close after `gap` seconds of inactivity for that key. Validator pushes a user with 3 events 1min apart then a 6min pause then 2 more events — expects 2 sessions for that user.",
      learningObjective: "Use event-time session windows and explain how they differ from tumbling windows.",
      requiredSkill: "Flink session windows + per-key state",
      starterCode: SRC(`# sessions.py
from pyflink.datastream.window import EventTimeSessionWindows

# TODO: sessions = keyed.window(EventTimeSessionWindows.with_gap(Time.minutes(5)))
#                       .apply(SessionWindowFn())
# SessionWindowFn outputs (user_id, window.start, window.end, count(elements))
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Emit events for user U1 at t=0s, 60s, 120s (first burst), then t=420s and 480s (second burst, >5min gap). Confirm the session window produces exactly 2 sessions for U1: first session spanning t=0–120 with event_count=3, second session spanning t=420–480 with event_count=2.",
      }),
      expectedOutputs: { sessions: 2, counts: [3, 2] },
      datasetRefs: ["fixtures/session_test_stream.jsonl"],
      pedagogy: pedagogyConfig({
        hints: [
          "Session windows don't have a fixed size — they grow as events arrive within the gap.",
          "Each key (user_id) has its own session state. Two users active at the same time → two parallel sessions.",
          "Sessions merge: if a late event arrives that bridges two existing sessions, Flink merges them.",
          "sessions = keyed.window(EventTimeSessionWindows.with_gap(Time.minutes(5))).apply(\n  lambda key, window, inputs, out: out.collect((key, window.start, window.end, len(list(inputs))))\n)",
          "(see reference above)",
        ],
        successFeedback: "Per-user session metrics now flow downstream.",
        failureFeedback: "Common slips: counted total events instead of per-session (forgot key_by before window); used a fixed window (session events span tumbling boundaries and get split).",
        portfolioRelevance: "Sessionization is a common interview question for both DE and analytics-engineer roles. Solving it with Flink (not SQL window functions) is the senior signal.",
        finalExplanation: "Session windows model 'user activity bursts' more accurately than fixed windows. The gap parameter is the only knob, and it directly maps to product intent ('a session ends after 5min idle').",
        misconceptionToWatchFor: "Trying to implement sessions yourself with a KeyedProcessFunction. Possible, but session windows already do the heavy lifting (esp. session merging on late events).",
      }),
    },
    {
      stepNumber: 4,
      title: "Iceberg sink partitioned by event date",
      instructionMd:
        "Wire a `FlinkSink` writing the tumbling-count stream to Iceberg table `analytics.user_minute_counts` partitioned by `days(window_start)`. Use Iceberg REST catalog. Validator runs a 2-min job, then queries the Iceberg table from pyiceberg and asserts row count + partition count match the input.",
      learningObjective: "Sink Flink output to a partitioned Iceberg table with exactly-once semantics.",
      requiredSkill: "Flink Iceberg connector + Iceberg partition spec",
      starterCode: SRC(`# sink.py — depends on iceberg-flink-runtime-1.18 jar
from pyflink.table import StreamTableEnvironment

t_env = StreamTableEnvironment.create(env)
t_env.execute_sql("""
CREATE CATALOG iceberg WITH (
  'type'='iceberg', 'catalog-type'='rest',
  'uri'='http://iceberg-rest:8181', 'warehouse'='s3a://lake/'
)""")
t_env.execute_sql("""
CREATE TABLE IF NOT EXISTS iceberg.analytics.user_minute_counts (
  user_id STRING, window_start_ms BIGINT, cnt BIGINT
) PARTITIONED BY (days(TO_TIMESTAMP_LTZ(window_start_ms, 3)))
""")

# TODO: convert counts DataStream -> Table via t_env.from_data_stream(counts, ...)
# then table.execute_insert("iceberg.analytics.user_minute_counts")
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Run the Flink job for 2 minutes with input data spanning 3 calendar days and 120 distinct minute windows. Query the Iceberg table via pyiceberg and confirm row count = 120 and partition count = 3 (one per day).",
      }),
      expectedOutputs: { rows: 120, partitions: 3 },
      datasetRefs: ["fixtures/iceberg_table_snapshot.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Iceberg's days(ts) partition transform writes one Parquet directory per UTC date.",
          "Convert DataStream → Table to use the SQL CREATE TABLE + INSERT path (less boilerplate than the DataStream sink).",
          "Verify with `pyiceberg.catalog.load_catalog('rest').load_table('analytics.user_minute_counts').scan().to_arrow()`.",
          "table = t_env.from_data_stream(counts, Schema.new_builder().column('user_id', 'STRING').column('window_start_ms', 'BIGINT').column('cnt', 'BIGINT').build())\ntable.execute_insert('iceberg.analytics.user_minute_counts')",
          "(see reference above)",
        ],
        successFeedback: "Stream lands in Iceberg with proper partition pruning for downstream queries.",
        failureFeedback: "Common slips: partitioned by raw timestamp (one partition per second → metadata explosion); skipped checkpointing (no exactly-once → duplicates on restart).",
        portfolioRelevance: "Flink + Iceberg is the 2026 cloud-DE stack. Recruiters scanning for 'streaming → lakehouse' want to see exactly this combination.",
        finalExplanation: "Iceberg + partition transforms decouple physical layout from query patterns. `days(ts)` is the universally-correct default; you can change it later without rewriting queries.",
        misconceptionToWatchFor: "Writing directly to S3 with a Parquet writer. You lose ACID, schema evolution, and time-travel — all things Iceberg gives you for free.",
      }),
    },
    {
      stepNumber: 5,
      title: "OpenTelemetry metrics: back-pressure + late ratio",
      instructionMd:
        "Add OTel meter that emits two gauges every 10s: `flink.backpressure.ratio` (per operator, scraped from Flink's REST metrics) and `flink.late.events.ratio` (late_count / total_count from step 2's side output). Wire to OTLP exporter pointing at a local collector. Validator scrapes the meter after a synthetic late-event burst and asserts both metrics appear with non-zero values.",
      learningObjective: "Export operational metrics to OpenTelemetry so on-call sees lag before SLA breaches.",
      requiredSkill: "OpenTelemetry Metrics API + Flink REST metrics scraping + OTLP exporter",
      starterCode: SRC(`# otel_metrics.py
from opentelemetry import metrics
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter

reader = PeriodicExportingMetricReader(OTLPMetricExporter(endpoint="otel-collector:4317"), export_interval_millis=10_000)
metrics.set_meter_provider(MeterProvider(metric_readers=[reader]))
meter = metrics.get_meter("flink-windowed-agg")

# TODO: meter.create_observable_gauge('flink.backpressure.ratio', callbacks=[bp_callback])
# bp_callback queries http://jobmanager:8081/jobs/:jobid/vertices/:vid/backpressure
# TODO: meter.create_observable_gauge('flink.late.events.ratio', callbacks=[late_callback])
# late_callback reads two AtomicLong counters you maintained in step 2.
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Run the job for 30 seconds with a synthetic stream that has ~10% late events. Query the OTLP collector and confirm both metric names appear: 'flink.backpressure.ratio' and 'flink.late.events.ratio'. Confirm the late.events.ratio value is approximately 0.1 (within ±0.05).",
      }),
      expectedOutputs: { metrics: 2, lateRatio: 0.1 },
      datasetRefs: ["fixtures/otel_scrape_dump.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "PeriodicExportingMetricReader pushes on a fixed interval — pick 10s so dashboards refresh smoothly.",
          "Observable gauges accept a callback that's invoked on each export. Keep the callback cheap (no blocking HTTP from the metrics thread).",
          "Flink REST: GET /jobs/<id>/vertices/<vid>/backpressure returns { backpressure: 'ok'|'low'|'high', ratio: float }.",
          "from opentelemetry.metrics import Observation\ndef bp_cb(opts): r = httpx.get(REST_URL).json()['ratio']; return [Observation(r, {'op':'window'})]",
          "(see reference above)",
        ],
        successFeedback: "Streaming pipeline now has the two metrics on-call cares about. Add a dashboard alert when late.ratio > 0.05.",
        failureFeedback: "Common slips: blocking HTTP from the gauge callback (delays exports, skews timing); didn't authenticate to the OTLP collector (silent drops).",
        portfolioRelevance: "Streaming + OpenTelemetry is the senior-DE differentiator. Most candidates ship Flink jobs with zero observability.",
        finalExplanation: "Metrics are how you discover problems before customers do. Two metrics — back-pressure + late-ratio — cover ~80% of streaming failure modes.",
        misconceptionToWatchFor: "Logging metrics with print(). Logs don't aggregate; metrics do. PromQL/OTel queries can't operate on stdout.",
      }),
    },
  ],
};
