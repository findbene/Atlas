/**
 * Phase 14 — sql beginner-tier seed (net-new). Lifts the visible
 * `beginner` count toward 6 and gives sql learners a true entry-tier
 * on-ramp before the existing intermediate/advanced sql work.
 *
 * Candidate 93c15ce7-344f-48a2-8aa8-67ee7284e77e — SELECT/WHERE/ORDER/
 * JOIN essentials on a tiny 2-table schema (customers + orders): the
 * five most-asked patterns in a real BI inbox, with the literal queries
 * the learner will type into a 2026 analytics console.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const sqlBeginnerSelectWhereJoinEssentials: AuthoredProject = {
  slug: "sql-beginner-select-where-join-essentials",
  candidateId: "93c15ce7-344f-48a2-8aa8-67ee7284e77e",
  title: "SQL Beginner — SELECT, WHERE, ORDER BY, JOIN: The Five Queries You'll Actually Write",
  shortDescription:
    "Your first 5 SQL queries against a real customers + orders schema: column projection, AND/OR filtering, ORDER BY + LIMIT, INNER JOIN on a foreign key, and LEFT JOIN to find customers with no orders. Every step's result is verified set-equal against a known answer CSV.",
  fullDescription:
    "Most SQL tutorials start with `SELECT * FROM table` and meander into recursive CTEs by chapter 3. This one stays inside the five patterns a real BI analyst writes daily in 2026: pick specific columns, filter rows safely (AND vs OR, IS NULL), sort + cap, inner-join two tables on the obvious key, and outer-join to find the gap (\"which customers haven't ordered yet?\"). You work against a tiny 8-customer / 12-order schema so failures are obvious — the validation is set-equal against a known answer CSV, not a regex on your SQL text. By the end you can read any small analytics schema and translate a question into a query without copy-pasting from Stack Overflow.",
  language: "sql",
  difficulty: "beginner",
  techStack: ["SQL", "PostgreSQL"],
  tags: ["sql", "beginner", "select", "where", "join", "orders", "customers"],
  learningObjectives: [
    "Project specific columns (never `SELECT *` in production analytics).",
    "Filter rows with WHERE + AND/OR + IS NULL — and know why parentheses matter.",
    "Order results deterministically with ORDER BY <col> <DIR> and cap with LIMIT.",
    "INNER JOIN two tables on a foreign key — the canonical orders-per-customer pattern.",
    "LEFT JOIN + IS NULL on the right side — the canonical 'find the gap' pattern.",
  ],
  estimatedMinutes: 150,
  xpReward: 450,
  isMultiFile: false,
  meta: projectMeta({
    scenario:
      "Junior BI analyst at a 2026 D2C brand. Your inbox has 5 standing requests every Monday morning: a customer list, last-week's high-value orders, top spenders, an orders-with-customer-info report, and a 're-engage these dormant customers' list. You're going to write each one against the live `customers` + `orders` tables.",
    hiringRelevance2026:
      "Every analytics interview opens with these five patterns. They are the 'can you actually read SQL' filter — failing them ends the screen. Showing the 5 queries + their CSV outputs in a README is a clean, honest beginner portfolio.",
    readmeOutline: [
      "Overview — the BI inbox we're answering",
      "Schema (customers + orders) + how to load the fixtures",
      "Query 1: pick columns (no SELECT *)",
      "Query 2: WHERE with AND/OR/IS NULL",
      "Query 3: ORDER BY + LIMIT",
      "Query 4: INNER JOIN orders ↔ customers",
      "Query 5: LEFT JOIN — find customers with no orders",
      "Portfolio Hand-off (gist + screenshot)",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub gist or repo containing: (1) `schema.sql` to recreate the 2-table schema, (2) `seed.sql` with 8 customers + 12 orders, (3) `queries/01..05.sql` each with a one-line comment header explaining the BI question, (4) `expected/01..05.csv` of the verified answer rows so a reviewer can re-run and diff.",
    portfolioRelevance:
      "Beginner SQL portfolios fail when they're 'I did the SQLZoo lessons'. A re-runnable schema + 5 commented queries + verified CSV outputs is the smallest artifact that actually proves competence at this level.",
    repoUrl: "https://gist.github.com/<your-handle>/sql-beginner-five-queries",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "SELECT specific columns — never `SELECT *` in analytics",
      instructionMd:
        "From `customers (id, name, email, city, signup_date)`, write a query that returns `name, city` for every customer, in `id ASC` order. Why projection: `SELECT *` couples your query to schema churn (someone adds a `password_hash` column → your dashboard exports it). Naming columns is a contract with the next reader.",
      learningObjective:
        "Column projection is the first SQL hygiene habit. Name the columns you want — your future self reads the query and knows what's coming back.",
      requiredSkill: "SELECT <columns> FROM <table> ORDER BY <col>",
      starterCode: SRC(`-- queries/01_customer_directory.sql
-- BI question: give me a phonebook-style list of every customer (name + city).
SELECT
  -- TODO: pick the two columns the analyst asked for
  *
FROM customers
ORDER BY id ASC;`),
      validationType: "csv_set_equal",
      stepType: "code_sql",
      validation: validationConfig("csv_set_equal", "Result set equals the 8-row expected CSV (columns: name, city; ordered by id ASC).", {
        expectedCsv: "fixtures/expected_01_customer_directory.csv",
        columns: ["name", "city"],
      }),
      expectedOutputs: { rowCount: 8, columnCount: 2 },
      datasetRefs: ["fixtures/schema.sql", "fixtures/seed.sql", "fixtures/expected_01_customer_directory.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Replace the `*` with the two columns the analyst literally asked for — `name, city`.",
          "Order matters in a deterministic output. `ORDER BY id ASC` keeps the diff against `expected.csv` stable.",
          "`SELECT *` is fine in the psql REPL while exploring. It is NOT fine in a saved query that another human will read.",
          "If you're tempted to add `email`, ask: did the request mention email? If not, leave it off — projection is a contract.",
          "SELECT name, city FROM customers ORDER BY id ASC;",
        ],
        successFeedback:
          "Clean, explicit projection — exactly what shows up in production analytics code.",
        failureFeedback:
          "Most common slips here: leaving `SELECT *` (passes by accident only because we set-equal compare just the named columns) and forgetting ORDER BY (non-determinism = flaky CI).",
        portfolioRelevance:
          "Demonstrating column-explicit SELECT in your portfolio's very first query signals 'this person has read real code', not 'this person finished a tutorial'.",
        finalExplanation:
          "The two habits to internalise on day one: name your columns; order your results. Everything else (joins, aggregation, windowing) is layered on top of these.",
        misconceptionToWatchFor:
          "Believing `SELECT *` is faster. It isn't — the database still reads the row; you're just shipping more bytes back to the client and tying your query to schema drift.",
      }),
    },
    {
      stepNumber: 2,
      title: "WHERE with AND, OR, IS NULL — and the parenthesis trap",
      instructionMd:
        "Two queries, one file. (A) From `customers`, return everyone who is in `'Brooklyn'` OR `'Queens'` AND signed up on or after `'2026-01-01'`. (B) Same predicate again, but with the correct parenthesisation that matches the BI request: customers from (Brooklyn or Queens) who also signed up in 2026 or later. The first query (without parens) returns the wrong rows because `AND` binds tighter than `OR` — fix it.",
      learningObjective:
        "Operator precedence is the #1 silent-bug source in WHERE clauses. Always parenthesise mixed AND/OR.",
      requiredSkill: "WHERE + AND/OR + parentheses + IS NULL discipline",
      starterCode: SRC(`-- queries/02_filtered_customer_list.sql
-- BI question (literal): \"give me customers from Brooklyn or Queens who also signed up in 2026 or later\".

-- Version A: WRONG (AND binds tighter than OR)
SELECT name, city, signup_date
FROM customers
WHERE city = 'Brooklyn' OR city = 'Queens' AND signup_date >= '2026-01-01';

-- Version B: CORRECT — parenthesise the OR group.
-- TODO: write Version B below.
`),
      validationType: "csv_set_equal",
      stepType: "code_sql",
      validation: validationConfig("csv_set_equal", "Version B result set equals the 3-row expected CSV: only Brooklyn-or-Queens customers whose signup_date is on/after 2026-01-01.", {
        expectedCsv: "fixtures/expected_02_filtered.csv",
        columns: ["name", "city", "signup_date"],
        validateQuery: "B",
      }),
      expectedOutputs: { rowCountB: 3, rowCountA: 5 },
      datasetRefs: ["fixtures/seed.sql", "fixtures/expected_02_filtered.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "`AND` binds tighter than `OR`. So `A OR B AND C` is read as `A OR (B AND C)`.",
          "Read the BI request out loud. Where do the implicit parentheses go? Put them in the SQL.",
          "When a row count surprises you, the first suspicion in a mixed AND/OR clause is missing parens.",
          "`IS NULL` (not `= NULL`) — NULL is not equal to anything in SQL, not even itself.",
          "WHERE (city = 'Brooklyn' OR city = 'Queens') AND signup_date >= '2026-01-01'",
        ],
        successFeedback:
          "Operator precedence captured correctly — that's the #1 silent SQL bug eliminated for life.",
        failureFeedback:
          "Most common slips: trusting `OR`/`AND` to bind the way English does (they don't), and using `= NULL` instead of `IS NULL`.",
        portfolioRelevance:
          "A README note pointing out the wrong-vs-right version + showing both row counts is portfolio-grade discipline: it proves you understand the bug class, not just the fix.",
        finalExplanation:
          "The grown-up rule: any time you mix AND and OR in a WHERE clause, parenthesise the OR groups. Reviewers will thank you and bugs won't bite.",
        misconceptionToWatchFor:
          "Believing `WHERE foo = NULL` filters NULLs out. It doesn't — it returns no rows at all because `NULL = NULL` is unknown, not true.",
      }),
    },
    {
      stepNumber: 3,
      title: "ORDER BY + LIMIT — the 'top N' pattern",
      instructionMd:
        "From `orders (id, customer_id, total_cents, ordered_at, status)`, return the top 5 orders by `total_cents` (desc), tie-broken by `ordered_at` (asc) to keep results deterministic across runs. Columns: `id, total_cents, ordered_at`. Ignore cancelled orders (`status = 'cancelled'`).",
      learningObjective:
        "A top-N query without a deterministic tiebreak is a flaky query. ORDER BY <metric> DESC, <tiebreak> ASC LIMIT N.",
      requiredSkill: "ORDER BY multiple keys + LIMIT + WHERE filter chain",
      starterCode: SRC(`-- queries/03_top_orders.sql
-- BI question: top 5 non-cancelled orders by total, ordered largest first.
-- Tiebreak: earlier ordered_at wins (deterministic).

SELECT
  -- TODO: id, total_cents, ordered_at
  *
FROM orders
WHERE -- TODO: exclude cancelled
ORDER BY -- TODO: total_cents DESC, ordered_at ASC
LIMIT 5;`),
      validationType: "csv_set_equal",
      stepType: "code_sql",
      validation: validationConfig("csv_set_equal", "Result set equals the 5-row expected CSV in the exact order: total_cents DESC then ordered_at ASC; cancelled orders excluded.", {
        expectedCsv: "fixtures/expected_03_top_orders.csv",
        columns: ["id", "total_cents", "ordered_at"],
        orderSensitive: true,
      }),
      expectedOutputs: { rowCount: 5, orderSensitive: true },
      datasetRefs: ["fixtures/seed.sql", "fixtures/expected_03_top_orders.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Multi-key ORDER BY: `ORDER BY a DESC, b ASC` — sorts by `a` descending, then by `b` ascending within ties.",
          "Always tiebreak. Without it, your top-N flickers on every re-run because the DB is free to pick any equal row.",
          "Filter THEN sort. Cancelled orders shouldn't be in the candidate pool, so WHERE before ORDER BY.",
          "`LIMIT 5` is the cap. Most engines also accept `FETCH FIRST 5 ROWS ONLY` — same thing in SQL standard form.",
          "ORDER BY total_cents DESC, ordered_at ASC",
        ],
        successFeedback:
          "Deterministic top-N — reviewers can re-run and get the same answer every time. That's a reliable analytics artifact.",
        failureFeedback:
          "Most common slips: forgetting to exclude cancelled (rows wrongly include them); single-key ORDER BY (flaky tiebreak).",
        portfolioRelevance:
          "Show the same query in your README with + without the tiebreaker, and explain why one is reproducible and the other isn't. That's senior-junior discipline.",
        finalExplanation:
          "Top-N is the most-requested query in BI. Make it deterministic by default and you'll never debug a 'why did this row vanish?' ticket.",
        misconceptionToWatchFor:
          "Believing `LIMIT 5` alone is reproducible. It isn't — without a tiebreak, equal rows can swap positions between runs.",
      }),
    },
    {
      stepNumber: 4,
      title: "INNER JOIN — orders ↔ customers on the foreign key",
      instructionMd:
        "For every non-cancelled order, return: `order_id (alias of orders.id), customer_name, total_cents, ordered_at`. Join `orders` to `customers` on `orders.customer_id = customers.id`. Order by `ordered_at ASC`. INNER JOIN, not LEFT — we want orders that DO have a matching customer (the canonical case).",
      learningObjective:
        "INNER JOIN keeps only rows present on BOTH sides of the ON clause. It's the right default whenever you're enriching a fact table (orders) with its dimension (customers).",
      requiredSkill: "INNER JOIN + aliasing + column qualification (`orders.id` vs `customers.id`)",
      starterCode: SRC(`-- queries/04_orders_with_customer.sql
-- BI question: order log enriched with the customer name, oldest first.

SELECT
  o.id          AS order_id,
  c.name        AS customer_name,
  o.total_cents,
  o.ordered_at
FROM orders o
-- TODO: JOIN customers c ON ...
WHERE o.status <> 'cancelled'
ORDER BY o.ordered_at ASC;`),
      validationType: "csv_set_equal",
      stepType: "code_sql",
      validation: validationConfig("csv_set_equal", "Result set equals the expected CSV: every non-cancelled order with its joined customer name; ordered by ordered_at ASC.", {
        expectedCsv: "fixtures/expected_04_orders_with_customer.csv",
        columns: ["order_id", "customer_name", "total_cents", "ordered_at"],
        orderSensitive: true,
      }),
      expectedOutputs: { rowCount: 10, hasCustomerName: true },
      datasetRefs: ["fixtures/seed.sql", "fixtures/expected_04_orders_with_customer.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "INNER JOIN syntax: `FROM orders o INNER JOIN customers c ON o.customer_id = c.id`.",
          "Alias your tables (`o`, `c`) — saves typing and lets you qualify ambiguous columns like `id`.",
          "When both tables have an `id` column, ALWAYS qualify (`o.id` vs `c.id`). Otherwise the engine complains 'ambiguous column'.",
          "`INNER JOIN` and `JOIN` mean the same thing in SQL. Write `INNER JOIN` for clarity when next to a LEFT/RIGHT JOIN in the same file.",
          "INNER JOIN customers c ON o.customer_id = c.id",
        ],
        successFeedback:
          "Canonical orders+customers join. This pattern is 60% of all BI SQL you'll ever write.",
        failureFeedback:
          "Most common slips: forgetting to qualify `id` (ambiguous-column error); writing `ON o.id = c.id` (joining on the wrong key — orders.id is NOT the customer FK).",
        portfolioRelevance:
          "A clean join with aliased tables and qualified columns is what reviewers screen for. Show this query and explain WHY you chose INNER JOIN (you only want orders with a matching customer).",
        finalExplanation:
          "INNER JOIN = 'rows that exist on both sides'. Pick it whenever the absence of a match means the row is garbage data, not a legitimate report row.",
        misconceptionToWatchFor:
          "Treating JOIN as a Cartesian product followed by a filter. Mentally it's that, but the optimiser is smarter — and you should be too: write the ON clause correctly and let the engine plan it.",
      }),
    },
    {
      stepNumber: 5,
      title: "LEFT JOIN + IS NULL — find the gap (dormant customers)",
      instructionMd:
        "BI question: which customers have NEVER placed a non-cancelled order? LEFT JOIN `customers` → `orders` (filtering orders to non-cancelled before/in the ON clause), then keep only rows where `orders.id IS NULL`. Return `name, email, city` ordered by `id ASC`. This is the canonical 'who's in A but not in B?' pattern.",
      learningObjective:
        "LEFT JOIN + `WHERE right.key IS NULL` is the most-used 'find the gap' pattern in BI. Every analyst writes it weekly.",
      requiredSkill: "LEFT JOIN + filter-in-ON vs filter-in-WHERE + IS NULL semantics",
      starterCode: SRC(`-- queries/05_dormant_customers.sql
-- BI question: customers who've never placed a non-cancelled order.
-- (We want the LEFT-JOIN+IS-NULL idiom, not NOT IN / NOT EXISTS — for learning.)

SELECT
  c.name, c.email, c.city
FROM customers c
LEFT JOIN orders o
  ON o.customer_id = c.id
 AND o.status <> 'cancelled'     -- IMPORTANT: filter goes in ON, not WHERE.
WHERE -- TODO: o.id IS NULL  (the 'gap' filter)
ORDER BY c.id ASC;`),
      validationType: "csv_set_equal",
      stepType: "code_sql",
      validation: validationConfig("csv_set_equal", "Result set equals the 3-row expected CSV: customers with zero non-cancelled orders, ordered by id ASC.", {
        expectedCsv: "fixtures/expected_05_dormant.csv",
        columns: ["name", "email", "city"],
        orderSensitive: true,
      }),
      expectedOutputs: { rowCount: 3, gapPatternUsed: true },
      datasetRefs: ["fixtures/seed.sql", "fixtures/expected_05_dormant.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "`LEFT JOIN` keeps every row from the left side. Non-matches on the right get NULL columns.",
          "Filter that should *eliminate matches* (like `status <> 'cancelled'`) goes in the ON clause, NOT WHERE — otherwise you turn the LEFT JOIN into an INNER JOIN by accident.",
          "The gap filter `WHERE o.id IS NULL` keeps only customers who matched no order — exactly the dormant set.",
          "If you accidentally write `WHERE o.status <> 'cancelled'`, every customer with no orders disappears (NULL <> 'cancelled' is unknown, not true). That's the classic LEFT-JOIN footgun.",
          "WHERE o.id IS NULL",
        ],
        successFeedback:
          "LEFT JOIN + IS NULL — the 'gap finder' idiom. You'll reach for this every week on the job.",
        failureFeedback:
          "Most common slips: putting the status filter in WHERE (silently downgrades LEFT JOIN to INNER, gap-finder breaks); using `= NULL` instead of `IS NULL`.",
        portfolioRelevance:
          "Showing both LEFT-JOIN+IS-NULL and `NOT EXISTS` in your README, explaining when each is more readable, is senior-beginner territory.",
        finalExplanation:
          "When the question is 'who's missing from B?', reach for LEFT JOIN + IS NULL. It's readable, it's reproducible, and every BI tool's SQL editor handles it.",
        misconceptionToWatchFor:
          "Believing all filters belong in WHERE. They don't — filters on the right-hand side of a LEFT JOIN belong in the ON clause, or the join semantics change silently.",
      }),
    },
  ],
};
