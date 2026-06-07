/**
 * Phase 58B — `GET /projects/:slug` server-grade signal + no-leak regression.
 *
 * Pins the security crux of the csv_set_equal (57B) / sql_resultset (58B)
 * server-grade flips: the project-detail response exposes ONLY the narrow
 * derived `step.serverGrade: boolean` and NEVER leaks the answer keys
 * (`validationConfig` / `spec` / `expectedRows` / `expectedRowsHash` / the
 * reference `query`) to the client. A future refactor that accidentally spreads
 * the raw step row would break a test instead of silently shipping a leak.
 *
 * Covers: opted-in sql_resultset → serverGrade true; opted-in csv_set_equal →
 * true; non-opted sql_resultset → false; self_attest → false; and a full-body
 * assertion that no answer-key token crosses the wire.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const projectsFindFirst = vi.fn();
const stepsFindMany = vi.fn();
const domainsFindFirst = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      projects: { findMany: vi.fn().mockResolvedValue([]), findFirst: (...a: unknown[]) => projectsFindFirst(...a) },
      projectSteps: { findMany: (...a: unknown[]) => stepsFindMany(...a) },
      domains: { findFirst: (...a: unknown[]) => domainsFindFirst(...a) },
      userProgress: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(undefined) },
      userStepCompletions: { findMany: vi.fn().mockResolvedValue([]) },
      projectSolutions: { findFirst: vi.fn().mockResolvedValue(undefined) },
    },
    execute: vi.fn().mockResolvedValue({ rows: [{ c: 0 }] }),
  },
  projects: { id: "id", slug: "slug" },
  projectSteps: { projectId: "projectId", stepNumber: "stepNumber" },
  projectHints: {}, domains: { id: "id", slug: "slug" }, projectSolutions: {},
  userProgress: {}, userStepCompletions: {}, projectCandidates: {},
}));

vi.mock("../lib/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  getCurrentUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ eq: a }),
  and: (...a: unknown[]) => ({ and: a }),
  desc: (...a: unknown[]) => ({ desc: a }),
  asc: (...a: unknown[]) => ({ asc: a }),
  or: (...a: unknown[]) => ({ or: a }),
  ilike: (col: unknown, pat: unknown) => ({ ilike: [col, pat] }),
  sql: Object.assign((s: TemplateStringsArray, ...v: unknown[]) => ({ s, v }), {}),
}));

async function buildApp() {
  const router = (await import("./projects")).default;
  const app = express();
  app.use((req, _res, next) => { (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }; next(); });
  app.use(router);
  return app;
}

const SECRET_QUERY = "select 'one_current' as check /* ANSWER-KEY-QUERY */";

function step(over: Record<string, unknown>) {
  return {
    id: "s1", stepNumber: 1, title: "t", instructionMd: "do it", type: "code_sql",
    starterCode: "select 1", expectedOutput: null, xpReward: 10,
    expectedOutputs: { note: "ok" }, datasetRefs: ["seeds/customers"], executionOverride: null,
    learningObjective: "lo", requiredSkill: "rs", pedagogyConfig: { hintLevel1: "h" },
    validationType: "self_attest", validationConfig: null,
    ...over,
  };
}

function visibleProject() {
  return {
    id: "p1", slug: "c2", learnerVisible: true, title: "C2", shortDescription: "x",
    fullDescription: "x", difficultyLevel: "advanced", isPremium: true, xpReward: 0,
    estimatedMinutes: 90, totalSteps: 1, enrolledCount: 0, completionRate: 0, tags: [],
    orderIndex: 0, learningObjectives: [], prerequisites: [], domainId: "d1",
    course: "analytics-engineer", jobOutcomes: null, executionProfile: null, starterCodePython: null,
  };
}

beforeEach(() => {
  projectsFindFirst.mockReset().mockResolvedValue(visibleProject());
  domainsFindFirst.mockReset().mockResolvedValue({ slug: "data-engineering", title: "Data Engineering" });
  stepsFindMany.mockReset();
});

describe("GET /projects/:slug — server-grade signal", () => {
  it("opted-in sql_resultset step surfaces serverGrade:true", async () => {
    stepsFindMany.mockResolvedValue([
      step({
        validationType: "sql_resultset",
        validationConfig: { kind: "sql_resultset", description: "d", spec: {
          serverGrade: true, columns: ["check", "value"],
          expectedRows: [["one_current", 0], ["overlap", 0]], query: SECRET_QUERY,
        } },
      }),
    ]);
    const res = await request(await buildApp()).get("/projects/c2");
    expect(res.status).toBe(200);
    expect(res.body.steps[0].serverGrade).toBe(true);
  });

  it("opted-in csv_set_equal step surfaces serverGrade:true", async () => {
    stepsFindMany.mockResolvedValue([
      step({
        validationType: "csv_set_equal",
        validationConfig: { kind: "csv_set_equal", description: "d", spec: {
          serverGrade: true, columns: ["a"], expectedRows: [[1]],
        } },
      }),
    ]);
    const res = await request(await buildApp()).get("/projects/c2");
    expect(res.body.steps[0].serverGrade).toBe(true);
  });

  it("non-opted sql_resultset step is serverGrade:false (dark)", async () => {
    stepsFindMany.mockResolvedValue([
      step({
        validationType: "sql_resultset",
        validationConfig: { kind: "sql_resultset", description: "d", spec: {
          query: SECRET_QUERY, expectedRow: { n: 7 },
        } },
      }),
    ]);
    const res = await request(await buildApp()).get("/projects/c2");
    expect(res.body.steps[0].serverGrade).toBe(false);
  });

  it("self_attest step is serverGrade:false", async () => {
    stepsFindMany.mockResolvedValue([step({ validationType: "self_attest", validationConfig: null })]);
    const res = await request(await buildApp()).get("/projects/c2");
    expect(res.body.steps[0].serverGrade).toBe(false);
  });

  it("NEVER leaks answer keys (validationConfig/spec/expectedRows/query) for an opted-in row", async () => {
    stepsFindMany.mockResolvedValue([
      step({
        validationType: "sql_resultset",
        validationConfig: { kind: "sql_resultset", description: "d", spec: {
          serverGrade: true, columns: ["check", "value"],
          expectedRows: [["one_current", 0], ["overlap", 0]], query: SECRET_QUERY,
        } },
      }),
    ]);
    const res = await request(await buildApp()).get("/projects/c2");
    const s = res.body.steps[0];
    // The narrow boolean is the ONLY server-grade signal exposed.
    expect(s.serverGrade).toBe(true);
    expect(s).not.toHaveProperty("validationConfig");
    expect(s).not.toHaveProperty("validationType");
    expect(s).not.toHaveProperty("spec");
    expect(s).not.toHaveProperty("expectedRows");
    expect(s).not.toHaveProperty("expectedRowsHash");
    expect(s).not.toHaveProperty("columns");
    // Full-body scan: no answer-key token (the expected values or the reference
    // query) appears anywhere in the serialized response.
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("ANSWER-KEY-QUERY");
    expect(body).not.toContain("one_current");
    expect(body).not.toContain("expectedRows");
  });
});
