/**
 * Phase 7 — ai-engineer / LLM-serving checkpoint project.
 * Promotes candidate 1f0d4364-e8af-4054-83fb-918a4976f51c
 * (RAG Baseline with pgvector, candidate score 74.8).
 *
 * Validates the authoring helpers on a python project with `json_equal`
 * validation + tier-1 LLM stack (openai + pgvector + fastapi + rag).
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const STARTER_S1 = `# starter: connect to Postgres and create the pgvector schema.
# pgvector is a Postgres extension that stores fixed-dimension float vectors
# and adds an <-> (L2-distance) operator + ivfflat / hnsw indexes.
#
# Connect with psycopg (sync API is fine here — single migration script).
# Required env var: DATABASE_URL (the project's Postgres connection string).
import os
import psycopg

DDL = """
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS doc_chunks (
  id            BIGSERIAL PRIMARY KEY,
  doc_id        TEXT        NOT NULL,
  chunk_index   INTEGER     NOT NULL,
  content       TEXT        NOT NULL,
  embedding     vector(1536) NOT NULL,           -- text-embedding-3-small dim
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (doc_id, chunk_index)
);

-- TODO: add a pgvector index on the embedding column.
-- Use IVFFLAT with lists=100 and the vector_l2_ops opclass so the planner
-- can use the <-> operator for k-NN search.
"""

def main() -> dict:
    url = os.environ["DATABASE_URL"]
    with psycopg.connect(url) as conn, conn.cursor() as cur:
        cur.execute(DDL)
    return {"status": "ok", "table": "doc_chunks"}

if __name__ == "__main__":
    print(main())
`;

const EXPECTED_S1 = `CREATE INDEX IF NOT EXISTS doc_chunks_embedding_ivfflat
  ON doc_chunks USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);`;

const STARTER_S2 = `# Chunk + embed a doc with the OpenAI embeddings API.
# Use the asyncio client so chunks embed concurrently — at production scale
# this is the difference between a 4-second ingest and a 40-second ingest.
#
# Env vars: OPENAI_API_KEY, DATABASE_URL.
import asyncio
import os
from typing import Iterable
import psycopg
from openai import AsyncOpenAI

CHUNK_SIZE = 800   # chars; ~200 tokens
CHUNK_OVERLAP = 120
MODEL = "text-embedding-3-small"

def chunk(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    # TODO: return a list of overlapping windows of length \`size\` stepped by
    # (size - overlap). Drop empty windows. Preserve order.
    raise NotImplementedError

async def embed_batch(client: AsyncOpenAI, texts: list[str]) -> list[list[float]]:
    # TODO: call client.embeddings.create(model=MODEL, input=texts) and
    # return [e.embedding for e in response.data] in input order.
    raise NotImplementedError

async def ingest(doc_id: str, body: str) -> int:
    client = AsyncOpenAI()
    chunks = chunk(body)
    vectors = await embed_batch(client, chunks)
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        rows = [(doc_id, i, c, v) for i, (c, v) in enumerate(zip(chunks, vectors))]
        cur.executemany(
            "INSERT INTO doc_chunks (doc_id, chunk_index, content, embedding) "
            "VALUES (%s, %s, %s, %s) ON CONFLICT (doc_id, chunk_index) DO NOTHING",
            rows,
        )
    return len(rows)

if __name__ == "__main__":
    n = asyncio.run(ingest("README", open("README.md").read()))
    print({"inserted": n})
`;

const EXPECTED_S2 = `def chunk(text, size=800, overlap=120):
    step = size - overlap
    out = []
    for i in range(0, max(len(text), 1), step):
        window = text[i:i+size]
        if window:
            out.append(window)
        if i + size >= len(text):
            break
    return out

async def embed_batch(client, texts):
    resp = await client.embeddings.create(model="text-embedding-3-small", input=texts)
    return [e.embedding for e in resp.data]`;

const STARTER_S3 = `# Top-k nearest-neighbor retrieval.
# Embed the query once, then SELECT ... ORDER BY embedding <-> %s LIMIT k.
# Returns the chunk text + cosine-similarity-equivalent distance.
import os, asyncio
import psycopg
from openai import AsyncOpenAI

K = 4

async def retrieve(question: str, k: int = K) -> list[dict]:
    client = AsyncOpenAI()
    # TODO: embed the question with text-embedding-3-small.
    q_vec: list[float] = []

    with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        # TODO: SELECT doc_id, chunk_index, content, embedding <-> %s AS dist
        # FROM doc_chunks ORDER BY dist LIMIT %s
        rows = []
        return [
            {"doc_id": r[0], "chunk_index": r[1], "content": r[2], "distance": float(r[3])}
            for r in rows
        ]

if __name__ == "__main__":
    print(asyncio.run(retrieve("what is pgvector?")))
`;

const EXPECTED_S3 = `q_vec = (await client.embeddings.create(model="text-embedding-3-small", input=[question])).data[0].embedding
cur.execute(
    "SELECT doc_id, chunk_index, content, embedding <-> %s AS dist "
    "FROM doc_chunks ORDER BY dist LIMIT %s",
    (q_vec, k),
)
rows = cur.fetchall()`;

const STARTER_S4 = `# Wire retrieval into a FastAPI /ask endpoint with a Pydantic response model.
# This is the public surface a frontend (or evaluator) will call.
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from openai import AsyncOpenAI

from .retrieve import retrieve  # from step 3

app = FastAPI(title="RAG Baseline")
oai = AsyncOpenAI()

SYSTEM = (
    "Answer using ONLY the provided context. If the context is insufficient, "
    "say 'I don't know.' Cite chunk indices like [doc:chunk]."
)

class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    k: int = Field(default=4, ge=1, le=10)

class Citation(BaseModel):
    doc_id: str
    chunk_index: int
    distance: float

class AskResponse(BaseModel):
    answer: str
    citations: list[Citation]

@app.post("/ask", response_model=AskResponse)
async def ask(req: AskRequest) -> AskResponse:
    # TODO:
    #   1) hits = await retrieve(req.question, k=req.k)
    #   2) if not hits: raise HTTPException(404, "no relevant context")
    #   3) build context = "\\n---\\n".join(f"[{h['doc_id']}:{h['chunk_index']}] {h['content']}" for h in hits)
    #   4) call oai.chat.completions.create(model="gpt-4o-mini", messages=[{role:system,content:SYSTEM},{role:user,content:f"Context:\\n{context}\\n\\nQ: {req.question}"}])
    #   5) return AskResponse(answer=..., citations=[Citation(**h) for h in hits])
    raise HTTPException(501, "implement me")
`;

const EXPECTED_S4 = `# (sketch of the body of ask())
hits = await retrieve(req.question, k=req.k)
if not hits:
    raise HTTPException(status_code=404, detail="no relevant context")
context = "\\n---\\n".join(f"[{h['doc_id']}:{h['chunk_index']}] {h['content']}" for h in hits)
chat = await oai.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": f"Context:\\n{context}\\n\\nQ: {req.question}"},
    ],
)
return AskResponse(
    answer=chat.choices[0].message.content,
    citations=[Citation(doc_id=h["doc_id"], chunk_index=h["chunk_index"], distance=h["distance"]) for h in hits],
)`;

const STARTER_S5 = `# Eval harness: ground-truth Q/A pairs scored with two metrics.
#   - Hit@k: did the gold chunk appear in the top-k retrieved chunks?
#   - Faithfulness proxy: does the model's answer contain the gold-snippet
#     substring? (A real prod system uses an LLM judge — out of scope here.)
import asyncio, json, statistics
from .retrieve import retrieve
import httpx

EVAL = [
    {"q": "What is pgvector?", "gold_chunk": ("README", 0), "gold_snippet": "Postgres extension"},
    {"q": "What index type does the project use?", "gold_chunk": ("README", 2), "gold_snippet": "ivfflat"},
    {"q": "What embedding model?", "gold_chunk": ("README", 1), "gold_snippet": "text-embedding-3-small"},
]

async def eval_one(item: dict) -> dict:
    hits = await retrieve(item["q"], k=4)
    hit_at_k = any((h["doc_id"], h["chunk_index"]) == item["gold_chunk"] for h in hits)
    async with httpx.AsyncClient() as cli:
        r = await cli.post("http://localhost:8000/ask", json={"question": item["q"], "k": 4})
        ans = r.json()["answer"]
    # TODO: compute faithfulness as item["gold_snippet"].lower() in ans.lower()
    faithfulness = False
    return {"q": item["q"], "hit_at_k": hit_at_k, "faithfulness": faithfulness}

async def main() -> dict:
    results = [await eval_one(x) for x in EVAL]
    return {
        "n": len(results),
        "hit_at_k": statistics.mean(1 if r["hit_at_k"] else 0 for r in results),
        "faithfulness": statistics.mean(1 if r["faithfulness"] else 0 for r in results),
        "per_item": results,
    }

if __name__ == "__main__":
    print(json.dumps(asyncio.run(main()), indent=2))
`;

const EXPECTED_S5 = `faithfulness = item["gold_snippet"].lower() in ans.lower()`;

export const aiEngineerRagBaselinePgvector: AuthoredProject = {
  slug: "ai-engineer-rag-baseline-pgvector",
  candidateId: "1f0d4364-e8af-4054-83fb-918a4976f51c",
  title: "RAG Baseline with pgvector — Ingest, Retrieve, Serve, Evaluate",
  shortDescription:
    "Build a production-style retrieval-augmented Q&A service end-to-end: chunk + embed docs with the OpenAI async client, store vectors in Postgres+pgvector, serve a FastAPI /ask endpoint with Pydantic models, then measure hit@k + faithfulness on a ground-truth eval set.",
  fullDescription:
    "You're the founding AI engineer at a B2B SaaS startup. Customers keep asking the support team the same 50 questions that are answered in your docs — but the support volume is killing your team. Your CTO wants a retrieval-augmented assistant in production by end of sprint: it must cite which doc chunk every answer came from, refuse to answer when the docs don't cover the question, and ship with a tiny ground-truth evaluation set so quality regressions get caught in CI. In this project you'll wire the four standard RAG layers (ingest → index → retrieve → generate) plus the missing fifth layer everyone skips on demo day: an eval harness with hit@k retrieval accuracy + a faithfulness proxy. Stack is the 2026 tier-1 RAG default: OpenAI embeddings, Postgres + pgvector (ivfflat index), FastAPI + Pydantic, async I/O end-to-end. The deliverable is a public GitHub repo + a deployed FastAPI service.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "FastAPI", "pgvector", "Postgres", "OpenAI", "Pydantic"],
  tags: ["rag", "openai", "pgvector", "fastapi", "evals", "vector-search", "ai-engineering", "embeddings"],
  learningObjectives: [
    "Set up pgvector and choose an appropriate ivfflat index for k-NN over OpenAI embeddings.",
    "Chunk + embed documents using the async OpenAI client with bounded concurrency.",
    "Perform top-k nearest-neighbor retrieval against pgvector with the <-> operator.",
    "Compose retrieval into a FastAPI /ask endpoint with Pydantic request + response models and citation IDs.",
    "Measure retrieval quality with hit@k and answer faithfulness on a ground-truth eval set.",
  ],
  estimatedMinutes: 180,
  xpReward: 600,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "B2B SaaS support deflection. 50 repeat questions live in the docs but support is buried answering them by hand. Build a citation-required RAG assistant by end of sprint with CI-checked retrieval quality.",
    hiringRelevance2026:
      "Every 2026 AI-engineer job posting expects RAG + pgvector OR a hosted vector DB, async Python, FastAPI, and at least a hand-wave at evals. 'I built a RAG over docs' is now table-stakes; the differentiator is shipping it with citations + a real eval harness, which this project gives you.",
    readmeOutline: [
      "Overview & Scenario",
      "Architecture (ingest → index → retrieve → generate → eval)",
      "Setup (Postgres + pgvector + env vars)",
      "Step 1 — Schema + ivfflat index",
      "Step 2 — Async chunking + embedding",
      "Step 3 — Top-k retrieval",
      "Step 4 — FastAPI /ask endpoint with citations",
      "Step 5 — Eval harness (hit@k + faithfulness)",
      "Deployment notes (Fly.io / Railway recipe)",
      "Portfolio Hand-off (deployed URL + screencast)",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "service",
    deliverable:
      "Deployed FastAPI service exposing POST /ask, backed by a managed Postgres+pgvector instance. Public GitHub repo containing the migrations (`/db`), ingestion CLI (`/ingest`), retrieval module (`/retrieve`), FastAPI app (`/app`), eval harness (`/evals`), Dockerfile, and CI workflow that runs the eval harness on every PR.",
    portfolioRelevance:
      "A 2026 AI-engineering hiring manager opening this repo + clicking the deployed /ask endpoint sees: tier-1 stack, async Python, Pydantic-typed surface, citation enforcement, AND a CI-gated eval harness. That last item alone separates this from the 95% of bootcamp 'I built a RAG' projects and reads as senior-IC work.",
    demoUrl: "https://<your-handle>-rag-baseline.fly.dev/docs",
    repoUrl: "https://github.com/<your-handle>/rag-baseline-pgvector",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Schema + pgvector ivfflat index",
      instructionMd: [
        "Create the `doc_chunks` table and the pgvector extension. The embedding column is `vector(1536)` to match `text-embedding-3-small`. The starter ships the DDL but leaves the **index** as a TODO.",
        "",
        "Add an `IVFFLAT` index on the `embedding` column using `vector_l2_ops` with `lists = 100`. Without this index, the `<->` k-NN operator falls back to a sequential scan and retrieval latency becomes O(N) instead of O(log N).",
        "",
        "The validator checks the migration runs cleanly AND that an index exists on `doc_chunks(embedding)` with `am = 'ivfflat'`.",
      ].join("\n"),
      learningObjective: "Set up pgvector and choose an appropriate ivfflat k-NN index sized for the dataset.",
      requiredSkill: "Postgres DDL + pgvector index choice",
      starterCode: STARTER_S1,
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig(
        "json_equal",
        "main() returns {status:'ok', table:'doc_chunks'} AND pg_indexes shows an ivfflat index on doc_chunks(embedding).",
        {
          stdoutMustEqualJson: { status: "ok", table: "doc_chunks" },
          dbAssertion: "SELECT 1 FROM pg_indexes WHERE tablename='doc_chunks' AND indexdef ILIKE '%ivfflat%' AND indexdef ILIKE '%vector_l2_ops%'",
          referenceSolution: EXPECTED_S1,
        },
      ),
      expectedOutputs: { status: "ok", table: "doc_chunks" },
      datasetRefs: ["fixtures/schema_initial.sql"],
      pedagogy: pedagogyConfig({
        hints: [
          "pgvector defines a k-NN distance operator `<->`, but the planner only uses it efficiently when there's a matching index on the embedding column.",
          "The two main index types are `IVFFLAT` (fast build, good for ≤1M rows) and `HNSW` (better recall, slower build). For a doc-chunks demo, `IVFFLAT` with `lists ≈ sqrt(N)` is standard.",
          "Add `CREATE INDEX ... USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);` to the DDL. `vector_l2_ops` is the opclass that pairs with the `<->` (L2 distance) operator.",
          "CREATE INDEX IF NOT EXISTS doc_chunks_embedding_ivfflat\n  ON doc_chunks USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);",
          EXPECTED_S1,
        ],
        successFeedback:
          "Schema is now ready for production-shape retrieval — `<->` queries will use the ivfflat index instead of a seq scan.",
        failureFeedback:
          "Missed the index → retrieval still works but degrades linearly with row count. Common slip: using `vector_cosine_ops` with the `<->` operator (mismatched: cosine pairs with `<=>`, not `<->`).",
        portfolioRelevance:
          "Every AI-engineering interview asks 'what index did you put on the vectors and why?'. Knowing that ivfflat lists ≈ sqrt(N) and that opclass must match the distance operator is the difference between a junior and a senior answer.",
        finalExplanation:
          "Two index families exist for pgvector. IVFFLAT clusters vectors into `lists` buckets and probes a configurable number of them per query — fast build, tunable recall via `SET ivfflat.probes = K`. HNSW is a hierarchical graph — higher recall but expensive to build/maintain. For most prod RAG stacks under ~10M chunks, IVFFLAT with `lists = sqrt(N)` is the sweet spot. The opclass-operator pairing is mandatory: `vector_l2_ops`↔`<->`, `vector_cosine_ops`↔`<=>`, `vector_ip_ops`↔`<#>`.",
        misconceptionToWatchFor:
          "Creating the index BEFORE bulk-loading. IVFFLAT clusters during build, so an empty-table index gives garbage clustering. In production: bulk-load first, then CREATE INDEX, then incremental inserts.",
      }),
    },
    {
      stepNumber: 2,
      title: "Async chunking + embedding pipeline",
      instructionMd: [
        "Implement `chunk()` and `embed_batch()`. The chunker produces overlapping windows of `CHUNK_SIZE` characters stepped by `CHUNK_SIZE - CHUNK_OVERLAP`. The embedder is one async call to `client.embeddings.create(model='text-embedding-3-small', input=texts)` returning the embeddings in input order.",
        "",
        "Why async + batched? OpenAI's embeddings endpoint accepts up to 2,048 inputs per request — batching means 1 round-trip per doc instead of N. Using `AsyncOpenAI` lets you fan out concurrent doc ingestion later without rewriting.",
        "",
        "Validator runs `ingest('TEST_DOC', '<~2000 chars of fixture text>')` against a mocked OpenAI client + the real Postgres, and asserts the row count + the order-preservation invariant on chunk_index.",
      ].join("\n"),
      learningObjective: "Chunk documents with overlap and embed them concurrently with the async OpenAI client.",
      requiredSkill: "Python asyncio + OpenAI AsyncClient + Pydantic-flavored typing",
      starterCode: STARTER_S2,
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig(
        "json_equal",
        "ingest() inserts the right number of chunks with monotonic chunk_index starting at 0, and embedding vectors match the (mocked) embedding service output dimension.",
        {
          fixtureDocChars: 2000,
          stdoutMustEqualJson: { inserted: 3 },
          dbAssertion: "SELECT array_agg(chunk_index ORDER BY chunk_index) FROM doc_chunks WHERE doc_id='TEST_DOC' -- expect {0,1,2}",
          referenceSolution: EXPECTED_S2,
        },
      ),
      expectedOutputs: { inserted: 3, firstChunkIndex: 0, dimension: 1536 },
      datasetRefs: ["fixtures/test_doc_2000_chars.txt", "fixtures/mocked_embeddings.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Chunking with overlap means each window starts `CHUNK_SIZE - CHUNK_OVERLAP` characters after the previous one. Think about what happens at the boundary so you don't infinite-loop on short docs.",
          "Use `range(0, len(text), step)` where `step = CHUNK_SIZE - CHUNK_OVERLAP`. Slice `text[i:i+size]`. Drop empty slices. Break once you've covered the whole string.",
          "For `embed_batch`, the OpenAI SDK returns `response.data` as a list aligned with `input`. Just `[e.embedding for e in resp.data]` in that order.",
          "def chunk(text, size=800, overlap=120):\n    step = size - overlap\n    out = []\n    for i in range(0, max(len(text), 1), step):\n        window = text[i:i+size]\n        if window:\n            out.append(window)\n        if i + size >= len(text):\n            break\n    return out",
          EXPECTED_S2,
        ],
        successFeedback:
          "Async batched embedding — one round-trip per doc, order preserved, ON CONFLICT DO NOTHING means rerunning ingest is idempotent.",
        failureFeedback:
          "Common slips: forgot `await` on `client.embeddings.create` (returns a coroutine, not data); reordered chunks before zipping (chunk_index no longer matches content); didn't drop empty trailing windows when the text length is an exact multiple of step.",
        portfolioRelevance:
          "Recruiters scanning for AI-engineer roles in 2026 look for `AsyncOpenAI` + batched embeds — it shows you've thought about token cost AND wall-clock latency at scale, not just the happy-path tutorial.",
        finalExplanation:
          "Three production-grade behaviors are baked into this step: (1) async I/O so concurrent doc ingestion doesn't serialize on the network; (2) batching to amortize per-request overhead and stay under rate limits; (3) ON CONFLICT DO NOTHING on the natural key so re-runs are idempotent — critical for CI/CD pipelines that may retry ingest jobs.",
        misconceptionToWatchFor:
          "Calling `client.embeddings.create` once per chunk in a loop. That's N round-trips per doc; for a 50-chunk README it's 50× slower and 50× more rate-limit pressure than the batched form.",
      }),
    },
    {
      stepNumber: 3,
      title: "Top-k nearest-neighbor retrieval",
      instructionMd: [
        "Implement `retrieve(question, k)`. Embed the question, then SELECT `doc_id, chunk_index, content, embedding <-> %s AS dist FROM doc_chunks ORDER BY dist LIMIT %s`. Return a list of dicts.",
        "",
        "Pass the embedding as a Python `list[float]`; psycopg + pgvector know how to bind it. The `<->` operator returns L2 distance — lower is more similar.",
        "",
        "Validator runs retrieve() against a small pre-seeded fixture (3 docs, 12 chunks) and expects the top hit for the question 'What is pgvector?' to be `('README', 0)`.",
      ].join("\n"),
      learningObjective: "Perform parameterized top-k vector retrieval with the pgvector `<->` operator.",
      requiredSkill: "psycopg parameterized vector queries + asyncio",
      starterCode: STARTER_S3,
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig(
        "json_equal",
        "First element of retrieve('What is pgvector?', k=4) has doc_id='README' and chunk_index=0.",
        {
          fixtureSeed: "fixtures/rag_eval_corpus.json",
          stdoutMustContainShape: { "0.doc_id": "README", "0.chunk_index": 0 },
          referenceSolution: EXPECTED_S3,
        },
      ),
      expectedOutputs: { topDocId: "README", topChunkIndex: 0, k: 4 },
      datasetRefs: ["fixtures/rag_eval_corpus.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "You need TWO things from OpenAI: the query embedding (same model as ingestion!) and a single SQL query that orders by distance.",
          "`await client.embeddings.create(model='text-embedding-3-small', input=[question])` then `.data[0].embedding`. Pass that list as the first parameter; psycopg binds it to pgvector's `vector` type.",
          "SQL: `SELECT doc_id, chunk_index, content, embedding <-> %s AS dist FROM doc_chunks ORDER BY dist LIMIT %s`. Don't forget to ORDER BY the distance alias.",
          "q_vec = (await client.embeddings.create(model='text-embedding-3-small', input=[question])).data[0].embedding\ncur.execute('SELECT doc_id, chunk_index, content, embedding <-> %s AS dist FROM doc_chunks ORDER BY dist LIMIT %s', (q_vec, k))\nrows = cur.fetchall()",
          EXPECTED_S3,
        ],
        successFeedback:
          "Retrieval works. Notice how the same model from ingest must be used here — embeddings from different models live in different spaces and have no shared meaning.",
        failureFeedback:
          "Common slips: used `text-embedding-3-large` here but `-small` at ingest (dimensions mismatch → DB error or garbage results); forgot to LIMIT (returns the whole table); wrapped q_vec in a tuple of tuples accidentally.",
        portfolioRelevance:
          "'Parameterized k-NN query against pgvector' is a perfect concrete answer to 'how does retrieval work in your RAG?' — better than waving at LangChain.",
        finalExplanation:
          "The model symmetry rule (same embedding model at ingest and query) is non-negotiable. Embeddings from different models live in DIFFERENT high-dimensional spaces — there is no rotation that aligns them. If you ever change your embedding model, you MUST re-embed your entire corpus. This is the #1 footgun in production RAG.",
        misconceptionToWatchFor:
          "Trying to 'just normalize' embeddings to make different models comparable. Normalization doesn't help — the spaces are structurally different (different basis vectors, different concepts at different axes).",
      }),
    },
    {
      stepNumber: 4,
      title: "FastAPI /ask endpoint with Pydantic + citations",
      instructionMd: [
        "Wire `retrieve()` into a FastAPI POST /ask endpoint with a Pydantic request model (question + k) and a Pydantic response model (answer + citations).",
        "",
        "The system prompt enforces 'answer only from context; cite chunk IDs like [doc:chunk]; say I don't know if context is insufficient'. This is the production safeguard against hallucination — the model literally cannot make up source attributions.",
        "",
        "Return 404 if retrieval yields zero hits (no relevant context). Use `gpt-4o-mini` as the generation model for cost.",
        "",
        "Validator boots the app with TestClient, mocks the OpenAI chat call to return a known string, asserts the response shape matches the `AskResponse` schema, and asserts citations is a non-empty list when retrieval seeds hits.",
      ].join("\n"),
      learningObjective: "Compose retrieval into a FastAPI surface with Pydantic-typed request/response and structured citations.",
      requiredSkill: "FastAPI + Pydantic + async route handlers + HTTPException",
      starterCode: STARTER_S4,
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig(
        "json_equal",
        "POST /ask {question:'What is pgvector?', k:4} returns 200 with answer:string + citations:list[Citation] non-empty.",
        {
          requestBody: { question: "What is pgvector?", k: 4 },
          responseShape: { answer: "string", citations: "non-empty list of {doc_id, chunk_index, distance}" },
          referenceSolution: EXPECTED_S4,
        },
      ),
      expectedOutputs: { status: 200, citationsMinCount: 1 },
      datasetRefs: ["fixtures/rag_eval_corpus.json", "fixtures/mocked_chat_completion.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Five things have to happen inside `ask()`: retrieve, guard, build context, call the chat model, return the typed response. Try to enumerate them before writing code.",
          "Build the context string by joining each hit as `[doc_id:chunk_index] content` with `\\n---\\n` separators. That gives the LLM clear chunk boundaries to cite.",
          "Don't `200` an empty-context response — raise `HTTPException(404, 'no relevant context')`. Front-ends need to distinguish 'I don't know' from 'no docs covered this' to escalate to a human.",
          "hits = await retrieve(req.question, k=req.k)\nif not hits: raise HTTPException(404, 'no relevant context')\ncontext = '\\n---\\n'.join(f\"[{h['doc_id']}:{h['chunk_index']}] {h['content']}\" for h in hits)\nchat = await oai.chat.completions.create(model='gpt-4o-mini', messages=[{'role':'system','content':SYSTEM},{'role':'user','content':f'Context:\\n{context}\\n\\nQ: {req.question}'}])\nreturn AskResponse(answer=chat.choices[0].message.content, citations=[Citation(**h) for h in hits])",
          EXPECTED_S4,
        ],
        successFeedback:
          "Citation-required, typed surface ready. A frontend can call this and trust the response shape AND know every answer is grounded in retrieved chunks.",
        failureFeedback:
          "Common slips: returned a dict instead of `AskResponse(...)` (works but loses schema validation on the return side); built the context with newlines that mask chunk boundaries; forgot to `await` the chat completion call.",
        portfolioRelevance:
          "Showing 'Pydantic-typed in AND out, citation enforcement in the prompt, 404 on no-context' on a recruiter call communicates production-readiness in 30 seconds. Most demo projects skip the 404 branch.",
        finalExplanation:
          "Three patterns make this 'production-shape' rather than 'demo': (1) Pydantic on both sides means the OpenAPI schema is auto-generated and clients get types for free; (2) explicit 404 distinguishes 'no relevant context' from 'I don't know'; (3) citations as structured data (not just substrings in the answer text) means the frontend can render links/highlights without parsing prose.",
        misconceptionToWatchFor:
          "Trusting the LLM to cite without enforcing structure. Without the structured citations list, you can't reliably highlight sources in the UI — the model will paraphrase 'as the docs say...' and you have no way to link it back.",
      }),
    },
    {
      stepNumber: 5,
      title: "Eval harness: hit@k + faithfulness",
      instructionMd: [
        "Build the eval harness. Three ground-truth Q/A pairs are provided; for each: (1) run `retrieve(q, k=4)` and check whether the gold (doc_id, chunk_index) appears in the top-4 (`hit@4`), then (2) POST to /ask and check whether the gold snippet substring is present in the answer (`faithfulness` proxy).",
        "",
        "Real production RAG systems use an LLM judge for faithfulness (e.g. Ragas, OpenAI evals). The substring check here is a deterministic stand-in suitable for CI.",
        "",
        "Validator runs `main()` against the seeded corpus and asserts `hit_at_k >= 0.66` AND `faithfulness >= 0.66`. The whole harness is wired into CI so any regression in retrieval or prompting fails the build.",
      ].join("\n"),
      learningObjective: "Measure retrieval quality with hit@k and answer faithfulness on a ground-truth eval set, suitable for CI gating.",
      requiredSkill: "Python asyncio + httpx + offline evaluation design",
      starterCode: STARTER_S5,
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig(
        "json_equal",
        "main() returns {n:3, hit_at_k:>=0.66, faithfulness:>=0.66} against the seeded corpus.",
        {
          requireHitAtK: 0.66,
          requireFaithfulness: 0.66,
          referenceSolution: EXPECTED_S5,
        },
      ),
      expectedOutputs: { n: 3, hit_at_k_min: 0.66, faithfulness_min: 0.66 },
      datasetRefs: ["fixtures/rag_eval_set.json", "fixtures/rag_eval_corpus.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Faithfulness here is the simplest possible signal: is the gold snippet text actually present in the model's answer?",
          "`item['gold_snippet'].lower() in ans.lower()` — a substring check on the lower-cased answer.",
          "Wire `main()` into CI (e.g. GitHub Actions) and fail the build when either metric drops below the threshold. That's how you stop silent quality regressions from prompt edits.",
          "faithfulness = item['gold_snippet'].lower() in ans.lower()",
          EXPECTED_S5,
        ],
        successFeedback:
          "Eval harness reports both metrics and is CI-ready. The substring faithfulness check is intentionally simple and deterministic — perfect for blocking regressions without spending tokens on an LLM judge per PR.",
        failureFeedback:
          "Common slips: case-sensitive substring check (false negatives on capitalization); used the full answer's first sentence instead of checking substring presence; forgot statistics.mean returns a float (asserted ==1 instead of >=threshold).",
        portfolioRelevance:
          "Saying 'I gate every RAG prompt change on a hit@k + faithfulness eval in CI' in an interview is an instant senior-engineer signal. Most candidates have never set up an eval harness at all.",
        finalExplanation:
          "Evals are the discipline that separates demo-stage RAG from production-stage RAG. Even a 3-row ground-truth set is dramatically better than nothing — it catches the worst regression (someone changed the system prompt and now the model answers from its own knowledge instead of context). Production-grade evals layer in: more rows, an LLM judge for nuance, latency/cost panels, and per-doc-class breakdowns to spot data drift.",
        misconceptionToWatchFor:
          "Treating evals as 'do it once before launch'. Evals are a CI-gated thing — every PR that touches prompts, chunking, or retrieval must clear the threshold or it doesn't merge.",
      }),
    },
  ],
};
