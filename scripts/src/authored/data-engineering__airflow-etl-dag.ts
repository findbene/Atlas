/**
 * Phase 11 batch-3 / data-engineering (skeleton rebuild).
 * Candidate f0e1a5c6-9178-4d22-9456-5e6f70819203 — Airflow ETL DAG with
 * idempotent operators, retry/backfill semantics, sensors, and dbt run.
 *
 * Legacy: `airflow-etl-dag` (1-step skeleton, score 49.3). Full rebuild.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const dataEngineeringAirflowEtlDag: AuthoredProject = {
  slug: "data-engineering-airflow-etl-dag",
  candidateId: "f0e1a5c6-9178-4d22-9456-5e6f70819203",
  title: "Airflow ETL DAG — Idempotent Operators + Backfill + Sensors + dbt",
  shortDescription:
    "Build a production Airflow 2.x DAG that idempotently lands daily API data into Postgres, waits on an upstream S3 manifest with a sensor, runs a dbt build, and is safe to backfill 90 days without duplicates or surprises.",
  fullDescription:
    "Most Airflow DAGs work the first time and break the moment you backfill. You'll write a DAG that's truly idempotent (ON CONFLICT upserts, partition pruning by execution_date), uses the right sensor (deferrable, not blocking), composes with dbt for the transform layer, and survives a 90-day backfill in 8 minutes. Each step is measurable; the final DAG demonstrates the real Airflow contract.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "airflow", "postgres", "dbt", "dlt", "S3", "kafka"],
  tags: ["airflow", "etl", "idempotency", "backfill", "sensor", "dbt", "postgres"],
  learningObjectives: [
    "Write idempotent task SQL with execution_date pruning + ON CONFLICT upsert.",
    "Use a deferrable S3KeySensor so 90-day backfills don't pin worker slots.",
    "Compose Airflow + dbt with the dbt CLI BashOperator + correct state passing.",
    "Configure max_active_runs + depends_on_past so backfills are deterministic.",
    "Add data-quality gates that fail the DAG before downstream consumers see bad data.",
  ],
  estimatedMinutes: 220,
  xpReward: 720,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Sole DE at a 40-person fintech. The current Airflow setup duplicates rows on every backfill + holds worker slots for the 6h S3 sensor wait, blocking SLA. Your one-sprint mission: make the daily DAG re-runnable, idempotent, and friendly to a 90-day backfill.",
    hiringRelevance2026:
      "Idempotent Airflow + backfill discipline is the most-asked DE interview area. Show the contract; don't just call .schedule_interval='@daily'.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (DAG / sensor / dbt / DQ gate)",
      "Step 1 idempotent extract", "Step 2 deferrable sensor", "Step 3 dbt build",
      "Step 4 backfill safety", "Step 5 data-quality gate", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with the DAG, dbt project, docker-compose for local Airflow + Postgres + MinIO, and a 90-day backfill log showing 0 duplicates + 8-minute completion. README documents the idempotency contract per task.",
    portfolioRelevance:
      "An Airflow repo with a successful 90-day backfill log is rare and credible. Reviewers re-run it and trust it.",
    repoUrl: "https://github.com/<your-handle>/airflow-etl-dag",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Idempotent extract — execution_date pruning + ON CONFLICT",
      instructionMd:
        "Write `extract_daily_events(execution_date, ti)`: fetch the day's events from a paginated API, write to Postgres `events(event_id PK, event_date, payload, ingested_at)` with `INSERT … ON CONFLICT (event_id) DO UPDATE SET payload=EXCLUDED.payload, ingested_at=NOW()`. Validator runs the task twice for the same execution_date against a 500-row fixture API and asserts: 500 rows after first run, still 500 rows after second run (no duplicates), `ingested_at` updated on second run.",
      learningObjective: "Idempotency means re-running the task is safe — the table state is a function of the inputs only.",
      requiredSkill: "ON CONFLICT upsert + execution_date filter + paginated API consumption",
      starterCode: SRC(`# tasks/extract.py
import psycopg
from datetime import datetime

def extract_daily_events(execution_date: datetime, ti, api_client, conn_str: str) -> int:
    inserted = 0
    with psycopg.connect(conn_str) as conn, conn.cursor() as cur:
        for page in api_client.iter_events(date=execution_date.date()):
            for ev in page:
                # TODO: INSERT INTO events (event_id, event_date, payload, ingested_at)
                #       VALUES (%s, %s, %s::jsonb, NOW())
                #       ON CONFLICT (event_id)
                #       DO UPDATE SET payload = EXCLUDED.payload, ingested_at = NOW();
                inserted += 1
        conn.commit()
    ti.xcom_push(key='rows_extracted', value=inserted)
    return inserted
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "After 1st run: 500 rows; after 2nd run on same execution_date: still 500 rows + all ingested_at timestamps updated to the second run's time.", {
        expected: { rowsAfterRun1: 500, rowsAfterRun2: 500, ingestedAtChanged: true, duplicates: 0 },
      }),
      expectedOutputs: { rows: 500, duplicates: 0, idempotent: true },
      datasetRefs: ["fixtures/api_500.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "ON CONFLICT (PK) is the simplest path to idempotency — no SELECT-then-INSERT race.",
          "Use execution_date (the logical interval start), not datetime.now() — backfills depend on it.",
          "DO UPDATE refreshes payload so late-arriving corrections propagate; DO NOTHING freezes the first write.",
          "xcom_push small counters; never push the full row set (XCom is a small-payload contract).",
          "INSERT INTO events (event_id, event_date, payload, ingested_at) VALUES (%s, %s, %s::jsonb, NOW()) ON CONFLICT (event_id) DO UPDATE SET payload = EXCLUDED.payload, ingested_at = NOW();",
        ],
        successFeedback: "Extract is now safe to re-run any number of times. Backfill is no longer scary.",
        failureFeedback: "Common slips: SELECT-then-INSERT (race condition); datetime.now() (non-deterministic for backfill); DO NOTHING (stale data wins).",
        portfolioRelevance: "Idempotent extract is the foundation of any serious DE work. Show it as the first commit.",
        finalExplanation: "Idempotency is what makes Airflow safe. Without it, every backfill is a data risk.",
        misconceptionToWatchFor: "Treating Airflow scheduling as 'cron with extra steps'. The execution_date contract is the whole point.",
      }),
    },
    {
      stepNumber: 2,
      title: "Deferrable S3KeySensor — backfill-friendly waits",
      instructionMd:
        "Use `S3KeySensorAsync` (deferrable) to wait on `s3://manifests/dt={{ ds }}/manifest.json` before the extract task. Validator simulates a 90-day backfill scheduled in parallel (`max_active_runs=10`) and asserts: blocking `S3KeySensor` would pin 10 worker slots × 90 days = 900 slot-hours; the deferrable version uses the triggerer and reports 0 worker slots pinned during waits.",
      learningObjective: "Deferrable operators free worker slots while waiting — the only way to backfill at scale.",
      requiredSkill: "Airflow 2.x deferrable operators + triggerer + sensor vs operator semantics",
      starterCode: SRC(`# tasks/sensor.py
from airflow.providers.amazon.aws.sensors.s3 import S3KeySensorAsync

def wait_for_manifest(execution_date_str: str) -> S3KeySensorAsync:
    return S3KeySensorAsync(
        task_id='wait_for_manifest',
        bucket_name='manifests',
        bucket_key=f"dt={execution_date_str}/manifest.json",
        aws_conn_id='aws_default',
        timeout=60 * 60 * 6,   # 6h max wait
        poke_interval=30,
        # TODO: deferrable=True is set by using the *Async variant; for non-Async sensors,
        # pass deferrable=True explicitly.
    )

# Compare:
# from airflow.providers.amazon.aws.sensors.s3 import S3KeySensor
# legacy = S3KeySensor(..., mode='poke')  # pins a worker slot the whole wait
`),
      validationType: "numeric_tolerance",
      stepType: "code_python",
      validation: validationConfig("numeric_tolerance", "Sim 90-day backfill at max_active_runs=10: deferrable variant pins 0 worker slots during waits; blocking variant pins ≥10. Tolerance ±1 slot.", {
        expected: { deferrablePinnedSlots: 0, blockingPinnedSlots: 10 },
        tolerance: 1,
      }),
      expectedOutputs: { deferrable: 0, blocking: 10, savings: "100%" },
      datasetRefs: ["fixtures/backfill_sim.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Deferrable sensors hand off to the triggerer process — one triggerer handles 1000s of waits.",
          "Non-deferrable sensors in `mode='poke'` pin a worker slot for the full wait — backfills choke.",
          "Always set `timeout` — without it, a missing upstream blocks forever.",
          "If the operator has an `Async` variant, prefer it over passing `deferrable=True` (cleaner API).",
          "S3KeySensorAsync(...)  # frees the slot during wait",
        ],
        successFeedback: "90-day backfills no longer starve workers. Slot accounting tracks real work.",
        failureFeedback: "Common slips: mode='poke' (slot starvation); no timeout (forever-pending); reschedule mode (better but still slot-thrashy at scale).",
        portfolioRelevance: "Deferrable operators are the Airflow 2.x +Asyncio story. Demonstrating the slot math is a senior signal.",
        finalExplanation: "Deferrable operators are the reason Airflow 2.x can run 1000s of concurrent DAGs. Use them.",
        misconceptionToWatchFor: "Assuming reschedule mode is 'good enough'. It's better than poke but still wakes a worker every poke interval.",
      }),
    },
    {
      stepNumber: 3,
      title: "dbt build via BashOperator with selectors",
      instructionMd:
        "Add a `dbt_build` task that runs `dbt build --select +mart_daily_events --vars '{run_date: {{ ds }}}'` via BashOperator after extract. Validator runs the task against a 5-model dbt project and asserts: only `mart_daily_events` + its upstreams ran (not the whole project), the `run_date` Jinja var resolved to `{{ ds }}` correctly, exit code 0.",
      learningObjective: "Per-DAG-run dbt build with selectors keeps DAG runtime tied to data dependencies, not the whole warehouse.",
      requiredSkill: "dbt selectors (+model, model+) + Airflow Jinja + BashOperator env passing",
      starterCode: SRC(`# tasks/dbt.py
from airflow.operators.bash import BashOperator

def dbt_build(target_model: str = 'mart_daily_events') -> BashOperator:
    return BashOperator(
        task_id='dbt_build',
        bash_command=(
            "cd /opt/dbt && "
            "dbt build "
            f"--select +{target_model} "
            "--vars '{run_date: {{ ds }}}' "  # Jinja templated at run time
            "--profiles-dir /opt/dbt/profiles"
        ),
        env={'DBT_PROFILES_DIR': '/opt/dbt/profiles'},
        append_env=True,
    )

# Why not run the whole project?
# dbt build with no select = rebuild everything on every DAG run.
# Selector +mart_daily_events = mart + all its ancestors.
`),
      validationType: "contains",
      stepType: "code_python",
      validation: validationConfig("contains", "dbt run log mentions: 'Running with dbt', mart_daily_events + at least 1 upstream model, run_date = today, 'Done. PASS'.", {
        expected: ["Running with dbt", "mart_daily_events", "PASS", "run_date"],
      }),
      expectedOutputs: { modelsRun: 3, exitCode: 0 },
      datasetRefs: ["fixtures/dbt_project.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "`+model_name` selects the model + all ancestors; `model_name+` selects descendants too.",
          "Pass `run_date` as a dbt var so models can incrementally filter on it.",
          "Use BashOperator over manually shelling out — Airflow captures stdout/stderr properly.",
          "Pin dbt version in your Docker image; dbt-core changes can break selector semantics.",
          "--select +mart_daily_events --vars '{run_date: {{ ds }}}'",
        ],
        successFeedback: "dbt now runs only the affected slice per DAG run. Runtime stays bounded.",
        failureFeedback: "Common slips: `dbt run` instead of `dbt build` (no tests); no selector (full rebuild); no var pass (incremental models can't filter).",
        portfolioRelevance: "Airflow + dbt orchestration with selectors is a 2026 stack-table-stake. Show the dependency-aware run.",
        finalExplanation: "Selectors are the difference between dbt-as-script and dbt-as-DAG. Use them.",
        misconceptionToWatchFor: "Running `dbt run` in production — without tests, you ship bad data. Always `dbt build`.",
      }),
    },
    {
      stepNumber: 4,
      title: "Backfill safety — max_active_runs + depends_on_past",
      instructionMd:
        "Configure the DAG with `max_active_runs=5`, `catchup=True`, and `depends_on_past=True` on the extract task. Validator simulates a 30-day backfill and asserts: never more than 5 DAG runs active simultaneously, day N's extract waits for day N-1's extract to succeed, and a failure on day 10 blocks days 11+ until resolved.",
      learningObjective: "Backfill discipline = strictly bounded concurrency + ordered execution where needed.",
      requiredSkill: "Airflow DAG-level concurrency + depends_on_past semantics + catchup behavior",
      starterCode: SRC(`# dag.py
from airflow import DAG
from datetime import datetime, timedelta

default_args = {
    'depends_on_past': True,   # task waits for the SAME task on the previous interval
    'retries': 3,
    'retry_delay': timedelta(minutes=5),
}

with DAG(
    dag_id='daily_events_etl',
    schedule_interval='@daily',
    start_date=datetime(2026, 2, 20),
    catchup=True,
    max_active_runs=5,          # bound concurrency during backfill
    default_args=default_args,
    tags=['etl', 'daily', 'phase11'],
) as dag:
    # TODO: wait_for_manifest >> extract >> dbt_build >> dq_gate
    pass
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Sim 30-day backfill: max_concurrent_runs ≤ 5; depends_on_past blocks day N until N-1 success; failure on day 10 blocks 11+.", {
        expected: { maxConcurrent: 5, dependsOnPastHonored: true, failureBlocksDownstream: true },
      }),
      expectedOutputs: { maxConcurrent: 5, dependsOnPast: true, failureBlocks: true },
      datasetRefs: ["fixtures/backfill_sim_30d.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "max_active_runs caps DAG-level concurrency; max_active_tasks caps task-level.",
          "depends_on_past is task-level — use it only for tasks where ordering matters (incremental SQL).",
          "catchup=False = skip historical runs; catchup=True + start_date = run all missed intervals.",
          "Never set retries=0 in production; transient failures cost an entire backfill.",
          "max_active_runs=5",
        ],
        successFeedback: "Backfills are now bounded + ordered. SLA stays predictable even at 90-day re-runs.",
        failureFeedback: "Common slips: catchup=True without max_active_runs (DB connection storm); depends_on_past on stateless tasks (unnecessary serialization); retries=0 (transient = full backfill rerun).",
        portfolioRelevance: "Backfill discipline is the #1 Airflow interview question. Knowing the three knobs cold = senior.",
        finalExplanation: "Backfill is a controlled flood. The three knobs are the flood control.",
        misconceptionToWatchFor: "Setting depends_on_past on every task. Most ETL tasks ARE independent across days; reserve it for genuinely ordered work.",
      }),
    },
    {
      stepNumber: 5,
      title: "Data-quality gate — fail the DAG before downstream sees bad data",
      instructionMd:
        "Add a `dq_gate` task after dbt that runs 3 SQL assertions on `mart_daily_events`: (1) row count > 0, (2) no NULL `user_id`, (3) `event_date = {{ ds }}` for all rows. The task raises `AirflowFailException` (no retry) if any assertion fails. Validator runs against (a) a clean fixture → success; (b) a fixture with 10 NULL user_ids → failure with the specific assertion in the log; assertion (1)/(3) tested similarly.",
      learningObjective: "DQ gates are the cheapest insurance against downstream-broken dashboards.",
      requiredSkill: "AirflowFailException (no retry) + SQL assertions + clear error messages",
      starterCode: SRC(`# tasks/dq.py
import psycopg
from airflow.exceptions import AirflowFailException

ASSERTIONS = [
    ('rows_present', "SELECT COUNT(*) FROM mart_daily_events WHERE event_date = %s", lambda c: c > 0, "row count must be > 0"),
    ('no_null_user', "SELECT COUNT(*) FROM mart_daily_events WHERE user_id IS NULL AND event_date = %s", lambda c: c == 0, "user_id must not be NULL"),
    ('date_match',  "SELECT COUNT(*) FROM mart_daily_events WHERE event_date <> %s",        lambda c: c == 0, "all rows must match execution_date"),
]

def dq_gate(execution_date_str: str, conn_str: str) -> None:
    failures = []
    with psycopg.connect(conn_str) as conn, conn.cursor() as cur:
        for name, sql, predicate, msg in ASSERTIONS:
            cur.execute(sql, (execution_date_str,))
            value = cur.fetchone()[0]
            if not predicate(value):
                failures.append(f"{name}: {msg} (got {value})")
    if failures:
        # TODO: AirflowFailException prevents retries — DQ failures aren't transient.
        raise AirflowFailException("DQ gate failed:\\n" + "\\n".join(failures))
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Clean fixture: dq_gate returns None. Fixture with 10 NULL user_ids: AirflowFailException raised, message names 'no_null_user' assertion + count=10.", {
        expected: { cleanPasses: true, nullsFailWithNamedAssertion: true, exceptionType: "AirflowFailException" },
      }),
      expectedOutputs: { cleanPass: true, nullsFail: "no_null_user" },
      datasetRefs: ["fixtures/dq_cases.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Use `AirflowFailException` (NOT generic Exception) so Airflow respects 'don't retry on this'.",
          "Surface ALL failed assertions, not just the first — devs want the full picture.",
          "Parameterize SQL with execution_date, not hardcoded today — backfill safety.",
          "DQ gates run BEFORE downstream — they're the last line of defense, not after-the-fact alerts.",
          "raise AirflowFailException(...)  # bypasses retry; DQ failures aren't transient",
        ],
        successFeedback: "Downstream consumers never see bad data; the DAG fails loud, fast, and once.",
        failureFeedback: "Common slips: generic Exception (retried 3x → 3 alerts); first-failure-only (incomplete picture); post-publish DQ (Slack alerts arrive after dashboards already lied).",
        portfolioRelevance: "DQ gates with named assertions are a senior-DE pattern. Show 3-5 well-chosen checks.",
        finalExplanation: "DQ gates are insurance. Cheap to write, free to skip — until you ship NULL user_id to the CFO's dashboard.",
        misconceptionToWatchFor: "Relying on dbt tests alone. dbt tests run with the build; standalone DQ gates run after and can check cross-table invariants.",
      }),
    },
  ],
};
