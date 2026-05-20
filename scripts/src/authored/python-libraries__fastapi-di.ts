/**
 * Phase 7 — python-libraries depth checkpoint project.
 * Promotes candidate 74681082-46ca-4d3c-9bf7-29ea9a563391
 * (FastAPI Dependency Injection at Scale, candidate score 68.6).
 *
 * Validates the authoring helpers on a python project that must be LIFTED
 * from sub-70 — depth/realism scoring carries the score up via real
 * validation + production-shape steps.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const STARTER_S1 = `# Start with a "bad" route handler that constructs every collaborator
# inline. This is the anti-pattern we'll fix step-by-step.
from fastapi import FastAPI
import os
import psycopg

app = FastAPI()

@app.get("/users/{user_id}")
def get_user(user_id: int) -> dict:
    # TODO: this function does three things badly:
    #   1) reads DATABASE_URL itself (no central config)
    #   2) opens a fresh DB connection per request (no pooling)
    #   3) is impossible to test without a real Postgres
    #
    # Refactor: extract two helpers - get_settings() and get_db() - and
    # rewrite the handler so they're INJECTED via fastapi.Depends.
    #
    # For step 1: only build the two helpers. We'll wire them into the
    # handler in step 2.
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        cur.execute("SELECT id, email FROM users WHERE id=%s", (user_id,))
        row = cur.fetchone()
    return {"id": row[0], "email": row[1]} if row else {}

# TODO: implement these two providers:
#   - get_settings() -> Settings (a frozen Pydantic BaseSettings reading env)
#   - get_db() -> Connection (a psycopg connection borrowed from a pool;
#       yield it then put it back)
#
# Use @lru_cache on get_settings so the env is read ONCE per process.
`;

const EXPECTED_S1 = `from functools import lru_cache
from typing import Iterator
from fastapi import Depends
from pydantic_settings import BaseSettings
from psycopg_pool import ConnectionPool

class Settings(BaseSettings):
    database_url: str
    model_config = {"env_file": ".env", "frozen": True}

@lru_cache
def get_settings() -> Settings:
    return Settings()

@lru_cache
def _pool(settings: Settings = Depends(get_settings)) -> ConnectionPool:
    return ConnectionPool(settings.database_url, min_size=1, max_size=10)

def get_db(pool: ConnectionPool = Depends(_pool)) -> Iterator:
    with pool.connection() as conn:
        yield conn`;

const STARTER_S2 = `# Refactor get_user to USE the injected dependencies.
# Goals:
#   - Handler signature accepts (user_id, conn = Depends(get_db))
#   - No more os.environ reads in the handler
#   - No more psycopg.connect() inline
#   - Handler is a pure function of (user_id, conn) and can be unit-tested
#     by passing a stub object that quacks like a Connection.
from fastapi import FastAPI, Depends
# from .deps import get_db    # the providers from step 1

app = FastAPI()

@app.get("/users/{user_id}")
def get_user(user_id: int, conn=Depends(lambda: ...)) -> dict:
    # TODO: replace the lambda with get_db, then use conn.cursor() to query.
    raise NotImplementedError
`;

const EXPECTED_S2 = `from .deps import get_db

@app.get("/users/{user_id}")
def get_user(user_id: int, conn = Depends(get_db)) -> dict:
    with conn.cursor() as cur:
        cur.execute("SELECT id, email FROM users WHERE id=%s", (user_id,))
        row = cur.fetchone()
    return {"id": row[0], "email": row[1]} if row else {}`;

const STARTER_S3 = `# Add a repository layer between the handler and the DB so the handler
# never sees raw SQL. The repository is a class injected via Depends.
from typing import Protocol
from fastapi import Depends, HTTPException
# from .deps import get_db

class User(dict):
    pass

class UserRepository(Protocol):
    def get(self, user_id: int) -> User | None: ...

class PgUserRepository:
    def __init__(self, conn) -> None:
        self.conn = conn
    # TODO: implement .get(user_id) by querying users + returning a User dict
    #       or None.
    def get(self, user_id: int):
        raise NotImplementedError

def get_user_repo(conn=Depends(lambda: ...)) -> UserRepository:
    # TODO: replace lambda with get_db
    return PgUserRepository(conn)

# Handler with TWO levels of injection (get_db -> get_user_repo -> handler)
async def get_user_handler(user_id: int, repo: UserRepository = Depends(get_user_repo)) -> dict:
    user = repo.get(user_id)
    if user is None:
        raise HTTPException(404, "user not found")
    return user
`;

const EXPECTED_S3 = `class PgUserRepository:
    def __init__(self, conn) -> None:
        self.conn = conn
    def get(self, user_id: int):
        with self.conn.cursor() as cur:
            cur.execute("SELECT id, email FROM users WHERE id=%s", (user_id,))
            row = cur.fetchone()
        return User({"id": row[0], "email": row[1]}) if row else None

def get_user_repo(conn = Depends(get_db)) -> UserRepository:
    return PgUserRepository(conn)`;

const STARTER_S4 = `# Test the handler with FastAPI's dependency_overrides — the WHOLE POINT
# of doing DI in the first place. A unit test should NEVER touch real Postgres.
import pytest
from fastapi.testclient import TestClient
# from .app import app
# from .repo import get_user_repo, UserRepository

class FakeRepo:
    def __init__(self, store: dict[int, dict]):
        self.store = store
    def get(self, user_id: int):
        return self.store.get(user_id)

@pytest.fixture
def client():
    # TODO:
    #   1) build a FakeRepo with {1: {"id": 1, "email": "ada@x.com"}}
    #   2) app.dependency_overrides[get_user_repo] = lambda: fake
    #   3) yield TestClient(app)
    #   4) clear the override on teardown so other tests aren't polluted
    raise NotImplementedError

def test_get_user_happy_path(client):
    r = client.get("/users/1")
    assert r.status_code == 200
    assert r.json() == {"id": 1, "email": "ada@x.com"}

def test_get_user_404(client):
    r = client.get("/users/999")
    assert r.status_code == 404
`;

const EXPECTED_S4 = `@pytest.fixture
def client():
    fake = FakeRepo({1: {"id": 1, "email": "ada@x.com"}})
    app.dependency_overrides[get_user_repo] = lambda: fake
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()`;

const STARTER_S5 = `# Authorization as a dependency: gate /users/{user_id} so only the owner
# (or an admin) can read it. Reuse get_user_repo. Bonus: cleanup hook.
from typing import Annotated
from fastapi import Depends, Header, HTTPException
# from .auth import decode_jwt  # given
# from .repo import get_user_repo, UserRepository

class Principal(dict):
    pass

def current_principal(authorization: str = Header(...)) -> Principal:
    # TODO: strip "Bearer ", decode_jwt(token), return Principal({"id":..., "role":...})
    raise NotImplementedError

def require_owner_or_admin(
    user_id: int,
    principal: Principal = Depends(current_principal),
) -> Principal:
    # TODO: allow if principal["role"] == "admin" or principal["id"] == user_id.
    # Otherwise raise HTTPException(403, "forbidden").
    raise NotImplementedError

async def get_user_handler(
    user_id: int,
    _: Principal = Depends(require_owner_or_admin),
    repo = Depends(get_user_repo),
) -> dict:
    user = repo.get(user_id)
    if user is None:
        raise HTTPException(404, "user not found")
    return user
`;

const EXPECTED_S5 = `def current_principal(authorization: str = Header(...)) -> Principal:
    token = authorization.removeprefix("Bearer ").strip()
    claims = decode_jwt(token)
    return Principal({"id": claims["sub"], "role": claims.get("role", "user")})

def require_owner_or_admin(user_id: int, principal: Principal = Depends(current_principal)) -> Principal:
    if principal["role"] == "admin" or principal["id"] == user_id:
        return principal
    raise HTTPException(status_code=403, detail="forbidden")`;

export const pythonLibrariesFastapiDi: AuthoredProject = {
  slug: "python-libraries-fastapi-di",
  candidateId: "74681082-46ca-4d3c-9bf7-29ea9a563391",
  title: "FastAPI Dependency Injection at Scale — From Anti-Pattern to Production",
  shortDescription:
    "Refactor a 'bad' FastAPI handler that owns its config + DB connection + SQL into a layered DI architecture: settings provider, pooled DB dependency, repository interface, override-based tests, and stacked auth dependencies. Production patterns you'll use on every Python backend you ever write.",
  fullDescription:
    "You inherited a FastAPI service from the founder who hand-rolled the MVP. Every route handler opens its own psycopg connection, reads env vars inline, and has SQL strings interleaved with HTTP concerns. Tests don't exist because nothing can be tested without a live Postgres. Your job: refactor it to a layered DI architecture without breaking behavior, then add an auth dependency that turns hand-rolled if statements into a composable `Depends(...)` ladder. By the end the handler is a 3-line pure function of (user_id, repo), every collaborator is overridable in tests, and you've added a stacked authorization dependency that's reused by 12 future routes. This is exactly the refactor every Python backend engineer is asked to lead at some point in their first 18 months on the job.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "FastAPI", "Pydantic", "psycopg", "pytest"],
  tags: ["fastapi", "pydantic", "python", "dependency-injection", "pytest", "postgres", "backend", "rest"],
  learningObjectives: [
    "Extract a frozen Pydantic Settings provider and an lru_cached pool provider so config is read once per process.",
    "Inject a pooled DB connection via `Depends(get_db)` with a yield-based provider.",
    "Layer a repository abstraction between the handler and SQL with a Protocol for structural typing.",
    "Use `app.dependency_overrides` + a Fake repository to test handlers WITHOUT touching real Postgres.",
    "Stack an authorization `Depends(require_owner_or_admin)` on top of the existing DI chain to gate access.",
  ],
  estimatedMinutes: 165,
  xpReward: 550,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Inherited FastAPI MVP from a founder. Handlers own their own config + DB connection + SQL. Tests are impossible. Refactor to production DI architecture without breaking behavior.",
    hiringRelevance2026:
      "Every 2026 Python backend posting expects FastAPI + Pydantic + DI. Mid-level interviews ask 'how would you test this handler without a real DB?' — the answer is exactly the dependency_overrides pattern in step 4. Senior interviews ask 'how would you add auth without copy-pasting if statements into 30 handlers?' — exactly step 5.",
    readmeOutline: [
      "Overview & Scenario",
      "Before / After architecture diagram",
      "Step 1 — Settings + pooled DB providers",
      "Step 2 — Inject the DB into the handler",
      "Step 3 — Repository abstraction with Protocol",
      "Step 4 — dependency_overrides for unit tests",
      "Step 5 — Stacked auth dependency",
      "Running locally (docker-compose Postgres)",
      "Test suite (pytest + asyncio + TestClient)",
      "Portfolio Hand-off (repo + before/after metrics)",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with the BEFORE and AFTER versions tagged as separate commits + a `/docs/refactor.md` walking through each step with the diff. Includes the full pytest suite (target: >85% line coverage), docker-compose Postgres, and a GitHub Actions workflow running tests on PR.",
    portfolioRelevance:
      "A 2026 backend hiring manager opening this repo sees a real BEFORE/AFTER refactor with the diff explained step-by-step. That's exactly the artifact senior interviews ask for ('walk me through a refactor you led') — most candidates have only narrative; you have the commits.",
    repoUrl: "https://github.com/<your-handle>/fastapi-di-at-scale",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Settings + pooled DB providers",
      instructionMd: [
        "Build the two foundation providers: `get_settings()` returning a frozen `Settings(BaseSettings)` and `get_db()` yielding a pooled `psycopg` connection.",
        "",
        "**Settings** should be a `pydantic_settings.BaseSettings` with `model_config = {'env_file': '.env', 'frozen': True}` so the object is immutable. Wrap `get_settings` in `@lru_cache` so env reads happen exactly once per process.",
        "",
        "**Pool**: use `psycopg_pool.ConnectionPool(settings.database_url, min_size=1, max_size=10)` inside a separate `@lru_cache`d provider. `get_db()` itself is a generator: `with pool.connection() as conn: yield conn` — FastAPI handles the close on response.",
        "",
        "Validator imports the module + instantiates both providers and asserts (a) `get_settings()` returns the same object on a second call (lru_cache), (b) `get_db()` yields a context-managed connection.",
      ].join("\n"),
      learningObjective: "Extract config + pool providers so they're read once per process and injectable everywhere.",
      requiredSkill: "FastAPI Depends + Pydantic BaseSettings + psycopg_pool + lru_cache + yield-based providers",
      starterCode: STARTER_S1,
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig(
        "json_equal",
        "get_settings() is idempotent (is-equal on second call) and get_db() yields a usable connection.",
        {
          asserts: [
            "id(get_settings()) == id(get_settings())  # lru_cache",
            "Settings.model_config.get('frozen') is True",
            "next(get_db.__wrapped__(pool=fake_pool)) is not None  # yields a connection",
          ],
          referenceSolution: EXPECTED_S1,
        },
      ),
      expectedOutputs: { settingsLruCached: true, poolMaxSize: 10 },
      datasetRefs: ["fixtures/env_example", "fixtures/pool_smoke_test.py"],
      pedagogy: pedagogyConfig({
        hints: [
          "Two providers, two cache scopes. Settings should be read ONCE per process. The connection pool should also be ONCE per process — but each request borrows a connection, not the pool itself.",
          "Wrap both `get_settings` and the pool-builder in `@lru_cache`. The connection-borrow function is NOT cached — it's a generator that yields a fresh connection per request.",
          "Use `pydantic_settings.BaseSettings` with `model_config = {'env_file': '.env', 'frozen': True}` — frozen so misuse (`settings.database_url = '...'`) raises instead of silently mutating a 'singleton'.",
          "@lru_cache\ndef get_settings() -> Settings: return Settings()\n\n@lru_cache\ndef _pool(settings: Settings = Depends(get_settings)) -> ConnectionPool:\n    return ConnectionPool(settings.database_url, min_size=1, max_size=10)\n\ndef get_db(pool: ConnectionPool = Depends(_pool)) -> Iterator:\n    with pool.connection() as conn: yield conn",
          EXPECTED_S1,
        ],
        successFeedback:
          "Two providers, one process-lifetime, one request-lifetime. This is the foundation every other dependency in the codebase will build on.",
        failureFeedback:
          "Common slips: forgot `@lru_cache` (every request re-reads env / re-builds pool — 10× latency hit); cached `get_db` itself (now every request shares ONE connection — race conditions galore); didn't `yield` in `get_db` so FastAPI never closes the connection.",
        portfolioRelevance:
          "Mid-level Python interviews ask 'how do you avoid reading env vars in every handler?' — the lru_cached Settings provider is the textbook answer. Senior interviews ask the same about DB pooling.",
        finalExplanation:
          "The cache-scope mental model is everything: `@lru_cache` on providers that should be singleton per process (settings, pool, http client); `yield`-based providers for resources borrowed per request (db connection, db transaction, request-scoped span). Getting this wrong is the #1 cause of production incidents in FastAPI services — usually 'why is everyone seeing each other's data?' (you cached a request-scoped object) or 'why is latency 500ms?' (you forgot to cache a session-scoped one).",
        misconceptionToWatchFor:
          "Caching `get_db` because 'pooling means one connection right?'. No — pooling means one POOL, many connections borrowed and returned. Caching the borrow turns the service into single-connection blocking.",
      }),
    },
    {
      stepNumber: 2,
      title: "Inject the DB into the handler",
      instructionMd: [
        "Refactor `get_user` so it takes the DB as a `Depends(get_db)` parameter. No more `os.environ` reads or `psycopg.connect` in the handler.",
        "",
        "After the refactor the function signature should be `def get_user(user_id: int, conn = Depends(get_db)) -> dict`. The body becomes 3 lines: open cursor, execute, fetchone.",
        "",
        "Validator boots the app, overrides `get_db` with a stub that returns a fake cursor, and asserts the handler is now invocable WITHOUT real Postgres.",
      ].join("\n"),
      learningObjective: "Inject the DB connection via Depends so the handler becomes a pure function of (user_id, conn).",
      requiredSkill: "FastAPI Depends parameter + handler refactor",
      starterCode: STARTER_S2,
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig(
        "json_equal",
        "Handler signature includes Depends(get_db); GET /users/1 returns {id:1, email:'ada@x.com'} when get_db is overridden with a FakeConn returning that row.",
        {
          expectedSignature: "(user_id: int, conn = Depends(get_db)) -> dict",
          expectedResponse: { id: 1, email: "ada@x.com" },
          referenceSolution: EXPECTED_S2,
        },
      ),
      expectedOutputs: { signatureContains: "Depends(get_db)", responseStatus: 200 },
      datasetRefs: ["fixtures/fake_conn.py"],
      pedagogy: pedagogyConfig({
        hints: [
          "The handler should not know HOW to connect to a database. It should only know that it RECEIVES one. What's the smallest change to the signature that makes that true?",
          "Add a second parameter to `get_user`: `conn = Depends(get_db)`. Then use `conn.cursor()` inside instead of `psycopg.connect(...)`.",
          "Don't forget to import `Depends` from fastapi and import `get_db` from your deps module.",
          "@app.get('/users/{user_id}')\ndef get_user(user_id: int, conn = Depends(get_db)) -> dict:\n    with conn.cursor() as cur:\n        cur.execute('SELECT id, email FROM users WHERE id=%s', (user_id,))\n        row = cur.fetchone()\n    return {'id': row[0], 'email': row[1]} if row else {}",
          EXPECTED_S2,
        ],
        successFeedback:
          "Handler is now a function of inputs only — no module-level state, no env reads, no connection management. This is the foundation that makes step 4's tests possible.",
        failureFeedback:
          "Common slips: still calling `psycopg.connect(...)` inside (didn't actually use the injected `conn`); used `conn = get_db()` (a generator, not a connection); forgot to import `Depends`.",
        portfolioRelevance:
          "'Refactored handlers from owning connections to receiving them' is a 5-second talking point that conveys you understand DI's purpose, not just its syntax.",
        finalExplanation:
          "The handler went from 7 lines of mixed concerns (env + connection + SQL + response shape) to 3 lines of business logic (SQL + response shape). The two missing concerns moved UP into providers that can be cached, swapped, or stubbed independently. This is what 'separation of concerns' actually means in practice.",
        misconceptionToWatchFor:
          "Calling `next(get_db())` inside the handler. That works but defeats the entire point — FastAPI now can't override the dependency in tests because you bypassed the injection.",
      }),
    },
    {
      stepNumber: 3,
      title: "Repository abstraction with Protocol",
      instructionMd: [
        "Lift the SQL out of the handler entirely. Add `UserRepository` (a `Protocol`) + `PgUserRepository(conn)` (the concrete implementation). The handler now depends on `UserRepository`, not on a raw connection.",
        "",
        "`UserRepository` is a `typing.Protocol` — structural typing, no inheritance required. Anything with a `.get(user_id) -> User | None` method qualifies. This is what makes the `FakeRepo` in step 4 work without subclassing.",
        "",
        "Wire `get_user_repo(conn = Depends(get_db)) -> UserRepository` so the repo is built per request from the per-request connection. The handler is now `get_user(user_id, repo = Depends(get_user_repo))`.",
        "",
        "Validator asserts (a) `PgUserRepository.get()` returns a `User`-shaped dict given a row, `None` given no row; (b) the handler signature uses `repo: UserRepository = Depends(get_user_repo)`.",
      ].join("\n"),
      learningObjective: "Layer a repository abstraction with a Protocol so the handler depends on an interface, not on SQL.",
      requiredSkill: "Python typing.Protocol + Repository pattern + nested Depends chains",
      starterCode: STARTER_S3,
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig(
        "json_equal",
        "PgUserRepository(fake_conn).get(1) returns {'id':1,'email':'ada@x.com'}; .get(999) returns None; handler signature uses Depends(get_user_repo).",
        {
          assertGet1: { id: 1, email: "ada@x.com" },
          assertGet999: null,
          expectedSignatureFragment: "Depends(get_user_repo)",
          referenceSolution: EXPECTED_S3,
        },
      ),
      expectedOutputs: { foundRow: { id: 1, email: "ada@x.com" }, missingRow: null },
      datasetRefs: ["fixtures/users_seed.sql", "fixtures/fake_conn.py"],
      pedagogy: pedagogyConfig({
        hints: [
          "The handler currently knows two things it shouldn't: the SQL string and the cursor API. Hide both behind one method on a Protocol.",
          "`PgUserRepository.__init__(self, conn)` stores the conn; `.get(user_id)` runs the SELECT and returns the row dict OR None.",
          "Stack the Depends: `get_user_repo(conn = Depends(get_db))` returns `PgUserRepository(conn)`. The handler then uses `Depends(get_user_repo)` directly.",
          "class PgUserRepository:\n    def __init__(self, conn): self.conn = conn\n    def get(self, user_id):\n        with self.conn.cursor() as cur:\n            cur.execute('SELECT id, email FROM users WHERE id=%s', (user_id,))\n            row = cur.fetchone()\n        return User({'id': row[0], 'email': row[1]}) if row else None\n\ndef get_user_repo(conn = Depends(get_db)) -> UserRepository:\n    return PgUserRepository(conn)",
          EXPECTED_S3,
        ],
        successFeedback:
          "Handler no longer knows it's talking to SQL. Swapping in Redis, an in-memory cache, or a fake for tests is now a one-line provider change.",
        failureFeedback:
          "Common slips: made `UserRepository` an `ABC` (works but forces inheritance — Protocol is the modern Python way); returned a tuple from `.get` (now the handler has to unpack — defeats the abstraction); forgot `Optional` and crashed on missing rows.",
        portfolioRelevance:
          "The Repository + Protocol pattern is a senior-Python signal — it shows you understand structural typing AND know when to introduce an abstraction layer (and when not to).",
        finalExplanation:
          "`typing.Protocol` is Python's answer to Go interfaces or Rust traits — structural typing without inheritance. `FakeRepo` in step 4 doesn't have to subclass anything; it just has to have a `.get(user_id) -> ...` method. This is dramatically lighter-weight than ABCs and is the idiomatic Python pattern in 2026+ code (PEP 544, Python ≥3.8).",
        misconceptionToWatchFor:
          "Introducing the Repository pattern for tiny CRUD-only services. It's overkill for 3-route prototypes. The signal it's worth it: you have 2+ implementations, or you want unit-tests without a DB, or business logic is growing inside handlers.",
      }),
    },
    {
      stepNumber: 4,
      title: "Unit-test the handler with dependency_overrides",
      instructionMd: [
        "Now reap the rewards. Build a pytest fixture that overrides `get_user_repo` with a `FakeRepo` and yields a `TestClient`. Write two tests: happy-path and 404.",
        "",
        "Pattern:",
        "```python",
        "app.dependency_overrides[get_user_repo] = lambda: fake",
        "try: yield TestClient(app)",
        "finally: app.dependency_overrides.clear()",
        "```",
        "",
        "The `try / finally` matters — if a test errors and you don't clear overrides, OTHER tests in the suite inherit a polluted app and false-pass.",
        "",
        "Validator runs the two tests against the fixture and asserts both pass without any Postgres connection being attempted.",
      ].join("\n"),
      learningObjective: "Use `app.dependency_overrides` to unit-test handlers in complete isolation from Postgres.",
      requiredSkill: "pytest fixtures + FastAPI dependency_overrides + TestClient",
      starterCode: STARTER_S4,
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig(
        "json_equal",
        "Both tests pass; no real connection is opened; overrides cleared on teardown (a third test that does NOT install an override fails fast, proving cleanup).",
        {
          expectedTestResults: { test_get_user_happy_path: "passed", test_get_user_404: "passed" },
          assertNoDbConnectionOpened: true,
          referenceSolution: EXPECTED_S4,
        },
      ),
      expectedOutputs: { happyPath: "passed", notFound: "passed" },
      datasetRefs: ["fixtures/fake_repo.py"],
      pedagogy: pedagogyConfig({
        hints: [
          "The fixture's job is two-step: install the override, then make sure it's gone after the test (even on failure). Which Python construct guarantees that 'even on failure' part?",
          "`try / finally` around `yield`. Build the FakeRepo, install the override, `yield TestClient(app)`, then in `finally` call `app.dependency_overrides.clear()`.",
          "FakeRepo has the same `.get(user_id)` method shape as PgUserRepository. The Protocol from step 3 means it qualifies as a `UserRepository` without inheritance.",
          "@pytest.fixture\ndef client():\n    fake = FakeRepo({1: {'id':1,'email':'ada@x.com'}})\n    app.dependency_overrides[get_user_repo] = lambda: fake\n    try:\n        yield TestClient(app)\n    finally:\n        app.dependency_overrides.clear()",
          EXPECTED_S4,
        ],
        successFeedback:
          "Handler is unit-tested. The test runs in 5ms (no DB), is fully deterministic, and the cleanup pattern keeps the suite safe.",
        failureFeedback:
          "Common slips: forgot the `finally` cleanup (next test inherits the override and passes for the wrong reason); installed the override on the wrong key (`get_db` instead of `get_user_repo` — wrong layer for the fake); used `Mock` instead of a real FakeRepo (Mocks coerce to truthy, hiding logic bugs).",
        portfolioRelevance:
          "'I unit-test FastAPI handlers without docker-compose, using dependency_overrides + Protocol fakes' is the answer mid/senior interviewers want when they ask 'how testable is your codebase?'.",
        finalExplanation:
          "The override mechanism is the entire payoff of doing DI: you don't need monkey-patching, `unittest.mock.patch`, or a real DB to test handlers — you swap one provider with another. Combined with the Protocol from step 3, your fake is just a class with the right methods. No inheritance, no `__init__` boilerplate, no setup hell. This is how mature Python codebases hit 90%+ coverage without integration-test sprawl.",
        misconceptionToWatchFor:
          "Reaching for `unittest.mock.patch('app.deps.get_db')` instead of `app.dependency_overrides[...]`. The patch approach works but is fragile (string paths!) and bypasses FastAPI's per-request resolution. `dependency_overrides` is the supported API.",
      }),
    },
    {
      stepNumber: 5,
      title: "Stack an auth dependency on the handler",
      instructionMd: [
        "Add `current_principal` (decodes JWT from `Authorization: Bearer`) and `require_owner_or_admin` (raises 403 unless the principal is admin or the resource owner). Then stack them on the existing handler.",
        "",
        "Note `require_owner_or_admin` depends on BOTH the path param `user_id` and the principal — FastAPI happily resolves a path param AS a dependency input. This is the whole reason Depends composes.",
        "",
        "Final handler signature: `get_user(user_id, _ = Depends(require_owner_or_admin), repo = Depends(get_user_repo))`. The auth dep returns the principal but we don't use it in the body — the `_` name is convention for 'I depend on this for the side effect (auth check) but don't need the value'.",
        "",
        "Validator runs three scenarios: (1) owner token → 200; (2) admin token → 200; (3) other-user token → 403.",
      ].join("\n"),
      learningObjective: "Layer an authorization dependency on top of an existing DI chain to gate handler access without polluting business logic.",
      requiredSkill: "FastAPI Depends composition + Header dependency + HTTPException semantics + JWT decoding",
      starterCode: STARTER_S5,
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig(
        "json_equal",
        "GET /users/1 with owner token → 200; with admin token → 200; with other-user token → 403.",
        {
          scenarios: [
            { token: "owner-of-1", expectedStatus: 200 },
            { token: "admin",      expectedStatus: 200 },
            { token: "other-user", expectedStatus: 403 },
          ],
          referenceSolution: EXPECTED_S5,
        },
      ),
      expectedOutputs: { owner: 200, admin: 200, other: 403 },
      datasetRefs: ["fixtures/jwt_tokens.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "FastAPI dependencies can depend on path params. That's the whole trick that makes 'resource-aware auth' a one-liner instead of a copy-paste pattern.",
          "`current_principal` reads the `Authorization` header (via `Header(...)`), strips the Bearer prefix, decodes the JWT, and returns a Principal dict.",
          "`require_owner_or_admin` accepts `user_id: int` (path-param input!) and the resolved principal, returns the principal if allowed, raises 403 otherwise.",
          "def current_principal(authorization: str = Header(...)) -> Principal:\n    token = authorization.removeprefix('Bearer ').strip()\n    claims = decode_jwt(token)\n    return Principal({'id': claims['sub'], 'role': claims.get('role','user')})\n\ndef require_owner_or_admin(user_id: int, principal: Principal = Depends(current_principal)) -> Principal:\n    if principal['role'] == 'admin' or principal['id'] == user_id:\n        return principal\n    raise HTTPException(status_code=403, detail='forbidden')",
          EXPECTED_S5,
        ],
        successFeedback:
          "Resource-aware auth as a stacked dependency. The same `require_owner_or_admin` works on any route with a `user_id` path param — no copy-pasted if statements anywhere.",
        failureFeedback:
          "Common slips: returned 401 instead of 403 (401 = 'who are you?', 403 = 'I know who you are and you can't do this'); forgot to handle missing Bearer prefix; let admins through but compared `user_id == principal['id']` as string-vs-int.",
        portfolioRelevance:
          "Senior backend interviews ask 'how do you avoid copy-pasting auth checks into every handler?'. 'Stacked Depends with a resource-aware auth provider' is the modern FastAPI answer; 'middleware' is the old answer (doesn't see path params).",
        finalExplanation:
          "Two ideas combined: (1) `Depends(...)` composes — a dependency can itself depend on path params, headers, queries, and other dependencies; (2) raising `HTTPException` from inside a dependency short-circuits the handler entirely — the body never runs. This is strictly more powerful than middleware (which can't see path-param values) and strictly safer than per-handler if-checks (which are easy to forget on the next new route).",
        misconceptionToWatchFor:
          "Using middleware for authorization. Middleware runs BEFORE FastAPI parses path params, so a middleware-based 'owner check' has to re-parse the URL itself — fragile and duplicative. Dependencies are the right layer.",
      }),
    },
  ],
};
