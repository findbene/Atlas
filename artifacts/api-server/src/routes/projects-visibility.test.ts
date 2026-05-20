/**
 * Phase 10 — learner-facing visibility filter regression.
 *
 * Pins:
 *   - `GET /projects` excludes rows where `learner_visible = false`
 *     (drizzle relational `where` predicate AND the COUNT(*) SQL).
 *   - `GET /projects/:slug` returns 404 (NOT 403) for hidden rows, so
 *     hidden-slug existence isn't leaked to learners.
 *   - Admin route surfaces `hiddenCount` + `hiddenSlugs`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction, type RequestHandler } from "express";
import request from "supertest";

const projectsFindMany = vi.fn();
const projectsFindFirst = vi.fn();
const stepsFindMany = vi.fn();
const domainsFindFirst = vi.fn();
const executeSpy = vi.fn();
const lastFindManyArgs = { value: null as any };

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      projects: {
        findMany: (...a: unknown[]) => { lastFindManyArgs.value = a[0]; return projectsFindMany(...a); },
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

async function buildProjectsApp() {
  const router = (await import("./projects")).default;
  const app = express();
  app.use((req, _res, next) => {
    (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  });
  app.use(router);
  return app;
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

function wherePredicateFor(): unknown {
  const where = lastFindManyArgs.value?.where;
  if (typeof where !== "function") return null;
  const helpers = {
    and: (...a: unknown[]) => ({ and: a }),
    eq: (...a: unknown[]) => ({ eq: a }),
    isNull: (a: unknown) => ({ isNull: a }),
    or: (...a: unknown[]) => ({ or: a }),
    ilike: (col: unknown, pat: unknown) => ({ ilike: [col, pat] }),
  } as any;
  const table = new Proxy({}, { get: (_t, k) => `col(${String(k)})` });
  return where(table, helpers);
}

beforeEach(() => {
  projectsFindMany.mockReset().mockResolvedValue([]);
  projectsFindFirst.mockReset().mockResolvedValue(undefined);
  stepsFindMany.mockReset().mockResolvedValue([]);
  domainsFindFirst.mockReset().mockResolvedValue(undefined);
  executeSpy.mockReset().mockResolvedValue({ rows: [{ c: 0 }] });
  lastFindManyArgs.value = null;
});

describe("Phase 10 — learner visibility (GET /projects)", () => {
  it("constrains the list query with learnerVisible=true and learner_visible=TRUE in COUNT(*)", async () => {
    const app = await buildProjectsApp();
    await request(app).get("/projects");
    const w = JSON.stringify(wherePredicateFor());
    expect(w).toContain("col(learnerVisible)");
    const execCall = JSON.stringify(executeSpy.mock.calls[0]?.[0]);
    expect(execCall).toContain("learner_visible = TRUE");
  });
});

describe("Phase 10 — learner visibility (GET /projects/:slug)", () => {
  it("returns 404 (not 403) for a hidden project so existence isn't leaked", async () => {
    projectsFindFirst.mockResolvedValue({
      id: "p1", slug: "hidden-stub", learnerVisible: false,
      title: "x", shortDescription: "x", fullDescription: "x",
      difficultyLevel: "beginner", isPremium: false, xpReward: 0, estimatedMinutes: 0,
      totalSteps: 0, enrolledCount: 0, completionRate: 0, tags: [], orderIndex: 0,
      learningObjectives: [], prerequisites: [], domainId: "d1", course: "data-engineering",
      jobOutcomes: null, executionProfile: null, starterCodePython: null,
    });
    const app = await buildProjectsApp();
    const res = await request(app).get("/projects/hidden-stub");
    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty("title");
    expect(res.body).not.toHaveProperty("slug");
    expect(res.body.error).toBe("Not found");
  });

  it("returns 200 for a visible project (sanity)", async () => {
    projectsFindFirst.mockResolvedValue({
      id: "p1", slug: "visible", learnerVisible: true,
      title: "Visible", shortDescription: "x", fullDescription: "x",
      difficultyLevel: "beginner", isPremium: false, xpReward: 0, estimatedMinutes: 0,
      totalSteps: 0, enrolledCount: 0, completionRate: 0, tags: [], orderIndex: 0,
      learningObjectives: [], prerequisites: [], domainId: "d1", course: "data-engineering",
      jobOutcomes: null, executionProfile: null, starterCodePython: null,
    });
    const app = await buildProjectsApp();
    const res = await request(app).get("/projects/visible");
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe("visible");
  });
});

describe("Phase 10 — admin route surfaces hidden cohort", () => {
  it("reports hiddenCount and hiddenSlugs derived from learnerVisible=false rows", async () => {
    const baseProject = {
      qualityStatus: "approved", qualityBreakdown: null,
      course: "data-engineering", courseSource: "heuristic_legacy",
      orderIndex: 0, sourceCandidateId: null,
    };
    // Mock projects: one visible, two hidden.
    projectsFindMany.mockResolvedValueOnce([
      { id: "P1", slug: "visible-one",  ...baseProject, learnerVisible: true  },
      { id: "P2", slug: "archived-stub", ...baseProject, learnerVisible: false },
      { id: "P3", slug: "another-archived", ...baseProject, learnerVisible: false },
    ]);
    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.status).toBe(200);
    expect(res.body.hiddenCount).toBe(2);
    expect(res.body.hiddenSlugs).toEqual(["archived-stub", "another-archived"]);
  });
});
