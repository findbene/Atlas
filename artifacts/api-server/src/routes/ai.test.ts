import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// --- Module mocks ---------------------------------------------------------
// Mock the auth module so requireAuth is a passthrough and getCurrentUser
// returns a stable test user. invalidateUserCache is exposed as a spy so the
// /ai/chat finalize test can assert that the cache is invalidated after
// updating aiTutorLastReadAt.
const invalidateUserCacheSpy = vi.fn();
vi.mock("../lib/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  getCurrentUser: vi.fn().mockResolvedValue({
    id: "00000000-0000-0000-0000-000000000001",
    // Phase 60F — the /ai/chat + /ai/chat/mark-read finalize paths invalidate
    // the user cache by the RESOLVED user's clerkId (not Clerk's getAuth, which
    // throws under the gated E2E auth mode). The test user carries the clerkId
    // the assertion below expects.
    clerkId: "clerk_test_user_finalize",
    subscriptionTier: "free",
    aiTutorLastReadAt: null,
  }),
  invalidateUserCache: (...args: unknown[]) => invalidateUserCacheSpy(...args),
}));

// Mock the Anthropic SDK. The default export is the Anthropic class; we make
// it a constructor returning an object whose messages.stream returns an
// async-iterable yielding a predictable text stream. Per-test overrides set
// `anthropicStreamFactory` to customize behavior.
let anthropicStreamFactory: () => AsyncIterable<unknown> = () => ({
  async *[Symbol.asyncIterator]() {
    yield { type: "content_block_delta", delta: { type: "text_delta", text: "Hello " } };
    yield { type: "content_block_delta", delta: { type: "text_delta", text: "world." } };
  },
});
// Phase 34 — capture the args passed to `messages.stream(...)` so tests can
// assert on the rendered system prompt (e.g. the Tutor Contract block).
const streamSpy = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      stream: (args: unknown) => {
        streamSpy(args);
        return anthropicStreamFactory();
      },
    };
  },
}));

// Mock the DB. We expose `mockExecute`, `mockFindMany`, etc. on the export so
// individual tests can re-stub return values per case.
const mockExecute = vi.fn();
const mockFindMany = vi.fn();
// Captured spies for the assistant-finalize path. `insertReturning` lets a
// test override the value returned by `.returning(...)`. `updateSet`
// captures every `db.update(...).set(payload)` payload so the test can
// inspect what was written for `aiTutorLastReadAt`.
const insertReturning = vi.fn(() =>
  Promise.resolve([{ createdAt: new Date("2026-05-15T12:00:00.000Z") }]),
);
const updateSet = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
// `values(...)` returns a thenable so `await db.insert(t).values(v)` works,
// but it also exposes `.returning(...)` so `await db.insert(t).values(v).returning(...)`
// works too. This is how drizzle's builder behaves in real code.
function insertChainFactory() {
  const valuesResult: PromiseLike<unknown> & { returning: typeof insertReturning } = {
    then(onFulfilled?, onRejected?) {
      return Promise.resolve(undefined).then(onFulfilled, onRejected);
    },
    returning: insertReturning,
  };
  return { values: vi.fn(() => valuesResult) };
}
// Phase 34 — overridable per-test query stubs for the project context branch.
const projectsFindFirst = vi.fn().mockResolvedValue(null);
const projectStepsFindFirst = vi.fn().mockResolvedValue(null);
const userProgressFindFirst = vi.fn().mockResolvedValue(null);
const userProjectStepHintsFindFirst = vi.fn().mockResolvedValue(null);
const userStepCompletionsFindMany = vi.fn().mockResolvedValue([]);

vi.mock("@workspace/db", () => ({
  db: {
    execute: (...args: unknown[]) => mockExecute(...args),
    query: {
      aiTutorMessages: {
        findMany: (...args: unknown[]) => mockFindMany(...args),
      },
      projects: { findFirst: (...a: unknown[]) => projectsFindFirst(...a) },
      projectSteps: { findFirst: (...a: unknown[]) => projectStepsFindFirst(...a) },
      userProgress: { findFirst: (...a: unknown[]) => userProgressFindFirst(...a) },
      userProjectStepHints: { findFirst: (...a: unknown[]) => userProjectStepHintsFindFirst(...a) },
      userStepCompletions: { findMany: (...a: unknown[]) => userStepCompletionsFindMany(...a) },
    },
    insert: vi.fn(() => insertChainFactory()),
    update: vi.fn(() => ({ set: updateSet })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
  },
  // Drizzle table objects are referenced (not introspected) by the routes,
  // so opaque sentinels are sufficient for these tests.
  aiTutorMessages: { userId: "userId", projectId: "projectId" },
  projects: {},
  projectSteps: {},
  userProgress: {},
  userProjectStepHints: {},
  userStepCompletions: {},
  users: { id: "id" },
}));

// Drizzle helpers are imported by the route module; pass them through as
// no-op identity functions so the WHERE-builder calls don't throw.
vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return {
    ...actual,
    eq: (...a: unknown[]) => ({ _op: "eq", a }),
    and: (...a: unknown[]) => ({ _op: "and", a }),
    desc: (a: unknown) => ({ _op: "desc", a }),
  };
});

// Build the test app fresh per suite so middleware doesn't leak between cases.
async function buildApp() {
  // Use dynamic import so vi.mock above is fully wired before the route
  // module evaluates.
  const aiRouter = (await import("./ai")).default;
  const app = express();
  app.use(express.json());
  // Route handlers reference req.log; provide a no-op shim.
  app.use((req, _res, next) => {
    (req as unknown as { log: { warn: () => void; error: () => void; info: () => void } }).log = {
      warn: () => {},
      error: () => {},
      info: () => {},
    };
    next();
  });
  app.use(aiRouter);
  return app;
}

beforeEach(() => {
  mockExecute.mockReset();
  mockFindMany.mockReset();
  invalidateUserCacheSpy.mockReset();
  updateSet.mockClear();
  insertReturning.mockClear();
  streamSpy.mockClear();
  projectsFindFirst.mockReset().mockResolvedValue(null);
  projectStepsFindFirst.mockReset().mockResolvedValue(null);
  userProgressFindFirst.mockReset().mockResolvedValue(null);
  userProjectStepHintsFindFirst.mockReset().mockResolvedValue(null);
  userStepCompletionsFindMany.mockReset().mockResolvedValue([]);
  insertReturning.mockImplementation(() =>
    Promise.resolve([{ createdAt: new Date("2026-05-15T12:00:00.000Z") }]),
  );
  anthropicStreamFactory = () => ({
    async *[Symbol.asyncIterator]() {
      yield { type: "content_block_delta", delta: { type: "text_delta", text: "Hello " } };
      yield { type: "content_block_delta", delta: { type: "text_delta", text: "world." } };
    },
  });
});

describe("GET /ai/chat/conversations", () => {
  it("returns one row per project, with truncated snippet and ISO timestamps", async () => {
    const lastAt = new Date("2026-05-15T12:34:56.000Z");
    mockExecute.mockResolvedValueOnce({
      rows: [
        {
          project_id: "p1",
          project_slug: "etl-basics",
          project_title: "ETL Basics",
          message_count: 4,
          last_message_at: lastAt,
          last_role: "assistant",
          last_content: "x".repeat(250),
        },
      ],
    });

    const app = await buildApp();
    const res = await request(app).get("/ai/chat/conversations");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      projectId: "p1",
      projectSlug: "etl-basics",
      projectTitle: "ETL Basics",
      messageCount: 4,
      lastRole: "assistant",
      lastMessageAt: "2026-05-15T12:34:56.000Z",
    });
    // Snippet is truncated to 200 chars + ellipsis (long-content branch).
    expect(res.body[0].lastSnippet.length).toBe(201);
    expect(res.body[0].lastSnippet.endsWith("…")).toBe(true);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("returns 500 on DB failure", async () => {
    mockExecute.mockRejectedValueOnce(new Error("boom"));
    const app = await buildApp();
    const res = await request(app).get("/ai/chat/conversations");
    expect(res.status).toBe(500);
  });
});

describe("GET /ai/chat/history scoping", () => {
  it("project mode passes a project-scoped where clause to findMany", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const app = await buildApp();
    const projectId = "11111111-1111-1111-1111-111111111111";
    const res = await request(app).get(`/ai/chat/history?projectId=${projectId}`);
    expect(res.status).toBe(200);

    const args = mockFindMany.mock.calls[0]?.[0] as { where: { _op: string; a: unknown[] } };
    // Built via and(eq(userId), eq(projectId))
    expect(args.where._op).toBe("and");
    expect(args.where.a).toHaveLength(2);
    const [userClause, projectClause] = args.where.a as Array<{ _op: string; a: unknown[] }>;
    expect(userClause._op).toBe("eq");
    expect(projectClause._op).toBe("eq");
    // Second arg of the project eq() is the user-supplied projectId
    expect(projectClause.a[1]).toBe(projectId);
  });

  it("general=true mode emits an IS NULL clause (no projectId equality)", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const app = await buildApp();
    const res = await request(app).get("/ai/chat/history?general=true");
    expect(res.status).toBe(200);

    const args = mockFindMany.mock.calls[0]?.[0] as { where: { _op: string; a: unknown[] } };
    expect(args.where._op).toBe("and");
    // Second clause should not be an eq() — IS NULL is built via raw sql tag.
    const [, second] = args.where.a as Array<{ _op?: string }>;
    expect(second._op).toBeUndefined();
  });

  it("rejects an invalid projectId format and falls back to all-user history", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const app = await buildApp();
    const res = await request(app).get("/ai/chat/history?projectId=not-a-uuid");
    expect(res.status).toBe(200);

    const args = mockFindMany.mock.calls[0]?.[0] as { where: { _op: string } };
    // No project filter → just the bare userId eq() clause (no AND wrapper).
    expect(args.where._op).toBe("eq");
  });

  it("returns history rows in chronological order (server reverses DESC fetch)", async () => {
    const ts1 = new Date("2026-05-15T10:00:00.000Z");
    const ts2 = new Date("2026-05-15T11:00:00.000Z");
    // findMany returns DESC-ordered rows; the route reverses to chronological.
    mockFindMany.mockResolvedValueOnce([
      { id: "m2", role: "assistant", content: "second", projectId: null, stepId: null, createdAt: ts2 },
      { id: "m1", role: "user",      content: "first",  projectId: null, stepId: null, createdAt: ts1 },
    ]);
    const app = await buildApp();
    const res = await request(app).get("/ai/chat/history?general=true");
    expect(res.status).toBe(200);
    expect(res.body.map((r: { id: string }) => r.id)).toEqual(["m1", "m2"]);
  });
});

describe("GET /ai/chat/unread", () => {
  it("returns the assistant-message count newer than aiTutorLastReadAt", async () => {
    const lastAt = new Date("2026-05-15T12:00:00.000Z");
    mockExecute.mockResolvedValueOnce({ rows: [{ c: 3, last_at: lastAt }] });
    const app = await buildApp();
    const res = await request(app).get("/ai/chat/unread");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 3, lastAt: "2026-05-15T12:00:00.000Z" });
  });

  it("returns count: 0 + lastAt: null when no rows", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ c: 0, last_at: null }] });
    const app = await buildApp();
    const res = await request(app).get("/ai/chat/unread");
    expect(res.body).toEqual({ count: 0, lastAt: null });
  });
});

describe("GET /ai/chat/search", () => {
  it("short-circuits queries shorter than 2 chars without hitting the DB", async () => {
    const app = await buildApp();
    const res = await request(app).get("/ai/chat/search?q=a");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ query: "a", results: [] });
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("returns shaped results, converting Postgres sentinels to safe <mark> tags", async () => {
    const ts = new Date("2026-05-15T09:00:00.000Z");
    mockExecute.mockResolvedValueOnce({
      rows: [
        {
          id: "m1",
          role: "assistant",
          created_at: ts,
          project_id: "p1",
          project_slug: "etl-basics",
          project_title: "ETL Basics",
          snippet: "Use [[ATL_MK_OPEN]]airflow[[ATL_MK_CLOSE]] operators",
          rank: 0.42,
        },
      ],
    });
    const app = await buildApp();
    const res = await request(app).get("/ai/chat/search?q=airflow");
    expect(res.status).toBe(200);
    expect(res.body.results[0]).toMatchObject({
      id: "m1",
      role: "assistant",
      snippet: "Use <mark>airflow</mark> operators",
      projectId: "p1",
      projectSlug: "etl-basics",
      projectTitle: "ETL Basics",
      createdAt: "2026-05-15T09:00:00.000Z",
    });
  });

  it("escapes HTML/script payloads in snippets so dangerouslySetInnerHTML is safe", async () => {
    // Simulates a message containing an XSS payload that ts_headline copied
    // verbatim into the snippet around the matched terms.
    mockExecute.mockResolvedValueOnce({
      rows: [
        {
          id: "m2",
          role: "assistant",
          created_at: new Date("2026-05-15T10:00:00.000Z"),
          project_id: null,
          project_slug: null,
          project_title: null,
          snippet:
            `<script>alert('xss')</script> [[ATL_MK_OPEN]]hello[[ATL_MK_CLOSE]] <img src=x onerror="bad()"> "quoted" 'tick' & amp`,
          rank: 0.1,
        },
      ],
    });
    const app = await buildApp();
    const res = await request(app).get("/ai/chat/search?q=hello");
    expect(res.status).toBe(200);
    const snippet = res.body.results[0].snippet as string;
    // Real <mark> tags are emitted from the sentinels.
    expect(snippet).toContain("<mark>hello</mark>");
    // No raw script / event handlers / quotes survive.
    expect(snippet).not.toMatch(/<script/);
    expect(snippet).not.toMatch(/<img/);
    // onerror= text may survive, but it's defanged because the surrounding
    // quote got HTML-escaped. Assert no raw `onerror="` (which would be a
    // live attribute when injected as HTML).
    expect(snippet).not.toMatch(/onerror="/);
    // Payload chars are HTML-entity escaped.
    expect(snippet).toContain("&lt;script&gt;");
    expect(snippet).toContain("&quot;");
    expect(snippet).toContain("&#39;");
    expect(snippet).toContain("&amp;");
  });
});

describe("POST /ai/chat finalize path", () => {
  it("sets aiTutorLastReadAt to the inserted assistant message's createdAt and invalidates the user cache", async () => {
    const assistantCreatedAt = new Date("2026-05-15T13:37:00.000Z");
    insertReturning.mockImplementationOnce(() =>
      Promise.resolve([{ createdAt: assistantCreatedAt }]),
    );

    const app = await buildApp();
    const res = await request(app)
      .post("/ai/chat")
      .send({ message: "explain joins", contextType: "general" });

    expect(res.status).toBe(200);
    // The SSE response ends with [DONE] after the mocked stream completes.
    expect(res.text).toContain("[DONE]");

    // The update spy should have been called with the assistant insert's
    // createdAt, NOT a value close to Date.now(). This is the key invariant:
    // using wall-clock time would let a racing assistant message be marked
    // read before it was even persisted.
    expect(updateSet).toHaveBeenCalled();
    const setPayloads = (updateSet.mock.calls as unknown as Array<[{ aiTutorLastReadAt?: Date }]>).map(c => c[0]);
    const lastReadCall = setPayloads.find(p => p.aiTutorLastReadAt instanceof Date);
    expect(lastReadCall).toBeDefined();
    expect(lastReadCall!.aiTutorLastReadAt!.getTime()).toBe(assistantCreatedAt.getTime());

    // The user-cache invalidation should fire with the resolved user's clerkId
    // so subsequent /ai/chat/unread calls see the fresh value.
    expect(invalidateUserCacheSpy).toHaveBeenCalledWith("clerk_test_user_finalize");
  });

  it("does NOT set lastReadAt or invalidate the cache when the model yields no content", async () => {
    // Empty stream — assistantBuffer stays empty, no assistant row is inserted,
    // and lastReadAt should not be touched.
    anthropicStreamFactory = () => ({ async *[Symbol.asyncIterator]() { /* no chunks */ } });

    const app = await buildApp();
    const res = await request(app)
      .post("/ai/chat")
      .send({ message: "anything", contextType: "general" });

    expect(res.status).toBe(200);
    // No update should target aiTutorLastReadAt.
    const setPayloads = (updateSet.mock.calls as unknown as Array<[{ aiTutorLastReadAt?: Date }]>).map(c => c[0]);
    expect(setPayloads.find(p => p.aiTutorLastReadAt instanceof Date)).toBeUndefined();
    expect(invalidateUserCacheSpy).not.toHaveBeenCalled();
  });
});

describe("/ai/chat/unread freshness", () => {
  it("queries aiTutorLastReadAt directly from the DB (not the cached user row)", async () => {
    // Simulate a stale cached user (lastReadAt = null) but a fresh DB row.
    // The route should still report 0 unread because its CTE reads the DB
    // directly, not the cached value.
    mockExecute.mockResolvedValueOnce({ rows: [{ c: 0, last_at: null }] });
    const app = await buildApp();
    const res = await request(app).get("/ai/chat/unread");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    // The SQL string interpolated by drizzle's sql tag should reference the
    // users table — proves we're not relying solely on the cached row.
    const sqlObj = mockExecute.mock.calls[0]?.[0] as { queryChunks?: unknown[] };
    const flattened = JSON.stringify(sqlObj);
    expect(flattened).toMatch(/users/);
    expect(flattened).toMatch(/ai_tutor_last_read_at/);
  });
});

// =====================================================================
// Phase 34 — Tutor Contract rendered into the system prompt
// =====================================================================
//
// These tests exercise the full path through the project-context branch
// of /ai/chat and assert that the captured system prompt contains the
// per-mode TUTOR CONTRACT block. They also lock the solution-leak
// invariant for independent mode: even with a high attempt count, the
// rendered prompt for a not-passed independent step must include the
// explicit "Do NOT reveal the full solution" clause.

describe("POST /ai/chat — Phase 34 Tutor Contract injection", () => {
  const PROJECT_ID = "22222222-2222-2222-2222-222222222222";
  const STEP_ID = "33333333-3333-3333-3333-333333333333";

  function stubProjectAndStep() {
    projectsFindFirst.mockResolvedValue({
      id: PROJECT_ID,
      title: "ETL Basics",
      slug: "etl-basics",
      shortDescription: "Build a CSV-to-Postgres pipeline.",
      totalSteps: 4,
    });
    projectStepsFindFirst.mockResolvedValue({
      id: STEP_ID,
      stepNumber: 2,
      title: "Define the target schema",
      instructionMd: "Create a CREATE TABLE statement.",
      validationHint: null,
      learningObjective: null,
      requiredSkill: null,
      pedagogyConfig: null,
    });
  }

  async function postChat() {
    const app = await buildApp();
    return request(app).post("/ai/chat").send({
      message: "help",
      contextType: "project",
      contextId: PROJECT_ID,
      stepId: STEP_ID,
    });
  }

  function lastSystemPrompt(): string {
    const calls = streamSpy.mock.calls as unknown as Array<[{ system?: string }]>;
    const last = calls[calls.length - 1]?.[0];
    return last?.system ?? "";
  }

  it("guided mode → contract block with proactive-scaffolded boundary", async () => {
    stubProjectAndStep();
    userProgressFindFirst.mockResolvedValue({ learningMode: "guided" });
    const res = await postChat();
    expect(res.status).toBe(200);
    const sys = lastSystemPrompt();
    expect(sys).toMatch(/TUTOR CONTRACT/);
    expect(sys).toMatch(/learner_mode: guided_ai_assisted/);
    expect(sys).toMatch(/help_boundary: proactive-scaffolded/);
  });

  it("hint mode → progressive-hints boundary + collapsing-the-ladder forbidden", async () => {
    stubProjectAndStep();
    userProgressFindFirst.mockResolvedValue({ learningMode: "hint" });
    const res = await postChat();
    expect(res.status).toBe(200);
    const sys = lastSystemPrompt();
    expect(sys).toMatch(/learner_mode: adaptive_inquiry_ai_assisted/);
    expect(sys).toMatch(/help_boundary: progressive-hints/);
    expect(sys.toLowerCase()).toMatch(/collapse the hint ladder/);
  });

  it("independent + not-passed → diagnostic-only + no solution-leak language", async () => {
    stubProjectAndStep();
    userProgressFindFirst.mockResolvedValue({ learningMode: "independent" });
    userStepCompletionsFindMany.mockResolvedValue([
      { passed: false, attemptCount: 4 },
    ]);
    const res = await postChat();
    expect(res.status).toBe(200);
    const sys = lastSystemPrompt();
    expect(sys).toMatch(/help_boundary: diagnostic-only/);
    expect(sys.toLowerCase()).toMatch(/not reveal the full solution/);
    expect(sys.toLowerCase()).toMatch(/portfolio credibility/);
  });

  it("independent + passed → review-permissive opens up", async () => {
    stubProjectAndStep();
    userProgressFindFirst.mockResolvedValue({ learningMode: "independent" });
    userStepCompletionsFindMany.mockResolvedValue([
      { passed: true, attemptCount: 2 },
    ]);
    const res = await postChat();
    expect(res.status).toBe(200);
    const sys = lastSystemPrompt();
    expect(sys).toMatch(/help_boundary: review-permissive/);
  });

  it("dynamic_ai_adaptive → annotated effective_mode (never left as adaptive)", async () => {
    stubProjectAndStep();
    userProgressFindFirst.mockResolvedValue({ learningMode: "dynamic_ai_adaptive" });
    userStepCompletionsFindMany.mockResolvedValue([
      { passed: false, attemptCount: 3 },
    ]);
    const res = await postChat();
    expect(res.status).toBe(200);
    const sys = lastSystemPrompt();
    expect(sys).toMatch(/learner_mode: dynamic_ai_adaptive/);
    expect(sys).toMatch(/effective_mode \(adaptive resolution\): guided_ai_assisted/);
  });

  it("general (non-project) context → no contract block, only base prompt", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/ai/chat")
      .send({ message: "what is dbt?", contextType: "general" });
    expect(res.status).toBe(200);
    const sys = lastSystemPrompt();
    // The base prompt REFERENCES the contract by name ("TUTOR CONTRACT below"),
    // but in general-context mode no rendered contract block should follow.
    expect(sys).not.toMatch(/TUTOR CONTRACT \(mode-aware policy/);
    expect(sys).not.toMatch(/help_boundary:/);
    expect(sys).toMatch(/Socratic technical learning assistant/);
  });
});
