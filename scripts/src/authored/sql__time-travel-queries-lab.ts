/**
 * Phase 7 — SQL course PILOT.
 *
 * Promotes candidate `30750cbc-a4cf-4426-97dd-57baddd85b1e`
 * (sql / Time-Travel Queries Lab, candidate score 63.5) into a fully
 * authored learner-facing project. This is the hardest pick of the wave —
 * if the helpers cannot lift this past ≥70, Phase 7 halts (C2 HARD STOP).
 *
 * Topic: SCD Type 2 + bitemporal point-in-time queries against a real
 * warehouse-style dimension table. Maps directly to the "what tier did
 * this customer have when the order was placed?" question every
 * analytics/data engineer fields in production.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const DDL_SCD2 = `-- Design dim_customer as an SCD Type 2 table.
-- A row is "current" when valid_to is NULL (open interval).
-- The half-open convention is [valid_from, valid_to).
CREATE TABLE IF NOT EXISTS dim_customer (
  customer_sk      BIGSERIAL PRIMARY KEY,
  customer_id      INTEGER       NOT NULL,         -- natural key
  full_name        TEXT          NOT NULL,
  email            TEXT          NOT NULL,
  tier             TEXT          NOT NULL,         -- bronze | silver | gold | platinum
  valid_from       TIMESTAMPTZ   NOT NULL,
  valid_to         TIMESTAMPTZ,                    -- NULL = currently effective
  is_current       BOOLEAN       NOT NULL DEFAULT TRUE
);

-- Seed three customers with their opening (currently-effective) rows.
-- TODO: write three INSERT rows. Each row's valid_from should be
-- the timestamp the customer first became known to the warehouse.
-- valid_to should be NULL and is_current TRUE.

INSERT INTO dim_customer (customer_id, full_name, email, tier, valid_from, valid_to, is_current)
VALUES
  -- customer 1: Ada Lovelace, opened 2025-01-01, bronze
  -- customer 2: Linus Torvalds, opened 2025-02-15, silver
  -- customer 3: Grace Hopper, opened 2025-03-10, gold
  ;
`;

const DDL_SCD2_EXPECTED = `INSERT INTO dim_customer (customer_id, full_name, email, tier, valid_from, valid_to, is_current)
VALUES
  (1, 'Ada Lovelace',  'ada@example.com',   'bronze', TIMESTAMPTZ '2025-01-01 00:00+00', NULL, TRUE),
  (2, 'Linus Torvalds','linus@example.com', 'silver', TIMESTAMPTZ '2025-02-15 00:00+00', NULL, TRUE),
  (3, 'Grace Hopper',  'grace@example.com', 'gold',   TIMESTAMPTZ '2025-03-10 00:00+00', NULL, TRUE);`;

const SCD2_UPDATE = `-- A customer's tier just changed. Apply the SCD2 update in ONE transaction
-- so the table is never in a state where two rows are simultaneously "current"
-- for the same natural key.
--
-- Scenario: customer_id=1 upgraded from bronze -> silver effective 2026-03-01.
--
-- Steps:
--   1) Close the currently-effective row (set valid_to = '2026-03-01', is_current = FALSE).
--   2) Insert a new row with valid_from = '2026-03-01', valid_to = NULL, is_current = TRUE.
--
-- Use a CTE (WITH closed AS UPDATE ... RETURNING ...) so both writes can be
-- expressed in a single statement. That makes it atomic and easy to validate.

WITH closed AS (
  -- TODO: UPDATE dim_customer ... SET valid_to = ..., is_current = FALSE
  -- WHERE customer_id = 1 AND is_current
  -- RETURNING customer_id, full_name, email
)
-- TODO: INSERT INTO dim_customer (...)
-- SELECT customer_id, full_name, email, 'silver', TIMESTAMPTZ '2026-03-01 00:00+00', NULL, TRUE
-- FROM closed;
`;

const SCD2_UPDATE_EXPECTED = `WITH closed AS (
  UPDATE dim_customer
     SET valid_to = TIMESTAMPTZ '2026-03-01 00:00+00',
         is_current = FALSE
   WHERE customer_id = 1
     AND is_current
   RETURNING customer_id, full_name, email
)
INSERT INTO dim_customer (customer_id, full_name, email, tier, valid_from, valid_to, is_current)
SELECT customer_id, full_name, email, 'silver',
       TIMESTAMPTZ '2026-03-01 00:00+00', NULL, TRUE
  FROM closed;`;

const ASOF_QUERY = `-- Given an order placed at TIMESTAMPTZ :order_ts by :customer_id,
-- return the customer tier in effect at that exact instant.
--
-- Use the half-open range predicate:
--   valid_from <= :order_ts AND (:order_ts < valid_to OR valid_to IS NULL)
--
-- Return columns (exact names): customer_id, full_name, tier_at_order
--
-- Validator will run this query with :customer_id = 1 and
-- :order_ts = TIMESTAMPTZ '2026-02-10 12:00+00' (BEFORE the SCD2 update applied
-- in step 2) and expect tier_at_order = 'bronze'.

SELECT
  customer_id,
  full_name,
  tier AS tier_at_order
FROM dim_customer
WHERE customer_id = 1
  -- TODO: add the half-open range predicate against :order_ts
;
`;

const ASOF_EXPECTED = `SELECT
  customer_id,
  full_name,
  tier AS tier_at_order
FROM dim_customer
WHERE customer_id = 1
  AND valid_from <= TIMESTAMPTZ '2026-02-10 12:00+00'
  AND (valid_to IS NULL OR TIMESTAMPTZ '2026-02-10 12:00+00' < valid_to);`;

const AUDIT_QUERY = `-- Auditor query: find natural keys whose SCD2 history has either an
-- overlap (two rows simultaneously valid) or a gap (a window during
-- which no row is valid). These are bitemporal-integrity bugs.
--
-- Approach: use a window function. For each row in dim_customer,
-- look at the NEXT row (ordered by valid_from) for the same customer_id
-- and compare boundaries.
--
-- Output (one row per offender): customer_id, kind ('overlap' | 'gap'),
-- prev_valid_to, next_valid_from.
--
-- Hint: LEAD(valid_from) OVER (PARTITION BY customer_id ORDER BY valid_from)
--   gives next_valid_from. An overlap is next_valid_from < prev_valid_to.
--   A gap is next_valid_from > prev_valid_to.
--   Equal boundaries (next_valid_from = prev_valid_to) are correct under
--   the half-open convention and should NOT be flagged.

WITH ranges AS (
  SELECT
    customer_id,
    valid_from,
    valid_to,
    -- TODO: LEAD(valid_from) OVER (PARTITION BY ... ORDER BY ...) AS next_valid_from
    NULL::TIMESTAMPTZ AS next_valid_from
  FROM dim_customer
)
SELECT
  customer_id,
  CASE
    WHEN next_valid_from < valid_to THEN 'overlap'
    WHEN next_valid_from > valid_to THEN 'gap'
  END AS kind,
  valid_to     AS prev_valid_to,
  next_valid_from
FROM ranges
WHERE valid_to IS NOT NULL
  AND next_valid_from IS NOT NULL
  AND next_valid_from <> valid_to;
`;

const AUDIT_EXPECTED = `WITH ranges AS (
  SELECT
    customer_id,
    valid_from,
    valid_to,
    LEAD(valid_from) OVER (PARTITION BY customer_id ORDER BY valid_from) AS next_valid_from
  FROM dim_customer
)
SELECT
  customer_id,
  CASE
    WHEN next_valid_from < valid_to THEN 'overlap'
    WHEN next_valid_from > valid_to THEN 'gap'
  END AS kind,
  valid_to     AS prev_valid_to,
  next_valid_from
FROM ranges
WHERE valid_to IS NOT NULL
  AND next_valid_from IS NOT NULL
  AND next_valid_from <> valid_to;`;

const REBUILD_QUERY = `-- Disaster-recovery rebuild: given an APPEND-ONLY event log
-- customer_events(customer_id, event_ts, tier_after), reconstruct the
-- equivalent SCD2 snapshot using a single window-function query.
--
-- Approach:
--   1) For each event row, compute the NEXT event's event_ts using
--      LEAD(event_ts) OVER (PARTITION BY customer_id ORDER BY event_ts).
--   2) That next event timestamp becomes the row's valid_to (NULL when
--      no next event exists).
--   3) is_current = (valid_to IS NULL).
--
-- Output columns (exact names + order):
--   customer_id, tier, valid_from, valid_to, is_current

WITH log AS (
  SELECT
    customer_id,
    event_ts,
    tier_after,
    -- TODO: LEAD(event_ts) OVER (PARTITION BY customer_id ORDER BY event_ts)
    --       AS next_event_ts
    NULL::TIMESTAMPTZ AS next_event_ts
  FROM customer_events
)
SELECT
  customer_id,
  tier_after            AS tier,
  event_ts              AS valid_from,
  next_event_ts         AS valid_to,
  (next_event_ts IS NULL) AS is_current
FROM log
ORDER BY customer_id, valid_from;
`;

const REBUILD_EXPECTED = `WITH log AS (
  SELECT
    customer_id,
    event_ts,
    tier_after,
    LEAD(event_ts) OVER (PARTITION BY customer_id ORDER BY event_ts) AS next_event_ts
  FROM customer_events
)
SELECT
  customer_id,
  tier_after            AS tier,
  event_ts              AS valid_from,
  next_event_ts         AS valid_to,
  (next_event_ts IS NULL) AS is_current
FROM log
ORDER BY customer_id, valid_from;`;

export const sqlTimeTravelQueriesLab: AuthoredProject = {
  slug: "sql-time-travel-queries-lab",
  candidateId: "30750cbc-a4cf-4426-97dd-57baddd85b1e",
  title: "Time-Travel Queries Lab — SCD2 + Bitemporal Point-in-Time",
  shortDescription:
    "Build a production SCD Type 2 dimension table in PostgreSQL, apply transactional updates, and answer 'what tier did this customer have when the order was placed?' point-in-time queries with window functions.",
  fullDescription:
    "You are the on-call analytics engineer at a B2B fintech. Finance just opened a chargeback dispute: a customer claims they were billed at gold-tier pricing on an order timestamped before their upgrade went live. The current `customers` table only stores their CURRENT tier — there's no way to answer the question without rebuilding history. In this project you'll author a Slowly Changing Dimension Type 2 (SCD2) version of the customer dimension in PostgreSQL, apply transactional SCD2 updates with a single-statement CTE, write the point-in-time as-of join that resolves the dispute, audit the table for bitemporal integrity bugs (overlapping ranges, gaps), and finally rebuild the entire snapshot from an append-only event log using window functions. Every step's SQL is graded against a deterministic expected result set — no self-attestation. By the end you'll have a public GitHub repo with the migrations, validator harness, and a README demonstrating each query produced the expected output.",
  language: "sql",
  difficulty: "advanced",
  techStack: ["PostgreSQL", "SQL", "dbt"],
  tags: [
    "sql", "postgres", "scd2", "bitemporal", "point-in-time",
    "data-warehouse", "window-functions", "cte", "data-engineering", "analytics-engineering",
  ],
  learningObjectives: [
    "Design an SCD Type 2 dimension table with explicit validity intervals.",
    "Apply an SCD2 update transactionally using a single CTE so the table is never in a half-updated state.",
    "Answer as-of point-in-time questions with a half-open range predicate.",
    "Audit a bitemporal table for overlapping ranges and gaps with LEAD window functions.",
    "Rebuild the entire SCD2 snapshot from an append-only event log using window functions.",
  ],
  estimatedMinutes: 150,
  xpReward: 500,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "B2B fintech. Finance disputes a chargeback because the customer's tier in the current dim is gold but the order pre-dates that upgrade. You're the analytics engineer; you need a queryable history.",
    hiringRelevance2026:
      "Every 2026 DE/AE job posting mentions 'historical reporting', 'point-in-time correctness', or SCD Type 2 by name. The interview rubric for any senior IC role at Snowflake/dbt-shop companies includes 'walk me through how you'd answer an as-of question against a dimension table'. This project is the textbook answer.",
    readmeOutline: [
      "Overview & Scenario",
      "Setup (Postgres + seed data)",
      "Step 1 — Design the SCD2 dimension",
      "Step 2 — Apply an SCD2 update transactionally",
      "Step 3 — Point-in-time as-of query",
      "Step 4 — Bitemporal integrity audit",
      "Step 5 — Rebuild snapshot from an event log",
      "Validation harness (psql + expected result sets)",
      "Portfolio Hand-off (deployed demo + screencast)",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo containing the migrations (`/migrations`), seed data (`/seed`), five graded SQL queries (`/queries`), the deterministic validator harness (`/test/run_validator.py` against a docker-compose Postgres), and the README demonstrating each query's expected vs actual output.",
    portfolioRelevance:
      "A 2026 hiring manager reviewing this repo sees: production-grade SCD2 design, transactional safety, a window-function audit query, AND a self-validating harness. That bundle screens as senior-level analytics-engineering work — well beyond 'I took the dbt fundamentals course.'",
    repoUrl: "https://github.com/<your-handle>/scd2-time-travel-lab",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Design and seed the SCD2 dimension table",
      instructionMd: [
        "Create `dim_customer` with a surrogate key, the natural key (`customer_id`), tier, and an explicit validity interval (`valid_from`, `valid_to`, `is_current`). Use the **half-open** convention `[valid_from, valid_to)` — a row is currently effective when `valid_to IS NULL`.",
        "",
        "Then seed three customers with their opening (currently-effective) rows. The validator will check the row count and the (customer_id, tier, valid_from) tuple per seed row.",
        "",
        "Seed rows:",
        "- customer_id 1: Ada Lovelace / `ada@example.com` / bronze / opened 2025-01-01",
        "- customer_id 2: Linus Torvalds / `linus@example.com` / silver / opened 2025-02-15",
        "- customer_id 3: Grace Hopper / `grace@example.com` / gold / opened 2025-03-10",
        "",
        "All `valid_to` values should be `NULL` and `is_current` should be `TRUE`.",
      ].join("\n"),
      learningObjective: "Design an SCD Type 2 dimension table with explicit validity intervals and seed the initial state.",
      requiredSkill: "PostgreSQL DDL + SCD2 schema design",
      starterCode: DDL_SCD2,
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig(
        "sql_resultset",
        "After running the learner's SQL, querying SELECT customer_id, tier, valid_from, valid_to, is_current FROM dim_customer ORDER BY customer_id should match the expected 3 rows exactly.",
        {
          probeQuery:
            "SELECT customer_id, tier, valid_from, valid_to, is_current FROM dim_customer ORDER BY customer_id",
          expectedRows: [
            { customer_id: 1, tier: "bronze", valid_from: "2025-01-01T00:00:00Z", valid_to: null, is_current: true },
            { customer_id: 2, tier: "silver", valid_from: "2025-02-15T00:00:00Z", valid_to: null, is_current: true },
            { customer_id: 3, tier: "gold",   valid_from: "2025-03-10T00:00:00Z", valid_to: null, is_current: true },
          ],
          referenceSolution: DDL_SCD2_EXPECTED,
        },
      ),
      expectedOutputs: {
        rowCount: 3,
        sampleRow: { customer_id: 1, tier: "bronze", is_current: true },
      },
      datasetRefs: ["fixtures/dim_customer_initial_state.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Look at the seeded `valid_from` dates — none of them have a matching `valid_to`. What does that tell you about the value of `valid_to` for these opening rows?",
          "A row is currently effective when nothing has superseded it yet. PostgreSQL has a special value that means 'no value' — that's the right thing to put in `valid_to`.",
          "Use `NULL` for `valid_to` and `TRUE` for `is_current` on every seed row. Insert all three customers in a single VALUES list so the validator sees a deterministic order.",
          "INSERT INTO dim_customer (customer_id, full_name, email, tier, valid_from, valid_to, is_current)\nVALUES\n  (1, 'Ada Lovelace', 'ada@example.com', 'bronze', TIMESTAMPTZ '2025-01-01 00:00+00', NULL, TRUE),\n  ... (fill in customers 2 and 3 with the same pattern)",
          DDL_SCD2_EXPECTED,
        ],
        successFeedback:
          "Clean opening snapshot — three customers, each with an open validity interval. The rest of the project builds on this baseline.",
        failureFeedback:
          "Most common slips: forgot to set `valid_to = NULL`, used `now()` instead of the seed timestamp, or used `TIMESTAMP` (no tz) instead of `TIMESTAMPTZ`. The validator compares timestamps in UTC so timezone-naive values will fail.",
        portfolioRelevance:
          "Every interview question on dimensional modeling starts with 'how do you represent history?'. The half-open interval `[valid_from, valid_to)` with `valid_to NULL = current` is the textbook answer Kimball/dbt/Snowflake teams expect.",
        finalExplanation:
          "Two design choices to remember: TIMESTAMPTZ everywhere (never bare TIMESTAMP) so DST and cross-region inserts don't corrupt history, and the half-open interval — every range is `[valid_from, valid_to)` so two adjacent rows where one ends at T and the next starts at T do NOT overlap. This convention matters when we write the audit query in step 4.",
        misconceptionToWatchFor:
          "Treating SCD2 as 'just add another column' — newcomers often store only the current row and patch the column on update. That destroys history and is exactly what we're solving here.",
      }),
    },
    {
      stepNumber: 2,
      title: "Apply an SCD2 update transactionally with a CTE",
      instructionMd: [
        "Customer 1 (Ada Lovelace) upgraded from bronze to silver effective `2026-03-01 00:00+00`. Apply the SCD2 update.",
        "",
        "Two writes are needed: close the currently-effective row (`valid_to = '2026-03-01'`, `is_current = FALSE`) AND insert a new row (`valid_from = '2026-03-01'`, `valid_to = NULL`, `is_current = TRUE`, `tier = 'silver'`).",
        "",
        "Express both writes in a **single statement** using `WITH closed AS (UPDATE ... RETURNING ...) INSERT ... SELECT ... FROM closed`. The single-statement form is atomic — the table is never in a state with two `is_current = TRUE` rows for the same `customer_id`.",
        "",
        "The validator will check that after your statement runs, the dim has exactly two rows for `customer_id = 1`: the closed bronze row with `valid_to = '2026-03-01'` and the new silver row with `valid_to = NULL`.",
      ].join("\n"),
      learningObjective: "Apply an SCD Type 2 update transactionally using a single CTE so the table is never in a half-updated state.",
      requiredSkill: "PostgreSQL CTE with UPDATE ... RETURNING + INSERT ... SELECT",
      starterCode: SCD2_UPDATE,
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig(
        "sql_resultset",
        "After the learner's statement runs, querying customer_id=1's rows ordered by valid_from should match the closed-bronze + new-silver pair.",
        {
          probeQuery:
            "SELECT customer_id, tier, valid_from, valid_to, is_current FROM dim_customer WHERE customer_id = 1 ORDER BY valid_from",
          expectedRows: [
            { customer_id: 1, tier: "bronze", valid_from: "2025-01-01T00:00:00Z", valid_to: "2026-03-01T00:00:00Z", is_current: false },
            { customer_id: 1, tier: "silver", valid_from: "2026-03-01T00:00:00Z", valid_to: null,                    is_current: true  },
          ],
          referenceSolution: SCD2_UPDATE_EXPECTED,
        },
      ),
      expectedOutputs: {
        closedRow: { tier: "bronze", valid_to: "2026-03-01T00:00:00Z", is_current: false },
        newRow:    { tier: "silver", valid_to: null,                    is_current: true  },
      },
      datasetRefs: ["fixtures/dim_customer_after_step2.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Two writes need to happen — but you must not let any reader see a state where both the bronze and silver rows are simultaneously `is_current = TRUE`. How can a single SQL statement do both?",
          "PostgreSQL's `WITH ... AS (UPDATE ... RETURNING ...)` lets you take the rows updated by the first part and pipe them into a follow-up INSERT in the same statement. That whole thing is atomic.",
          "Inside the CTE, UPDATE dim_customer SET valid_to = '2026-03-01', is_current = FALSE WHERE customer_id=1 AND is_current, and RETURN customer_id, full_name, email. Then INSERT a new row with those returned values + new tier and `valid_from = '2026-03-01'`.",
          "WITH closed AS (\n  UPDATE dim_customer\n     SET valid_to = TIMESTAMPTZ '2026-03-01 00:00+00',\n         is_current = FALSE\n   WHERE customer_id = 1 AND is_current\n   RETURNING customer_id, full_name, email\n)\nINSERT INTO dim_customer (...) SELECT ..., 'silver', TIMESTAMPTZ '2026-03-01 00:00+00', NULL, TRUE FROM closed;",
          SCD2_UPDATE_EXPECTED,
        ],
        successFeedback:
          "Single-statement SCD2 update — atomic, race-free, and easy to wrap in a migration. This is the production pattern every dbt snapshot ultimately compiles to.",
        failureFeedback:
          "Common slips: ran the UPDATE and INSERT as two separate statements (a concurrent reader could see zero current rows or two), forgot the `AND is_current` predicate (closes EVERY historical bronze row, not just the open one), or set `is_current = TRUE` on the closed row.",
        portfolioRelevance:
          "Senior data-engineering interviews ask 'how do you avoid race conditions in dimension updates?' The CTE-with-RETURNING pattern is the canonical answer; saying 'I wrapped it in a transaction' is the junior answer.",
        finalExplanation:
          "The CTE form is atomic at the statement level — there is no observable midpoint where readers see two current rows or zero current rows. Equivalent to BEGIN; UPDATE; INSERT; COMMIT; but with one fewer round-trip and no chance of the application crashing between statements. Real production warehouses use exactly this pattern (it's what dbt-snapshot generates under the hood).",
        misconceptionToWatchFor:
          "Thinking 'I'll just wrap UPDATE + INSERT in a transaction' — that works, but it's two network round-trips and the application has to remember to COMMIT. A single statement is strictly safer.",
      }),
    },
    {
      stepNumber: 3,
      title: "Answer the chargeback: point-in-time as-of query",
      instructionMd: [
        "Now resolve the original chargeback. The disputed order was placed by `customer_id = 1` at `2026-02-10 12:00+00` — BEFORE the SCD2 upgrade you applied in step 2. What tier was customer 1 on at that instant?",
        "",
        "Write a SELECT that returns one row with columns: `customer_id`, `full_name`, `tier_at_order`. Use the half-open range predicate so a row from `[valid_from, valid_to)` matches when `valid_from <= :order_ts AND :order_ts < valid_to`. Remember that `valid_to IS NULL` means the row is currently effective.",
        "",
        "The validator expects `tier_at_order = 'bronze'` (the upgrade hadn't happened yet at order time).",
      ].join("\n"),
      learningObjective: "Answer an as-of point-in-time question with a half-open range predicate, handling the currently-effective `valid_to IS NULL` case correctly.",
      requiredSkill: "PostgreSQL as-of join with half-open intervals",
      starterCode: ASOF_QUERY,
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig(
        "sql_resultset",
        "Run the learner's query; expect a single row matching customer 1's bronze tier at the disputed order timestamp.",
        {
          probeQuery: "<learner-supplied query>",
          expectedRows: [
            { customer_id: 1, full_name: "Ada Lovelace", tier_at_order: "bronze" },
          ],
          referenceSolution: ASOF_EXPECTED,
        },
      ),
      expectedOutputs: {
        row: { customer_id: 1, tier_at_order: "bronze" },
      },
      datasetRefs: ["fixtures/asof_disputed_order.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "You need a predicate that picks the ONE row whose validity interval contains the order timestamp. Think about which boundary is inclusive and which is exclusive.",
          "Use the half-open convention from step 1: `valid_from <= :order_ts AND :order_ts < valid_to`. The trick is that `valid_to` can also be `NULL` (currently effective) — your predicate must accept that case.",
          "Add `AND (valid_to IS NULL OR :order_ts < valid_to)` so a NULL valid_to is treated as +infinity. Without this clause, the currently-effective row never matches.",
          "WHERE customer_id = 1\n  AND valid_from <= TIMESTAMPTZ '2026-02-10 12:00+00'\n  AND (valid_to IS NULL OR TIMESTAMPTZ '2026-02-10 12:00+00' < valid_to)",
          ASOF_EXPECTED,
        ],
        successFeedback:
          "That's the answer Finance needs — bronze tier at order time, dispute resolved. The half-open + NULL-aware predicate is the exact pattern every as-of join in the warehouse uses.",
        failureFeedback:
          "If you got two rows, you probably used `BETWEEN` or used `<=` on BOTH sides of the interval — that double-counts the boundary instant when SCD2 updates land. If you got zero rows, you probably forgot the `valid_to IS NULL OR ...` arm.",
        portfolioRelevance:
          "This single query is the canonical answer to 'how do you handle as-of joins?' — a question that comes up in every senior analytics-engineering / data-engineering loop. Practicing it once on real data is worth ten blog posts.",
        finalExplanation:
          "Half-open intervals + NULL-aware predicates are the entire reason SCD2 tables work. The reason we used half-open in step 1 is so the predicate `valid_from <= ts < valid_to` correctly handles the boundary moment when one row ends and the next begins (the instant `T = valid_to_old = valid_from_new` belongs to the NEW row, not both).",
        misconceptionToWatchFor:
          "Reaching for `BETWEEN` — `BETWEEN a AND b` is inclusive on both sides, which double-counts the boundary instant of an SCD2 switchover. Use explicit `<=` and `<` instead.",
      }),
    },
    {
      stepNumber: 4,
      title: "Audit for bitemporal integrity bugs (window functions)",
      instructionMd: [
        "Build the integrity auditor. For each `customer_id` whose history has either an overlap (two rows simultaneously valid) or a gap (a window during which no row is valid), output one row.",
        "",
        "Required output columns: `customer_id`, `kind` (either `'overlap'` or `'gap'`), `prev_valid_to`, `next_valid_from`.",
        "",
        "Use the `LEAD()` window function partitioned by `customer_id` and ordered by `valid_from` to compare each row's `valid_to` against the next row's `valid_from`. Remember the half-open convention: `next_valid_from = prev_valid_to` is CORRECT and must not be flagged.",
        "",
        "On the seeded data after step 2, this query should return ZERO rows — the SCD2 update in step 2 produced a clean transition. We test the same query against a deliberately-broken fixture in the validator harness.",
      ].join("\n"),
      learningObjective: "Audit a bitemporal table for overlapping ranges and gaps using LEAD window functions partitioned by the natural key.",
      requiredSkill: "PostgreSQL LEAD() / OVER (PARTITION BY ... ORDER BY ...) window function",
      starterCode: AUDIT_QUERY,
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig(
        "sql_resultset",
        "On the seeded post-step-2 data, the auditor should return zero rows. The validator harness also runs it against a 'broken fixture' (deliberately overlapping rows) and expects exactly one row with kind='overlap'.",
        {
          probeQuery: "<learner-supplied query>",
          expectedRows: [],
          brokenFixtureExpectedRows: [
            { customer_id: 2, kind: "overlap", prev_valid_to: "2026-01-01T00:00:00Z", next_valid_from: "2025-12-15T00:00:00Z" },
          ],
          referenceSolution: AUDIT_EXPECTED,
        },
      ),
      expectedOutputs: {
        cleanRowCount: 0,
        brokenFixtureKind: "overlap",
      },
      datasetRefs: ["fixtures/audit_clean.json", "fixtures/audit_broken.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "You need to compare each row to its successor for the same customer. SQL has a window function family that lets you peek at the next or previous row.",
          "`LEAD(column) OVER (PARTITION BY natural_key ORDER BY valid_from)` returns the next row's value. Use it to fetch the next valid_from for each row, then compare to the current row's valid_to.",
          "Under the half-open convention, `next_valid_from < prev_valid_to` is an overlap and `next_valid_from > prev_valid_to` is a gap. Equal boundaries are CORRECT — exclude them with `WHERE next_valid_from <> valid_to`.",
          "WITH ranges AS (\n  SELECT customer_id, valid_from, valid_to,\n    LEAD(valid_from) OVER (PARTITION BY customer_id ORDER BY valid_from) AS next_valid_from\n  FROM dim_customer\n)\nSELECT customer_id, CASE WHEN next_valid_from < valid_to THEN 'overlap' WHEN next_valid_from > valid_to THEN 'gap' END AS kind, ... FROM ranges WHERE valid_to IS NOT NULL AND next_valid_from IS NOT NULL AND next_valid_from <> valid_to;",
          AUDIT_EXPECTED,
        ],
        successFeedback:
          "Auditor ships clean. You can now run this on EVERY SCD2 dim in the warehouse on a schedule and get an automatic alert when a buggy update creates an overlap or gap.",
        failureFeedback:
          "Common slips: forgot `PARTITION BY customer_id` (compares unrelated customers' rows), used `LAG` instead of `LEAD` (returns previous, not next), or didn't exclude `next_valid_from = valid_to` so every clean SCD2 transition shows up as a false 'gap'.",
        portfolioRelevance:
          "Pulling out 'I wrote a window-function audit that catches bitemporal integrity violations in production' on a resume → instant senior signal. This is the kind of self-validating code analytics engineering teams pay senior salaries for.",
        finalExplanation:
          "Window functions are the right tool for any 'compare a row to its neighbor' question. `LEAD` peeks forward, `LAG` peeks backward; both PARTITION BY the natural key so you only compare within the same customer's history. This pattern generalizes to every SCD2-style audit you'll ever write.",
        misconceptionToWatchFor:
          "Trying to solve this with a self-join (`FROM dim_customer a JOIN dim_customer b ON a.customer_id=b.customer_id AND b.valid_from > a.valid_from`) — that gives you ALL future rows, not just the immediate successor. Window functions are O(N) sorted; the self-join is O(N²).",
      }),
    },
    {
      stepNumber: 5,
      title: "Disaster-recovery rebuild from an event log",
      instructionMd: [
        "The warehouse just lost its `dim_customer` table to a bad migration. Luckily, every tier change was also appended to an event log table:",
        "",
        "```",
        "customer_events(customer_id INTEGER, event_ts TIMESTAMPTZ, tier_after TEXT)",
        "```",
        "",
        "Reconstruct the equivalent SCD2 snapshot from this log in a single window-function query. For each row, the next event's `event_ts` (per customer, ordered by `event_ts`) becomes that row's `valid_to`; `NULL` means currently effective.",
        "",
        "Output columns in this exact order: `customer_id`, `tier`, `valid_from`, `valid_to`, `is_current`. Order the result by `(customer_id, valid_from)`.",
      ].join("\n"),
      learningObjective: "Rebuild an SCD Type 2 snapshot from an append-only event log using LEAD window functions.",
      requiredSkill: "PostgreSQL window function (LEAD) for event-log materialization",
      starterCode: REBUILD_QUERY,
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig(
        "sql_resultset",
        "Validator seeds customer_events with 4 rows (3 customers, customer 1 has the bronze->silver transition) and expects the rebuilt SCD2 to match the same shape produced by steps 1-2.",
        {
          probeQuery: "<learner-supplied query>",
          fixtureEvents: [
            { customer_id: 1, event_ts: "2025-01-01T00:00:00Z", tier_after: "bronze" },
            { customer_id: 1, event_ts: "2026-03-01T00:00:00Z", tier_after: "silver" },
            { customer_id: 2, event_ts: "2025-02-15T00:00:00Z", tier_after: "silver" },
            { customer_id: 3, event_ts: "2025-03-10T00:00:00Z", tier_after: "gold"   },
          ],
          expectedRows: [
            { customer_id: 1, tier: "bronze", valid_from: "2025-01-01T00:00:00Z", valid_to: "2026-03-01T00:00:00Z", is_current: false },
            { customer_id: 1, tier: "silver", valid_from: "2026-03-01T00:00:00Z", valid_to: null,                    is_current: true  },
            { customer_id: 2, tier: "silver", valid_from: "2025-02-15T00:00:00Z", valid_to: null,                    is_current: true  },
            { customer_id: 3, tier: "gold",   valid_from: "2025-03-10T00:00:00Z", valid_to: null,                    is_current: true  },
          ],
          referenceSolution: REBUILD_EXPECTED,
        },
      ),
      expectedOutputs: {
        rowCount: 4,
        currentCount: 3,
      },
      datasetRefs: ["fixtures/customer_events.json", "fixtures/dim_customer_rebuilt.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "An SCD2 row's `valid_to` is just 'when does the next event for this customer happen?'. SQL has a window function that lets you fetch the next row's value within a partition.",
          "Use `LEAD(event_ts) OVER (PARTITION BY customer_id ORDER BY event_ts)`. That gives you the next event's timestamp per customer, or NULL when no later event exists.",
          "Wrap it in a CTE. Then `SELECT customer_id, tier_after AS tier, event_ts AS valid_from, next_event_ts AS valid_to, (next_event_ts IS NULL) AS is_current`. ORDER BY customer_id, valid_from.",
          "WITH log AS (\n  SELECT customer_id, event_ts, tier_after,\n    LEAD(event_ts) OVER (PARTITION BY customer_id ORDER BY event_ts) AS next_event_ts\n  FROM customer_events\n)\nSELECT customer_id, tier_after AS tier, event_ts AS valid_from, next_event_ts AS valid_to, (next_event_ts IS NULL) AS is_current\nFROM log ORDER BY customer_id, valid_from;",
          REBUILD_EXPECTED,
        ],
        successFeedback:
          "Full DR rebuild from the event log in one query — the warehouse is recoverable. This pattern (snapshot = window-materialized event log) is also exactly how Kafka Streams' KTable and Iceberg's CDC-merge work under the hood.",
        failureFeedback:
          "Common slips: forgot the PARTITION BY so events from different customers got their `next_event_ts` from each other; missed the `is_current` boolean (it's `(next_event_ts IS NULL)`, not a literal `TRUE`); didn't ORDER BY at the end and the validator's row-order check failed.",
        portfolioRelevance:
          "Event-log → snapshot rematerialization is the foundation of modern lakehouse / CDC pipelines. Putting 'rebuilt a dimensional snapshot from an event log with window functions' on a resume signals you understand the modern Iceberg / Delta / Hudi pattern — not just static SQL.",
        finalExplanation:
          "The duality between an append-only event log and a window-materialized snapshot is one of the most important ideas in modern data engineering. CDC pipelines (Debezium → Iceberg MERGE), KTables (Kafka Streams), and dbt incremental models all rely on it. Mastering this one query teaches you the mental model behind all of them.",
        misconceptionToWatchFor:
          "Trying to UPDATE rows in a CTE chain after computing valid_to — there's no need. The window function gives you the right valid_to in a single SELECT; no mutation required.",
      }),
    },
  ],
};
