/**
 * Phase 11 batch-3 / data-engineering (skeleton rebuild).
 * Candidate a1f2b6d7-0289-4e33-9567-6f7081920314 — API-to-Warehouse Ingestion
 * with dlt (data load tool) — incremental sync, schema evolution, dedup.
 *
 * Legacy: `api-to-warehouse-ingestion` (2-step skeleton, score 49.9). Full rebuild.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const dataEngineeringApiToWarehouseIngestion: AuthoredProject = {
  slug: "data-engineering-api-to-warehouse-ingestion",
  candidateId: "a1f2b6d7-0289-4e33-9567-6f7081920314",
  title: "API → Warehouse Ingestion with dlt — Incremental + Schema Evolution + Dedup",
  shortDescription:
    "Build a production dlt pipeline that incrementally syncs a paginated REST API into Postgres/Snowflake: cursor-based incremental loads, automatic schema evolution, primary-key deduplication, retry on transient 5xx, and metadata visibility for ops.",
  fullDescription:
    "Hand-rolled API ingestion is the #1 DE time-sink. dlt (data load tool) solves the boring parts — cursors, schema drift, dedup, retries — so you can focus on the API quirks. You'll build a real pipeline with cursor incremental, write_disposition='merge' for upserts, schema contract handling, and operational metadata in `_dlt_loads`. Each step is a real dlt feature backed by a measurable validator.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "dlt", "postgres", "snowflake", "airflow", "pydantic", "dbt"],
  tags: ["dlt", "ingestion", "incremental", "schema-evolution", "merge", "postgres", "snowflake"],
  learningObjectives: [
    "Build a dlt resource with cursor-based incremental sync.",
    "Use write_disposition='merge' with primary_key to dedup correctly.",
    "Handle schema evolution + freeze a schema contract for prod.",
    "Implement retry-with-backoff on transient API failures.",
    "Inspect _dlt_loads / _dlt_pipeline_state for operational visibility.",
  ],
  estimatedMinutes: 200,
  xpReward: 680,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "DE at a 50-person devtools company. The 'simple' Salesforce → warehouse pipeline is 800 lines of artisanal Python that loses rows on every API change. You're swapping it for dlt and proving it handles 90-day backfill + a real schema change without manual fixes.",
    hiringRelevance2026:
      "dlt is the 2026 DE replacement for hand-rolled extractors. Knowing it cold (cursor, merge, schema contract) is now a base-skill for DE roles.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (dlt resource / pipeline / state / contract)",
      "Step 1 cursor incremental", "Step 2 merge + dedup", "Step 3 schema evolution",
      "Step 4 retry + transient errors", "Step 5 operational metadata", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with the dlt pipeline, a docker-compose for a mocked REST API + Postgres, scripts demonstrating 90-day initial load + same-day incremental + a schema-evolution scenario, and SQL queries against _dlt_loads showing per-run row counts + timestamps.",
    portfolioRelevance:
      "A dlt-based pipeline with provable incremental + schema-evo handling is the 2026 DE differentiator. Hand-rolled is the past.",
    repoUrl: "https://github.com/<your-handle>/api-to-warehouse-dlt",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Cursor-based incremental resource",
      instructionMd:
        "Build a dlt resource `@dlt.resource(name='events', primary_key='id')` that yields paginated events from the fixture API, using `dlt.sources.incremental('updated_at', initial_value='2026-01-01')` for cursor tracking. Validator runs the pipeline twice: first run loads 1000 rows (initial), second run (1h later, 50 new rows added) loads exactly 50 rows.",
      learningObjective: "Cursor incremental is the dlt-native pattern — the cursor state survives across runs in dlt's local state.",
      requiredSkill: "dlt resource + incremental() + cursor state persistence",
      starterCode: SRC(`# events_source.py
import dlt, requests

@dlt.resource(name='events', primary_key='id', write_disposition='append')
def events(
    api_url: str = 'http://localhost:8080/events',
    updated_at = dlt.sources.incremental('updated_at', initial_value='2026-01-01T00:00:00Z'),
):
    page = 1
    while True:
        resp = requests.get(api_url, params={
            'updated_after': updated_at.last_value,
            'page': page,
            'limit': 100,
        }, timeout=15)
        resp.raise_for_status()
        batch = resp.json()['data']
        if not batch:
            break
        # TODO: yield batch (dlt handles row-level cursor advance)
        page += 1
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "The first pipeline run loads exactly 1000 rows from the fixture API (full initial load from initial_value='2026-01-01T00:00:00Z').",
          "After adding 50 new rows server-side, a second pipeline run loads exactly 50 rows (cursor advances to the last updated_at seen in run 1).",
          "No duplicate rows appear in the destination table after the second run (primary_key='id' enables dedup).",
          "The dlt cursor state file (.dlt/pipelines/<name>/state.json) reflects the advanced last_value after each run.",
        ],
      }),
      expectedOutputs: { initialRows: 1000, incrementalRows: 50 },
      datasetRefs: ["fixtures/events_api.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "`primary_key` enables dedup; `write_disposition` controls insert/upsert/replace.",
          "Cursor state lives in `.dlt/pipelines/<name>/state.json` — back it up.",
          "Use ISO-8601 cursor values (string-comparable) — never naive datetimes.",
          "`initial_value` is the floor for the FIRST run only; subsequent runs use the stored cursor.",
          "yield batch  # dlt iterates rows + advances cursor based on each row's 'updated_at'",
        ],
        successFeedback: "Pipeline now picks up where it left off — no full re-scans, no missed rows.",
        failureFeedback: "Common slips: forgetting primary_key (no dedup possible); naive datetime cursor (timezone fights); manually managing cursor (defeats dlt's state).",
        portfolioRelevance: "Cursor-incremental + state-persistence is the dlt 'killer feature'. Demo it explicitly in README.",
        finalExplanation: "Incremental is the difference between an ingest pipeline and a re-scan script. dlt makes it 3 lines.",
        misconceptionToWatchFor: "Tracking the cursor in your own table. dlt's state mechanism is the contract; bypassing it loses transactional guarantees.",
      }),
    },
    {
      stepNumber: 2,
      title: "Merge write disposition for upserts",
      instructionMd:
        "Change `write_disposition='merge'` (was 'append') so duplicate `id`s update in place. Validator runs the pipeline once on the fixture (1000 rows), then modifies 100 rows server-side (same ids, new payloads) + adds 50 truly new rows, runs again, and asserts: table row count = 1050 (not 1150), the 100 updated rows have the new payloads, the 50 new rows are present.",
      learningObjective: "merge = primary-key-based upsert; the difference between an ingest pipeline and a duplicate-machine.",
      requiredSkill: "dlt write_disposition='merge' + primary_key + dedup semantics",
      starterCode: SRC(`# events_source.py (updated)
import dlt, requests

@dlt.resource(
    name='events',
    primary_key='id',
    write_disposition='merge',   # was 'append' — flips to upsert by PK
)
def events(
    api_url: str = 'http://localhost:8080/events',
    updated_at = dlt.sources.incremental('updated_at', initial_value='2026-01-01T00:00:00Z'),
):
    page = 1
    while True:
        resp = requests.get(api_url, params={
            'updated_after': updated_at.last_value,
            'page': page, 'limit': 100,
        }, timeout=15)
        resp.raise_for_status()
        batch = resp.json()['data']
        if not batch:
            return
        yield batch
        page += 1
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "After the initial run (1000 rows) followed by a second run (100 updated rows + 50 new rows), SELECT COUNT(*) returns 1050 — not 1150.",
          "The 100 rows with updated payloads reflect the new payload values after the second run (upsert via primary key 'id').",
          "The 50 truly new rows are present in the table.",
          "SELECT COUNT(*) FROM events GROUP BY id HAVING COUNT(*) > 1 returns 0 rows (no duplicate ids).",
        ],
      }),
      expectedOutputs: { rowCount: 1050, duplicates: 0 },
      datasetRefs: ["fixtures/api_round2.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "merge needs a primary_key OR a merge_key — without one, dlt refuses (good).",
          "merge writes to a staging table then atomic-swaps — safe across concurrent reads.",
          "Use 'append' only when ids are guaranteed unique per ingest (event logs, immutable facts).",
          "Use 'replace' when re-loading is cheap + full-refresh is the contract.",
          "write_disposition='merge'",
        ],
        successFeedback: "Updates propagate without duplicates. Pipeline now matches API state faithfully.",
        failureFeedback: "Common slips: 'append' with mutable upstream (silent duplicates accumulate); 'replace' on big tables (slow + breaks downstream during swap); no primary_key (dlt refuses, you bypass with merge_key incorrectly).",
        portfolioRelevance: "Knowing the three write_dispositions cold is base-skill DE. Use the right one.",
        finalExplanation: "merge is the warehouse-grade UPSERT — atomic, dedup'd, swap-safe. Use it unless you have a specific reason not to.",
        misconceptionToWatchFor: "Believing 'append' is faster so always use it. Append + mutable source = silent data corruption.",
      }),
    },
    {
      stepNumber: 3,
      title: "Schema evolution + contract",
      instructionMd:
        "Start with `schema_contract={'tables': 'evolve', 'columns': 'evolve'}`. Run the pipeline; add a new column `priority` server-side; re-run and assert dlt added the column to the table. Then tighten to `schema_contract={'columns': 'freeze'}` and re-run with another new column `category` — assert dlt raises `SchemaContractViolation` (the new column is rejected, no silent drift).",
      learningObjective: "Schema contracts are dlt's anti-drift mechanism — `evolve` for dev, `freeze` (or `discard_value`) for prod.",
      requiredSkill: "dlt schema_contract + tables/columns/data_type modes + violation exceptions",
      starterCode: SRC(`# pipeline.py
import dlt
from dlt.common.exceptions import DltException

# Evolve mode — picks up new columns automatically:
pipeline_dev = dlt.pipeline(
    pipeline_name='events_dev',
    destination='postgres',
    dataset_name='raw',
)
pipeline_dev.run(events(), schema_contract={'tables': 'evolve', 'columns': 'evolve'})

# Freeze mode — rejects new columns:
pipeline_prod = dlt.pipeline(
    pipeline_name='events_prod',
    destination='postgres',
    dataset_name='raw',
)
try:
    # TODO: pipeline_prod.run(events(), schema_contract={'tables': 'evolve', 'columns': 'freeze'})
    pass
except DltException as e:
    print(f"Schema contract violated: {e}")
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "Under schema_contract={'tables':'evolve','columns':'evolve'}: after adding the 'priority' column server-side and re-running, the destination table gains the 'priority' column automatically.",
          "Under schema_contract={'tables':'evolve','columns':'freeze'}: adding a new 'category' column server-side and re-running raises a DltException (SchemaContractViolation) — the column is rejected, not silently dropped.",
          "The evolve run completes without errors and the 'priority' column is queryable in the destination.",
          "The freeze run raises the exception before writing any data containing the rejected column.",
        ],
      }),
      expectedOutputs: { evolveAdded: "priority", freezeRejected: "category" },
      datasetRefs: ["fixtures/schema_evolution.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Schema contracts have 3 axes: tables (new tables), columns (new columns), data_type (type changes).",
          "Default 'evolve' is great for dev; production should freeze critical tables.",
          "'discard_value' silently drops; 'discard_row' silently drops the whole row — use sparingly + alert.",
          "Schema state lives in `.dlt/pipelines/<name>/schemas/` — check into git for visibility.",
          "schema_contract={'tables': 'evolve', 'columns': 'freeze'}",
        ],
        successFeedback: "Schema is now under explicit contract. No more silent column drift in prod.",
        failureFeedback: "Common slips: 'evolve' in prod (drift hides behind dbt failures hours later); 'discard_value' without alerting (silent data loss); not checking schema state into git (audit pain).",
        portfolioRelevance: "Schema contracts are the 2026 anti-drift pattern. Most teams discover drift in dashboards.",
        finalExplanation: "Drift is the silent killer of analytics. Contracts make it loud + fast.",
        misconceptionToWatchFor: "Trusting the upstream API not to change. Every API changes. Plan for it.",
      }),
    },
    {
      stepNumber: 4,
      title: "Retry with exponential backoff on transient errors",
      instructionMd:
        "Wrap the API call with `tenacity` retry: 5 attempts, exponential backoff 1s→16s, retry only on `requests.HTTPError` where `response.status_code in {429, 500, 502, 503, 504}`. Validator simulates an API that returns 503 the first 3 calls then succeeds, and asserts: pipeline completes successfully, total request count = 4 (3 fails + 1 success).",
      learningObjective: "Distinguish transient (retry) from permanent (don't retry) failures — the basic ops discipline.",
      requiredSkill: "tenacity + selective retry on status codes + exponential backoff",
      starterCode: SRC(`# api_client.py
import requests
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

TRANSIENT_STATUS = {429, 500, 502, 503, 504}

class TransientApiError(Exception):
    pass

@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=1, max=16),
    retry=retry_if_exception_type(TransientApiError),
)
def fetch_with_retry(url: str, params: dict, timeout: int = 15) -> dict:
    resp = requests.get(url, params=params, timeout=timeout)
    if resp.status_code in TRANSIENT_STATUS:
        # TODO: raise TransientApiError(f"{resp.status_code} on {url}") — triggers retry
        pass
    resp.raise_for_status()  # 4xx (except 429) bubbles up immediately
    return resp.json()
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "fetch_with_retry() raises TransientApiError (not HTTPError directly) for status codes in {429, 500, 502, 503, 504} — this triggers tenacity's retry predicate.",
          "With a mocked API returning 503 for the first 3 calls then 200 on the 4th: fetch_with_retry completes successfully with total request count = 4.",
          "Non-transient 4xx codes (e.g., 400, 403, 404) are not retried — resp.raise_for_status() propagates them immediately.",
          "tenacity is configured with stop=stop_after_attempt(5) and wait=wait_exponential(multiplier=1, min=1, max=16) — retries do not exceed 5 attempts or a 16s wait cap.",
        ],
      }),
      expectedOutputs: { requests: 4, succeeded: true },
      datasetRefs: ["fixtures/retry_sim.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Only retry transient codes (5xx + 429); 4xx is the client's bug — retrying just re-fails.",
          "Exponential backoff with cap; otherwise you get backoff-runaway during long outages.",
          "Always log each retry attempt — silent retries hide ops issues.",
          "tenacity > custom retry loops — composes with logging, type-correct, well-tested.",
          "raise TransientApiError(f'{resp.status_code} on {url}')",
        ],
        successFeedback: "Pipeline now survives transient API hiccups without spurious failures.",
        failureFeedback: "Common slips: retry on 4xx (infinite loop on a permanent 400); no max wait (backoff runaway); silent retries (ops blind).",
        portfolioRelevance: "Selective retry is base-skill production code. Show the status-code allowlist explicitly.",
        finalExplanation: "Transient ≠ retry-everything. Discipline matters: classify, then retry the right things.",
        misconceptionToWatchFor: "Retrying every exception. A bug in your code now hides behind 5 failed retries.",
      }),
    },
    {
      stepNumber: 5,
      title: "Operational metadata via _dlt_loads",
      instructionMd:
        "After each pipeline run, query `_dlt_loads` and `_dlt_pipeline_state` to extract: last load timestamp, rows loaded per resource, cursor state. Write a `load_summary(pipeline_name) -> LoadSummary` helper. Validator runs 3 pipeline iterations (1000 / 50 / 25 rows) and asserts the summary reports 3 distinct load_ids, monotonic timestamps, and total rows = 1075.",
      learningObjective: "dlt's metadata tables are the ops-facing audit log — use them.",
      requiredSkill: "dlt metadata schema (_dlt_loads, _dlt_pipeline_state) + operational reporting",
      starterCode: SRC(`# ops.py
import psycopg
from dataclasses import dataclass

@dataclass
class LoadSummary:
    load_id: str
    started_at: str
    rows_per_resource: dict[str, int]
    cursor_state: dict

def load_summary(pipeline_name: str, conn_str: str, schema: str = 'raw') -> list[LoadSummary]:
    summaries: list[LoadSummary] = []
    with psycopg.connect(conn_str) as conn, conn.cursor() as cur:
        cur.execute(f"""
            SELECT load_id, inserted_at::text, status
            FROM {schema}._dlt_loads
            ORDER BY inserted_at DESC LIMIT 50
        """)
        loads = cur.fetchall()
        # TODO: for each load_id, query <resource>__items where _dlt_load_id = load_id
        #       to count rows per resource. Also read cursor state from _dlt_pipeline_state.
    return summaries
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "load_summary() returns 3 LoadSummary entries after 3 sequential pipeline runs (1000 / 50 / 25 rows).",
          "The 3 load_ids are all distinct strings.",
          "The started_at timestamps are monotonically increasing across the 3 runs (run 1 < run 2 < run 3).",
          "Summing rows_per_resource['events'] across all 3 summaries equals 1075 (1000 + 50 + 25).",
          "The cursor_state dict is non-empty and reflects the updated_at value from the latest run.",
        ],
      }),
      expectedOutputs: { loads: 3, totalRows: 1075 },
      datasetRefs: ["fixtures/load_summary.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "`_dlt_loads.status` = 'completed' is the green-build signal; check it per run.",
          "Per-row `_dlt_load_id` joins to `_dlt_loads.load_id` — easy attribution.",
          "Cursor state in `_dlt_pipeline_state.state` is JSON — pretty-print it for ops dashboards.",
          "Export load summaries to Grafana or a dashboards table; don't hide them in the warehouse.",
          "JOIN events e ON e._dlt_load_id = loads.load_id GROUP BY loads.load_id",
        ],
        successFeedback: "Ops now has per-run audit trail without custom logging. dlt does it for you.",
        failureFeedback: "Common slips: ignoring _dlt_loads (no audit); custom logging instead of dlt-native (re-implements); not surfacing state (silent stale cursor).",
        portfolioRelevance: "Showing the metadata-driven ops view is what separates 'used dlt' from 'understands dlt'.",
        finalExplanation: "Metadata is half the dlt value-prop. Use it, surface it, alert on it.",
        misconceptionToWatchFor: "Treating dlt as a black box. The metadata tables are the public contract.",
      }),
    },
  ],
};
