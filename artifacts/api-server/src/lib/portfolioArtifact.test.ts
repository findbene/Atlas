/**
 * Phase 60A — tests for the evidence-safe portfolio artifact generator.
 *
 * Three concerns, per the phase brief:
 *   1. No-leak        — generated artifacts never contain specs, expected
 *                       outputs, answer keys, comparator internals, raw
 *                       submissions, or secret-like strings. Asserted both on a
 *                       realistic input AND structurally (extra spec-like props
 *                       attached to the input must never surface).
 *   2. Evidence-honesty — artifacts carry the required limitation language and
 *                       NONE of the forbidden over-claims.
 *   3. Deterministic   — same input → byte-identical output.
 *
 * The golden input mirrors the real C2 project (analytics-engineer
 * semantic-layer): step 2 is the opted-in `sql_resultset` and step 3 the
 * opted-in `csv_set_equal`, the rest are weaker kinds — so the realistic
 * server-graded vs client-provisional split is exercised.
 */
import { describe, expect, it } from "vitest";
import {
  generatePortfolioArtifact,
  classifyEvidenceStatus,
  type PortfolioArtifactInput,
  type PortfolioArtifactBundle,
  type PortfolioStepEvidence,
} from "./portfolioArtifact";

function step(
  over: Partial<PortfolioStepEvidence> &
    Pick<PortfolioStepEvidence, "stepNumber" | "title" | "validationKind">,
): PortfolioStepEvidence {
  return {
    serverGradeFlag: false,
    passed: true,
    completedAt: "2026-05-01T12:00:00.000Z",
    requiredSkill: null,
    ...over,
  };
}

function c2Input(
  over: Partial<PortfolioArtifactInput> = {},
): PortfolioArtifactInput {
  return {
    project: {
      title: "Semantic layer with dbt and DuckDB",
      slug: "analytics-engineer-semantic-layer-with-dbt-and-duckdb",
      course: "analytics-engineer",
      role: "Analytics Engineer",
      difficulty: "advanced",
      summary:
        "Build a dbt semantic layer over a SaaS subscription dataset: staging models, an SCD-2 customer dimension, and a monthly snapshot mart with churn/expansion flags.",
      skills: [
        "SCD-2 dimension modeling",
        "Cross-join densification for churn tables",
        "LAG window functions over time",
      ],
      tools: ["dbt", "DuckDB", "SQL"],
      totalSteps: 8,
    },
    completion: {
      completedAt: "2026-05-01T13:30:00.000Z",
      durationSeconds: 5400,
      stepsCompleted: 8,
      totalSteps: 8,
      evidenceHashCount: 8,
      totalXpEarned: 250,
      certId: "11111111-1111-4111-8111-111111111111",
      verifyUrl: "/verify/11111111-1111-4111-8111-111111111111",
    },
    steps: [
      step({
        stepNumber: 1,
        title: "Stage the raw subscription and customer seeds",
        validationKind: "self_attest",
      }),
      step({
        stepNumber: 2,
        title: "SCD-2 invariants hold for the customer dimension",
        validationKind: "sql_resultset",
        serverGradeFlag: true,
        requiredSkill: "SCD-2 dimension modeling",
      }),
      step({
        stepNumber: 3,
        title: "Monthly subscription snapshot mart with churn flags",
        validationKind: "csv_set_equal",
        serverGradeFlag: true,
        requiredSkill: "Cross-join densification",
      }),
      step({
        stepNumber: 4,
        title: "Document the model with a description block",
        validationKind: "contains",
      }),
    ],
    submittedCodeAvailable: false,
    submittedOutputAvailable: false,
    generatedAtIso: "2026-06-07T00:00:00.000Z",
    ...over,
  };
}

function concatBundle(bundle: PortfolioArtifactBundle): string {
  return Object.values(bundle)
    .filter((v): v is string => typeof v === "string")
    .join("\n\n");
}

describe("classifyEvidenceStatus", () => {
  it("marks opted-in rowset kinds server-graded", () => {
    expect(classifyEvidenceStatus("csv_set_equal", true)).toBe("server-graded");
    expect(classifyEvidenceStatus("sql_resultset", true)).toBe("server-graded");
  });

  it("marks non-opted rowset kinds client-provisional", () => {
    expect(classifyEvidenceStatus("csv_set_equal", false)).toBe(
      "client-provisional",
    );
    expect(classifyEvidenceStatus("sql_resultset", false)).toBe(
      "client-provisional",
    );
  });

  it("ignores the serverGrade flag for non-rowset kinds (never false-upgrades)", () => {
    // Mirrors deriveServerGrade: only csv_set_equal | sql_resultset can be
    // server-graded. A stray flag on any other kind must NOT upgrade it.
    expect(classifyEvidenceStatus("contains", true)).toBe("client-provisional");
    expect(classifyEvidenceStatus("json_equal", true)).toBe(
      "client-provisional",
    );
    expect(classifyEvidenceStatus("regex_match", true)).toBe(
      "client-provisional",
    );
  });

  it("marks self_attest self-attested", () => {
    expect(classifyEvidenceStatus("self_attest", false)).toBe("self-attested");
    expect(classifyEvidenceStatus("self_attest", true)).toBe("self-attested");
  });
});

describe("generatePortfolioArtifact — no-leak", () => {
  const bundle = generatePortfolioArtifact(c2Input());
  const all = concatBundle(bundle).toLowerCase();

  const FORBIDDEN_TOKENS = [
    // spec / answer-key surface
    "validationconfig",
    "expectedrows",
    "expectedrow",
    "expectedrowshash",
    "expectedrowhash",
    "servergrade", // the camelCase flag key (label is "server-graded", not this)
    // C2 reference-query / expected-output fragments
    "one_current",
    "overlap",
    "9999-12-31",
    "generate_series",
    "date_trunc",
    "union all",
    "raw_customers",
    "seeds/customers",
    "seeds/subscriptions",
    "mart_subscription_monthly",
    "c-100",
    "lag(",
    "md5(",
    "select '",
    'from "seeds',
    // raw submission / secret surface
    "submissionexcerpt",
    "submission_excerpt",
    "database_url",
    "anthropic_api_key",
    "sk-ant",
    "postgres://",
    "password",
  ];

  for (const token of FORBIDDEN_TOKENS) {
    it(`never emits "${token}"`, () => {
      expect(all).not.toContain(token);
    });
  }

  it("emits the safe validation-kind enum label, not its config", () => {
    expect(bundle["VALIDATION_EVIDENCE.md"]).toContain("`sql_resultset`");
    expect(bundle["VALIDATION_EVIDENCE.md"]).toContain("`csv_set_equal`");
  });

  it("renders only declared fields — extra spec-like props on the input never surface", () => {
    // The input TYPE has no channel for a spec; this proves the implementation
    // also reads only declared fields, so a future careless caller that attaches
    // a validationConfig / expectedRows / answerKey cannot leak it.
    const poisoned = {
      ...c2Input(),
      validationConfig: { expectedRows: [["LEAK_ROW", 42]], serverGrade: true },
      expectedRows: [["LEAK_ROW", 42]],
      answerKey: "LEAK_ANSWER_KEY",
      steps: [
        {
          ...c2Input().steps[1],
          validationConfig: { expectedRows: [["LEAK_STEP", 1]] },
          expectedRows: [["LEAK_STEP", 1]],
        },
        ...c2Input().steps.slice(2),
      ],
    } as unknown as PortfolioArtifactInput;
    const out = concatBundle(generatePortfolioArtifact(poisoned)).toLowerCase();
    expect(out).not.toContain("leak_row");
    expect(out).not.toContain("leak_step");
    expect(out).not.toContain("leak_answer_key");
    expect(out).not.toContain("expectedrows");
  });
});

describe("generatePortfolioArtifact — evidence honesty", () => {
  const bundle = generatePortfolioArtifact(c2Input());
  const all = concatBundle(bundle);
  const allLower = all.toLowerCase();

  it("makes exactly the allowed verification claim", () => {
    expect(all).toContain(
      "Atlas verified that submitted runtime output or artifacts matched the enabled",
    );
  });

  it("includes the required limitation language", () => {
    const lim = bundle["LIMITATIONS.md"];
    expect(lim).toContain("does **not** prove the learner produced the solution");
    expect(lim.toLowerCase()).toContain("cheating");
    expect(lim.toLowerCase()).toContain("tampering");
    expect(lim).toContain("certify the learner's competence");
    expect(lim).toContain("who wrote the code or SQL");
    expect(lim.toLowerCase()).toContain("generation time");
    expect(lim).toContain("not included"); // submitted code unavailable
    expect(lim).toContain("Server-graded evidence is stronger");
  });

  it("contains NONE of the forbidden over-claims (incl. dash/unicode variants)", () => {
    const FORBIDDEN_CLAIMS = [
      "cheat-proof",
      "cheatproof",
      "cheat–proof", // en-dash evasion
      "cheat-resistant",
      "tamper-proof",
      "tamperproof",
      "tamper–proof", // en-dash evasion
      "tamper-resistant",
      "job readiness",
      "job-readiness",
      "job guarantee",
      "guaranteed job",
      "guarantee a job",
      "guarantees a job",
      "independent authorship",
      "authorship", // the word is avoided entirely
      "outside help",
      "professional competence",
      "honest authorship",
      "verified honest",
    ];
    for (const claim of FORBIDDEN_CLAIMS) {
      expect(allLower).not.toContain(claim);
    }
  });
});

describe("generatePortfolioArtifact — deterministic & structural", () => {
  it("is byte-identical across calls for the same input", () => {
    const a = generatePortfolioArtifact(c2Input());
    const b = generatePortfolioArtifact(c2Input());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("always emits the three mandatory files + the reflection template", () => {
    const bundle = generatePortfolioArtifact(c2Input());
    expect(Object.keys(bundle).sort()).toEqual([
      "LEARNER_REFLECTION_TEMPLATE.md",
      "LIMITATIONS.md",
      "README.md",
      "VALIDATION_EVIDENCE.md",
    ]);
  });

  it("emits DATASET_NOTES.md only when datasets are supplied", () => {
    const without = generatePortfolioArtifact(c2Input());
    expect(without["DATASET_NOTES.md"]).toBeUndefined();

    const withDs = generatePortfolioArtifact(
      c2Input({
        datasets: [
          {
            name: "seeds (subscriptions, customers)",
            description: "Practice SaaS subscription fixtures provided by Atlas.",
          },
        ],
      }),
    );
    expect(withDs["DATASET_NOTES.md"]).toContain("Dataset notes");
    expect(withDs["DATASET_NOTES.md"]).toContain(
      "Practice SaaS subscription fixtures",
    );
  });

  it("renders the project header, skills, tools, and verify URL in the README", () => {
    const bundle = generatePortfolioArtifact(c2Input());
    const readme = bundle["README.md"];
    expect(readme.startsWith("# Semantic layer with dbt and DuckDB")).toBe(true);
    expect(readme).toContain("**Role / path:** Analytics Engineer");
    expect(readme).toContain("- SCD-2 dimension modeling");
    expect(readme).toContain("- dbt");
    expect(readme).toContain("/verify/11111111-1111-4111-8111-111111111111");
  });

  it("derives each step's evidence strength from kind + flag + passed", () => {
    const bundle = generatePortfolioArtifact(c2Input());
    const ev = bundle["VALIDATION_EVIDENCE.md"];
    // step 2 (sql_resultset) + step 3 (csv_set_equal) opted in → server-graded
    expect(ev).toMatch(/\| 2 \|.*`sql_resultset` \|.*\| server-graded \|/);
    expect(ev).toMatch(/\| 3 \|.*`csv_set_equal` \|.*\| server-graded \|/);
    // step 1 self-attested, step 4 client-provisional
    expect(ev).toMatch(/\| 1 \|.*`self_attest` \|.*\| self-attested \|/);
    expect(ev).toMatch(/\| 4 \|.*`contains` \|.*\| client-provisional \|/);
  });

  it("renders a non-passed step as unavailable (no claimed strength)", () => {
    const bundle = generatePortfolioArtifact(
      c2Input({
        steps: [
          step({
            stepNumber: 5,
            title: "Optional stretch goal",
            validationKind: "csv_set_equal",
            serverGradeFlag: true, // even opted in, no pass → unavailable
            passed: false,
            completedAt: null,
          }),
        ],
      }),
    );
    expect(bundle["VALIDATION_EVIDENCE.md"]).toMatch(/\| 5 \|.*\| unavailable \|/);
  });

  it("escapes a pipe in an author field so the evidence table stays intact", () => {
    const bundle = generatePortfolioArtifact(
      c2Input({
        steps: [
          step({
            stepNumber: 1,
            title: "a | b | c",
            validationKind: "self_attest",
          }),
        ],
      }),
    );
    expect(bundle["VALIDATION_EVIDENCE.md"]).toContain("a \\| b \\| c");
  });

  it("handles empty skills/tools and no completed steps gracefully", () => {
    const bundle = generatePortfolioArtifact(
      c2Input({
        project: {
          ...c2Input().project,
          skills: [],
          tools: [],
        },
        steps: [],
      }),
    );
    expect(bundle["README.md"]).toContain("Not recorded for this project.");
    expect(bundle["VALIDATION_EVIDENCE.md"]).toContain(
      "No completed steps were recorded",
    );
  });
});
