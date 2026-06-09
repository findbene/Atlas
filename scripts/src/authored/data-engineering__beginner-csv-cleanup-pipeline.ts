/**
 * Phase 14 — data-engineering beginner-tier seed (net-new). Lifts the
 * visible `beginner` count toward 6 and gives DE learners a true entry-
 * tier on-ramp before Airflow/Kafka/Spark modules.
 *
 * Candidate 86667efa-bf0c-47eb-8803-3f016cc53784 — the five-move CSV
 * cleanup pipeline every junior DE writes in their first month: tolerant
 * read, whitespace + case normalisation, date parsing across formats,
 * dedupe on natural key, write clean + reject files.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const dataEngineeringBeginnerCsvCleanupPipeline: AuthoredProject = {
  slug: "data-engineering-beginner-csv-cleanup-pipeline",
  candidateId: "86667efa-bf0c-47eb-8803-3f016cc53784",
  title: "CSV Cleanup Pipeline (Beginner DE) — Tolerant Read → Normalise → Dedupe → Clean + Reject Out",
  shortDescription:
    "Build the canonical junior-DE pipeline: read a messy customer CSV that has a BOM, mixed-case emails, three date formats, and duplicate rows; produce a `clean.csv` of validated rows + a `rejects.csv` of broken rows with a `reason` column. Every step is verified set-equal against expected outputs.",
  fullDescription:
    "Every junior data engineer writes this script in their first month — and almost everyone gets it 80% right and 20% wrong-in-quiet-ways. You'll read a CSV that has every realistic problem (a UTF-8 BOM, mixed-case emails, whitespace padding, dates in three different formats, two duplicate rows on natural key, and a few rows missing required fields), then produce two outputs: `clean.csv` of the canonicalised survivors and `rejects.csv` of the broken rows annotated with a `reason` column. Every step is verified set-equal against an expected fixture, so the feedback loop is tight and the bugs you introduce are visible. By the end you can ingest any small CSV without copy-pasting a regex from Stack Overflow.",
  language: "python",
  difficulty: "beginner",
  techStack: ["Python", "pandas"],
  tags: ["data-engineering", "beginner", "etl", "csv", "data-cleaning", "deduplication"],
  learningObjectives: [
    "Read a CSV defensively: `encoding='utf-8-sig'` to strip the BOM, explicit dtypes, `keep_default_na=False` for surgical NA control.",
    "Normalise text safely: trim whitespace then lowercase emails (but NOT names — case matters there).",
    "Parse dates across multiple formats and route unparseable rows to a rejects file with a reason.",
    "Deduplicate on a natural key (`email`) keeping the most-recent row (`signup_date DESC`).",
    "Write `clean.csv` + `rejects.csv` with explicit columns, ISO dates, and `index=False`.",
  ],
  estimatedMinutes: 165,
  xpReward: 495,
  isMultiFile: false,
  meta: projectMeta({
    scenario:
      "Junior DE at a 2026 SaaS company. Marketing dumps a weekly customer export as CSV into S3 from their CRM. The CRM is old, the export is messy, and the downstream warehouse load fails on any whitespace, encoding, or duplicate issue. Your job: produce a clean CSV the loader will accept plus a rejects file the marketing team can manually review.",
    hiringRelevance2026:
      "Tolerant ingest + normalisation + dedupe + reject-tracking is the canonical 'can you actually clean data' interview screen. Showing the 5 steps + clean/reject output fixtures in a small repo is a high-signal junior DE artefact.",
    readmeOutline: [
      "Overview — the weekly marketing dump",
      "Setup (uv or pip)",
      "Step 1: tolerant read (BOM, dtypes, NA control)",
      "Step 2: normalise text (trim + lowercase emails)",
      "Step 3: parse dates + collect parse rejects",
      "Step 4: dedupe on email, keep most recent",
      "Step 5: write clean.csv + rejects.csv",
      "Portfolio Hand-off (script + fixtures + test)",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo: `src/clean.py` implementing the 5 steps, `fixtures/customers_raw.csv` (with BOM, mixed case, dupes, bad dates, missing fields), `fixtures/clean_expected.csv`, `fixtures/rejects_expected.csv`, `tests/test_clean.py` running each step + diffing outputs against expected.",
    portfolioRelevance:
      "A small, tested CSV-cleaner is the most-replicated junior-DE portfolio piece. The difference between a forgettable one and a memorable one is the explicit rejects file — most candidates silently drop bad rows.",
    repoUrl: "https://github.com/<your-handle>/csv-cleanup-beginner-de",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Tolerant read — BOM, dtypes, NA control",
      instructionMd:
        "Read `fixtures/customers_raw.csv` (columns: `customer_id, name, email, signup_date, source`) with `encoding='utf-8-sig'` to strip any leading BOM, `dtype=str` so EVERY column is a string (we'll coerce later), and `keep_default_na=False` so the literal string `'NA'` from the CRM isn't auto-converted to NaN. Why: a BOM at the file start corrupts the first column name; auto-NA-conversion silently maps the source value `'NA'` to NaN and loses information.",
      learningObjective:
        "Defensive read: handle the encoding marker, force-string-typed columns, and explicitly disable magic NA conversion.",
      requiredSkill: "read_csv with encoding='utf-8-sig' + dtype=str + keep_default_na=False",
      starterCode: SRC(`# src/clean.py
import pandas as pd
from pathlib import Path

RAW = Path("fixtures/customers_raw.csv")

def read_raw() -> pd.DataFrame:
    # TODO: encoding='utf-8-sig', dtype=str, keep_default_na=False, na_values=['']
    return pd.read_csv(RAW)
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "df.columns equals ['customer_id','name','email','signup_date','source'] with no leading BOM character on the first column name.",
          "Every column's dtype is object (string), confirmed by df.dtypes — no int64 or float64 columns yet.",
          "Rows where the source CRM exported the literal string 'NA' retain that string value and are not converted to NaN.",
          "Reading the raw file WITHOUT encoding='utf-8-sig' produces a first column named '\\ufeffcustomer_id' — confirm your read strips this.",
          "Passing na_values=[''] means only empty strings become NaN, not the string 'NA'.",
        ],
      }),
      expectedOutputs: { bomStripped: true, naLiteralPreserved: true },
      datasetRefs: ["fixtures/customers_raw.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "BOM = byte-order mark — invisible 3 bytes some Windows exports prepend. `encoding='utf-8-sig'` reads UTF-8 and strips the BOM if present.",
          "`dtype=str` for ingest means EVERY column comes in as text. You explicitly coerce in later steps where you know the rules.",
          "`keep_default_na=False` disables pandas's built-in NA recognition (which would turn 'NA', 'N/A', 'null', '#NA' into NaN).",
          "`na_values=['']` adds back the one NA recognition you actually want — empty strings.",
          "pd.read_csv(RAW, encoding='utf-8-sig', dtype=str, keep_default_na=False, na_values=[''])",
        ],
        successFeedback:
          "Defensive read — BOM handled, no surprise NA coercion, every column is a string ready for your explicit rules.",
        failureFeedback:
          "Most common slips: skipping `encoding='utf-8-sig'` (first column name becomes '\\ufeffcustomer_id'); leaving auto-NA on (CRM 'NA' values silently vanish).",
        portfolioRelevance:
          "Showing the 3-keyword defensive read in your README with a comment ('CRM exports have a BOM') is exactly the senior-junior signal hiring managers look for.",
        finalExplanation:
          "Ingest is the boundary between 'their data' and 'your data'. Anything you don't explicitly handle becomes a silent bug. Three keywords prevent three classes of bug — cheap insurance.",
        misconceptionToWatchFor:
          "Believing pandas's defaults are right for production. They're tuned for notebook exploration — for pipelines, override every default that touches semantics.",
      }),
    },
    {
      stepNumber: 2,
      title: "Normalise text — trim everything, lowercase only what should be",
      instructionMd:
        "Write `normalise_text(df)` that: (1) strips leading/trailing whitespace from EVERY string column; (2) lowercases ONLY the `email` column (case matters in names: `'Mary McKenzie'` ≠ `'MARY MCKENZIE'`). Use `.str.strip()` and `.str.lower()`. Validator: spot-checks `'  Alice@Example.COM  '` → `'alice@example.com'`, but `'  Bob McNeil  '` → `'Bob McNeil'`.",
      learningObjective:
        "Normalisation rules are SURGICAL, not blanket. Lowercase emails (case-insensitive RFC), preserve case in names.",
      requiredSkill: ".str.strip + .str.lower applied to specific columns",
      starterCode: SRC(`# src/clean.py (continued)

STRING_COLS = ["customer_id", "name", "email", "signup_date", "source"]

def normalise_text(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    # TODO: 1) .str.strip() every column in STRING_COLS
    #       2) .str.lower() ONLY the email column
    return df
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "After normalise: every column is trimmed; emails are lowercased; names preserve original case.", {
        expected: {
          aliceEmailLowercase: "alice@example.com",
          bobNamePreservesCase: "Bob McNeil",
          allStringColsTrimmed: true,
        },
      }),
      expectedOutputs: { emailLower: true, nameCasePreserved: true, allTrimmed: true },
      datasetRefs: ["fixtures/customers_raw.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Loop the trim: `for c in STRING_COLS: df[c] = df[c].str.strip()` — explicit, readable.",
          "Lowercase ONLY email: `df['email'] = df['email'].str.lower()`. Don't blanket-lowercase — you'll lose name case forever.",
          "`.str.strip()` on a Series of strings is element-wise; on NaN it stays NaN (safe).",
          "Resist the urge to add `.str.title()` to names — many real names break that rule ('McDonald', 'D'Souza').",
          "df['email'] = df['email'].str.lower()",
        ],
        successFeedback:
          "Surgical normalisation — every column trimmed, only the case-insensitive one lowered.",
        failureFeedback:
          "Most common slips: blanket-lowercasing every column (destroys name capitalisation); using `.str.title()` on names (mangles 'McDonald'); forgetting `.copy()` (mutates the caller's df).",
        portfolioRelevance:
          "A comment in your code that says `# lowercase email only — names keep their case` is exactly the kind of intentional-decision artefact reviewers love.",
        finalExplanation:
          "Normalisation rules belong to the column, not the table. Decide per column; document the decision; never blanket-apply.",
        misconceptionToWatchFor:
          "Believing whitespace and case are 'just cosmetic'. They aren't — they decide whether two rows are duplicates, whether joins match, whether emails are valid.",
      }),
    },
    {
      stepNumber: 3,
      title: "Parse dates + collect rejects with a reason",
      instructionMd:
        "Write `parse_dates_with_rejects(df)` returning `(clean_df, reject_df)`. Try parsing `signup_date` with `pd.to_datetime(..., errors='coerce', format='mixed')`. Rows where the parse returns NaT → routed to `reject_df` with an added column `reason='bad_signup_date'`. Rows missing required fields (`customer_id`, `email`) at this point → also routed to reject with `reason='missing_required'` (do this BEFORE the date parse, so unparseable+empty rows have the more informative reason).",
      learningObjective:
        "Bad data doesn't get dropped silently — it gets routed to a rejects file with a `reason` so humans can fix the source.",
      requiredSkill: "pd.to_datetime errors='coerce' + boolean-mask split into clean + reject + reason annotation",
      starterCode: SRC(`# src/clean.py (continued)

REQUIRED = ["customer_id", "email"]

def parse_dates_with_rejects(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    df = df.copy()
    # TODO: 1) missing-required: any row where any REQUIRED column is NaN/'' → reject reason='missing_required'
    #       2) date parse: pd.to_datetime(df['signup_date'], errors='coerce', format='mixed')
    #          rows where the result is NaT → reject reason='bad_signup_date'
    #       3) return (clean, rejects) — rejects has 'reason' column appended
    clean = df
    rejects = pd.DataFrame(columns=list(df.columns) + ["reason"])
    return clean, rejects
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "clean_df rows all have valid signup_date as datetime64; rejects_df has 'reason' column with values in {missing_required, bad_signup_date}; row partition is exhaustive (clean + rejects = input).", {
        expected: {
          partitionExhaustive: true,
          rejectReasonsAllowed: ["missing_required", "bad_signup_date"],
          cleanSignupDateIsDatetime: true,
        },
      }),
      expectedOutputs: { partitionExhaustive: true, hasReasonColumn: true },
      datasetRefs: ["fixtures/customers_raw.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "`pd.to_datetime(s, errors='coerce', format='mixed')` returns NaT for unparseable; never raises.",
          "Split with a boolean mask: `bad_date = parsed.isna()`. Reject those; keep the rest.",
          "Always run the cheap, informative rejects FIRST (missing_required) — otherwise a row missing everything would get the date-parse reason, which is less useful.",
          "Use `pd.concat([rejects_a, rejects_b])` to gather multiple reject buckets. Make sure each bucket already has the `reason` column populated.",
          "rejects = df_missing.assign(reason='missing_required')",
        ],
        successFeedback:
          "Explicit clean+reject split with informative reasons — this is what separates a pipeline from a script.",
        failureFeedback:
          "Most common slips: dropping bad rows silently (data loss with no audit trail); using `errors='ignore'` (keeps the original string in the date column — type chaos later).",
        portfolioRelevance:
          "A README screenshot of `rejects_expected.csv` with 2-3 well-categorised reject rows is hiring-manager catnip. It proves you respect the data and the downstream consumer.",
        finalExplanation:
          "Two outputs every cleanup pipeline produces: clean rows for the warehouse, reject rows for the humans. Anything else is data loss.",
        misconceptionToWatchFor:
          "Believing 'bad rows just disappear' is acceptable for a beginner pipeline. It isn't — the moment one matters and you can't find it, you've lost trust in the whole pipeline.",
      }),
    },
    {
      stepNumber: 4,
      title: "Dedupe on email, keep most-recent signup",
      instructionMd:
        "Write `dedupe_keep_latest(clean_df)` that drops duplicates on `email` (the natural key), keeping the row with the latest `signup_date`. Implementation: `.sort_values('signup_date').drop_duplicates('email', keep='last')`, then resort by `customer_id` for a deterministic output. Validator: `'alice@example.com'` (which appears twice with two different signup_dates) appears exactly once with the later date.",
      learningObjective:
        "Dedupe on a natural key — and choose which duplicate wins deterministically with a sort + `keep='last'`.",
      requiredSkill: "sort_values + drop_duplicates with subset + keep semantics",
      starterCode: SRC(`# src/clean.py (continued)

def dedupe_keep_latest(clean: pd.DataFrame) -> pd.DataFrame:
    # TODO: sort by signup_date ASC, drop_duplicates(subset='email', keep='last'),
    #       then sort by customer_id ASC for deterministic output
    return clean
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "After dedupe: email column is unique; for duplicate emails the row with the LATER signup_date survives.", {
        expected: {
          emailIsUnique: true,
          aliceKeepsLaterDate: true,
        },
      }),
      expectedOutputs: { emailUnique: true, latestKept: true },
      datasetRefs: ["fixtures/customers_raw.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Pandas's `drop_duplicates(keep='last')` keeps the LAST occurrence after the sort — so sort by signup_date ASC first, then last == latest.",
          "Sort + drop_duplicates is the simplest deterministic dedupe. Alternatives (groupby + idxmax) work but are harder to read.",
          "Resort the output (e.g. by `customer_id`) — drop_duplicates doesn't promise post-sort order.",
          "`subset='email'` (or `['email']`) targets the dedupe key explicitly. Without it, drop_duplicates only collapses fully-identical rows.",
          ".sort_values('signup_date').drop_duplicates(subset='email', keep='last').sort_values('customer_id').reset_index(drop=True)",
        ],
        successFeedback:
          "Deterministic dedupe — given the same input, you produce the same output, every time.",
        failureFeedback:
          "Most common slips: forgetting `subset=` (collapses only identical rows, dupes survive); forgetting the resort (output order flutters between runs).",
        portfolioRelevance:
          "Showing 'I picked the LATER signup as the survivor and here's why' in your README is the kind of decision-trace senior engineers expect to see.",
        finalExplanation:
          "Dedupe is two decisions: WHICH rows are duplicates (the key), and WHICH duplicate wins (the rule). Make both explicit.",
        misconceptionToWatchFor:
          "Treating dedupe as a pure 'cleanup' step. It's a semantic choice — keeping the older vs newer record changes downstream behaviour.",
      }),
    },
    {
      stepNumber: 5,
      title: "Write clean.csv + rejects.csv — ISO dates, no index",
      instructionMd:
        "Write `emit(clean_df, rejects_df, out_dir)`: writes `out_dir/clean.csv` with columns in the canonical order `customer_id, name, email, signup_date, source` and `out_dir/rejects.csv` with the same columns + `reason`. Both with `index=False`, `date_format='%Y-%m-%d'`, `encoding='utf-8'`. Validator: both files exist; reading them back round-trips to the input dataframes set-wise.",
      learningObjective:
        "Pipeline outputs are first-class artefacts — explicit column order, deterministic format, two files (clean + reject).",
      requiredSkill: "to_csv with column order + ISO date format + dual outputs",
      starterCode: SRC(`# src/clean.py (continued)
from pathlib import Path

CLEAN_COLS = ["customer_id", "name", "email", "signup_date", "source"]
REJECT_COLS = [*CLEAN_COLS, "reason"]

def emit(clean: pd.DataFrame, rejects: pd.DataFrame, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    # TODO: clean -> out_dir/clean.csv  (columns=CLEAN_COLS, index=False, ISO dates, utf-8)
    # TODO: rejects -> out_dir/rejects.csv (columns=REJECT_COLS, same flags)
    pass
`),
      validationType: "csv_set_equal",
      stepType: "code_python",
      validation: validationConfig("csv_set_equal", "out_dir/clean.csv equals fixtures/clean_expected.csv set-wise; out_dir/rejects.csv equals fixtures/rejects_expected.csv set-wise.", {
        expectedClean: "fixtures/clean_expected.csv",
        expectedRejects: "fixtures/rejects_expected.csv",
        cleanColumns: ["customer_id", "name", "email", "signup_date", "source"],
        rejectColumns: ["customer_id", "name", "email", "signup_date", "source", "reason"],
      }),
      expectedOutputs: { cleanWritten: true, rejectsWritten: true, isoDateFormat: true },
      datasetRefs: ["fixtures/clean_expected.csv", "fixtures/rejects_expected.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Define column-order constants (`CLEAN_COLS`, `REJECT_COLS`) at the top of the module — schema-as-code.",
          "`df[CLEAN_COLS].to_csv(path, index=False, date_format='%Y-%m-%d', encoding='utf-8')` — reorder AND write in one chained statement.",
          "`out_dir.mkdir(parents=True, exist_ok=True)` is the safe idempotent dir-create.",
          "Two outputs means two `to_csv` calls. Don't try to clever-concat them — clean and rejects have different schemas (rejects has `reason`).",
          "clean[CLEAN_COLS].to_csv(out_dir / 'clean.csv', index=False, date_format='%Y-%m-%d', encoding='utf-8')",
        ],
        successFeedback:
          "Two clean output files with explicit column order, ISO dates, no index. Production-grade.",
        failureFeedback:
          "Most common slips: forgetting `index=False` (downstream loader fails on Unnamed: 0); single-file output (loses rejects audit trail); not reordering columns (output order changes between runs).",
        portfolioRelevance:
          "A reviewer who opens `clean.csv` and `rejects.csv` side by side and sees identical column orders + ISO dates + a `reason` column on rejects immediately trusts the pipeline. Pin both files in the README.",
        finalExplanation:
          "Pipeline outputs are the contract with the next system. Make them deterministic (column order, dates, no index), make them explicit (two files: success + failure), make them human-debuggable.",
        misconceptionToWatchFor:
          "Believing a `rejects.csv` is optional. It isn't — it's the difference between a black-box pipeline and an observable one.",
      }),
    },
  ],
};
