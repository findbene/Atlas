import { describe, it, expect } from "vitest";
import {
  pedagogyConfig,
  validationConfig,
  portfolioArtifact,
  projectMeta,
  assertAuthoredProjectComplete,
  selfAttestHonestyViolations,
  type AuthoredProject,
  type AuthoredStep,
} from "./authoring";
import { composeScorecard } from "./scoring";
import type { ProjectInput, StepInput } from "./types";

function buildStep(n: number): AuthoredStep {
  return {
    stepNumber: n,
    title: `Step ${n}`,
    instructionMd: `Body for step ${n} — work through the production scenario.`,
    learningObjective: `Master concept ${n} as it appears in a real pipeline.`,
    requiredSkill: `skill-${n}`,
    starterCode: `-- starter sql for step ${n}\nSELECT 1;`,
    validationType: "sql_resultset",
    stepType: "code_sql",
    validation: validationConfig("sql_resultset", `Match expected result for step ${n}`, {
      query: `SELECT ${n} AS n`,
      expectedRows: [{ n }],
    }),
    expectedOutputs: { rows: [{ n }] },
    datasetRefs: [`fixtures/step${n}.csv`],
    pedagogy: pedagogyConfig({
      hints: [
        `L1 nudge for step ${n}`,
        `L2 nudge for step ${n}`,
        `L3 nudge for step ${n}`,
        `L4 starter snippet for step ${n}`,
        `L5 full solution for step ${n}`,
      ],
      successFeedback: `Nice work on step ${n}.`,
      failureFeedback: `Common slip on step ${n}: check ordering.`,
      portfolioRelevance: `Step ${n} maps to interview question about ordering.`,
      finalExplanation: `Full explanation of step ${n} mechanics.`,
      misconceptionToWatchFor: `Common misconception around step ${n}.`,
    }),
  };
}

function buildAuthoredFixture(): AuthoredProject {
  return {
    slug: "fixture-project",
    candidateId: "00000000-0000-0000-0000-000000000001",
    title: "Fixture Project",
    shortDescription: "A production-ready ETL pipeline fixture for tests.",
    fullDescription: "Walks through deploying a production ETL pipeline to PostgreSQL with bulk loaders, dbt models, and a published GitHub repo.",
    language: "sql",
    difficulty: "advanced",
    techStack: ["PostgreSQL", "SQL", "dbt"],
    tags: ["sql", "etl", "pipeline"],
    learningObjectives: ["A", "B", "C", "D"],
    estimatedMinutes: 120,
    xpReward: 400,
    isMultiFile: true,
    meta: projectMeta({
      scenario: "You're the lead analytics engineer at a B2B SaaS company.",
      hiringRelevance2026: "2026 hiring stacks expect deployed dbt + warehouse ownership.",
      readmeOutline: ["Overview", "Setup", "Steps", "Validation", "Portfolio Hand-off"],
    }),
    portfolio: portfolioArtifact({
      kind: "repo",
      deliverable: "Public GitHub repo with the deployed pipeline + README.",
      portfolioRelevance: "Recruiters can clone, run, and see deterministic output — strongest 2026 signal.",
    }),
    steps: [buildStep(1), buildStep(2), buildStep(3), buildStep(4)],
  };
}

describe("authoring helpers", () => {
  it("pedagogyConfig produces all 10 fields scorePedagogy checks", () => {
    const cfg = pedagogyConfig({
      hints: ["a", "b", "c", "d", "e"],
      successFeedback: "ok",
      failureFeedback: "fix it",
      portfolioRelevance: "matters",
      finalExplanation: "because",
      misconceptionToWatchFor: "thing",
    });
    expect(cfg.hintLevel1).toBe("a");
    expect(cfg.hintLevel5).toBe("e");
    expect(cfg.successFeedback).toBe("ok");
    expect(cfg.failureFeedback).toBe("fix it");
    expect(cfg.portfolioRelevance).toBe("matters");
    expect(cfg.finalExplanation).toBe("because");
    expect(cfg.misconceptionToWatchFor).toBe("thing");
  });

  it("projectMeta rejects too-short README outlines", () => {
    expect(() => projectMeta({
      scenario: "x", hiringRelevance2026: "y", readmeOutline: ["only-one"],
    })).toThrow(/at least 4/);
  });

  it("assertAuthoredProjectComplete passes on a well-formed fixture", () => {
    const p = buildAuthoredFixture();
    expect(() => assertAuthoredProjectComplete(p)).not.toThrow();
  });

  it("assertAuthoredProjectComplete rejects <4 steps", () => {
    const p = buildAuthoredFixture();
    p.steps = p.steps.slice(0, 3);
    expect(() => assertAuthoredProjectComplete(p)).toThrow(/≥4 steps/);
  });

  it("assertAuthoredProjectComplete rejects empty validation.spec", () => {
    const p = buildAuthoredFixture();
    p.steps[0].validation.spec = {};
    expect(() => assertAuthoredProjectComplete(p)).toThrow(/validation\.spec is empty/);
  });

  it("authored fixture scores ≥70 under the full rubric", () => {
    const p = buildAuthoredFixture();
    // Translate to ProjectInput / StepInput exactly the way the DB adapter does.
    const projectInput: ProjectInput = {
      id: p.slug,
      slug: p.slug,
      title: p.title,
      shortDescription: p.shortDescription,
      fullDescription: p.fullDescription,
      language: p.language,
      difficulty: p.difficulty,
      techStack: p.techStack,
      tags: p.tags,
      totalSteps: p.steps.length,
      estimatedMinutes: p.estimatedMinutes,
      isMultiFile: p.isMultiFile,
      isWalkthroughOnly: false,
      hasExecutionProfile: false,
      proposal: { portfolioArtifact: { kind: p.portfolio.kind, summary: p.portfolio.deliverable } },
    };
    const steps: StepInput[] = p.steps.map(s => ({
      stepNumber: s.stepNumber,
      title: s.title,
      instructionMd: s.instructionMd,
      validationType: s.validation.kind, // use the in-spec kind (e.g. sql_resultset)
      type: s.stepType,
      hasDatasetRefs: !!s.datasetRefs && s.datasetRefs.length > 0,
      hasExpectedOutputs: Object.keys(s.expectedOutputs).length > 0,
      pedagogyConfig: s.pedagogy,
      learningObjective: s.learningObjective,
      requiredSkill: s.requiredSkill,
    }));
    const card = composeScorecard(projectInput, { steps, neighbors: [] });
    expect(card.overall).toBeGreaterThanOrEqual(70);
  });
});


// ── Phase 56 — `contains` structured-spec validator ────────────────────────
describe("validationConfig(contains) — Phase 56 structured-spec validator", () => {
  const ok = (spec: Record<string, unknown>) =>
    expect(() => validationConfig("contains", "desc", spec)).not.toThrow();
  const bad = (spec: Record<string, unknown>, match: RegExp) =>
    expect(() => validationConfig("contains", "desc", spec)).toThrow(match);

  it("accepts legacy { needle }", () => ok({ needle: "foo" }));
  it("accepts legacy {} (expectedOutput fallback)", () => ok({}));
  it("accepts new full shape", () =>
    ok({ needles: ["a", "b"], match: "any", caseInsensitive: true }));
  it("accepts needles + match:'all'", () => ok({ needles: ["a"], match: "all" }));
  it("accepts needle + caseInsensitive", () => ok({ needle: "FOO", caseInsensitive: true }));

  it("rejects needle of non-string type", () =>
    bad({ needle: 5 as unknown as string }, /'needle' must be a string/));
  it("rejects empty needles[]", () =>
    bad({ needles: [] }, /at least one entry/));
  it("rejects needles[] over the 16-entry cap", () =>
    bad({ needles: Array.from({ length: 17 }, (_, i) => `n${i}`) }, /at most 16 entries/));
  it("rejects non-string entry inside needles[]", () =>
    bad({ needles: ["a", 5 as unknown as string] }, /non-empty string/));
  it("rejects empty-string entry inside needles[]", () =>
    bad({ needles: ["a", ""] }, /non-empty string/));
  it("rejects invalid match value", () =>
    bad({ needles: ["a"], match: "weird" as unknown as "all" }, /'match' must be "all" or "any"/));
  it("rejects non-boolean caseInsensitive", () =>
    bad({ needle: "x", caseInsensitive: "yes" as unknown as boolean }, /'caseInsensitive' must be a boolean/));

  it("does NOT reject needle + needles together (runtime: needles wins; audit advisory only)", () =>
    ok({ needle: "x", needles: ["y"] }));
  it("does NOT reject match without needles (runtime: match silently ignored; audit advisory only)", () =>
    ok({ needle: "x", match: "any" }));
  it("does NOT reject match:'any' (runtime: looser combinator; audit advisory only)", () =>
    ok({ needles: ["a"], match: "any" }));

  // Phase 61G — the dead `mustContainAll` alias (which the runtime never reads →
  // silent auto-pass) must be rejected at authoring time; `needles` is canonical.
  it("Phase 61G — rejects the dead 'mustContainAll' alias", () =>
    bad({ mustContainAll: ["a", "b"] }, /mustContainAll/));
  it("Phase 61G — accepts the canonical 'needles' replacement for mustContainAll", () =>
    ok({ needles: ["a", "b"] }));
});

// ── Phase 61I — `exact` authoring→runtime contract (require `expected`) ─────
describe("validationConfig(exact) — Phase 61I expected-output contract", () => {
  const okExact = (spec: Record<string, unknown>) =>
    expect(() => validationConfig("exact", "desc", spec)).not.toThrow();
  const badExact = (spec: Record<string, unknown>, match: RegExp) =>
    expect(() => validationConfig("exact", "desc", spec)).toThrow(match);

  it("accepts the canonical { expected: <non-empty string> }", () =>
    okExact({ expected: "the one true answer" }));

  it("rejects a missing expected (empty {}) — would fail closed at runtime", () =>
    badExact({}, /non-empty string 'expected' is required/));
  it("rejects an empty-string expected", () =>
    badExact({ expected: "" }, /non-empty string 'expected' is required/));
  it("rejects a non-string expected", () =>
    badExact({ expected: 123 }, /non-empty string 'expected' is required/));

  // Marker keys (the dead C2 4/6 pattern) and bespoke expected* assertions are
  // category errors — rejected by the strict allowlist (only `expected` allowed).
  it("rejects 'mustContainAll' on exact", () =>
    badExact({ mustContainAll: ["a"] }, /not read by the exact runtime/));
  it("rejects 'needles' on exact", () =>
    badExact({ needles: ["a"] }, /not read by the exact runtime/));
  it("rejects 'needle' on exact", () =>
    badExact({ needle: "a" }, /not read by the exact runtime/));
  it("rejects a bespoke expected* key (e.g. expectedSchemaPattern)", () =>
    badExact({ expectedSchemaPattern: "x" }, /not read by the exact runtime/));
  it("rejects an extra key alongside a valid expected", () =>
    badExact({ expected: "x", note: "y" }, /not read by the exact runtime/));
});

// ── Phase 61I — `contains` strict allowlist ────────────────────────────────
describe("validationConfig(contains) — Phase 61I strict allowlist", () => {
  const bad = (spec: Record<string, unknown>, match: RegExp) =>
    expect(() => validationConfig("contains", "desc", spec)).toThrow(match);
  it("rejects bespoke 'required'", () => bad({ required: ["a"] }, /not a key the runtime reads/));
  it("rejects bespoke 'mustContain'", () => bad({ mustContain: ["a"] }, /not a key the runtime reads/));
  it("rejects bespoke 'scenarios'", () => bad({ scenarios: [{}] }, /not a key the runtime reads/));
  it("rejects bespoke 'expected'", () => bad({ expected: ["a"] }, /not a key the runtime reads/));
  it("rejects bespoke 'forbidden' (must-NOT-contain — use self_attest)", () =>
    bad({ forbidden: ["secret"] }, /not a key the runtime reads/));
  it("still accepts canonical { needles }", () =>
    expect(() => validationConfig("contains", "desc", { needles: ["a", "b"] })).not.toThrow());
});

// ── Phase 61I — `regex` structured-spec validator ──────────────────────────
describe("validationConfig(regex) — Phase 61I structured-spec validator", () => {
  const okRe = (spec: Record<string, unknown>) =>
    expect(() => validationConfig("regex", "desc", spec)).not.toThrow();
  const badRe = (spec: Record<string, unknown>, match: RegExp) =>
    expect(() => validationConfig("regex", "desc", spec)).toThrow(match);

  it("accepts { pattern }", () => okRe({ pattern: "^ok$" }));
  it("accepts { pattern, flags }", () => okRe({ pattern: "ok", flags: "i" }));
  it("rejects a missing pattern (would match everything)", () =>
    badRe({}, /non-empty string 'pattern' is required/));
  it("rejects an empty-string pattern", () =>
    badRe({ pattern: "" }, /non-empty string 'pattern' is required/));
  it("rejects a non-string pattern", () =>
    badRe({ pattern: 1 }, /non-empty string 'pattern' is required/));
  it("rejects an unknown key", () =>
    badRe({ pattern: "ok", needle: "x" }, /Only 'pattern' and 'flags' are allowed/));
  it("rejects non-string flags", () =>
    badRe({ pattern: "ok", flags: 2 }, /'flags' must be a string/));
  it("rejects a pattern that does not compile", () =>
    badRe({ pattern: "(" }, /does not compile/));
});

// ── Phase 61J — `json_equal` structured-spec validator ─────────────────────
describe("validationConfig(json_equal) — Phase 61J expected contract", () => {
  const okJe = (spec: Record<string, unknown>) =>
    expect(() => validationConfig("json_equal", "desc", spec)).not.toThrow();
  const badJe = (spec: Record<string, unknown>, match: RegExp) =>
    expect(() => validationConfig("json_equal", "desc", spec)).toThrow(match);

  it("accepts { expected: <object> }", () => okJe({ expected: { count: 150, ok: true } }));
  it("accepts { expected: <array> }", () => okJe({ expected: [1, 2, 3] }));
  it("accepts { expected: <scalar> }", () => okJe({ expected: 42 }));
  it("rejects a missing expected ({}) — would fail closed", () =>
    badJe({}, /an 'expected' JSON value is required/));
  it("rejects a bespoke key alongside expected", () =>
    badJe({ expected: { a: 1 }, assertLength: 5 }, /not read by the json_equal runtime/));
  it("rejects bespoke-only specs (the dead-gate pattern)", () =>
    badJe({ mockedScores: [0.1], expectedIndices: [0] }, /not read by the json_equal runtime/));
});

// ── Phase 61J — `numeric_tolerance` structured-spec validator ──────────────
describe("validationConfig(numeric_tolerance) — Phase 61J scalar contract", () => {
  const okNt = (spec: Record<string, unknown>) =>
    expect(() => validationConfig("numeric_tolerance", "desc", spec)).not.toThrow();
  const badNt = (spec: Record<string, unknown>, match: RegExp) =>
    expect(() => validationConfig("numeric_tolerance", "desc", spec)).toThrow(match);

  it("accepts { expected:<number>, tolerance:<number> }", () => okNt({ expected: 0.692, tolerance: 0.01 }));
  it("accepts a zero tolerance (exact numeric match)", () => okNt({ expected: 4, tolerance: 0 }));
  it("rejects a missing expected", () =>
    badNt({ tolerance: 0.1 }, /finite numeric 'expected' is required/));
  it("rejects a missing tolerance", () =>
    badNt({ expected: 4.0 }, /finite non-negative numeric 'tolerance' is required/));
  it("rejects a multi-field object expected (use self_attest)", () =>
    badNt({ expected: { recall: 0.78, mrr: 0.62 }, tolerance: 0.02 }, /finite numeric 'expected' is required/));
  it("rejects a bespoke key (e.g. floors)", () =>
    badNt({ expected: 4, tolerance: 0.1, floors: { a: 1 } }, /not read by the runtime/));
  it("rejects a negative tolerance", () =>
    badNt({ expected: 4, tolerance: -1 }, /non-negative/));
});

// ── Phase 61K — self_attest copy honesty lint ──────────────────────────────
describe("selfAttestHonestyViolations — Phase 61K honesty lint", () => {
  const bad = (t: string) => expect(selfAttestHonestyViolations(t).length).toBeGreaterThan(0);
  const ok = (t: string) => expect(selfAttestHonestyViolations(t)).toEqual([]);

  // Misleading automated-validation language is flagged.
  it("flags 'Validator runs …'", () => bad("Validator runs the task twice for the same execution_date."));
  it("flags 'Validator asserts …'", () => bad("Validator asserts the file count after OPTIMIZE is ≤ 50."));
  it("flags 'Validator drives …'", () => bad("Validator drives 4 timestamps with 4 transforms."));
  it("flags 'server-enforced'", () => bad("This check is server-enforced on submit."));
  it("flags 'Atlas verifies …'", () => bad("Atlas verifies the output matches the expected JSON."));
  it("flags 'commit-grader'", () => bad("The commit-grader runs your code against the fixture."));
  it("flags 'graded by Atlas'", () => bad("Your submission is graded by Atlas automatically."));
  it("flags 'automated validation'", () => bad("An automated validation step runs on every submit."));

  // Honest copy passes.
  it("passes the honest attestation line", () =>
    ok("This is a learner attestation — Atlas does not run your code or grade this; verify it yourself."));
  it("passes a negated 'Atlas does not verify' disclaimer", () =>
    ok("Atlas does not verify independent authorship or professional competence."));
  it("passes 'Atlas does not run/check' negated forms", () =>
    ok("Atlas does not run, check, or grade this step; record your attestation."));
  it("passes honest self-check phrasing", () =>
    ok("Self-check: run the task twice for the same execution_date and confirm idempotency."));
  it("passes a learner-owned validator ('your validator runs …')", () =>
    ok("Write a validator function; confirm your validator runs the suite and reports pass/fail."));
  it("passes empty / plain copy", () => {
    ok("");
    ok("Implement the dispatch macro and write three unit tests.");
  });
});


// ── Phase 57A — `csv_set_equal` structured-spec validator ─────────────────
describe("validationConfig(csv_set_equal) — Phase 57A structured-spec validator", () => {
  const ok = (spec: Record<string, unknown>) =>
    expect(() => validationConfig("csv_set_equal", "desc", spec)).not.toThrow();
  const bad = (spec: Record<string, unknown>, match: RegExp) =>
    expect(() => validationConfig("csv_set_equal", "desc", spec)).toThrow(match);

  // ── BC: legacy/fixture/shape-E shapes still accepted (no serverGrade) ──
  it("accepts legacy fixture-based shape A {columns, expectedCsv}", () =>
    ok({ columns: ["a", "b"], expectedCsv: "fixtures/x.csv" }));
  it("accepts shape B {columns, expectedCsv, orderSensitive:true}", () =>
    ok({ columns: ["a"], expectedCsv: "fixtures/x.csv", orderSensitive: true }));
  it("accepts shape C {columns, expectedCsv, validateQuery}", () =>
    ok({ columns: ["a"], expectedCsv: "fixtures/x.csv", validateQuery: "B" }));
  it("accepts shape D {query, columns, expectedRows} (no serverGrade)", () =>
    ok({ query: "SELECT 1", columns: ["a"], expectedRows: [[1]] }));
  it("accepts shape E {cleanColumns, expectedClean, rejectColumns, expectedRejects}", () =>
    ok({
      cleanColumns: ["a"],
      expectedClean: "fixtures/c.csv",
      rejectColumns: ["a", "reason"],
      expectedRejects: "fixtures/r.csv",
    }));

  // ── opt-in: serverGrade=true requires columns + (expectedRows | hash) ──
  it("accepts opt-in with columns + expectedRows", () =>
    ok({ serverGrade: true, columns: ["a"], expectedRows: [[1]] }));
  it("accepts opt-in with columns + expectedRowsHash (valid hex)", () =>
    ok({
      serverGrade: true,
      columns: ["a"],
      expectedRowsHash: "a".repeat(64),
    }));
  it("accepts opt-in with all optional flags set", () =>
    ok({
      serverGrade: true,
      columns: ["a"],
      expectedRows: [[1]],
      orderSensitive: false,
      trimStrings: true,
      nullEqualsEmpty: true,
      coerceNumericStrings: true,
      caseInsensitive: true,
      dedupe: "both",
    }));

  // ── opt-in: minimum-contract rejections ────────────────────────────
  it("rejects serverGrade=true without columns", () =>
    bad({ serverGrade: true, expectedRows: [[1]] }, /'columns' \(non-empty\) is required/));
  it("rejects serverGrade=true without expectedRows or hash", () =>
    bad({ serverGrade: true, columns: ["a"] }, /must provide 'expectedRows' or 'expectedRowsHash'/));
  it("rejects serverGrade=true + orderSensitive=true with hash-only", () =>
    bad(
      { serverGrade: true, columns: ["a"], expectedRowsHash: "a".repeat(64), orderSensitive: true },
      /requires inline 'expectedRows'/,
    ));
  it("rejects expectedRows widths that don't match columns count (opt-in)", () =>
    bad(
      { serverGrade: true, columns: ["a", "b"], expectedRows: [[1]] },
      /must have exactly 2 cells/,
    ));

  // ── symmetry with runtime: lax pass-through when NOT opted in ──────
  // When `serverGrade !== true`, the runtime auto-passes the spec
  // verbatim (BC path). The authoring guard mirrors this exactly so
  // legacy fixture shapes A–E with unexpected key types still pass.
  it("lax: non-boolean flags pass through without opt-in (matches runtime BC)", () => {
    ok({ orderSensitive: "yes" as unknown as boolean });
    ok({ trimStrings: 1 as unknown as boolean });
    ok({ nullEqualsEmpty: "true" as unknown as boolean });
    ok({ coerceNumericStrings: 0 as unknown as boolean });
    ok({ caseInsensitive: "yes" as unknown as boolean });
    ok({ dedupe: "weird" as unknown as "both" });
    ok({ columns: ["a", 5 as unknown as string] });
    ok({ expectedRowsHash: "ABCDEF" as string });
  });

  // ── type checks on optional flags (when opted in) ──────────────────
  it("rejects serverGrade non-boolean (always — strict author lint)", () =>
    bad({ serverGrade: "yes" as unknown as boolean }, /'serverGrade' must be a boolean/));
  it("rejects orderSensitive non-boolean (opt-in)", () =>
    bad({ serverGrade: true, columns: ["a"], expectedRows: [[1]], orderSensitive: "yes" as unknown as boolean }, /'orderSensitive' must be a boolean/));
  it("rejects trimStrings non-boolean (opt-in)", () =>
    bad({ serverGrade: true, columns: ["a"], expectedRows: [[1]], trimStrings: 1 as unknown as boolean }, /'trimStrings' must be a boolean/));
  it("rejects nullEqualsEmpty non-boolean (opt-in)", () =>
    bad({ serverGrade: true, columns: ["a"], expectedRows: [[1]], nullEqualsEmpty: "true" as unknown as boolean }, /'nullEqualsEmpty' must be a boolean/));
  it("rejects coerceNumericStrings non-boolean (opt-in)", () =>
    bad({ serverGrade: true, columns: ["a"], expectedRows: [[1]], coerceNumericStrings: 0 as unknown as boolean }, /'coerceNumericStrings' must be a boolean/));
  it("rejects caseInsensitive non-boolean (opt-in)", () =>
    bad({ serverGrade: true, columns: ["a"], expectedRows: [[1]], caseInsensitive: "yes" as unknown as boolean }, /'caseInsensitive' must be a boolean/));
  it("rejects dedupe with invalid value (opt-in)", () =>
    bad({ serverGrade: true, columns: ["a"], expectedRows: [[1]], dedupe: "weird" as unknown as "both" }, /'dedupe' must be false \| "expected" \| "both"/));
  it("rejects columns with non-string entry (opt-in)", () =>
    bad({ serverGrade: true, columns: ["a", 5 as unknown as string], expectedRows: [[1, 2]] }, /non-empty string/));
  it("rejects columns with empty-string entry (opt-in)", () =>
    bad({ serverGrade: true, columns: ["a", ""], expectedRows: [[1, 2]] }, /non-empty string/));
  it("rejects expectedRows entries with non-cell values (opt-in)", () =>
    bad(
      { serverGrade: true, columns: ["a"], expectedRows: [[{ nested: true } as unknown as string]] },
      /arrays of \(string\|number\|boolean\|null\)/,
    ));
  it("rejects expectedRowsHash that is not 64 lowercase hex (opt-in)", () =>
    bad({ serverGrade: true, columns: ["a"], expectedRowsHash: "ABCDEF" as string }, /64-character lowercase hex/));
  it("rejects expectedRowsHash that is uppercase hex (opt-in)", () =>
    bad({ serverGrade: true, columns: ["a"], expectedRowsHash: "A".repeat(64) }, /64-character lowercase hex/));
});

// ── Phase 58A — `sql_resultset` structured-spec validator ─────────────────
describe("validationConfig(sql_resultset) — Phase 58A structured-spec validator", () => {
  const ok = (spec: Record<string, unknown>) =>
    expect(() => validationConfig("sql_resultset", "desc", spec)).not.toThrow();
  const bad = (spec: Record<string, unknown>, match: RegExp) =>
    expect(() => validationConfig("sql_resultset", "desc", spec)).toThrow(match);

  // ── BC: the 25 live free-form sql_resultset specs pass through ─────────
  it("accepts live shape {query, expectedRow} (scalar, no serverGrade)", () =>
    ok({ query: "select count(*) as n from t", expectedRow: { n: 7, nUnique: 7 } }));
  it("accepts live shape {query, expectedRows:[{...}]} (array-of-objects, no serverGrade)", () =>
    ok({ query: "q", expectedRows: [{ check: "one_current", value: 0 }, { check: "overlap", value: 0 }] }));
  it("accepts Snowflake scalar-assertion shape {expectedActionCounts}", () =>
    ok({ expectedActionCounts: { INSERT: 3 } }));
  it("accepts wrapped {expected:{...}} shape", () =>
    ok({ expected: { inheritedRolesCount: 3, directPrivilegesCount: 0 } }));
  it("lax: non-boolean flags pass through without opt-in (matches runtime BC)", () => {
    ok({ orderSensitive: "yes" as unknown as boolean });
    ok({ dedupe: "weird" as unknown as "both" });
    ok({ columns: ["a", 5 as unknown as string] });
  });

  // ── opt-in: same rowset contract as csv_set_equal ─────────────────────
  it("accepts opt-in with columns + expectedRows", () =>
    ok({ serverGrade: true, columns: ["n"], expectedRows: [[7]] }));
  it("accepts opt-in with columns + expectedRowsHash (valid hex)", () =>
    ok({ serverGrade: true, columns: ["n"], expectedRowsHash: "a".repeat(64) }));

  // ── opt-in rejections carry the sql_resultset label ───────────────────
  it("rejects serverGrade non-boolean (strict author lint, names the kind)", () =>
    bad({ serverGrade: "yes" as unknown as boolean }, /sql_resultset spec: 'serverGrade' must be a boolean/));
  it("rejects serverGrade=true without columns", () =>
    bad({ serverGrade: true, expectedRows: [[7]] }, /'columns' \(non-empty\) is required/));
  it("rejects serverGrade=true without expectedRows or hash", () =>
    bad({ serverGrade: true, columns: ["n"] }, /must provide 'expectedRows' or 'expectedRowsHash'/));
  it("rejects expectedRows widths that don't match columns count", () =>
    bad({ serverGrade: true, columns: ["a", "b"], expectedRows: [[1]] }, /must have exactly 2 cells/));
});
