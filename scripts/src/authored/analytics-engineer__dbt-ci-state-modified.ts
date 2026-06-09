/**
 * Phase 7 — Wave 1c / analytics-engineer (intermediate).
 * Candidate d1f6eeff-77d0-4cfe-a557-b41b02e268ba — dbt CI with state:modified.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const analyticsEngineerDbtCiStateModified: AuthoredProject = {
  slug: "analytics-engineer-dbt-ci-state-modified",
  candidateId: "d1f6eeff-77d0-4cfe-a557-b41b02e268ba",
  title: "dbt CI with state:modified+ Slim Builds on GitHub Actions",
  shortDescription:
    "Build a GitHub Actions workflow for a dbt project on Snowflake that uses state:modified+ to build only changed models + their downstream dependencies. Defer to prod's manifest, run tests, and post a model-diff comment on the PR.",
  fullDescription:
    "Full `dbt build` on a large project takes 45+ minutes — unsustainable for PR feedback loops. The 2026 best practice is `--select state:modified+ --defer --state path/to/prod_manifest` so CI only builds what changed. You'll wire this on GitHub Actions with the right artifact handling (download prod manifest, upload PR manifest), Snowflake-keyed CI schemas (per-PR isolation), dbt tests on changed models, and a sticky PR comment that lists the model graph diff.",
  language: "sql",
  difficulty: "intermediate",
  techStack: ["dbt", "github-actions", "Snowflake", "SQL"],
  tags: ["dbt", "github-actions", "ci", "state-modified", "snowflake", "analytics-engineering"],
  learningObjectives: [
    "Configure dbt profiles.yml for CI with per-PR Snowflake schema isolation.",
    "Use state:modified+ to build only changed models + downstream deps.",
    "Defer to prod's manifest so upstream refs resolve without rebuilding.",
    "Run dbt test on the slim selection.",
    "Post a model-diff PR comment showing the affected DAG.",
  ],
  estimatedMinutes: 150,
  xpReward: 500,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Analytics team's `dbt build` PR check now runs 47min and costs ~$8/run in Snowflake credits. Need to shrink to <5min + <$1/run without losing test coverage on changed models.",
    hiringRelevance2026:
      "Slim CI with state:modified+ + defer is the canonical 2026 analytics-engineer CI pattern. Every JD says 'dbt CI/CD' — this is the production-grade implementation.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (GH Actions → dbt → Snowflake)",
      "Step 1 profiles.yml with PR schema", "Step 2 download prod manifest",
      "Step 3 state:modified+ build", "Step 4 dbt test on slim selection",
      "Step 5 PR comment with model diff", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with .github/workflows/dbt_ci.yml, profiles/ci/profiles.yml, a small dbt project demonstrating state-aware slim build, and screenshots of before/after CI runtime + cost.",
    portfolioRelevance:
      "Slim CI is the AE engineering skill that translates directly to time + cost savings. Recruiters know this is exactly what senior AE roles need.",
    repoUrl: "https://github.com/<your-handle>/dbt-ci-state-modified",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "profiles.yml — per-PR Snowflake schema",
      instructionMd:
        "Author `profiles/ci/profiles.yml` that uses `schema: \"PR_{{ env_var('GITHUB_PR_NUMBER') }}\"` so each PR builds into its own schema. Auth via Snowflake key-pair (private key in GH secret). Atlas checks that the required evidence markers are present in your submission — not that the program otherwise runs correctly, and not your authorship or competence.",
      learningObjective: "Isolate per-PR builds into distinct Snowflake schemas using env var interpolation.",
      requiredSkill: "dbt profiles.yml + env_var Jinja + Snowflake key-pair auth",
      starterCode: SRC(`# profiles/ci/profiles.yml
my_project:
  target: ci
  outputs:
    ci:
      type: snowflake
      account: "{{ env_var('SNOWFLAKE_ACCOUNT') }}"
      user: "{{ env_var('SNOWFLAKE_USER') }}"
      private_key_path: /home/runner/sf_key.pem
      role: TRANSFORMER_CI
      database: ANALYTICS_CI
      warehouse: COMPUTE_WH_XS
      schema: "PR_{{ env_var('GITHUB_PR_NUMBER') }}"
      threads: 4
# TODO: confirm the schema template includes PR number so concurrent PRs don't collide.
`),
      validationType: "contains",
      stepType: "writeup",
      validation: validationConfig("contains", "Atlas checks that the required evidence markers are present in your submission — not that the program otherwise runs correctly, and not your authorship or competence.", {
        needles: [
          "PR_{{ env_var('GITHUB_PR_NUMBER') }}",
          "private_key_path",
        ],
      }),
      expectedOutputs: { schemaIsolated: true, authPath: "private_key_path" },
      datasetRefs: ["fixtures/profiles_yml_expected.yml"],
      pedagogy: pedagogyConfig({
        hints: [
          "Snowflake key-pair auth is the recommended 2026 default for CI — no password rotation pain.",
          "Per-PR schema lets two PRs run in parallel without overwriting each other's models.",
          "Set GITHUB_PR_NUMBER from the workflow: `env: { GITHUB_PR_NUMBER: $\\{{ github.event.pull_request.number }} }`.",
          "Add a cleanup step on PR-close that DROP SCHEMA IF EXISTS PR_<num> CASCADE.",
          "(see reference above)",
        ],
        successFeedback: "Per-PR isolation: 5 concurrent PRs = 5 schemas, no clobbering.",
        failureFeedback: "Common slips: hardcoded schema (PR2 overwrites PR1); used password auth (rotation breaks CI silently).",
        portfolioRelevance: "Per-PR schema isolation is a senior-AE pattern. Most candidates use shared dev schemas and pretend it's fine.",
        finalExplanation: "Isolation by schema is the cheapest way to get true PR isolation in Snowflake without spinning up separate databases.",
        misconceptionToWatchFor: "Reusing the dev schema in CI. Concurrent PRs collide; tests fail intermittently.",
      }),
    },
    {
      stepNumber: 2,
      title: "Download prod manifest from S3",
      instructionMd:
        "GH Actions step: download `manifest.json` from `s3://dbt-artifacts/prod/manifest.json` (uploaded by the production dbt run) into `./prod_state/`. Atlas checks that the required evidence markers are present in your submission — not that the program otherwise runs correctly, and not your authorship or competence.",
      learningObjective: "Wire artifact pickup from S3 with OIDC auth (no long-lived AWS keys in CI).",
      requiredSkill: "GH Actions OIDC + aws-actions/configure-aws-credentials + dbt state artifact",
      starterCode: SRC(`# .github/workflows/dbt_ci.yml (snippet)
permissions:
  id-token: write
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/dbt-ci-readonly
          aws-region: us-east-1
      - name: Download prod manifest
        run: |
          mkdir -p prod_state
          aws s3 cp s3://dbt-artifacts/prod/manifest.json prod_state/manifest.json
      # TODO: confirm prod_state/manifest.json exists and is valid JSON before next step.
`),
      validationType: "contains",
      stepType: "writeup",
      validation: validationConfig("contains", "Atlas checks that the required evidence markers are present in your submission — not that the program otherwise runs correctly, and not your authorship or competence.", {
        needles: [
          "aws-actions/configure-aws-credentials",
          "prod_state/manifest.json",
        ],
      }),
      expectedOutputs: { ociConfigured: true, manifestPath: "prod_state/manifest.json" },
      datasetRefs: ["fixtures/workflow_yml_expected.yml"],
      pedagogy: pedagogyConfig({
        hints: [
          "OIDC federation = GH Actions assumes an AWS role via short-lived tokens. No AWS keys in GH secrets.",
          "permissions: id-token: write is REQUIRED for OIDC to work. Missing it = silent failure.",
          "Upload the prod manifest from the prod dbt run as an artifact step — that's how it gets to S3.",
          "After cp, run `jq '.metadata.dbt_schema_version' prod_state/manifest.json` to sanity-check it's a real dbt artifact.",
          "(see reference above)",
        ],
        successFeedback: "prod_state/manifest.json now available for state:modified+ comparison.",
        failureFeedback: "Common slips: forgot id-token: write permission (OIDC fails); used long-lived AWS keys (security review fails).",
        portfolioRelevance: "OIDC + dbt artifact pickup is the modern CI/CD pattern. Recruiters know this signals real production CI experience.",
        finalExplanation: "OIDC is the 2026 AWS-from-CI default. Long-lived keys are a deprecated antipattern.",
        misconceptionToWatchFor: "Putting AWS_SECRET_ACCESS_KEY in GH secrets. Rotation hell + audit trail loss + Bigger security blast radius.",
      }),
    },
    {
      stepNumber: 3,
      title: "Slim build with state:modified+",
      instructionMd:
        "Add `dbt build --select state:modified+ --defer --state prod_state --fail-fast` step. `state:modified+` = changed nodes + descendants. `--defer` = resolve upstream refs from prod (no rebuild). `--fail-fast` = bail on first error. Atlas checks that the required evidence markers are present in your submission — not that the program otherwise runs correctly, and not your authorship or competence.",
      learningObjective: "Use state:modified+ + defer + fail-fast to minimize PR build time + cost.",
      requiredSkill: "dbt build selectors + state comparison + defer semantics",
      starterCode: SRC(`# .github/workflows/dbt_ci.yml (continued)
      - name: dbt build (slim)
        env:
          DBT_PROFILES_DIR: profiles/ci
          GITHUB_PR_NUMBER: \${{ github.event.pull_request.number }}
        run: |
          dbt deps
          # TODO: dbt build --select state:modified+ --defer --state prod_state --fail-fast
`),
      validationType: "contains",
      stepType: "writeup",
      validation: validationConfig("contains", "Atlas checks that the required evidence markers are present in your submission — not that the program otherwise runs correctly, and not your authorship or competence.", {
        needles: [
          "--select state:modified+",
          "--defer",
          "--state prod_state",
          "--fail-fast",
        ],
      }),
      expectedOutputs: { flagsPresent: 4 },
      datasetRefs: ["fixtures/dbt_build_command.sh"],
      pedagogy: pedagogyConfig({
        hints: [
          "state:modified+ = node + descendants (the + is the descendants modifier). state:modified+1 limits to 1 hop.",
          "--defer pairs with --state to resolve {{ ref() }} against prod manifest. Without it, slim build fails on missing upstream.",
          "--fail-fast saves CI time + cost on broken PRs — every minute counts.",
          "dbt build --select state:modified+ --defer --state prod_state --fail-fast --target ci",
          "(see reference above)",
        ],
        successFeedback: "Build time dropped from 47min to <5min on a typical PR.",
        failureFeedback: "Common slips: forgot --defer (got 'relation not found' on upstream); used state:modified without + (skipped downstream changes that depend on modified models).",
        portfolioRelevance: "Slim CI is a top-priority skill for senior AE in 2026. The cost + speed delta is huge.",
        finalExplanation: "state:modified+ + defer is the textbook dbt-CI pattern. Internalize it.",
        misconceptionToWatchFor: "Running `dbt build` without any selector. Builds the whole project every PR — burns money + reviewer patience.",
      }),
    },
    {
      stepNumber: 4,
      title: "dbt test on the slim selection",
      instructionMd:
        "Add `dbt test --select state:modified+ --defer --state prod_state` step after build. Tests on changed models + downstream deps. Atlas checks that the required evidence markers are present in your submission — not that the program otherwise runs correctly, and not your authorship or competence.",
      learningObjective: "Run dbt tests scoped to the slim selection — full coverage on what changed without re-testing the world.",
      requiredSkill: "dbt test + selector consistency between build and test",
      starterCode: SRC(`      - name: dbt test (slim)
        env:
          DBT_PROFILES_DIR: profiles/ci
        run: |
          # TODO: dbt test --select state:modified+ --defer --state prod_state
`),
      validationType: "contains",
      stepType: "writeup",
      validation: validationConfig("contains", "Atlas checks that the required evidence markers are present in your submission — not that the program otherwise runs correctly, and not your authorship or competence.", {
        needles: [
          "--select state:modified+",
          "--defer",
          "--state prod_state",
        ],
      }),
      expectedOutputs: { testSelectorMatchesBuild: true },
      datasetRefs: ["fixtures/dbt_test_command.sh"],
      pedagogy: pedagogyConfig({
        hints: [
          "Keep test selectors identical to build selectors — testing fewer models than you built leaves gaps.",
          "Add --warn-error so test warnings become CI failures (catch deprecations earlier).",
          "For data tests (singular tests), include state:modified+ too — they're test files that change with the data model.",
          "dbt test --select state:modified+ --defer --state prod_state --warn-error",
          "(see reference above)",
        ],
        successFeedback: "Tests now scoped to what changed. Full coverage on the diff; no wasted runs on unchanged models.",
        failureFeedback: "Common slips: used state:modified without + (missed downstream tests); ran `dbt test` without --defer (failed on missing upstream).",
        portfolioRelevance: "Selector-discipline (build = test) is a senior-AE habit. Reviewers immediately spot inconsistency.",
        finalExplanation: "Build + test with identical selectors = consistent change scope. Drift between them = silent test gaps.",
        misconceptionToWatchFor: "Running `dbt test` without selectors after a `dbt build --select state:modified+`. Whole project tests = burns the time you saved.",
      }),
    },
    {
      stepNumber: 5,
      title: "PR comment: model graph diff",
      instructionMd:
        "Final step uses `dbt ls --select state:modified+ --state prod_state --resource-type model --output name` to print changed model names, then posts a sticky PR comment with the list using `peter-evans/create-or-update-comment@v4`. Atlas checks that the required evidence markers are present in your submission — not that the program otherwise runs correctly, and not your authorship or competence.",
      learningObjective: "Surface what the slim build actually built via a PR comment for reviewer context.",
      requiredSkill: "dbt ls + sticky PR comment via GH Action",
      starterCode: SRC(`      - name: List changed models
        id: changed
        run: |
          # TODO: dbt ls --select state:modified+ --state prod_state --resource-type model --output name > changed_models.txt
          echo "models=$(cat changed_models.txt | tr '\\n' ',' | sed 's/,$//')" >> $GITHUB_OUTPUT

      - uses: peter-evans/create-or-update-comment@v4
        with:
          issue-number: \${{ github.event.pull_request.number }}
          body: |
            ## dbt CI — slim build
            Changed models (state:modified+):
            \${{ steps.changed.outputs.models }}
`),
      validationType: "contains",
      stepType: "writeup",
      validation: validationConfig("contains", "Atlas checks that the required evidence markers are present in your submission — not that the program otherwise runs correctly, and not your authorship or competence.", {
        needles: [
          "peter-evans/create-or-update-comment",
          "dbt ls --select state:modified+",
        ],
      }),
      expectedOutputs: { commentStep: true, lsCommand: true },
      datasetRefs: ["fixtures/pr_comment_expected.md"],
      pedagogy: pedagogyConfig({
        hints: [
          "Sticky comment = same comment updated on each push (no comment storm). peter-evans handles dedup via a fixed marker.",
          "dbt ls is a metadata-only command — fast, no warehouse hits.",
          "Include node-type + tags too if your project has them (--output json then jq).",
          "Add a render of the DAG image via dbt-osmosis or graphviz for extra reviewer value.",
          "(see reference above)",
        ],
        successFeedback: "Reviewers now see exactly what was built. PR review time drops accordingly.",
        failureFeedback: "Common slips: created a new comment per push (alert fatigue); ran dbt ls without --resource-type model (got sources too).",
        portfolioRelevance: "Reviewer-friendly CI is the senior-AE polish that gets you promoted, not just hired.",
        finalExplanation: "PR comments turn 'CI passed' into 'here's exactly what changed' — the reviewer-experience differentiator.",
        misconceptionToWatchFor: "Skipping the PR comment because 'the CI logs have it'. Reviewers don't open logs unless they have to.",
      }),
    },
  ],
};
