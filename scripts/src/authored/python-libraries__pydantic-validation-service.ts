/**
 * Phase 7 — Wave 1c / python-libraries (intermediate).
 * Candidate f8836bb9-48b8-4709-8254-6b6e6357786f — Pydantic Validation Service.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const pythonLibrariesPydanticValidationService: AuthoredProject = {
  slug: "python-libraries-pydantic-validation-service",
  title: "Pydantic v2 Validation Service: Schemas, Discriminated Unions, SQL Loading",
  shortDescription:
    "Build a FastAPI ingest service that validates webhook payloads with Pydantic v2 (discriminated unions, custom validators, alias generators), transforms with Polars, persists via SQLAlchemy, and exposes type-safe OpenAPI.",
  fullDescription:
    "Schema validation is the foundation of every production data service — get it wrong and you spend the next year cleaning up bad rows. Pydantic v2 + FastAPI is the 2026 Python default for type-safe ingest. You'll build a webhook endpoint that accepts heterogeneous event payloads (discriminated by event_type), validates with field validators + AliasGenerator (so the JSON spec can use camelCase while Python is snake_case), transforms with Polars (lazy frame for memory efficiency), and persists via SQLAlchemy with explicit transaction management.",
  language: "python",
  difficulty: "intermediate",
  techStack: ["Python", "Pydantic", "FastAPI", "Polars", "SQLAlchemy"],
  tags: ["pydantic", "fastapi", "polars", "sqlalchemy", "discriminated-union", "python-libraries"],
  learningObjectives: [
    "Model heterogeneous events as a Pydantic v2 discriminated union.",
    "Use AliasGenerator to bridge JSON conventions and Python naming.",
    "Write field + model validators that fail-loud on business-rule violations.",
    "Transform incoming batches with a Polars LazyFrame.",
    "Persist via SQLAlchemy session with explicit commit + rollback boundaries.",
  ],
  estimatedMinutes: 180,
  xpReward: 550,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Your platform ingests webhooks from 6 SaaS vendors, each with slightly different event shapes. The old 'accept dict, hope for the best' service silently dropped 12% of events last month.",
    hiringRelevance2026:
      "Pydantic v2 + FastAPI is the modern Python ingest stack. Discriminated unions + validators is a senior-Python interview topic.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (Webhook → FastAPI → Pydantic → Polars → SQLAlchemy)",
      "Step 1 discriminated union", "Step 2 alias + validators",
      "Step 3 Polars transform", "Step 4 SQLAlchemy persist",
      "Step 5 OpenAPI + integration test", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "service",
    deliverable:
      "Public GitHub repo with a deployable FastAPI service, Pydantic schemas, Polars transforms, SQLAlchemy models + Alembic migrations, pytest suite, and a docker-compose for local dev.",
    portfolioRelevance:
      "A FastAPI + Pydantic v2 + SQLAlchemy service hits the 'senior Python engineer who can ship' checklist. Most candidates stop at the toy CRUD level.",
    repoUrl: "https://github.com/<your-handle>/pydantic-validation-service",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Discriminated union over event types",
      instructionMd:
        "Define `OrderCreated`, `OrderShipped`, `OrderRefunded` as separate Pydantic models, each with a `Literal['order.created'|'order.shipped'|'order.refunded']` event_type field. Combine via `Annotated[Union[...], Discriminator('event_type')]` so FastAPI deserializes the right subclass automatically. Validator posts 3 payloads (one per type) + asserts each parses to the expected class.",
      learningObjective: "Use Pydantic v2 discriminated unions to model polymorphic event payloads.",
      requiredSkill: "Pydantic v2 + Literal + Annotated + Discriminator",
      starterCode: SRC(`# schemas.py
from typing import Literal, Annotated, Union
from pydantic import BaseModel, Field, Discriminator

class OrderCreated(BaseModel):
    event_type: Literal["order.created"]
    order_id: str
    customer_id: str
    total_cents: int

class OrderShipped(BaseModel):
    event_type: Literal["order.shipped"]
    order_id: str
    tracking_number: str

class OrderRefunded(BaseModel):
    event_type: Literal["order.refunded"]
    order_id: str
    refund_cents: int
    reason: str

# TODO: OrderEvent = Annotated[Union[OrderCreated, OrderShipped, OrderRefunded], Discriminator("event_type")]
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "POST 3 payloads: order.created → OrderCreated; order.shipped → OrderShipped; order.refunded → OrderRefunded. Bad event_type → 422.", {
        expectedTypes: ["OrderCreated", "OrderShipped", "OrderRefunded"], expectedBadStatus: 422,
      }),
      expectedOutputs: { types: 3, badStatus: 422 },
      datasetRefs: ["fixtures/event_payloads.jsonl"],
      pedagogy: pedagogyConfig({
        hints: [
          "Discriminated union = Pydantic picks the right subclass based on a fixed field, no try/except parsing chain.",
          "Literal narrows the type to one string value — Pydantic validates AND it's a discriminator key.",
          "Annotated[Union[...], Discriminator('event_type')] tells Pydantic which field to use.",
          "from pydantic import TypeAdapter; ta = TypeAdapter(OrderEvent); event = ta.validate_python(payload)",
          "(see reference above)",
        ],
        successFeedback: "Polymorphic events are now type-safe. Adding a 4th event type is one new class + one Union entry.",
        failureFeedback: "Common slips: used a plain Union without Discriminator (Pydantic tries each schema in order — slow + ambiguous errors); forgot Literal (any string accepted).",
        portfolioRelevance: "Discriminated unions is THE pattern for polymorphic Python types. Senior interviewers ask 'how do you model events?'.",
        finalExplanation: "Discriminated unions turn 'parse the dict, check the type, dispatch' into one declaration. Pydantic does the dispatch.",
        misconceptionToWatchFor: "Modeling all events as one optional-field schema. Errors are confusing; impossible to validate type-specific business rules.",
      }),
    },
    {
      stepNumber: 2,
      title: "AliasGenerator (camelCase ↔ snake_case) + custom validators",
      instructionMd:
        "Add `model_config = ConfigDict(alias_generator=AliasGenerator(validation_alias=to_camel, serialization_alias=to_camel), populate_by_name=True)` so JSON can use `orderId` but Python uses `order_id`. Add `@field_validator('total_cents')` that asserts > 0 and `@model_validator(mode='after')` that asserts refund_cents <= total_cents for refunds. Validator posts camelCase JSON with negative total → 422 mentioning total_cents.",
      learningObjective: "Bridge JSON casing conventions and Python naming, and enforce business rules with field + model validators.",
      requiredSkill: "Pydantic v2 ConfigDict + AliasGenerator + field_validator + model_validator",
      starterCode: SRC(`# schemas.py (extend)
from pydantic import ConfigDict, AliasGenerator, field_validator, model_validator
from pydantic.alias_generators import to_camel

class _Base(BaseModel):
    model_config = ConfigDict(
        alias_generator=AliasGenerator(validation_alias=to_camel, serialization_alias=to_camel),
        populate_by_name=True,
    )

class OrderCreated(_Base):
    event_type: Literal["order.created"]
    order_id: str
    customer_id: str
    total_cents: int

    @field_validator("total_cents")
    @classmethod
    def positive(cls, v: int) -> int:
        if v <= 0: raise ValueError("total_cents must be > 0")
        return v

# TODO: OrderRefunded.model_validator(mode='after') checking refund_cents <= total_cents
# (you'll need a way to know total_cents at refund time — typically a DB lookup in the route handler, not the schema)
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Payload {eventType: 'order.created', orderId: 'X', customerId: 'C', totalCents: -1} → 422 with msg mentioning total_cents.", {
        expectedStatus: 422, expectedErrorField: "total_cents",
      }),
      expectedOutputs: { status: 422, errorField: "total_cents" },
      datasetRefs: ["fixtures/invalid_payloads.jsonl"],
      pedagogy: pedagogyConfig({
        hints: [
          "alias_generator runs against EVERY field — saves you typing alias='customerId' on each one.",
          "populate_by_name=True lets BOTH the alias AND the Python name work — handy in tests.",
          "field_validator runs per-field; model_validator runs after all fields parse (mode='after').",
          "@model_validator(mode='after')\\ndef _checks(self):\\n  if self.refund_cents > self.total_cents:\\n    raise ValueError('refund > order total')\\n  return self",
          "(see reference above)",
        ],
        successFeedback: "Bad data fails at the door with clear error messages. No more 'silently dropped' rows.",
        failureFeedback: "Common slips: used the Pydantic-v1 @validator (deprecated); forgot @classmethod (silent breakage); raised TypeError instead of ValueError (Pydantic-translated errors look wrong).",
        portfolioRelevance: "Validators + AliasGenerator together is senior-Pythonic. JSON↔Python naming bridges are a real-world need.",
        finalExplanation: "field_validator + model_validator + AliasGenerator cover 95% of validation needs. The rest is custom types.",
        misconceptionToWatchFor: "Validating in the route handler instead of the schema. Schema validation is reusable + testable; route validation isn't.",
      }),
    },
    {
      stepNumber: 3,
      title: "Polars LazyFrame batch transform",
      instructionMd:
        "Add a `/ingest/batch` route that accepts `list[OrderEvent]` (up to 10k). Convert to a Polars LazyFrame, group by `customer_id`, compute `total_orders`, `lifetime_value_cents`. Use `scan_csv`-style lazy chain + `.collect()` at the end for memory efficiency. Validator posts 100 events for 3 customers + asserts 3 rows out with correct sums.",
      learningObjective: "Use Polars LazyFrame for memory-efficient batch transforms inside a service.",
      requiredSkill: "Polars LazyFrame + group_by + aggregate + Pydantic model dump",
      starterCode: SRC(`# transforms.py
import polars as pl
from schemas import OrderEvent, OrderCreated

def summarize_customers(events: list[OrderEvent]) -> pl.DataFrame:
    created = [e for e in events if isinstance(e, OrderCreated)]
    if not created: return pl.DataFrame({"customer_id": [], "total_orders": [], "lifetime_value_cents": []})
    df = pl.LazyFrame([e.model_dump() for e in created])
    # TODO:
    # return (df.group_by("customer_id")
    #           .agg(pl.count().alias("total_orders"),
    #                pl.col("total_cents").sum().alias("lifetime_value_cents"))
    #           .sort("customer_id")
    #           .collect())
    raise NotImplementedError
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "100 events across 3 customers (50/30/20 each, totals 5000/3000/2000) → 3 rows: counts [50,30,20], values [5000,3000,2000].", {
        expectedRows: 3, expectedCounts: [50, 30, 20], expectedValues: [5000, 3000, 2000],
      }),
      expectedOutputs: { rows: 3, counts: [50, 30, 20] },
      datasetRefs: ["fixtures/customer_events_100.jsonl"],
      pedagogy: pedagogyConfig({
        hints: [
          "LazyFrame defers execution. The query plan is optimized before .collect().",
          "pl.count() in agg gives row count per group.",
          "Sort the output deterministically so tests aren't flaky on group order.",
          "df.group_by('customer_id').agg(pl.count().alias('total_orders'), pl.col('total_cents').sum().alias('lifetime_value_cents')).sort('customer_id').collect()",
          "(see reference above)",
        ],
        successFeedback: "Batch transform is memory-efficient + fast. Polars LazyFrame handles 1M rows on commodity hardware.",
        failureFeedback: "Common slips: built a DataFrame (eager) for 10k rows (fine but slower); forgot .sort (flaky tests on customer order).",
        portfolioRelevance: "Polars is the 2026 fast-DataFrame choice. Senior Python interviews specifically ask why Polars > Pandas for batch.",
        finalExplanation: "LazyFrame + columnar engine is the perf differentiator. The API is similar to Pandas; the perf is 5-10x.",
        misconceptionToWatchFor: "Defaulting to Pandas. Pandas is fine for small data; Polars is the better default for new services in 2026.",
      }),
    },
    {
      stepNumber: 4,
      title: "SQLAlchemy persist with explicit transactions",
      instructionMd:
        "Define `Order` SQLAlchemy model. In the route handler, open a session via `with Session(engine) as session`, use `session.execute(insert(Order), [...])` for bulk insert, `session.commit()` on success, `session.rollback()` on Pydantic ValidationError. Validator posts a batch with one bad row + asserts the WHOLE batch was rolled back.",
      learningObjective: "Persist validated data with explicit SQLAlchemy session boundaries.",
      requiredSkill: "SQLAlchemy 2.0 Session + bulk insert + transaction semantics",
      starterCode: SRC(`# db.py
from sqlalchemy import Column, String, Integer, create_engine
from sqlalchemy.orm import DeclarativeBase, Session
from sqlalchemy import insert
from pydantic import ValidationError

class Base(DeclarativeBase): pass

class Order(Base):
    __tablename__ = "orders"
    order_id    = Column(String, primary_key=True)
    customer_id = Column(String, nullable=False)
    total_cents = Column(Integer, nullable=False)

engine = create_engine("postgresql+psycopg://...")

def persist_orders(rows: list[dict]) -> int:
    with Session(engine) as session:
        try:
            session.execute(insert(Order), rows)
            session.commit()
            return len(rows)
        # TODO: except (ValidationError, IntegrityError): session.rollback(); raise
        except Exception:
            session.rollback()
            raise
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Batch of 5 rows where row[2] has duplicate primary key → IntegrityError → all 5 rolled back → DB row count unchanged.", {
        expectedRowsPersisted: 0,
      }),
      expectedOutputs: { rolledBack: true, rowsPersisted: 0 },
      datasetRefs: ["fixtures/orders_with_dup.jsonl"],
      pedagogy: pedagogyConfig({
        hints: [
          "Atomic batch = either all rows commit or none. Without rollback you get half-persisted state.",
          "`with Session(engine) as session` auto-closes; you must still explicit commit/rollback.",
          "Bulk insert via `session.execute(insert(Order), [...])` is faster than `session.add_all`.",
          "except SQLAlchemyError: session.rollback(); raise — rollback FIRST, then propagate.",
          "(see reference above)",
        ],
        successFeedback: "Atomic batch semantics. Either the whole webhook batch lands or none of it does.",
        failureFeedback: "Common slips: forgot rollback (session left in error state, next request fails); used add_all (10x slower for bulk inserts).",
        portfolioRelevance: "Explicit transaction control is senior-Python. Most candidates rely on autocommit and get burned.",
        finalExplanation: "Transactions are the unit of consistency. Atomic batches mean retries are safe + state is always coherent.",
        misconceptionToWatchFor: "Trusting SQLAlchemy's 'autoflush' as the only consistency mechanism. It doesn't replace rollback on error.",
      }),
    },
    {
      stepNumber: 5,
      title: "OpenAPI + integration test with httpx",
      instructionMd:
        "Confirm `GET /openapi.json` reflects the Pydantic schemas — including the discriminated union. Write a pytest test using `httpx.AsyncClient` that boots the FastAPI app via `lifespan`, posts a valid batch, and asserts the OpenAPI schema includes `OrderEvent` with discriminator. Validator runs the test + asserts pass.",
      learningObjective: "Verify the service exposes correct, navigable OpenAPI for downstream consumers.",
      requiredSkill: "FastAPI OpenAPI + httpx AsyncClient + pytest integration test",
      starterCode: SRC(`# tests/test_openapi.py
import pytest, httpx
from app.main import app

@pytest.mark.asyncio
async def test_openapi_has_discriminator():
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        r = await client.get("/openapi.json")
        spec = r.json()
    # TODO: assert that OrderEvent appears in components.schemas with a discriminator block
    # mapping event_type -> [OrderCreated, OrderShipped, OrderRefunded].
    assert r.status_code == 200
    raise NotImplementedError
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "GET /openapi.json includes OrderEvent with discriminator propertyName=event_type + 3 mapped subschemas.", {
        expectedDiscriminatorField: "event_type", expectedMappingCount: 3,
      }),
      expectedOutputs: { discriminator: "event_type", mappings: 3 },
      datasetRefs: ["fixtures/openapi_expected.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "FastAPI auto-generates OpenAPI from Pydantic models — discriminated unions become discriminator + oneOf.",
          "httpx.AsyncClient(app=app) bypasses HTTP — calls the ASGI app directly. Fast + no port mgmt.",
          "Walk the spec: spec['components']['schemas']['OrderEvent']['discriminator']['propertyName'].",
          "assert spec['components']['schemas']['OrderEvent']['discriminator']['propertyName'] == 'event_type'\\nassert len(spec['components']['schemas']['OrderEvent']['discriminator']['mapping']) == 3",
          "(see reference above)",
        ],
        successFeedback: "OpenAPI is now machine-navigable. Generate clients via openapi-generator or orval — they'll know about every variant.",
        failureFeedback: "Common slips: forgot to register the discriminator → OpenAPI shows raw oneOf without propertyName; ran tests against a live server (slow, brittle).",
        portfolioRelevance: "Auto-generated OpenAPI is the modern Python-service hallmark. Senior reviewers expect it.",
        finalExplanation: "OpenAPI is the contract between service + clients. Pydantic-driven generation keeps it always in sync.",
        misconceptionToWatchFor: "Hand-writing OpenAPI. Drift between schema and reality is guaranteed; generate it from Pydantic instead.",
      }),
    },
  ],
};
