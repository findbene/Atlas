/**
 * Phase 10 — Regression tests proving the learner-facing taxonomy is
 * the 9 Atlas courses, sourced from `projects.course`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const findMany = vi.fn();
const eqCalls: Array<{ col: unknown; val: unknown }> = [];
const andCalls: Array<unknown[]> = [];

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => {
    const marker = { __op: "eq", col, val };
    eqCalls.push({ col, val });
    return marker;
  },
  and: (...args: unknown[]) => {
    andCalls.push(args);
    return { __op: "and", args };
  },
  asc: (col: unknown) => ({ __op: "asc", col }),
}));

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      projects: { findMany: (...a: unknown[]) => findMany(...a) },
    },
  },
  projects: {
    course: { __col: "course" },
    learnerVisible: { __col: "learner_visible" },
    orderIndex: { __col: "order_index" },
    difficultyLevel: { __col: "difficulty_level" },
  },
}));

import coursesRouter from "./courses";

function makeApp() {
  const app = express();
  app.use((req, _res, next) => {
    (req as unknown as { log: { error: () => void } }).log = { error: () => {} };
    next();
  });
  app.use("/api", coursesRouter);
  return app;
}

beforeEach(() => {
  findMany.mockReset();
  eqCalls.length = 0;
  andCalls.length = 0;
});

describe("GET /api/courses", () => {
  it("returns exactly 9 courses (Atlas taxonomy)", async () => {
    findMany.mockResolvedValue([]);
    const res = await request(makeApp()).get("/api/courses");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(9);
    const slugs = res.body.map((c: { slug: string }) => c.slug).sort();
    expect(slugs).toEqual([
      "ai-engineer",
      "analytics-engineer",
      "applied-llm-engineer",
      "cloud-data-engineer",
      "data-engineering",
      "data-scientist",
      "mlops-engineer",
      "python-libraries",
      "sql",
    ]);
  });

  it("aggregates project counts FROM projects.course (not domain heuristic)", async () => {
    findMany.mockResolvedValue([
      { course: "data-engineering", courseSource: "authored" },
      { course: "data-engineering", courseSource: "heuristic_legacy" },
      { course: "ai-engineer", courseSource: "authored" },
      { course: "sql", courseSource: "authored" },
    ]);
    const res = await request(makeApp()).get("/api/courses");
    expect(res.status).toBe(200);
    const byCourse = Object.fromEntries(
      res.body.map((c: { slug: string; projectCount: number; authoredCount: number; status: string }) =>
        [c.slug, { total: c.projectCount, authored: c.authoredCount, status: c.status }]),
    );
    expect(byCourse["data-engineering"]).toEqual({ total: 2, authored: 1, status: "active" });
    expect(byCourse["ai-engineer"]).toEqual({ total: 1, authored: 1, status: "active" });
    expect(byCourse["sql"]).toEqual({ total: 1, authored: 1, status: "active" });
    // Courses with 0 projects are coming_soon, not hidden.
    expect(byCourse["mlops-engineer"]).toEqual({ total: 0, authored: 0, status: "coming_soon" });
  });

  it("only counts learner_visible=true projects (exact predicate)", async () => {
    findMany.mockResolvedValue([]);
    await request(makeApp()).get("/api/courses");
    expect(findMany).toHaveBeenCalledTimes(1);
    // Exactly one eq() call: learner_visible = true. NOT a domain join.
    expect(eqCalls).toHaveLength(1);
    expect(eqCalls[0]).toEqual({ col: { __col: "learner_visible" }, val: true });
  });
});

describe("GET /api/courses/:slug", () => {
  it("rejects unknown course slugs with 404 (the 9-course allowlist)", async () => {
    const res = await request(makeApp()).get("/api/courses/not-a-course");
    expect(res.status).toBe(404);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns course detail with projects for a valid slug", async () => {
    findMany.mockResolvedValue([
      {
        id: "p1", slug: "rag-pipeline", title: "RAG Pipeline",
        shortDescription: "Build a RAG.", difficultyLevel: "intermediate",
        isPremium: false, xpReward: 500, estimatedMinutes: 240, totalSteps: 5,
        enrolledCount: 0, completionRate: 0, tags: ["rag"], orderIndex: 1,
        jobOutcomes: null, course: "ai-engineer", courseSource: "authored",
      },
    ]);
    const res = await request(makeApp()).get("/api/courses/ai-engineer");
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe("ai-engineer");
    expect(res.body.projectCount).toBe(1);
    expect(res.body.authoredCount).toBe(1);
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0].slug).toBe("rag-pipeline");
  });

  it("detail route filters by (course=slug AND learner_visible=true) and orders by orderIndex", async () => {
    findMany.mockResolvedValue([]);
    await request(makeApp()).get("/api/courses/ai-engineer");
    expect(findMany).toHaveBeenCalledTimes(1);
    // Two eq() calls AND-ed together: course=ai-engineer + learner_visible=true.
    expect(eqCalls).toEqual([
      { col: { __col: "course" }, val: "ai-engineer" },
      { col: { __col: "learner_visible" }, val: true },
    ]);
    expect(andCalls).toHaveLength(1);
    // orderBy asc(orderIndex) is wired (deterministic learner ordering).
    const call = findMany.mock.calls[0][0] as { orderBy: Array<{ __op: string; col: unknown }> };
    expect(call.orderBy).toEqual([{ __op: "asc", col: { __col: "order_index" } }]);
  });
});

// Phase 16 — Difficulty filter behavior on GET /api/courses/:slug.
describe("GET /api/courses/:slug — Phase 16 difficulty filter", () => {
  it("rejects unknown difficulty with 400 and does not query the DB", async () => {
    const res = await request(makeApp()).get("/api/courses/ai-engineer?difficulty=wizard");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid difficulty");
    expect(findMany).not.toHaveBeenCalled();
  });

  it("rejects the legacy `expert` value with 400 (not a learner-facing tier)", async () => {
    const res = await request(makeApp()).get("/api/courses/ai-engineer?difficulty=expert");
    expect(res.status).toBe(400);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("with no difficulty param uses the existing 2-predicate WHERE (regression)", async () => {
    findMany.mockResolvedValue([]);
    await request(makeApp()).get("/api/courses/ai-engineer");
    expect(eqCalls).toHaveLength(2);
    expect(eqCalls).toEqual([
      { col: { __col: "course" }, val: "ai-engineer" },
      { col: { __col: "learner_visible" }, val: true },
    ]);
  });

  for (const level of ["beginner", "intermediate", "advanced"] as const) {
    it(`difficulty=${level} adds a third eq() predicate for difficulty_level=${level}`, async () => {
      findMany.mockResolvedValue([]);
      const res = await request(makeApp()).get(`/api/courses/ai-engineer?difficulty=${level}`);
      expect(res.status).toBe(200);
      expect(eqCalls).toHaveLength(3);
      expect(eqCalls[0]).toEqual({ col: { __col: "course" }, val: "ai-engineer" });
      expect(eqCalls[1]).toEqual({ col: { __col: "learner_visible" }, val: true });
      expect(eqCalls[2]).toEqual({ col: { __col: "difficulty_level" }, val: level });
    });
  }

  it("learner_visible=true is preserved when filtering by difficulty (hidden rows never leak)", async () => {
    findMany.mockResolvedValue([]);
    await request(makeApp()).get("/api/courses/data-engineering?difficulty=beginner");
    const learnerVisiblePred = eqCalls.find(c => (c.col as { __col: string }).__col === "learner_visible");
    expect(learnerVisiblePred).toEqual({ col: { __col: "learner_visible" }, val: true });
  });

  it("response shape stays public — no anchor/internal flags leak", async () => {
    findMany.mockResolvedValue([
      {
        id: "p1", slug: "x", title: "X", shortDescription: "x",
        difficultyLevel: "beginner", isPremium: false, xpReward: 100,
        estimatedMinutes: 60, totalSteps: 2, enrolledCount: 0,
        completionRate: 0, tags: [], orderIndex: 1, jobOutcomes: null,
        course: "sql", courseSource: "authored",
        // Internal fields below — must NOT appear in the response.
        isAnchor: true, learnerVisible: true,
      },
    ]);
    const res = await request(makeApp()).get("/api/courses/sql?difficulty=beginner");
    expect(res.status).toBe(200);
    const project = res.body.projects[0];
    expect(project).not.toHaveProperty("isAnchor");
    expect(project).not.toHaveProperty("is_anchor");
    expect(project).not.toHaveProperty("learnerVisible");
    expect(project).not.toHaveProperty("learner_visible");
    expect(project).not.toHaveProperty("courseSource");
  });
});
