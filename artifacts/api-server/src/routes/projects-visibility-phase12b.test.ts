/**
 * Phase 12B — Phase-11-deferral-completion replaced legacy twin archive regression.
 *
 * Pins:
 *   - The 3 P12B legacy slugs (kafka-streaming-pipeline, ml-feature-store,
 *     spark-batch-processing) return 404 on `GET /projects/:slug` once
 *     `learner_visible=false` is set.
 *   - The 3 upgraded P12B twins still return 200.
 *   - `GET /api/admin/quality` still lists all 3 legacy slugs in `hiddenSlugs`
 *     (admin DOES see archived rows).
 *   - `hiddenCount` delta from the Phase-12A baseline is exactly +3.
 *   - `legacyReplacements` surface returns count=10 (7 P11 + 3 P12B) when
 *     all 10 upgraded rows expose `replaceCandidateSlug`; each P12B pair
 *     reports `legacyHidden=true`.
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

const LEGACY_SLUGS_P11 = [
  "ai-eng-llm-eval-harness",
  "mlops-model-serving-canary",
  "delta-lake-lakehouse",
  "snowflake-data-warehouse",
  "airflow-etl-dag",
  "api-to-warehouse-ingestion",
  "data-quality-framework",
] as const;

const UPGRADED_SLUGS_P11 = [
  "ai-engineer-llm-eval-harness",
  "ai-engineer-model-serving-canary",
  "cloud-data-engineer-delta-lake-lakehouse",
  "cloud-data-engineer-snowflake-data-warehouse",
  "data-engineering-airflow-etl-dag",
  "data-engineering-api-to-warehouse-ingestion",
  "data-engineering-data-quality-framework",
] as const;

const LEGACY_SLUGS_P12B = [
  "kafka-streaming-pipeline",
  "ml-feature-store",
  "spark-batch-processing",
] as const;

const UPGRADED_SLUGS_P12B = [
  "data-engineering-kafka-streaming-pipeline",
  "data-engineering-ml-feature-store",
  "data-engineering-spark-batch-processing",
] as const;

const PAIRS_P11 = LEGACY_SLUGS_P11.map((legacy, i) => ({ legacy, upgraded: UPGRADED_SLUGS_P11[i] }));
const PAIRS_P12B = LEGACY_SLUGS_P12B.map((legacy, i) => ({ legacy, upgraded: UPGRADED_SLUGS_P12B[i] }));

/** Phase-12A end state: 22 P10 thin stubs + 7 P11 legacy twins = 29 hidden rows. */
const PHASE12A_HIDDEN_BASELINE = 29;

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
    totalSteps: 0,
    enrolledCount: 0,
    completionRate: 0,
    tags: [],
    orderIndex: 0,
    learningObjectives: [],
    prerequisites: [],
    domainId: "d1",
    course: "data-engineering",
    courseSource: "heuristic_legacy",
    qualityStatus: "approved",
    qualityBreakdown: null,
    sourceCandidateId: null,
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

describe("Phase 12B — replaced P12B legacy twins return 404", () => {
  for (const slug of LEGACY_SLUGS_P12B) {
    it(`GET /projects/${slug} returns 404 (no existence leak) after archive`, async () => {
      projectsFindFirst.mockResolvedValue(projectRow(slug, /* learnerVisible */ false));
      const app = await buildProjectsApp();
      const res = await request(app).get(`/projects/${slug}`);
      expect(res.status).toBe(404);
      expect(res.body).not.toHaveProperty("title");
      expect(res.body.error).toBe("Not found");
    });
  }
});

describe("Phase 12B — upgraded P12B twins remain reachable (200)", () => {
  for (const slug of UPGRADED_SLUGS_P12B) {
    it(`GET /projects/${slug} returns 200`, async () => {
      projectsFindFirst.mockResolvedValue(projectRow(slug, /* learnerVisible */ true));
      const app = await buildProjectsApp();
      const res = await request(app).get(`/projects/${slug}`);
      expect(res.status).toBe(200);
      expect(res.body.slug).toBe(slug);
    });
  }
});

describe("Phase 12B — admin still sees archived P12B legacy rows", () => {
  it("hiddenSlugs contains all 3 P12B legacy slugs and hiddenCount = P12A baseline + 3", async () => {
    // Simulate: 29-row P12A hidden baseline (22 P10 thin + 7 P11 legacy) + 3 P12B legacy +
    // 7 P11 upgraded twins + 3 P12B upgraded twins all visible with replaceCandidateSlug.
    const p12aHiddenBaseline = Array.from({ length: PHASE12A_HIDDEN_BASELINE }, (_, i) =>
      projectRow(`p12a-baseline-${i}`, false),
    );
    const p12bHidden = LEGACY_SLUGS_P12B.map(s => projectRow(s, false));
    const p11Upgraded = PAIRS_P11.map(p =>
      projectRow(p.upgraded, true, { replaceCandidateSlug: p.legacy }),
    );
    const p12bUpgraded = PAIRS_P12B.map(p =>
      projectRow(p.upgraded, true, { replaceCandidateSlug: p.legacy }),
    );
    projectsFindMany.mockResolvedValueOnce([
      ...p12aHiddenBaseline, ...p12bHidden, ...p11Upgraded, ...p12bUpgraded,
    ]);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.status).toBe(200);
    expect(res.body.hiddenCount).toBe(PHASE12A_HIDDEN_BASELINE + 3);
    for (const legacy of LEGACY_SLUGS_P12B) {
      expect(res.body.hiddenSlugs).toContain(legacy);
    }
    // None of the upgraded P12B twins should be in hiddenSlugs.
    for (const up of UPGRADED_SLUGS_P12B) {
      expect(res.body.hiddenSlugs).not.toContain(up);
    }
  });

  it("legacyReplacements surfaces 10 pairs total (7 P11 + 3 P12B) with P12B pairs legacyHidden=true", async () => {
    const p12aHiddenBaseline = Array.from({ length: PHASE12A_HIDDEN_BASELINE }, (_, i) =>
      projectRow(`p12a-baseline-${i}`, false),
    );
    const p12bHidden = LEGACY_SLUGS_P12B.map(s => projectRow(s, false));
    const p11Upgraded = PAIRS_P11.map(p =>
      projectRow(p.upgraded, true, { replaceCandidateSlug: p.legacy }),
    );
    const p12bUpgraded = PAIRS_P12B.map(p =>
      projectRow(p.upgraded, true, { replaceCandidateSlug: p.legacy }),
    );
    projectsFindMany.mockResolvedValueOnce([
      ...p12aHiddenBaseline, ...p12bHidden, ...p11Upgraded, ...p12bUpgraded,
    ]);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.legacyReplacements.count).toBe(10);
    const pairsBySlug = new Map<string, { upgradedSlug: string; legacySlug: string; legacyHidden: boolean }>(
      (res.body.legacyReplacements.pairs as Array<{ upgradedSlug: string; legacySlug: string; legacyHidden: boolean }>)
        .map(p => [p.legacySlug, p]),
    );
    for (const { legacy, upgraded } of PAIRS_P12B) {
      const pair = pairsBySlug.get(legacy);
      expect(pair).toBeDefined();
      expect(pair!.upgradedSlug).toBe(upgraded);
      expect(pair!.legacyHidden).toBe(true);
    }
    // P11 pairs are also present (admin shows all replacement pairs, not just P12B).
    for (const { legacy } of PAIRS_P11) {
      expect(pairsBySlug.has(legacy)).toBe(true);
    }
  });

  it("legacyReplacements shows legacyHidden=false for P12B pairs if archive hasn't run yet", async () => {
    // Sanity: pre-archive state must report legacyHidden=false so ops can see drift.
    const visibleP12BLegacy = LEGACY_SLUGS_P12B.map(s => projectRow(s, true));
    const p12bUpgraded = PAIRS_P12B.map(p =>
      projectRow(p.upgraded, true, { replaceCandidateSlug: p.legacy }),
    );
    projectsFindMany.mockResolvedValueOnce([...visibleP12BLegacy, ...p12bUpgraded]);

    const app = await buildAdminApp();
    const res = await request(app).get("/api/admin/quality");
    expect(res.body.legacyReplacements.count).toBe(3);
    for (const pair of res.body.legacyReplacements.pairs as Array<{ legacyHidden: boolean }>) {
      expect(pair.legacyHidden).toBe(false);
    }
  });
});
