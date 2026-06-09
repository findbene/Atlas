/**
 * Phase 10 batch-2 / analytics-engineer (advanced).
 * Candidate fd08c08c-9998-4287-b3ad-b950647a8e29 — Data Catalog Implementation
 * (lineage + column-level provenance from dbt manifest).
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const analyticsEngineerDataCatalogImplementation: AuthoredProject = {
  slug: "analytics-engineer-data-catalog-implementation",
  candidateId: "fd08c08c-9998-4287-b3ad-b950647a8e29",
  title: "Data Catalog with Column-Level Lineage from dbt",
  shortDescription:
    "Build an OpenMetadata-style data catalog: crawl warehouse schemas, parse dbt manifest.json for model + column lineage, surface ownership + governance tags, and expose a search API. Real production patterns minus the vendor lock-in.",
  fullDescription:
    "Data catalogs (Atlan, OpenMetadata, DataHub, Alation) cost $50k–$300k/yr and are increasingly mandatory for analytics teams >10 people. You'll build the core 80% in Python + Postgres: a schema crawler that materializes every table/column, a dbt manifest parser that extracts model + column lineage, an ownership + classification overlay, a graph walker that answers 'what breaks if I change column X', and a search API. The skills (lineage parsing, governance modeling, dependency graphs) transfer directly to any vendor tool.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "Postgres", "dbt", "NetworkX", "FastAPI"],
  tags: ["data-catalog", "lineage", "dbt", "governance", "metadata", "openmetadata", "datahub", "column-lineage"],
  learningObjectives: [
    "Crawl warehouse INFORMATION_SCHEMA to materialize tables + columns into a catalog.",
    "Parse dbt manifest.json to extract model-level and column-level lineage edges.",
    "Build an impact-analysis graph walker (downstream consumers of a column).",
    "Overlay ownership, PII classification, and SLO tags onto catalog entities.",
    "Expose a search + lineage API a UI can drive (FastAPI).",
  ],
  estimatedMinutes: 200,
  xpReward: 650,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Analytics team grew to 14 engineers, dbt project has 380 models. Marketing changes a column on `dim_user` and silently breaks 6 dashboards. Leadership funds a 1-quarter catalog effort but rejects the $180k/yr Atlan quote.",
    hiringRelevance2026:
      "Analytics-engineering leadership roles in 2026 explicitly ask 'have you stood up a catalog?'. Doing it in-house signals the depth that vendor-tool admins lack.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (crawler + dbt parser + graph + API)",
      "Step 1 schema crawler", "Step 2 dbt manifest lineage", "Step 3 impact analysis",
      "Step 4 governance overlay", "Step 5 search API", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with the catalog DB schema, the dbt-manifest parser, NetworkX-backed lineage graph, FastAPI service exposing /search + /lineage/{fqn}, and a sample dbt project + warehouse fixture so reviewers can run end-to-end in <5min.",
    portfolioRelevance:
      "Hiring teams use 'have you built lineage' as a fast filter for senior analytics-engineer roles. A working open-source catalog is a uniquely strong portfolio piece.",
    repoUrl: "https://github.com/<your-handle>/data-catalog-impl",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Schema crawler — materialize tables + columns",
      instructionMd:
        "Implement `crawl_schemas(conn) -> List[Entity]` that queries `information_schema.tables` + `information_schema.columns` for every non-system schema and yields one `Entity` per table (with embedded column list). Persist into the `catalog_entities` + `catalog_columns` tables. Validator runs against a 3-schema fixture warehouse and expects exactly 9 tables + 47 columns materialized.",
      learningObjective: "Use INFORMATION_SCHEMA as the durable contract between any RDBMS and a catalog.",
      requiredSkill: "Postgres information_schema queries + psycopg + upsert idempotency",
      starterCode: SRC(`# crawler.py
from dataclasses import dataclass, field
import psycopg

@dataclass
class Column:
    name: str
    data_type: str
    is_nullable: bool

@dataclass
class Entity:
    schema: str
    name: str
    columns: list[Column] = field(default_factory=list)

def crawl_schemas(conn) -> list[Entity]:
    with conn.cursor() as cur:
        # TODO: SELECT table_schema, table_name FROM information_schema.tables
        #       WHERE table_schema NOT IN ('pg_catalog', 'information_schema');
        # TODO: For each table, SELECT column_name, data_type, is_nullable
        #       FROM information_schema.columns WHERE table_schema=%s AND table_name=%s
        #       ORDER BY ordinal_position;
        return []

def persist(conn, entities: list[Entity]) -> dict:
    # Upsert into catalog_entities + catalog_columns. Return {tables: N, columns: M}.
    raise NotImplementedError
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "crawl_schemas() returns exactly 9 entities across the analytics, staging, and marts schemas.",
          "Total column count across all 9 entities is 47.",
          "persist() upserts all entities into catalog_entities + catalog_columns without duplicating on rerun.",
        ],
      }),
      expectedOutputs: { tables: 9, columns: 47 },
      datasetRefs: ["fixtures/warehouse_seed.sql", "fixtures/expected_catalog.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "INFORMATION_SCHEMA is SQL-standard — the same crawler works on Snowflake/Redshift/BigQuery with column-name tweaks.",
          "Filter pg_catalog + information_schema explicitly; otherwise you'll inventory the catalog of the catalog.",
          "Persist a `last_crawled_at` timestamp per entity so the next run can incrementally reconcile drops/adds.",
          "Use `ON CONFLICT (schema, name) DO UPDATE` to keep the crawler idempotent — reruns must not duplicate.",
          "for tbl in tables: cur.execute('SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema=%s AND table_name=%s ORDER BY ordinal_position', (tbl.schema, tbl.name)); tbl.columns = [Column(*row) for row in cur.fetchall()]",
        ],
        successFeedback: "Catalog now mirrors warehouse state. Every downstream feature builds on this materialization.",
        failureFeedback: "Common slips: forgot to filter system schemas (catalog explodes with 200+ pg internal tables); used SELECT * (column ordering breaks); skipped upsert (rerun duplicates).",
        portfolioRelevance: "Knowing INFORMATION_SCHEMA cold is the senior-AE signal — it's the integration surface for every vendor catalog tool.",
        finalExplanation: "A catalog without a crawler is a wiki. The crawler turns the warehouse's own metadata into the source of truth.",
        misconceptionToWatchFor: "Maintaining the catalog by hand. It will drift in <1 sprint and nobody will trust it again.",
      }),
    },
    {
      stepNumber: 2,
      title: "dbt manifest → model + column lineage",
      instructionMd:
        "Parse a dbt `target/manifest.json` and emit `LineageEdge(upstream_fqn, downstream_fqn, kind)` records. Model-level lineage comes from `node.depends_on.nodes`; column-level lineage comes from `node.columns.<col>.meta.lineage` (a dbt-osmosis / dbt-utils convention). Validator runs against a 12-model fixture manifest and expects 23 model edges + 41 column edges.",
      learningObjective: "Extract lineage from dbt metadata without re-parsing SQL.",
      requiredSkill: "dbt manifest.json structure + nested dict traversal + FQN normalization",
      starterCode: SRC(`# dbt_lineage.py
import json
from dataclasses import dataclass

@dataclass(frozen=True)
class LineageEdge:
    upstream_fqn: str
    downstream_fqn: str
    kind: str  # 'model' or 'column'

def parse_manifest(path: str) -> list[LineageEdge]:
    with open(path) as f:
        manifest = json.load(f)
    edges: list[LineageEdge] = []
    for node_id, node in manifest['nodes'].items():
        if node['resource_type'] != 'model':
            continue
        downstream = f"{node['schema']}.{node['name']}"
        # TODO: model-level edges from node['depends_on']['nodes']
        # TODO: column-level edges from node['columns'][col]['meta']['lineage']
    return edges
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "parse_manifest() extracts exactly 23 model-level LineageEdge records from the fixture manifest.json.",
          "parse_manifest() extracts exactly 41 column-level LineageEdge records from the fixture manifest.json.",
          "Missing column-level meta is treated as no edge (not an error).",
        ],
      }),
      expectedOutputs: { model_edges: 23, column_edges: 41 },
      datasetRefs: ["fixtures/manifest.json", "fixtures/expected_lineage.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "manifest.json is the post-compile dbt artifact — it's the source of truth for what dbt actually built.",
          "depends_on.nodes contains FQNs like 'model.proj.stg_users' — strip the prefix to map back to schema.name.",
          "Column-level lineage isn't dbt-native — it's surfaced by dbt-osmosis or stored in node.columns[c].meta. Treat missing meta as 'no edge', not error.",
          "Always normalize FQNs (lowercase, strip whitespace) before comparing — case mismatches silently drop edges.",
          "ref_fqn = ref.split('.')[-1].lower(); downstream_fqn = f'{node[\"schema\"].lower()}.{node[\"name\"].lower()}'; edges.append(LineageEdge(ref_fqn, downstream_fqn, 'model'))",
        ],
        successFeedback: "Lineage extraction is now declarative + dbt-version-resilient. The hard parsing work is dbt's problem, not yours.",
        failureFeedback: "Common slips: assumed every model has column-level meta (some don't); didn't strip the 'model.<project>.' prefix from depends_on nodes; treated tests/snapshots as models.",
        portfolioRelevance: "Reading manifest.json fluently is the analytics-engineer-platform signal that separates AEs from analysts who run dbt.",
        finalExplanation: "manifest.json is the API contract dbt offers external tools. Anchor your catalog on it and you inherit dbt's compile-time correctness guarantees.",
        misconceptionToWatchFor: "Parsing the .sql files directly to extract lineage. dbt already did this — re-doing it is brittle and lossy.",
      }),
    },
    {
      stepNumber: 3,
      title: "Impact analysis — downstream graph walk",
      instructionMd:
        "Load all edges into a NetworkX DiGraph. Implement `downstream_of(graph, column_fqn) -> set[str]` returning every downstream column transitively. Validator picks `analytics.dim_user.email` and expects {marts.fct_signup.user_email, marts.dashboard_signups.user_email, mart_export.email_hash} (3 downstream consumers).",
      learningObjective: "Use a directed graph to answer 'what breaks if I change this column?' in O(downstream).",
      requiredSkill: "NetworkX DiGraph + descendants() + graph normalization",
      starterCode: SRC(`# impact.py
import networkx as nx

def build_graph(edges) -> nx.DiGraph:
    g = nx.DiGraph()
    for e in edges:
        g.add_edge(e.upstream_fqn, e.downstream_fqn, kind=e.kind)
    return g

def downstream_of(graph: nx.DiGraph, fqn: str) -> set[str]:
    # TODO: return every node reachable FROM fqn (transitive descendants).
    # NetworkX: nx.descendants(graph, fqn).
    raise NotImplementedError
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "downstream_of(g, 'analytics.dim_user.email') returns exactly 3 downstream entities.",
          "The returned set contains: 'marts.fct_signup.user_email', 'marts.dashboard_signups.user_email', 'marts.mart_export.email_hash'.",
          "The function uses nx.descendants() (transitive closure), not just direct successors.",
        ],
      }),
      expectedOutputs: { count: 3 },
      datasetRefs: ["fixtures/expected_lineage.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "nx.descendants(g, node) returns the full transitive closure — exactly what 'every downstream' means.",
          "Use nx.ancestors() for the inverse question ('what feeds this column?').",
          "If your graph has cycles (it shouldn't for SQL lineage), descendants still terminates — but cycles indicate a bug upstream.",
          "Add a max_depth bound for UI rendering — full impact graphs on large warehouses get massive.",
          "return nx.descendants(graph, fqn)  # frozen set of all reachable nodes from fqn",
        ],
        successFeedback: "Impact analysis works. This single function justifies most of the catalog's existence.",
        failureFeedback: "Common slips: confused descendants() with successors() (only direct children); reused predecessors() (wrong direction); forgot to validate fqn exists in graph (KeyError on typos).",
        portfolioRelevance: "Senior reviewers ALWAYS ask 'show me impact analysis'. NetworkX in 5 lines is the right answer.",
        finalExplanation: "Lineage is fundamentally a directed graph. Once you model it that way, every interesting question becomes a 1-line graph algorithm.",
        misconceptionToWatchFor: "Building lineage as a SQL self-join. Works for 1 hop, fails by hop 3. Use a graph.",
      }),
    },
    {
      stepNumber: 4,
      title: "Governance overlay — ownership + PII tags",
      instructionMd:
        "Implement `apply_overlay(entities, overlay_yaml) -> entities'` that reads a YAML overlay (`schema.table.column: { owner, pii: bool, slo_hours }`) and stamps each entity. Validator loads the fixture overlay and expects `analytics.dim_user.email` to come out with `owner='data-platform@'`, `pii=True`, `slo_hours=24`.",
      learningObjective: "Separate immutable warehouse metadata from mutable governance metadata via overlays.",
      requiredSkill: "YAML parsing + merge semantics + governance modeling",
      starterCode: SRC(`# governance.py
import yaml
from dataclasses import asdict

def apply_overlay(entities, overlay_path: str):
    with open(overlay_path) as f:
        overlay = yaml.safe_load(f) or {}
    # overlay shape: { 'analytics.dim_user': { owner: '...', columns: { email: { pii: true, slo_hours: 24 } } } }
    for ent in entities:
        ent_key = f"{ent.schema}.{ent.name}"
        spec = overlay.get(ent_key, {})
        # TODO: stamp entity-level owner + slo_hours.
        # TODO: stamp per-column pii + per-column overrides.
    return entities
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "apply_overlay() reads the YAML and stamps entity-level owner and slo_hours onto matching entities.",
          "apply_overlay() stamps per-column pii=true on columns listed in the YAML's columns section.",
          "analytics.dim_user.email column has owner='data-platform@', pii=True, and slo_hours=24 after applying the fixture overlay.",
          "Entity-level owner cascades to columns that do not have a column-specific owner override in the YAML.",
          "Re-running apply_overlay() on already-stamped entities produces the same result (idempotent).",
        ],
      }),
      expectedOutputs: { owner: "data-platform@", pii: true, slo_hours: 24 },
      datasetRefs: ["fixtures/governance_overlay.yml"],
      pedagogy: pedagogyConfig({
        hints: [
          "Overlay YAML is human-edited; the warehouse-derived catalog is machine-derived. Never blend them at the storage layer.",
          "Cascade entity-level owner DOWN to columns unless a column overrides — saves overlay verbosity.",
          "Validate the overlay against the live catalog at apply time; warn on orphan keys (typos in YAML).",
          "PII flags drive downstream masking — never default them to True silently; require explicit annotation.",
          "for col in ent.columns: col.pii = spec.get('columns', {}).get(col.name, {}).get('pii', False); col.owner = spec.get('columns', {}).get(col.name, {}).get('owner', spec.get('owner'))",
        ],
        successFeedback: "Governance is now version-controlled in YAML. Reviews happen in PRs, not Slack DMs.",
        failureFeedback: "Common slips: stored owner+PII in the same table as the crawler output (overwritten on next crawl); didn't validate overlay keys (silent drift).",
        portfolioRelevance: "GitOps-style governance overlays are the 2026 pattern. Vendor catalogs are catching up; build it natively and you're ahead.",
        finalExplanation: "Separating 'what exists' (crawler) from 'how it's governed' (overlay) is the layered-catalog architecture. Don't compromise.",
        misconceptionToWatchFor: "Editing governance directly in the catalog UI. Untracked, unreviewed, lost on every crawler rerun.",
      }),
    },
    {
      stepNumber: 5,
      title: "FastAPI search + lineage endpoints",
      instructionMd:
        "Expose two endpoints: `GET /search?q=email` returns column matches (substring, case-insensitive) and `GET /lineage/{fqn}` returns `{upstream: [...], downstream: [...]}`. Both must respond <100ms on the 9-table fixture. Atlas checks that your submission contains the required evidence marker (`analytics.dim_user.email`) — it does not run your API, count results, or measure latency. Verify endpoint behavior and latency yourself.",
      learningObjective: "Wrap catalog primitives behind a stable API a UI can iterate against.",
      requiredSkill: "FastAPI + Pydantic response models + simple latency budgets",
      starterCode: SRC(`# api.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import networkx as nx

app = FastAPI()
_GRAPH: nx.DiGraph | None = None
_CATALOG: list = []  # entities loaded at startup

class LineageResp(BaseModel):
    fqn: str
    upstream: list[str]
    downstream: list[str]

@app.get('/search')
def search(q: str) -> list[dict]:
    needle = q.lower()
    # TODO: return [{'fqn': f"{e.schema}.{e.name}.{c.name}", 'pii': c.pii} ...] where needle in c.name.lower()
    return []

@app.get('/lineage/{fqn}', response_model=LineageResp)
def lineage(fqn: str) -> LineageResp:
    if _GRAPH is None or fqn not in _GRAPH:
        raise HTTPException(404, f"unknown fqn: {fqn}")
    # TODO: return upstream = sorted(ancestors), downstream = sorted(descendants)
    return LineageResp(fqn=fqn, upstream=[], downstream=[])
`),
      validationType: "contains",
      stepType: "code_python",
      validation: validationConfig("contains", "Atlas checks that the required evidence markers are present in your submission — not that the query/API otherwise behaves correctly, and not your authorship or competence. Specifically: your submission must contain 'analytics.dim_user.email'. Atlas does not run your API, count search results, verify downstream counts, or measure p95 latency — verify those yourself.", {
        needles: ["analytics.dim_user.email"],
      }),
      expectedOutputs: { searchHits: 3, downstream: 3, upstream: 0, p95Ms: 35 },
      datasetRefs: ["fixtures/expected_search.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "For <10k columns, in-memory substring search is fine + dead simple — premature Elasticsearch is the trap.",
          "Pydantic response_model gives free OpenAPI docs + locks the contract — every UI build should depend on it.",
          "Cache the lineage graph in memory; rebuild on a /admin/reindex call rather than per-request.",
          "Set FastAPI's `response_model_exclude_unset=True` to keep payloads tight for tree views.",
          "return LineageResp(fqn=fqn, upstream=sorted(nx.ancestors(_GRAPH, fqn)), downstream=sorted(nx.descendants(_GRAPH, fqn)))",
        ],
        successFeedback: "Catalog has a public API surface. Frontend, Slack bot, CI checks — all can depend on it.",
        failureFeedback: "Common slips: linear-scanned the DB per request (>100ms easy); skipped Pydantic models (UI breaks on shape drift); didn't 404 on unknown fqn (returns empty arrays, confusing).",
        portfolioRelevance: "A working /lineage endpoint is the demo that closes interviews. Reviewers can hit it themselves in 30s.",
        finalExplanation: "The API isn't an afterthought — it's where the catalog earns its keep. Optimize for the consumer.",
        misconceptionToWatchFor: "Exposing the raw catalog DB and letting consumers write joins. Schema changes will break every consumer the next day.",
      }),
    },
  ],
};
