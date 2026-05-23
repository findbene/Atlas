/**
 * Phase 21 — GET /api/dashboard.
 *
 * Pins:
 *   - 401 anonymous.
 *   - Fresh learner (zero enrollments) → empty lists + recommendedStartHere
 *     for data-engineering when beginner exists.
 *   - In-progress + completed lists honor learner_visible (hidden enrollments
 *     are silently dropped — no leak).
 *   - Resume = most-recently-updated in-progress row.
 *   - No recommendedStartHere when learner has any enrollments.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction, type RequestHandler } from "express";
import request from "supertest";

const userProgressFindMany = vi.fn();
const projectsFindMany = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      userProgress: { findMany: (...a: unknown[]) => userProgressFindMany(...a) },
      projects: { findMany: (...a: unknown[]) => projectsFindMany(...a) },
    },
  },
  projects: { learnerVisible: "learnerVisible", course: "course" },
  userProgress: { userId: "userId" },
}));

let currentUser: { id: string } | null = null;
const requireAuth: RequestHandler = (req, res, next) => {
  if (!currentUser) { res.status(401).json({ error: "Unauthorized" }); return; }
  (req as Request & { localUser?: typeof currentUser }).localUser = currentUser;
  next();
};
vi.mock("../lib/auth", () => ({
  requireAuth,
  getCurrentUser: vi.fn(async () => currentUser),
}));

vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ eq: a }),
  and: (...a: unknown[]) => ({ and: a }),
  desc: (...a: unknown[]) => ({ desc: a }),
}));

async function buildApp() {
  const router = (await import("./dashboard")).default;
  const app = express();
  app.use(express.json());
  const fakeLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  app.use(((req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as { log: typeof fakeLog }).log = fakeLog;
    next();
  }) as RequestHandler);
  app.use(router);
  return app;
}

const visibleProj = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "p-csv",
  slug: "csv-to-postgres-pipeline",
  title: "CSV → Postgres Pipeline",
  shortDescription: "Build it.",
  course: "data-engineering",
  difficultyLevel: "intermediate",
  totalSteps: 4,
  estimatedMinutes: 180,
  isPremium: false,
  xpReward: 400,
  enrolledCount: 100,
  completionRate: 50,
  tags: [],
  orderIndex: 0,
  ...over,
});

beforeEach(() => {
  currentUser = { id: "u-1" };
  userProgressFindMany.mockReset().mockResolvedValue([]);
  projectsFindMany.mockReset().mockResolvedValue([]);
});

describe("GET /api/dashboard", () => {
  it("returns 401 when anonymous", async () => {
    currentUser = null;
    const app = await buildApp();
    expect((await request(app).get("/dashboard")).status).toBe(401);
  });

  it("fresh learner: empty lists + recommendedStartHere for data-engineering", async () => {
    userProgressFindMany.mockResolvedValueOnce([]);
    projectsFindMany.mockResolvedValueOnce([
      visibleProj({ slug: "sql-essentials", title: "SQL Essentials", difficultyLevel: "beginner", estimatedMinutes: 60 }),
      visibleProj({ slug: "csv-to-postgres-pipeline", difficultyLevel: "advanced" }),
    ]);
    const app = await buildApp();
    const res = await request(app).get("/dashboard");
    expect(res.status).toBe(200);
    expect(res.body.inProgress).toEqual([]);
    expect(res.body.completed).toEqual([]);
    expect(res.body.resume).toBeNull();
    expect(res.body.recommendedStartHere).toMatchObject({
      courseSlug: "data-engineering",
      startHere: { kind: "start_here", reasonKey: "beginner_available" },
    });
    expect(res.body.recommendedStartHere.startHere.project.slug).toBe("sql-essentials");
  });

  it("excludes hidden enrollments from inProgress (no leak)", async () => {
    userProgressFindMany.mockResolvedValueOnce([
      { projectId: "p-visible", status: "in_progress", currentStep: 2, completionPercent: 25,
        startedAt: new Date("2026-01-01"), lastUpdatedAt: new Date("2026-01-05"), completedAt: null },
      { projectId: "p-hidden", status: "in_progress", currentStep: 1, completionPercent: 0,
        startedAt: new Date("2026-01-02"), lastUpdatedAt: new Date("2026-01-06"), completedAt: null },
    ]);
    // The visible filter excludes p-hidden — only p-visible comes back.
    projectsFindMany.mockResolvedValueOnce([visibleProj({ id: "p-visible" })]);
    const app = await buildApp();
    const res = await request(app).get("/dashboard");
    expect(res.body.inProgress).toHaveLength(1);
    expect(res.body.inProgress[0].projectId).toBe("p-visible");
    // recommendedStartHere is null when learner has any visible enrollment.
    expect(res.body.recommendedStartHere).toBeNull();
  });

  it("resume = most-recently-updated in-progress visible row", async () => {
    userProgressFindMany.mockResolvedValueOnce([
      { projectId: "p-a", status: "in_progress", currentStep: 1, completionPercent: 10,
        startedAt: new Date("2026-02-01"), lastUpdatedAt: new Date("2026-02-10"), completedAt: null },
      { projectId: "p-b", status: "in_progress", currentStep: 4, completionPercent: 80,
        startedAt: new Date("2026-02-02"), lastUpdatedAt: new Date("2026-02-05"), completedAt: null },
    ]);
    projectsFindMany.mockResolvedValueOnce([
      visibleProj({ id: "p-a", slug: "alpha", title: "Alpha" }),
      visibleProj({ id: "p-b", slug: "beta", title: "Beta" }),
    ]);
    const app = await buildApp();
    const res = await request(app).get("/dashboard");
    expect(res.body.resume.projectSlug).toBe("alpha");
    expect(res.body.resume.currentStep).toBe(1);
  });

  it("completed enrollments land in completed[], not inProgress[]", async () => {
    userProgressFindMany.mockResolvedValueOnce([
      { projectId: "p-c", status: "completed", currentStep: 4, completionPercent: 100,
        startedAt: new Date("2026-01-01"), lastUpdatedAt: new Date("2026-01-20"), completedAt: new Date("2026-01-20") },
    ]);
    projectsFindMany.mockResolvedValueOnce([visibleProj({ id: "p-c" })]);
    const app = await buildApp();
    const res = await request(app).get("/dashboard");
    expect(res.body.inProgress).toEqual([]);
    expect(res.body.completed).toHaveLength(1);
    expect(res.body.completed[0].status).toBe("completed");
    expect(res.body.resume).toBeNull();
    // recommendedStartHere is null because learner has a (completed) enrollment.
    expect(res.body.recommendedStartHere).toBeNull();
  });
});
