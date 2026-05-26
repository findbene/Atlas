/**
 * Phase 29 — Tests for GET /api/user/portfolio.
 *
 * Pins:
 *   T1   Happy path: multiple completed projects → items ordered by
 *        completedAt DESC with correct evidence values; summary aggregates
 *        match items.
 *   T2   Empty state: zero completions → 200 with empty items + zero summary.
 *   T3a  User isolation A: getCurrentUser → user A only ever returns
 *        user A's data (B's progress rows never appear in any query path).
 *   T3b  User isolation B: mirror of T3a for user B.
 *   T4   Anonymous: getCurrentUser → null → 401, no portfolio data
 *        fetched.
 *   T5   Privacy denylist (symmetric with Phase 28 T3): no email, clerkId,
 *        userId, submissionExcerpt, submissionSha256, raw hashes, or
 *        Stripe-customer / billing field; serialized-string nested check
 *        guards sensitive values.
 *   T6   Clamp behavior: stepsCompleted ≤ totalSteps, including the
 *        totalSteps=0 archived/thin-stub edge.
 *   T7   XP scoping: only project-scoped xp_transactions for the
 *        authenticated user contribute. Other projects' XP and other
 *        users' XP do not bleed in.
 *   T8   Hidden / soft-deleted projects silently dropped: not counted,
 *        not rendered, no leak.
 *   T9   Share URLs: verifyUrl = /verify/<certId>, printUrl =
 *        /certificates/<slug>/print. Relative, no scheme/host.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import express, {
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from "express";
import request from "supertest";

const userProgressFindMany = vi.fn();
const projectsFindMany = vi.fn();

// stepAgg + xpAgg results are routed by the `_t` marker on the table
// passed to `.from()`. The chain is select().from().where().groupBy().
let stepAggResult: Array<{
  projectId: string;
  stepsCompleted: number;
  evidenceHashCount: number;
  firstStepCompletedAt: Date | null;
}> = [];
let xpAggResult: Array<{ projectId: string; totalXpEarned: number }> = [];

const capturedWheres: Record<string, unknown[]> = {};
const dbMock: any = {
  query: {
    userProgress: { findMany: (...a: unknown[]) => userProgressFindMany(...a) },
    projects: { findMany: (...a: unknown[]) => projectsFindMany(...a) },
  },
  select: vi.fn(() => ({
    from: (table: unknown) => ({
      where: (cond: unknown) => {
        const t = (table as { _t?: string })?._t ?? "unknown";
        capturedWheres[t] = (capturedWheres[t] ?? []).concat([cond]);
        return {
          groupBy: () => {
            if (t === "userStepCompletions") return Promise.resolve(stepAggResult);
            if (t === "xpTransactions") return Promise.resolve(xpAggResult);
            return Promise.resolve([]);
          },
        };
      },
    }),
  })),
};

vi.mock("@workspace/db", () => ({
  db: dbMock,
  userProgress: {
    _t: "userProgress",
    id: "id",
    userId: "userId",
    projectId: "projectId",
    status: "status",
    completedAt: "completedAt",
  },
  projects: {
    _t: "projects",
    id: "id",
    learnerVisible: "learnerVisible",
    deletedAt: "deletedAt",
  },
  userStepCompletions: {
    _t: "userStepCompletions",
    userId: "userId",
    projectId: "projectId",
    passed: "passed",
    submissionSha256: "submissionSha256",
    completedAt: "completedAt",
  },
  xpTransactions: {
    _t: "xpTransactions",
    userId: "userId",
    amount: "amount",
    metadata: "metadata",
  },
}));

let currentUser: { id: string } | null = null;
const requireAuth: RequestHandler = (req, res, next) => {
  if (!currentUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
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
  inArray: (...a: unknown[]) => ({ inArray: a }),
  isNull: (...a: unknown[]) => ({ isNull: a }),
  sql: Object.assign(
    (strings: unknown, ...values: unknown[]) => {
      if (
        strings &&
        typeof strings === "object" &&
        Array.isArray((strings as { raw?: unknown }).raw)
      ) {
        return {
          _sql: (strings as TemplateStringsArray).join("?"),
          _values: values,
        };
      }
      return {};
    },
    {},
  ),
}));

async function buildApp() {
  const router = (await import("./user-portfolio")).default;
  const app = express();
  const fakeLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  app.use(((req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as { log: typeof fakeLog }).log = fakeLog;
    next();
  }) as RequestHandler);
  app.use(router);
  return app;
}

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const STRIPE_CUST = "cus_TESTSTRIPE";

beforeEach(() => {
  currentUser = { id: USER_A };
  userProgressFindMany.mockReset().mockResolvedValue([]);
  projectsFindMany.mockReset().mockResolvedValue([]);
  stepAggResult = [];
  xpAggResult = [];
  for (const k of Object.keys(capturedWheres)) delete capturedWheres[k];
});

describe("GET /api/user/portfolio", () => {
  it("T1 — happy path: items ordered by completedAt DESC, summary matches", async () => {
    userProgressFindMany.mockResolvedValueOnce([
      {
        id: "cert-newer",
        userId: USER_A,
        projectId: "p-csv",
        status: "completed",
        completedAt: new Date("2026-03-15T12:00:00.000Z"),
      },
      {
        id: "cert-older",
        userId: USER_A,
        projectId: "p-dbt",
        status: "completed",
        completedAt: new Date("2026-02-01T10:00:00.000Z"),
      },
    ]);
    projectsFindMany.mockResolvedValueOnce([
      {
        id: "p-csv",
        slug: "csv-to-postgres-pipeline",
        title: "CSV to Postgres Pipeline",
        course: "data-engineering",
        difficultyLevel: "intermediate",
        totalSteps: 4,
        jobOutcomes: { roles: ["Data Engineer", "Analytics Engineer"] },
      },
      {
        id: "p-dbt",
        slug: "dbt-data-models",
        title: "dbt Data Models",
        course: "analytics-engineer",
        difficultyLevel: "beginner",
        totalSteps: 2,
        jobOutcomes: null,
      },
    ]);
    stepAggResult = [
      {
        projectId: "p-csv",
        stepsCompleted: 4,
        evidenceHashCount: 3,
        firstStepCompletedAt: new Date("2026-03-15T10:00:00.000Z"),
      },
      {
        projectId: "p-dbt",
        stepsCompleted: 2,
        evidenceHashCount: 0,
        firstStepCompletedAt: null,
      },
    ];
    xpAggResult = [
      { projectId: "p-csv", totalXpEarned: 425 },
      { projectId: "p-dbt", totalXpEarned: 100 },
    ];

    const app = await buildApp();
    const res = await request(app).get("/user/portfolio");

    expect(res.status).toBe(200);
    expect(res.body.completedCount).toBe(2);
    expect(res.body.totalProjectXp).toBe(525);
    expect(res.body.evidenceBackedCount).toBe(1);
    expect(res.body.items).toHaveLength(2);
    // Items follow the progress query's DESC order (newer first).
    expect(res.body.items[0]).toMatchObject({
      certId: "cert-newer",
      projectSlug: "csv-to-postgres-pipeline",
      projectTitle: "CSV to Postgres Pipeline",
      course: "data-engineering",
      difficulty: "intermediate",
      completedAt: "2026-03-15T12:00:00.000Z",
      firstStepCompletedAt: "2026-03-15T10:00:00.000Z",
      durationSeconds: 7200,
      stepsCompleted: 4,
      totalSteps: 4,
      evidenceHashCount: 3,
      totalXpEarned: 425,
      verifyUrl: "/verify/cert-newer",
      printUrl: "/certificates/csv-to-postgres-pipeline/print",
      topRole: "Data Engineer",
    });
    expect(res.body.items[1]).toMatchObject({
      certId: "cert-older",
      projectSlug: "dbt-data-models",
      difficulty: "beginner",
      stepsCompleted: 2,
      totalSteps: 2,
      evidenceHashCount: 0,
      totalXpEarned: 100,
      firstStepCompletedAt: null,
      durationSeconds: null,
      topRole: null,
    });
  });

  it("T2 — empty state: zero completions returns empty items + zero summary", async () => {
    userProgressFindMany.mockResolvedValueOnce([]);
    const app = await buildApp();
    const res = await request(app).get("/user/portfolio");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      completedCount: 0,
      totalProjectXp: 0,
      evidenceBackedCount: 0,
      items: [],
    });
    // projectsFindMany never called when no progress rows.
    expect(projectsFindMany).not.toHaveBeenCalled();
  });

  it("T3a — user isolation: user A sees only user A's data", async () => {
    currentUser = { id: USER_A };
    userProgressFindMany.mockImplementationOnce(async () => [
      {
        id: "cert-a",
        userId: USER_A,
        projectId: "p-a",
        status: "completed",
        completedAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    ]);
    projectsFindMany.mockResolvedValueOnce([
      {
        id: "p-a",
        slug: "alpha",
        title: "Alpha",
        course: "data-engineering",
        difficultyLevel: "beginner",
        totalSteps: 1,
        jobOutcomes: null,
      },
    ]);
    stepAggResult = [
      {
        projectId: "p-a",
        stepsCompleted: 1,
        evidenceHashCount: 1,
        firstStepCompletedAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    ];
    xpAggResult = [{ projectId: "p-a", totalXpEarned: 50 }];

    const app = await buildApp();
    const res = await request(app).get("/user/portfolio");

    expect(res.status).toBe(200);
    // userProgress query was scoped to USER_A — assert the `where` arg
    // passed by the route includes USER_A as the userId filter.
    const progressCall = userProgressFindMany.mock.calls[0][0];
    const whereArg = JSON.stringify(progressCall.where);
    expect(whereArg).toContain(USER_A);
    expect(whereArg).not.toContain(USER_B);
    // Items belong only to USER_A.
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].certId).toBe("cert-a");
  });

  it("T3b — user isolation: user B mirror", async () => {
    currentUser = { id: USER_B };
    userProgressFindMany.mockImplementationOnce(async () => [
      {
        id: "cert-b",
        userId: USER_B,
        projectId: "p-b",
        status: "completed",
        completedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    ]);
    projectsFindMany.mockResolvedValueOnce([
      {
        id: "p-b",
        slug: "beta",
        title: "Beta",
        course: "ai-engineer",
        difficultyLevel: "intermediate",
        totalSteps: 3,
        jobOutcomes: null,
      },
    ]);
    stepAggResult = [
      {
        projectId: "p-b",
        stepsCompleted: 3,
        evidenceHashCount: 3,
        firstStepCompletedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    ];
    xpAggResult = [{ projectId: "p-b", totalXpEarned: 200 }];

    const app = await buildApp();
    const res = await request(app).get("/user/portfolio");

    expect(res.status).toBe(200);
    const whereArg = JSON.stringify(userProgressFindMany.mock.calls[0][0].where);
    expect(whereArg).toContain(USER_B);
    expect(whereArg).not.toContain(USER_A);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].certId).toBe("cert-b");
  });

  it("T4 — anonymous returns 401 and does not query portfolio data", async () => {
    currentUser = null;
    const app = await buildApp();
    const res = await request(app).get("/user/portfolio");
    expect(res.status).toBe(401);
    expect(userProgressFindMany).not.toHaveBeenCalled();
    expect(projectsFindMany).not.toHaveBeenCalled();
  });

  it("T5 — privacy denylist: no sensitive fields or values in response", async () => {
    userProgressFindMany.mockResolvedValueOnce([
      {
        id: "cert-priv",
        userId: USER_A,
        projectId: "p-priv",
        status: "completed",
        completedAt: new Date("2026-03-15T12:00:00.000Z"),
      },
    ]);
    projectsFindMany.mockResolvedValueOnce([
      {
        id: "p-priv",
        slug: "priv-slug",
        title: "Priv",
        course: "data-engineering",
        difficultyLevel: "beginner",
        totalSteps: 1,
        jobOutcomes: null,
      },
    ]);
    stepAggResult = [
      {
        projectId: "p-priv",
        stepsCompleted: 1,
        evidenceHashCount: 1,
        firstStepCompletedAt: new Date("2026-03-15T11:00:00.000Z"),
      },
    ];
    xpAggResult = [{ projectId: "p-priv", totalXpEarned: 100 }];

    const app = await buildApp();
    const res = await request(app).get("/user/portfolio");
    expect(res.status).toBe(200);

    const denylist = [
      "email",
      "clerkId",
      "userId",
      "stripeCustomerId",
      "subscriptionTier",
      "submissionExcerpt",
      "submissionSha256",
      "submission",
      "evidenceHashes",
      "rawHashes",
      "hashes",
      "metadata",
    ];
    // Top-level body
    for (const k of denylist) {
      expect(res.body).not.toHaveProperty(k);
    }
    // Per-item
    for (const item of res.body.items) {
      for (const k of denylist) {
        expect(item).not.toHaveProperty(k);
      }
    }
    // Serialize-then-search nested check for sensitive values.
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain(USER_A);
    expect(serialized).not.toContain(USER_B);
    expect(serialized).not.toContain(STRIPE_CUST);
    // `projectId` (internal UUID) MUST NOT appear — only the slug is public.
    expect(serialized).not.toContain("p-priv");
    // Raw evidence hashes never leaked: even if mocked into stepAgg,
    // they're never read into the response shape.
    expect(serialized).not.toContain("sha256");
  });

  it("T6 — clamp: stepsCompleted ≤ totalSteps, including totalSteps=0 edge", async () => {
    userProgressFindMany.mockResolvedValueOnce([
      {
        id: "cert-clamp",
        userId: USER_A,
        projectId: "p-thin",
        status: "completed",
        completedAt: new Date("2026-03-15T12:00:00.000Z"),
      },
    ]);
    projectsFindMany.mockResolvedValueOnce([
      {
        id: "p-thin",
        slug: "thin-stub",
        title: "Thin Stub",
        course: "data-engineering",
        difficultyLevel: "beginner",
        totalSteps: 0,
        jobOutcomes: null,
      },
    ]);
    // Pathological: many "passed" rows for a project with totalSteps=0
    // (archived/thin-stub edge — must NOT crash, must clamp to 0).
    stepAggResult = [
      {
        projectId: "p-thin",
        stepsCompleted: 7,
        evidenceHashCount: 7,
        firstStepCompletedAt: new Date("2026-03-15T11:00:00.000Z"),
      },
    ];
    xpAggResult = [];

    const app = await buildApp();
    const res = await request(app).get("/user/portfolio");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    const it0 = res.body.items[0];
    expect(it0.totalSteps).toBe(0);
    expect(it0.stepsCompleted).toBe(0);
    expect(it0.stepsCompleted).toBeLessThanOrEqual(it0.totalSteps);
    expect(it0.evidenceHashCount).toBe(0);
    expect(it0.evidenceHashCount).toBeLessThanOrEqual(it0.stepsCompleted);
  });

  it("T7 — XP scoping: only THIS user × THIS project XP contributes", async () => {
    // The route's xpAgg query is scoped by both userId AND projectId-IN.
    // The mock returns exactly the keys the route asked about; XP for an
    // unrelated project (or another user) would never land in the
    // metadata->>'projectId' result, so we model that here: the mock
    // returns XP only for the requested project key — the other project's
    // ledger entries are absent (i.e. filtered out by the SQL where).
    userProgressFindMany.mockResolvedValueOnce([
      {
        id: "cert-xp",
        userId: USER_A,
        projectId: "p-csv",
        status: "completed",
        completedAt: new Date("2026-03-15T12:00:00.000Z"),
      },
    ]);
    projectsFindMany.mockResolvedValueOnce([
      {
        id: "p-csv",
        slug: "csv-to-postgres-pipeline",
        title: "CSV to Postgres Pipeline",
        course: "data-engineering",
        difficultyLevel: "intermediate",
        totalSteps: 4,
        jobOutcomes: null,
      },
    ]);
    stepAggResult = [
      {
        projectId: "p-csv",
        stepsCompleted: 4,
        evidenceHashCount: 4,
        firstStepCompletedAt: new Date("2026-03-15T11:00:00.000Z"),
      },
    ];
    // Mock returns ONLY the scoped key. An "other project" key would not
    // appear here because the SQL WHERE filters by projectIds = ANY(...)
    // and userId = me. We assert no bleed.
    xpAggResult = [{ projectId: "p-csv", totalXpEarned: 425 }];

    const app = await buildApp();
    const res = await request(app).get("/user/portfolio");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].totalXpEarned).toBe(425);
    expect(res.body.totalProjectXp).toBe(425);

    // Architect-asked assertion: stepAggs and xpAggs WHERE clauses must
    // both reference the authenticated user.id AND the scoped projectIds.
    const stepWhere = JSON.stringify(capturedWheres.userStepCompletions);
    const xpWhere = JSON.stringify(capturedWheres.xpTransactions);
    for (const where of [stepWhere, xpWhere]) {
      expect(where).toContain(USER_A);
      expect(where).not.toContain(USER_B);
      expect(where).toContain("p-csv");
    }
  });

  it("T8 — hidden / soft-deleted projects silently dropped (no leak)", async () => {
    userProgressFindMany.mockResolvedValueOnce([
      {
        id: "cert-visible",
        userId: USER_A,
        projectId: "p-visible",
        status: "completed",
        completedAt: new Date("2026-03-15T12:00:00.000Z"),
      },
      {
        id: "cert-hidden",
        userId: USER_A,
        projectId: "p-hidden",
        status: "completed",
        completedAt: new Date("2026-03-10T12:00:00.000Z"),
      },
    ]);
    // projectsFindMany applies learner_visible=true AND deletedAt IS NULL;
    // p-hidden is excluded by the filter.
    projectsFindMany.mockResolvedValueOnce([
      {
        id: "p-visible",
        slug: "visible-slug",
        title: "Visible",
        course: "data-engineering",
        difficultyLevel: "beginner",
        totalSteps: 1,
        jobOutcomes: null,
      },
    ]);
    stepAggResult = [
      {
        projectId: "p-visible",
        stepsCompleted: 1,
        evidenceHashCount: 1,
        firstStepCompletedAt: new Date("2026-03-15T11:00:00.000Z"),
      },
    ];
    xpAggResult = [{ projectId: "p-visible", totalXpEarned: 50 }];

    const app = await buildApp();
    const res = await request(app).get("/user/portfolio");
    expect(res.status).toBe(200);
    expect(res.body.completedCount).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].certId).toBe("cert-visible");
    // The hidden cert is nowhere in the response.
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("cert-hidden");
    expect(serialized).not.toContain("p-hidden");
  });

  it("T10 — negative-duration clock skew clamps to 0", async () => {
    // firstStepCompletedAt AFTER completedAt is pathological (clock skew
    // or backfill artifact). Route must clamp durationSeconds to 0,
    // never expose a negative number.
    userProgressFindMany.mockResolvedValueOnce([
      {
        id: "cert-skew",
        userId: USER_A,
        projectId: "p-skew",
        status: "completed",
        completedAt: new Date("2026-03-15T12:00:00.000Z"),
      },
    ]);
    projectsFindMany.mockResolvedValueOnce([
      {
        id: "p-skew",
        slug: "skew-slug",
        title: "Skew",
        course: "data-engineering",
        difficultyLevel: "beginner",
        totalSteps: 1,
        jobOutcomes: null,
      },
    ]);
    stepAggResult = [
      {
        projectId: "p-skew",
        stepsCompleted: 1,
        evidenceHashCount: 1,
        // 1 hour AFTER completedAt — pathological.
        firstStepCompletedAt: new Date("2026-03-15T13:00:00.000Z"),
      },
    ];
    xpAggResult = [];

    const app = await buildApp();
    const res = await request(app).get("/user/portfolio");
    expect(res.status).toBe(200);
    expect(res.body.items[0].durationSeconds).toBe(0);
    expect(res.body.items[0].durationSeconds).toBeGreaterThanOrEqual(0);
  });

  it("T9 — share URLs are relative and correct", async () => {
    userProgressFindMany.mockResolvedValueOnce([
      {
        id: "cert-share-9",
        userId: USER_A,
        projectId: "p-share",
        status: "completed",
        completedAt: new Date("2026-03-15T12:00:00.000Z"),
      },
    ]);
    projectsFindMany.mockResolvedValueOnce([
      {
        id: "p-share",
        slug: "share-slug",
        title: "Share",
        course: "data-engineering",
        difficultyLevel: "beginner",
        totalSteps: 1,
        jobOutcomes: null,
      },
    ]);
    stepAggResult = [
      {
        projectId: "p-share",
        stepsCompleted: 1,
        evidenceHashCount: 1,
        firstStepCompletedAt: new Date("2026-03-15T11:00:00.000Z"),
      },
    ];
    xpAggResult = [{ projectId: "p-share", totalXpEarned: 50 }];

    const app = await buildApp();
    const res = await request(app).get("/user/portfolio");
    expect(res.status).toBe(200);
    const it0 = res.body.items[0];
    expect(it0.verifyUrl).toBe("/verify/cert-share-9");
    expect(it0.printUrl).toBe("/certificates/share-slug/print");
    // No scheme/host coupling.
    expect(it0.verifyUrl).not.toMatch(/^https?:\/\//);
    expect(it0.printUrl).not.toMatch(/^https?:\/\//);
  });
});
