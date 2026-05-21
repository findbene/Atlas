/**
 * Phase 13 — python-libraries course-seed (net-new). Lifts the
 * `python-libraries` course from 2 → 3 learner-visible projects.
 *
 * Candidate 13697ce4-79f0-44aa-9dde-d64758697a92 — Pydantic v2 settings +
 * Typer CLI: type-safe nested config, env-var precedence, secret redaction
 * in logs, validation errors that point to the source field, and a CLI
 * subcommand graph wired off the typed config.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const pythonLibrariesPydanticConfigAndCli: AuthoredProject = {
  slug: "python-libraries-pydantic-config-and-cli",
  candidateId: "13697ce4-79f0-44aa-9dde-d64758697a92",
  title: "Pydantic v2 Settings + Typer CLI — Type-Safe Config the Right Way",
  shortDescription:
    "Build a production-grade Python config + CLI: nested Pydantic settings, deterministic env-var precedence, automatic secret redaction in logs, structured validation errors, and a Typer subcommand graph driven by the typed config.",
  fullDescription:
    "Most Python services grow a config layer that's part `os.environ.get()`, part argparse, part YAML. By month 6 it's untyped, undocumented, and unsafe — and the day production logs a secret in plaintext is the day you wish you'd built it once, correctly. You'll wire Pydantic v2 settings (typed, validated, hierarchical) + Typer (the modern CLI). Precedence is explicit (CLI > env > .env > defaults), nested fields work, validation errors point to the offending field with a clear message, and `SecretStr` keeps API keys out of `repr()` + logs. The final CLI runs three subcommands all driven by the same typed config tree.",
  language: "python",
  difficulty: "intermediate",
  techStack: ["Python", "pydantic-v2", "pydantic-settings", "typer", "structlog"],
  tags: ["python", "pydantic", "typer", "config", "cli", "secrets", "validation"],
  learningObjectives: [
    "Model nested config with `BaseSettings` + sub-models — type-safe end-to-end.",
    "Implement deterministic precedence: CLI flag > env var > .env file > default.",
    "Use `SecretStr` so `__repr__`, `model_dump`, and structlog never leak secrets.",
    "Surface validation errors as user-friendly messages pointing to the offending field.",
    "Wire a Typer subcommand graph that receives the typed Settings object via dependency.",
  ],
  estimatedMinutes: 195,
  xpReward: 660,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Backend engineer on a 2026 SaaS platform. The CLI tool ops uses to seed envs grew organically into 600 lines of argparse + os.getenv with secrets occasionally appearing in CloudWatch. You're rebuilding it as a typed-config + Typer CLI before the next compliance audit.",
    hiringRelevance2026:
      "Typed config + secret hygiene is a portfolio differentiator. Most candidates show argparse + os.environ; few show Pydantic-v2 settings + SecretStr + Typer with proper validation surfacing. This is exactly what modern Python platform teams ask for.",
    readmeOutline: [
      "Overview & Anti-Patterns We're Replacing", "Setup (uv + pyproject)",
      "Step 1 nested settings model", "Step 2 precedence + .env loading",
      "Step 3 SecretStr + log redaction", "Step 4 validation error surfacing",
      "Step 5 Typer subcommand graph", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo: a `seedctl` CLI with subcommands `seedctl db migrate`, `seedctl s3 sync`, `seedctl notify`, all driven from a single typed Settings tree. Includes a `tests/test_precedence.py` proving the precedence chain, a `tests/test_secrets.py` proving SecretStr is never logged, and a `--help` screenshot in the README.",
    portfolioRelevance:
      "A CLI repo that shows typed config + secret hygiene + proper validation messages is rare. This is a 'show, don't tell' artifact for backend roles and is small enough to actually be read by a hiring manager in under 10 minutes.",
    repoUrl: "https://github.com/<your-handle>/seedctl-pydantic-typer",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Nested BaseSettings model — Database + S3 + Notify, all typed",
      instructionMd:
        "Define a `Settings(BaseSettings)` with three nested sub-models: `DatabaseSettings(host, port:int, name, user)`, `S3Settings(bucket, region, endpoint_url:HttpUrl|None)`, `NotifySettings(slack_webhook:HttpUrl|None, default_channel)`. Each field has a sensible default OR is required. Validator instantiates `Settings()` with all values provided via constructor; asserts every field has the right type (port is int, endpoint_url is HttpUrl, etc.) and `Settings().model_dump()` round-trips.",
      learningObjective: "`BaseSettings` is `BaseModel` + automatic env loading. Nesting works via sub-models on attributes — no `env_nested_delimiter` ceremony needed in pydantic v2 if you wire it right.",
      requiredSkill: "Pydantic v2 BaseSettings + nested sub-models + field-level types",
      starterCode: SRC(`# settings.py
from pydantic import BaseModel, HttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class DatabaseSettings(BaseModel):
    host: str = "localhost"
    port: int = 5432
    name: str = "app"
    user: str = "app"

class S3Settings(BaseModel):
    bucket: str
    region: str = "us-east-1"
    endpoint_url: Optional[HttpUrl] = None

class NotifySettings(BaseModel):
    slack_webhook: Optional[HttpUrl] = None
    default_channel: str = "#ops"

class Settings(BaseSettings):
    # TODO: nest the 3 sub-models; default_factory so each gets a fresh instance.
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    s3:       S3Settings       = Field(default_factory=lambda: S3Settings(bucket="missing"))
    notify:   NotifySettings   = Field(default_factory=NotifySettings)
    env_name: str = "dev"

    model_config = SettingsConfigDict(env_nested_delimiter="__")
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Settings() with explicit kwargs round-trips through model_dump(); types are coerced (port=str -> int; endpoint_url=str -> HttpUrl).", {
        expected: {
          shape: { database: ["host", "port", "name", "user"], s3: ["bucket", "region", "endpoint_url"], notify: ["slack_webhook", "default_channel"], env_name: "string" },
          portIsInt: true,
          endpointIsUrl: true,
        },
      }),
      expectedOutputs: { shapeOk: true, typesCoerced: true, roundTrip: true },
      datasetRefs: ["fixtures/settings_kwargs.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Nesting in pydantic-settings v2 is just attribute-typed sub-models — no special syntax needed.",
          "`env_nested_delimiter='__'` lets `DATABASE__PORT=5432` map to `settings.database.port` (used in step 2).",
          "Use `Field(default_factory=...)` for nested models, NOT a bare instance default — bare instances are shared between Settings instances and mutations leak.",
          "Annotate types you actually want (`HttpUrl`, `int`, `Path`) — pydantic coerces strings on input, which is what you want for env vars.",
          "Settings.model_config = SettingsConfigDict(env_nested_delimiter='__')",
        ],
        successFeedback: "Typed nested config done in 30 lines — and every field is validated on construction.",
        failureFeedback: "Most slips: bare sub-model default (shared state bug); using string for fields that should be HttpUrl (loses validation).",
        portfolioRelevance: "Pydantic-v2 BaseSettings is the modern Python config standard. Showing nested + typed is portfolio-level discipline.",
        finalExplanation: "BaseSettings = BaseModel + automatic env loading. Treat config as data with types, not a dict.",
        misconceptionToWatchFor: "Treating BaseSettings like a dict (`.get('database.port')`). It's a typed object — use attribute access, get full type checking.",
      }),
    },
    {
      stepNumber: 2,
      title: "Precedence — CLI flag > env > .env > default, deterministic",
      instructionMd:
        "Write `Settings.customise_sources` so the lookup order is: (1) `init_settings` (constructor kwargs / CLI), (2) `env_settings` (os.environ), (3) `dotenv_settings` (`.env`), (4) defaults. Validator: with `DATABASE__PORT=6000` in env AND `port=7000` in `.env` AND constructor kwarg `database={port: 8000}`, asserts the final value is 8000 (CLI wins). With env-only, the final value is 6000. With dotenv-only, the final value is 7000.",
      learningObjective: "Precedence chain MUST be explicit — silent default-resolution at the wrong layer is the #1 source of 'works on my machine' config bugs.",
      requiredSkill: "customise_sources hook + .env loading + deterministic source ordering",
      starterCode: SRC(`# settings.py (extends step 1)
from pydantic_settings import BaseSettings, SettingsConfigDict, PydanticBaseSettingsSource
from typing import Type, Tuple

class Settings(BaseSettings):
    # ... fields from step 1 ...
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
    )

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: Type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> Tuple[PydanticBaseSettingsSource, ...]:
        # TODO: order = init_settings > env_settings > dotenv_settings > file_secret_settings
        return (init_settings, env_settings, dotenv_settings, file_secret_settings)
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "3 precedence scenarios: cli-set port=8000, env-set port=6000, dotenv-set port=7000. Each yields the right value.", {
        expected: { cliWinsPort: 8000, envWinsPort: 6000, dotenvWinsPort: 7000 },
      }),
      expectedOutputs: { cliWins: 8000, envWins: 6000, dotenvWins: 7000 },
      datasetRefs: ["fixtures/precedence_scenarios.json", "fixtures/dotenv_sample.env"],
      pedagogy: pedagogyConfig({
        hints: [
          "Pydantic-v2 settings has a `settings_customise_sources` classmethod — the return-tuple order IS the precedence order, highest first.",
          "Default order is (init, env, dotenv, file_secret) — usually correct, but make it explicit so it's audit-trail-able.",
          "Constructor kwargs override env override .env. CLI maps to constructor kwargs via Typer.",
          "`.env` IS NOT secret storage — it's a developer convenience. Real secrets go in env from a secret manager.",
          "return (init_settings, env_settings, dotenv_settings, file_secret_settings)",
        ],
        successFeedback: "Precedence chain is now deterministic + audit-trail-able.",
        failureFeedback: "Most slips: relying on undocumented default order; mixing dotenv + os.environ logic by hand (always inconsistent).",
        portfolioRelevance: "Explicit precedence is a 'we thought about this' senior signal. Show the test that proves each layer wins in the right scenario.",
        finalExplanation: "Config precedence is a contract with whoever runs your service. Document it; test it; never let it depend on import order.",
        misconceptionToWatchFor: "Believing pydantic-settings does the right thing by default. The default IS right for most cases — but ASSUMING it is wrong is what bites teams later.",
      }),
    },
    {
      stepNumber: 3,
      title: "SecretStr + log redaction — secrets never appear in repr or structlog",
      instructionMd:
        "Add `db_password: SecretStr` and `slack_token: SecretStr` to settings. Configure structlog so any value that is a `SecretStr` is rendered as `'***'` in JSON logs. Validator: `log.info('starting', settings=settings)` produces a JSON line where `db_password='***'` and `slack_token='***'`, NEVER the actual secret. `repr(settings)` also redacts. `settings.db_password.get_secret_value()` returns the real value when needed.",
      learningObjective: "Secret hygiene = secrets are a different type that requires explicit unwrap. Then `__repr__` and serializers can't accidentally leak them.",
      requiredSkill: "SecretStr + structlog processor + safe `get_secret_value` access",
      starterCode: SRC(`# logging_setup.py
import structlog
from pydantic import SecretStr
from typing import Any

def redact_secrets(_logger, _method, event_dict: dict) -> dict:
    """Recursively replace SecretStr instances with '***' before serialization."""
    def walk(v: Any) -> Any:
        if isinstance(v, SecretStr):
            return "***"
        if isinstance(v, dict):
            return {k: walk(x) for k, x in v.items()}
        if isinstance(v, list):
            return [walk(x) for x in v]
        if hasattr(v, "model_dump"):
            return walk(v.model_dump())
        return v
    return {k: walk(v) for k, v in event_dict.items()}

def configure_logging() -> None:
    structlog.configure(
        processors=[
            # TODO: ordering matters — redact BEFORE any serializer that calls __repr__.
            redact_secrets,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
    )
`),
      validationType: "contains",
      stepType: "code_python",
      validation: validationConfig("contains", "JSON log line for settings contains '***' for db_password + slack_token; never the actual secret string.", {
        forbidden: ["super-secret-pw-42", "xoxb-real-token-9001"],
        required: ['"db_password": "***"', '"slack_token": "***"'],
      }),
      expectedOutputs: { secretsRedacted: true, getSecretValueWorks: true },
      datasetRefs: ["fixtures/log_redaction_input.json", "fixtures/log_redaction_expected.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "`SecretStr` is just a wrapper — its `__repr__` returns `SecretStr('**********')` even without your processor. The processor catches `model_dump()` paths.",
          "Always put the redactor BEFORE any serializer in the structlog chain.",
          "Use `get_secret_value()` only at the boundary (e.g. when handing the password to the DB driver).",
          "Even with `SecretStr`, do NOT log the entire settings object via `repr()` somewhere unprocessed — your processor only runs in the structlog chain.",
          "structlog.configure(processors=[redact_secrets, JSONRenderer()])",
        ],
        successFeedback: "Secrets are now structurally unleak-able. The processor is the safety net; the type is the contract.",
        failureFeedback: "Most slips: printing settings with `print()` (bypasses structlog entirely); calling `get_secret_value()` early then passing the str around (defeats the wrapper).",
        portfolioRelevance: "A test proving secrets never appear in logs is what compliance auditors love to see. Pin it.",
        finalExplanation: "Secrets need to be a different TYPE, not a convention. Then your logger physically can't leak them without your processor returning the real value.",
        misconceptionToWatchFor: "Believing 'I just won't print the password' is sufficient. The leak is always the third-party logger you forgot about, not the explicit print.",
      }),
    },
    {
      stepNumber: 4,
      title: "Validation errors that point to the offending field",
      instructionMd:
        "Wrap `Settings()` instantiation in a `load_settings()` function that catches `ValidationError` and re-raises a `ConfigError` whose message is `'Invalid config: <field-path>: <reason>'` for each error in `e.errors()`. Validator runs with `S3__BUCKET=` (empty) + `DATABASE__PORT=not-an-int`; asserts the raised message contains both `s3.bucket` and `database.port`, AND a reason for each.",
      learningObjective: "Validation errors are most of the value of typed config — but only if they're presented as user-fixable messages, not Python stack traces.",
      requiredSkill: "ValidationError.errors() shape + user-friendly error surfacing",
      starterCode: SRC(`# loader.py
from pydantic import ValidationError
from .settings import Settings

class ConfigError(Exception):
    pass

def load_settings() -> Settings:
    try:
        return Settings()
    except ValidationError as e:
        # TODO: pydantic v2 errors() returns dicts with 'loc' (tuple) + 'msg'.
        lines = []
        for err in e.errors():
            field_path = ".".join(str(p) for p in err["loc"])
            lines.append(f"  - {field_path}: {err['msg']}")
        raise ConfigError(
            "Invalid config — fix the following and retry:\\n" + "\\n".join(lines)
        ) from e
`),
      validationType: "contains",
      stepType: "code_python",
      validation: validationConfig("contains", "ConfigError message mentions both s3.bucket and database.port with a reason each.", {
        required: ["s3.bucket", "database.port", "Invalid config"],
      }),
      expectedOutputs: { configErrorRaised: true, mentionsBothFields: true },
      datasetRefs: ["fixtures/invalid_env_scenario.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "`ValidationError.errors()` returns a list of `{loc: tuple, msg: str, type: str}` dicts — join `loc` with `.` for a Python-style path.",
          "Wrap the raw error in `ConfigError` so the CLI doesn't dump a stack trace to a poor ops person.",
          "Use `raise ConfigError(...) from e` so the chain is preserved when debugging.",
          "Reporting only the first error is hostile — fix-and-retry loops are slow. Report them ALL at once.",
          'field_path = ".".join(str(p) for p in err["loc"])',
        ],
        successFeedback: "Config errors now read like a checklist instead of a Python autopsy.",
        failureFeedback: "Most slips: only reporting first error (slow fix cycle); swallowing the original ValidationError (debug nightmare).",
        portfolioRelevance: "User-friendly validation error output is a thoughtful-engineer signal. Show a `--check` subcommand that exits 1 + prints all errors.",
        finalExplanation: "Validation errors are the user interface of typed config. Make them say 'fix THIS, here' so ops can actually fix them.",
        misconceptionToWatchFor: "Believing the default ValidationError message is good enough. It's good enough for developers — not for the on-call person at 3am.",
      }),
    },
    {
      stepNumber: 5,
      title: "Typer subcommand graph driven by typed Settings",
      instructionMd:
        "Wire a Typer app with three subcommands: `seedctl db migrate`, `seedctl s3 sync`, `seedctl notify send <message>`. Each receives the loaded `Settings` via a `@app.callback` that runs `load_settings()` once and stashes it on `ctx.obj`. Override flag: `--env-name dev` flows through the precedence chain. Validator: `seedctl db migrate --env-name prod` exits 0 and prints `'env=prod, db=<host>:<port>'`; `seedctl --invalid` exits 2 with Typer's standard error.",
      learningObjective: "Typer + Pydantic together = type-checked CLI all the way from `argv` to a typed config object. No runtime casting, no string-juggling.",
      requiredSkill: "Typer app structure + ctx.obj for shared state + callback ordering",
      starterCode: SRC(`# cli.py
import typer
from typing import Optional
from .loader import load_settings, ConfigError
from .settings import Settings

app = typer.Typer(no_args_is_help=True, add_completion=False)
db_app = typer.Typer(); s3_app = typer.Typer(); notify_app = typer.Typer()
app.add_typer(db_app, name="db")
app.add_typer(s3_app, name="s3")
app.add_typer(notify_app, name="notify")

@app.callback()
def main(ctx: typer.Context, env_name: Optional[str] = typer.Option(None, "--env-name")) -> None:
    """Load settings once; stash on ctx.obj for every subcommand."""
    try:
        # TODO: env_name CLI override -> kwargs precedence (highest)
        kwargs = {"env_name": env_name} if env_name else {}
        settings = load_settings() if not kwargs else Settings(**kwargs)
        ctx.obj = settings
    except ConfigError as e:
        typer.echo(str(e), err=True); raise typer.Exit(code=2)

@db_app.command("migrate")
def db_migrate(ctx: typer.Context) -> None:
    s: Settings = ctx.obj
    typer.echo(f"env={s.env_name}, db={s.database.host}:{s.database.port}")

@s3_app.command("sync")
def s3_sync(ctx: typer.Context) -> None:
    s: Settings = ctx.obj
    typer.echo(f"env={s.env_name}, bucket={s.s3.bucket}")

@notify_app.command("send")
def notify_send(ctx: typer.Context, message: str) -> None:
    s: Settings = ctx.obj
    typer.echo(f"channel={s.notify.default_channel} msg={message}")
`),
      validationType: "contains",
      stepType: "code_python",
      validation: validationConfig("contains", "'seedctl db migrate --env-name prod' stdout contains 'env=prod'; '--invalid' exits 2.", {
        required: ["env=prod"],
        scenarios: [
          { argv: ["db", "migrate", "--env-name", "prod"], expectExit: 0, stdoutContains: "env=prod" },
          { argv: ["--invalid"], expectExit: 2 },
        ],
      }),
      expectedOutputs: { migrateExit: 0, invalidExit: 2 },
      datasetRefs: ["fixtures/cli_scenarios.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "`@app.callback()` runs BEFORE the subcommand — perfect place to load settings once.",
          "`ctx.obj` is the canonical Typer pattern for sharing per-invocation state with subcommands.",
          "`add_typer(sub, name='db')` builds a subcommand group; commands inside are addressed as `seedctl db <cmd>`.",
          "Always set `no_args_is_help=True` and `add_completion=False` for ops CLIs — predictable + smaller.",
          "app.add_typer(db_app, name='db')",
        ],
        successFeedback: "End-to-end typed CLI: argv → Settings → subcommand. No string-juggling anywhere.",
        failureFeedback: "Most slips: loading Settings inside each subcommand (re-reads env every call); not using ctx.obj (passing Settings via globals).",
        portfolioRelevance: "A typed CLI with a real subcommand graph is a 5-minute portfolio demo. Pair with the precedence + redaction tests for a complete story.",
        finalExplanation: "Typer + Pydantic-v2 is the modern Python platform-CLI stack. Once you've built one, you'll never reach for argparse + os.environ again.",
        misconceptionToWatchFor: "Treating Typer as 'argparse with decorators'. It's argparse + type-driven validation + structured subcommands — design the command graph first, the decorators second.",
      }),
    },
  ],
};
