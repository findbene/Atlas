/**
 * Phase 10 batch-2 / data-engineering (advanced).
 * Candidate c4fb285a-971f-4aa5-b98e-c6ed60a92933 — Data Mesh Design
 * (data products as code, contracts, federated governance, self-serve platform).
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const dataEngineeringDataMeshDesign: AuthoredProject = {
  slug: "data-engineering-data-mesh-design",
  candidateId: "c4fb285a-971f-4aa5-b98e-c6ed60a92933",
  title: "Data Mesh — Data Products as Code, Contracts, and Federated Governance",
  shortDescription:
    "Design a working data mesh: data products declared as code (owner + contract + SLO), schema-contract testing in CI, federated governance policies that auto-enforce across domains, a self-serve platform API to publish/consume products, and a product catalog. Real architecture, not a deck.",
  fullDescription:
    "Data mesh is the 2024–2026 enterprise pattern: ownership decentralizes to domain teams while platform centralizes the contract + governance plumbing. You'll build the architecture end-to-end: declarative DataProduct manifests, a contract testing harness that compares schema/distribution against published expectations, a federated-policy engine (PII + retention + SLO enforcement), a self-serve registration API, and a catalog that consumers query. Real architecture, not the slideware version.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "Pydantic", "FastAPI", "PyArrow", "Postgres"],
  tags: ["data-mesh", "data-products", "data-contracts", "federated-governance", "self-serve", "domain-ownership", "platform"],
  learningObjectives: [
    "Declare data products as version-controlled manifests with owners + SLOs.",
    "Run contract tests in CI that compare actual data against the manifest.",
    "Enforce cross-domain governance policies (PII tagging, retention).",
    "Expose a self-serve platform API for publish + consume flows.",
    "Build a domain-aware product catalog with lineage + freshness.",
  ],
  estimatedMinutes: 200,
  xpReward: 700,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Platform DE at a 400-person company with 5 business domains. Central data team is a bottleneck. CTO funds a data mesh migration: domain teams own data products, central platform owns the contract + governance plumbing.",
    hiringRelevance2026:
      "Data mesh + data contracts are the staff/principal DE topics of 2026. Hands-on architecture (not just buzzword recital) is the differentiator.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (manifests + tests + governance + platform + catalog)",
      "Step 1 product manifest", "Step 2 contract testing in CI",
      "Step 3 federated governance policy", "Step 4 self-serve platform API",
      "Step 5 catalog with freshness", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "GitHub repo containing 3 sample data products (across 3 domains), the contract-test runner (pytest-based), the governance policy engine, FastAPI platform service, and a Streamlit catalog UI. Includes a README explaining the architecture decisions.",
    portfolioRelevance:
      "Reviewers grep for 'data contract' + 'data mesh' on staff-track resumes. A working repo with tested contracts is the closer.",
    repoUrl: "https://github.com/<your-handle>/data-mesh-design",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "DataProduct manifest schema",
      instructionMd:
        "Define a Pydantic `DataProduct` model: `name`, `domain` (e.g. 'sales', 'marketing'), `owner` (email), `slo` (freshness_hours, completeness_pct), `schema` (list of `Column(name, dtype, nullable, pii)`), `version` (semver). Validate with `assert_manifest_valid()` — non-empty owner, semver version, ≥1 non-PK column, no duplicate column names. Validator loads 3 fixture YAMLs (sales/marketing/finance), expects all to parse + validate.",
      learningObjective: "Treat data products as first-class, version-controlled artifacts with manifest contracts.",
      requiredSkill: "Pydantic + semver validation + manifest design",
      starterCode: SRC(`# manifest.py
from pydantic import BaseModel, EmailStr, field_validator
from typing import Literal
import re

SEMVER = re.compile(r'^\\d+\\.\\d+\\.\\d+$')

class Column(BaseModel):
    name: str
    dtype: Literal['int', 'float', 'string', 'bool', 'timestamp']
    nullable: bool = False
    pii: bool = False

class SLO(BaseModel):
    freshness_hours: int
    completeness_pct: float

class DataProduct(BaseModel):
    name: str
    domain: str
    owner: EmailStr
    version: str
    slo: SLO
    schema_: list[Column]

    @field_validator('version')
    @classmethod
    def _semver(cls, v: str) -> str:
        if not SEMVER.match(v): raise ValueError(f'version must be semver, got {v!r}')
        return v

def assert_manifest_valid(p: DataProduct) -> None:
    if not p.schema_: raise ValueError(f'{p.name}: at least one column required')
    seen = set()
    for col in p.schema_:
        if col.name in seen: raise ValueError(f'{p.name}: duplicate column {col.name}')
        seen.add(col.name)
    # TODO: also assert SLO completeness_pct ∈ (0, 100], freshness_hours > 0.
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "3 fixture manifests (sales/marketing/finance) parse + validate. Invalid manifest (bad semver) is rejected with a clear error.", {
        expected: { validProducts: 3, invalidRejected: true, domainsCovered: ["sales", "marketing", "finance"] },
      }),
      expectedOutputs: { valid: 3, rejected: 1 },
      datasetRefs: ["fixtures/sales_product.yml", "fixtures/marketing_product.yml", "fixtures/finance_product.yml"],
      pedagogy: pedagogyConfig({
        hints: [
          "Semver gates safe-migration: bumping major = breaking change consumers can plan around.",
          "PII flagging at the column level lets the policy engine enforce masking automatically — don't skip it.",
          "Store manifests in the domain team's repo, not the platform repo — ownership stays clear.",
          "Pydantic + EmailStr gives free runtime validation; bad owner emails fail at parse time, not in prod.",
          "if not (0 < p.slo.completeness_pct <= 100): raise ValueError(f'{p.name}: completeness_pct {p.slo.completeness_pct} ∉ (0, 100]')\\nif p.slo.freshness_hours <= 0: raise ValueError(f'{p.name}: freshness_hours must be positive')",
        ],
        successFeedback: "Data products now have machine-readable contracts. Everything downstream (tests, policies, catalog) builds on this.",
        failureFeedback: "Common slips: skipped semver validation (silent breaking changes); free-text dtype (typo bugs); no PII column flag (governance can't auto-enforce).",
        portfolioRelevance: "Knowing 'data product = manifest + data + tests + ownership' cold is the staff-DE signal. Most teams don't get past 'data product = a table'.",
        finalExplanation: "Manifests are the API contract between domains. Without them, mesh is just decentralized chaos.",
        misconceptionToWatchFor: "Treating a data product as 'just a table with a README'. Without an enforceable manifest, contracts drift in weeks.",
      }),
    },
    {
      stepNumber: 2,
      title: "Contract testing in CI",
      instructionMd:
        "Implement `run_contract_tests(product, sample_df) -> ContractReport` checking: (1) all manifest columns exist in df, (2) dtypes match (int↔int64, string↔object, etc), (3) PII columns present iff `manifest.column.pii`, (4) completeness ≥ slo.completeness_pct. Validator: matching sales df → pass; sales df missing `customer_email` → fail with specific column name in report; sales df with extra column → pass (consumers tolerate extras).",
      learningObjective: "Mechanically enforce contracts so producers can't silently drift from the manifest.",
      requiredSkill: "Pandas dtype coercion + contract-test reporting + producer-consumer compatibility rules",
      starterCode: SRC(`# contract_test.py
from dataclasses import dataclass, field
import pandas as pd, numpy as np
from .manifest import DataProduct

DTYPE_MAP = {
    'int': ('int64', 'int32', 'Int64'),
    'float': ('float64', 'float32', 'Float64'),
    'string': ('object', 'string', 'string[python]'),
    'bool': ('bool', 'boolean'),
    'timestamp': ('datetime64[ns]', 'datetime64[ns, UTC]'),
}

@dataclass
class ContractReport:
    passed: bool
    missing_columns: list[str] = field(default_factory=list)
    dtype_mismatches: list[tuple[str, str, str]] = field(default_factory=list)  # (col, expected, actual)
    completeness_failures: list[tuple[str, float, float]] = field(default_factory=list)  # (col, actual, required)

def run_contract_tests(product: DataProduct, df: pd.DataFrame) -> ContractReport:
    rep = ContractReport(passed=True)
    for col in product.schema_:
        if col.name not in df.columns:
            rep.missing_columns.append(col.name); rep.passed = False
            continue
        actual_dtype = str(df[col.name].dtype)
        if actual_dtype not in DTYPE_MAP[col.dtype]:
            rep.dtype_mismatches.append((col.name, col.dtype, actual_dtype)); rep.passed = False
        completeness = float(df[col.name].notna().mean() * 100)
        # TODO: if completeness < product.slo.completeness_pct: append + mark failed.
    return rep
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Matching sales df: passed=True. Missing customer_email: passed=False, missing_columns=['customer_email']. df with extra unmanaged column 'debug_id': passed=True (extras are fine).", {
        expected: { matchingPasses: true, missingColumnFails: ["customer_email"], extraColumnsTolerated: true },
      }),
      expectedOutputs: { passed_matching: true, missing_caught: ["customer_email"] },
      datasetRefs: ["fixtures/sales_product.yml", "fixtures/sales_sample.csv"],
      pedagogy: pedagogyConfig({
        hints: [
          "Contract tests should run in producer CI BEFORE publish — catch drift before consumers feel it.",
          "Tolerate extra columns (producers can add experimentally) but never tolerate missing ones (breaking change).",
          "Always include completeness ≥ SLO in the contract — dtype matching alone misses 'column exists but is 90% null'.",
          "Report SPECIFIC column names + actual vs expected — generic 'contract failed' is useless for the producer.",
          "if completeness < product.slo.completeness_pct:\\n    rep.completeness_failures.append((col.name, completeness, product.slo.completeness_pct))\\n    rep.passed = False",
        ],
        successFeedback: "Producers now get blocked at PR time if they violate the contract. Downstream incidents drop massively.",
        failureFeedback: "Common slips: failed on extra columns (producers can't experiment); ignored completeness (silent quality drift); generic error messages (producer can't fix without grepping logs).",
        portfolioRelevance: "Data contract testing is THE 2026 platform-DE topic. Working CI-integrated test runner = senior+ signal.",
        finalExplanation: "Contracts move bugs left. Catching breakage at publish-time is 100x cheaper than at consume-time.",
        misconceptionToWatchFor: "Running contract tests only on the consumer side. Producer-side gating is what prevents the breakage.",
      }),
    },
    {
      stepNumber: 3,
      title: "Federated governance policy engine",
      instructionMd:
        "Implement `Policy` (`name`, `rule_fn: (DataProduct) -> list[str]` returning violations). Build 3 policies: `pii_must_have_owner` (every PII column owner non-empty), `retention_max_days` (no PII column may have unbounded retention), `slo_completeness_floor` (completeness_pct ≥ 95). Run `evaluate_policies(policies, products) -> dict[product_name, list[Violation]]`. Validator: 3 products evaluated against 3 policies → 0 violations on clean fixtures; perturbed fixture (PII column with no owner) → exactly 1 violation flagging the column.",
      learningObjective: "Centralize cross-cutting governance in the platform, separate from domain logic.",
      requiredSkill: "Policy engine pattern + cross-cutting governance + violation reporting",
      starterCode: SRC(`# policies.py
from dataclasses import dataclass
from typing import Callable
from .manifest import DataProduct

@dataclass
class Policy:
    name: str
    rule_fn: Callable[[DataProduct], list[str]]

def pii_must_have_owner(p: DataProduct) -> list[str]:
    viols = []
    for col in p.schema_:
        if col.pii and not p.owner:
            viols.append(f'PII column {col.name!r} has no product owner')
    return viols

def slo_completeness_floor(p: DataProduct) -> list[str]:
    if p.slo.completeness_pct < 95.0:
        return [f'slo.completeness_pct {p.slo.completeness_pct} < floor 95']
    return []

# TODO: implement retention_max_days(p) - flag if any PII col has no retention metadata
#       (assume retention_days is a custom field on Column; treat missing as 'unbounded').

POLICIES = [
    Policy('pii_must_have_owner', pii_must_have_owner),
    Policy('slo_completeness_floor', slo_completeness_floor),
    # Policy('retention_max_days', retention_max_days),
]

def evaluate_policies(policies: list[Policy], products: list[DataProduct]) -> dict[str, list[str]]:
    report: dict[str, list[str]] = {}
    for p in products:
        viols = []
        for pol in policies:
            for v in pol.rule_fn(p):
                viols.append(f'[{pol.name}] {v}')
        if viols: report[p.name] = viols
    return report
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Clean 3-product fixture: 0 violations. Perturbed fixture (sales product PII column with no product owner): exactly 1 violation tagged [pii_must_have_owner].", {
        expected: { cleanViolations: 0, perturbedViolations: 1, perturbedPolicyTag: "pii_must_have_owner" },
      }),
      expectedOutputs: { clean_viol: 0, perturbed_viol: 1 },
      datasetRefs: ["fixtures/sales_product.yml", "fixtures/marketing_product.yml", "fixtures/finance_product.yml"],
      pedagogy: pedagogyConfig({
        hints: [
          "Policies should be small, named, and individually-testable — one big rule_fn = unmaintainable.",
          "Always include policy NAME in the violation string — operators triaging need to know which rule fired.",
          "Run policies in CI for the manifest + at runtime on the data product itself.",
          "Federated governance: domain teams own data, platform owns policies. Both sides have skin in the game.",
          "def retention_max_days(p):\\n    viols = []\\n    for col in p.schema_:\\n        if col.pii and not getattr(col, 'retention_days', None):\\n            viols.append(f'PII column {col.name} has no retention_days set')\\n    return viols",
        ],
        successFeedback: "Cross-domain rules now enforce uniformly. Compliance + privacy reviews get massively cheaper.",
        failureFeedback: "Common slips: hand-rolled per-product compliance (drifts in weeks); skipped policy NAMING (untriagable failures); checked only at publish, not runtime (drift unmonitored).",
        portfolioRelevance: "A working policy engine is the 'I understand federated governance' proof. Most data-mesh discussions stop at theory; you've built it.",
        finalExplanation: "Federated governance = decentralized ownership + centralized enforcement. Both halves are required.",
        misconceptionToWatchFor: "Building a single 'governance approval' Slack workflow. Doesn't scale past 5 products + drifts on the 6th.",
      }),
    },
    {
      stepNumber: 4,
      title: "Self-serve platform API (FastAPI)",
      instructionMd:
        "Expose three endpoints: `POST /products` (publish: parse manifest, validate, run all policies, reject if violations), `GET /products` (list filtered by domain), `GET /products/{name}` (full product detail including policy report). Validator hits all three endpoints; expects POST to reject a manifest with policy violations (400 + violation list); list endpoint filters by `?domain=sales` correctly.",
      learningObjective: "Give domain teams self-serve publish + consume — the platform's reason for being.",
      requiredSkill: "FastAPI + Pydantic request validation + policy-gated publishing",
      starterCode: SRC(`# api.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from .manifest import DataProduct, assert_manifest_valid
from .policies import POLICIES, evaluate_policies

app = FastAPI()
_REGISTRY: dict[str, DataProduct] = {}

class PublishResponse(BaseModel):
    name: str; version: str; status: str

class ViolationResponse(BaseModel):
    name: str; violations: list[str]

@app.post('/products', response_model=PublishResponse)
def publish(product: DataProduct) -> PublishResponse:
    assert_manifest_valid(product)
    report = evaluate_policies(POLICIES, [product])
    if report.get(product.name):
        raise HTTPException(400, detail={'name': product.name, 'violations': report[product.name]})
    # TODO: store in _REGISTRY[product.name] = product; return PublishResponse(name=..., version=..., status='published')
    return PublishResponse(name=product.name, version=product.version, status='pending')

@app.get('/products')
def list_products(domain: Optional[str] = None) -> list[dict]:
    products = list(_REGISTRY.values())
    if domain: products = [p for p in products if p.domain == domain]
    return [{'name': p.name, 'domain': p.domain, 'version': p.version} for p in products]

@app.get('/products/{name}')
def get_product(name: str) -> dict:
    if name not in _REGISTRY: raise HTTPException(404, f'unknown product: {name}')
    p = _REGISTRY[name]
    return {'manifest': p.model_dump(), 'policy_report': evaluate_policies(POLICIES, [p]).get(name, [])}
`),
      validationType: "contains",
      stepType: "code_python",
      validation: validationConfig("contains", "POST /products with clean manifest → 200 status='published'. POST with policy violation → 400 + violations array. GET /products?domain=sales returns only sales products.", {
        expected: { cleanPublishStatus: "published", violationStatus: 400, domainFilterWorks: true },
        mustContain: ["published", "violations"],
      }),
      expectedOutputs: { publish: "published", filter: "sales", reject: 400 },
      datasetRefs: ["fixtures/sales_product.yml"],
      pedagogy: pedagogyConfig({
        hints: [
          "Self-serve only works if the platform never asks 'can I review this?' — gate is policy-driven, not human.",
          "Return violation details on 400 — domain teams need to fix at PR time, not after Slack DMs.",
          "Version-key the registry: `(name, version) → product`; never silently overwrite.",
          "Add `/products/{name}/versions` to show consumers which versions are available — supports planned migrations.",
          "_REGISTRY[product.name] = product\\nreturn PublishResponse(name=product.name, version=product.version, status='published')",
        ],
        successFeedback: "Platform is now usable. Domain teams can publish without a ticket to the central team.",
        failureFeedback: "Common slips: returned generic 400 (no actionable info); overwrote previous versions (broke consumers); skipped domain filter (catalog becomes a soup).",
        portfolioRelevance: "Self-serve platform is the 'I understand data mesh ops' proof. Reviewers immediately probe for it.",
        finalExplanation: "Self-serve = no humans in the publish loop. Policy gates + good errors are how you achieve that safely.",
        misconceptionToWatchFor: "Requiring central approval for every publish. That's the OLD model the mesh exists to remove.",
      }),
    },
    {
      stepNumber: 5,
      title: "Catalog with freshness tracking",
      instructionMd:
        "Extend the platform with `record_freshness(product_name, last_written_at)` (call from producer pipelines) and `GET /catalog` returning per-product `{name, domain, owner, version, freshness_status}` where `freshness_status = 'fresh' | 'stale' | 'expired'` based on `(now - last_written_at) vs slo.freshness_hours`. Validator: 3 products recorded with varying freshness → expect 1 fresh, 1 stale (>SLO but <2× SLO), 1 expired (>2× SLO).",
      learningObjective: "Make freshness the first thing consumers see — operationalize the SLO.",
      requiredSkill: "Freshness tracking + SLO comparison + multi-band status",
      starterCode: SRC(`# catalog.py
from datetime import datetime, timedelta, timezone
from .api import _REGISTRY

_FRESHNESS: dict[str, datetime] = {}

def record_freshness(product_name: str, last_written_at: datetime) -> None:
    _FRESHNESS[product_name] = last_written_at

def freshness_status(product, now: datetime) -> str:
    last = _FRESHNESS.get(product.name)
    if last is None: return 'unknown'
    age_hours = (now - last).total_seconds() / 3600
    slo = product.slo.freshness_hours
    if age_hours <= slo: return 'fresh'
    # TODO: if age_hours <= 2*slo: return 'stale'; else return 'expired'
    return 'fresh'

def catalog(now: datetime | None = None) -> list[dict]:
    now = now or datetime.now(timezone.utc)
    return [
        {
            'name': p.name, 'domain': p.domain, 'owner': p.owner,
            'version': p.version, 'freshness_status': freshness_status(p, now),
        }
        for p in _REGISTRY.values()
    ]
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "3 products with SLO=24h: sales recorded 2h ago→fresh, marketing 30h ago→stale (>24,<48), finance 60h ago→expired (>48). catalog() returns the right status for each.", {
        expected: { sales: "fresh", marketing: "stale", finance: "expired", totalProducts: 3 },
      }),
      expectedOutputs: { fresh: 1, stale: 1, expired: 1 },
      datasetRefs: ["fixtures/freshness_seed.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Three-band status (fresh / stale / expired) is more useful than binary — gives ops vs incident triage.",
          "Always use UTC timestamps with explicit timezone — naïve datetimes silently lie when producer + platform are in different timezones.",
          "Producer pipelines should call /freshness/recorded after each successful write — keep it lightweight.",
          "Expose freshness in the catalog UI prominently — it's the #1 question consumers ask.",
          "if age_hours <= 2 * slo: return 'stale'\\nreturn 'expired'",
        ],
        successFeedback: "Catalog is now operational. Freshness is visible + actionable. Mesh is shippable.",
        failureFeedback: "Common slips: naïve datetimes (timezone bugs); binary fresh/expired (loses operational signal); skipped catalog endpoint (consumers can't discover).",
        portfolioRelevance: "Freshness + lineage + ownership is the consumer's contract with the product. Surfacing all three = senior+ catalog work.",
        finalExplanation: "Catalog isn't a UI — it's the consumer's discovery surface. Freshness + owner + version answers 'can I trust this right now?'.",
        misconceptionToWatchFor: "Treating the catalog as documentation. It's a live operational dashboard.",
      }),
    },
  ],
};
