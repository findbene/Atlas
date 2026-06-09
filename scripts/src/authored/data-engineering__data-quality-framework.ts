/**
 * Phase 11 batch-3 / data-engineering (skeleton rebuild).
 * Candidate b2031ce8-139a-4f44-9678-708192031425 — Data Quality Framework with
 * Great Expectations + dbt tests + freshness SLAs + alerting.
 *
 * Legacy: `data-quality-framework` (1-step skeleton, score 45.9). Full rebuild.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const dataEngineeringDataQualityFramework: AuthoredProject = {
  slug: "data-engineering-data-quality-framework",
  candidateId: "b2031ce8-139a-4f44-9678-708192031425",
  title: "Data Quality Framework — Great Expectations + dbt Tests + Freshness SLAs + Alerting",
  shortDescription:
    "Build a production DQ framework that combines Great Expectations (statistical/distribution checks) + dbt tests (relational invariants) + freshness SLAs (recency tracking) + alerts that page on critical-table failures only, not noisy nice-to-haves.",
  fullDescription:
    "DQ is the difference between a warehouse and a swamp. You'll layer two tools: dbt tests for relational invariants (uniqueness, FK, accepted_values), Great Expectations for statistical checks (distributions, anomalies), wire freshness SLAs that catch silent pipeline halts, and route alerts by severity so on-call stays sane. Each step is measurable and reproducible against fixture data.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "dbt", "postgres", "airflow", "great-expectations", "snowflake"],
  tags: ["data-quality", "dbt", "great-expectations", "freshness", "alerting", "sla", "monitoring"],
  learningObjectives: [
    "Write dbt tests for the four relational invariants (unique, not_null, FK, accepted_values).",
    "Build Great Expectations suites for statistical checks (distribution, anomaly, completeness).",
    "Define freshness SLAs via dbt source freshness + alert on warn/error thresholds.",
    "Route alerts by severity — page on critical, Slack on warn, ignore for advisory.",
    "Build a DQ summary view that aggregates pass/fail per critical table per day.",
  ],
  estimatedMinutes: 230,
  xpReward: 740,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "DE lead at a 150-person marketplace whose stakeholders no longer trust the CFO dashboards because of recurring NULL totals + stale-by-2-days alerts. You're standing up a DQ framework that catches issues BEFORE dashboards lie + only pages on real problems.",
    hiringRelevance2026:
      "DQ frameworks (not just 'we use dbt tests') are the 2026 mid/senior DE differentiator. Layered + severity-routed + measured = the signal.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (dbt / GE / freshness / alert router)",
      "Step 1 dbt tests", "Step 2 GE statistical suite", "Step 3 freshness SLAs",
      "Step 4 severity-routed alerts", "Step 5 DQ summary view", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with the dbt project (tests + freshness), GE suites + checkpoints, an alert router (Slack/PagerDuty), the DQ summary view + a Streamlit/Grafana dashboard, and a docker-compose for local Postgres + dbt + GE so reviewers run the full stack.",
    portfolioRelevance:
      "A DQ repo with severity routing + dashboard is rare. Most repos either skip DQ or have a thousand alerts no one reads.",
    repoUrl: "https://github.com/<your-handle>/dq-framework",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "dbt tests for relational invariants",
      instructionMd:
        "On the `mart_orders` model add four tests in `schema.yml`: `unique` on `order_id`; `not_null` on `order_id` + `user_id`; `relationships` from `user_id` to `mart_users.user_id`; `accepted_values` on `status` ∈ {`pending`, `paid`, `cancelled`}. Validator runs `dbt test --select mart_orders` against (a) a clean fixture → 4 pass; (b) a fixture with 5 duplicate `order_id`s + 1 invalid status → 2 tests fail with the right counts.",
      learningObjective: "Four canonical dbt tests cover ~70% of real-world relational failures.",
      requiredSkill: "dbt schema.yml tests + relationships + accepted_values + interpreting failure output",
      starterCode: SRC(`# models/marts/schema.yml
version: 2
models:
  - name: mart_orders
    description: "Curated order facts; one row per order."
    columns:
      - name: order_id
        tests:
          - unique
          - not_null
      - name: user_id
        tests:
          - not_null
          - relationships:
              to: ref('mart_users')
              field: user_id
      - name: status
        tests:
          - accepted_values:
              values: ['pending', 'paid', 'cancelled']
      # TODO: add timestamp not_null + range check via dbt_utils.expression_is_true if relevant.
`),
      validationType: "json_equal",
      stepType: "multi_file",
      validation: validationConfig("json_equal", "Clean fixture: 4/4 pass. Fixture with 5 duplicate order_ids + 1 invalid status: unique fails (5 dupes), accepted_values fails (1 invalid), not_null + relationships pass.", {
        expected: { cleanPass: 4, cleanFail: 0, dirtyPass: 2, dirtyFail: 2, duplicateCount: 5, invalidStatusCount: 1 },
      }),
      expectedOutputs: { cleanPass: 4, dirtyPass: 2, dirtyFail: 2 },
      datasetRefs: ["fixtures/dbt_test_cases.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Tests at the model layer are documentation + enforcement at once. README copies write themselves.",
          "`relationships` is the cheap FK check — way faster than running a full LEFT JOIN at query time.",
          "`accepted_values` over a small enum is more readable than a CHECK constraint AND survives schema migrations.",
          "`severity: warn` on advisory checks; default `error` blocks dbt build.",
          "tests: - unique - not_null - relationships: {to: ref('mart_users'), field: user_id}",
        ],
        successFeedback: "Relational invariants are now enforced by dbt. Schema.yml is your contract.",
        failureFeedback: "Common slips: relationships without `to:` (silently doesn't run); accepted_values misspelled (still loads, silent miss); test severity 'warn' on critical checks (build passes; data is broken).",
        portfolioRelevance: "Showing 4-test coverage with deliberate severity routing is a senior-DE pattern.",
        finalExplanation: "Relational tests catch most real issues. The other 30% needs statistical checks (next step).",
        misconceptionToWatchFor: "Testing every column. Coverage > 100% is noise — test the invariants downstream depends on.",
      }),
    },
    {
      stepNumber: 2,
      title: "Great Expectations statistical suite",
      instructionMd:
        "Create a GE suite `orders_distribution` with: `expect_column_values_to_not_be_null('amount')`, `expect_column_value_lengths_to_be_between('order_id', 8, 64)`, `expect_column_mean_to_be_between('amount', 10, 500)`, `expect_column_values_to_match_regex('email', r'@')`, `expect_column_proportion_of_unique_values_to_be_between('user_id', 0.3, 1.0)`. Validator runs the suite against a 10k-row fixture and asserts 5/5 pass; then runs against a corrupted fixture (mean drops to 3.2) and asserts the mean-range expectation fails with the actual value reported.",
      learningObjective: "Statistical/distribution checks catch the regressions that pass relational tests.",
      requiredSkill: "Great Expectations 0.18+ suite + per-expectation semantics + result interpretation",
      starterCode: SRC(`# ge_setup.py
import great_expectations as gx

context = gx.get_context()  # uses ./gx by convention

datasource = context.sources.add_postgres('warehouse_db', connection_string='postgresql://...')
asset = datasource.add_table_asset(name='orders', table_name='mart_orders')

suite = context.add_or_update_expectation_suite('orders_distribution')

batch_request = asset.build_batch_request()
validator = context.get_validator(batch_request=batch_request, expectation_suite_name='orders_distribution')

validator.expect_column_values_to_not_be_null('amount')
validator.expect_column_value_lengths_to_be_between('order_id', min_value=8, max_value=64)
validator.expect_column_mean_to_be_between('amount', min_value=10, max_value=500)
validator.expect_column_values_to_match_regex('email', regex=r'@')
# TODO: validator.expect_column_proportion_of_unique_values_to_be_between('user_id', min_value=0.3, max_value=1.0)
validator.save_expectation_suite(discard_failed_expectations=False)

result = validator.validate()
print({'success': result.success, 'evaluated': len(result.results)})
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Run the GE suite against the clean 10k-row fixture and confirm 5/5 expectations pass. Then run against the corrupted fixture (mean amount ≈ 3.2, below the 10–500 floor) and confirm the mean-range expectation fails with the observed mean value reported in the GE result.",
      }),
      expectedOutputs: { cleanPass: 5, dirtyFail: 1, observedMean: 3.2 },
      datasetRefs: ["fixtures/ge_orders_clean.json", "fixtures/ge_orders_corrupted.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Distribution checks (mean/stddev range) catch the silent regressions relational tests miss.",
          "Regex on email is a cheap completeness check — way cheaper than full email validation.",
          "`expect_column_proportion_of_unique_values_to_be_between` catches when a join goes 1:N silently.",
          "Save suites to git — they're code, not config. Review them in PRs.",
          "validator.expect_column_proportion_of_unique_values_to_be_between('user_id', min_value=0.3, max_value=1.0)",
        ],
        successFeedback: "Statistical drift now triggers alerts. Mean amount of $3 isn't 'just data' — it's a regression.",
        failureFeedback: "Common slips: only relational tests (drift goes undetected); per-batch checks on streaming data (high false-positive); not versioning suites (drift in the tests themselves).",
        portfolioRelevance: "GE + dbt-test layering is the 2026 DQ best practice. Show both, not just one.",
        finalExplanation: "Statistical checks complement relational ones. Real drift hides in distributions, not foreign keys.",
        misconceptionToWatchFor: "Treating GE as a replacement for dbt tests. They're complementary — different failure modes.",
      }),
    },
    {
      stepNumber: 3,
      title: "Source freshness SLAs",
      instructionMd:
        "In `sources.yml`, declare freshness on `raw.events`: `warn_after: {count: 6, period: hour}`, `error_after: {count: 12, period: hour}`, `loaded_at_field: ingested_at`. Validator runs `dbt source freshness` against (a) data loaded 4h ago → all green; (b) data loaded 8h ago → warn; (c) data loaded 14h ago → error with the actual lag reported.",
      learningObjective: "Freshness SLAs catch silent pipeline halts — the failure mode dbt tests can't see.",
      requiredSkill: "dbt source freshness + warn_after/error_after thresholds + loaded_at_field",
      starterCode: SRC(`# models/sources.yml
version: 2
sources:
  - name: raw
    schema: raw
    tables:
      - name: events
        loaded_at_field: ingested_at
        freshness:
          warn_after:  {count: 6,  period: hour}
          # TODO: error_after: {count: 12, period: hour}
        description: "Events ingested daily; warn at 6h lag, error at 12h."

# Run:
# $ dbt source freshness --select source:raw.events
# Output includes 'pass | warn | error' + the actual lag.
`),
      validationType: "json_equal",
      stepType: "multi_file",
      validation: validationConfig("json_equal", "3 fixture scenarios: 4h lag → pass; 8h lag → warn; 14h lag → error with lag reported.", {
        expected: { case4hStatus: "pass", case8hStatus: "warn", case14hStatus: "error", case14hLagHours: 14 },
      }),
      expectedOutputs: { pass: "4h", warn: "8h", error: "14h" },
      datasetRefs: ["fixtures/freshness_scenarios.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "warn_after < error_after — give the team time to fix before paging.",
          "loaded_at_field must be a timestamp column that updates on each load (not created_at).",
          "Run `dbt source freshness` separately from `dbt build` — different cadence (hourly vs daily).",
          "Surface freshness state to the DQ dashboard alongside test results.",
          "error_after: {count: 12, period: hour}",
        ],
        successFeedback: "Stale data now triggers proactive alerts. Silent pipeline halts become loud.",
        failureFeedback: "Common slips: error threshold too aggressive (alert fatigue); no warn (only paged); checking only at build time (stale found 24h after the fact).",
        portfolioRelevance: "Source freshness is the cheapest DQ win. Set it on every critical source.",
        finalExplanation: "Freshness is data quality at the time axis. dbt tests catch what's wrong; freshness catches what's missing.",
        misconceptionToWatchFor: "Using created_at instead of loaded_at. created_at = source clock; loaded_at = pipeline clock.",
      }),
    },
    {
      stepNumber: 4,
      title: "Severity-routed alerts — page critical, Slack warn, ignore advisory",
      instructionMd:
        "Implement `route_alerts(failures)` that classifies each failure by `severity` (critical / warn / advisory) and sends accordingly: critical → PagerDuty incident, warn → Slack channel, advisory → log only. Validator passes a mix of 1 critical + 3 warns + 2 advisories and asserts: 1 PagerDuty call, 3 Slack messages, 0 advisory escalations, log contains all 6 failures.",
      learningObjective: "Severity routing is what makes DQ alerts sustainable — without it, alert fatigue kills the framework.",
      requiredSkill: "Alert routing + severity classification + idempotent incident creation",
      starterCode: SRC(`# alerts.py
import requests, logging
from dataclasses import dataclass

@dataclass
class DqFailure:
    test_name: str
    severity: str       # 'critical' | 'warn' | 'advisory'
    table: str
    details: str

def page(failure: DqFailure, pagerduty_url: str) -> None:
    requests.post(pagerduty_url, json={
        'routing_key': 'xxx',
        'event_action': 'trigger',
        'dedup_key': f"dq-{failure.table}-{failure.test_name}",
        'payload': {'summary': f"DQ critical: {failure.test_name} on {failure.table}", 'severity': 'critical', 'source': 'dq-framework'},
    }, timeout=10)

def slack(failure: DqFailure, slack_url: str) -> None:
    requests.post(slack_url, json={'text': f":warning: DQ warn: {failure.test_name} on {failure.table}\\n{failure.details}"}, timeout=10)

def route_alerts(failures: list[DqFailure], pagerduty_url: str, slack_url: str) -> dict[str, int]:
    counts = {'critical': 0, 'warn': 0, 'advisory': 0}
    for f in failures:
        logging.warning(f"dq-failure: {f.severity} {f.table}.{f.test_name} {f.details}")
        # TODO: dispatch on f.severity: critical -> page, warn -> slack, advisory -> log only.
        counts[f.severity] += 1
    return counts
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Mix of 1 critical + 3 warns + 2 advisories: routing produces 1 PagerDuty + 3 Slack + 0 advisory escalations; all 6 entries in logs.", {
        expected: { pagerCount: 1, slackCount: 3, advisoryCount: 2, logCount: 6 },
      }),
      expectedOutputs: { paged: 1, slacked: 3, advisory: 2 },
      datasetRefs: ["fixtures/alert_cases.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "dedup_key on PagerDuty prevents alert storms during a multi-test failure.",
          "Slack messages should link back to the DQ dashboard — context matters.",
          "Advisory = log only by design; promote to warn if it ever becomes actionable.",
          "Tag the team owner in Slack; route critical to the on-call rotation, not a channel.",
          "if f.severity == 'critical': page(f, pagerduty_url)\\nelif f.severity == 'warn': slack(f, slack_url)",
        ],
        successFeedback: "Alerts are now routed by signal-vs-noise. On-call only sees what matters.",
        failureFeedback: "Common slips: page-everything (on-call burnout in 2 weeks); no dedup (alert storms); ignore advisory forever (silent metric drift).",
        portfolioRelevance: "Severity routing is the difference between a DQ framework and a DQ alert flood. Show the routing table.",
        finalExplanation: "DQ alerts are a contract with on-call. Honor it by routing intentionally.",
        misconceptionToWatchFor: "Treating every failed test as critical. Most tests catch advisory issues; reserve paging for downstream-breaking ones.",
      }),
    },
    {
      stepNumber: 5,
      title: "DQ summary view + dashboard",
      instructionMd:
        "Build a daily `dq_summary` model: aggregate `dbt test` + GE results from the run-result store (a `dq_results` table) into `(table_name, total_tests, passed, failed, severity_critical_failed, dq_score = passed/total)`. Validator runs against a fixture with 3 tables (marts_orders 10/10/0, mart_users 8/7/1, dim_dates 4/4/0) and asserts: dq_score for marts_orders = 1.0, mart_users = 0.875, dim_dates = 1.0; severity_critical_failed for mart_users = 1.",
      learningObjective: "A summary view is what stakeholders look at — the alert log is what on-call looks at.",
      requiredSkill: "Aggregation modeling + dq_score derivation + severity rollup",
      starterCode: SRC(`-- models/dq/dq_summary.sql
{{ config(materialized='view') }}
WITH per_table AS (
    SELECT
        table_name,
        run_date,
        COUNT(*)                                    AS total_tests,
        SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) AS passed,
        SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) AS failed,
        -- TODO: SUM(CASE WHEN status = 'fail' AND severity = 'critical' THEN 1 ELSE 0 END) AS severity_critical_failed,
        0 AS severity_critical_failed
    FROM {{ ref('dq_results') }}
    WHERE run_date = CURRENT_DATE
    GROUP BY 1, 2
)
SELECT
    table_name,
    run_date,
    total_tests,
    passed,
    failed,
    severity_critical_failed,
    ROUND(passed::numeric / NULLIF(total_tests, 0), 3) AS dq_score
FROM per_table
ORDER BY dq_score ASC, severity_critical_failed DESC;
`),
      validationType: "sql_resultset",
      stepType: "code_sql",
      validation: validationConfig("sql_resultset", "Fixture 3 tables: dq_score = 1.0 / 0.875 / 1.0; mart_users severity_critical_failed = 1; ordering puts mart_users first.", {
        expected: { martsOrdersScore: 1.0, martUsersScore: 0.875, dimDatesScore: 1.0, criticalFailedCount: 1, firstRow: "mart_users" },
      }),
      expectedOutputs: { marts_orders: 1.0, mart_users: 0.875, dim_dates: 1.0 },
      datasetRefs: ["fixtures/dq_results.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "dq_score = passed / total is the simplest sustainable summary metric.",
          "Order by dq_score ASC + severity_critical DESC so the worst-first is the default view.",
          "Refresh the view post-run (Airflow task) so stakeholders always see today's state.",
          "Pin the view to a single dashboard (Grafana, Metabase, Streamlit) — single source of truth.",
          "SUM(CASE WHEN status = 'fail' AND severity = 'critical' THEN 1 ELSE 0 END) AS severity_critical_failed",
        ],
        successFeedback: "Stakeholders now have a single trustworthy DQ view. On-call has the alert log. Two audiences, two views.",
        failureFeedback: "Common slips: showing every check (overwhelming); only failures (no 'good day' signal); no severity rollup (one critical lost in 100 advisories).",
        portfolioRelevance: "A DQ dashboard with both score + critical breakouts is rare. Show it.",
        finalExplanation: "DQ frameworks live or die on stakeholder visibility. If no one looks at the dashboard, it doesn't exist.",
        misconceptionToWatchFor: "Building a separate DQ data store. Use the warehouse — single source of truth.",
      }),
    },
  ],
};
