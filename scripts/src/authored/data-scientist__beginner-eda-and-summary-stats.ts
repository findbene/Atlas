/**
 * Phase 14 — data-scientist beginner-tier seed (net-new). Lifts the
 * visible `beginner` count toward 6 and gives DS learners a true entry-
 * tier on-ramp before the intermediate A/B-test / causal-inference work.
 *
 * Candidate 100f741c-1ca3-4dcd-8b85-84d0d54b3258 — the universal first
 * data-science deliverable: load → schema audit → null/dupe count →
 * per-column summary → groupwise summary → correlation matrix + top
 * pair. All steps use `self_attest` validation (learner self-verifies numeric outputs).
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const dataScientistBeginnerEdaAndSummaryStats: AuthoredProject = {
  slug: "data-scientist-beginner-eda-and-summary-stats",
  candidateId: "100f741c-1ca3-4dcd-8b85-84d0d54b3258",
  title: "EDA + Summary Stats (Beginner DS) — The 5-Step Audit Every Dataset Deserves",
  shortDescription:
    "The first 5 things a data scientist does with any new dataset: read + schema audit, null/dupe counts, per-column summaries (mean / median / std), groupwise comparison, correlation matrix + top correlated pair. Every step gives you concrete expected values to check your output against.",
  fullDescription:
    "Most data-science courses leap to scikit-learn before the learner has ever properly looked at the data. This one does the opposite: you'll walk a real (small) tabular dataset through the five steps every senior DS does in the first 30 minutes with new data — load + schema audit (right types? expected shape?), null + duplicate audit (where's the data missing? where are the dupes?), per-column central-tendency + spread, groupwise summary stats (does the metric differ by segment?), and a correlation matrix with the strongest pair pulled out. Every numeric output is validated to a small tolerance against a known answer, so when you fix a bug you see the number move. By the end you have a reusable EDA notebook template that scales to real work.",
  language: "python",
  difficulty: "beginner",
  techStack: ["Python", "pandas", "numpy"],
  tags: ["data-scientist", "beginner", "eda", "stats", "pandas", "correlation"],
  learningObjectives: [
    "Audit a dataset's schema (types, shape) and call out anything unexpected — the 'what is this?' baseline.",
    "Quantify missingness per column + identify duplicate rows on the natural key.",
    "Compute per-column central tendency (mean, median) and spread (std) — the universal summary triple.",
    "Compare a metric across groups (`.groupby().agg()`) and read the result like a comparison table.",
    "Compute a numeric correlation matrix, pull out the strongest off-diagonal pair, and resist over-interpreting it.",
  ],
  estimatedMinutes: 150,
  xpReward: 450,
  isMultiFile: false,
  meta: projectMeta({
    scenario:
      "Junior DS on a 2026 fintech team. Product hands you a 200-row sample of transactions and asks 'is there anything interesting in this?'. Your first deliverable is a clean EDA notebook — schema, nulls, summary stats, segment comparison, top correlation — that becomes the team's template for every future hand-off.",
    hiringRelevance2026:
      "EDA fluency is the DS interview filter under the modelling questions. Showing a 5-cell notebook that audits → describes → compares → correlates is a quietly strong beginner DS portfolio piece.",
    readmeOutline: [
      "Overview — the 30-minute EDA template",
      "Setup (uv / pip)",
      "Step 1: schema audit",
      "Step 2: null + duplicate audit",
      "Step 3: per-column summary stats",
      "Step 4: groupwise summary",
      "Step 5: correlation matrix + top pair",
      "Portfolio Hand-off (notebook + README)",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo: `notebooks/eda.ipynb` running the 5 steps end-to-end, `src/eda.py` exposing the same 5 functions importable for tests, `fixtures/transactions.csv` (200 rows), `fixtures/eda_expected.json` (every numeric output your tests pin to), `tests/test_eda.py` running each step + asserting numeric outputs within tolerance. README explains the 5-step audit template in plain English.",
    portfolioRelevance:
      "A reproducible EDA notebook + matching `.py` module + numeric tests is exactly the artefact a DS hiring loop wants to see at the entry level. It proves you can BOTH explore AND ship reusable code.",
    repoUrl: "https://github.com/<your-handle>/eda-beginner-ds",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Schema audit — `.info()` + `.shape` + `.dtypes`",
      instructionMd:
        "Read `fixtures/transactions.csv` (columns: `txn_id, user_id, amount_cents, category, ts`) with explicit dtypes (`txn_id: str, user_id: str, amount_cents: 'Int64', category: str`) and `parse_dates=['ts']`. Write `schema_summary(df)` returning a dict: `{rows, columns, dtypes: {col: dtype_str}}`. Self-verify: `rows == 200`, `columns == 5`, and each dtype string matches the expected value from `fixtures/eda_expected.json`.",
      learningObjective:
        "First 30 seconds with any dataset: how many rows, how many columns, what types? Without this, every later analysis is dead-reckoning.",
      requiredSkill: "read_csv with explicit dtype + parse_dates + .info()/.shape/.dtypes summary",
      starterCode: SRC(`# src/eda.py
import pandas as pd
from pathlib import Path

CSV = Path("fixtures/transactions.csv")

def load() -> pd.DataFrame:
    return pd.read_csv(
        CSV,
        dtype={"txn_id": str, "user_id": str, "amount_cents": "Int64", "category": str},
        parse_dates=["ts"],
    )

def schema_summary(df: pd.DataFrame) -> dict:
    # TODO: return {"rows": ..., "columns": ..., "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()}}
    return {}
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "schema_summary(df)['rows'] == 200 and schema_summary(df)['columns'] == 5.",
          "schema_summary(df)['dtypes']['txn_id'] == 'object' and 'user_id' == 'object' (strings, not ints).",
          "schema_summary(df)['dtypes']['amount_cents'] == 'Int64' (nullable integer, capital I).",
          "schema_summary(df)['dtypes']['ts'] == 'datetime64[ns]' (parsed from string, not left as object).",
          "schema_summary(df)['dtypes']['category'] == 'object'.",
        ],
      }),
      expectedOutputs: { rows: 200, columns: 5 },
      datasetRefs: ["fixtures/transactions.csv", "fixtures/eda_expected.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "`df.shape` returns `(rows, cols)` — unpack it: `rows, cols = df.shape`.",
          "`df.dtypes` is a Series mapping column → numpy/pandas dtype. Cast each to `str()` for JSON-serialisable output.",
          "`df.info()` is great in a notebook but doesn't return a value — for tests, prefer building the summary dict yourself.",
          "Explicit dtypes at read time means schema_summary tells you 'what you asked for', not 'what pandas guessed'.",
          "{ 'rows': int(df.shape[0]), 'columns': int(df.shape[1]), 'dtypes': {c: str(t) for c, t in df.dtypes.items()} }",
        ],
        successFeedback:
          "Schema audit done — you now KNOW what's in the dataset before you analyse it. That's the seniority gap closed.",
        failureFeedback:
          "Most common slips: skipping explicit dtypes (then schema audit reports pandas's guesses, not the truth); putting the audit only in `.info()` print (not return-able for tests).",
        portfolioRelevance:
          "A `schema_summary()` function pinned at the top of every EDA notebook is the senior signal — 'I check before I analyse'.",
        finalExplanation:
          "Audit before action. The 30 seconds you spend confirming shape + types saves the 30 minutes you'd spend debugging a downstream surprise.",
        misconceptionToWatchFor:
          "Believing you can skip the audit because 'it's just a small CSV'. The small CSV is exactly where shape surprises hide — there's no scale-up alarm to catch them.",
      }),
    },
    {
      stepNumber: 2,
      title: "Null + duplicate audit",
      instructionMd:
        "Write `null_and_dupe_audit(df)` returning `{nulls_per_col: {col: n}, total_nulls: N, duplicate_rows_on_natural_key: K}` where the natural key is `txn_id`. Use `df.isna().sum()` and `df.duplicated(subset=['txn_id'], keep=False).sum()` (`keep=False` so BOTH rows in a duplicate pair are counted, which is what you actually want to surface).",
      learningObjective:
        "Quantify what's missing (per column) and what's duplicated (on natural key) — the two most common data-quality bugs.",
      requiredSkill: ".isna().sum() + .duplicated(subset, keep=False).sum()",
      starterCode: SRC(`# src/eda.py (continued)

def null_and_dupe_audit(df: pd.DataFrame, natural_key: str = "txn_id") -> dict:
    # TODO: nulls_per_col = df.isna().sum() -> {col: int(n)}
    #       total_nulls   = int(df.isna().sum().sum())
    #       duplicate_rows_on_natural_key = int(df.duplicated(subset=[natural_key], keep=False).sum())
    return {}
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "null_and_dupe_audit(df) returns a dict with keys nulls_per_col (int count per column), total_nulls (total missing values across all columns), and duplicate_rows_on_natural_key (count of rows that share a txn_id with at least one other row). Counts must match fixtures/eda_expected.json.",
      }),
      expectedOutputs: { hasNullsBreakdown: true, hasDupeCount: true },
      datasetRefs: ["fixtures/transactions.csv", "fixtures/eda_expected.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "`df.isna().sum()` per column. Double-sum for grand total: `df.isna().sum().sum()`.",
          "`keep=False` in `duplicated` flags ALL duplicate rows — usually what you want for a surface count. `keep='first'` excludes the first occurrence (useful when dropping).",
          "Cast counts to `int()` explicitly — pandas Series of numpy.int64 isn't JSON-serialisable as-is.",
          "If `duplicate_rows_on_natural_key > 0`, your natural key isn't unique — that's a finding to report, not a bug to silently fix.",
          "int(df.duplicated(subset=[natural_key], keep=False).sum())",
        ],
        successFeedback:
          "Null + dupe audit done — these two numbers determine whether the dataset is trustworthy at all.",
        failureFeedback:
          "Most common slips: using `df.duplicated()` without `subset=` (only catches fully-identical rows); using `keep='first'` and being surprised when the count is off-by-N from what eyes-on-data suggests.",
        portfolioRelevance:
          "A clean 3-number audit block at the top of your EDA notebook is the senior signal: 'I asked the trust-quality questions before the modelling questions'.",
        finalExplanation:
          "Every dataset has missing data and duplicate rows somewhere. Surfacing both with explicit numbers IS the work — don't bury them in `.info()`.",
        misconceptionToWatchFor:
          "Believing 'no nulls' = 'good data'. It might mean someone upstream silently filled NaNs with `0` or `-1`, which is a much worse problem hidden behind a clean count.",
      }),
    },
    {
      stepNumber: 3,
      title: "Per-column summary stats — mean, median, std",
      instructionMd:
        "Write `summary_stats(df, cols)` returning `{col: {mean, median, std}}` for each numeric column in `cols`. Use `df[col].mean()`, `df[col].median()`, `df[col].std(ddof=1)` (sample std, the pandas default — be explicit). Round to 2 decimals. For our dataset, `cols = ['amount_cents']`.",
      learningObjective:
        "Mean + median + std together tell you central tendency AND whether the distribution is symmetric. One alone is misleading.",
      requiredSkill: ".mean()/.median()/.std() + rounding + dict construction",
      starterCode: SRC(`# src/eda.py (continued)

def summary_stats(df: pd.DataFrame, cols: list[str]) -> dict:
    # TODO: for each col, return {'mean': round(..., 2), 'median': round(..., 2), 'std': round(df[col].std(ddof=1), 2)}
    return {}
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "summary_stats(df, ['amount_cents']) returns {'amount_cents': {'mean': <float>, 'median': <float>, 'std': <float>}} rounded to 2 decimal places. Values must match fixtures/eda_expected.json summary_stats.amount_cents within ±0.01 for mean, median, and std.",
      }),
      expectedOutputs: { hasMean: true, hasMedian: true, hasStd: true },
      datasetRefs: ["fixtures/transactions.csv", "fixtures/eda_expected.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "`df[col].std(ddof=1)` = sample standard deviation (n-1 denominator). pandas default. NumPy default is `ddof=0`. Always be explicit.",
          "Mean ≈ median → roughly symmetric distribution. Mean ≫ median → right-skewed (long tail of large values). Mean ≪ median → left-skewed.",
          "`round(x, 2)` for display. When comparing floats in your own tests, allow a small tolerance (±0.01) rather than strict equality — float arithmetic is not bit-exact.",
          "`df.describe()` returns all of these and more in a DataFrame — great for notebooks, but for testable code, build the dict yourself.",
          "{'mean': round(df[col].mean(), 2), 'median': round(df[col].median(), 2), 'std': round(df[col].std(ddof=1), 2)}",
        ],
        successFeedback:
          "Mean + median + std for each numeric column — the universal central-tendency-and-spread triple every data scientist memorises.",
        failureFeedback:
          "Most common slips: not specifying `ddof` (test passes today, fails when someone switches to numpy); reporting only mean (hides skew); not rounding (notebook prints look noisy).",
        portfolioRelevance:
          "Showing all three values + a one-sentence interpretation ('right-skewed, suggests a few large transactions dominate') is the entry-level senior signal.",
        finalExplanation:
          "Mean alone is a number. Mean + median + std is a story about the distribution. Always tell the story.",
        misconceptionToWatchFor:
          "Believing mean is the 'right' centrality measure. It often isn't — for skewed distributions (money, durations, counts) the median is more representative.",
      }),
    },
    {
      stepNumber: 4,
      title: "Groupwise summary — mean amount per category",
      instructionMd:
        "Write `groupwise_mean(df, group_col, value_col)` returning `{group_value: mean_amount}` rounded to 2 decimals. For our dataset: `group_col='category', value_col='amount_cents'`. Use `df.groupby(group_col)[value_col].mean()`. Validator: each per-category mean matches the expected JSON within ±0.01.",
      learningObjective:
        "Groupwise comparison is the second-most-asked DS analysis question after 'what's the average?'. Get fluent with `groupby().agg()`.",
      requiredSkill: "df.groupby(col)[metric].mean() + dict conversion + rounding",
      starterCode: SRC(`# src/eda.py (continued)

def groupwise_mean(df: pd.DataFrame, group_col: str, value_col: str) -> dict:
    # TODO: return df.groupby(group_col)[value_col].mean().round(2).to_dict()
    return {}
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "groupwise_mean(df, 'category', 'amount_cents') returns a dict {category_value: mean_amount} rounded to 2 decimal places. Each per-category mean must match fixtures/eda_expected.json groupwise_mean.amount_by_category within ±0.01.",
      }),
      expectedOutputs: { hasPerCategoryMean: true },
      datasetRefs: ["fixtures/transactions.csv", "fixtures/eda_expected.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "`df.groupby('category')['amount_cents'].mean()` returns a Series indexed by category.",
          "`.round(2).to_dict()` converts to a plain `{category: mean}` dict — JSON-serialisable.",
          "For more than one metric per group, use `.agg(mean=('amount_cents','mean'), count=('amount_cents','count'))` — the named-agg form.",
          "If a group has all-NaN values, mean returns NaN — surface it, don't silently fillna(0).",
          "df.groupby(group_col)[value_col].mean().round(2).to_dict()",
        ],
        successFeedback:
          "Per-group mean — the answer to 'does this metric differ by segment?'. Half of all DS exploratory questions live here.",
        failureFeedback:
          "Most common slips: forgetting `.round()` (output dict has float noise that breaks tests); using `.sum()` when the question called for `.mean()`.",
        portfolioRelevance:
          "Pair the dict output with a 1-line interpretation in your notebook ('grocery transactions average 4× lower than electronics'). That's the analyst voice reviewers look for.",
        finalExplanation:
          "Groupby + agg is the analyst's hammer. Reach for it whenever the question contains 'per X' or 'by Y'.",
        misconceptionToWatchFor:
          "Believing a single per-group mean is enough to draw conclusions. It isn't — also check group sizes (`.count()`); a group of 2 with a wild mean is noise, not signal.",
      }),
    },
    {
      stepNumber: 5,
      title: "Correlation matrix + strongest off-diagonal pair",
      instructionMd:
        "Add a derived numeric column `hour_of_day = df['ts'].dt.hour`. Write `top_correlation(df, numeric_cols)` returning `{matrix: {col_a: {col_b: pearson_r_rounded_2}}, top_pair: {a, b, r}}` where `top_pair` is the strongest off-diagonal absolute correlation (excluding the diagonal of 1.0). For our dataset: `numeric_cols=['amount_cents', 'hour_of_day']`. Validator: the matrix entries and `top_pair.r` match expected within ±0.01.",
      learningObjective:
        "Correlation tells you about LINEAR association. The matrix shows you everything; the top pair surfaces what to look at next.",
      requiredSkill: "df.corr() + matrix-to-dict + off-diagonal argmax",
      starterCode: SRC(`# src/eda.py (continued)

def top_correlation(df: pd.DataFrame, numeric_cols: list[str]) -> dict:
    df = df.copy()
    df["hour_of_day"] = df["ts"].dt.hour
    corr = df[numeric_cols].corr(method="pearson").round(2)
    # TODO: matrix = corr.to_dict()
    #       find off-diagonal pair (a != b) maximising abs(corr.loc[a, b])
    #       return {"matrix": matrix, "top_pair": {"a": a, "b": b, "r": float(corr.loc[a, b])}}
    return {}
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "top_correlation(df, ['amount_cents', 'hour_of_day']) returns a dict with 'matrix' (symmetric Pearson correlation rounded to 2 dp) and 'top_pair' ({a, b, r} for the strongest off-diagonal pair by absolute value). Matrix entries and top_pair.r must match fixtures/eda_expected.json top_correlation within ±0.01.",
      }),
      expectedOutputs: { hasMatrix: true, hasTopPair: true, pearsonRounded: true },
      datasetRefs: ["fixtures/transactions.csv", "fixtures/eda_expected.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "`df[cols].corr(method='pearson')` returns a square DataFrame, symmetric, with 1.0 on the diagonal.",
          "To find the top off-diagonal pair, iterate `i < j` over the columns and track the max `abs(corr.iloc[i, j])`.",
          "`pearson` measures LINEAR association. For monotonic-but-nonlinear use `method='spearman'`. Beginners should default to pearson + a scatter plot to sanity-check.",
          "Correlation is NOT causation. Even a 0.95 correlation is a hypothesis to test, not a conclusion.",
          "for i in range(len(cols)): for j in range(i+1, len(cols)): ... abs(corr.iloc[i,j])",
        ],
        successFeedback:
          "Full correlation matrix + the strongest pair pulled out. That's the prompt for your next investigation.",
        failureFeedback:
          "Most common slips: comparing the diagonal (always 1.0 — meaningless); using `max` instead of `max by abs` (misses strong negative correlations); reporting r without sample size (small n + high r is mostly noise).",
        portfolioRelevance:
          "A clean correlation matrix + a one-line conclusion ('hour_of_day vs amount: r=0.6, worth segmenting on') is the senior-junior 'I asked one more question' moment.",
        finalExplanation:
          "EDA's final move: 'is there structure I should investigate?'. Correlation + top-pair gives you the prompt; the next notebook does the investigation.",
        misconceptionToWatchFor:
          "Treating high correlation as a result. It isn't — it's a question. The result is what you find after segmenting, plotting, and modelling the relationship.",
      }),
    },
  ],
};
