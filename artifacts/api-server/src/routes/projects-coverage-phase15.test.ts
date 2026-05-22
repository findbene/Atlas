/**
 * Phase 15A — Difficulty Taxonomy Audit + Backfill Preparation.
 *
 * Phase 15A is read-only / dormant. These tests pin:
 *   - `difficultyDistribution.visible{beginner,intermediate,advanced}` exists (P14 carry-over).
 *   - `difficultyDistribution.visibleByCourse` exists per course (P15A new).
 *   - `difficultyDistribution.beginnerCoverageByCourse` exists per course (P15A new).
 *   - `difficultyDistribution.mismatchCount` exists (P15A new — always 0 in 15A).
 *   - `difficultyDistribution.mismatchSlugs` is a (currently empty) array shape (P15A new).
 *   - `anchorCount=2` unchanged; `anchorSlugs` is exactly the 2 known anchors.
 *   - `hiddenCount=32` unchanged.
 *   - Total visible 52 unchanged.
 *   - `lineageIntegrity` counters remain 0.
 *
 * NOTE: anchor immutability of the AUDIT SCRIPT (Rule 1 short-circuit) is
 * exercised by the script's own hard-assert. The admin-route layer cannot
 * call the audit, so we pin behavioral invariants here instead.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction, type RequestHandler } from "express";
import request from "supertest";

const projectsFindMany = vi.fn();
const projectsFindFirst = vi.fn();
const stepsFindMany = vi.fn();
const domainsFindFirst = vi.fn();
const executeSpy = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      projects: {
        findMany: (...a: unknown[]) => projectsFindMany(...a),
        findFirst: (...a: unknown[]) => projectsFindFirst(...a),
      },
      projectSteps: { findMany: (...a: unknown[]) => stepsFindMany(...a) },
      domains: { findFirst: (...a: unknown[]) => domainsFindFirst(...a) },
      userProgress: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(undefined) },
      userStepCompletions: { findMany: vi.fn().mockResolvedValue([]) },
      projectSolutions: { findFirst: vi.fn().mockResolvedValue(undefined) },
      projectCandidates: { findMany: vi.fn().mockResolvedValue([]) },
    },
    execute: (...a: unknown[]) => executeSpy(...a),
  },
  projects: {
    id: "id", slug: "slug", title: "title",
    shortDescription: "shortDescription", language: "language",
    domainId: "domainId", difficultyLevel: "difficultyLevel", isPremium: "isPremium",
    deletedAt: "deletedAt", learnerVisible: "learnerVisible",
  },
  projectSteps: {}, projectHints: {}, domains: { slug: "slug" }, projectSolutions: {},
  userProgress: {}, userStepCompletions: {}, projectCandidates: {},
}));

vi.mock("../lib/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAdmin: (req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { localUser?: { id: string; role: string } }).localUser = { id: "u-1", role: "admin" };
    next();
  },
  getCurrentUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ eq: a }),
  and: (...a: unknown[]) => ({ and: a }),
  desc: (...a: unknown[]) => ({ desc: a }),
  asc: (...a: unknown[]) => ({ asc: a }),
  or: (...a: unknown[]) => ({ or: a }),
  ilike: (col: unknown, pat: unknown) => ({ ilike: [col, pat] }),
  isNull: (a: unknown) => ({ isNull: a }),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...vals: unknown[]) => ({ strings, vals }),
    {},
  ),
}));

const ANCHOR_SLUGS = ["csv-to-postgres-pipeline", "dbt-data-models"] as const;
const PHASE14_HIDDEN_BASELINE = 32;
const PHASE14_VISIBLE_BASELINE = 52;

function projectRow(slug: string, learnerVisible: boolean, extra: Record<string, unknown> = {}) {
  return {
    id: `id-${slug}`,
    slug,
    learnerVisible,
    title: slug,
    shortDescription: "x",
    fullDescription: "x",
    difficultyLevel: "intermediate",
    isPremium: false,
    xpReward: 0,
    estimatedMinutes: 0,
    totalSteps: 5,
    enrolledCount: 0,
    completionRate: 0,
    tags: [],
    orderIndex: 0,
    learningObjectives: [],
    prerequisites: [],
    domainId: "d1",
    course: "data-engineering",
    courseSource: "authored",
    qualityStatus: "approved",
    qualityBreakdown: null,
    sourceCandidateId: null,
    isAnchor: false,
    jobOutcomes: null,
    executionProfile: null,
    starterCodePython: null,
    ...extra,
  };
}

async function buildAdminApp() {
  const router = (await import("./admin")).default;
  const app = express();
  app.use(((req: Request, _res: Response, next: NextFunction) => {
    (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  }) as RequestHandler);
  app.use(router);
  return app;
}

beforeEach(() => {
  projectsFindMany.mockReset().mockResolvedValue([]);
  projectsFindFirst.mockReset().mockResolvedValue(undefined);
  stepsFindMany.mockReset().mockResolvedValue([]);
  domainsFindFirst.mockReset().mockResolvedValue(undefined);
  executeSpy.mockReset().mockResolvedValue({ rows: [{ c: 0 }] });
});

describe("Phase 15A — admin route exposes per-course difficulty grid + beginner coverage", () => {
  it("difficultyDistribution.visibleByCourse is keyed by all 9 courses and aggregates only visible rows", async () => {
    const rows = [
      projectRow("sql-1", true, { course: "sql", difficultyLevel: "beginner" }),
      projectRow("sql-2", true, { course: "sql", difficultyLevel: "intermediate" }),
      projectRow("de-1", true, { course: "data-engineering", difficultyLevel: "advanced" }),
      projectRow("de-2", true, { course: "data-engineering", difficultyLevel: "advanced" }),
      projectRow("ai-1", true, { course: "ai-engineer", difficultyLevel: "advanced" }),
      // Hidden row MUST NOT appear in any visible bucket.
      projectRow("hidden", false, { course: "sql", difficultyLevel: "advanced" }),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.status).toBe(200);
    const grid = res.body.difficultyDistribution.visibleByCourse;

    // All 9 courses present as keys.
    for (const c of [
      "data-engineering", "ai-engineer", "mlops-engineer", "data-scientist",
      "analytics-engineer", "applied-llm-engineer", "cloud-data-engineer",
      "python-libraries", "sql",
    ]) {
      expect(grid).toHaveProperty(c);
      expect(grid[c]).toMatchObject({ beginner: expect.any(Number), intermediate: expect.any(Number), advanced: expect.any(Number) });
    }
    expect(grid.sql).toEqual({ beginner: 1, intermediate: 1, advanced: 0 });
    expect(grid["data-engineering"]).toEqual({ beginner: 0, intermediate: 0, advanced: 2 });
    expect(grid["ai-engineer"]).toEqual({ beginner: 0, intermediate: 0, advanced: 1 });
    expect(grid["mlops-engineer"]).toEqual({ beginner: 0, intermediate: 0, advanced: 0 });
  });

  it("difficultyDistribution.beginnerCoverageByCourse counts ONLY visible beginner rows per course", async () => {
    const rows = [
      projectRow("sql-beg", true, { course: "sql", difficultyLevel: "beginner" }),
      projectRow("py-beg", true, { course: "python-libraries", difficultyLevel: "beginner" }),
      projectRow("de-beg-1", true, { course: "data-engineering", difficultyLevel: "beginner" }),
      projectRow("de-beg-2", true, { course: "data-engineering", difficultyLevel: "beginner" }),
      projectRow("ai-hidden-beg", false, { course: "ai-engineer", difficultyLevel: "beginner" }),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    const cov = res.body.difficultyDistribution.beginnerCoverageByCourse;
    expect(cov.sql).toBe(1);
    expect(cov["python-libraries"]).toBe(1);
    expect(cov["data-engineering"]).toBe(2);
    // Hidden beginner must NOT be counted.
    expect(cov["ai-engineer"]).toBe(0);
    // Untouched courses default to 0.
    expect(cov["mlops-engineer"]).toBe(0);
    expect(cov["cloud-data-engineer"]).toBe(0);
    expect(cov["applied-llm-engineer"]).toBe(0);
  });

  it("difficultyDistribution.mismatchCount=0 and mismatchSlugs=[] in Phase 15A (dormant)", async () => {
    const rows = [
      ...ANCHOR_SLUGS.map(s => projectRow(s, true, { isAnchor: true, totalSteps: 1, difficultyLevel: "beginner" })),
      projectRow("regular-1", true, { difficultyLevel: "advanced" }),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.difficultyDistribution.mismatchCount).toBe(0);
    expect(Array.isArray(res.body.difficultyDistribution.mismatchSlugs)).toBe(true);
    expect(res.body.difficultyDistribution.mismatchSlugs).toHaveLength(0);
  });

  it("anchorCount=2 + anchorSlugs is exactly the 2 known anchors (P15A must not touch anchors)", async () => {
    const rows = [
      ...ANCHOR_SLUGS.map(s => projectRow(s, true, { isAnchor: true, totalSteps: 1, difficultyLevel: "beginner" })),
      // 3 non-anchor visible rows — none may appear in anchorSlugs.
      ...Array.from({ length: 3 }, (_, i) =>
        projectRow(`non-anchor-${i}`, true, { isAnchor: false, difficultyLevel: "advanced" }),
      ),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.anchorCount).toBe(2);
    expect(new Set(res.body.anchorSlugs)).toEqual(new Set(ANCHOR_SLUGS));
  });

  it("Phase 14 baselines unchanged: hidden=32, visible=52, lineage 0/0/0/0", async () => {
    const hidden = Array.from({ length: PHASE14_HIDDEN_BASELINE }, (_, i) =>
      projectRow(`p14-hidden-${i}`, false),
    );
    const visible = Array.from({ length: PHASE14_VISIBLE_BASELINE }, (_, i) =>
      projectRow(`p14-visible-${i}`, true, { difficultyLevel: i < 6 ? "beginner" : i < 12 ? "intermediate" : "advanced" }),
    );
    projectsFindMany.mockResolvedValueOnce([...hidden, ...visible]);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.hiddenCount).toBe(PHASE14_HIDDEN_BASELINE);
    expect(res.body.totals.projects).toBe(PHASE14_HIDDEN_BASELINE + PHASE14_VISIBLE_BASELINE);
    expect(res.body.totals.projects - res.body.hiddenCount).toBe(PHASE14_VISIBLE_BASELINE);
    expect(res.body.lineageIntegrity.mismatches).toBe(0);
    expect(res.body.lineageIntegrity.inverseMismatches).toBe(0);
    expect(res.body.lineageIntegrity.duplicateCandidatePromotions).toBe(0);
  });

  it("visible difficulty totals equal the sum of per-course grid (cross-consistency)", async () => {
    const rows = [
      projectRow("a", true, { course: "sql", difficultyLevel: "beginner" }),
      projectRow("b", true, { course: "sql", difficultyLevel: "intermediate" }),
      projectRow("c", true, { course: "python-libraries", difficultyLevel: "advanced" }),
      projectRow("d", true, { course: "data-engineering", difficultyLevel: "advanced" }),
      projectRow("e", true, { course: "data-engineering", difficultyLevel: "beginner" }),
      projectRow("f", true, { course: "ai-engineer", difficultyLevel: "advanced" }),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);
    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    const totals = res.body.difficultyDistribution.visible;
    const grid = res.body.difficultyDistribution.visibleByCourse;
    const sumOf = (k: "beginner" | "intermediate" | "advanced") =>
      Object.values(grid).reduce((acc: number, row: any) => acc + row[k], 0);
    expect(sumOf("beginner")).toBe(totals.beginner);
    expect(sumOf("intermediate")).toBe(totals.intermediate);
    expect(sumOf("advanced")).toBe(totals.advanced);
  });
});
