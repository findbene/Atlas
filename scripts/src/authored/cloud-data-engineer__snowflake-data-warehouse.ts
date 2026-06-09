/**
 * Phase 11 batch-3 / cloud-data-engineer (skeleton rebuild).
 * Candidate e9d0f4b5-8067-4c11-9345-4d5e6f708192 — Snowflake Cloud Warehouse
 * with Terraform IaC + Iceberg external tables + RBAC + dynamic data masking.
 *
 * Legacy: `snowflake-data-warehouse` (1-step skeleton, score 49.6). Full rebuild
 * with serious cloud realism per Phase-11 safeguard #4.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const cloudDataEngineerSnowflakeDataWarehouse: AuthoredProject = {
  slug: "cloud-data-engineer-snowflake-data-warehouse",
  candidateId: "e9d0f4b5-8067-4c11-9345-4d5e6f708192",
  title: "Snowflake Cloud Warehouse — Terraform + Iceberg External Tables + RBAC + Masking",
  shortDescription:
    "Stand up a production Snowflake account with Terraform: per-team warehouses sized for cost, RBAC via functional + access roles, Iceberg external tables federated against S3 (read your lakehouse from the warehouse), and dynamic data masking on PII columns enforced by role.",
  fullDescription:
    "A warehouse is more than `CREATE TABLE`. You'll Terraform-provision warehouses + databases + schemas + the FUNCTIONAL/ACCESS role hierarchy, federate against an S3 Iceberg table (no double-storage), apply column-level dynamic masking that returns clear text only to a designated PII role, and prove cost isolation by running a heavy query in the analytics WH without starving the ingest WH. Cloud realism: every concept maps to a Snowflake cost line.",
  language: "sql",
  difficulty: "advanced",
  techStack: ["Snowflake", "terraform", "iceberg", "S3", "dbt", "Python", "bigquery"],
  tags: ["snowflake", "terraform", "warehouse", "iceberg", "rbac", "data-masking", "cloud"],
  learningObjectives: [
    "Terraform-provision warehouses + databases + schemas + the FUNCTIONAL / ACCESS role hierarchy.",
    "Federate a Snowflake EXTERNAL TABLE against an S3 Iceberg lakehouse.",
    "Enforce column-level dynamic masking based on CURRENT_ROLE().",
    "Configure resource monitors with credit ceilings + auto-suspend.",
    "Demonstrate per-warehouse cost isolation under concurrent workload.",
  ],
  estimatedMinutes: 230,
  xpReward: 740,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Lead cloud DE at a 200-person SaaS migrating from a single-warehouse, single-role Snowflake account ($65k/mo, no governance) to a tenanted, IaC-managed, cost-controlled setup. Goal: cut spend 25% AND pass the SOC 2 governance audit at the same time.",
    hiringRelevance2026:
      "2026 cloud-DE hiring filters explicitly for Terraform + Snowflake + RBAC at the role-hierarchy level. Iceberg federation is the 'shows up in the top 10%' add-on.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (Terraform / Warehouses / RBAC / Iceberg / Masking)",
      "Step 1 Terraform warehouses + DBs", "Step 2 RBAC hierarchy", "Step 3 Iceberg external table",
      "Step 4 dynamic masking", "Step 5 resource monitors + cost isolation", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with the Terraform module (warehouses + databases + RBAC), SQL scripts for Iceberg external table + masking policies + resource monitors, a load-test demonstrating XS_ANALYTICS not impacting M_INGEST under concurrent load, and a per-warehouse cost breakdown produced from ACCOUNT_USAGE.",
    portfolioRelevance:
      "A Terraform-managed Snowflake setup with RBAC + governance is a hiring-manager magnet for lead cloud-DE roles.",
    repoUrl: "https://github.com/<your-handle>/snowflake-cloud-warehouse",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Terraform: warehouses + databases + schemas",
      instructionMd:
        "Write `main.tf` provisioning 2 warehouses (`WH_INGEST` size=MEDIUM, `WH_ANALYTICS` size=XSMALL, both auto_suspend=60s, auto_resume=true), 1 database `RAW`, and 3 schemas (`RAW.EVENTS`, `RAW.USERS`, `ANALYTICS.MARTS`). Submit your Terraform file; Atlas checks that the required evidence markers are present in your submission — not that the program otherwise runs correctly, and not your authorship or competence.",
      learningObjective: "Cost control starts with sized warehouses + aggressive auto-suspend — both must be IaC, not console-clicked.",
      requiredSkill: "Snowflake Terraform provider + warehouse sizing + schema layout",
      starterCode: SRC(`# main.tf
terraform { required_providers { snowflake = { source = "Snowflake-Labs/snowflake", version = "~> 0.95" } } }
provider "snowflake" { role = "ACCOUNTADMIN" }

resource "snowflake_warehouse" "wh_ingest" {
  name           = "WH_INGEST"
  warehouse_size = "MEDIUM"
  auto_suspend   = 60
  auto_resume    = true
  initially_suspended = true
}

# TODO: snowflake_warehouse.wh_analytics — size XSMALL, same suspend/resume.
# TODO: snowflake_database.raw — name = "RAW".
# TODO: snowflake_schema.raw_events, raw_users, analytics_marts — wire schema -> database.
`),
      validationType: "contains",
      stepType: "multi_file",
      validation: validationConfig("contains", "Atlas checks that the required evidence markers are present in your submission — not that the program otherwise runs correctly, and not your authorship or competence.", {
        needles: ["snowflake_warehouse", "WH_INGEST", "WH_ANALYTICS", "MEDIUM", "XSMALL", "auto_suspend", "60", "auto_resume", "snowflake_database", "RAW", "snowflake_schema", "EVENTS", "USERS", "MARTS"],
      }),
      expectedOutputs: { warehouses: 2, databases: 1, schemas: 3 },
      datasetRefs: ["fixtures/snowflake_state.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "auto_suspend=60s is the right default — most teams over-pay because they leave warehouses running idle.",
          "Per-team warehouses isolate cost AND query queues. One warehouse = one billing line.",
          "initially_suspended=true means Terraform apply doesn't burn credits.",
          "Schema-per-domain (RAW/STAGING/ANALYTICS) maps to dbt layers — set the convention up front.",
          "auto_suspend = 60",
        ],
        successFeedback: "Warehouses provisioned in IaC. Auto-suspend means idle cost is zero. Cost-conscious foundation set.",
        failureFeedback: "Common slips: auto_suspend default (10 min) leaks credits; single mega-warehouse (no cost attribution); console-provisioned (drift the moment someone fat-fingers).",
        portfolioRelevance: "Terraform Snowflake is the 2026 mandatory cloud-DE skill. Console-clicking is a junior signal.",
        finalExplanation: "Every Snowflake spend audit starts with: which warehouses? sized how? auto-suspend setting? Terraform makes the answer immediate.",
        misconceptionToWatchFor: "Treating Snowflake warehouse size as a perf knob only. It's a cost knob first.",
      }),
    },
    {
      stepNumber: 2,
      title: "RBAC hierarchy — FUNCTIONAL + ACCESS roles",
      instructionMd:
        "Implement the standard Snowflake RBAC pattern: ACCESS roles grant database/schema privileges; FUNCTIONAL roles compose ACCESS roles + warehouses. Validator runs `SHOW GRANTS TO ROLE` for `FR_ANALYST` and asserts: it owns USAGE on `WH_ANALYTICS`, USAGE on `RAW` + `ANALYTICS`, and SELECT on `RAW.EVENTS` via `AR_RAW_READ`; does NOT have any direct privileges (only via inheritance).",
      learningObjective: "Functional/access role separation is the only RBAC pattern that scales — flat grants become unmanageable past 10 users.",
      requiredSkill: "Snowflake RBAC + role inheritance + GRANT semantics",
      starterCode: SRC(`-- rbac.sql
USE ROLE SECURITYADMIN;

-- ACCESS roles: granular privilege bundles
CREATE ROLE AR_RAW_READ;
GRANT USAGE ON DATABASE RAW TO ROLE AR_RAW_READ;
GRANT USAGE ON SCHEMA RAW.EVENTS TO ROLE AR_RAW_READ;
GRANT SELECT ON ALL TABLES IN SCHEMA RAW.EVENTS TO ROLE AR_RAW_READ;
GRANT SELECT ON FUTURE TABLES IN SCHEMA RAW.EVENTS TO ROLE AR_RAW_READ;

CREATE ROLE AR_ANALYTICS_READ;
-- TODO: USAGE on ANALYTICS db + schema + SELECT on tables (current + future)

CREATE ROLE AR_WH_ANALYTICS_USE;
GRANT USAGE ON WAREHOUSE WH_ANALYTICS TO ROLE AR_WH_ANALYTICS_USE;

-- FUNCTIONAL roles: composed of ACCESS roles
CREATE ROLE FR_ANALYST;
GRANT ROLE AR_RAW_READ TO ROLE FR_ANALYST;
-- TODO: GRANT AR_ANALYTICS_READ + AR_WH_ANALYTICS_USE to FR_ANALYST.
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig("sql_resultset", "SHOW GRANTS TO ROLE FR_ANALYST yields: AR_RAW_READ + AR_ANALYTICS_READ + AR_WH_ANALYTICS_USE granted (inheritance). Direct privileges count = 0.", {
        expected: { inheritedRolesCount: 3, directPrivilegesCount: 0, expectedRoles: ["AR_RAW_READ", "AR_ANALYTICS_READ", "AR_WH_ANALYTICS_USE"] },
      }),
      expectedOutputs: { inheritedRoles: 3, directPrivileges: 0 },
      datasetRefs: ["fixtures/grants_expected.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "ACCESS roles are scope-only (one DB or one warehouse); FUNCTIONAL roles are job-title (Analyst, ML-Eng).",
          "Always grant `SELECT ON FUTURE TABLES` so new tables don't break access.",
          "Never grant directly to users — only to functional roles. User onboarding = grant role, done.",
          "Use SECURITYADMIN, not SYSADMIN, for grant management — separation of duties.",
          "GRANT SELECT ON FUTURE TABLES IN SCHEMA <schema> TO ROLE <access_role>",
        ],
        successFeedback: "Two-layer RBAC scales linearly with role count, not user count. Audit-friendly.",
        failureFeedback: "Common slips: granting directly to users (unmaintainable); skipping FUTURE TABLES (every new table breaks); using ACCOUNTADMIN for daily grants (audit fail).",
        portfolioRelevance: "Functional/access RBAC is the senior-DE pattern. Sketch the hierarchy in your README diagram.",
        finalExplanation: "RBAC failures are governance failures. Two-layer is the only model that survives org change.",
        misconceptionToWatchFor: "Mixing privileges into one mega-role per team. Decompose into ACCESS + FUNCTIONAL or pay for it later.",
      }),
    },
    {
      stepNumber: 3,
      title: "Iceberg external table — federate against S3 lakehouse",
      instructionMd:
        "Create a Snowflake EXTERNAL VOLUME pointing at `s3://lakehouse/iceberg/events`, an Iceberg CATALOG INTEGRATION (REST or AWS Glue), then `CREATE ICEBERG TABLE EVENTS_EXT EXTERNAL_VOLUME='lakehouse_vol' CATALOG='lakehouse_cat' BASE_LOCATION='events/'`. Validator runs `SELECT COUNT(*) FROM EVENTS_EXT` against the fixture-seeded Iceberg table and asserts it matches the row count returned by reading the same Iceberg table directly via PyIceberg.",
      learningObjective: "Iceberg federation lets the warehouse read lakehouse data without ingestion — single source of truth.",
      requiredSkill: "Snowflake EXTERNAL VOLUME + Iceberg CATALOG INTEGRATION + Iceberg-aware predicate pushdown",
      starterCode: SRC(`-- iceberg.sql
USE ROLE ACCOUNTADMIN;

CREATE OR REPLACE EXTERNAL VOLUME lakehouse_vol
  STORAGE_LOCATIONS = (
    (
      NAME = 'aws-us-east-1',
      STORAGE_PROVIDER = 'S3',
      STORAGE_BASE_URL = 's3://lakehouse/iceberg/',
      STORAGE_AWS_ROLE_ARN = 'arn:aws:iam::123456789012:role/snowflake-lakehouse-read',
      STORAGE_AWS_EXTERNAL_ID = 'snowflake-trust'
    )
  );

CREATE OR REPLACE CATALOG INTEGRATION lakehouse_cat
  CATALOG_SOURCE = OBJECT_STORE
  TABLE_FORMAT = ICEBERG
  ENABLED = TRUE;

-- TODO: CREATE ICEBERG TABLE EVENTS_EXT
--   EXTERNAL_VOLUME = 'lakehouse_vol'
--   CATALOG = 'lakehouse_cat'
--   BASE_LOCATION = 'events/';

-- Sanity: SELECT COUNT(*) FROM EVENTS_EXT;
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig("sql_resultset", "Iceberg external table count matches PyIceberg-direct read against the same s3://lakehouse/iceberg/events.", {
        expected: { snowflakeCount: "match", pyicebergCount: "match", deltaTolerance: 0 },
      }),
      expectedOutputs: { rowsMatch: true },
      datasetRefs: ["fixtures/iceberg_seed.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "EXTERNAL VOLUME is the IAM trust layer; CATALOG INTEGRATION is the metadata layer. Both required.",
          "Snowflake pushes predicates into Iceberg's manifest pruning — sub-second filtered reads on large tables.",
          "BASE_LOCATION is relative to STORAGE_BASE_URL — don't repeat the bucket name.",
          "Test with a small Iceberg table first; trust chain bugs are silent failures.",
          "CREATE ICEBERG TABLE EVENTS_EXT EXTERNAL_VOLUME='lakehouse_vol' CATALOG='lakehouse_cat' BASE_LOCATION='events/';",
        ],
        successFeedback: "Warehouse and lakehouse now share data without ingest. Single storage cost; query in both.",
        failureFeedback: "Common slips: misconfigured trust (silent permission denial); CATALOG SOURCE=GLUE without Glue (silent fail); BASE_LOCATION duplicates bucket path.",
        portfolioRelevance: "Iceberg federation is the 2026 cloud-DE topic. Demonstrate the trust + catalog + table chain.",
        finalExplanation: "Federation is the lakehouse value-prop manifest. No copy, no drift, one source of truth.",
        misconceptionToWatchFor: "Thinking external tables are slow. With Iceberg manifest pruning, they're often within 20% of native.",
      }),
    },
    {
      stepNumber: 4,
      title: "Dynamic data masking on PII",
      instructionMd:
        "Create a MASKING POLICY on `RAW.USERS.EMAIL` that returns the clear value to `FR_PII_VIEWER` and `***@***` to all other roles. Validator runs `SELECT email FROM RAW.USERS LIMIT 1` as `FR_ANALYST` and asserts the result is `***@***`; same query as `FR_PII_VIEWER` returns the real email.",
      learningObjective: "Column-level masking is the only GDPR/SOC2-compliant way to expose PII to analysts.",
      requiredSkill: "Snowflake MASKING POLICY + CURRENT_ROLE() + role-aware logic",
      starterCode: SRC(`-- masking.sql
USE ROLE SECURITYADMIN;

CREATE OR REPLACE MASKING POLICY mask_email
AS (val STRING)
RETURNS STRING ->
  CASE
    WHEN CURRENT_ROLE() IN ('FR_PII_VIEWER', 'SECURITYADMIN') THEN val
    -- TODO: ELSE return '***@***'
    ELSE val
  END;

ALTER TABLE RAW.USERS
  MODIFY COLUMN EMAIL SET MASKING POLICY mask_email;

-- Quick checks:
USE ROLE FR_ANALYST;       SELECT email FROM RAW.USERS LIMIT 1;  -- expect '***@***'
USE ROLE FR_PII_VIEWER;    SELECT email FROM RAW.USERS LIMIT 1;  -- expect real email
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig("sql_resultset", "As FR_ANALYST: email column returns '***@***'. As FR_PII_VIEWER: email returns the real string with @ sign.", {
        expected: { analystSeesMask: true, piiViewerSeesReal: true, maskedValue: "***@***" },
      }),
      expectedOutputs: { masked: "***@***", clearForPii: true },
      datasetRefs: ["fixtures/users_seed.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "MASKING POLICY at the column level applies to ALL queries, including ad-hoc + dashboards.",
          "Use CURRENT_ROLE() (active), not IS_ROLE_IN_SESSION() (broader) — match the principle-of-least-privilege.",
          "Tokenization (hashes / partial reveals) is a richer pattern: '***@example.com' shows domain only.",
          "Never store unmasked PII in materialized views; the mask is bypassed by the materialization.",
          "ELSE '***@***'",
        ],
        successFeedback: "PII is masked by default; only the PII role sees clear text. SOC 2 + GDPR friendly.",
        failureFeedback: "Common slips: forgetting materialized views bypass masking; over-trusting CURRENT_ROLE() with shared accounts; static return value (no nuance per data type).",
        portfolioRelevance: "Demonstrating role-aware masking is a senior-DE governance signal. Most repos skip masking entirely.",
        finalExplanation: "Compliance is enforced at the column, not the application. Trust the database.",
        misconceptionToWatchFor: "Masking only in BI tools. SQL clients bypass them; only DB-level masking is real.",
      }),
    },
    {
      stepNumber: 5,
      title: "Resource monitors + cost isolation under load",
      instructionMd:
        "Create a `RM_ANALYTICS` resource monitor with `CREDIT_QUOTA=10`, `TRIGGER … ON 80 PERCENT DO NOTIFY` + `ON 100 PERCENT DO SUSPEND`, attached to `WH_ANALYTICS`. Then run a heavy 30-second query on `WH_ANALYTICS` while a lightweight query runs on `WH_INGEST`. Validator asserts: WH_INGEST query latency is <2s (not throttled by WH_ANALYTICS), the heavy query consumes >2 credits on WH_ANALYTICS, and `SHOW RESOURCE MONITORS` returns the monitor with the configured triggers.",
      learningObjective: "Per-warehouse resource monitors prevent runaway queries from blowing the monthly budget — and prove cost isolation works.",
      requiredSkill: "Snowflake RESOURCE MONITOR + ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY + per-WH isolation",
      starterCode: SRC(`-- monitor.sql
USE ROLE ACCOUNTADMIN;

CREATE OR REPLACE RESOURCE MONITOR RM_ANALYTICS
WITH CREDIT_QUOTA = 10
FREQUENCY = MONTHLY
START_TIMESTAMP = IMMEDIATELY
TRIGGERS
  ON 80 PERCENT DO NOTIFY
  -- TODO: ON 100 PERCENT DO SUSPEND
  ;

ALTER WAREHOUSE WH_ANALYTICS SET RESOURCE_MONITOR = RM_ANALYTICS;

-- Cost-isolation demo (run concurrently from two sessions):
-- Session A (WH_ANALYTICS): SELECT COUNT(*) FROM RAW.EVENTS_EXT WHERE TO_VARCHAR(payload) LIKE '%xyz%';
-- Session B (WH_INGEST):    SELECT 1;

-- Audit:
SELECT WAREHOUSE_NAME, SUM(CREDITS_USED) AS credits
FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
WHERE START_TIME > DATEADD('hour', -1, CURRENT_TIMESTAMP())
GROUP BY 1;
`),
      validationType: "self_attest",
      stepType: "code_sql",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "SHOW RESOURCE MONITORS returns RM_ANALYTICS with CREDIT_QUOTA = 10",
          "RM_ANALYTICS has both triggers configured: NOTIFY at 80% and SUSPEND at 100%",
          "ALTER WAREHOUSE WH_ANALYTICS SET RESOURCE_MONITOR = RM_ANALYTICS is executed",
          "During concurrent workload test: WH_INGEST lightweight query latency stays <2s while WH_ANALYTICS runs the heavy query",
          "SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY shows WH_ANALYTICS credits used > 2 for the heavy query run",
        ],
      }),
      expectedOutputs: { monitor: "RM_ANALYTICS", quota: 10, isolated: true },
      datasetRefs: ["fixtures/concurrent_workload.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Resource monitors are per-warehouse; they don't apply at the account level — set per WH.",
          "NOTIFY at 80% gives the team time to react; SUSPEND at 100% is the safety net.",
          "Per-WH isolation is the cost story — analytics burns credits without starving ingest.",
          "Always audit via SNOWFLAKE.ACCOUNT_USAGE (1-2hr lag) — not real-time but authoritative.",
          "TRIGGERS ON 80 PERCENT DO NOTIFY, ON 100 PERCENT DO SUSPEND",
        ],
        successFeedback: "Spend is bounded + audited. Cost isolation works under load. SOC 2 + finance-team happy.",
        failureFeedback: "Common slips: forgetting SUSPEND trigger (notify-only = paged but still bleeding credits); single warehouse (no isolation); resource monitor at account level (still allows one WH to burn).",
        portfolioRelevance: "Demonstrating measured cost isolation is what separates a Snowflake tutorial from a production-ready setup.",
        finalExplanation: "Compute isolation in Snowflake is THE cost story. Without it, you're paying for noisy-neighbor problems.",
        misconceptionToWatchFor: "Treating Snowflake as serverless. It's per-warehouse charged; isolation matters financially.",
      }),
    },
  ],
};
