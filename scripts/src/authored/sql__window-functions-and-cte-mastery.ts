/**
 * Phase 13 — sql course-seed (net-new). Lifts the `sql` course from 2 → 3
 * learner-visible projects.
 *
 * Candidate 24708df5-8a01-45bb-9eef-e758697a8ba3 — Window-function + CTE
 * mastery: ranking, running totals, gaps-and-islands, percentile cohorts,
 * recursive hierarchy, and a final analytics query that combines them.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const sqlWindowFunctionsAndCteMastery: AuthoredProject = {
  slug: "sql-window-functions-and-cte-mastery",
  candidateId: "24708df5-8a01-45bb-9eef-e758697a8ba3",
  title: "SQL Mastery — Window Functions, CTEs, and Recursive Patterns",
  shortDescription:
    "Build a sequence of production-grade analytics queries: ranking with ties, gaps-and-islands sessionization, recursive org-chart traversal, and a final cohort-retention query that combines window frames, CTEs, and lateral joins.",
  fullDescription:
    "Most engineers can write a basic `OVER (PARTITION BY ...)` but stall the moment a query needs a custom frame, a running total reset, or recursion. You'll work through 5 problems hiring managers actually ask: top-N-per-group with stable tie-breaks, gaps-and-islands sessionization (the canonical interview), percentile-based churn cohorts, recursive manager chains with cycle detection, and a final retention curve that combines window aggregates + CTEs + lateral joins. Every query is run against a 250k-row fixture; correctness is checked by set-equal, not text comparison.",
  language: "sql",
  difficulty: "intermediate",
  techStack: ["PostgreSQL", "SQL", "window-functions", "CTEs", "recursive-CTE", "lateral-join"],
  tags: ["sql", "window-functions", "cte", "analytics", "recursive", "cohort-analysis"],
  learningObjectives: [
    "Use `ROW_NUMBER`, `RANK`, `DENSE_RANK` with explicit tie-break columns for stable top-N-per-group.",
    "Solve the gaps-and-islands problem with a `ROW_NUMBER` differencing trick.",
    "Compute running totals + reset-on-condition with a custom window frame.",
    "Write a recursive CTE with cycle detection (UNION + path array) for hierarchy traversal.",
    "Combine CTEs, lateral joins, and window aggregates in a single cohort-retention query.",
  ],
  estimatedMinutes: 180,
  xpReward: 620,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Analytics engineer on a 2026 growth team. PM wants weekly cohort-retention, top-3 ranked sales reps per region, and an org-chart traversal for a new permissions feature. You'll write each query against a real 250k-row Postgres fixture; the result has to round-trip through dbt without manual SQL gymnastics.",
    hiringRelevance2026:
      "Window functions + recursive CTEs are the most common SQL screening topic for any AE / DS / DE role. Most candidates know `PARTITION BY` but stall on custom frames + recursion. This drills exactly the failure modes.",
    readmeOutline: [
      "Overview & Fixture Schema", "Setup (Postgres docker-compose)",
      "Step 1 ranked top-N with tie breaks", "Step 2 gaps-and-islands sessionization",
      "Step 3 running totals + reset frames", "Step 4 recursive org chart + cycle detection",
      "Step 5 cohort retention combined query", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo: docker-compose Postgres + seed script (250k rows of orders, employees, events), each step's query in `queries/NN_<topic>.sql`, a test runner that asserts each query's output set-equals the expected fixture, and a 1-page write-up explaining the frame-vs-partition mental model.",
    portfolioRelevance:
      "A reproducible SQL repo with a correctness harness shows you can write analytics SQL AND prove it — most candidates can do neither cleanly. Hiring managers love seeing the recursive CTE with cycle detection in particular.",
    repoUrl: "https://github.com/<your-handle>/sql-window-cte-mastery",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Top-3 sales reps per region with stable tie breaks",
      instructionMd:
        "From `sales(rep_id, region, deal_value, closed_at)`, return the top-3 reps per region by total `deal_value`. Tie-break on most-recent `closed_at`, then on smaller `rep_id` (deterministic). Use `ROW_NUMBER() OVER (PARTITION BY region ORDER BY total_value DESC, last_close DESC, rep_id ASC)`. Validator runs against a 50k-row fixture spanning 12 regions; expects exactly 36 rows back, all rank ≤ 3, no duplicates within a region.",
      learningObjective: "`ROW_NUMBER` vs `RANK` vs `DENSE_RANK`: pick the one that matches your top-N semantics, and ALWAYS spell out the tie-break columns.",
      requiredSkill: "Window functions with explicit tie-break ORDER BY",
      starterCode: SRC(`-- queries/01_top_n_per_region.sql
WITH rep_totals AS (
  SELECT
    region,
    rep_id,
    SUM(deal_value)                                    AS total_value,
    MAX(closed_at)                                     AS last_close
  FROM sales
  GROUP BY region, rep_id
),
ranked AS (
  SELECT
    region,
    rep_id,
    total_value,
    last_close,
    -- TODO: tie-break by last_close DESC then rep_id ASC so output is deterministic.
    ROW_NUMBER() OVER (
      PARTITION BY region
      ORDER BY total_value DESC, last_close DESC, rep_id ASC
    ) AS rnk
  FROM rep_totals
)
SELECT region, rep_id, total_value, last_close, rnk
FROM ranked
WHERE rnk <= 3
ORDER BY region, rnk;`),
      validationType: "csv_set_equal",
      stepType: "code_sql",
      validation: validationConfig("csv_set_equal", "36 rows (12 regions × top-3), no region has duplicates, max rnk per region = 3.", {
        expectedRowCount: 36,
        keyColumns: ["region", "rep_id"],
        invariants: { maxRankPerRegion: 3, distinctRegions: 12 },
      }),
      expectedOutputs: { rows: 36, regions: 12, maxRank: 3 },
      datasetRefs: ["fixtures/sales_50k.csv", "fixtures/sales_topn_expected.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "`RANK()` skips numbers on ties (1,1,3) — fine for awards, wrong for 'top-3 distinct'.",
          "`DENSE_RANK()` keeps the sequence (1,1,2) — also wrong if you want exactly 3 rows.",
          "`ROW_NUMBER()` always gives a single dense sequence; pair it with explicit tie-break columns so the choice is deterministic.",
          "Forgetting `rep_id` as the final tie-break makes results flap between runs when last_close is also tied.",
          "ROW_NUMBER() OVER (PARTITION BY region ORDER BY total_value DESC, last_close DESC, rep_id ASC)",
        ],
        successFeedback: "You wrote a top-N-per-group query that's reproducible across runs — the gold standard.",
        failureFeedback: "Most slips: using RANK when you wanted ROW_NUMBER, or omitting the deterministic tie-break columns.",
        portfolioRelevance: "Top-N-per-group with stable tie-breaks is a Day-1 analytics query. Hiring managers screen on it.",
        finalExplanation: "Window functions are a way to ask SQL 'compute this value relative to a subset of rows defined by the OVER clause' — `PARTITION BY` defines the subset, `ORDER BY` defines the order within it.",
        misconceptionToWatchFor: "Believing `RANK` and `ROW_NUMBER` are interchangeable. They are not — tie behavior differs and the wrong choice changes row count.",
      }),
    },
    {
      stepNumber: 2,
      title: "Gaps-and-islands — sessionize user events with a 30-minute idle gap",
      instructionMd:
        "From `events(user_id, event_at)`, group consecutive events per user into sessions where any gap > 30 minutes starts a new session. Use the classic `ROW_NUMBER` differencing trick: number all events per user, number gap-starting events per user, subtract to get an island id. Validator checks against 100k events; expects exactly 4,217 sessions with the expected average session length.",
      learningObjective: "Gaps-and-islands is the canonical 'how do you think in window functions' interview question.",
      requiredSkill: "ROW_NUMBER differencing + LAG for gap detection",
      starterCode: SRC(`-- queries/02_sessionize.sql
WITH ordered AS (
  SELECT
    user_id,
    event_at,
    LAG(event_at) OVER (PARTITION BY user_id ORDER BY event_at) AS prev_at
  FROM events
),
flagged AS (
  SELECT
    user_id,
    event_at,
    -- 1 when this event starts a new session (>30min idle since previous)
    CASE WHEN prev_at IS NULL OR event_at - prev_at > INTERVAL '30 minutes'
         THEN 1 ELSE 0 END AS is_new_session
  FROM ordered
),
session_ids AS (
  SELECT
    user_id,
    event_at,
    -- TODO: cumulative SUM over the 1/0 flag yields a per-user session number.
    SUM(is_new_session) OVER (PARTITION BY user_id ORDER BY event_at
                              ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS session_no
  FROM flagged
)
SELECT
  user_id,
  session_no,
  MIN(event_at) AS session_start,
  MAX(event_at) AS session_end,
  COUNT(*)      AS event_count
FROM session_ids
GROUP BY user_id, session_no
ORDER BY user_id, session_no;`),
      validationType: "csv_set_equal",
      stepType: "code_sql",
      validation: validationConfig("csv_set_equal", "4217 distinct (user_id, session_no) sessions; every gap > 30min splits a session.", {
        expectedRowCount: 4217,
        keyColumns: ["user_id", "session_no"],
        invariants: { maxGapWithinSessionMinutes: 30 },
      }),
      expectedOutputs: { sessions: 4217, maxGapWithinSession: "<=30min" },
      datasetRefs: ["fixtures/events_100k.csv", "fixtures/sessions_expected.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Gaps-and-islands always has two layers: detect the 'island starts' with LAG/LEAD, then cumulative-sum a 0/1 flag to give each island an id.",
          "`LAG(event_at) OVER (PARTITION BY user_id ORDER BY event_at)` is the diff primitive.",
          "`SUM(is_new_session) OVER (...ROWS UNBOUNDED PRECEDING)` is the running id assignment.",
          "Without the ROWS frame, the SUM is computed over the entire partition — wrong by default.",
          "SUM(is_new_session) OVER (PARTITION BY user_id ORDER BY event_at ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)",
        ],
        successFeedback: "You implemented sessionization without a single self-join — that's the win.",
        failureFeedback: "Most slips: omitting the ROWS frame (cum-sum becomes total-sum); using DENSE_RANK on the flag (doesn't give monotonic session ids).",
        portfolioRelevance: "Sessionization is the most-asked 'show me you can think in windows' interview problem. Pin this one.",
        finalExplanation: "Cumulative SUM over a 0/1 flag is the bread-and-butter trick for grouping consecutive rows that share some property — sessions, runs, status streaks.",
        misconceptionToWatchFor: "Trying to solve gaps-and-islands with self-joins. It works but is O(N²) and never passes a production-size dataset.",
      }),
    },
    {
      stepNumber: 3,
      title: "Running totals with reset — daily revenue with a month-to-date that resets each month",
      instructionMd:
        "From `orders(ordered_at, amount)`, produce one row per day with `daily_revenue` and `month_to_date_revenue` that resets on the 1st of each month. Use `SUM(...) OVER (PARTITION BY date_trunc('month', ordered_at) ORDER BY day ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)`. Validator checks 730 daily rows over 2 years; asserts MTD = sum of all days in that month so far, and MTD resets to that day's revenue on the 1st.",
      learningObjective: "The frame clause (`ROWS BETWEEN ...`) is what turns a window aggregate from total → running. Without it, every row in the partition sees the same value.",
      requiredSkill: "Partition-by-bucket + ROWS frame for running aggregates",
      starterCode: SRC(`-- queries/03_running_total_mtd.sql
WITH daily AS (
  SELECT
    date_trunc('day', ordered_at)::date AS day,
    SUM(amount)                         AS daily_revenue
  FROM orders
  GROUP BY 1
)
SELECT
  day,
  daily_revenue,
  -- TODO: month_to_date resets on the 1st by partitioning on month bucket.
  SUM(daily_revenue) OVER (
    PARTITION BY date_trunc('month', day)
    ORDER BY day
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS month_to_date_revenue
FROM daily
ORDER BY day;`),
      validationType: "csv_set_equal",
      stepType: "code_sql",
      validation: validationConfig("csv_set_equal", "730 rows; first-of-month rows have MTD = daily_revenue; last-of-month rows have MTD = total month revenue.", {
        expectedRowCount: 730,
        keyColumns: ["day"],
        invariants: { mtdResetsOnFirstOfMonth: true, mtdMonotonicWithinMonth: true },
      }),
      expectedOutputs: { days: 730, mtdResetsOnFirstOfMonth: true },
      datasetRefs: ["fixtures/orders_2yr.csv", "fixtures/mtd_expected.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Without `PARTITION BY date_trunc('month', day)`, the running total just keeps going forever.",
          "Without the `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` frame, you get the partition total on every row, not the running value.",
          "`RANGE` and `ROWS` are not the same — `RANGE` uses value distance, `ROWS` uses physical rows. For daily MTD, `ROWS` is correct.",
          "If your frame omits the `ROWS BETWEEN ...` clause, Postgres defaults to `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` — usually wrong for finance.",
          "SUM(daily_revenue) OVER (PARTITION BY date_trunc('month', day) ORDER BY day ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)",
        ],
        successFeedback: "Running totals with a reset condition — solved cleanly with one window expression.",
        failureFeedback: "Most slips: forgetting the partition (no reset); forgetting the frame (every row shows month total).",
        portfolioRelevance: "MTD/YTD running totals are universal finance queries. Show the frame-clause discipline.",
        finalExplanation: "Window-function frames are the most-skipped, most-asked piece of SQL. `PARTITION BY` decides where you reset, `ORDER BY` decides the direction, `ROWS BETWEEN` decides what's in scope.",
        misconceptionToWatchFor: "Believing `OVER (ORDER BY day)` alone gives a running total. It does — but with the default `RANGE` frame, which behaves badly on duplicate keys.",
      }),
    },
    {
      stepNumber: 4,
      title: "Recursive CTE — org chart traversal with cycle detection",
      instructionMd:
        "From `employees(id, name, manager_id)`, return every employee with `path` (array of ancestor names, root first) and `depth`. Detect cycles using the path-array technique: WHERE NOT (child.id = ANY(parent.path_ids)). Validator runs against 5k employees (depth up to 8) with 3 injected cycles; expects 5k clean rows + a query that doesn't infinite-loop on the cycles.",
      learningObjective: "Recursive CTEs are the standard SQL pattern for hierarchical data. The cycle-detection guard is non-negotiable in production.",
      requiredSkill: "Recursive CTE with UNION + path-array cycle guard",
      starterCode: SRC(`-- queries/04_recursive_org_chart.sql
WITH RECURSIVE org AS (
  -- Anchor: CEOs (no manager)
  SELECT
    id,
    name,
    manager_id,
    ARRAY[name]    AS path,
    ARRAY[id]      AS path_ids,
    1              AS depth
  FROM employees
  WHERE manager_id IS NULL

  UNION ALL

  -- Recursive: children of already-seen managers, with cycle guard
  SELECT
    e.id,
    e.name,
    e.manager_id,
    org.path || e.name,
    org.path_ids || e.id,
    org.depth + 1
  FROM employees e
  JOIN org ON e.manager_id = org.id
  -- TODO: cycle guard — refuse to recurse into an id already on the path.
  WHERE NOT (e.id = ANY(org.path_ids))
    AND org.depth < 50  -- hard ceiling, belt-and-suspenders
)
SELECT id, name, manager_id, path, depth FROM org ORDER BY depth, id;`),
      validationType: "csv_set_equal",
      stepType: "code_sql",
      validation: validationConfig("csv_set_equal", "5000 employees returned; max depth=8; query terminates despite 3 injected cycles.", {
        expectedRowCount: 5000,
        keyColumns: ["id"],
        invariants: { maxDepth: 8, cyclesDetected: 3, terminates: true },
      }),
      expectedOutputs: { employees: 5000, maxDepth: 8, cyclesSkipped: 3 },
      datasetRefs: ["fixtures/employees_5k.csv", "fixtures/org_chart_expected.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Recursive CTE = anchor (base case) `UNION ALL` recursive (steps). Anchor MUST return finite rows.",
          "Without a cycle guard, a cycle in `manager_id` infinite-loops the planner.",
          "Path-array trick: keep an array of ancestor ids; refuse to recurse into an id already present.",
          "Belt-and-suspenders: add `AND org.depth < 50` so a bug in the guard can't crash the DB.",
          "WHERE NOT (e.id = ANY(org.path_ids))",
        ],
        successFeedback: "Recursive traversal with cycle guard — handles malformed real-world hierarchies.",
        failureFeedback: "Most slips: omitting cycle guard (infinite loop); using UNION instead of UNION ALL (silently dedupes legitimate duplicates).",
        portfolioRelevance: "Cycle-safe hierarchy queries are a senior SQL signal. Pin this with the depth-ceiling justification.",
        finalExplanation: "Recursive CTE is the only standard-SQL way to traverse trees of arbitrary depth. Always guard against cycles + always add a depth ceiling.",
        misconceptionToWatchFor: "Believing the DB will detect cycles automatically. It will not — a cycle yields an infinite plan.",
      }),
    },
    {
      stepNumber: 5,
      title: "Cohort retention — CTEs + window aggregates + lateral join combined",
      instructionMd:
        "Compute monthly cohort retention: for each signup cohort (month), what fraction of users were active in month 0, 1, 2, ..., 11? Build it as: (a) `signups` CTE assigning each user to their cohort month; (b) `active_months` CTE flagging the months each user had ≥1 event; (c) `cohort_grid` CTE cross-joining cohort × months_since with `LATERAL`; (d) final SELECT counting active users per cell and dividing by cohort size with a window. Validator: 24 cohorts × 12 months = 288 cells; cohort-size column constant within a cohort; retention[0]=1.0 for every cohort.",
      learningObjective: "Real analytics queries compose 3-4 layers — CTEs for staging, window for normalization, lateral for the cross-product. Each piece is simple; the composition is the skill.",
      requiredSkill: "Compose CTEs + LATERAL join + window normalization",
      starterCode: SRC(`-- queries/05_cohort_retention.sql
WITH signups AS (
  SELECT user_id, date_trunc('month', MIN(event_at))::date AS cohort_month
  FROM events GROUP BY user_id
),
active_months AS (
  SELECT DISTINCT
    e.user_id,
    s.cohort_month,
    EXTRACT(YEAR FROM age(date_trunc('month', e.event_at), s.cohort_month)) * 12
      + EXTRACT(MONTH FROM age(date_trunc('month', e.event_at), s.cohort_month)) AS months_since
  FROM events e JOIN signups s ON s.user_id = e.user_id
),
cohort_sizes AS (
  SELECT cohort_month, COUNT(*)::numeric AS cohort_size FROM signups GROUP BY cohort_month
),
cells AS (
  SELECT
    s.cohort_month,
    g.months_since::int AS months_since,
    COUNT(am.user_id)::numeric AS active_users
  FROM (SELECT DISTINCT cohort_month FROM signups) s
  CROSS JOIN LATERAL generate_series(0, 11) AS g(months_since)
  LEFT JOIN active_months am
    ON am.cohort_month = s.cohort_month AND am.months_since = g.months_since
  GROUP BY s.cohort_month, g.months_since
)
-- TODO: divide active_users by cohort_size to get retention; round to 4 dp.
SELECT
  c.cohort_month,
  c.months_since,
  cs.cohort_size::int AS cohort_size,
  ROUND(c.active_users / NULLIF(cs.cohort_size, 0), 4) AS retention
FROM cells c JOIN cohort_sizes cs USING (cohort_month)
ORDER BY c.cohort_month, c.months_since;`),
      validationType: "numeric_tolerance",
      stepType: "code_sql",
      validation: validationConfig("numeric_tolerance", "288 cells (24 cohorts × 12 months); cohort_size constant per cohort; retention[months_since=0] = 1.0 for every cohort.", {
        expectedRowCount: 288,
        keyColumns: ["cohort_month", "months_since"],
        tolerance: 0.001,
        invariants: { retentionAtZeroEqualsOne: true, cohortSizeConstantWithinCohort: true },
      }),
      expectedOutputs: { cells: 288, cohorts: 24, retentionAt0: 1.0 },
      datasetRefs: ["fixtures/events_100k.csv", "fixtures/cohort_retention_expected.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Cohort retention is always a cross-product: every cohort × every months_since. `LATERAL generate_series(0, N)` makes that explicit.",
          "`age(start, end)` returns an interval; pull out year*12 + month to get a clean integer 'months since signup'.",
          "Divide by cohort size via a JOIN, not a window, when cohort size is constant per cohort — clearer + faster.",
          "Wrap the divisor in `NULLIF(.., 0)` so an empty cohort doesn't crash the query.",
          "CROSS JOIN LATERAL generate_series(0, 11) AS g(months_since)",
        ],
        successFeedback: "Multi-layer analytics query: CTEs + LATERAL + window aggregates composed cleanly — this is the level real dbt models live at.",
        failureFeedback: "Most slips: forgetting LATERAL (cells missing for cohorts with zero activity in a month); dividing active_users by total users instead of cohort users.",
        portfolioRelevance: "A working cohort-retention query is a portfolio centerpiece. PMs and growth leads ask for it constantly.",
        finalExplanation: "Real analytics queries are a stack: stage with CTEs, expand with LATERAL or generate_series, normalize with windows or joins. Each step stays simple; the composition is the senior signal.",
        misconceptionToWatchFor: "Trying to compute retention with a single GROUP BY. You can't — the missing cells (cohorts with 0 active in month K) get dropped without LATERAL.",
      }),
    },
  ],
};
