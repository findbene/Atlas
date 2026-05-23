/**
 * Phase 20 — 2-project beginner/foundations final cohort.
 *
 * Pins:
 *   - The 2 new P20 beginner slugs return 200 on `GET /projects/:slug`.
 *   - `GET /api/admin/quality` reports `difficultyDistribution.visible.beginner=10`
 *     (P19 baseline 8 + P20 +2) with both new slugs attributed to the
 *     correct course in `visibleBeginnerSlugs`.
 *   - `anchorCount=2` is unchanged (no new anchors flipped).
 *   - `hiddenCount=32` baseline (Phase 14/19 end state) is unchanged.
 *   - Total visible 54 → 56, total projects 86 → 88.
 *   - `lineageIntegrity` counters remain 0.
 *   - **Phase-20 rider:** `startHereCoverage.zeroBeginnerCourses` is empty
 *     once both new modules are visible (all 9 courses have a beginner);
 *     ai-engineer + mlops-engineer report `kind='start_here'` with the
 *     new P20 slugs.
 *   - Live courses route flips Start Here from fallback to beginner for
 *     ai-engineer + mlops-engineer.
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

const NEW_P20_SLUGS = [
  { slug: "ai-engineer-foundations-classify-and-explain-locally",            course: "ai-engineer" },
  { slug: "mlops-engineer-foundations-reproducible-local-training-pipeline", course: "mlops-engineer" },
] as const;

const ANCHOR_SLUGS = ["csv-to-postgres-pipeline", "dbt-data-models"] as const;

/** Phase-19 end state: 32 hidden rows (unchanged across P20 — no new archives). */
const PHASE19_HIDDEN_BASELINE = 32;
/** Phase-19 end state: 54 visible. P20 adds 2 → 56. */
const PHASE19_VISIBLE_BASELINE = 54;
const PHASE20_VISIBLE_TARGET = 56;
/** P19 ended with 8 visible beginners; P20 adds 2 → 10. */
const PHASE20_BEGINNER_TARGET = 10;

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

async function buildProjectsApp() {
  const router = (await import("./projects")).default;
  const app = express();
  app.use((req, _res, next) => { (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }; next(); });
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

beforeEach(() => {
  projectsFindMany.mockReset().mockResolvedValue([]);
  projectsFindFirst.mockReset().mockResolvedValue(undefined);
  stepsFindMany.mockReset().mockResolvedValue([]);
  domainsFindFirst.mockReset().mockResolvedValue(undefined);
  executeSpy.mockReset().mockResolvedValue({ rows: [{ c: 0 }] });
});

describe("Phase 20 — 2 new beginner/foundations slugs reachable (200)", () => {
  for (const { slug, course } of NEW_P20_SLUGS) {
    it(`GET /projects/${slug} returns 200 (${course})`, async () => {
      projectsFindFirst.mockResolvedValue(projectRow(slug, true, { course, difficultyLevel: "beginner" }));
      const app = await buildProjectsApp();
      const res = await request(app).get(`/projects/${slug}`);
      expect(res.status).toBe(200);
      expect(res.body.slug).toBe(slug);
    });
  }
});

describe("Phase 20 — admin route reflects beginner final-cohort uplift", () => {
  it(`difficultyDistribution.visible.beginner=${PHASE20_BEGINNER_TARGET} after final lift (8 → 10)`, async () => {
    const rows = [
      // anchor (beginner per Phase 13/14 snapshot)
      projectRow("csv-to-postgres-pipeline", true, { isAnchor: true, totalSteps: 1, difficultyLevel: "beginner", course: "data-engineering" }),
      // 5 pre-existing P14 beginner-tier rows
      projectRow("sql-beginner-select-where-join-essentials",             true, { course: "sql",               totalSteps: 5, difficultyLevel: "beginner" }),
      projectRow("python-libraries-beginner-pandas-essentials",           true, { course: "python-libraries",  totalSteps: 5, difficultyLevel: "beginner" }),
      projectRow("data-engineering-beginner-csv-cleanup-pipeline",        true, { course: "data-engineering",  totalSteps: 5, difficultyLevel: "beginner" }),
      projectRow("analytics-engineer-beginner-spreadsheet-to-sql-models", true, { course: "analytics-engineer",totalSteps: 5, difficultyLevel: "beginner" }),
      projectRow("data-scientist-beginner-eda-and-summary-stats",         true, { course: "data-scientist",    totalSteps: 5, difficultyLevel: "beginner" }),
      // 2 P19 beginner/foundations rows
      projectRow("cloud-data-engineer-foundations-duckdb-local-warehouse",            true, { course: "cloud-data-engineer",  totalSteps: 5, difficultyLevel: "beginner" }),
      projectRow("applied-llm-engineer-beginner-structured-prompting-with-json-schema", true, { course: "applied-llm-engineer", totalSteps: 5, difficultyLevel: "beginner" }),
      // 2 new P20 beginner/foundations rows
      ...NEW_P20_SLUGS.map(({ slug, course }) =>
        projectRow(slug, true, { course, totalSteps: 5, difficultyLevel: "beginner" }),
      ),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.status).toBe(200);
    expect(res.body.difficultyDistribution.visible.beginner).toBe(PHASE20_BEGINNER_TARGET);
    const beginnerSlugs = new Set(
      (res.body.difficultyDistribution.visibleBeginnerSlugs as Array<{ slug: string }>).map(s => s.slug),
    );
    for (const { slug } of NEW_P20_SLUGS) {
      expect(beginnerSlugs.has(slug)).toBe(true);
    }
  });

  it("each Phase-20 beginner slug is attributed to its declared course in visibleBeginnerSlugs", async () => {
    const rows = NEW_P20_SLUGS.map(({ slug, course }) =>
      projectRow(slug, true, { course, totalSteps: 5, difficultyLevel: "beginner" }),
    );
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    const bySlug = new Map(
      (res.body.difficultyDistribution.visibleBeginnerSlugs as Array<{ slug: string; course: string }>)
        .map(e => [e.slug, e.course]),
    );
    for (const { slug, course } of NEW_P20_SLUGS) {
      expect(bySlug.get(slug)).toBe(course);
    }
  });

  it("anchorCount=2 stays at 2 across P20 (no new anchors flipped)", async () => {
    const rows = [
      ...ANCHOR_SLUGS.map(s => projectRow(s, true, { isAnchor: true, totalSteps: 1, difficultyLevel: "beginner" })),
      ...NEW_P20_SLUGS.map(({ slug, course }) =>
        projectRow(slug, true, { course, totalSteps: 5, difficultyLevel: "beginner", isAnchor: false }),
      ),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.anchorCount).toBe(2);
    expect(new Set(res.body.anchorSlugs)).toEqual(new Set(ANCHOR_SLUGS));
  });

  it(`hiddenCount baseline (${PHASE19_HIDDEN_BASELINE}) is unchanged by P20 — no new archives`, async () => {
    const hidden = Array.from({ length: PHASE19_HIDDEN_BASELINE }, (_, i) =>
      projectRow(`p19-hidden-${i}`, false),
    );
    const rows = [
      ...hidden,
      ...ANCHOR_SLUGS.map(s => projectRow(s, true, { isAnchor: true, totalSteps: 1 })),
      ...NEW_P20_SLUGS.map(({ slug, course }) => projectRow(slug, true, { course, totalSteps: 5 })),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.hiddenCount).toBe(PHASE19_HIDDEN_BASELINE);
  });

  it("total visible 54 → 56 and hidden stays at 32 (Phase 20 net effect)", async () => {
    const hidden = Array.from({ length: PHASE19_HIDDEN_BASELINE }, (_, i) =>
      projectRow(`p19-hidden-${i}`, false),
    );
    const preVisible = Array.from({ length: PHASE19_VISIBLE_BASELINE }, (_, i) => projectRow(`pre-visible-${i}`, true));
    const newP20 = NEW_P20_SLUGS.map(({ slug, course }) =>
      projectRow(slug, true, { course, difficultyLevel: "beginner" }),
    );
    projectsFindMany.mockResolvedValueOnce([...hidden, ...preVisible, ...newP20]);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.hiddenCount).toBe(PHASE19_HIDDEN_BASELINE);
    expect(res.body.totals.projects).toBe(PHASE19_HIDDEN_BASELINE + PHASE19_VISIBLE_BASELINE + NEW_P20_SLUGS.length);
    expect(res.body.totals.projects - res.body.hiddenCount).toBe(PHASE20_VISIBLE_TARGET);
  });

  it("lineageIntegrity all counters remain 0 — no regression from P20 changes", async () => {
    const rows = [
      ...ANCHOR_SLUGS.map(s => projectRow(s, true, { isAnchor: true, totalSteps: 1 })),
      ...NEW_P20_SLUGS.map(({ slug, course }) =>
        projectRow(slug, true, { course, totalSteps: 5, difficultyLevel: "beginner" }),
      ),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.lineageIntegrity.mismatches).toBe(0);
    expect(res.body.lineageIntegrity.inverseMismatches).toBe(0);
    expect(res.body.lineageIntegrity.duplicateCandidatePromotions).toBe(0);
  });
});

describe("Phase 20 — startHereCoverage admin rider", () => {
  it("totalCourses=9 and shape is present on the empty baseline", async () => {
    projectsFindMany.mockResolvedValueOnce([]);
    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.status).toBe(200);
    expect(res.body.startHereCoverage.totalCourses).toBe(9);
    expect(res.body.startHereCoverage.withBeginner).toBe(0);
    expect(res.body.startHereCoverage.withFallback).toBe(0);
    expect(res.body.startHereCoverage.zeroBeginnerCourses).toEqual([]);
  });

  it("with the full P20 9-course beginner roster, withBeginner=9 and zeroBeginnerCourses is empty", async () => {
    // One beginner per course = full coverage, the post-P20 invariant.
    const fullBeginnerRoster = [
      { slug: "data-engineering-beginner-csv-cleanup-pipeline",          course: "data-engineering" },
      { slug: "sql-beginner-select-where-join-essentials",               course: "sql" },
      { slug: "python-libraries-beginner-pandas-essentials",             course: "python-libraries" },
      { slug: "analytics-engineer-beginner-spreadsheet-to-sql-models",   course: "analytics-engineer" },
      { slug: "data-scientist-beginner-eda-and-summary-stats",           course: "data-scientist" },
      { slug: "cloud-data-engineer-foundations-duckdb-local-warehouse",  course: "cloud-data-engineer" },
      { slug: "applied-llm-engineer-beginner-structured-prompting-with-json-schema", course: "applied-llm-engineer" },
      ...NEW_P20_SLUGS,
    ];
    const rows = fullBeginnerRoster.map(({ slug, course }) =>
      projectRow(slug, true, { course, difficultyLevel: "beginner", totalSteps: 5 }),
    );
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.startHereCoverage.withBeginner).toBe(9);
    expect(res.body.startHereCoverage.withFallback).toBe(0);
    expect(res.body.startHereCoverage.zeroBeginnerCourses).toEqual([]);
    // Each of the 9 courses points at a 'start_here' kind with the matching slug.
    for (const { slug, course } of fullBeginnerRoster) {
      const entry = res.body.startHereCoverage.startHereByCourse[course];
      expect(entry).toBeTruthy();
      expect(entry.kind).toBe("start_here");
      expect(entry.reasonKey).toBe("beginner_available");
      expect(entry.slug).toBe(slug);
    }
  });

  it("ai-engineer and mlops-engineer each report kind='start_here' with the new P20 slug after P20 promotes", async () => {
    const rows = [
      // Pre-existing advanced rows in each P20 target course.
      projectRow("ai-eng-llm-eval-harness", true, { course: "ai-engineer", difficultyLevel: "advanced", totalSteps: 5 }),
      projectRow("mlops-model-serving-canary", true, { course: "mlops-engineer", difficultyLevel: "advanced", totalSteps: 5 }),
      // P20 new beginners.
      ...NEW_P20_SLUGS.map(({ slug, course }) =>
        projectRow(slug, true, { course, difficultyLevel: "beginner", totalSteps: 5 }),
      ),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    const ai = res.body.startHereCoverage.startHereByCourse["ai-engineer"];
    const mlops = res.body.startHereCoverage.startHereByCourse["mlops-engineer"];
    expect(ai.kind).toBe("start_here");
    expect(ai.slug).toBe("ai-engineer-foundations-classify-and-explain-locally");
    expect(mlops.kind).toBe("start_here");
    expect(mlops.slug).toBe("mlops-engineer-foundations-reproducible-local-training-pipeline");
    expect(res.body.startHereCoverage.zeroBeginnerCourses).not.toContain("ai-engineer");
    expect(res.body.startHereCoverage.zeroBeginnerCourses).not.toContain("mlops-engineer");
  });

  it("a course with only advanced rows reports kind='most_approachable_available' and lands in zeroBeginnerCourses", async () => {
    // Only sql has projects, both advanced. The other 8 courses have nothing.
    projectsFindMany.mockResolvedValueOnce([
      projectRow("sql-advanced-window-cte-mastery", true, { course: "sql", difficultyLevel: "advanced", totalSteps: 5 }),
      projectRow("sql-feature-store-lab",           true, { course: "sql", difficultyLevel: "advanced", totalSteps: 5 }),
    ]);
    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    const sql = res.body.startHereCoverage.startHereByCourse["sql"];
    expect(sql.kind).toBe("most_approachable_available");
    expect(sql.reasonKey).toBe("no_beginner_available");
    expect(res.body.startHereCoverage.zeroBeginnerCourses).toContain("sql");
    expect(res.body.startHereCoverage.withFallback).toBe(1);
    expect(res.body.startHereCoverage.withBeginner).toBe(0);
  });
});

describe("Phase 20 — courses route flips Start Here from fallback to beginner", () => {
  it("GET /courses/ai-engineer returns startHere.kind='start_here' with the P20 slug + reasonKey='beginner_available'", async () => {
    const courseRouter = (await import("./courses")).default;
    const app = express();
    app.use((req, _res, next) => { (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }; next(); });
    app.use("/api", courseRouter);

    projectsFindMany.mockResolvedValueOnce([
      projectRow("ai-eng-llm-eval-harness", true, {
        course: "ai-engineer", difficultyLevel: "advanced", totalSteps: 5,
      }),
      projectRow("ai-engineer-foundations-classify-and-explain-locally", true, {
        course: "ai-engineer", difficultyLevel: "beginner", totalSteps: 5,
      }),
    ]);

    const res = await request(app).get("/api/courses/ai-engineer");
    expect(res.status).toBe(200);
    expect(res.body.startHere).toBeTruthy();
    expect(res.body.startHere.kind).toBe("start_here");
    expect(res.body.startHere.reasonKey).toBe("beginner_available");
    expect(res.body.startHere.project.slug).toBe("ai-engineer-foundations-classify-and-explain-locally");
  });

  it("GET /courses/mlops-engineer returns startHere.kind='start_here' with the P20 slug + reasonKey='beginner_available'", async () => {
    const courseRouter = (await import("./courses")).default;
    const app = express();
    app.use((req, _res, next) => { (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }; next(); });
    app.use("/api", courseRouter);

    projectsFindMany.mockResolvedValueOnce([
      projectRow("mlops-model-serving-canary", true, {
        course: "mlops-engineer", difficultyLevel: "advanced", totalSteps: 5,
      }),
      projectRow("mlops-engineer-foundations-reproducible-local-training-pipeline", true, {
        course: "mlops-engineer", difficultyLevel: "beginner", totalSteps: 5,
      }),
    ]);

    const res = await request(app).get("/api/courses/mlops-engineer");
    expect(res.status).toBe(200);
    expect(res.body.startHere).toBeTruthy();
    expect(res.body.startHere.kind).toBe("start_here");
    expect(res.body.startHere.reasonKey).toBe("beginner_available");
    expect(res.body.startHere.project.slug).toBe("mlops-engineer-foundations-reproducible-local-training-pipeline");
  });
});
