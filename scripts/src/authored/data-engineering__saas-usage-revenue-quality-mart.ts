/**
 * Phase 61B — Author next WASM-native rowset evidence project (Data Engineering).
 *
 * Net-new intermediate `data-engineering` project: "SaaS Product Usage &
 * Revenue Quality Mart." Its purpose in the catalog is twofold:
 *   (a) deepen the thin server-gradeable Data-Engineering backbone with a
 *       realistic end-to-end ELT-to-mart workflow, and
 *   (b) create FRESH deterministic rowset candidates for a future controlled
 *       server-grade flip — the supply problem Phase 61A surfaced (server-graded
 *       evidence was concentrated entirely in the one C2 project).
 *
 * Candidate 7e9c1a2b-3d4e-4f5a-9b6c-7d8e9f0a1b2c — SaaS usage + revenue quality
 * mart: load + type + dedupe raw accounts → clean/normalize usage events →
 * intermediate usage-by-type model → revenue (active MRR) model → final
 * account revenue-quality mart with a health label → a data-quality audit →
 * a data-quality runbook write-up.
 *
 * Deliberately DETERMINISTIC + LOCAL + WASM-NATIVE: DuckDB only, over 3 short
 * committed CSV fixtures (accounts, usage_events, subscriptions). Zero cloud,
 * zero credentials, zero Docker, zero network, zero randomness, zero timing.
 * Every validated output is an integer / distinct-count / exact string label —
 * the most type-stable shape (no floats, no tolerance needed), so each rowset
 * step is a clean future server-grade candidate.
 *
 * Validation discipline (Phase 61B): SIX rowset steps (5 `sql_resultset` + 1
 * `csv_set_equal`) and 1 `contains`. ALL rowset steps ship `serverGrade:false`
 * (DARK) — the in-browser DuckDB-WASM adapter runs the learner's SQL for
 * immediate feedback and the server commit-grader auto-passes, byte-identical
 * to the pre-58A legacy behavior. The specs pre-populate `columns` +
 * `expectedRows` (verified against real DuckDB over the committed seeds) so a
 * FUTURE phase can flip any of them to `serverGrade:true` as a one-line change
 * AFTER a real-browser DuckDB-WASM byte-verification — exactly the dark-ship →
 * verify → flip discipline used for C2. No row is opted in here; the
 * `audit:sql-resultset-bc` / `audit:csv-set-equal-bc` guards stay clean because
 * the comparator short-circuits on `serverGrade !== true`. No comparator change,
 * no envelope enforcement, no schema/migration, no float/tolerance grading.
 * Learner-facing copy describes only what the in-browser adapter does and the
 * structural invariants the project must hold — never authorship/verification
 * guarantees (H3).
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const dataEngineeringSaasUsageRevenueQualityMart: AuthoredProject = {
  slug: "data-engineering-saas-usage-revenue-quality-mart",
  candidateId: "7e9c1a2b-3d4e-4f5a-9b6c-7d8e9f0a1b2c",
  title:
    "SaaS Product Usage & Revenue Quality Mart — Raw Ingestion to a Health-Scored Account Mart on DuckDB",
  shortDescription:
    "Build a realistic Data Engineering workflow end-to-end on a laptop with DuckDB: load + type + dedupe raw account records, clean and normalize a noisy product-usage event stream, model usage-by-type and active MRR, assemble a final per-account revenue-quality mart that labels every account healthy / at_risk / churned, and ship a data-quality audit. Three short committed CSV fixtures, zero cloud, zero credentials — a reviewer clones and runs it in under a minute.",
  fullDescription:
    "A 2026 Data Engineering screen is rarely 'have you used Spark.' It is 'can you take a messy raw feed and produce a trustworthy mart the business can act on — and prove it is trustworthy.' This project is exactly that artifact, built on DuckDB so it runs entirely on a laptop with no warehouse spend. You ingest three raw feeds for a B2B SaaS company — accounts (with a duplicate load), product-usage events (with invalid rows), and subscriptions (one churned) — and build the pipeline a senior DE owns: Step 1 types and dedupes raw accounts with a ROW_NUMBER 'latest load wins' rule. Step 2 cleans the usage stream, dropping events with a missing type or a non-positive duration. Step 3 builds the intermediate usage-by-type model. Step 4 models active MRR as of a fixed month (the revenue layer). Step 5 assembles the final account revenue-quality mart, joining usage and revenue to label every account healthy / at_risk / churned. Step 6 ships a data-quality audit that counts duplicate keys, invalid events, and orphan references in a single result set — the kind of check that runs in CI before the mart is published. Step 7 writes the data-quality runbook the on-call DE reads at 2am. Every transformation runs in-browser against the committed seed CSVs via DuckDB-WASM, and every validated output is a deterministic integer or exact label — counts, distinct counts, integer sums, and string categories — so the pipeline is reproducible byte-for-byte from a fresh clone. The one-line swap to Postgres / Snowflake / BigQuery is a connection-string change, called out in the README.",
  language: "sql",
  difficulty: "intermediate",
  techStack: ["DuckDB", "SQL", "ELT", "Data Quality"],
  tags: [
    "data-engineering",
    "duckdb",
    "elt",
    "data-quality",
    "dedupe",
    "saas-metrics",
    "data-mart",
  ],
  learningObjectives: [
    "Type-cast and dedupe a raw account feed with a ROW_NUMBER 'latest load wins' rule — the non-negotiable first step of any trustworthy pipeline.",
    "Clean and normalize a noisy event stream, dropping records that fail explicit validity predicates instead of letting bad data flow downstream.",
    "Build an intermediate usage-by-type model with a deterministic GROUP BY aggregation.",
    "Model active recurring revenue (MRR) as of a fixed month with a half-open subscription-validity window.",
    "Assemble a final per-account revenue-quality mart that joins usage and revenue and classifies each account as healthy / at_risk / churned.",
    "Ship a data-quality audit that surfaces duplicate keys, invalid events, and orphan references as a single result set suitable for a CI gate.",
    "Document the data-quality runbook so an on-call engineer can triage a failed load without reading the SQL.",
  ],
  estimatedMinutes: 240,
  xpReward: 720,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "You are a data engineer at a 2026 B2B SaaS company. Product, Finance, and Customer Success each pull their own numbers and disagree: Finance's active-customer count includes a churned account, the usage dashboard double-counts an account that was loaded twice, and nobody trusts the 'at-risk' list because it is hand-maintained in a spreadsheet. You are asked to build the canonical account revenue-quality mart: ingest the raw account / usage / subscription feeds, clean them with explicit rules, join usage to revenue, label every account healthy / at_risk / churned, and ship a data-quality audit that runs before the mart is published so a bad load never reaches a dashboard again. You build it on DuckDB end-to-end on your laptop and hand it off with a one-line swap to the team's warehouse.",
    hiringRelevance2026:
      "2026 Data Engineering hiring has moved past 'I built a pipeline' to 'I built a pipeline you can trust' — data contracts, explicit cleaning rules, and a data-quality audit are now screened as baseline at mid-level. A reviewer can clone this repo and in one minute see typed + deduped staging, validity predicates that drop bad rows on purpose, a join from usage to revenue, a health-labeled mart, and a CI-ready DQ audit — the difference between a tutorial pipeline and one that ships. The whole thing runs in DuckDB-WASM with no cloud, so the evidence is reproducible byte-for-byte.",
    readmeOutline: [
      "Overview — raw feeds to a health-scored account mart",
      "Setup (DuckDB only; no cloud, no credentials)",
      "Step 1: type + dedupe raw accounts (latest load wins)",
      "Step 2: clean the usage event stream (drop invalid rows)",
      "Step 3: intermediate usage-by-type model",
      "Step 4: active MRR revenue model",
      "Step 5: final account revenue-quality mart (health label)",
      "Step 6: data-quality audit (CI gate)",
      "Step 7: data-quality runbook",
      "Portfolio Hand-off (one-line swap to Postgres / Snowflake / BigQuery)",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with a DuckDB ELT project: 3 committed seed CSVs (accounts with a duplicate load, usage_events with invalid rows, subscriptions with a churned account), typed + deduped staging SQL, a cleaned usage model with explicit validity predicates, an intermediate usage-by-type model, an active-MRR revenue model, a final account revenue-quality mart that labels each account healthy / at_risk / churned, a single-result-set data-quality audit suitable for a CI gate, a docs/data_quality_runbook.md, and a README documenting the one-line connection swap to Postgres / Snowflake / BigQuery.",
    portfolioRelevance:
      "Hiring managers reviewing Data Engineering candidates in 2026 look first for trust signals — typed/deduped staging, explicit cleaning rules, and a data-quality audit — not just 'a pipeline ran.' This repo shows all three end-to-end and is reviewable in under a minute from a fresh clone, with reproducible, byte-for-byte outputs.",
    repoUrl: "https://github.com/<your-handle>/saas-usage-revenue-quality-mart",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Type + dedupe raw accounts (latest load wins)",
      instructionMd:
        "Raw feeds arrive with duplicate loads. Before anything downstream can be trusted, the account key must be unique. Type every column and collapse duplicate `account_id` loads to the most recent one.\n\n**Build:** a staging query over the raw `accounts` feed that (a) casts each column to its target type and (b) dedupes with `qualify row_number() over (partition by account_id order by loaded_at desc) = 1` (latest load wins). The raw fixture has 8 rows including one `account_id` loaded twice.\n\n**Validation:** the in-browser DuckDB adapter runs your SQL and returns `count(*) AS n, count(distinct account_id) AS n_unique` over the deduped staging set, compared against the expected row. This is `sql_resultset`: the in-browser DuckDB adapter executes your SQL for immediate feedback.",
      learningObjective:
        "Type-cast and dedupe a raw account feed with a ROW_NUMBER 'latest load wins' rule.",
      requiredSkill: "DuckDB type casts, QUALIFY ROW_NUMBER dedupe, distinct counts",
      starterCode: SRC(`-- The in-browser runner registers the seed CSV as the DuckDB table
-- "saas-mart/accounts". Finish the staging model: type-cast the columns and
-- keep only the most recent load per account_id.
with raw_accounts as (
  select * from "saas-mart/accounts"
),
typed as (
  select
    cast(account_id as varchar) as account_id,
    cast(loaded_at as timestamp) as loaded_at
  from raw_accounts
),
stg_accounts as (
  -- TODO: keep one row per account_id, the most recent by loaded_at.
  -- Hint: qualify row_number() over (partition by ... order by ... desc) = 1
  select account_id
  from typed
)
select count(*) as n, count(distinct account_id) as n_unique
from stg_accounts;
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig(
        "sql_resultset",
        "After dedupe, staged accounts yield 7 rows with 7 distinct account_ids (raw fixture has 8 rows including 1 duplicate load).",
        {
          // Phase 61B — DARK rowset candidate (serverGrade:false). columns +
          // expectedRows are pre-populated (verified against real DuckDB over the
          // committed seeds) so a future phase can flip to serverGrade:true as a
          // one-line change AFTER a real-browser DuckDB-WASM byte-verification.
          // The server commit-grader auto-passes today (BC-clean).
          serverGrade: false,
          query: SRC(`with raw_accounts as (select * from "saas-mart/accounts"),
typed as (
  select cast(account_id as varchar) as account_id, cast(loaded_at as timestamp) as loaded_at
  from raw_accounts
),
stg_accounts as (
  select account_id from typed
  qualify row_number() over (partition by account_id order by loaded_at desc) = 1
)
select count(*) as n, count(distinct account_id) as n_unique from stg_accounts`),
          columns: ["n", "n_unique"],
          expectedRows: [[7, 7]],
          expectedRow: { n: 7, nUnique: 7 },
        },
      ),
      expectedOutputs: { dedupedAccounts: 7, distinctAccounts: 7 },
      datasetRefs: ["saas-mart/accounts"],
      pedagogy: pedagogyConfig({
        hints: [
          "A duplicate load is the most common raw-feed defect. If you do not dedupe at staging, every downstream count is inflated and nobody can tell by how much.",
          "DuckDB's `qualify` clause filters on a window function without wrapping the query in a subquery — that is why dedupe is a single line.",
          "'Latest load wins' means partition by the key and order by the load timestamp DESC, then keep row number 1.",
          "Type-cast at staging once. Casting downstream means every mart re-guesses the source type — a classic drift bug.",
          "qualify row_number() over (partition by account_id order by loaded_at desc) = 1",
        ],
        successFeedback:
          "Staging is deduped and typed. Every downstream model now starts from a unique, typed account key — the foundation the rest of the pipeline assumes.",
        failureFeedback:
          "Common slips: (a) used DISTINCT instead of ROW_NUMBER (loses 'most recent wins' — you keep an arbitrary row); (b) forgot the cast and joined on an inferred type downstream; (c) partitioned by the wrong column so the duplicate survived.",
        portfolioRelevance:
          "Reviewers open staging first. Typed columns + a deliberate dedupe rule read as senior; a raw passthrough view reads as junior.",
        finalExplanation:
          "Staging normalizes the raw feed: types, and one row per natural key by an explicit rule. Marts assume that contract holds, so the dedupe has to live here, once, not be re-derived in every downstream model.",
        misconceptionToWatchFor:
          "Believing DISTINCT deduplicates rows safely. DISTINCT collapses fully-identical rows; it cannot pick the most recent of two loads that differ in loaded_at — only ROW_NUMBER can.",
      }),
    },
    {
      stepNumber: 2,
      title: "Clean the usage event stream (drop invalid rows)",
      instructionMd:
        "The product-usage feed is noisy: some events have no event type and some have a non-positive duration (a logging bug). Bad data must be dropped at the cleaning layer with an EXPLICIT rule, not silently tolerated downstream.\n\n**Build:** a cleaned model over the raw `usage_events` feed that keeps only events where `event_type` is present (not null, not empty) AND `duration_seconds > 0`. Return `count(*) AS valid_events, count(distinct account_id) AS active_accounts` over the cleaned set. The raw fixture has 15 events, 2 of which are invalid.\n\n**Validation:** `sql_resultset` — the in-browser adapter runs your SQL and compares the result row.",
      learningObjective:
        "Clean a noisy event stream by dropping records that fail explicit validity predicates.",
      requiredSkill: "Validity predicates, NULL/empty-string handling, distinct counts in DuckDB",
      starterCode: SRC(`-- Table "saas-mart/usage_events" is registered from the seed CSV. Keep only
-- the valid events, then count them and the distinct accounts they belong to.
with raw_events as (
  select * from "saas-mart/usage_events"
),
valid_events as (
  -- TODO: keep events with a non-empty event_type AND a positive duration.
  select cast(account_id as varchar) as account_id
  from raw_events
  -- where ...
)
select count(*) as valid_events, count(distinct account_id) as active_accounts
from valid_events;
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig(
        "sql_resultset",
        "Cleaned usage keeps 13 of 15 events across 7 distinct accounts (2 events dropped: 1 with no type, 1 with negative duration).",
        {
          serverGrade: false,
          query: SRC(`with raw_events as (select * from "saas-mart/usage_events"),
valid_events as (
  select cast(account_id as varchar) as account_id
  from raw_events
  where event_type is not null and event_type <> '' and cast(duration_seconds as integer) > 0
)
select count(*) as valid_events, count(distinct account_id) as active_accounts from valid_events`),
          columns: ["valid_events", "active_accounts"],
          expectedRows: [[13, 7]],
          expectedRow: { validEvents: 13, activeAccounts: 7 },
        },
      ),
      expectedOutputs: { validEvents: 13, accountsWithUsage: 7 },
      datasetRefs: ["saas-mart/usage_events"],
      pedagogy: pedagogyConfig({
        hints: [
          "Cleaning is a CONTRACT, not a vibe. Write the validity rule explicitly so a reviewer can see exactly which rows you dropped and why.",
          "An empty event type can arrive as NULL or as an empty string depending on the loader — guard against both (`is not null and <> ''`).",
          "A non-positive duration is a logging bug, not a real event. Filter `duration_seconds > 0`.",
          "Cast duration before comparing — a CSV column can be inferred as text if any value looks non-numeric.",
          "where event_type is not null and event_type <> '' and cast(duration_seconds as integer) > 0",
        ],
        successFeedback:
          "The usage stream is cleaned with an explicit rule. Downstream usage counts now reflect real activity, not logging noise.",
        failureFeedback:
          "Common slips: (a) only checked NULL and let empty strings through; (b) used `>= 0` and kept zero-duration noise; (c) filtered after aggregating so the bad rows still inflated the counts.",
        portfolioRelevance:
          "An explicit cleaning predicate is a trust signal — it shows you decide what 'valid' means rather than hoping the source is clean.",
        finalExplanation:
          "The cleaning layer is where you enforce what a valid record means. Dropping bad rows here, once, keeps every downstream model honest and the rule auditable.",
        misconceptionToWatchFor:
          "Assuming the source is clean and skipping the predicate. Real feeds always carry malformed rows; a pipeline that does not state its validity rule is one bad load away from a wrong dashboard.",
      }),
    },
    {
      stepNumber: 3,
      title: "Intermediate model: usage by event type",
      instructionMd:
        "Build the intermediate usage-by-type model the mart and the dashboards both consume — a deterministic aggregation over the cleaned event stream.\n\n**Build:** over the cleaned events from Step 2, return `event_type, count(*) AS event_count` grouped by `event_type` and ordered by `event_type`. Apply the same validity predicate so the intermediate model never sees a bad row.\n\n**Validation:** `sql_resultset` — three ordered rows (one per event type).",
      learningObjective:
        "Build an intermediate usage-by-type model with a deterministic, ordered GROUP BY aggregation.",
      requiredSkill: "GROUP BY aggregation, deterministic ORDER BY, reusing a cleaning predicate",
      starterCode: SRC(`-- Aggregate the CLEANED events (same validity rule as Step 2) into one row
-- per event_type. Order the result so it is deterministic.
with raw_events as (
  select * from "saas-mart/usage_events"
),
valid_events as (
  select cast(event_type as varchar) as event_type
  from raw_events
  where event_type is not null and event_type <> '' and cast(duration_seconds as integer) > 0
)
-- TODO: count events per type, ordered by event_type
select event_type, count(*) as event_count
from valid_events
-- group by ... order by ...
;
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig(
        "sql_resultset",
        "Cleaned usage by type, ordered by type: dashboard_view 3, export 3, query_run 7.",
        {
          serverGrade: false,
          query: SRC(`with raw_events as (select * from "saas-mart/usage_events"),
valid_events as (
  select cast(event_type as varchar) as event_type
  from raw_events
  where event_type is not null and event_type <> '' and cast(duration_seconds as integer) > 0
)
select event_type, count(*) as event_count from valid_events group by event_type order by event_type`),
          columns: ["event_type", "event_count"],
          expectedRows: [
            ["dashboard_view", 3],
            ["export", 3],
            ["query_run", 7],
          ],
        },
      ),
      expectedOutputs: { distinctEventTypes: 3 },
      datasetRefs: ["saas-mart/usage_events"],
      pedagogy: pedagogyConfig({
        hints: [
          "An intermediate model exists so the mart and the dashboards share ONE definition of 'usage by type' instead of re-deriving it.",
          "Apply the Step 2 validity predicate here too — an intermediate model that reads raw rows reintroduces the noise you just cleaned.",
          "When row order matters to a consumer (or a test), add an explicit ORDER BY — GROUP BY does not guarantee order.",
          "Order by the grouping key so the result is stable across runs and engines.",
          "group by event_type order by event_type",
        ],
        successFeedback:
          "Intermediate usage-by-type model in place — deterministic and reusable by every downstream consumer.",
        failureFeedback:
          "Common slips: (a) aggregated the RAW events and let the invalid query_run back in; (b) omitted ORDER BY so the row order drifts; (c) grouped by the wrong column.",
        portfolioRelevance:
          "Intermediate models that are deterministic and ordered show you think about reproducibility — a quiet senior signal.",
        finalExplanation:
          "Intermediate models are the reusable middle layer: cleaned inputs in, a single shared aggregation out, consumed by the mart and the dashboards alike.",
        misconceptionToWatchFor:
          "Treating ORDER BY as cosmetic. For a result a downstream test or consumer compares positionally, deterministic ordering is correctness, not decoration.",
      }),
    },
    {
      stepNumber: 4,
      title: "Revenue model: active MRR as of a fixed month",
      instructionMd:
        "Model recurring revenue: how much MRR is active as of a fixed month. A subscription is active for a month if it started on/before the month and has not ended before it.\n\n**Build:** over the `subscriptions` feed, keep subscriptions active as of `2025-06-01` — `start_date <= '2025-06-01' AND (end_date IS NULL OR end_date >= '2025-06-01')` — and return `count(*) AS active_accounts, sum(mrr_amount) AS total_mrr`. One account in the fixture churned before June.\n\n**Validation:** `sql_resultset`.",
      learningObjective:
        "Model active MRR as of a fixed month with a half-open subscription-validity window.",
      requiredSkill: "Half-open date windows, NULL end-date handling, SUM aggregation",
      starterCode: SRC(`-- Table "saas-mart/subscriptions" is registered from the seed CSV. Keep the
-- subscriptions ACTIVE as of 2025-06-01 and sum their MRR.
with subs as (
  select * from "saas-mart/subscriptions"
),
active as (
  select
    cast(account_id as varchar) as account_id,
    cast(mrr_amount as integer) as mrr_amount
  from subs
  -- TODO: keep rows active as of date '2025-06-01'
  --   start_date <= the month AND (end_date is null OR end_date >= the month)
)
select count(*) as active_accounts, sum(mrr_amount) as total_mrr
from active;
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig(
        "sql_resultset",
        "Active MRR as of 2025-06-01: 6 active accounts summing to 4950 (one account churned in May is excluded).",
        {
          serverGrade: false,
          query: SRC(`with subs as (select * from "saas-mart/subscriptions"),
active as (
  select cast(account_id as varchar) as account_id, cast(mrr_amount as integer) as mrr_amount
  from subs
  where cast(start_date as date) <= date '2025-06-01'
    and (end_date is null or cast(end_date as date) >= date '2025-06-01')
)
select count(*) as active_accounts, sum(mrr_amount) as total_mrr from active`),
          columns: ["active_accounts", "total_mrr"],
          expectedRows: [[6, 4950]],
          expectedRow: { activeAccounts: 6, totalMrr: 4950 },
        },
      ),
      expectedOutputs: { activeAccounts: 6, totalMrr: 4950 },
      datasetRefs: ["saas-mart/subscriptions"],
      pedagogy: pedagogyConfig({
        hints: [
          "'Active as of a month' is a point-in-time question: the subscription must have started by then and not yet ended.",
          "A NULL end_date means 'still active' — handle it explicitly with `end_date is null or end_date >= month`.",
          "Use a half-open / inclusive window consistently. Mixing `<` and `<=` at the boundary is the classic off-by-one that silently includes or drops the edge month.",
          "Pin the as-of date as a literal so the lab is reproducible — never `current_date` in a graded model.",
          "where start_date <= date '2025-06-01' and (end_date is null or end_date >= date '2025-06-01')",
        ],
        successFeedback:
          "Active MRR modeled correctly — the churned account is excluded and the revenue layer is point-in-time reproducible.",
        failureFeedback:
          "Common slips: (a) forgot the `end_date is null` branch and dropped every still-active account; (b) used `>` instead of `>=` and lost the boundary month; (c) used current_date and made the result non-reproducible.",
        portfolioRelevance:
          "Point-in-time revenue with correct NULL handling is exactly the reconciliation Finance asks a DE to own — showing it is a strong hiring signal.",
        finalExplanation:
          "Active-as-of is a range membership test against a fixed date. Get the NULL end-date and the boundary inclusivity right and the revenue layer ties out to Finance every time.",
        misconceptionToWatchFor:
          "Treating a NULL end_date as 'ended.' NULL here means open-ended/active; dropping those rows zeroes out your active revenue.",
      }),
    },
    {
      stepNumber: 5,
      title: "Final mart: account revenue-quality with a health label",
      instructionMd:
        "Assemble the final mart. Join usage (Step 2/3) and revenue (Step 4) per account and label each one. The label rule: `churned` if the account has no active subscription; otherwise `healthy` if it has 2 or more valid usage events, else `at_risk`.\n\n**Build:** for every account, compute `is_active` (has an active subscription as of 2025-06-01) and `valid_events` (count of valid usage events), then derive `health_label`. Return the distribution: `health_label, count(*) AS account_count` ordered by `health_label`.\n\n**Validation:** `csv_set_equal` against the 3-row health distribution — the in-browser adapter runs your SQL and compares the row set.",
      learningObjective:
        "Assemble a final per-account mart that joins usage and revenue and classifies each account as healthy / at_risk / churned.",
      requiredSkill: "LEFT JOIN densification, CASE classification, set-membership, mutually-exclusive labels",
      starterCode: SRC(`-- Join usage to revenue per account and label each account, then return the
-- distribution. Every account in "saas-mart/accounts" gets a row (left joins),
-- so churned accounts are not silently dropped.
with subs as (select * from "saas-mart/subscriptions"),
active_accounts as (
  select cast(account_id as varchar) as account_id
  from subs
  where cast(start_date as date) <= date '2025-06-01'
    and (end_date is null or cast(end_date as date) >= date '2025-06-01')
),
raw_events as (select * from "saas-mart/usage_events"),
valid_usage as (
  select cast(account_id as varchar) as account_id
  from raw_events
  where event_type is not null and event_type <> '' and cast(duration_seconds as integer) > 0
),
accounts as (select distinct cast(account_id as varchar) as account_id from "saas-mart/accounts"),
usage_counts as (select account_id, count(*) as valid_events from valid_usage group by account_id),
mart as (
  select a.account_id,
    (a.account_id in (select account_id from active_accounts)) as is_active,
    coalesce(u.valid_events, 0) as valid_events
  from accounts a
  left join usage_counts u on a.account_id = u.account_id
),
labeled as (
  -- TODO: churned if not active; else healthy if valid_events >= 2; else at_risk
  select account_id, 'TODO' as health_label
  from mart
)
select health_label, count(*) as account_count
from labeled
group by health_label
order by health_label;
`),
      validationType: "csv_set_equal",
      stepType: "code_sql",
      validation: validationConfig(
        "csv_set_equal",
        "Account health distribution: at_risk 2, churned 1, healthy 4 (7 accounts total).",
        {
          serverGrade: false,
          query: SRC(`with subs as (select * from "saas-mart/subscriptions"),
active_accounts as (
  select cast(account_id as varchar) as account_id from subs
  where cast(start_date as date) <= date '2025-06-01'
    and (end_date is null or cast(end_date as date) >= date '2025-06-01')
),
raw_events as (select * from "saas-mart/usage_events"),
valid_usage as (
  select cast(account_id as varchar) as account_id from raw_events
  where event_type is not null and event_type <> '' and cast(duration_seconds as integer) > 0
),
accounts as (select distinct cast(account_id as varchar) as account_id from "saas-mart/accounts"),
usage_counts as (select account_id, count(*) as valid_events from valid_usage group by account_id),
mart as (
  select a.account_id,
    (a.account_id in (select account_id from active_accounts)) as is_active,
    coalesce(u.valid_events, 0) as valid_events
  from accounts a left join usage_counts u on a.account_id = u.account_id
),
labeled as (
  select account_id,
    case when not is_active then 'churned' when valid_events >= 2 then 'healthy' else 'at_risk' end as health_label
  from mart
)
select health_label, count(*) as account_count from labeled group by health_label order by health_label`),
          columns: ["health_label", "account_count"],
          expectedRows: [
            ["at_risk", 2],
            ["churned", 1],
            ["healthy", 4],
          ],
        },
      ),
      expectedOutputs: { healthBuckets: 3, totalAccounts: 7 },
      datasetRefs: ["saas-mart/accounts", "saas-mart/usage_events", "saas-mart/subscriptions"],
      pedagogy: pedagogyConfig({
        hints: [
          "Start the mart from the FULL account list and LEFT JOIN usage, so an account with zero usage still gets a row — otherwise churned/idle accounts vanish.",
          "`coalesce(valid_events, 0)` turns a missing usage row into a real zero so the CASE rule can classify it.",
          "Order the CASE branches by priority: check churned first (no active subscription), then healthy, then fall through to at_risk.",
          "The three labels must be mutually exclusive — every account lands in exactly one bucket. Walk the branches to confirm none overlaps.",
          "case when not is_active then 'churned' when valid_events >= 2 then 'healthy' else 'at_risk' end",
        ],
        successFeedback:
          "Final mart assembled — every account carries exactly one health label and the distribution is reproducible from the seeds.",
        failureFeedback:
          "Common slips: (a) inner-joined usage and dropped accounts with no events; (b) left valid_events NULL so the CASE misclassified; (c) checked healthy before churned so an active-but-idle account stole a churned label.",
        portfolioRelevance:
          "A health-labeled account mart is the artifact Customer Success actually asks for. Showing a clear, mutually-exclusive rule built from joined usage + revenue is a strong end-to-end signal.",
        finalExplanation:
          "The mart is the join of the cleaned layers into a business-ready table. The health label is a deterministic CASE over is_active + usage — the spreadsheet 'at-risk list' replaced by versioned SQL.",
        misconceptionToWatchFor:
          "Computing the mart only over accounts that have usage. Churned and idle accounts have little or no usage — they must be carried in by a LEFT JOIN from the account list, or your health distribution is wrong.",
      }),
    },
    {
      stepNumber: 6,
      title: "Data-quality audit (CI gate)",
      instructionMd:
        "Before the mart is published, a data-quality audit runs in CI. It returns one row per check with a flagged count; the gate fails the build if any count that must be zero is non-zero.\n\n**Build:** a single result set with three checks over the RAW feeds, ordered by `check_name`:\n\n- `dup_account_ids` — count of account_ids that appear more than once in raw accounts (must surface the duplicate load).\n- `invalid_usage_events` — count of usage events failing the validity rule (no type or non-positive duration).\n- `orphan_usage_accounts` — count of usage events whose account_id is not present in accounts (must be 0).\n\n**Validation:** `sql_resultset` — three ordered rows of `(check_name, flagged_count)`.",
      learningObjective:
        "Ship a data-quality audit that surfaces duplicate keys, invalid events, and orphan references as a single CI-ready result set.",
      requiredSkill: "GROUP BY HAVING, anti-join / NOT IN, UNION ALL audit composition, deterministic ordering",
      starterCode: SRC(`-- Build a one-result-set DQ audit over the RAW feeds. Each check is a scalar
-- count; UNION ALL them into (check_name, flagged_count), ordered by name.
with raw_accounts as (select * from "saas-mart/accounts"),
raw_events as (select * from "saas-mart/usage_events"),
accounts_keys as (select distinct cast(account_id as varchar) as account_id from raw_accounts),
dup as (
  -- TODO: count account_ids that appear more than once in raw_accounts
  -- (group by account_id having count(*) > 1, then count the offending groups)
  select 0 as c
),
invalid as (
  -- TODO: count usage events failing the validity rule
  -- (event_type missing/empty OR duration_seconds <= 0)
  select 0 as c
),
orphan as (
  -- TODO: count usage events whose account_id is NOT in accounts_keys (anti-join)
  select 0 as c
)
-- The UNION ALL assembly + ORDER BY is the shape to keep; fill the three CTEs above.
select 'dup_account_ids' as check_name, (select c from dup) as flagged_count
union all select 'invalid_usage_events', (select c from invalid)
union all select 'orphan_usage_accounts', (select c from orphan)
order by check_name;
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig(
        "sql_resultset",
        "DQ audit (ordered by check_name): dup_account_ids 1, invalid_usage_events 2, orphan_usage_accounts 0.",
        {
          serverGrade: false,
          query: SRC(`with raw_accounts as (select * from "saas-mart/accounts"),
raw_events as (select * from "saas-mart/usage_events"),
accounts_keys as (select distinct cast(account_id as varchar) as account_id from raw_accounts),
dup as (select count(*) as c from (select account_id from raw_accounts group by account_id having count(*) > 1)),
invalid as (select count(*) as c from raw_events where event_type is null or event_type = '' or cast(duration_seconds as integer) <= 0),
orphan as (select count(*) as c from raw_events e where cast(e.account_id as varchar) not in (select account_id from accounts_keys))
select 'dup_account_ids' as check_name, (select c from dup) as flagged_count
union all select 'invalid_usage_events', (select c from invalid)
union all select 'orphan_usage_accounts', (select c from orphan)
order by check_name`),
          columns: ["check_name", "flagged_count"],
          expectedRows: [
            ["dup_account_ids", 1],
            ["invalid_usage_events", 2],
            ["orphan_usage_accounts", 0],
          ],
        },
      ),
      expectedOutputs: { dqChecks: 3, orphanCount: 0 },
      datasetRefs: ["saas-mart/accounts", "saas-mart/usage_events"],
      pedagogy: pedagogyConfig({
        hints: [
          "A DQ audit is a single result set, one row per check, so a CI job can read it and fail the build on any count that must be zero.",
          "Duplicate keys: `group by account_id having count(*) > 1`, then count the offending groups.",
          "Invalid events: reuse the inverse of your Step 2 validity predicate (no type OR non-positive duration).",
          "Orphan references: an anti-join — usage account_ids that are NOT IN the account key set.",
          "order by check_name",
        ],
        successFeedback:
          "DQ audit in place: it surfaces the duplicate load, the invalid events, and confirms zero orphan references — a gate that runs before publish.",
        failureFeedback:
          "Common slips: (a) counted duplicate ROWS instead of duplicate KEYS; (b) reused the POSITIVE validity predicate and counted valid events; (c) wrote the orphan check as an inner join (returns matches, not orphans).",
        portfolioRelevance:
          "A CI-ready DQ audit is the single clearest 'I ship trustworthy data' signal in a 2026 DE portfolio — most candidates have none.",
        finalExplanation:
          "The audit turns invariants into a gate. Duplicate keys, invalid rows, and orphan references are the three defects that most often reach a dashboard; surfacing them as counts lets CI block a bad load before publish.",
        misconceptionToWatchFor:
          "Running the audit over the CLEANED data. The audit must read the RAW feeds — that is the whole point: it catches the defects your cleaning layer is supposed to handle, before they are hidden.",
      }),
    },
    {
      stepNumber: 7,
      title: "Data-quality runbook",
      instructionMd:
        "Document the runbook an on-call engineer reads when the DQ audit fails at 2am. Plain Markdown, no SQL required — it explains what each check means and the first triage step.\n\n**Build:** `docs/data_quality_runbook.md` covering all three checks. For each, state what a non-zero count means and the first action. It MUST name each of the three checks and describe the dedupe rule and the validity rule in words.\n\n**Validation:** `contains` — the document must include the required phrases (the three check names plus the words 'latest load wins' and 'data quality'). This is server-enforced (the commit-grader evaluates your submission body).",
      learningObjective:
        "Document the data-quality runbook so an on-call engineer can triage a failed load without reading the SQL.",
      requiredSkill: "Operational documentation, runbook structure, translating SQL rules into plain English",
      starterCode: SRC(`# Data Quality Runbook

This pipeline publishes the account revenue-quality mart only after the
data-quality audit passes. If a check is non-zero, start here.

## data quality checks

### dup_account_ids
TODO: what a non-zero count means, and the first triage step. Mention that
staging resolves duplicates with a "latest load wins" rule.

### invalid_usage_events
TODO: describe the validity rule (event type present AND positive duration)
and what to do when this count rises.

### orphan_usage_accounts
TODO: what an orphan usage account is and why it must be zero.
`),
      validationType: "contains",
      stepType: "writeup",
      validation: validationConfig(
        "contains",
        "The runbook names all three DQ checks and describes the dedupe ('latest load wins') and the validity rule.",
        {
          mustContainAll: [
            "dup_account_ids",
            "invalid_usage_events",
            "orphan_usage_accounts",
            "latest load wins",
            "data quality",
          ],
        },
      ),
      expectedOutputs: { runbookChecksDocumented: 3 },
      datasetRefs: ["docs/data_quality_runbook.md"],
      pedagogy: pedagogyConfig({
        hints: [
          "A runbook is for the person on call who did not write the pipeline. Lead with what a failure MEANS, then the first action.",
          "Name each check exactly as it appears in the audit output so a reader can match the alert to the doc.",
          "Describe the rules in words: 'latest load wins' for dedupe; 'event type present and positive duration' for validity.",
          "Keep it scannable — one short section per check, with the first triage step in the first sentence.",
          "Include the literal check names and the phrase 'latest load wins' so an operator searching the alert text lands here.",
        ],
        successFeedback:
          "Runbook complete — the audit now has a human-readable triage guide, the difference between a check that pages someone and a check that resolves itself.",
        failureFeedback:
          "Common slips: (a) renamed the checks so the alert no longer matches the doc; (b) explained the SQL instead of the operational meaning; (c) omitted the first triage action, leaving the on-call engineer guessing.",
        portfolioRelevance:
          "A runbook beside a DQ audit shows you think about operations, not just code — a maturity signal reviewers notice immediately.",
        finalExplanation:
          "A check without a runbook is an alert nobody knows how to action. The runbook closes the loop: every audit row maps to a meaning and a first step.",
        misconceptionToWatchFor:
          "Documenting the SQL instead of the operational meaning. The on-call reader needs to know what a failure implies for the data and what to do first — not how the query is written.",
      }),
    },
  ],
};
