/**
 * Tests for the search/language/total-count behaviour added to GET /projects.
 * The route mixes a drizzle relational query with a raw COUNT(*); we mock
 * both and assert that the parameters are wired and the response shape is
 * preserved.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const projectsFindMany = vi.fn();
const domainsFindFirst = vi.fn();
const executeSpy = vi.fn();
const lastFindManyArgs = { value: null as any };

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      projects: {
        findMany: (...a: unknown[]) => {
          lastFindManyArgs.value = a[0];
          return projectsFindMany(...a);
        },
      },
      domains: { findFirst: (...a: unknown[]) => domainsFindFirst(...a) },
    },
    execute: (...a: unknown[]) => executeSpy(...a),
  },
  projects: {
    id: "id", slug: "slug", title: "title",
    shortDescription: "shortDescription", language: "language",
    domainId: "domainId", difficultyLevel: "difficultyLevel", isPremium: "isPremium",
    deletedAt: "deletedAt",
  },
  projectSteps: {}, projectHints: {}, domains: { slug: "slug" }, projectSolutions: {},
  userProgress: {}, userStepCompletions: {},
}));

// We mock requireAuth/getCurrentUser even though /projects is public — other
// routes in the same router need them.
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
  isNull: (a: unknown) => ({ isNull: a }),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...vals: unknown[]) => ({ strings, vals }),
    {},
  ),
}));

async function buildApp() {
  const router = (await import("./projects")).default;
  const app = express();
  app.use((req, _res, next) => {
    (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  });
  app.use(router);
  return app;
}

beforeEach(() => {
  projectsFindMany.mockReset().mockResolvedValue([]);
  domainsFindFirst.mockReset().mockResolvedValue(undefined);
  executeSpy.mockReset().mockResolvedValue({ rows: [{ c: 0 }] });
  lastFindManyArgs.value = null;
});

function whereContains(needle: string): boolean {
  const where = lastFindManyArgs.value?.where;
  if (typeof where !== "function") return false;
  // Reproduce what drizzle does at runtime: call the predicate with the table
  // alias and the helper bag we mocked. Our mocks return tagged objects so we
  // can stringify and inspect them.
  const helpers = {
    and: (...a: unknown[]) => ({ and: a }),
    eq: (...a: unknown[]) => ({ eq: a }),
    isNull: (a: unknown) => ({ isNull: a }),
    or: (...a: unknown[]) => ({ or: a }),
    ilike: (col: unknown, pat: unknown) => ({ ilike: [col, pat] }),
  } as any;
  const table = new Proxy({}, { get: (_t, k) => `col(${String(k)})` });
  return JSON.stringify(where(table, helpers)).includes(needle);
}

describe("GET /projects", () => {
  it("returns total from COUNT(*), not the page length", async () => {
    projectsFindMany.mockResolvedValue([{
      id: "p1", slug: "x", title: "X", shortDescription: "x", difficultyLevel: "beginner",
      isPremium: false, xpReward: 100, estimatedMinutes: 60, totalSteps: 1,
      enrolledCount: 0, completionRate: 0, tags: [], orderIndex: 1,
    }]);
    executeSpy.mockResolvedValue({ rows: [{ c: 42 }] });
    const app = await buildApp();
    const res = await request(app).get("/projects?limit=1&page=1");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(42);
    expect(res.body.hasMore).toBe(true);
  });

  it("applies the search filter via ILIKE on title and short_description", async () => {
    const app = await buildApp();
    const res = await request(app).get("/projects?search=spark");
    expect(res.status).toBe(200);
    expect(whereContains("ilike")).toBe(true);
    // The escaped pattern is interpolated into the COUNT(*) template — it
    // may be nested in a sub-sql`` fragment, so check the whole call tree.
    const execCall = executeSpy.mock.calls[0]?.[0];
    expect(JSON.stringify(execCall)).toContain("%spark%");
  });

  it("escapes ILIKE wildcards so users can't pattern-match everything", async () => {
    const app = await buildApp();
    await request(app).get("/projects?search=%25");
    const execCall = executeSpy.mock.calls[0]?.[0];
    // Escaped percent should appear as \% (JSON-escaped to \\%), not as bare %.
    expect(JSON.stringify(execCall)).toContain("\\\\%");
  });

  it("applies the language filter only for python/sql", async () => {
    const app = await buildApp();
    await request(app).get("/projects?language=python");
    expect(whereContains("col(language)")).toBe(true);

    projectsFindMany.mockClear();
    lastFindManyArgs.value = null;
    await request(app).get("/projects?language=ruby");
    expect(whereContains("col(language)")).toBe(false);
  });
});
