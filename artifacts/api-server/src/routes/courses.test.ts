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

  it("with no difficulty param uses the (course, learner_visible) predicate (regression)", async () => {
    findMany.mockResolvedValue([]);
    await request(makeApp()).get("/api/courses/ai-engineer");
    expect(eqCalls).toHaveLength(2);
    expect(eqCalls).toEqual([
      { col: { __col: "course" }, val: "ai-engineer" },
      { col: { __col: "learner_visible" }, val: true },
    ]);
  });

  // Phase 18 — difficulty filter is now applied in-memory after a single
  // unfiltered visible-set fetch, so `startHere` can reflect the full
  // course (and not change as the learner toggles filters). The SQL
  // predicate stays the 2-predicate form regardless of `?difficulty=`.
  for (const level of ["beginner", "intermediate", "advanced"] as const) {
    it(`difficulty=${level} keeps SQL at the 2-predicate form and filters in-memory (Phase 18)`, async () => {
      findMany.mockResolvedValue([
        { id: "p1", slug: "beg-a", title: "Beg A", shortDescription: "",
          difficultyLevel: "beginner", isPremium: false, xpReward: 10,
          estimatedMinutes: 60, totalSteps: 2, enrolledCount: 0,
          completionRate: 0, tags: [], orderIndex: 1, jobOutcomes: null,
          course: "ai-engineer", courseSource: "authored" },
        { id: "p2", slug: "adv-a", title: "Adv A", shortDescription: "",
          difficultyLevel: "advanced", isPremium: false, xpReward: 10,
          estimatedMinutes: 120, totalSteps: 5, enrolledCount: 0,
          completionRate: 0, tags: [], orderIndex: 2, jobOutcomes: null,
          course: "ai-engineer", courseSource: "authored" },
      ]);
      const res = await request(makeApp()).get(`/api/courses/ai-engineer?difficulty=${level}`);
      expect(res.status).toBe(200);
      // SQL stays 2-predicate: (course, learner_visible). Difficulty
      // is NEVER pushed into the SQL — it's filtered in-memory.
      expect(eqCalls).toHaveLength(2);
      expect(eqCalls[0]).toEqual({ col: { __col: "course" }, val: "ai-engineer" });
      expect(eqCalls[1]).toEqual({ col: { __col: "learner_visible" }, val: true });
      // And the in-memory filter is correct.
      for (const p of res.body.projects) expect(p.difficulty).toBe(level);
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

// Phase 18 — Start Here recommendation surface on GET /api/courses/:slug.
describe("GET /api/courses/:slug — Phase 18 Start Here", () => {
  const row = (over: Partial<Record<string, unknown>>) => ({
    id: "id", slug: "x", title: "X", shortDescription: "",
    difficultyLevel: "advanced", isPremium: false, xpReward: 10,
    estimatedMinutes: 120, totalSteps: 5, enrolledCount: 0,
    completionRate: 0, tags: [], orderIndex: 1, jobOutcomes: null,
    course: "ai-engineer", courseSource: "authored", ...over,
  });

  it("kind=start_here for a course with at least one beginner project", async () => {
    findMany.mockResolvedValue([
      row({ id: "1", slug: "adv-1", difficultyLevel: "advanced", orderIndex: 1 }),
      row({ id: "2", slug: "sql-beginner-essentials", title: "SQL Essentials",
            difficultyLevel: "beginner", estimatedMinutes: 240, orderIndex: 2 }),
    ]);
    const res = await request(makeApp()).get("/api/courses/sql");
    expect(res.status).toBe(200);
    expect(res.body.startHere).toBeTruthy();
    expect(res.body.startHere.kind).toBe("start_here");
    expect(res.body.startHere.reasonKey).toBe("beginner_available");
    expect(res.body.startHere.hasBeginner).toBe(true);
    expect(res.body.startHere.project.slug).toBe("sql-beginner-essentials");
  });

  it("kind=most_approachable_available for a zero-beginner course", async () => {
    findMany.mockResolvedValue([
      row({ id: "1", slug: "adv-hard", difficultyLevel: "advanced", estimatedMinutes: 600 }),
      row({ id: "2", slug: "adv-soft", difficultyLevel: "advanced", estimatedMinutes: 120 }),
    ]);
    const res = await request(makeApp()).get("/api/courses/ai-engineer");
    expect(res.status).toBe(200);
    expect(res.body.startHere.kind).toBe("most_approachable_available");
    expect(res.body.startHere.reasonKey).toBe("no_beginner_available");
    expect(res.body.startHere.hasBeginner).toBe(false);
    expect(res.body.startHere.project.slug).toBe("adv-soft");
  });

  it("startHere is stable across difficulty filter changes (computed from unfiltered set)", async () => {
    const rows = [
      row({ id: "1", slug: "beg-1", difficultyLevel: "beginner", estimatedMinutes: 60, orderIndex: 1 }),
      row({ id: "2", slug: "int-1", difficultyLevel: "intermediate", orderIndex: 2 }),
      row({ id: "3", slug: "adv-1", difficultyLevel: "advanced", orderIndex: 3 }),
    ];
    findMany.mockResolvedValue(rows);
    const unfiltered = await request(makeApp()).get("/api/courses/sql");
    findMany.mockResolvedValue(rows);
    const filtered = await request(makeApp()).get("/api/courses/sql?difficulty=advanced");
    expect(unfiltered.body.startHere.project.slug).toBe("beg-1");
    expect(filtered.body.startHere.project.slug).toBe("beg-1"); // still beginner!
    expect(filtered.body.projects.every((p: { difficulty: string }) => p.difficulty === "advanced")).toBe(true);
  });

  it("startHere is null when the course has zero visible projects", async () => {
    findMany.mockResolvedValue([]);
    const res = await request(makeApp()).get("/api/courses/mlops-engineer");
    expect(res.status).toBe(200);
    expect(res.body.startHere).toBeNull();
  });

  it("startHere never exposes anchor / internal flags", async () => {
    findMany.mockResolvedValue([
      row({ id: "1", slug: "beg-1", difficultyLevel: "beginner",
            // Anchor / internal fields below — must NEVER appear in startHere.
            isAnchor: true, learnerVisible: true }),
    ]);
    const res = await request(makeApp()).get("/api/courses/sql");
    expect(res.status).toBe(200);
    const sh = res.body.startHere;
    expect(sh.project).not.toHaveProperty("isAnchor");
    expect(sh.project).not.toHaveProperty("is_anchor");
    expect(sh.project).not.toHaveProperty("learnerVisible");
    expect(sh.project).not.toHaveProperty("courseSource");
    expect(sh).not.toHaveProperty("isAnchor");
  });

  it("startHere prefers approachability-signaled beginner (slug match)", async () => {
    findMany.mockResolvedValue([
      row({ id: "1", slug: "beg-zeta", title: "Zeta", difficultyLevel: "beginner",
            estimatedMinutes: 30, orderIndex: 1 }),
      row({ id: "2", slug: "sql-foundations-101", title: "SQL Foundations",
            difficultyLevel: "beginner", estimatedMinutes: 240, orderIndex: 2 }),
    ]);
    const res = await request(makeApp()).get("/api/courses/sql");
    // 'foundations' signal wins over lower estimatedHours.
    expect(res.body.startHere.project.slug).toBe("sql-foundations-101");
  });
});
