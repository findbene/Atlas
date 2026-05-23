/**
 * Phase 19 — 2-project beginner/foundations pilot.
 *
 * Pins:
 *   - The 2 new P19 beginner slugs return 200 on `GET /projects/:slug`.
 *   - `GET /api/admin/quality` shows `difficultyDistribution.visible.beginner=8`
 *     (P14 baseline 6 + P19 +2) and `visibleBeginnerSlugs` contains both
 *     new slugs attributed to their declared course.
 *   - `anchorCount=2` is unchanged (no new anchors flipped).
 *   - `hiddenCount=32` baseline (Phase 14 end state) is unchanged by P19.
 *   - Total visible 52 → 54, total projects 84 → 86.
 *   - `lineageIntegrity` counters remain 0.
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

const NEW_P19_SLUGS = [
  { slug: "cloud-data-engineer-foundations-duckdb-local-warehouse",            course: "cloud-data-engineer" },
  { slug: "applied-llm-engineer-beginner-structured-prompting-with-json-schema", course: "applied-llm-engineer" },
] as const;

const ANCHOR_SLUGS = ["csv-to-postgres-pipeline", "dbt-data-models"] as const;

/** Phase-14 end state: 32 hidden rows (unchanged across P19 — no new archives). */
const PHASE14_HIDDEN_BASELINE = 32;
/** Phase-14 end state: 52 visible. P19 adds 2 → 54. */
const PHASE14_VISIBLE_BASELINE = 52;
const PHASE19_VISIBLE_TARGET = 54;
/** P14 ended with 6 visible beginners; P19 adds 2 → 8. */
const PHASE19_BEGINNER_TARGET = 8;

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

describe("Phase 19 — 2 new beginner/foundations slugs reachable (200)", () => {
  for (const { slug, course } of NEW_P19_SLUGS) {
    it(`GET /projects/${slug} returns 200 (${course})`, async () => {
      projectsFindFirst.mockResolvedValue(projectRow(slug, true, { course, difficultyLevel: "beginner" }));
      const app = await buildProjectsApp();
      const res = await request(app).get(`/projects/${slug}`);
      expect(res.status).toBe(200);
      expect(res.body.slug).toBe(slug);
    });
  }
});

describe("Phase 19 — admin route reflects beginner pilot uplift", () => {
  it(`difficultyDistribution.visible.beginner=${PHASE19_BEGINNER_TARGET} after pilot lift (6 → 8)`, async () => {
    const rows = [
      // 1 pre-existing anchor (beginner per Phase 13/14 snapshot).
      projectRow("csv-to-postgres-pipeline", true, { isAnchor: true, totalSteps: 1, difficultyLevel: "beginner", course: "data-engineering" }),
      // 5 pre-existing P14 beginner-tier rows.
      projectRow("sql-beginner-select-where-join-essentials",             true, { course: "sql",               totalSteps: 5, difficultyLevel: "beginner" }),
      projectRow("python-libraries-beginner-pandas-essentials",           true, { course: "python-libraries",  totalSteps: 5, difficultyLevel: "beginner" }),
      projectRow("data-engineering-beginner-csv-cleanup-pipeline",        true, { course: "data-engineering",  totalSteps: 5, difficultyLevel: "beginner" }),
      projectRow("analytics-engineer-beginner-spreadsheet-to-sql-models", true, { course: "analytics-engineer",totalSteps: 5, difficultyLevel: "beginner" }),
      projectRow("data-scientist-beginner-eda-and-summary-stats",         true, { course: "data-scientist",    totalSteps: 5, difficultyLevel: "beginner" }),
      // 2 new P19 beginner/foundations rows.
      ...NEW_P19_SLUGS.map(({ slug, course }) =>
        projectRow(slug, true, { course, totalSteps: 5, difficultyLevel: "beginner" }),
      ),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.status).toBe(200);
    expect(res.body.difficultyDistribution.visible.beginner).toBe(PHASE19_BEGINNER_TARGET);
    const beginnerSlugs = new Set(
      (res.body.difficultyDistribution.visibleBeginnerSlugs as Array<{ slug: string }>).map(s => s.slug),
    );
    for (const { slug } of NEW_P19_SLUGS) {
      expect(beginnerSlugs.has(slug)).toBe(true);
    }
  });

  it("each Phase-19 beginner slug is attributed to its declared course in visibleBeginnerSlugs", async () => {
    const rows = NEW_P19_SLUGS.map(({ slug, course }) =>
      projectRow(slug, true, { course, totalSteps: 5, difficultyLevel: "beginner" }),
    );
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    const bySlug = new Map(
      (res.body.difficultyDistribution.visibleBeginnerSlugs as Array<{ slug: string; course: string }>)
        .map(e => [e.slug, e.course]),
    );
    for (const { slug, course } of NEW_P19_SLUGS) {
      expect(bySlug.get(slug)).toBe(course);
    }
  });

  it("anchorCount=2 stays at 2 across P19 (no new anchors flipped)", async () => {
    const rows = [
      ...ANCHOR_SLUGS.map(s => projectRow(s, true, { isAnchor: true, totalSteps: 1, difficultyLevel: "beginner" })),
      ...NEW_P19_SLUGS.map(({ slug, course }) =>
        projectRow(slug, true, { course, totalSteps: 5, difficultyLevel: "beginner", isAnchor: false }),
      ),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.anchorCount).toBe(2);
    expect(new Set(res.body.anchorSlugs)).toEqual(new Set(ANCHOR_SLUGS));
  });

  it(`hiddenCount baseline (${PHASE14_HIDDEN_BASELINE}) is unchanged by P19 — no new archives`, async () => {
    const hidden = Array.from({ length: PHASE14_HIDDEN_BASELINE }, (_, i) =>
      projectRow(`p14-hidden-${i}`, false),
    );
    const rows = [
      ...hidden,
      ...ANCHOR_SLUGS.map(s => projectRow(s, true, { isAnchor: true, totalSteps: 1 })),
      ...NEW_P19_SLUGS.map(({ slug, course }) => projectRow(slug, true, { course, totalSteps: 5 })),
    ];
    projectsFindMany.mockResolvedValueOnce(rows);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.hiddenCount).toBe(PHASE14_HIDDEN_BASELINE);
  });

  it("total visible 52 → 54 and hidden stays at 32 (Phase 19 net effect)", async () => {
    const hidden = Array.from({ length: PHASE14_HIDDEN_BASELINE }, (_, i) =>
      projectRow(`p14-hidden-${i}`, false),
    );
    const preVisible = Array.from({ length: PHASE14_VISIBLE_BASELINE }, (_, i) => projectRow(`pre-visible-${i}`, true));
    const newP19 = NEW_P19_SLUGS.map(({ slug, course }) =>
      projectRow(slug, true, { course, difficultyLevel: "beginner" }),
    );
    projectsFindMany.mockResolvedValueOnce([...hidden, ...preVisible, ...newP19]);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.hiddenCount).toBe(PHASE14_HIDDEN_BASELINE);
    expect(res.body.totals.projects).toBe(PHASE14_HIDDEN_BASELINE + PHASE14_VISIBLE_BASELINE + NEW_P19_SLUGS.length);
    expect(res.body.totals.projects - res.body.hiddenCount).toBe(PHASE19_VISIBLE_TARGET);
  });

  it("lineageIntegrity all counters remain 0 — no regression from P19 changes", async () => {
    const rows = [
      ...ANCHOR_SLUGS.map(s => projectRow(s, true, { isAnchor: true, totalSteps: 1 })),
      ...NEW_P19_SLUGS.map(({ slug, course }) =>
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

describe("Phase 19 — courses route flips Start Here from fallback to beginner", () => {
  it("GET /courses/cloud-data-engineer returns startHere.kind='start_here' with the P19 foundations slug + reasonKey='beginner_available'", async () => {
    const courseRouter = (await import("./courses")).default;
    const app = express();
    app.use((req, _res, next) => { (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }; next(); });
    app.use("/api", courseRouter);

    // Two cloud-DE projects: an advanced one + the P19 beginner. pickStartHere should return the beginner.
    projectsFindMany.mockResolvedValueOnce([
      projectRow("cloud-data-engineer-hudi-mor-cdc-merge", true, {
        course: "cloud-data-engineer", difficultyLevel: "advanced", totalSteps: 5,
      }),
      projectRow("cloud-data-engineer-foundations-duckdb-local-warehouse", true, {
        course: "cloud-data-engineer", difficultyLevel: "beginner", totalSteps: 5,
      }),
    ]);

    const res = await request(app).get("/api/courses/cloud-data-engineer");
    expect(res.status).toBe(200);
    expect(res.body.startHere).toBeTruthy();
    expect(res.body.startHere.kind).toBe("start_here");
    expect(res.body.startHere.reasonKey).toBe("beginner_available");
    expect(res.body.startHere.project.slug).toBe("cloud-data-engineer-foundations-duckdb-local-warehouse");
  });

  it("GET /courses/applied-llm-engineer returns startHere.kind='start_here' with the P19 beginner slug + reasonKey='beginner_available'", async () => {
    const courseRouter = (await import("./courses")).default;
    const app = express();
    app.use((req, _res, next) => { (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }; next(); });
    app.use("/api", courseRouter);

    projectsFindMany.mockResolvedValueOnce([
      projectRow("applied-llm-multi-agent-coordination", true, {
        course: "applied-llm-engineer", difficultyLevel: "advanced", totalSteps: 5,
      }),
      projectRow("applied-llm-engineer-beginner-structured-prompting-with-json-schema", true, {
        course: "applied-llm-engineer", difficultyLevel: "beginner", totalSteps: 5,
      }),
    ]);

    const res = await request(app).get("/api/courses/applied-llm-engineer");
    expect(res.status).toBe(200);
    expect(res.body.startHere).toBeTruthy();
    expect(res.body.startHere.kind).toBe("start_here");
    expect(res.body.startHere.reasonKey).toBe("beginner_available");
    expect(res.body.startHere.project.slug).toBe("applied-llm-engineer-beginner-structured-prompting-with-json-schema");
  });
});
