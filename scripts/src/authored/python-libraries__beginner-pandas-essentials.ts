/**
 * Phase 14 — python-libraries beginner-tier seed (net-new). Lifts the
 * visible `beginner` count toward 6 and gives Python-libraries learners
 * a true entry-tier on-ramp before the existing intermediate FastAPI/
 * Pydantic work.
 *
 * Candidate 434d885b-6d1d-46b6-b922-88bbcfc6e383 — pandas essentials on
 * a small sales CSV: read, filter, project/rename, groupby+agg, write.
 * Every step verifies a CSV output set-equal against a known answer.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const pythonLibrariesBeginnerPandasEssentials: AuthoredProject = {
  slug: "python-libraries-beginner-pandas-essentials",
  candidateId: "434d885b-6d1d-46b6-b922-88bbcfc6e383",
  title: "pandas Beginner — Read, Filter, Group, Write: The Five Moves You'll Repeat Daily",
  shortDescription:
    "Your first 5 pandas operations against a real sales CSV: `read_csv` with explicit dtypes, boolean-mask filtering, column projection + rename, `groupby` with a single agg, and `to_csv` with an ISO date column. Every step's output CSV is verified set-equal against a known answer.",
  fullDescription:
    "pandas has 300+ public methods and almost every intermediate tutorial reaches for 20 of them in chapter 1. This one is the opposite: you'll write exactly the five operations that make up 80% of real-world ETL — read with typed columns (no surprise objects), filter with a boolean mask (not `.query()` magic), keep only the columns you need (and rename them so downstream code is readable), group by one key with one agg, and write a clean CSV with an ISO date column. The dataset is a 20-row sales export so every failure is obvious and every fix is a one-liner. By the end you can take any small CSV and produce a clean reporting CSV without copy-pasting Stack Overflow.",
  language: "python",
  difficulty: "beginner",
  techStack: ["Python", "pandas"],
  tags: ["python", "pandas", "beginner", "csv", "etl", "groupby"],
  learningObjectives: [
    "`read_csv` with explicit `dtype` and `parse_dates` — never trust auto-inference.",
    "Filter rows with a boolean mask: `df[df['x'] > 100]`.",
    "Project + rename columns in one step with `.loc` + `.rename(columns=...)`.",
    "`groupby('key').agg(metric=('col', 'sum'))` — the named-agg pattern that survives upgrades.",
    "`to_csv` with `index=False` + ISO-formatted date column for downstream consumers.",
  ],
  estimatedMinutes: 150,
  xpReward: 450,
  isMultiFile: false,
  meta: projectMeta({
    scenario:
      "Analyst-engineer on a small e-commerce team in 2026. Marketing exports a daily orders CSV from the storefront and you need to produce a clean per-region revenue report. You'll write the script once, version it, and they'll run it every morning.",
    hiringRelevance2026:
      "Read → filter → project → group → write is THE pandas pipeline. Interviewers ask candidates to do exactly this in 20 minutes; failing it ends the screen. A repo showing the 5 idiomatic operations + a clean output CSV is a quietly impressive beginner portfolio piece.",
    readmeOutline: [
      "Overview — the daily marketing report",
      "Setup (uv or pip — pandas pinned)",
      "Step 1: read_csv with explicit types",
      "Step 2: boolean-mask filter",
      "Step 3: project + rename",
      "Step 4: groupby with named agg",
      "Step 5: write reporting CSV (ISO dates)",
      "Portfolio Hand-off (script + sample inputs/outputs)",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with `src/pipeline.py` implementing the 5 steps, `fixtures/orders_raw.csv` (input), `fixtures/region_revenue_expected.csv` (verified output), a one-page README mapping each step to its pandas method, and a `tests/test_pipeline.py` that diffs your output against the expected CSV.",
    portfolioRelevance:
      "A 60-line pandas script that turns raw CSV → clean reporting CSV with a test is the smallest portfolio artefact that proves real-world pandas competence. It runs in seconds, fits on one screen, and a reviewer can re-run it.",
    repoUrl: "https://github.com/<your-handle>/pandas-beginner-five-moves",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "read_csv with explicit dtype + parse_dates — never trust inference",
      instructionMd:
        "Read `fixtures/orders_raw.csv` (columns: `order_id, ordered_at, region, qty, unit_price_cents, status`). Pass `dtype={'order_id': str, 'region': str, 'status': str, 'qty': 'Int64', 'unit_price_cents': 'Int64'}` and `parse_dates=['ordered_at']`. Why explicit types: pandas's inference reads a leading-zero `order_id` like `'00042'` as the int `42`, then writes it back as `42` and breaks every downstream join. Validator: asserts dtypes match exactly + `df.shape == (20, 6)`.",
      learningObjective:
        "Auto-inferred dtypes is the #1 silent bug in pandas ETL. Always pass `dtype=` and `parse_dates=` to `read_csv`.",
      requiredSkill: "pandas.read_csv with explicit dtype + parse_dates",
      starterCode: SRC(`# src/pipeline.py
import pandas as pd
from pathlib import Path

RAW = Path("fixtures/orders_raw.csv")

def load_orders() -> pd.DataFrame:
    # TODO: pass dtype + parse_dates so order_id stays a string, dates parse to datetime64
    return pd.read_csv(RAW)
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "df.shape == (20, 6); dtypes match exactly: order_id=str, ordered_at=datetime64[ns], region=str, qty=Int64, unit_price_cents=Int64, status=str.", {
        expected: {
          shape: [20, 6],
          dtypes: {
            order_id: "object",
            ordered_at: "datetime64[ns]",
            region: "object",
            qty: "Int64",
            unit_price_cents: "Int64",
            status: "object",
          },
        },
      }),
      expectedOutputs: { shape: [20, 6], orderIdStaysString: true },
      datasetRefs: ["fixtures/orders_raw.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "`pd.read_csv(path, dtype={...}, parse_dates=[...])` — the `dtype` dict is column-name → numpy/pandas dtype.",
          "`'Int64'` (capital I, pandas nullable) — NOT `'int64'` (numpy, can't hold NaN). For columns that may be missing in real data, prefer the nullable types.",
          "Strings stay as strings only if you tell pandas. Leading-zero IDs and SKU codes get destroyed silently otherwise.",
          "`parse_dates=['ordered_at']` is enough for ISO-format dates. For weird formats, also pass `date_format=...`.",
          "pd.read_csv(RAW, dtype={'order_id': str, 'region': str, 'status': str, 'qty': 'Int64', 'unit_price_cents': 'Int64'}, parse_dates=['ordered_at'])",
        ],
        successFeedback:
          "Typed read — the only kind of `read_csv` you should commit to a repo.",
        failureFeedback:
          "Most common slips: forgetting `dtype` for order_id (silently becomes int); using `int64` instead of `Int64` (blows up on a real NaN); forgetting `parse_dates` (dates stay as strings and break later).",
        portfolioRelevance:
          "Showing typed `read_csv` in your README is a quietly senior signal — most beginner code skips it and gets bitten in production.",
        finalExplanation:
          "Treat `read_csv` like a database CREATE TABLE: declare every column's type up-front. The 4 extra keystrokes save you 4 hours of 'why are my joins empty' debugging.",
        misconceptionToWatchFor:
          "Believing pandas's inference is good enough. It is — until a column with a leading zero arrives and silently becomes an int. Always declare.",
      }),
    },
    {
      stepNumber: 2,
      title: "Boolean-mask filter — keep paid orders only",
      instructionMd:
        "Write `keep_paid(df)` returning the subset of orders where `status == 'paid'`. Use a boolean mask (`df[df['status'] == 'paid']`), not `.query()` and not `.loc` with a callable. Why: boolean masks are the most-used pandas pattern in production — they're the easiest to read, debug (just print the mask), and chain. Validator: returned df has 14 rows (6 are 'cancelled' or 'refunded').",
      learningObjective:
        "Boolean-mask filtering is the #1 pandas pattern in real code. Master it before exploring `.query()` and `.loc[callable]`.",
      requiredSkill: "Boolean mask construction + dataframe subsetting",
      starterCode: SRC(`# src/pipeline.py (continued)

def keep_paid(df: pd.DataFrame) -> pd.DataFrame:
    # TODO: return df filtered to status == 'paid'
    return df
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "keep_paid(df) returns a DataFrame with exactly 14 rows; every row has status == 'paid'.", {
        expected: {
          rowCount: 14,
          allStatusPaid: true,
        },
      }),
      expectedOutputs: { rowCount: 14, allPaid: true },
      datasetRefs: ["fixtures/orders_raw.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "`mask = df['status'] == 'paid'` produces a boolean Series; `df[mask]` keeps only True rows.",
          "Multiple conditions: `df[(df['a'] > 0) & (df['b'] == 'x')]` — note `&` not `and`, and parentheses around each clause.",
          "Print `mask.value_counts()` when debugging — tells you immediately how many rows survive.",
          "Avoid `df.query('status == \"paid\"')` for now — boolean masks are more portable across pandas versions.",
          "df[df['status'] == 'paid']",
        ],
        successFeedback:
          "Boolean-mask filtering — the idiomatic pandas way to keep a subset.",
        failureFeedback:
          "Most common slips: using `and`/`or` instead of `&`/`|` (TypeError); forgetting parentheses around each clause when combining conditions; `df[df.status=='paid']` (attribute access) — works, but breaks when column names have spaces.",
        portfolioRelevance:
          "Your portfolio's filter functions should look like one-line boolean masks with type hints. Tiny, readable, testable.",
        finalExplanation:
          "Boolean masks make every filter expressible, debuggable, and chainable. Master them now and 80% of pandas work feels obvious.",
        misconceptionToWatchFor:
          "Reaching for `.query()` because it 'looks like SQL'. It is, but it's a string parser — typos fail at runtime, no IDE help. Boolean masks fail at the right line and your editor catches them.",
      }),
    },
    {
      stepNumber: 3,
      title: "Project + rename — keep only the report columns",
      instructionMd:
        "Write `select_report_columns(df)` returning a DataFrame with exactly these columns in this order: `order_id, region, qty, unit_price_cents`, renamed to `order_id, region, units, unit_price_cents`. Use `.loc[:, [...]]` for the projection and `.rename(columns={...})` for the rename. Why renaming matters: downstream consumers shouldn't know that you internally called it `qty` when they asked for `units`.",
      learningObjective:
        "Projection + rename in one chained step is the canonical 'prepare for downstream' move.",
      requiredSkill: ".loc projection + .rename(columns=...) chaining",
      starterCode: SRC(`# src/pipeline.py (continued)

REPORT_COLS = ["order_id", "region", "qty", "unit_price_cents"]
RENAMES = {"qty": "units"}

def select_report_columns(df: pd.DataFrame) -> pd.DataFrame:
    # TODO: project to REPORT_COLS, then rename qty -> units
    return df
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Returned df has exactly columns [order_id, region, units, unit_price_cents] in that order.", {
        expected: {
          columns: ["order_id", "region", "units", "unit_price_cents"],
          columnCount: 4,
        },
      }),
      expectedOutputs: { columns: ["order_id", "region", "units", "unit_price_cents"] },
      datasetRefs: ["fixtures/orders_raw.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "`df.loc[:, ['a', 'b', 'c']]` projects to those columns in that order — safer than `df[['a','b','c']]` because it's explicit about the row slice (`:`).",
          "`.rename(columns={'old': 'new'})` returns a new df — chain it: `.loc[:, [...]].rename(columns=RENAMES)`.",
          "Never mutate the input df in a beginner pipeline (`df.drop(..., inplace=True)`). Always return new ones — easier to test, easier to compose.",
          "Define column lists as module-level constants (`REPORT_COLS`, `RENAMES`) so the report schema is one grep away.",
          "df.loc[:, REPORT_COLS].rename(columns=RENAMES)",
        ],
        successFeedback:
          "Clean project+rename — your downstream report has a stable, intentional schema.",
        failureFeedback:
          "Most common slips: using `df[REPORT_COLS]` (works, but shadows the row dimension); using `inplace=True` (mutates the caller — surprising, untestable).",
        portfolioRelevance:
          "Putting projection + renames in named constants is what separates a one-off notebook from a reusable pipeline. Reviewers notice.",
        finalExplanation:
          "Internal column names are your business. Public column names are the contract with downstream. Renaming at the boundary keeps internals free to evolve.",
        misconceptionToWatchFor:
          "Believing `inplace=True` is 'faster'. It usually isn't — pandas still allocates internally — and it makes your function unsafe to call inside a chain.",
      }),
    },
    {
      stepNumber: 4,
      title: "groupby with named agg — revenue per region",
      instructionMd:
        "Write `revenue_per_region(df)` that returns a DataFrame with columns `region, total_units, revenue_cents` where `revenue_cents = sum(units * unit_price_cents)` per region. Use the named-agg pattern: `df.groupby('region', as_index=False).agg(total_units=('units','sum'), revenue_cents=('revenue_cents','sum'))` after adding a `revenue_cents` row-level column. Sort by `revenue_cents` DESC for the final output.",
      learningObjective:
        "Named-agg groupby is the modern pandas pattern that survives version upgrades. Pre-compute row-level metrics before aggregating.",
      requiredSkill: "groupby + named agg + row-level metric pre-computation",
      starterCode: SRC(`# src/pipeline.py (continued)

def revenue_per_region(df: pd.DataFrame) -> pd.DataFrame:
    # TODO: 1) add a row-level revenue_cents column (units * unit_price_cents)
    #       2) groupby region with named aggs: total_units (sum of units) + revenue_cents (sum)
    #       3) sort by revenue_cents DESC, reset_index
    return df
`),
      validationType: "csv_set_equal",
      stepType: "code_python",
      validation: validationConfig("csv_set_equal", "Returned df equals fixtures/region_revenue_expected.csv set-wise: columns [region, total_units, revenue_cents], one row per region, sorted by revenue_cents DESC.", {
        expectedCsv: "fixtures/region_revenue_expected.csv",
        columns: ["region", "total_units", "revenue_cents"],
        orderSensitive: true,
      }),
      expectedOutputs: { columns: ["region", "total_units", "revenue_cents"], aggregated: true },
      datasetRefs: ["fixtures/region_revenue_expected.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Add the row-level column FIRST: `df = df.assign(revenue_cents=df['units'] * df['unit_price_cents'])`.",
          "Named-agg form: `.agg(total_units=('units', 'sum'), revenue_cents=('revenue_cents', 'sum'))` — column names on the LEFT, source+func tuples on the RIGHT.",
          "`as_index=False` (or follow up with `.reset_index()`) so `region` is a normal column, not the index — easier to write to CSV.",
          "`.sort_values('revenue_cents', ascending=False)` to top-rank by revenue.",
          "df.assign(revenue_cents=df['units']*df['unit_price_cents']).groupby('region', as_index=False).agg(total_units=('units','sum'), revenue_cents=('revenue_cents','sum')).sort_values('revenue_cents', ascending=False)",
        ],
        successFeedback:
          "Modern named-agg groupby — readable, version-stable, downstream-friendly.",
        failureFeedback:
          "Most common slips: trying to compute `revenue` inside `.agg()` (you can't reference two columns there with the named-agg form); forgetting `as_index=False` (region ends up as the index and `to_csv` includes it as 'Unnamed: 0' downstream).",
        portfolioRelevance:
          "A 1-line aggregation that produces the headline report metric is the most-asked pandas interview pattern. Pin this exact one in your portfolio README.",
        finalExplanation:
          "Pre-compute row-level metrics, then aggregate with named aggs. This pattern reads top-to-bottom like a SQL `SELECT … GROUP BY` and reviewers can scan it in 3 seconds.",
        misconceptionToWatchFor:
          "Trying to write a single-pass aggregation with a lambda (`agg(revenue=lambda g: (g['units']*g['price']).sum())`). It works but it's slow and opaque — pre-compute the column instead.",
      }),
    },
    {
      stepNumber: 5,
      title: "Write reporting CSV — ISO dates, no index, deterministic",
      instructionMd:
        "Write `write_report(df, out_path, run_date)`: prepends a `run_date` column (an ISO-formatted date string `YYYY-MM-DD`), then writes to CSV with `index=False`, `date_format='%Y-%m-%d'`, and `encoding='utf-8'`. Validator: reads the output back with the same explicit dtypes, asserts row count matches input, asserts `run_date` column is present and matches the supplied date in ISO format.",
      learningObjective:
        "`to_csv(index=False, date_format='%Y-%m-%d', encoding='utf-8')` is the production-safe write. Everything else is for notebooks.",
      requiredSkill: "to_csv with explicit format + ISO date column injection",
      starterCode: SRC(`# src/pipeline.py (continued)
from datetime import date

def write_report(df: pd.DataFrame, out_path: str, run_date: date) -> None:
    # TODO: prepend run_date as the first column (ISO string), then to_csv with index=False
    df.to_csv(out_path)
`),
      validationType: "csv_set_equal",
      stepType: "code_python",
      validation: validationConfig("csv_set_equal", "Output CSV exists; reading it back yields the input rows + a leading run_date column of ISO-format strings matching the supplied date.", {
        expectedCsv: "fixtures/region_revenue_with_run_date_expected.csv",
        columns: ["run_date", "region", "total_units", "revenue_cents"],
        orderSensitive: true,
      }),
      expectedOutputs: { hasRunDateColumn: true, isoDateFormat: true, noIndexColumn: true },
      datasetRefs: ["fixtures/region_revenue_with_run_date_expected.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Prepend a column: `df.insert(0, 'run_date', run_date.isoformat())` — `.insert` mutates, but that's fine here because we already received a fresh df.",
          "`to_csv(out_path, index=False)` — `index=False` is the most-forgotten flag in pandas history; without it you get an `Unnamed: 0` column on every re-read.",
          "`date_format='%Y-%m-%d'` ensures any datetime columns serialize as ISO. Even if you don't have one today, set it — habit.",
          "`encoding='utf-8'` is the safe default for cross-platform reading. Don't rely on the OS locale.",
          "df.insert(0, 'run_date', run_date.isoformat()); df.to_csv(out_path, index=False, date_format='%Y-%m-%d', encoding='utf-8')",
        ],
        successFeedback:
          "Production-grade CSV write — deterministic, ISO-dated, no surprise index column.",
        failureFeedback:
          "Most common slips: forgetting `index=False` (downstream tools choke on `Unnamed: 0`); writing the date as a datetime64 object (locale-dependent formatting); skipping encoding (Windows readers get mojibake).",
        portfolioRelevance:
          "A reviewer who opens your output CSV and sees clean columns + ISO dates + no garbage index column immediately trusts the pipeline. That's a 30-second portfolio win.",
        finalExplanation:
          "The 4 keywords `index=False, date_format='%Y-%m-%d', encoding='utf-8'` are the difference between a notebook export and a pipeline output. Always type them.",
        misconceptionToWatchFor:
          "Believing the index is harmless. It isn't — it's a phantom column that downstream consumers (Excel, BI tools, other pandas scripts) mis-interpret as data. Always `index=False` for outputs.",
      }),
    },
  ],
};
