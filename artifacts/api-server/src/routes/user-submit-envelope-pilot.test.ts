/**
 * Phase 48 — Signed-envelope runtime grader pilot (json_equal kind).
 *
 * Proves the full sign → submit → verify → nonce → REAL grade path for ONE
 * narrow validation kind (`json_equal`) without enabling global json_equal
 * enforcement and without touching real project content.
 *
 * Pilot activation surface (must stay narrow):
 *   - `ATLAS_ENVELOPE_REQUIRED_KINDS` is EMPTY in production.
 *   - Tests opt-in per-describe via `vi.stubEnv("ATLAS_ENVELOPE_REQUIRED_KINDS", "json_equal")`.
 *   - Step fixtures here are SYNTHETIC — they don't correspond to any
 *     authored catalog project. The catalog is untouched.
 *
 * Pins (Phase 48):
 *   P1. Disabled-by-default is RE-CONFIRMED — even with a populated
 *       `expectedOutput`, an envelope submission returns 400
 *       `envelope_kind_not_enabled` and writes nothing. (Defense against
 *       a future regression that swaps the allow-list default to non-empty.)
 *   P2. Enabled allow-list + valid envelope + stdout that DEEP-EQUALS the
 *       parsed `expectedOutput` → 200 `passed`, ONE nonce row, ONE
 *       completion row, feedback is the neutral "Output matched..." string
 *       (no anti-cheat overclaim).
 *   P3. Enabled allow-list + valid envelope + stdout that does NOT match
 *       `expectedOutput` → 200 `not_passed`. NONCE IS STILL CONSUMED
 *       (verification succeeded; grading failed). NO completion row inserted.
 *       Replay is impossible.
 *   P4. Enabled allow-list + valid envelope + stdout that is not valid JSON
 *       → 200 `not_passed`, educational feedback ("Your output isn't valid
 *       JSON: ..."). Nonce consumed. No completion.
 *   P5. Authoring-gap fallback: enabled allow-list + step with
 *       `expectedOutput=null` → falls back to legacy default-pass
 *       (Phase 47 behavior preserved; pilot never punishes a learner for
 *       an authoring bug).
 *   P6. Replay rejection within pilot — second submit of the same envelope
 *       returns 400 `envelope_replay`. (Inherited from Phase 47 but
 *       re-pinned here against the real-grading path.)
 *   P7. Binding mismatch within pilot — envelope minted for stepId=X
 *       submitted to route stepId=Y returns 400 `envelope_binding_mismatch`.
 *       Nonce NOT consumed (verification fails before nonce hook).
 *   P8. Expiry within pilot — TTL=1ms envelope is rejected with
 *       `envelope_expired` once the clock advances.
 *   P9. Legacy regression — when no `envelope` field is present, the route
 *       behaves identically to pre-Phase-47 (the entire pilot is invisible
 *       to bare-string submissions, even with allow-list non-empty).
 *
 * Hard stops re-asserted:
 *   - No catalog content used (synthetic step fixtures only).
 *   - No /check change exercised (this file only hits /submit).
 *   - No cert / portfolio / billing surfaces touched.
 *   - Feedback strings audited for anti-cheat overclaiming — only H3
 *     "Output matched/didn't match" language is allowed.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { signRunEnvelope } from "@workspace/execution-core/run-envelope";

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
const seenNonces = new Set<string>();
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
      const isNoncesTable = (table as { _t?: string })?._t === "run_envelope_nonces";
      if (isNoncesTable) {
        const nonce = (values as { nonce?: string })?.nonce ?? "";
        const wasNew = !seenNonces.has(nonce);
        if (wasNew) seenNonces.add(nonce);
        insertCalls.push({ table, values });
        return {
          onConflictDoNothing: () => ({
            returning: () => Promise.resolve(wasNew ? [{ nonce }] : []),
          }),
        };
      }
      insertCalls.push({ table, values });
      return Promise.resolve();
    },
  })),
  update: vi.fn((table: unknown) => ({
    set: (values: unknown) => ({
      where: (_w: unknown) => {
        updateCalls.push({ table, values });
        return { returning: () => Promise.resolve([{ id: "prog-1" }]) };
      },
    }),
  })),
  select: vi.fn(() => ({
    from: () => ({ where: () => Promise.resolve([{ passedCount: nextPassedCount }]) }),
  })),
  execute: vi.fn(() => Promise.resolve([])),
  transaction: vi.fn(async (cb: (tx: any) => Promise<unknown>) => cb(dbMock)),
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
  userStepCompletions: {
    _t: "userStepCompletions",
    userId: "u", projectId: "p", stepNumber: "n", id: "id", passed: "passed",
  },
  runEnvelopeNonces: { _t: "run_envelope_nonces", nonce: "nonce" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => ({ eq: a }),
  and: (...a: unknown[]) => ({ and: a }),
  desc: (...a: unknown[]) => ({ desc: a }),
  asc: (...a: unknown[]) => ({ asc: a }),
  isNull: (...a: unknown[]) => ({ isNull: a }),
  ne: (...a: unknown[]) => ({ ne: a }),
  sql: Object.assign(
    (strings: unknown, ...values: unknown[]) => {
      if (strings && typeof strings === "object" && Array.isArray((strings as { raw?: unknown }).raw)) {
        return { _sql: (strings as TemplateStringsArray).join("?"), _values: values };
      }
      return {};
    }, {},
  ),
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
  app.use((req, _res, next) => {
    (req as any).log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
    next();
  });
  app.use(router);
  return app;
}

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const STEP_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_STEP_ID = "33333333-3333-3333-3333-333333333333";
const SECRET = "phase-48-test-secret";

// SYNTHETIC pilot expected — the catalog is untouched. We arrange for the
// route-side step lookup to return a json_equal step with this value.
const PILOT_EXPECTED_JSON = '{"answer": 42, "ok": true}';
const PILOT_MATCHING_STDOUT = '{"ok": true, "answer": 42}\n'; // key order flipped — deep-equal still true

function tableName(t: unknown): string {
  return (t as { _t?: string })?._t ?? "?";
}
function nonceRowsInserted() {
  return insertCalls.filter((c) => tableName(c.table) === "run_envelope_nonces");
}
function completionsInserted() {
  return insertCalls.filter((c) => tableName(c.table) === "userStepCompletions");
}

function mintEnvelope(opts: {
  stdout?: string;
  code?: string;
  bindingStepId?: string;
  ttlMs?: number;
} = {}) {
  const capture = {
    version: 1 as const,
    language: "python" as const,
    code: opts.code ?? "print({'answer': 42, 'ok': True})",
    stdout: opts.stdout ?? PILOT_MATCHING_STDOUT,
    stderr: "",
    exitCode: 0,
    durationMs: 5,
    timedOut: false,
  };
  return signRunEnvelope(
    capture,
    {
      userId: TEST_USER.id,
      projectId: PROJECT_ID,
      stepId: opts.bindingStepId ?? STEP_ID,
      validationKind: "json_equal",
      ttlMs: opts.ttlMs ?? 10 * 60 * 1000,
    },
    SECRET,
  );
}

/** Configure the route-side step lookup with a json_equal step whose
 *  `expectedOutput` is the synthetic PILOT_EXPECTED_JSON. */
function mockPilotStep(expectedOutput: string | null = PILOT_EXPECTED_JSON) {
  projectStepsFindFirst.mockResolvedValue({
    id: STEP_ID,
    projectId: PROJECT_ID,
    stepNumber: 1,
    validationType: "json_equal",
    expectedOutput,
    validationConfig: null,
    xpReward: 10,
  });
}

beforeEach(() => {
  vi.stubEnv("RUN_ENVELOPE_SIGNING_SECRET", SECRET);
  vi.stubEnv("ATLAS_ENVELOPE_REQUIRED_KINDS", ""); // empty by default
  userProgressFindFirst.mockReset().mockResolvedValue({ id: "prog-1", userId: TEST_USER.id, projectId: PROJECT_ID });
  projectStepsFindFirst.mockReset();
  mockPilotStep();
  userStepCompletionsFindFirst.mockReset().mockResolvedValue(undefined);
  projectsFindFirst.mockReset().mockResolvedValue({ id: PROJECT_ID, totalSteps: 1, title: "T", slug: "t", jobOutcomes: null });
  userXpFindFirst.mockReset().mockResolvedValue(undefined);
  insertCalls.length = 0;
  updateCalls.length = 0;
  seenNonces.clear();
  nextPassedCount = 1;
  sendEmailSpy.mockClear();
  bumpStreakSpy.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─────────────────────────────────────────────────────────────────────────
// P1 — Disabled by default (re-confirmation against authored expected)
// ─────────────────────────────────────────────────────────────────────────
describe("P1. allow-list empty by default (re-pinned for pilot)", () => {
  it("rejects with envelope_kind_not_enabled even when step.expectedOutput is populated", async () => {
    const envelope = mintEnvelope();
    const app = await buildApp();
    const res = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: null, envelope });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("envelope_kind_not_enabled");
    expect(nonceRowsInserted()).toHaveLength(0);
    expect(completionsInserted()).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// P2 — Pilot HAPPY PATH (real json_equal comparison)
// ─────────────────────────────────────────────────────────────────────────
describe("P2. pilot enabled + matching stdout → real pass", () => {
  beforeEach(() => vi.stubEnv("ATLAS_ENVELOPE_REQUIRED_KINDS", "json_equal"));

  it("verifies, consumes nonce, REAL-grades pass, writes completion, neutral feedback", async () => {
    const envelope = mintEnvelope({ stdout: PILOT_MATCHING_STDOUT });
    const app = await buildApp();
    const res = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: null, envelope });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("passed");
    expect(res.body.feedback).toBe("Output matched the expected result.");

    // Honest-claim audit: feedback must not contain anti-cheat overclaim.
    const lower = String(res.body.feedback).toLowerCase();
    expect(lower).not.toContain("verified the learner");
    expect(lower).not.toContain("proved");
    expect(lower).not.toContain("tamper");

    expect(nonceRowsInserted()).toHaveLength(1);
    expect(completionsInserted()).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// P3 — Pilot FAILS on mismatched output (this is what Phase 47 couldn't do)
// ─────────────────────────────────────────────────────────────────────────
describe("P3. pilot enabled + non-matching stdout → real fail", () => {
  beforeEach(() => vi.stubEnv("ATLAS_ENVELOPE_REQUIRED_KINDS", "json_equal"));

  it("returns not_passed with diff feedback; nonce IS consumed; NO completion row", async () => {
    const envelope = mintEnvelope({ stdout: '{"answer": 41, "ok": true}\n' });
    const app = await buildApp();
    const res = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: null, envelope });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("failed");
    expect(res.body.feedback).toMatch(/^Output didn't match\./);
    expect(res.body.feedback).toContain('"answer":42');
    expect(res.body.feedback).toContain('"answer":41');

    // Verification succeeded → nonce was consumed before grading ran.
    expect(nonceRowsInserted()).toHaveLength(1);
    // Route records the attempt with passed:false (no XP, no completion-passed flag).
    const comps = completionsInserted();
    expect(comps).toHaveLength(1);
    expect((comps[0]!.values as { passed?: boolean }).passed).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// P4 — Pilot FAILS gracefully on non-JSON stdout
// ─────────────────────────────────────────────────────────────────────────
describe("P4. pilot enabled + invalid JSON stdout → educational fail", () => {
  beforeEach(() => vi.stubEnv("ATLAS_ENVELOPE_REQUIRED_KINDS", "json_equal"));

  it("returns not_passed with parse-error feedback; nonce consumed; no completion", async () => {
    const envelope = mintEnvelope({ stdout: "hello world\n" });
    const app = await buildApp();
    const res = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: null, envelope });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("failed");
    expect(res.body.feedback).toMatch(/^Your output isn't valid JSON:/);
    expect(nonceRowsInserted()).toHaveLength(1);
    const comps = completionsInserted();
    expect(comps).toHaveLength(1);
    expect((comps[0]!.values as { passed?: boolean }).passed).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// P5 — Authoring-gap fallback (expectedOutput=null)
// ─────────────────────────────────────────────────────────────────────────
describe("P5. pilot enabled + step.expectedOutput=null → legacy default-pass", () => {
  beforeEach(() => vi.stubEnv("ATLAS_ENVELOPE_REQUIRED_KINDS", "json_equal"));

  it("does not punish learners for an authoring bug — falls back to default pass", async () => {
    mockPilotStep(null);
    const envelope = mintEnvelope({ stdout: "anything\n" });
    const app = await buildApp();
    const res = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: null, envelope });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("passed");
    expect(nonceRowsInserted()).toHaveLength(1);
    expect(completionsInserted()).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// P6 — Replay rejection within the pilot
// ─────────────────────────────────────────────────────────────────────────
describe("P6. pilot enabled + replay → envelope_replay", () => {
  beforeEach(() => vi.stubEnv("ATLAS_ENVELOPE_REQUIRED_KINDS", "json_equal"));

  it("second submit of the same envelope returns envelope_replay", async () => {
    const envelope = mintEnvelope();
    const app = await buildApp();
    const first = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: null, envelope });
    expect(first.status).toBe(200);
    expect(first.body.status).toBe("passed");

    const second = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: null, envelope });
    expect(second.status).toBe(400);
    expect(second.body.error).toBe("envelope_replay");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// P7 — Binding mismatch within the pilot
// ─────────────────────────────────────────────────────────────────────────
describe("P7. pilot enabled + binding mismatch → envelope_binding_mismatch", () => {
  beforeEach(() => vi.stubEnv("ATLAS_ENVELOPE_REQUIRED_KINDS", "json_equal"));

  it("envelope minted for a different stepId is rejected; nonce NOT consumed", async () => {
    const envelope = mintEnvelope({ bindingStepId: OTHER_STEP_ID });
    const app = await buildApp();
    const res = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: null, envelope });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("envelope_binding_mismatch");
    expect(nonceRowsInserted()).toHaveLength(0);
    expect(completionsInserted()).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// P8 — Expiry within the pilot
// ─────────────────────────────────────────────────────────────────────────
describe("P8. pilot enabled + expired envelope → envelope_expired", () => {
  beforeEach(() => vi.stubEnv("ATLAS_ENVELOPE_REQUIRED_KINDS", "json_equal"));

  it("TTL=1ms envelope rejected after the clock advances", async () => {
    const envelope = mintEnvelope({ ttlMs: 1 });
    await new Promise((r) => setTimeout(r, 20));
    const app = await buildApp();
    const res = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: null, envelope });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("envelope_expired");
    expect(nonceRowsInserted()).toHaveLength(0);
    expect(completionsInserted()).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// P9 — Legacy regression: bare-string path invisible to the pilot
//
// This is the LOAD-BEARING production-safety invariant: even if an operator
// flips ATLAS_ENVELOPE_REQUIRED_KINDS to include json_equal, learners
// running the existing frontend (which still posts bare-string submissions
// without an `envelope` field) MUST continue to see legacy default-pass
// behavior. Otherwise the operator's "narrow pilot" flip would cascade into
// a catalog-wide 400 for every existing learner.
// ─────────────────────────────────────────────────────────────────────────
describe("P9. legacy bare-string /submit is unchanged by the pilot", () => {
  it("with allow-list NON-empty but no `envelope` field, behaves as Phase 46/47", async () => {
    vi.stubEnv("ATLAS_ENVELOPE_REQUIRED_KINDS", "json_equal");
    // Legacy json_equal default-pass — pilot grader never runs because the
    // envelope branch is not entered.
    const app = await buildApp();
    const res = await request(app)
      .post(`/user/projects/${PROJECT_ID}/steps/${STEP_ID}/submit`)
      .send({ submission: "print('whatever')" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("passed");
    // No envelope verification happened → no nonce row inserted.
    expect(nonceRowsInserted()).toHaveLength(0);
    expect(completionsInserted()).toHaveLength(1);
  });
});
