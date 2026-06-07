/**
 * Phase 59A — /check vs /submit evidence-parity regression.
 *
 * Pins the evidence contract for the two LIVE server-graded rows
 * (csv_set_equal + sql_resultset), independent of the route harness:
 *
 *   - GRADING PARITY: /check and /submit return the SAME pass/fail verdict
 *     AND feedback for the same submission (they share gradeSubmission;
 *     /submit's envelope branch is off and funnels to the same comparator).
 *   - FAIL-CLOSED PARITY: both routes reject raw SQL / malformed JSON / wrong
 *     columns / missing row / extra row / wrong value identically.
 *   - /check NO DURABLE EVIDENCE: a server-graded /check writes nothing and
 *     never opens a transaction — true even for a *passing* server-graded row.
 *   - /submit DURABLE ON PASS: a passing server-graded /submit persists the
 *     completion row + XP ledger (intended).
 *   - NO ANSWER-KEY LEAK: neither route's response echoes validationConfig /
 *     spec / expectedRows / expectedRowsHash.
 *   - BC: a NON-opted sql_resultset/csv_set_equal row still auto-passes on both
 *     routes regardless of submission.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const TEST_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "u@example.com",
  name: "U",
  timezone: "UTC",
  subscriptionTier: "free",
};

vi.mock("../lib/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  getCurrentUser: vi.fn().mockResolvedValue(TEST_USER),
  getOrCreateUser: vi.fn(),
  invalidateUserCache: vi.fn(),
}));

const userProgressFindFirst = vi.fn();
const projectStepsFindFirst = vi.fn();
const userStepCompletionsFindFirst = vi.fn();
const projectsFindFirst = vi.fn();
const userXpFindFirst = vi.fn();

const insertCalls: Array<{ table: unknown; values: unknown }> = [];
const updateCalls: Array<{ table: unknown; values: unknown }> = [];
const transactionCalls: Array<{ ran: true }> = [];
let nextPassedCount = 0;

const sendEmailSpy = vi.fn().mockResolvedValue(undefined);
const bumpStreakSpy = vi.fn().mockResolvedValue(undefined);

const dbMock: any = {
  query: {
    userProgress: { findFirst: (...a: unknown[]) => userProgressFindFirst(...a) },
    projectSteps: { findFirst: (...a: unknown[]) => projectStepsFindFirst(...a) },
    userStepCompletions: { findFirst: (...a: unknown[]) => userStepCompletionsFindFirst(...a) },
    projects: { findFirst: (...a: unknown[]) => projectsFindFirst(...a) },
    userXp: { findFirst: (...a: unknown[]) => userXpFindFirst(...a) },
  },
  insert: vi.fn((table: unknown) => ({
    values: (values: unknown) => {
      insertCalls.push({ table, values });
      // Some inserts (Phase 60B portfolio snapshot) chain .onConflictDoNothing();
      // others await the result directly. Return a Promise carrying the method.
      const result: Promise<void> & { onConflictDoNothing?: () => Promise<void> } =
        Promise.resolve();
      result.onConflictDoNothing = () => Promise.resolve();
      return result;
    },
  })),
  update: vi.fn((table: unknown) => ({
    set: (values: unknown) => ({
      where: () => {
        updateCalls.push({ table, values });
        return { returning: () => Promise.resolve([{ id: "prog-1" }]) };
      },
    }),
  })),
  select: vi.fn(() => ({ from: () => ({ where: () => Promise.resolve([{ passedCount: nextPassedCount }]) }) })),
  execute: vi.fn(() => Promise.resolve([])),
  transaction: vi.fn(async (cb: (tx: any) => Promise<unknown>) => { transactionCalls.push({ ran: true }); return cb(dbMock); }),
};

vi.mock("@workspace/db", () => ({
  db: dbMock,
  users: {},
  userProgress: { _t: "userProgress", userId: "u", projectId: "p", id: "id", status: "status" },
  userXp: { _t: "userXp", userId: "u" },
  userStreaks: { _t: "userStreaks", userId: "u" },
  xpTransactions: { _t: "xpTransactions" },
  projects: { _t: "projects", id: "id" },
  projectSteps: { _t: "projectSteps", id: "id", projectId: "projectId" },
  userStepCompletions: { _t: "userStepCompletions", userId: "u", projectId: "p", stepNumber: "n", id: "id", passed: "passed" },
  portfolioSubmissionSnapshots: { _t: "portfolioSubmissionSnapshots" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ eq: a }),
  and: (...a: unknown[]) => ({ and: a }),
  desc: (...a: unknown[]) => ({ desc: a }),
  asc: (...a: unknown[]) => ({ asc: a }),
  isNull: (...a: unknown[]) => ({ isNull: a }),
  ne: (...a: unknown[]) => ({ ne: a }),
  sql: Object.assign((s: unknown, ...v: unknown[]) => {
    if (s && typeof s === "object" && Array.isArray((s as { raw?: unknown }).raw)) return { _sql: "x", _values: v };
    return {};
  }, {}),
}));

vi.mock("@clerk/express", () => ({ getAuth: vi.fn() }));
vi.mock("../lib/email", () => ({
  sendEmail: (...a: unknown[]) => sendEmailSpy(...a),
  renderProjectCompletionEmail: vi.fn(() => ({ subject: "s", html: "h", text: "t" })),
}));
vi.mock("../lib/streak", () => ({ bumpStreak: (...a: unknown[]) => bumpStreakSpy(...a) }));

async function buildApp() {
  const router = (await import("./user")).default;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() }; next(); });
  app.use(router);
  return app;
}

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const STEP_ID = "22222222-2222-2222-2222-222222222222";

function resetCaptures() {
  insertCalls.length = 0; updateCalls.length = 0; transactionCalls.length = 0;
}

/** Wire all the find-mocks both routes need for a single step. */
function mockStep(step: Record<string, unknown>) {
  userProgressFindFirst.mockResolvedValue({ id: "prog-1", userId: TEST_USER.id, projectId: PROJECT_ID, status: "in_progress", completedAt: null });
  projectStepsFindFirst.mockResolvedValue(step);
  userStepCompletionsFindFirst.mockResolvedValue(undefined);
  projectsFindFirst.mockResolvedValue({ id: PROJECT_ID, totalSteps: 8, title: "T", slug: "s", jobOutcomes: [] });
  userXpFindFirst.mockResolvedValue({ userId: TEST_USER.id, totalXp: 0, level: 1 });
  nextPassedCount = 1;
}

async function viaCheck(app: express.Express, submission: string) {
  resetCaptures();
  const r = await request(app).post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/check`).send({ submission });
  return r;
}
async function viaSubmit(app: express.Express, submission: string) {
  resetCaptures();
  const r = await request(app).post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`).send({ submission, submissionType: "code" });
  return r;
}

const sqlStep = {
  id: STEP_ID, projectId: PROJECT_ID, stepNumber: 2, xpReward: 10,
  validationType: "sql_resultset", expectedOutput: null,
  validationConfig: { kind: "sql_resultset", description: "scd2", spec: {
    serverGrade: true, columns: ["check", "value"], expectedRows: [["one_current", 0], ["overlap", 0]],
  } },
};
const SQL_OK = JSON.stringify({ columns: ["check", "value"], rows: [["one_current", 0], ["overlap", 0]] });
const SQL_NEGATIVES: Array<[string, string]> = [
  ["raw SQL", "select 1"],
  ["malformed JSON", "not json {"],
  ["wrong columns", JSON.stringify({ columns: ["WRONG", "value"], rows: [["one_current", 0], ["overlap", 0]] })],
  ["missing row", JSON.stringify({ columns: ["check", "value"], rows: [["one_current", 0]] })],
  ["extra row", JSON.stringify({ columns: ["check", "value"], rows: [["one_current", 0], ["overlap", 0], ["x", 9]] })],
  ["wrong value", JSON.stringify({ columns: ["check", "value"], rows: [["one_current", 1], ["overlap", 0]] })],
];

const csvStep = {
  id: STEP_ID, projectId: PROJECT_ID, stepNumber: 3, xpReward: 10,
  validationType: "csv_set_equal", expectedOutput: null,
  validationConfig: { kind: "csv_set_equal", description: "mart", spec: {
    serverGrade: true, columns: ["a", "b"], expectedRows: [[1, "x"], [2, "y"]],
  } },
};
const CSV_OK = JSON.stringify({ columns: ["a", "b"], rows: [[2, "y"], [1, "x"]] }); // order-insensitive
const CSV_NEGATIVES: Array<[string, string]> = [
  ["raw SQL", "select * from t"],
  ["malformed JSON", "}{"],
  ["wrong columns", JSON.stringify({ columns: ["a", "WRONG"], rows: [[1, "x"], [2, "y"]] })],
  ["missing row", JSON.stringify({ columns: ["a", "b"], rows: [[1, "x"]] })],
  ["extra row", JSON.stringify({ columns: ["a", "b"], rows: [[1, "x"], [2, "y"], [3, "z"]] })],
  ["wrong value", JSON.stringify({ columns: ["a", "b"], rows: [[1, "x"], [2, "WRONG"]] })],
];

beforeEach(() => {
  for (const m of [userProgressFindFirst, projectStepsFindFirst, userStepCompletionsFindFirst, projectsFindFirst, userXpFindFirst]) m.mockReset();
  sendEmailSpy.mockClear(); bumpStreakSpy.mockClear();
  resetCaptures();
  nextPassedCount = 0;
});

describe.each([
  { name: "sql_resultset", step: sqlStep, ok: SQL_OK, negatives: SQL_NEGATIVES },
  { name: "csv_set_equal", step: csvStep, ok: CSV_OK, negatives: CSV_NEGATIVES },
])("$name — /check vs /submit parity (live server-graded row)", ({ step, ok, negatives }) => {
  it("correct capture: /check and /submit both pass with identical feedback", async () => {
    const app = await buildApp();
    mockStep(step);
    const c = await viaCheck(app, ok);
    mockStep(step);
    const s = await viaSubmit(app, ok);
    expect(c.body.status).toBe("passed");
    expect(s.body.status).toBe("passed");
    expect(c.body.feedback).toBe("Correct!");
    expect(s.body.feedback).toBe(c.body.feedback);
  });

  it.each(negatives)("fail-closed parity: '%s' fails on BOTH routes with identical feedback", async (_n, sub) => {
    const app = await buildApp();
    mockStep(step);
    const c = await viaCheck(app, sub);
    mockStep(step);
    const s = await viaSubmit(app, sub);
    expect(c.body.status).toBe("failed");
    expect(s.body.status).toBe("failed");
    expect(c.body.feedback).toBe(s.body.feedback);
  });

  it("/check writes NOTHING even for a passing server-graded row (no tx, no inserts/updates)", async () => {
    const app = await buildApp();
    mockStep(step);
    const c = await viaCheck(app, ok);
    expect(c.body.status).toBe("passed");
    expect(transactionCalls).toHaveLength(0);
    expect(insertCalls).toHaveLength(0);
    expect(updateCalls).toHaveLength(0);
    // /check omits all reward fields (on-wire no-commit guarantee).
    expect(c.body).not.toHaveProperty("xpEarned");
    expect(c.body).not.toHaveProperty("isFirstPass");
    expect(c.body).not.toHaveProperty("projectComplete");
  });

  it("/submit persists durable completion + XP on a fresh pass (intended)", async () => {
    const app = await buildApp();
    mockStep(step);
    const s = await viaSubmit(app, ok);
    expect(s.body.status).toBe("passed");
    expect(s.body.isFirstPass).toBe(true);
    expect(s.body.xpEarned).toBe(10);
    expect(insertCalls.some((c) => (c.table as any)?._t === "userStepCompletions")).toBe(true);
    expect(insertCalls.some((c) => (c.table as any)?._t === "xpTransactions")).toBe(true);
  });

  it("no answer-key leak on PASS *and* FAIL: neither route echoes config/spec/expectedRows or the expected row-set", async () => {
    const app = await buildApp();
    // The actual answer for an opted-in row is the full expected row-set.
    const expectedRowsJson = JSON.stringify((step.validationConfig as { spec: { expectedRows: unknown } }).spec.expectedRows);
    const wrongValue = negatives.find(([n]) => n === "wrong value")![1];
    const bodies: string[] = [];
    // Exercise BOTH the passing path (feedback "Correct!") and a failing path
    // (the comparator emits real diagnostic feedback) — the failing path is the
    // actual leak surface, so the OK-only check would be near-vacuous.
    for (const sub of [ok, wrongValue]) {
      mockStep(step); bodies.push(JSON.stringify((await viaCheck(app, sub)).body));
      mockStep(step); bodies.push(JSON.stringify((await viaSubmit(app, sub)).body));
    }
    for (const body of bodies) {
      expect(body).not.toContain("expectedRows");
      expect(body).not.toContain("expectedRowsHash");
      expect(body).not.toContain("validationConfig");
      expect(body).not.toContain("serverGrade");
      // The expected row-set (the answer key) must never appear on any path.
      expect(body).not.toContain(expectedRowsJson);
    }
  });
});

describe("BC — non-opted rows auto-pass on both routes", () => {
  const darkSql = {
    id: STEP_ID, projectId: PROJECT_ID, stepNumber: 1, xpReward: 10,
    validationType: "sql_resultset", expectedOutput: null,
    validationConfig: { kind: "sql_resultset", description: "d", spec: { query: "q", expectedRow: { n: 7 } } },
  };
  it("non-opted sql_resultset: /check and /submit both auto-pass 'Step completed.' on garbage", async () => {
    const app = await buildApp();
    mockStep(darkSql);
    const c = await viaCheck(app, "garbage the learner typed");
    mockStep(darkSql);
    const s = await viaSubmit(app, "garbage the learner typed");
    expect(c.body.status).toBe("passed");
    expect(c.body.feedback).toBe("Step completed.");
    expect(s.body.status).toBe("passed");
    expect(s.body.feedback).toBe("Step completed.");
  });

  const darkCsv = {
    id: STEP_ID, projectId: PROJECT_ID, stepNumber: 7, xpReward: 10,
    validationType: "csv_set_equal", expectedOutput: null,
    // Legacy fixture-only shape (no serverGrade) — must stay dark on both routes.
    validationConfig: { kind: "csv_set_equal", description: "d", spec: { columns: ["a"], expectedCsv: "fixtures/x.csv" } },
  };
  it("non-opted csv_set_equal: /check and /submit both auto-pass 'Step completed.' on garbage", async () => {
    const app = await buildApp();
    mockStep(darkCsv);
    const c = await viaCheck(app, "whatever the learner typed");
    mockStep(darkCsv);
    const s = await viaSubmit(app, "whatever the learner typed");
    expect(c.body.status).toBe("passed");
    expect(c.body.feedback).toBe("Step completed.");
    expect(s.body.status).toBe("passed");
    expect(s.body.feedback).toBe("Step completed.");
  });
});

// Phase 59B — close the 59A-deferred gap: the parity file now also pins the
// /submit durable-completion + idempotency behavior FOR a server-graded row
// (csv/sql), not just the generic `exact` path covered by user-submit.test.ts.
describe("/submit durable evidence on a server-graded row (sql_resultset)", () => {
  it("completed-transition: passing the FINAL server-graded step completes the project + emails once", async () => {
    const app = await buildApp();
    mockStep({ ...sqlStep, stepNumber: 8 }); // last of totalSteps=8
    nextPassedCount = 8; // all 8 steps passed after this fresh pass
    const s = await viaSubmit(app, SQL_OK);
    expect(s.body.status).toBe("passed");
    expect(s.body.isFirstPass).toBe(true);
    expect(s.body.projectComplete).toBe(true);
    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
    expect(insertCalls.some((c) => (c.table as { _t?: string })?._t === "xpTransactions")).toBe(true);
  });

  it("idempotent re-submit: an already-passed server-graded step awards no XP + writes no new ledger row", async () => {
    const app = await buildApp();
    mockStep(sqlStep);
    userStepCompletionsFindFirst.mockResolvedValue({ id: "uc-1", passed: true, attemptCount: 1 });
    nextPassedCount = 1;
    const s = await viaSubmit(app, SQL_OK);
    expect(s.body.status).toBe("passed");
    expect(s.body.xpEarned).toBe(0);
    expect(s.body.isFirstPass).toBe(false);
    expect(sendEmailSpy).not.toHaveBeenCalled();
    expect(insertCalls.some((c) => (c.table as { _t?: string })?._t === "xpTransactions")).toBe(false);
    // Monotonic: the completion UPDATE preserves passed=true and does NOT
    // overwrite first-pass evidence.
    const completionUpdate = updateCalls.find((c) => (c.table as { _t?: string })?._t === "userStepCompletions");
    expect((completionUpdate?.values as { passed?: boolean })?.passed).toBe(true);
    expect(completionUpdate?.values).not.toHaveProperty("submissionExcerpt");
  });
});
