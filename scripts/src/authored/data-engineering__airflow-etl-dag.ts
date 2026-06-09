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
        "Write `extract_daily_events(execution_date, ti)`: fetch the day's events from a paginated API, write to Postgres `events(event_id PK, event_date, payload, ingested_at)` with `INSERT … ON CONFLICT (event_id) DO UPDATE SET payload=EXCLUDED.payload, ingested_at=NOW()`. Self-check: run the task twice for the same execution_date against a 500-row fixture API and confirm: 500 rows after the first run, still 500 rows after the second run (no duplicates), and `ingested_at` updated on the second run.",
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
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "The INSERT uses ON CONFLICT (event_id) DO UPDATE so a second run with the same data does not create duplicate rows.",
          "After the first run against the 500-row fixture, SELECT COUNT(*) FROM events returns 500.",
          "After the second run with the same execution_date and same fixture, SELECT COUNT(*) FROM events still returns 500 (no duplicates).",
          "The ingested_at column is updated to NOW() on the second run (DO UPDATE SET ingested_at = NOW()), confirming re-processing happened.",
          "execution_date (not datetime.now()) is used as the event_date value, so backfills produce correct historical partitions.",
        ],
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
        "Use `S3KeySensorAsync` (deferrable) to wait on `s3://manifests/dt={{ ds }}/manifest.json` before the extract task. Self-check: simulate a 90-day backfill scheduled in parallel (`max_active_runs=10`) and confirm: a blocking `S3KeySensor` would pin 10 worker slots × 90 days = 900 slot-hours, while the deferrable version hands off to the triggerer and pins 0 worker slots during waits.",
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
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Verify that your sensor uses S3KeySensorAsync (deferrable) so that a 90-day backfill at max_active_runs=10 pins 0 worker slots during wait periods, compared to a blocking S3KeySensor which would pin ≥10 slots.",
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
        "Add a `dbt_build` task that runs `dbt build --select +mart_daily_events --vars '{run_date: {{ ds }}}'` via BashOperator after extract. Paste the dbt run log output into the submission field. Atlas checks that the required evidence markers are present in your submission — not that the dbt job otherwise ran correctly, and not your authorship or competence. Required markers: 'Running with dbt', 'mart_daily_events', 'PASS', and 'run_date' must all appear in your log.",
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
      validation: validationConfig("contains", "Atlas checks that the required evidence markers are present in your submission — not that the dbt job otherwise runs correctly, and not your authorship or competence. Markers: 'Running with dbt', 'mart_daily_events', 'PASS', 'run_date'.", {
        needles: ["Running with dbt", "mart_daily_events", "PASS", "run_date"],
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
        "Configure the DAG with `max_active_runs=5`, `catchup=True`, and `depends_on_past=True` on the extract task. Self-check: simulate a 30-day backfill and confirm: never more than 5 DAG runs are active simultaneously, day N's extract waits for day N-1's extract to succeed, and a failure on day 10 leaves days 11+ in the waiting state until day 10 is resolved.",
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
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "The DAG is defined with max_active_runs=5 so a 30-day backfill never schedules more than 5 simultaneous DAG runs.",
          "catchup=True is set so Airflow schedules all historical intervals from start_date.",
          "depends_on_past=True is set in default_args so day N's extract waits for day N-1's extract to succeed before starting.",
          "Simulating a failure on day 10: day 11 and beyond remain in the 'waiting' state until day 10 is manually cleared or re-run successfully.",
        ],
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
        "Add a `dq_gate` task after dbt that runs 3 SQL assertions on `mart_daily_events`: (1) row count > 0, (2) no NULL `user_id`, (3) `event_date = {{ ds }}` for all rows. The task raises `AirflowFailException` (no retry) if any assertion fails. Self-check: run against (a) a clean fixture and confirm no exception is raised; (b) a fixture with 10 NULL user_ids and confirm `AirflowFailException` is raised naming the `no_null_user` assertion; test assertions (1) and (3) similarly with their own bad fixtures.",
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
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "dq_gate() returns None (no exception) when run against a clean fixture with >0 rows, no NULL user_ids, and all event_dates matching execution_date.",
          "dq_gate() raises AirflowFailException (not a generic Exception) when any assertion fails — this prevents Airflow from retrying a non-transient data quality failure.",
          "Running against a fixture with 10 NULL user_ids raises AirflowFailException with the message naming 'no_null_user' and the count 10.",
          "All failed assertion names are included in a single exception message — not just the first failure.",
        ],
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
