/**
 * Phase 61F — Author next WASM-native rowset evidence project (Cloud Data Engineering).
 *
 * Net-new intermediate `cloud-data-engineer` project: "Cloud FinOps Cost
 * Quality Mart." Expands future server-grade rowset candidate SUPPLY beyond C2
 * and the SaaS mart (the concentration Phase 61A surfaced), into a third
 * discipline.
 *
 * Candidate f1f05a3c-1b2c-4d3e-8a4b-5c6d7e8f9012 — raw daily cloud billing
 * exports → dedupe (latest-load-wins) → clean (positive cost) → normalize env +
 * team ownership → daily service spend mart → team allocation mart → untagged /
 * unallocated spend detection → cost-quality audit → FinOps runbook.
 *
 * Deliberately DETERMINISTIC + LOCAL + WASM-NATIVE: DuckDB only, over 3 short
 * committed CSV fixtures (raw_cloud_billing, account_owners, service_catalog).
 * Zero AWS/Azure/GCP, zero cloud SDKs, zero credentials, zero network, zero
 * randomness, zero timing. Money is modelled as INTEGER CENTS (never decimal
 * dollars) and every SUM is `cast(... as bigint)` so the captured value is a
 * lossless Number in DuckDB-WASM (avoids the Phase 61C HUGEINT→string surprise).
 * Every validated output is an integer / distinct-count / exact string label /
 * exact env / exact team — the most type-stable shape.
 *
 * Validation discipline: SIX rowset candidates (5 `sql_resultset` + 1
 * `csv_set_equal`) and 1 `contains` runbook. ALL rowset steps ship DARK
 * (`serverGrade:false`) with `columns` + `expectedRows` pre-populated AND
 * real-browser DuckDB-WASM byte-verified (@duckdb/duckdb-wasm 1.33.1-dev45.0) so
 * a FUTURE phase can flip after re-verification. No grader/comparator change, no
 * envelope enforcement, no schema/migration, no float/tolerance grading. The
 * live serverGrade count is UNCHANGED by this phase. Learner-facing copy never
 * states the server verifies/re-grades these dark steps and never claims
 * authorship/tamper/cheat/job/certification guarantees (H3).
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

// Shared base CTEs — inlined into each step's reference query so every query is
// self-contained (dedupe latest-load-wins → clean positive-cost → normalize env).
const BASE = `with raw as (select * from "finops-cost-mart/raw_cloud_billing"),
deduped as (
  select * from (
    select *, row_number() over (
      partition by account_id, service, resource_id, billing_date
      order by cast(load_timestamp as timestamp) desc
    ) as rn from raw
  ) where rn = 1
),
clean as (select * from deduped where cast(cost_cents as integer) > 0),
normalized as (
  select *, case lower(trim(environment))
    when 'production' then 'prod' when 'prod' then 'prod'
    when 'development' then 'dev' when 'dev' then 'dev'
    when 'staging' then 'staging' else 'unknown' end as env_canonical
  from clean
)`;

export const cloudDataEngineeringFinopsCostQualityMart: AuthoredProject = {
  slug: "cloud-data-engineer-finops-cost-quality-mart",
  candidateId: "f1f05a3c-1b2c-4d3e-8a4b-5c6d7e8f9012",
  title:
    "Cloud FinOps Cost Quality Mart — Raw Billing Exports to a Trusted Team-Allocated Spend Mart on DuckDB",
  shortDescription:
    "Build the FinOps data pipeline a cloud platform team actually owns: ingest raw daily cloud billing exports, dedupe duplicate loads with latest-load-wins, clean low-quality records, normalize messy environment labels, allocate spend to owning teams, surface untagged and unallocated cost, and ship a cost-quality audit — all locally on DuckDB over committed CSV fixtures (no AWS/Azure/GCP calls, no credentials), reviewable in under a minute from a fresh clone.",
  fullDescription:
    "A 2026 Cloud Data Engineering / FinOps screen is rarely 'can you read a bill.' It is 'can you turn a messy raw billing export into a trustworthy, team-allocated cost mart leadership can act on — and prove the spend is accounted for.' This project is exactly that artifact, built on DuckDB so it runs entirely on a laptop with zero cloud spend and zero credentials. You ingest a raw daily billing feed (with duplicate loads, missing team tags, mixed environment labels, an unknown account, and a couple of low-quality records), then build the pipeline a platform engineer owns: Step 1 dedupes the raw feed with a ROW_NUMBER 'latest load wins' rule. Step 2 normalizes the inconsistent environment labels (prod / Prod / PROD / Production → prod) onto a canonical set. Step 3 builds the daily service spend mart, summing integer cost cents per service. Step 4 allocates spend to the owning team by joining the account-owners reference. Step 5 surfaces untagged and unallocated spend — the cost no team is accountable for. Step 6 ships a single-result-set cost-quality audit (duplicate loads, invalid-cost rows, untagged rows, unknown accounts) suitable for a CI gate before the mart is published. Step 7 writes the FinOps runbook the on-call engineer reads when the audit fails. Money is modelled in INTEGER CENTS throughout, so every output is a deterministic integer or exact label — reproducible byte-for-byte from a fresh clone. The one-line swap to a real warehouse (Athena / BigQuery / Snowflake over the actual Cost and Usage Report) is a connection-string change, called out in the README.",
  language: "sql",
  difficulty: "intermediate",
  techStack: ["DuckDB", "SQL", "FinOps", "Cloud Cost", "Data Quality"],
  tags: [
    "cloud-data-engineering",
    "finops",
    "duckdb",
    "cost-allocation",
    "data-quality",
    "dedupe",
    "data-mart",
  ],
  learningObjectives: [
    "Dedupe a raw cloud billing export with a ROW_NUMBER 'latest load wins' rule keyed on account + service + resource + day.",
    "Drop low-quality billing records (non-positive cost) with an explicit validity predicate before any spend is summed.",
    "Normalize inconsistent environment labels onto a canonical set so spend rolls up correctly.",
    "Build a daily service spend mart with deterministic integer-cent aggregation.",
    "Allocate spend to the owning team by joining an account-owners reference, and surface the cost that no team owns.",
    "Ship a cost-quality audit that flags duplicate loads, invalid cost, untagged rows, and unknown accounts as a single CI-ready result set.",
    "Document the FinOps runbook so an on-call engineer can triage a failed cost-quality gate without reading the SQL.",
  ],
  estimatedMinutes: 240,
  xpReward: 720,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "You are a data engineer on a cloud platform team in 2026. Engineering leadership wants a single trustworthy view of cloud spend by team and service, but the raw daily billing export is messy: the loader occasionally double-loads a day, some resources have no team tag, environment labels are entered inconsistently (prod / Prod / PROD / Production), one account is not in the ownership reference, and a couple of records carry non-positive cost. Finance does not trust the current spreadsheet because nobody can say how much spend is unallocated. You are asked to build the canonical FinOps cost-quality mart: ingest the raw billing feed, dedupe it, clean it, normalize environments, allocate spend to owning teams, surface untagged / unallocated cost, and ship a cost-quality audit that runs before the mart is published. You build it on DuckDB end-to-end on your laptop — no cloud calls, no credentials — and hand it off with a one-line swap to the team's warehouse.",
    hiringRelevance2026:
      "2026 Cloud Data Engineering / FinOps hiring screens for 'can you make cloud spend trustworthy and attributable,' not just 'can you query a bill.' A reviewer can clone this repo and in one minute see latest-load-wins dedupe, an explicit cost-validity rule, environment normalization, a team-allocated spend mart, an unallocated-spend signal, and a CI-ready cost-quality audit — the difference between a cost dashboard that gets trusted and one that gets ignored. The whole thing runs in DuckDB-WASM with integer cents and no cloud, so the evidence is reproducible byte-for-byte.",
    readmeOutline: [
      "Overview — raw billing exports to a team-allocated cost-quality mart",
      "Setup (DuckDB only; no cloud, no credentials)",
      "Step 1: dedupe the raw billing feed (latest load wins)",
      "Step 2: normalize environment labels",
      "Step 3: daily service spend mart (integer cents)",
      "Step 4: team allocation mart",
      "Step 5: untagged + unallocated spend detection",
      "Step 6: cost-quality audit (CI gate)",
      "Step 7: FinOps runbook",
      "Portfolio Hand-off (one-line swap to Athena / BigQuery / Snowflake)",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with a DuckDB FinOps project: 3 committed seed CSVs (raw_cloud_billing with duplicate loads / missing tags / mixed env labels / an unknown account / invalid-cost rows, account_owners, service_catalog), latest-load-wins dedupe SQL, an explicit cost-validity predicate, environment normalization, a daily service spend mart, a team allocation mart, an untagged/unallocated-spend signal, a single-result-set cost-quality audit suitable for a CI gate, a docs/finops_runbook.md, and a README documenting the one-line connection swap to Athena / BigQuery / Snowflake.",
    portfolioRelevance:
      "Hiring managers reviewing Cloud Data Engineering / FinOps candidates in 2026 look first for trust + attribution signals — deduped loads, an explicit cost-validity rule, team allocation, and an unallocated-spend audit — not just 'a query ran.' This repo shows all of them end-to-end and is reviewable in under a minute from a fresh clone, with reproducible, byte-for-byte integer-cent outputs.",
    repoUrl: "https://github.com/<your-handle>/finops-cost-quality-mart",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Dedupe the raw billing feed (latest load wins)",
      instructionMd:
        "Raw cloud billing exports are re-loaded on retries, so the same resource-day can appear more than once. Before any spend is summed, each resource-day must be unique. Collapse duplicate loads to the most recent one.\n\n**Build:** a deduped view over the raw `finops-cost-mart/raw_cloud_billing` feed that keeps one row per `(account_id, service, resource_id, billing_date)` using `row_number() over (... order by load_timestamp desc) = 1` (latest load wins). Return `count(*) AS deduped_rows, count(distinct resource_id) AS distinct_resources` over the deduped set.\n\n**Validation:** `sql_resultset` — run the query in the in-browser DuckDB editor and confirm the deduped row count and distinct-resource count.",
      learningObjective:
        "Dedupe a raw cloud billing export with a ROW_NUMBER 'latest load wins' rule keyed on account + service + resource + day.",
      requiredSkill: "DuckDB window functions, ROW_NUMBER dedupe, composite partition keys, distinct counts",
      starterCode: SRC(`-- The in-browser runner registers the seed CSV as the DuckDB table
-- "finops-cost-mart/raw_cloud_billing". Dedupe to one row per resource-day,
-- keeping the most recent load.
with raw as (
  select * from "finops-cost-mart/raw_cloud_billing"
),
deduped as (
  -- TODO: keep one row per (account_id, service, resource_id, billing_date),
  -- the most recent by load_timestamp.
  -- Hint: row_number() over (partition by ... order by cast(load_timestamp as timestamp) desc) = 1
  select * from (
    select *, 1 as rn from raw
  ) where rn = 1
)
select count(*) as deduped_rows, count(distinct resource_id) as distinct_resources
from deduped;
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig(
        "sql_resultset",
        "After latest-load-wins dedupe, the raw feed collapses to its distinct resource-days; return deduped_rows and distinct_resources.",
        {
          // Phase 61F — DARK candidate (serverGrade:false). Browser DuckDB-WASM
          // byte-verified columns=[deduped_rows,distinct_resources] rows=[[12,8]]
          // (types number,number; COUNT/COUNT-DISTINCT → BIGINT → lossless Number).
          serverGrade: false,
          query: SRC(`${BASE}
select count(*) as deduped_rows, count(distinct resource_id) as distinct_resources from deduped`),
          columns: ["deduped_rows", "distinct_resources"],
          expectedRows: [[12, 8]],
        },
      ),
      expectedOutputs: { dedupedRows: 12, distinctResources: 8 },
      datasetRefs: ["finops-cost-mart/raw_cloud_billing"],
      pedagogy: pedagogyConfig({
        hints: [
          "Re-loaded billing days are the most common cloud-billing defect. If you do not dedupe, every spend total is inflated by the retried loads and nobody can tell by how much.",
          "The natural key of a billing line is the combination, not one column: account_id + service + resource_id + billing_date. Partition by all four.",
          "'Latest load wins' means order each partition by the load timestamp DESC and keep row number 1.",
          "Cast load_timestamp to a timestamp before ordering so the comparison is chronological, not lexical on a possibly-mixed string.",
          "row_number() over (partition by account_id, service, resource_id, billing_date order by cast(load_timestamp as timestamp) desc) = 1",
        ],
        successFeedback:
          "The raw feed is deduped to one row per resource-day by an explicit rule. Every downstream spend total now starts from a trustworthy base.",
        failureFeedback:
          "Common slips: (a) used DISTINCT (cannot pick the most recent of two loads); (b) partitioned by resource_id only, collapsing the same resource across different days; (c) ordered ascending and kept the oldest load.",
        portfolioRelevance:
          "Reviewers open the staging/dedupe step first. A composite-key latest-load-wins rule reads as senior; a raw passthrough reads as junior.",
        finalExplanation:
          "Cloud billing is append-and-retry, so the same resource-day arrives more than once. Deduping on the full natural key with latest-load-wins, once, is the contract every downstream cost model assumes.",
        misconceptionToWatchFor:
          "Believing DISTINCT deduplicates billing rows. DISTINCT only collapses fully-identical rows; it cannot choose the most recent of two loads that differ in cost or load_timestamp — only ROW_NUMBER can.",
      }),
    },
    {
      stepNumber: 2,
      title: "Normalize environment labels",
      instructionMd:
        "Environment is entered by hand across teams, so the same environment shows up as `prod`, `Prod`, `PROD`, and `Production`. Spend cannot roll up by environment until the labels are canonical.\n\n**Build:** over the deduped + valid (positive-cost) records, map each raw `environment` onto a canonical label (`prod`, `dev`, `staging`, else `unknown`) and return the distribution `env_canonical, count(*) AS n` grouped and ordered by `env_canonical`.\n\n**Validation:** `sql_resultset` — one ordered row per canonical environment.",
      learningObjective:
        "Normalize inconsistent environment labels onto a canonical set so spend rolls up correctly.",
      requiredSkill: "CASE normalization, lower()/trim(), GROUP BY, deterministic ORDER BY",
      starterCode: SRC(`-- Normalize the messy environment labels onto a canonical set, then return the
-- distribution. Work over the deduped + valid (cost_cents > 0) records.
with raw as (select * from "finops-cost-mart/raw_cloud_billing"),
deduped as (
  select * from (
    select *, row_number() over (partition by account_id, service, resource_id, billing_date order by cast(load_timestamp as timestamp) desc) as rn
    from raw
  ) where rn = 1
),
clean as (select * from deduped where cast(cost_cents as integer) > 0),
normalized as (
  -- TODO: map lower(trim(environment)) → 'prod' | 'dev' | 'staging' | 'unknown'
  select *, 'unknown' as env_canonical from clean
)
select env_canonical, count(*) as n
from normalized
group by env_canonical
order by env_canonical;
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig(
        "sql_resultset",
        "Canonical environment distribution over the deduped+valid records, ordered by env: dev, prod, staging.",
        {
          // Phase 61F — DARK candidate. Browser DuckDB-WASM byte-verified
          // columns=[env_canonical,n] rows=[[dev,2],[prod,7],[staging,1]]
          // (types string,number). Ordered by env_canonical → stable.
          serverGrade: false,
          query: SRC(`${BASE}
select env_canonical, count(*) as n from normalized group by env_canonical order by env_canonical`),
          columns: ["env_canonical", "n"],
          expectedRows: [
            ["dev", 2],
            ["prod", 7],
            ["staging", 1],
          ],
        },
      ),
      expectedOutputs: { canonicalEnvironments: 3 },
      datasetRefs: ["finops-cost-mart/raw_cloud_billing"],
      pedagogy: pedagogyConfig({
        hints: [
          "Free-text environment labels are a silent roll-up bug: 'prod' and 'Production' look like two environments to a GROUP BY until you normalize them.",
          "Lower-case and trim the raw label first, then map known spellings onto a canonical token with a CASE expression.",
          "Keep an explicit `else 'unknown'` branch so an unexpected label is surfaced, not silently dropped or mis-bucketed.",
          "Normalize over the cleaned set (deduped + positive cost) so invalid rows do not distort the distribution.",
          "case lower(trim(environment)) when 'production' then 'prod' when 'prod' then 'prod' when 'development' then 'dev' when 'dev' then 'dev' when 'staging' then 'staging' else 'unknown' end",
        ],
        successFeedback:
          "Environment labels are canonical. Spend can now roll up by environment without double-counting 'prod' and 'Production' as different things.",
        failureFeedback:
          "Common slips: (a) grouped on the raw label and got prod / Prod / PROD as separate buckets; (b) forgot to lower/trim; (c) dropped unmatched labels instead of bucketing them as 'unknown'.",
        portfolioRelevance:
          "A canonical-label CASE with an explicit unknown branch shows you defend against dirty categorical data — a quiet trust signal in any cost or analytics model.",
        finalExplanation:
          "Categorical normalization is where free-text inputs become a controlled vocabulary. Doing it once, with an explicit fallback, keeps every environment roll-up correct and auditable.",
        misconceptionToWatchFor:
          "Assuming environment labels are already clean. Hand-entered cloud tags are almost never consistent; a GROUP BY over raw labels silently fragments spend across spellings.",
      }),
    },
    {
      stepNumber: 3,
      title: "Daily service spend mart (integer cents)",
      instructionMd:
        "Build the service spend mart leadership reads: total spend per service over the cleaned billing records, in integer cents.\n\n**Build:** over the deduped + valid records, return `service, cast(sum(cost_cents) AS bigint) AS total_cents` grouped by `service` and ordered by `service`. Cast the SUM to BIGINT so the captured value is a stable integer.\n\n**Validation:** `sql_resultset` — one ordered row per service.",
      learningObjective:
        "Build a daily service spend mart with deterministic integer-cent aggregation.",
      requiredSkill: "SUM aggregation, integer-cent money, GROUP BY, BIGINT cast, deterministic ORDER BY",
      starterCode: SRC(`-- Sum spend per service over the cleaned (deduped + positive-cost) records.
-- Money is integer cents; cast the SUM to bigint so the value stays a stable integer.
with raw as (select * from "finops-cost-mart/raw_cloud_billing"),
deduped as (
  select * from (
    select *, row_number() over (partition by account_id, service, resource_id, billing_date order by cast(load_timestamp as timestamp) desc) as rn
    from raw
  ) where rn = 1
),
clean as (select * from deduped where cast(cost_cents as integer) > 0)
-- TODO: total cost cents per service, ordered by service
select service, cast(sum(cost_cents) as bigint) as total_cents
from clean
-- group by ... order by ...
;
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig(
        "sql_resultset",
        "Total spend (integer cents) per service over the cleaned records, ordered by service.",
        {
          // Phase 61F — DARK candidate. Browser DuckDB-WASM byte-verified
          // columns=[service,total_cents] rows ordered by service (types
          // string,number). SUM cast to BIGINT → lossless Number (no HUGEINT).
          serverGrade: false,
          query: SRC(`${BASE}
select service, cast(sum(cost_cents) as bigint) as total_cents from clean group by service order by service`),
          columns: ["service", "total_cents"],
          expectedRows: [
            ["cloudfront", 99000],
            ["ec2", 24300],
            ["lambda", 1050],
            ["rds", 16200],
            ["s3", 7800],
          ],
        },
      ),
      expectedOutputs: { servicesInMart: 5 },
      datasetRefs: ["finops-cost-mart/raw_cloud_billing"],
      pedagogy: pedagogyConfig({
        hints: [
          "Sum money in integer cents, never decimal dollars — integer arithmetic is exact, so the mart ties out byte-for-byte every run.",
          "Aggregate over the CLEANED records (deduped + positive cost), not the raw feed, or retried loads and invalid rows inflate the totals.",
          "`cast(sum(cost_cents) as bigint)` keeps the result a stable integer; an un-cast integer SUM can widen to a type that some runtimes render as a string.",
          "Add an explicit ORDER BY service so the mart is deterministic for a downstream test or consumer.",
          "group by service order by service",
        ],
        successFeedback:
          "Daily service spend mart in place — exact integer-cent totals per service, deterministic and reproducible.",
        failureFeedback:
          "Common slips: (a) summed the raw feed and double-counted retried loads; (b) included invalid (non-positive) cost; (c) omitted ORDER BY so the row order drifts; (d) summed dollars and introduced float drift.",
        portfolioRelevance:
          "An integer-cent spend mart with a deterministic order shows you treat money correctly and think about reproducibility — both noticed immediately in a FinOps review.",
        finalExplanation:
          "The spend mart is the cleaned billing records rolled up to the grain leadership reads. Integer cents + a BIGINT cast + an explicit order make it exact and reproducible.",
        misconceptionToWatchFor:
          "Summing decimal dollars. Floating-point dollars accumulate rounding error across thousands of rows; integer cents keep the total exact.",
      }),
    },
    {
      stepNumber: 4,
      title: "Team allocation mart",
      instructionMd:
        "Allocate spend to the team that owns each account, so leadership can hold teams accountable for their cloud cost.\n\n**Build:** join the cleaned billing records to `finops-cost-mart/account_owners` on `account_id` and return `owner_team, cast(sum(cost_cents) AS bigint) AS allocated_cents` grouped and ordered by `owner_team`. An account that is not in the owners reference has no owning team and is intentionally excluded here (you surface it in the next step).\n\n**Validation:** `csv_set_equal` — one row per owning team. Run the query in the in-browser DuckDB editor to confirm the allocated totals.",
      learningObjective:
        "Allocate spend to the owning team by joining an account-owners reference.",
      requiredSkill: "INNER JOIN on a reference dimension, SUM allocation, BIGINT cast, deterministic ORDER BY",
      starterCode: SRC(`-- Join cleaned billing to the account-owners reference and total spend per team.
-- Unknown accounts (not in account_owners) have no owning team; they are excluded
-- here and surfaced in the next step.
with raw as (select * from "finops-cost-mart/raw_cloud_billing"),
deduped as (
  select * from (
    select *, row_number() over (partition by account_id, service, resource_id, billing_date order by cast(load_timestamp as timestamp) desc) as rn
    from raw
  ) where rn = 1
),
clean as (select * from deduped where cast(cost_cents as integer) > 0)
-- TODO: join clean to "finops-cost-mart/account_owners" on account_id,
-- sum cost_cents per owner_team, ordered by owner_team
select o.owner_team, cast(sum(c.cost_cents) as bigint) as allocated_cents
from clean c
-- join ... group by ... order by ...
;
`),
      validationType: "csv_set_equal",
      stepType: "code_sql",
      validation: validationConfig(
        "csv_set_equal",
        "Allocated spend (integer cents) per owning team over the cleaned records, ordered by owner_team (unknown accounts excluded).",
        {
          // Phase 61F — DARK candidate. Browser DuckDB-WASM byte-verified
          // columns=[owner_team,allocated_cents] rows ordered by owner_team
          // (types string,number; normalizeSqlRows passthrough). SUM cast BIGINT.
          serverGrade: false,
          query: SRC(`${BASE}
select o.owner_team, cast(sum(c.cost_cents) as bigint) as allocated_cents
from clean c join "finops-cost-mart/account_owners" o on c.account_id = o.account_id
group by o.owner_team order by o.owner_team`),
          columns: ["owner_team", "allocated_cents"],
          expectedRows: [
            ["data", 6200],
            ["ml", 16200],
            ["platform", 25900],
            ["web", 1050],
          ],
        },
      ),
      expectedOutputs: { owningTeams: 4 },
      datasetRefs: ["finops-cost-mart/raw_cloud_billing", "finops-cost-mart/account_owners"],
      pedagogy: pedagogyConfig({
        hints: [
          "Allocation is a join to an ownership dimension: every billing line maps to the team that owns its account.",
          "Use an INNER JOIN here so only accounts present in the owners reference are allocated — the unmatched (unknown) account is surfaced separately in Step 5, not silently folded into a team.",
          "Sum the cleaned billing cost in integer cents and cast to BIGINT, as in the service mart.",
          "Order by owner_team so the allocation is deterministic.",
          "join \"finops-cost-mart/account_owners\" o on c.account_id = o.account_id group by o.owner_team order by o.owner_team",
        ],
        successFeedback:
          "Spend is allocated to owning teams. Leadership can now see cost per team — the core FinOps accountability view.",
        failureFeedback:
          "Common slips: (a) LEFT JOIN folded the unknown account into a NULL team; (b) summed before joining; (c) omitted ORDER BY; (d) joined on the wrong key.",
        portfolioRelevance:
          "A team-allocated spend mart is the artifact FinOps leadership actually asks for. A clean join to an ownership dimension with the unknown account handled deliberately is a strong end-to-end signal.",
        finalExplanation:
          "Allocation joins billing to ownership. Using an INNER JOIN and surfacing the unmatched account separately keeps every allocated cent attributable and the unowned spend visible.",
        misconceptionToWatchFor:
          "Letting an unknown account silently allocate to a NULL or default team. Unowned spend must stay visible as unowned, not be absorbed into someone else's total.",
      }),
    },
    {
      stepNumber: 5,
      title: "Untagged + unallocated spend detection",
      instructionMd:
        "Leadership's first FinOps question is 'how much spend is nobody accountable for?' Surface the cost that is untagged (no team tag) or unallocated (account not in the owners reference).\n\n**Build:** over the cleaned records, return three metric rows ordered by `metric`: `unallocated_account_cents` (sum of cost for accounts not in `account_owners`), `untagged_cents` (sum of cost where `team_tag` is null/empty), and `untagged_rows` (count of those untagged records). Use `cast(sum(cost_cents) AS bigint)` for the cent metrics.\n\n**Validation:** `sql_resultset` — three ordered metric rows.",
      learningObjective:
        "Surface the cloud spend that no team owns — untagged and unallocated cost.",
      requiredSkill: "Anti-join / NOT IN, NULL/empty handling, UNION ALL metric composition, BIGINT cast",
      starterCode: SRC(`-- Surface the spend nobody is accountable for: untagged (no team tag) and
-- unallocated (account not in the owners reference). One row per metric.
with raw as (select * from "finops-cost-mart/raw_cloud_billing"),
deduped as (
  select * from (
    select *, row_number() over (partition by account_id, service, resource_id, billing_date order by cast(load_timestamp as timestamp) desc) as rn
    from raw
  ) where rn = 1
),
clean as (select * from deduped where cast(cost_cents as integer) > 0)
-- TODO: UNION ALL the three metrics, ordered by metric:
--   unallocated_account_cents : sum(cost) where account not in account_owners
--   untagged_cents            : sum(cost) where team_tag is null or ''
--   untagged_rows             : count(*)  where team_tag is null or ''
select 'unallocated_account_cents' as metric, cast(0 as bigint) as value
order by metric;
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig(
        "sql_resultset",
        "Untagged + unallocated spend metrics over the cleaned records, ordered by metric.",
        {
          // Phase 61F — DARK candidate. Browser DuckDB-WASM byte-verified
          // columns=[metric,value] rows ordered by metric (types string,number).
          // All values integer (cents + a count); SUM cast to BIGINT.
          serverGrade: false,
          query: SRC(`${BASE}
select metric, value from (
  select 'unallocated_account_cents' as metric, cast(sum(cost_cents) as bigint) as value from clean where account_id not in (select account_id from "finops-cost-mart/account_owners")
  union all select 'untagged_cents', cast(sum(cost_cents) as bigint) from clean where team_tag is null or team_tag = ''
  union all select 'untagged_rows', count(*) from clean where team_tag is null or team_tag = ''
) order by metric`),
          columns: ["metric", "value"],
          expectedRows: [
            ["unallocated_account_cents", 99000],
            ["untagged_cents", 16200],
            ["untagged_rows", 2],
          ],
        },
      ),
      expectedOutputs: { metrics: 3 },
      datasetRefs: ["finops-cost-mart/raw_cloud_billing", "finops-cost-mart/account_owners"],
      pedagogy: pedagogyConfig({
        hints: [
          "Unowned spend has two shapes: untagged (a record with no team tag) and unallocated (an account missing from the owners reference). Surface both.",
          "An empty tag can arrive as NULL or as an empty string depending on the export — guard both with `team_tag is null or team_tag = ''`.",
          "Unallocated accounts are an anti-join: `account_id not in (select account_id from account_owners)`.",
          "Compose the metrics with UNION ALL into a (metric, value) shape and order by metric so the result is deterministic; cast the cent sums to BIGINT.",
          "where account_id not in (select account_id from \"finops-cost-mart/account_owners\")  /  where team_tag is null or team_tag = ''",
        ],
        successFeedback:
          "Unowned spend is visible: untagged cost and unallocated-account cost are quantified. This is the number Finance always asks for first.",
        failureFeedback:
          "Common slips: (a) only checked NULL and let empty-string tags through; (b) used an INNER JOIN instead of an anti-join and counted owned accounts; (c) mixed metric rows so the order drifts.",
        portfolioRelevance:
          "Quantifying unowned spend is the single clearest FinOps maturity signal — most candidates show allocation but never the cost that escaped it.",
        finalExplanation:
          "Untagged and unallocated spend are the leaks in cost accountability. Surfacing them as explicit metrics turns 'we think most spend is allocated' into a number leadership can drive to zero.",
        misconceptionToWatchFor:
          "Assuming allocated + untagged = total. An unknown account is unallocated but may still be tagged; the two leaks overlap and must be measured independently.",
      }),
    },
    {
      stepNumber: 6,
      title: "Cost-quality audit (CI gate)",
      instructionMd:
        "Before the cost mart is published, a cost-quality audit runs in CI over the RAW feed. It returns one row per check with a flagged count; the gate fails the build if a count that must be zero is non-zero.\n\n**Build:** a single result set with four checks over the RAW `finops-cost-mart/raw_cloud_billing` feed, ordered by `check_name`:\n\n- `dup_resource_day_loads` — count of `(account_id, service, resource_id, billing_date)` groups that appear more than once.\n- `invalid_cost_rows` — count of rows with non-positive `cost_cents`.\n- `untagged_rows` — count of rows with a missing/empty `team_tag`.\n- `unknown_account_rows` — count of rows whose `account_id` is not in `finops-cost-mart/account_owners`.\n\n**Validation:** `sql_resultset` — four ordered rows of `(check_name, flagged_count)`.",
      learningObjective:
        "Ship a cost-quality audit that flags duplicate loads, invalid cost, untagged rows, and unknown accounts as a single CI-ready result set.",
      requiredSkill: "GROUP BY HAVING, anti-join / NOT IN, UNION ALL audit composition, deterministic ordering",
      starterCode: SRC(`-- Build a one-result-set cost-quality audit over the RAW feed. Each check is a
-- scalar count; UNION ALL them into (check_name, flagged_count), ordered by name.
with raw as (select * from "finops-cost-mart/raw_cloud_billing"),
owners as (select account_id from "finops-cost-mart/account_owners")
-- TODO: fill the four checks below, then UNION ALL them ordered by check_name:
--   dup_resource_day_loads : groups of (account,service,resource,date) with count > 1
--   invalid_cost_rows      : rows where cost_cents <= 0
--   untagged_rows          : rows where team_tag is null or ''
--   unknown_account_rows   : rows where account_id not in owners
select 'dup_resource_day_loads' as check_name, cast(0 as bigint) as flagged_count
order by check_name;
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig(
        "sql_resultset",
        "Cost-quality audit over the RAW feed, ordered by check_name: dup loads, invalid cost, unknown accounts, untagged rows.",
        {
          // Phase 61F — DARK candidate. Browser DuckDB-WASM byte-verified
          // columns=[check_name,flagged_count] rows ordered by check_name
          // (types string,number).
          serverGrade: false,
          query: SRC(`with raw as (select * from "finops-cost-mart/raw_cloud_billing"),
owners as (select account_id from "finops-cost-mart/account_owners")
select check_name, flagged_count from (
  select 'dup_resource_day_loads' as check_name, count(*) as flagged_count from (
    select 1 from raw group by account_id, service, resource_id, billing_date having count(*) > 1
  )
  union all select 'invalid_cost_rows', count(*) from raw where cast(cost_cents as integer) <= 0
  union all select 'untagged_rows', count(*) from raw where team_tag is null or team_tag = ''
  union all select 'unknown_account_rows', count(*) from raw where account_id not in (select account_id from owners)
) order by check_name`),
          columns: ["check_name", "flagged_count"],
          expectedRows: [
            ["dup_resource_day_loads", 3],
            ["invalid_cost_rows", 2],
            ["unknown_account_rows", 1],
            ["untagged_rows", 2],
          ],
        },
      ),
      expectedOutputs: { auditChecks: 4 },
      datasetRefs: ["finops-cost-mart/raw_cloud_billing", "finops-cost-mart/account_owners"],
      pedagogy: pedagogyConfig({
        hints: [
          "A cost-quality audit is a single result set, one row per check, so a CI job can read it and fail the build on any count that must be zero.",
          "Duplicate loads: group the raw feed by the full natural key and keep groups with `having count(*) > 1`, then count those groups.",
          "Invalid cost: `cost_cents <= 0` over the raw feed (the inverse of the Step 1/3 validity rule).",
          "Unknown accounts: an anti-join — raw rows whose account_id is `not in` the owners key set.",
          "order by check_name",
        ],
        successFeedback:
          "Cost-quality audit in place: it surfaces duplicate loads, invalid cost, untagged rows, and unknown accounts as counts a CI gate can act on before publish.",
        failureFeedback:
          "Common slips: (a) counted duplicate ROWS instead of duplicate resource-day GROUPS; (b) ran the audit over the cleaned data instead of the RAW feed (hiding the defects); (c) wrote the unknown-account check as an inner join.",
        portfolioRelevance:
          "A CI-ready cost-quality audit is the clearest 'I ship trustworthy cloud cost data' signal in a 2026 FinOps portfolio — most candidates have none.",
        finalExplanation:
          "The audit turns the pipeline's invariants into a gate. Duplicate loads, invalid cost, untagged rows, and unknown accounts are the four defects that most often corrupt a cost dashboard; surfacing them as counts lets CI block a bad load before publish.",
        misconceptionToWatchFor:
          "Running the audit over the cleaned data. The audit must read the RAW feed — that is the point: it catches the defects the cleaning layer is supposed to handle, before they are hidden.",
      }),
    },
    {
      stepNumber: 7,
      title: "FinOps runbook",
      instructionMd:
        "Document the runbook an on-call engineer reads when the cost-quality audit fails. Plain Markdown, no SQL required — it explains what each check means and the first triage step.\n\n**Build:** `docs/finops_runbook.md` covering all four checks. For each, state what a non-zero count means and the first action. It MUST name each of the four checks and describe the dedupe rule and the data-quality intent in words.\n\n**Validation:** `contains` — the document must include the required phrases (the four check names plus the words 'latest load wins' and 'cost quality'). This is server-enforced (the commit-grader evaluates your submission body).",
      learningObjective:
        "Document the FinOps runbook so an on-call engineer can triage a failed cost-quality gate without reading the SQL.",
      requiredSkill: "Operational documentation, runbook structure, translating SQL checks into plain English",
      starterCode: SRC(`# FinOps Cost Quality Runbook

This pipeline publishes the team-allocated cost mart only after the cost quality
audit passes. If a check is non-zero, start here.

## cost quality checks

### dup_resource_day_loads
TODO: what a non-zero count means, and the first triage step. Mention that
staging resolves duplicate loads with a "latest load wins" rule.

### invalid_cost_rows
TODO: describe what an invalid cost row is (non-positive cost_cents) and what to
do when this count rises.

### untagged_rows
TODO: what an untagged row is and why unowned spend must be driven to zero.

### unknown_account_rows
TODO: what an unknown account is (not in the owners reference) and the first action.
`),
      validationType: "contains",
      stepType: "writeup",
      validation: validationConfig(
        "contains",
        "The runbook names all four cost-quality checks and describes the dedupe ('latest load wins') and the cost-quality intent.",
        {
          mustContainAll: [
            "dup_resource_day_loads",
            "invalid_cost_rows",
            "untagged_rows",
            "unknown_account_rows",
            "latest load wins",
            "cost quality",
          ],
        },
      ),
      expectedOutputs: { runbookChecksDocumented: 4 },
      datasetRefs: ["docs/finops_runbook.md"],
      pedagogy: pedagogyConfig({
        hints: [
          "A runbook is for the on-call engineer who did not write the pipeline. Lead with what a failure MEANS, then the first action.",
          "Name each check exactly as it appears in the audit output so a reader can match the alert to the doc.",
          "Describe the rules in words: 'latest load wins' for dedupe; non-positive cost for invalid rows; missing tag for untagged spend.",
          "Keep it scannable — one short section per check, with the first triage step in the first sentence.",
          "Include the literal check names and the phrase 'latest load wins' so an operator searching the alert text lands here.",
        ],
        successFeedback:
          "Runbook complete — the cost-quality audit now has a human-readable triage guide, the difference between a gate that pages someone and one that resolves itself.",
        failureFeedback:
          "Common slips: (a) renamed the checks so the alert no longer matches the doc; (b) explained the SQL instead of the operational meaning; (c) omitted the first triage action.",
        portfolioRelevance:
          "A runbook beside a cost-quality audit shows you think about cloud operations, not just queries — a maturity signal FinOps reviewers notice immediately.",
        finalExplanation:
          "A check without a runbook is an alert nobody knows how to action. The runbook closes the loop: every audit row maps to a meaning and a first step.",
        misconceptionToWatchFor:
          "Documenting the SQL instead of the operational meaning. The on-call reader needs to know what a failure implies for the cost data and what to do first — not how the query is written.",
      }),
    },
  ],
};
