/**
 * Phase 60B — GET /user/projects/:projectSlug/portfolio-artifact route tests.
 *
 * Exercises the full chain (assembly -> pure generator) with a mocked DB:
 *   - requires authentication (401 when no session user).
 *   - 404 (not 403) for a hidden/unknown project or a non-enrolled user.
 *   - returns the deterministic file bundle for a completed project.
 *   - degrades honestly when no submission snapshot exists.
 *   - NO answer-key/spec/secret leak in the response.
 *   - ZERO banned over-claim patterns, checked against the CANONICAL guard
 *     (`@workspace/execution-core/honest-claims`) — not a bespoke list.
 *   - includes the single allowed Atlas verification statement.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { findBannedClaims } from "@workspace/execution-core/honest-claims";

const TEST_USER = { id: "00000000-0000-0000-0000-000000000001", email: "u@example.com", name: "U" };

const getCurrentUserMock = vi.fn().mockResolvedValue(TEST_USER);
vi.mock("../lib/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  getCurrentUser: (...a: unknown[]) => getCurrentUserMock(...a),
}));

const projectsFindFirst = vi.fn();
const userProgressFindFirst = vi.fn();
const projectStepsFindMany = vi.fn();
const userStepCompletionsFindMany = vi.fn();
const snapshotsFindMany = vi.fn();

const dbMock: any = {
  query: {
    projects: { findFirst: (...a: unknown[]) => projectsFindFirst(...a) },
    userProgress: { findFirst: (...a: unknown[]) => userProgressFindFirst(...a) },
    projectSteps: { findMany: (...a: unknown[]) => projectStepsFindMany(...a) },
    userStepCompletions: { findMany: (...a: unknown[]) => userStepCompletionsFindMany(...a) },
    portfolioSubmissionSnapshots: { findMany: (...a: unknown[]) => snapshotsFindMany(...a) },
  },
  select: vi.fn(() => ({ from: () => ({ where: () => Promise.resolve([{ total: 250 }]) }) })),
};

vi.mock("@workspace/db", () => ({
  db: dbMock,
  projects: { _t: "projects", slug: "slug", learnerVisible: "lv", deletedAt: "del", id: "id" },
  projectSteps: { _t: "projectSteps", projectId: "p", stepNumber: "n" },
  userProgress: { _t: "userProgress", userId: "u", projectId: "p" },
  userStepCompletions: { _t: "userStepCompletions", userId: "u", projectId: "p" },
  portfolioSubmissionSnapshots: { _t: "snap", userId: "u", projectId: "p" },
  xpTransactions: { _t: "xp", userId: "u", amount: "amount", metadata: "metadata" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ eq: a }),
  and: (...a: unknown[]) => ({ and: a }),
  asc: (...a: unknown[]) => ({ asc: a }),
  isNull: (...a: unknown[]) => ({ isNull: a }),
  sql: Object.assign((s: unknown, ...v: unknown[]) => ({ _sql: s, _v: v }), {}),
}));

const SLUG = "analytics-engineer-semantic-layer-with-dbt-and-duckdb";
const PROJECT = {
  id: "p1",
  slug: SLUG,
  title: "Semantic layer with dbt and DuckDB",
  course: "analytics-engineer",
  difficultyLevel: "advanced",
  shortDescription:
    "Build a dbt semantic layer over a SaaS subscription dataset with an SCD-2 dimension and a churn snapshot mart.",
  learningObjectives: ["SCD-2 dimension modeling", "Cross-join densification"],
  techStack: ["dbt", "DuckDB", "SQL"],
  totalSteps: 8,
  jobOutcomes: { roles: ["Analytics Engineer"] },
  learnerVisible: true,
  deletedAt: null,
};
const PROGRESS = {
  id: "cert-1",
  userId: TEST_USER.id,
  projectId: "p1",
  status: "completed",
  completedAt: new Date("2026-05-01T13:30:00.000Z"),
};
const STEPS = [
  { id: "s1", stepNumber: 1, title: "Stage the seeds", validationType: "self_attest", validationConfig: {}, requiredSkill: null },
  {
    id: "s2", stepNumber: 2, title: "SCD-2 invariants", validationType: "sql_resultset",
    validationConfig: { spec: { serverGrade: true, columns: ["check", "value"], expectedRows: [["one_current", 0], ["overlap", 0]] } },
    requiredSkill: "SCD-2 dimension modeling",
  },
  {
    id: "s3", stepNumber: 3, title: "Monthly snapshot mart", validationType: "csv_set_equal",
    validationConfig: { spec: { serverGrade: true, columns: ["a", "b"], expectedRows: [[1, "secretval"]] } },
    requiredSkill: "Cross-join densification",
  },
];
const COMPLETIONS = [
  { stepNumber: 1, passed: true, completedAt: new Date("2026-05-01T12:00:00.000Z"), submissionSha256: null },
  { stepNumber: 2, passed: true, completedAt: new Date("2026-05-01T12:30:00.000Z"), submissionSha256: "h2" },
  { stepNumber: 3, passed: true, completedAt: new Date("2026-05-01T13:00:00.000Z"), submissionSha256: "h3" },
];

function mockCompletedProject(opts: { snapshots?: unknown[] } = {}) {
  projectsFindFirst.mockResolvedValue(PROJECT);
  userProgressFindFirst.mockResolvedValue(PROGRESS);
  projectStepsFindMany.mockResolvedValue(STEPS);
  userStepCompletionsFindMany.mockResolvedValue(COMPLETIONS);
  snapshotsFindMany.mockResolvedValue(opts.snapshots ?? []);
}

async function buildApp() {
  const router = (await import("./user-portfolio-artifact")).default;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() }; next(); });
  app.use(router);
  return app;
}

function get(app: express.Express, slug = SLUG) {
  return request(app).get(`/user/projects/${slug}/portfolio-artifact`);
}

beforeEach(() => {
  for (const m of [projectsFindFirst, userProgressFindFirst, projectStepsFindMany, userStepCompletionsFindMany, snapshotsFindMany]) m.mockReset();
  getCurrentUserMock.mockReset().mockResolvedValue(TEST_USER);
});

describe("GET /user/projects/:slug/portfolio-artifact — access control", () => {
  it("401 when there is no authenticated user", async () => {
    getCurrentUserMock.mockResolvedValueOnce(null);
    const r = await get(await buildApp());
    expect(r.status).toBe(401);
  });

  it("404 (not 403) for a hidden/unknown project — no existence leak", async () => {
    projectsFindFirst.mockResolvedValue(undefined); // not visible / not found
    const r = await get(await buildApp());
    expect(r.status).toBe(404);
  });

  it("404 when the user is not enrolled in the project", async () => {
    projectsFindFirst.mockResolvedValue(PROJECT);
    userProgressFindFirst.mockResolvedValue(undefined);
    const r = await get(await buildApp());
    expect(r.status).toBe(404);
  });
});

describe("GET /user/projects/:slug/portfolio-artifact — bundle", () => {
  it("returns the deterministic file bundle for a completed project", async () => {
    mockCompletedProject();
    const r = await get(await buildApp());
    expect(r.status).toBe(200);
    expect(r.body.projectSlug).toBe(SLUG);
    expect(typeof r.body.generatedAt).toBe("string");
    expect(Object.keys(r.body.files).sort()).toEqual([
      "LEARNER_REFLECTION_TEMPLATE.md",
      "LIMITATIONS.md",
      "README.md",
      "VALIDATION_EVIDENCE.md",
    ]);
    expect(r.body.files["README.md"]).toContain("Semantic layer with dbt and DuckDB");
    expect(r.body.files["VALIDATION_EVIDENCE.md"]).toMatch(/\| 2 \|.*`sql_resultset` \|.*\| server-graded \|/);
  });

  it("includes the allowed Atlas verification statement", async () => {
    mockCompletedProject();
    const r = await get(await buildApp());
    const all = Object.values(r.body.files).join("\n");
    expect(all).toContain("Atlas verified that submitted runtime output or artifacts matched the enabled");
  });

  it("does NOT leak validationConfig / expectedRows / answer keys / secrets", async () => {
    mockCompletedProject();
    const r = await get(await buildApp());
    const all = JSON.stringify(r.body).toLowerCase();
    for (const token of [
      "validationconfig", "expectedrows", "expectedrowshash", "servergrade",
      "one_current", "overlap", "secretval", "select ", "spec\"",
    ]) {
      expect(all).not.toContain(token);
    }
  });

  it("passes the CANONICAL honest-claim guard with zero hits", async () => {
    mockCompletedProject();
    const r = await get(await buildApp());
    const all = Object.values(r.body.files).join("\n\n");
    expect(findBannedClaims(all)).toEqual([]);
  });

  it("degrades honestly when no submission snapshot exists", async () => {
    mockCompletedProject({ snapshots: [] });
    const r = await get(await buildApp());
    expect(r.body.files["LIMITATIONS.md"]).toContain("not included");
  });
});
