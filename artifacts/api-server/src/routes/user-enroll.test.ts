/**
 * Phase 40 — Direct counter-write tests for the LEGACY enrollment route
 * (`POST /api/user/projects/:projectId/enroll`).
 *
 * Phase 39 added the durable `enrolled_count` writer to BOTH the Phase-21
 * slug-based route (covered by `enrollment.test.ts`) and this UUID-based
 * legacy route, but only added unit-test coverage for the Phase-21 one.
 * The writer is byte-identical between the two, but architect feedback
 * (Phase 39 close) flagged the legacy route as a coverage gap.
 *
 * This file proves directly:
 *   1. First enrollment increments `projects.enrolled_count` exactly once.
 *   2. Idempotent re-enroll does NOT call `update` (returns the existing row).
 *
 * Scope is intentionally narrow: only the two counter behaviors. Other
 * legacy-route concerns (XP, streaks, email) are not exercised here.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction, type RequestHandler } from "express";
import request from "supertest";

const projectsFindFirst = vi.fn();
const userProgressFindFirst = vi.fn();
const insertReturning = vi.fn();
const insertValues = vi.fn(() => ({ returning: insertReturning }));
const insertFn = vi.fn(() => ({ values: insertValues }));
const updateWhere = vi.fn(async () => undefined);
const updateSet = vi.fn(() => ({ where: updateWhere }));
const updateFn = vi.fn(() => ({ set: updateSet }));

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      projects: { findFirst: (...a: unknown[]) => projectsFindFirst(...a) },
      userProgress: { findFirst: (...a: unknown[]) => userProgressFindFirst(...a) },
      // Stubs for symbols touched only by *other* routes in user.ts (router
      // loads them at import-time but they're never called by /enroll).
      userXp: { findFirst: vi.fn() },
      userStreaks: { findFirst: vi.fn() },
      xpTransactions: { findFirst: vi.fn() },
      projectSteps: { findFirst: vi.fn() },
      userStepCompletions: { findFirst: vi.fn() },
      users: { findFirst: vi.fn() },
    },
    insert: (_table: unknown) => insertFn(),
    update: (_table: unknown) => updateFn(),
  },
  users: {},
  userProgress: { userId: "userId", projectId: "projectId" },
  userXp: {},
  userStreaks: {},
  xpTransactions: {},
  projects: { id: "id", slug: "slug", enrolledCount: "enrolled_count" },
  projectSteps: {},
  userStepCompletions: {},
}));

let currentUser: { id: string; subscriptionTier: "free" | "pro" } | null = null;
const requireAuth: RequestHandler = (req, res, next) => {
  if (!currentUser) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
};

vi.mock("../lib/auth", () => ({
  requireAuth,
  getCurrentUser: vi.fn(async () => currentUser),
  getOrCreateUser: vi.fn(async () => currentUser),
}));

vi.mock("@clerk/express", () => ({
  getAuth: vi.fn(() => ({ userId: currentUser?.id ?? null })),
}));

vi.mock("../lib/email", () => ({
  sendEmail: vi.fn(),
  renderProjectCompletionEmail: vi.fn(),
}));

vi.mock("../lib/streak", () => ({ bumpStreak: vi.fn() }));
vi.mock("../lib/grading", () => ({ gradeSubmission: vi.fn() }));

vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ eq: a }),
  and: (...a: unknown[]) => ({ and: a }),
  asc: (...a: unknown[]) => ({ asc: a }),
  desc: (...a: unknown[]) => ({ desc: a }),
  isNull: (...a: unknown[]) => ({ isNull: a }),
  ne: (...a: unknown[]) => ({ ne: a }),
  sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({ sql: { strings: [...strings], vals } }),
}));

async function buildApp() {
  const router = (await import("./user")).default;
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    // Minimal pino-shaped stub — full BaseLogger is not needed for these tests.
    (req as unknown as { log: unknown }).log = {
      warn: () => {}, error: () => {}, info: () => {}, debug: () => {}, trace: () => {}, fatal: () => {},
    };
    next();
  });
  app.use("/api", router);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "u-1", subscriptionTier: "free" };
  projectsFindFirst.mockReset();
  userProgressFindFirst.mockReset();
  insertReturning.mockReset();
  insertValues.mockClear();
  insertFn.mockClear();
  updateWhere.mockClear();
  updateWhere.mockResolvedValue(undefined);
  updateSet.mockClear();
  updateFn.mockClear();
});

describe("POST /api/user/projects/:projectId/enroll (legacy UUID route) — Phase 40 counter coverage", () => {
  it("[P40] first enrollment increments projects.enrolled_count exactly once", async () => {
    projectsFindFirst.mockResolvedValueOnce({
      id: "p-1", slug: "csv-to-postgres-pipeline", isPremium: false,
    });
    userProgressFindFirst.mockResolvedValueOnce(undefined);
    insertReturning.mockResolvedValueOnce([{
      id: "prog-1", projectId: "p-1", userId: "u-1", status: "in_progress", currentStep: 1,
    }]);
    const app = await buildApp();
    const res = await request(app).post("/api/user/projects/p-1/enroll").send({});
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("prog-1");
    expect(updateFn).toHaveBeenCalledTimes(1);
    expect(updateSet).toHaveBeenCalledTimes(1);
    expect(updateWhere).toHaveBeenCalledTimes(1);
  });

  it("[P40] idempotent re-enroll does NOT increment enrolled_count", async () => {
    projectsFindFirst.mockResolvedValueOnce({
      id: "p-1", slug: "csv-to-postgres-pipeline", isPremium: false,
    });
    userProgressFindFirst.mockResolvedValueOnce({
      id: "prog-existing", projectId: "p-1", userId: "u-1", status: "in_progress", currentStep: 3,
    });
    const app = await buildApp();
    const res = await request(app).post("/api/user/projects/p-1/enroll").send({});
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("prog-existing");
    expect(insertFn).not.toHaveBeenCalled();
    expect(updateFn).not.toHaveBeenCalled();
  });
});
