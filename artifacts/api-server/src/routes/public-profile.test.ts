/**
 * Tests for GET /api/u/:username. This is the only un-authed endpoint that
 * surfaces user-attributed data, so the contract worth locking in is:
 *   - bad usernames are rejected at the input layer (no DB hit)
 *   - missing users return 404 without leaking schema details
 *   - completed-project badges hide soft-deleted projects
 *   - private fields (email, clerkId, tier) are never serialised
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const usersFindFirst = vi.fn();
const projectsFindMany = vi.fn();
const userProgressFindMany = vi.fn();
const userXpFindFirst = vi.fn();
const userStreaksFindFirst = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      users: { findFirst: (...a: unknown[]) => usersFindFirst(...a) },
      projects: { findMany: (...a: unknown[]) => projectsFindMany(...a) },
      userProgress: { findMany: (...a: unknown[]) => userProgressFindMany(...a) },
      userXp: { findFirst: (...a: unknown[]) => userXpFindFirst(...a) },
      userStreaks: { findFirst: (...a: unknown[]) => userStreaksFindFirst(...a) },
    },
  },
  users: { username: "username", deletedAt: "deletedAt" },
  userProgress: { userId: "userId", status: "status", completedAt: "completedAt" },
  userXp: { userId: "userId" },
  userStreaks: { userId: "userId" },
  projects: { id: "id", deletedAt: "deletedAt" },
}));

vi.mock("drizzle-orm", () => ({
  and: (...a: unknown[]) => ({ and: a }),
  eq: (...a: unknown[]) => ({ eq: a }),
  desc: (...a: unknown[]) => ({ desc: a }),
  isNull: (a: unknown) => ({ isNull: a }),
  inArray: (a: unknown, b: unknown) => ({ inArray: [a, b] }),
}));

async function buildApp() {
  const router = (await import("./public-profile")).default;
  const app = express();
  app.use((req, _res, next) => {
    (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  });
  app.use(router);
  return app;
}

beforeEach(() => {
  usersFindFirst.mockReset();
  projectsFindMany.mockReset();
  userProgressFindMany.mockReset().mockResolvedValue([]);
  userXpFindFirst.mockReset().mockResolvedValue(undefined);
  userStreaksFindFirst.mockReset().mockResolvedValue(undefined);
});

describe("GET /u/:username", () => {
  it("rejects bad usernames at the input layer", async () => {
    const app = await buildApp();
    const res = await request(app).get("/u/has spaces");
    expect(res.status).toBe(400);
    expect(usersFindFirst).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown users without leaking schema", async () => {
    usersFindFirst.mockResolvedValue(undefined);
    const app = await buildApp();
    const res = await request(app).get("/u/ghost");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Profile not found");
  });

  it("returns the public profile shape — and never leaks private fields", async () => {
    usersFindFirst.mockResolvedValue({
      id: "u1", username: "alice", name: "Alice", bio: "hi", avatarUrl: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    userProgressFindMany.mockResolvedValue([
      { projectId: "p1", completedAt: new Date("2026-05-10T00:00:00Z") },
    ]);
    projectsFindMany.mockResolvedValue([
      { id: "p1", slug: "spark", title: "Spark", difficultyLevel: "intermediate", xpReward: 600, jobOutcomes: { roles: ["Data Engineer"] } },
    ]);
    userXpFindFirst.mockResolvedValue({ totalXp: 1500, level: 4 });
    userStreaksFindFirst.mockResolvedValue({ currentStreak: 3, longestStreak: 7 });

    const app = await buildApp();
    const res = await request(app).get("/u/alice");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      username: "alice", displayName: "Alice",
      totalXp: 1500, level: 4,
      currentStreak: 3, longestStreak: 7,
      completedCount: 1,
    });
    expect(res.body.badges).toHaveLength(1);
    expect(res.body.badges[0]).toMatchObject({
      projectSlug: "spark", projectTitle: "Spark",
      topRole: "Data Engineer", xpReward: 600,
    });
    // Sanity: no PII leaks.
    for (const k of ["email", "clerkId", "tier", "subscriptionTier", "stripeCustomerId"]) {
      expect(res.body[k]).toBeUndefined();
    }
  });

  it("filters soft-deleted projects out of badges", async () => {
    usersFindFirst.mockResolvedValue({
      id: "u1", username: "alice", name: "Alice", bio: null, avatarUrl: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    userProgressFindMany.mockResolvedValue([
      { projectId: "p1", completedAt: new Date() },
      { projectId: "p2-deleted", completedAt: new Date() },
    ]);
    // The route's `projects.findMany` will be called with an isNull(deletedAt)
    // clause — simulate that by returning only the live project.
    projectsFindMany.mockResolvedValue([
      { id: "p1", slug: "spark", title: "Spark", difficultyLevel: "intermediate", xpReward: 600, jobOutcomes: null },
    ]);
    const app = await buildApp();
    const res = await request(app).get("/u/alice");
    expect(res.status).toBe(200);
    // completedCount still reflects raw history; badges hide the deleted one.
    expect(res.body.completedCount).toBe(2);
    expect(res.body.badges.map((b: any) => b.projectSlug)).toEqual(["spark"]);
    // Confirm the route passed the deletedAt-is-null predicate when looking
    // up projects. `where` is a callback in this route; invoke it with proxy
    // helpers to capture which predicates fired.
    const whereFn = projectsFindMany.mock.calls[0]?.[0]?.where as (
      p: unknown,
      h: { and: Function; inArray: Function; isNull: Function },
    ) => unknown;
    expect(typeof whereFn).toBe("function");
    const helpers = {
      and: (...a: unknown[]) => ({ and: a }),
      inArray: (col: unknown, vals: unknown) => ({ inArray: [col, vals] }),
      isNull: (a: unknown) => ({ isNull: a }),
    };
    const table = new Proxy({}, { get: (_t, k) => `col(${String(k)})` });
    const predicate = whereFn(table, helpers as any);
    expect(JSON.stringify(predicate)).toContain("isNull");
    expect(JSON.stringify(predicate)).toContain("col(deletedAt)");
  });
});
