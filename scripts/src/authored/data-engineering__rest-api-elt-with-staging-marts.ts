/**
 * Phase 41 — data-engineering INTERMEDIATE seed (net-new). Closes the
 * Intermediate gap the Phase 41 coverage audit surfaced for DE — the
 * course is heavily advanced-skewed and the only Intermediate options
 * skip the foundational "build the ELT pipeline by hand before reaching
 * for a library" pedagogy.
 *
 * Candidate d41a8b1c-5e6f-4071-9a8b-9d0e1f234567 — Hand-rolled REST → Postgres
 * staging → SQL-modelled marts → DQ checks → CLI runner. DELIBERATELY
 * distinct from `data-engineering-api-to-warehouse-ingestion` (which is
 * dlt-library-driven, advanced) — this one teaches WHY the dlt features
 * exist by making the learner build them: paginated extract with backoff,
 * idempotent ON CONFLICT staging, SQL marts, four assertion-style DQ
 * checks, and a CLI runner with structured JSON logs.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const dataEngineeringRestApiEltWithStagingMarts: AuthoredProject = {
  slug: "data-engineering-rest-api-elt-with-staging-marts",
  candidateId: "d41a8b1c-5e6f-4071-9a8b-9d0e1f234567",
  title: "REST API → Postgres ELT with Staging + Marts + DQ — Hand-rolled (Intermediate DE)",
  shortDescription:
    "Build the canonical small-team ELT pipeline by hand before reaching for dlt or Airbyte: paginated REST extract with retry+backoff, idempotent ON CONFLICT staging into Postgres, SQL-modelled marts (window-functioned 'latest revision wins'), four assertion-style DQ checks, and a CLI runner that emits structured JSON logs and a non-zero exit on DQ failure. By the end you understand WHY dlt's primitives exist — because you built each one.",
  fullDescription:
    "Every mid-career data engineer ships a hand-rolled ELT before they ever touch a managed framework — and the discipline learned by building it is the difference between someone who can debug dlt vs. someone who treats it as a black box. You'll extract from a fixture paginated REST endpoint (returning 10 pages with 2 simulated 5xx retries), stage the rows into Postgres using INSERT ON CONFLICT DO UPDATE so re-runs are idempotent, then write a SQL mart that aggregates by region and uses a window function to deduplicate revisions by keeping the most recent. Then four DQ assertions (not-null, unique, accepted-values, row-count-bounds) catch what the SQL alone can't, and a CLI runner orchestrates the whole flow with structured logs + a meaningful exit code. The same shape ships in countless real teams; the discipline is portable to dlt, Meltano, Airbyte the moment you adopt one.",
  language: "python",
  difficulty: "intermediate",
  techStack: ["Python", "PostgreSQL", "psycopg2", "SQL", "requests", "tenacity"],
  tags: ["data-engineering", "intermediate", "elt", "postgres", "rest", "idempotent", "dq", "staging-marts"],
  learningObjectives: [
    "Implement a paginated REST extract with `tenacity` retry + exponential backoff that survives transient 5xx + 429.",
    "Stage rows into Postgres idempotently using `INSERT ... ON CONFLICT (id) DO UPDATE SET ...` so re-runs are safe.",
    "Write a SQL mart with a window function (`ROW_NUMBER() OVER (PARTITION BY ... ORDER BY updated_at DESC)`) to keep the latest revision per natural key.",
    "Author four DQ assertion classes (not_null, unique, accepted_values, row_count_bounds) and return a structured failure list, not a hidden raise.",
    "Wire the pipeline behind a CLI (`python -m elt.run --since YYYY-MM-DD`) that emits per-stage structured JSON logs and exits non-zero on any DQ failure.",
  ],
  estimatedMinutes: 210,
  xpReward: 630,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Mid-level DE at a 30-person fintech. The 'simple' ops dashboard pipeline that ingests a paginated REST API (regional sales rollups) into the warehouse is a 3-step shell script that loses rows on every flaky API hour and silently double-counts on re-runs. You have one sprint to rebuild it as a real ELT — paginated extract with backoff, idempotent stage, SQL mart, DQ gates, CLI with exit codes — before the next on-call rotation.",
    hiringRelevance2026:
      "Every 2026 mid-DE interview includes 'walk me through an idempotent pipeline you built from scratch'. A hand-rolled extract+stage+mart+DQ+CLI with the right primitives (backoff, ON CONFLICT, window-deduped marts, assertion-style DQ) is the answer that proves you understand the layer dlt/Airbyte abstract over.",
    readmeOutline: [
      "Overview — the flaky ops-dashboard pipeline",
      "Setup (uv + docker-compose for fixture API + Postgres)",
      "Step 1 — paginated extract with retry + backoff",
      "Step 2 — idempotent stage with ON CONFLICT",
      "Step 3 — SQL mart with window-deduped 'latest revision'",
      "Step 4 — four DQ assertion classes",
      "Step 5 — CLI runner with structured logs + exit codes",
      "Portfolio Hand-off — README + docker-compose + sample run",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo: `elt/extract.py` (paginated + tenacity backoff), `elt/stage.py` (psycopg2 + ON CONFLICT), `elt/marts/sales_by_region.sql` (window dedup), `elt/dq.py` (4 assertion classes), `elt/run.py` (CLI + structured JSON logs + exit codes), `docker-compose.yml` (fixture API + Postgres), `fixtures/api_pages/*.json`, `tests/` (per-stage unit + end-to-end). README must call out the four primitives + show a sample run log.",
    portfolioRelevance:
      "A small, hand-rolled ELT with the four primitives (backoff / idempotent stage / window-deduped mart / assertion DQ) explicit in the repo structure is the high-signal mid-DE portfolio piece. Reviewers who clone, `docker compose up`, and `python -m elt.run` and see the structured JSON logs immediately know you understand what dlt actually does for you.",
    repoUrl: "https://github.com/<your-handle>/rest-elt-staging-marts",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Paginated extract with retry + exponential backoff",
      instructionMd:
        "Write `elt/extract.py` exposing `fetch_all_pages(base_url: str, since: str) -> tuple[list[dict], dict]` that paginates the fixture API (`GET /sales?since=YYYY-MM-DD&page=N&limit=100`) and returns `(rows, run_metadata)`. Use `tenacity` (`@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8), retry=retry_if_exception_type((requests.HTTPError, requests.ConnectionError)))`) so transient 5xx + 429 + network blips survive. Stop when a page returns an empty `data` array. The fixture API is rigged to return 10 pages of 100 rows each and to inject exactly 2 transient 503s on specific pages — your run metadata must record `pages`, `rows`, and `retries_observed`. Print `run_metadata` as JSON on stdout.",
      learningObjective:
        "Pagination + idempotent retry + structured run metadata is the canonical extract primitive. tenacity is the de-facto Python retry lib; knowing its decorator API cold is a mid-DE base skill.",
      requiredSkill: "tenacity @retry + stop_after_attempt + wait_exponential + retry_if_exception_type + page-loop break-on-empty",
      starterCode: SRC(`# elt/extract.py
import json, requests
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    retry=retry_if_exception_type((requests.HTTPError, requests.ConnectionError)),
)
def _fetch_page(base_url: str, since: str, page: int) -> dict:
    resp = requests.get(base_url, params={"since": since, "page": page, "limit": 100}, timeout=15)
    resp.raise_for_status()
    return resp.json()

def fetch_all_pages(base_url: str, since: str) -> tuple[list[dict], dict]:
    rows: list[dict] = []
    page = 1
    retries_observed = 0
    while True:
        # TODO: call _fetch_page; track retries via tenacity .retry.statistics
        # break when body["data"] is an empty list
        page += 1
        break
    meta = {"pages": page - 1, "rows": len(rows), "retries_observed": retries_observed}
    print(json.dumps(meta))
    return rows, meta
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Run fetch_all_pages against the fixture API and confirm the printed run_metadata JSON shows pages=10, rows=1000, retries_observed=2. Verify tenacity retries fire on the two injected 503s and do not exceed the attempt limit.",
      }),
      expectedOutputs: { pages: 10, rows: 1000, retries_observed: 2 },
      datasetRefs: ["fixtures/api_pages/page_*.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "tenacity's decorator order matters — `retry=retry_if_exception_type(...)` last; `stop=` and `wait=` first.",
          "`wait_exponential(multiplier=1, min=1, max=8)` means 1s, 2s, 4s capped at 8s — the canonical small-team backoff.",
          "Pagination terminates on the first page where `body['data']` is empty. Don't trust a `next` cursor unless the API documents one.",
          "Tenacity exposes `_fetch_page.retry.statistics` after each call — read `attempt_number - 1` to count retries cleanly.",
          "while True: body = _fetch_page(base_url, since, page); if not body['data']: break; rows.extend(body['data']); retries_observed += _fetch_page.retry.statistics.get('attempt_number', 1) - 1; page += 1",
        ],
        successFeedback: "Paginated, retry-resilient extract with explicit run metadata — the foundation every downstream stage relies on.",
        failureFeedback: "Common slips: trusting HTTP status alone (request layer errors raise ConnectionError, not HTTPError); forgetting `timeout=` (pipeline hangs on a flaky API hour); reading the retry counter before the call (always 0).",
        portfolioRelevance: "A README block showing the fixture API's injected 5xx + your structured run metadata is the most-replicated mid-DE 'I built it before adopting dlt' artefact.",
        finalExplanation: "Extract is a contract: rows out + metadata about how the rows were obtained. The metadata is the audit trail; without it, every retry argument with ops becomes hearsay.",
        misconceptionToWatchFor: "Believing 'retry on everything'. Idempotent retries (GETs) are safe; non-idempotent (POST/PUT) need an idempotency key first. Be explicit about which kinds.",
      }),
    },
    {
      stepNumber: 2,
      title: "Idempotent stage to Postgres with ON CONFLICT DO UPDATE",
      instructionMd:
        "Write `elt/stage.py` exposing `stage_rows(rows: list[dict], conn) -> dict` that bulk-inserts into `stg_sales (id, region, amount, updated_at, raw_payload)` with `INSERT ... ON CONFLICT (id) DO UPDATE SET region=EXCLUDED.region, amount=EXCLUDED.amount, updated_at=EXCLUDED.updated_at, raw_payload=EXCLUDED.raw_payload, _staged_at=NOW()`. Use `psycopg2.extras.execute_values` for batching. Return `{'staged': N, 'updated_existing': M}` by checking `xmax = 0` on the RETURNING clause (Postgres convention: `xmax=0` means INSERT, non-zero means UPDATE). Validator runs the stage twice on the same input: first run all 1000 INSERTs, second run all 1000 UPDATEs.",
      learningObjective:
        "Idempotent staging via `ON CONFLICT DO UPDATE` is the one-liner that makes a re-run safe. The `xmax = 0` trick is the standard Postgres way to distinguish insert from update without a separate SELECT.",
      requiredSkill: "psycopg2 execute_values + ON CONFLICT DO UPDATE + EXCLUDED.* + xmax inspection",
      starterCode: SRC(`# elt/stage.py
import json
from psycopg2.extras import execute_values

UPSERT_SQL = """
INSERT INTO stg_sales (id, region, amount, updated_at, raw_payload)
VALUES %s
ON CONFLICT (id) DO UPDATE SET
    region       = EXCLUDED.region,
    amount       = EXCLUDED.amount,
    updated_at   = EXCLUDED.updated_at,
    raw_payload  = EXCLUDED.raw_payload,
    _staged_at   = NOW()
RETURNING (xmax = 0) AS inserted
"""

def stage_rows(rows: list[dict], conn) -> dict:
    values = [(r["id"], r["region"], r["amount"], r["updated_at"], json.dumps(r)) for r in rows]
    # TODO: execute_values with fetch=True, then count inserted vs updated from the RETURNING flags
    return {"staged": 0, "updated_existing": 0}
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Run stage_rows against a live Postgres instance with 1000 fresh rows and confirm the returned dict shows {staged: 1000, updated_existing: 0}. Re-run with the same rows and confirm {staged: 0, updated_existing: 1000}. Verify the xmax=0 split is correct by checking both counts sum to 1000 on each run.",
      }),
      expectedOutputs: {
        firstRun: { staged: 1000, updated_existing: 0 },
        secondRun: { staged: 0, updated_existing: 1000 },
      },
      datasetRefs: ["fixtures/api_pages/page_*.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "`EXCLUDED.<col>` references the row that WOULD have been inserted — that's how UPSERT promotes the new value in the conflict branch.",
          "`execute_values(cur, sql, values, fetch=True)` returns the RETURNING rows — without `fetch=True` you get None and lose the insert/update signal.",
          "`xmax = 0` is true when the row was INSERTed in this command; non-zero when it was UPDATEd. Standard Postgres concurrency-control side-channel.",
          "Always wrap the upsert in a transaction (`with conn: with conn.cursor() as cur:`) so a mid-batch error rolls back cleanly.",
          "inserted_flags = execute_values(cur, UPSERT_SQL, values, fetch=True); inserted = sum(1 for (f,) in inserted_flags if f); updated = len(inserted_flags) - inserted",
        ],
        successFeedback: "Stage is now safe to re-run — no duplicate rows on retries, late-arriving updates overwrite cleanly.",
        failureFeedback: "Common slips: forgetting `ON CONFLICT` (every retry doubles the table); using `DO NOTHING` instead of `DO UPDATE` (late corrections silently dropped); reading inserted/updated counts from `cur.rowcount` (psycopg2 reports the total touched, not the insert/update split).",
        portfolioRelevance: "Reviewers grep your stage code for `ON CONFLICT` first. If it's there with a non-trivial DO UPDATE clause + a RETURNING-based split, you've signalled mid-level competence in one block.",
        finalExplanation: "Idempotency is the property that makes a pipeline operable. You can re-run a stage 100 times and the warehouse state is identical to running it once — that's what 'idempotent' actually means at the row level.",
        misconceptionToWatchFor: "Believing idempotency is 'don't insert duplicates'. It's stronger: identical input must produce identical end-state — including updates to corrected rows.",
      }),
    },
    {
      stepNumber: 3,
      title: "SQL mart — sales_by_region with window-deduped latest revision",
      instructionMd:
        "Author `elt/marts/sales_by_region.sql` that produces a `mart_sales_by_region (region, total_amount, row_count, last_updated_at)` table from `stg_sales`. The stage table contains multiple revisions per `id` (the API ships corrections); the mart must keep only the latest revision per `id` before aggregating. Use a CTE with `ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC) AS rn`, filter `WHERE rn = 1`, then `GROUP BY region`. Validator runs the SQL against a fixture stg_sales (1000 rows, ~120 are duplicate-id revisions) and asserts the resulting region rollup matches the expected per-region totals.",
      learningObjective:
        "Window-based dedup (`ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ... DESC) WHERE rn=1`) is the SQL pattern for 'pick the latest row per key'. It generalises to slowly-changing-dimension Type 2 the moment you keep `rn` instead of filtering on it.",
      requiredSkill: "CTE + ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ... DESC) + GROUP BY + SUM/COUNT/MAX aggregates",
      starterCode: SRC(`-- elt/marts/sales_by_region.sql
-- Inputs: stg_sales(id, region, amount, updated_at, raw_payload, _staged_at)
-- Output: mart_sales_by_region(region, total_amount, row_count, last_updated_at)

CREATE OR REPLACE TABLE mart_sales_by_region AS
WITH latest_revisions AS (
    SELECT
        id, region, amount, updated_at,
        ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC) AS rn
    FROM stg_sales
)
-- TODO: select from latest_revisions WHERE rn = 1, group by region, aggregate
SELECT NULL::TEXT AS region, 0::NUMERIC AS total_amount, 0::BIGINT AS row_count, NOW() AS last_updated_at
WHERE FALSE;
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig("sql_resultset", "After running the mart SQL: mart_sales_by_region has exactly 4 region rows (NA, EMEA, APAC, LATAM); the row_count column sums to 880 (1000 stg rows minus 120 superseded revisions); per-region totals match the expected fixture.", {
        expectedRows: [
          { region: "APAC",  row_count: 210, total_amount_min: 50000, total_amount_max: 80000 },
          { region: "EMEA",  row_count: 230, total_amount_min: 55000, total_amount_max: 85000 },
          { region: "LATAM", row_count: 180, total_amount_min: 40000, total_amount_max: 70000 },
          { region: "NA",    row_count: 260, total_amount_min: 65000, total_amount_max: 95000 },
        ],
        orderSensitive: false,
        rowCountSum: 880,
      }),
      expectedOutputs: { regions: 4, rowCountSum: 880, dedupedRevisions: 120 },
      datasetRefs: ["fixtures/stg_sales_seed.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Two-step pattern: window first (keep ALL rows, label them), filter second (`WHERE rn = 1`), then aggregate. Don't try to do all three in one SELECT.",
          "`PARTITION BY id` means 'group rows by id, but keep them as separate rows'. `ORDER BY updated_at DESC` then `rn=1` means 'pick the most-recent row per id'.",
          "`GROUP BY region` ALWAYS follows the dedup CTE — if you group from `stg_sales` directly you triple-count corrections.",
          "Use `MAX(updated_at)` for `last_updated_at` in the rollup — the dedup CTE already picked the latest row per id, but per region you want the latest across all kept rows.",
          "WITH latest AS (...): SELECT region, SUM(amount) AS total_amount, COUNT(*) AS row_count, MAX(updated_at) AS last_updated_at FROM latest WHERE rn = 1 GROUP BY region;",
        ],
        successFeedback: "Mart now correctly dedupes revisions before aggregating — the headline numbers match the source of truth.",
        failureFeedback: "Common slips: aggregating directly from stg_sales (double-counts every corrected row); using DISTINCT id (loses the row data, can't aggregate); using a self-join on MAX(updated_at) (correct but 10x slower and harder to read).",
        portfolioRelevance: "The CTE + ROW_NUMBER + rn=1 pattern is the most-reviewed SQL pattern in analytics-engineer interviews. Pinning the .sql file in your README signals real warehouse fluency.",
        finalExplanation: "Marts are where the 'L' in ELT happens — staging is faithful (everything the API said), marts are correct (one row per business entity, deduped, aggregated). Two layers, two responsibilities.",
        misconceptionToWatchFor: "Believing 'I already have unique ids so I don't need dedup'. The stage is APPEND-friendly for audit; the mart is where you collapse to one-row-per-entity.",
      }),
    },
    {
      stepNumber: 4,
      title: "Four DQ assertion classes — not_null, unique, accepted_values, row_count_bounds",
      instructionMd:
        "Write `elt/dq.py` exposing four assertion classes (`NotNull(table, column)`, `Unique(table, column)`, `AcceptedValues(table, column, allowed: set[str])`, `RowCountBounds(table, min_rows: int, max_rows: int)`) each with a `.check(conn) -> Failure | None` method returning a structured failure dict or None. Then `run_checks(checks, conn) -> list[dict]` that runs all checks and returns the failure list. Validator runs a fixture with KNOWN failures (`stg_sales` has 3 rows where `region IS NULL`, `mart_sales_by_region` has 5 regions instead of 4 because LATAM appears twice via a deliberate bug, and `mart_sales_by_region` has 5 rows where you expect [4, 4]) and asserts the failure list has exactly 3 entries with the expected `check_name` values.",
      learningObjective:
        "DQ that returns structured failures (not raises) is the difference between a pipeline you can put on a dashboard and one that just dies. Four assertion shapes cover ~90% of real DQ.",
      requiredSkill: "dataclasses + SQL aggregate predicates (`COUNT(*) FILTER (WHERE ... IS NULL)`, `COUNT(DISTINCT ...) != COUNT(*)`) + structured failure dict",
      starterCode: SRC(`# elt/dq.py
from dataclasses import dataclass

@dataclass
class NotNull:
    table: str
    column: str
    def check(self, conn) -> dict | None:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM {self.table} WHERE {self.column} IS NULL")
            n = cur.fetchone()[0]
        if n == 0:
            return None
        return {"check_name": "not_null", "table": self.table, "column": self.column, "violations": n}

@dataclass
class Unique:
    table: str
    column: str
    def check(self, conn) -> dict | None:
        # TODO: COUNT(*) - COUNT(DISTINCT col) > 0 → violation
        return None

@dataclass
class AcceptedValues:
    table: str
    column: str
    allowed: set[str]
    def check(self, conn) -> dict | None:
        # TODO: rows where column NOT IN allowed
        return None

@dataclass
class RowCountBounds:
    table: str
    min_rows: int
    max_rows: int
    def check(self, conn) -> dict | None:
        # TODO: COUNT(*) outside [min_rows, max_rows]
        return None

def run_checks(checks: list, conn) -> list[dict]:
    return [f for c in checks if (f := c.check(conn)) is not None]
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Run run_checks against the rigged fixture database and confirm the returned failure list contains exactly 3 entries: not_null on stg_sales.region (3 violations), unique on mart_sales_by_region.region, and row_count_bounds on mart_sales_by_region. Confirm AcceptedValues does NOT fire (LATAM is in the allowed set). Check that each failure dict has a check_name key.",
      }),
      expectedOutputs: { failureCount: 3, distinctCheckNames: 3 },
      datasetRefs: ["fixtures/dq_rigged_seed.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Return None on PASS — None is the natural 'no failure to report'. Filter to actual failures in `run_checks`.",
          "Use SQL aggregate predicates for cheap DQ — `COUNT(*) FILTER (WHERE ... IS NULL)` is one round-trip vs SELECTing every bad row.",
          "Unique: `SELECT COUNT(*) - COUNT(DISTINCT col) FROM table` — if non-zero, you have duplicates.",
          "AcceptedValues: cast the allowed set into a SQL `WHERE col NOT IN (%s, %s, ...)` parameterised query — never f-string user input.",
          "n_unique = cur.execute('SELECT COUNT(*) - COUNT(DISTINCT '+col+') FROM '+table).fetchone()[0]; if n_unique > 0: return {'check_name': 'unique', 'table': table, 'column': col, 'violations': n_unique}",
        ],
        successFeedback: "DQ now produces a structured failure list — operable, alertable, joinable to incident tickets.",
        failureFeedback: "Common slips: raising on failure (kills the pipeline, no other checks run); printing failures (unstructured, can't alert on); putting check names in free-text (downstream can't grep them).",
        portfolioRelevance: "A `dq.py` with four named assertion classes and a `run_checks` returning a typed failure list is the dbt-tests-equivalent in a hand-rolled repo. Pin it in your README with a sample failure JSON.",
        finalExplanation: "DQ assertions are the contract between you and the next system. Make them structured, named, and re-runnable; never silent and never raises-without-context.",
        misconceptionToWatchFor: "Believing DQ is 'extra polish'. It's the only mechanism by which a corrupted source becomes a triagable ticket instead of a silently-wrong dashboard.",
      }),
    },
    {
      stepNumber: 5,
      title: "CLI runner — structured JSON logs + meaningful exit codes",
      instructionMd:
        "Write `elt/run.py` exposing a CLI: `python -m elt.run --since YYYY-MM-DD --db-url postgresql://...`. Orchestrate: extract → stage → mart → DQ. Emit ONE JSON log line per stage to stdout: `{\"ts\": ..., \"stage\": \"extract\", \"status\": \"complete\", \"metrics\": {...}}`. Exit 0 if all DQ checks pass; exit 2 if any DQ assertion fails; exit 1 on any other error. Paste your terminal output into the submission — Atlas checks that it contains a JSON line with `\"stage\": \"dq\"` and `dq_failures`. Atlas does not run your CLI or verify the exit code; verify that yourself before submitting.",
      learningObjective:
        "A CLI with structured JSON logs + meaningful exit codes is the contract with ops. The exit code is the alert signal; the JSON logs are the audit trail; together they replace 5 dashboards with `tail -f | jq` + `if [ $? -ne 0 ]; then page; fi`.",
      requiredSkill: "argparse + per-stage structured logging dict + sys.exit with semantic codes",
      starterCode: SRC(`# elt/run.py
import argparse, json, sys, time
import psycopg2
from elt.extract import fetch_all_pages
from elt.stage import stage_rows
from elt.dq import NotNull, Unique, AcceptedValues, RowCountBounds, run_checks

def log(stage: str, status: str, **metrics) -> None:
    print(json.dumps({"ts": time.time(), "stage": stage, "status": status, "metrics": metrics}))

def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="elt.run")
    parser.add_argument("--since", required=True)
    parser.add_argument("--db-url", required=True)
    parser.add_argument("--api-url", default="http://localhost:8080/sales")
    args = parser.parse_args(argv)
    conn = psycopg2.connect(args.db_url)
    try:
        rows, meta = fetch_all_pages(args.api_url, args.since)
        log("extract", "complete", **meta)
        stage_meta = stage_rows(rows, conn); conn.commit()
        log("stage", "complete", **stage_meta)
        # TODO: run the mart SQL file, log "mart"
        checks = [
            NotNull("stg_sales", "region"),
            Unique("mart_sales_by_region", "region"),
            AcceptedValues("mart_sales_by_region", "region", {"NA","EMEA","APAC","LATAM"}),
            RowCountBounds("mart_sales_by_region", 4, 4),
        ]
        failures = run_checks(checks, conn)
        log("dq", "complete", dq_failures=len(failures), failures=failures)
        return 2 if failures else 0
    except Exception as exc:
        log("error", "failed", err=str(exc))
        return 1
    finally:
        conn.close()

if __name__ == "__main__":
    sys.exit(main())
`),
      validationType: "contains",
      stepType: "code_python",
      validation: validationConfig("contains", "Atlas checks that the required evidence markers are present in your submission — not that the service otherwise behaves correctly, and not your authorship or competence. Note: exit code 2 is not enforced by Atlas; verify it yourself.", {
        needles: ["\"stage\": \"dq\"", "dq_failures"],
      }),
      expectedOutputs: { stagedLogged: true, dqLogged: true, exitCodeOnFailure: 2 },
      datasetRefs: ["fixtures/dq_rigged_seed.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "One JSON line per stage — never multi-line pretty-print. Ops greps for `\"status\": \"complete\"` per stage.",
          "Exit codes are semantic: 0 = clean run, 1 = unexpected crash, 2 = DQ assertion fired. Anything else is undefined.",
          "Wrap the connection in `try/finally` so a mid-stage exception still releases the pool slot.",
          "`argparse` defaults: every flag the README mentions should have a sensible default for the docker-compose case so reviewers can `python -m elt.run --since 2026-01-01` without other flags.",
          "Use `if failures: return 2` — short-circuit on first non-empty failure list, do not silently log-and-pass.",
        ],
        successFeedback: "CLI now ships per-stage structured logs + a meaningful exit code — operable from any orchestrator (cron, Airflow, Argo, GitHub Actions).",
        failureFeedback: "Common slips: print()ing unstructured text (ops can't alert on it); always exiting 0 (ops can't page on it); not closing the connection in `finally` (pool leak under errors).",
        portfolioRelevance: "A README block showing one sample run with the 4 JSON log lines + the non-zero exit code is the closing argument for the project. Reviewers see operability in 10 seconds.",
        finalExplanation: "A CLI is the interface between your pipeline and the rest of the infra world. Structured logs + exit codes is the lowest-common-denominator API every orchestrator understands.",
        misconceptionToWatchFor: "Believing 'logging is for debugging'. In a production pipeline, the structured logs ARE the API — dashboards, alerts, postmortems all read them.",
      }),
    },
  ],
};
