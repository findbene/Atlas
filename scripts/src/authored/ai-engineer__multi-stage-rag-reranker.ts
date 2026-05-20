/**
 * Phase 7 — Wave 1a / ai-engineer (advanced).
 * Candidate 9e681a72-cd70-4242-b44b-a880d3e8cd9e — Multi-Stage RAG with Reranker (74.8).
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const aiEngineerMultiStageRagReranker: AuthoredProject = {
  slug: "ai-engineer-multi-stage-rag-reranker",
  title: "Multi-Stage RAG with Reranker — Retrieve, Rerank, Generate",
  shortDescription:
    "Build a two-stage RAG pipeline: cheap pgvector ANN retrieval pulls a wide candidate set, then a Cohere/BGE cross-encoder reranker scores the top-N for the LLM. Ships with an A/B eval harness measuring NDCG@10 vs the single-stage baseline.",
  fullDescription:
    "Your baseline RAG hallucinates because top-k pgvector ANN misses the actually-relevant chunks 30% of the time. The 2026 production fix is two-stage retrieval: pull a wide candidate set cheaply (top-50 from pgvector), then re-score with a cross-encoder reranker (Cohere Rerank-v3 or BAAI/bge-reranker-v2-m3) to surface the true top-5 before they hit the LLM. You'll wire the async pipeline, add bounded concurrency so rerank latency doesn't blow your SLO, and ship an A/B eval comparing NDCG@10 and hit@5 against the baseline RAG. Stack: pgvector, OpenAI embeddings, Cohere/BGE rerank, FastAPI, async Python.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "FastAPI", "pgvector", "Postgres", "OpenAI", "Pydantic", "huggingface"],
  tags: ["rag", "reranker", "openai", "pgvector", "fastapi", "evals", "vector-search", "ai-engineering"],
  learningObjectives: [
    "Architect a two-stage retrieve→rerank pipeline and reason about its latency/cost vs single-stage RAG.",
    "Build an async wide-candidate retriever returning the top-N over pgvector for downstream reranking.",
    "Call a cross-encoder reranker (Cohere Rerank or BGE) on the candidate set with bounded concurrency.",
    "Compute NDCG@k and hit@k on a ground-truth eval set to prove the reranker delivers.",
    "Expose the pipeline behind a typed FastAPI endpoint with citations and per-stage latency telemetry.",
  ],
  estimatedMinutes: 180,
  xpReward: 600,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Production RAG hallucinates because top-k ANN misses true positives. Bolt on a reranker to lift retrieval quality without rewriting the index.",
    hiringRelevance2026:
      "Every 2026 AI-engineer JD that mentions RAG also mentions 'reranker' or 'cross-encoder'. Knowing the two-stage pattern + NDCG@k eval is the dividing line between junior and senior AI-engineer interview signals.",
    readmeOutline: [
      "Overview", "Architecture (single-stage vs two-stage)", "Step 1 wide retrieval",
      "Step 2 reranker", "Step 3 pipeline composition", "Step 4 NDCG@k eval", "Step 5 FastAPI surface",
      "Latency budget", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "service",
    deliverable:
      "Public GitHub repo + deployed FastAPI service exposing POST /ask with per-stage latency in the response. CI runs the NDCG@k eval on every PR and gates merge on a regression budget.",
    portfolioRelevance:
      "Shows a 2026 hiring manager you understand RAG's actual failure mode (recall-vs-precision tradeoff) and the production fix (two-stage retrieve→rerank), backed by hard numbers (NDCG@10 lift over baseline). Bootcamp RAG projects never get past single-stage.",
    repoUrl: "https://github.com/<your-handle>/multi-stage-rag-reranker",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Wide async candidate retrieval",
      instructionMd:
        "Build `retrieve_candidates(question, k=50)` returning the top-50 chunks from pgvector. This is intentionally WIDER than what you'd send to the LLM — the reranker's job is to pick the true top-5 from these 50. Use the async OpenAI client to embed the query, then SELECT ... ORDER BY embedding <-> %s LIMIT 50 from pgvector. Each row should be a dict {doc_id, chunk_index, content, distance}. The validator seeds 200 chunks and asserts the result is length 50, ordered by distance ASC.",
      learningObjective: "Pull a wide candidate set from pgvector with async embedding + parameterized k-NN.",
      requiredSkill: "psycopg + pgvector + AsyncOpenAI",
      starterCode: SRC(`# wide-retrieve.py
import os, asyncio
import psycopg
from openai import AsyncOpenAI

CANDIDATES_K = 50

async def retrieve_candidates(question: str, k: int = CANDIDATES_K) -> list[dict]:
    client = AsyncOpenAI()
    # TODO: embed question with text-embedding-3-small, then SELECT top-k from pgvector
    # ordered by embedding <-> query_vec ASC. Return list of dicts.
    raise NotImplementedError
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "len(retrieve_candidates(q,50)) == 50 and rows are distance-sorted ASC.", {
        assertLength: 50, assertSortedAsc: "distance",
      }),
      expectedOutputs: { length: 50, sortedAsc: "distance" },
      datasetRefs: ["fixtures/corpus_200_chunks.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Same retrieval shape as baseline RAG — just bigger k.",
          "Embed the question with text-embedding-3-small via AsyncOpenAI, take .data[0].embedding.",
          "SELECT doc_id, chunk_index, content, embedding <-> %s AS dist ORDER BY dist LIMIT %s.",
          "q_vec = (await client.embeddings.create(model='text-embedding-3-small', input=[question])).data[0].embedding; cur.execute(SQL, (q_vec, k))",
          "Return [{'doc_id':r[0],'chunk_index':r[1],'content':r[2],'distance':float(r[3])} for r in cur.fetchall()]",
        ],
        successFeedback: "Wide retrieval shipped — now the reranker has 50 candidates to choose from instead of 5.",
        failureFeedback: "Common slips: forgot ORDER BY (random order); used <#> (inner product, wrong opclass); forgot to await the embedding call.",
        portfolioRelevance: "'I retrieve wide and rerank narrow' is the 30-second answer to 'how do you reduce RAG hallucination?'",
        finalExplanation: "The whole reason two-stage retrieval works: pgvector ANN is fast but recall-imperfect. Pull 10× the budget cheaply, then spend cross-encoder budget on the precision step that actually matters for the LLM context window.",
        misconceptionToWatchFor: "Setting k=5 here 'because that's what we send to the LLM'. The point is to widen the gate so the reranker has options.",
      }),
    },
    {
      stepNumber: 2,
      title: "Cross-encoder reranker call",
      instructionMd:
        "Implement `rerank(question, candidates, top_n=5)` calling Cohere Rerank-v3 (or the open-source BAAI/bge-reranker-v2-m3 via HuggingFace inference). Pass the question + the candidate `content` strings; receive a score per candidate; return the top_n candidates sorted by score DESC. Use async I/O. Why a cross-encoder and not just another embedding? Cross-encoders see (query, doc) jointly and produce a calibrated relevance score — strictly more accurate than cosine distance between independently-embedded vectors. Validator mocks the rerank API to return scores [0.9, 0.8, 0.2, 0.7, 0.1, ...] for the input order, and asserts the returned top-3 has the original indices [0, 1, 3].",
      learningObjective: "Score (query, doc) pairs with a cross-encoder reranker and surface the true top-N.",
      requiredSkill: "Cohere SDK / HuggingFace inference + async + score-sorting",
      starterCode: SRC(`# rerank.py
import os
import cohere

async def rerank(question: str, candidates: list[dict], top_n: int = 5) -> list[dict]:
    co = cohere.AsyncClient(os.environ["COHERE_API_KEY"])
    docs = [c["content"] for c in candidates]
    # TODO: await co.rerank(model="rerank-v3.5", query=question, documents=docs, top_n=top_n)
    # Map back: response.results[i].index -> candidates[index], attach relevance_score.
    raise NotImplementedError
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Given mocked scores [0.9,0.8,0.2,0.7,0.1], rerank(...,top_n=3) returns candidates at original indices [0,1,3] in that order.", {
        mockedScores: [0.9, 0.8, 0.2, 0.7, 0.1], expectedIndices: [0, 1, 3],
      }),
      expectedOutputs: { topIndices: [0, 1, 3] },
      datasetRefs: ["fixtures/rerank_mock_response.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "The reranker returns scores per candidate position, not a re-shuffled list. You need to project the scores BACK onto the original candidate dicts.",
          "response.results is a list of {index, relevance_score}; index is the position in your input docs list.",
          "Sort response.results by relevance_score DESC, then map index → candidates[index] to get the final dict list.",
          "results = await co.rerank(model='rerank-v3.5', query=question, documents=docs, top_n=top_n)",
          "return [{**candidates[r.index], 'rerank_score': r.relevance_score} for r in results.results]",
        ],
        successFeedback: "Reranker shipped — the top-N now reflect (query, doc) joint relevance instead of independent embedding similarity.",
        failureFeedback: "Common slips: returned `results.results` directly (dict shape wrong); sorted ASC instead of DESC; dropped the score so downstream telemetry can't log it.",
        portfolioRelevance: "Senior interviews ask 'how do cross-encoders differ from bi-encoders?'. Saying 'cross-encoders see the pair jointly, so the scoring head is conditioned on the query — strictly more accurate at the cost of O(N) inference per query' is a hire signal.",
        finalExplanation: "Cross-encoders (cohere rerank, bge-reranker, ColBERT) take BOTH the query and document into a transformer and produce a single relevance score. Bi-encoders (text-embedding-3-small) embed them independently. The trade: cross-encoders are O(N) per query (so you can't run them on a 1M-doc corpus) but dramatically more accurate. Two-stage retrieval is the standard production answer that gets both.",
        misconceptionToWatchFor: "Trying to replace pgvector with the reranker entirely. You can't — cross-encoders don't scale to corpus-wide search. They only work as the second stage.",
      }),
    },
    {
      stepNumber: 3,
      title: "Compose the pipeline with bounded concurrency",
      instructionMd:
        "Wire `retrieve_candidates` → `rerank` → return top-5. Add an `asyncio.Semaphore(8)` around the rerank call so a sudden burst of /ask traffic doesn't fan out 100 concurrent rerank requests and blow your Cohere rate limit (or your latency SLO). Also record per-stage latency: retrieve_ms, rerank_ms, total_ms. Use the @asynccontextmanager pattern for the per-stage timer. The validator asserts the pipeline returns 5 dicts each with keys {doc_id, chunk_index, content, distance, rerank_score} and that telemetry contains all three latency fields > 0.",
      learningObjective: "Compose async stages with bounded concurrency + per-stage telemetry.",
      requiredSkill: "asyncio.Semaphore + asynccontextmanager + dataclass for telemetry",
      starterCode: SRC(`# pipeline.py
import asyncio, time
from contextlib import asynccontextmanager
from dataclasses import dataclass, field

RERANK_SEM = asyncio.Semaphore(8)

@dataclass
class Telemetry:
    retrieve_ms: float = 0.0
    rerank_ms: float = 0.0
    total_ms: float = 0.0

@asynccontextmanager
async def timed(tele: Telemetry, key: str):
    t0 = time.perf_counter()
    try:
        yield
    finally:
        setattr(tele, key, (time.perf_counter() - t0) * 1000)

async def two_stage_retrieve(question: str, top_n: int = 5):
    tele = Telemetry()
    async with timed(tele, "total_ms"):
        # TODO: timed retrieve, then async with RERANK_SEM: timed rerank.
        raise NotImplementedError
    return ..., tele
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Pipeline returns (list[5], Telemetry) with all latency fields > 0.", {
        assertResultLength: 5,
        assertTelemetryKeys: ["retrieve_ms", "rerank_ms", "total_ms"],
      }),
      expectedOutputs: { resultLength: 5, telemetryNonZero: true },
      datasetRefs: ["fixtures/pipeline_smoke.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Two timed blocks inside the outer timer. The semaphore guards only the rerank call, since pgvector is already pool-bounded.",
          "async with timed(tele, 'retrieve_ms'): candidates = await retrieve_candidates(question, 50). Then async with RERANK_SEM: async with timed(tele, 'rerank_ms'): top = await rerank(question, candidates, top_n).",
          "Return (top, tele). The outer @asynccontextmanager wraps total_ms.",
          "async with timed(tele,'retrieve_ms'): cands = await retrieve_candidates(question,50)\nasync with RERANK_SEM:\n  async with timed(tele,'rerank_ms'): top = await rerank(question, cands, top_n)\nreturn top, tele",
          "(see reference above)",
        ],
        successFeedback: "Pipeline composed with bounded concurrency + telemetry — ready for production traffic.",
        failureFeedback: "Common slips: bounded the retriever instead of the reranker (wrong layer — pg pool already does this); used `time.time()` instead of `time.perf_counter()` (lower resolution); forgot to multiply by 1000 for ms.",
        portfolioRelevance: "Per-stage telemetry in the response body is a hallmark of production observability. Senior AI-engineer interviewers love seeing it because it means you've thought about the latency budget split.",
        finalExplanation: "Bounded concurrency is how mature async services stay alive under load. Without the semaphore, a 100-RPS burst becomes 100 concurrent Cohere requests — your rate limit explodes and EVERY request fails. With the semaphore, 92 requests queue patiently and complete in slightly higher P50 latency instead.",
        misconceptionToWatchFor: "Setting the semaphore at 1000 'just to be safe'. The point IS to be the bottleneck — pick the number based on your downstream rate limit, not your wish.",
      }),
    },
    {
      stepNumber: 4,
      title: "A/B eval: NDCG@10 + hit@k vs baseline",
      instructionMd:
        "Build the eval harness. For each ground-truth (question, gold_chunk_ids: list) pair, run BOTH retrieve_candidates(top-10) AND two_stage_retrieve(top-10). For each, compute hit@10 (any gold present) and NDCG@10 (rank-discounted relevance). Print the lift (rerank - baseline). The validator seeds a 5-question eval set + a corpus where reranker SHOULD win and asserts NDCG@10 lift > 0.05. NDCG@10 = DCG@10 / IDCG@10 where DCG@10 = sum_{i=1..10} rel_i / log2(i+1), rel_i = 1 if doc i is gold else 0. Use math.log2.",
      learningObjective: "Compute NDCG@k + hit@k and prove the reranker delivers a meaningful lift.",
      requiredSkill: "Information retrieval metrics (NDCG, hit@k) + offline eval harness",
      starterCode: SRC(`# eval.py
import math, statistics, asyncio
from .pipeline import two_stage_retrieve
from .wide_retrieve import retrieve_candidates

def hit_at_k(retrieved_ids: list, gold_ids: set) -> int:
    return 1 if any(rid in gold_ids for rid in retrieved_ids) else 0

def ndcg_at_k(retrieved_ids: list, gold_ids: set, k: int = 10) -> float:
    # TODO: DCG = sum_{i=1..k} rel_i / log2(i+1)
    # IDCG = DCG of the perfect ordering (all gold at front).
    # Return DCG/IDCG or 0 if IDCG == 0.
    raise NotImplementedError

async def eval_one(item):
    base = await retrieve_candidates(item["q"], k=10)
    top, _ = await two_stage_retrieve(item["q"], top_n=10)
    base_ids = [(c["doc_id"], c["chunk_index"]) for c in base]
    top_ids = [(c["doc_id"], c["chunk_index"]) for c in top]
    return {
        "baseline_hit": hit_at_k(base_ids, item["gold_ids"]),
        "rerank_hit": hit_at_k(top_ids, item["gold_ids"]),
        "baseline_ndcg": ndcg_at_k(base_ids, item["gold_ids"]),
        "rerank_ndcg": ndcg_at_k(top_ids, item["gold_ids"]),
    }
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "mean(rerank_ndcg - baseline_ndcg) >= 0.05 on the seeded eval set.", {
        assertNdcgLift: 0.05,
      }),
      expectedOutputs: { ndcgLiftMin: 0.05 },
      datasetRefs: ["fixtures/eval_5_questions.json", "fixtures/eval_corpus_with_gold.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "DCG rewards relevant docs more when they appear higher in the list. log2(i+1) is the rank discount.",
          "Iterate i from 1 to k. rel_i = 1 if retrieved_ids[i-1] in gold_ids else 0. Sum rel_i / log2(i+1).",
          "IDCG is the maximum possible DCG: assume all gold appear at the top of the list. If there are G gold docs, IDCG = sum_{i=1..min(G,k)} 1/log2(i+1).",
          "dcg = sum(1.0/math.log2(i+1) for i,rid in enumerate(retrieved_ids[:k],1) if rid in gold_ids)\ng = min(len(gold_ids), k)\nidcg = sum(1.0/math.log2(i+1) for i in range(1, g+1)) if g else 0\nreturn dcg/idcg if idcg else 0.0",
          "(see reference above)",
        ],
        successFeedback: "NDCG@10 lift confirmed — you've proven with numbers that the reranker delivers. This is the chart you put in the README.",
        failureFeedback: "Common slips: used log2(i) instead of log2(i+1) (DCG explodes for i=1); didn't normalize against IDCG (hard to compare across questions); 0/0 on a question with no gold.",
        portfolioRelevance: "Showing NDCG@10 + hit@10 lift numbers in the README instantly upgrades your RAG project from 'I built one' to 'I quantified its quality and proved an architectural improvement'.",
        finalExplanation: "NDCG is the standard IR metric for ranked retrieval because it (a) accounts for rank position and (b) normalizes against the ideal ordering so you can compare across queries with different gold sizes. Hit@k is simpler but loses the ordering signal — use both.",
        misconceptionToWatchFor: "Reporting only hit@k. A reranker that moves a gold doc from rank 9 to rank 2 has the same hit@10 as before — only NDCG captures the ranking improvement.",
      }),
    },
    {
      stepNumber: 5,
      title: "FastAPI surface with per-stage telemetry",
      instructionMd:
        "Expose POST /ask returning AskResponse {answer: str, citations: list[Citation], telemetry: {retrieve_ms, rerank_ms, total_ms}}. The handler awaits two_stage_retrieve, builds the LLM context from the top-5, calls gpt-4o-mini with the same citation-required system prompt as baseline RAG, then returns. The telemetry block in the response body is what powers the frontend's 'powered by rerank-v3.5, P50 latency 240ms' chip. Validator asserts 200 status + telemetry block present + citations list length 5.",
      learningObjective: "Expose the two-stage pipeline with Pydantic typing and per-stage observability surfaced to the client.",
      requiredSkill: "FastAPI + Pydantic nested response models + async composition",
      starterCode: SRC(`# app.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from openai import AsyncOpenAI
from .pipeline import two_stage_retrieve

app = FastAPI()
oai = AsyncOpenAI()

class Telemetry(BaseModel):
    retrieve_ms: float; rerank_ms: float; total_ms: float

class Citation(BaseModel):
    doc_id: str; chunk_index: int; rerank_score: float

class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)

class AskResponse(BaseModel):
    answer: str
    citations: list[Citation]
    telemetry: Telemetry

SYSTEM = "Answer ONLY from context. Cite [doc:chunk]. If insufficient, say I don't know."

@app.post("/ask", response_model=AskResponse)
async def ask(req: AskRequest) -> AskResponse:
    # TODO:
    # top, tele = await two_stage_retrieve(req.question, top_n=5)
    # if not top: raise HTTPException(404)
    # build context, call oai.chat.completions.create(model='gpt-4o-mini', ...)
    # return AskResponse(answer=..., citations=[Citation(**c) for c in top], telemetry=Telemetry(**asdict(tele)))
    raise NotImplementedError
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "POST /ask returns 200 with citations.length == 5 and telemetry has all three keys > 0.", {
        expectStatus: 200, expectCitationsLength: 5,
      }),
      expectedOutputs: { status: 200, citations: 5 },
      datasetRefs: ["fixtures/pipeline_smoke.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Mirror baseline RAG /ask structure — just plug in two_stage_retrieve in place of single-stage.",
          "Build context with the same `[doc:chunk] content` format separated by \\n---\\n.",
          "Convert the dataclass Telemetry to the Pydantic Telemetry via Telemetry(**asdict(tele)).",
          "from dataclasses import asdict\ntop, tele = await two_stage_retrieve(req.question, top_n=5)\nif not top: raise HTTPException(404, 'no relevant context')\nctx = '\\n---\\n'.join(f\"[{c['doc_id']}:{c['chunk_index']}] {c['content']}\" for c in top)\nchat = await oai.chat.completions.create(model='gpt-4o-mini', messages=[{'role':'system','content':SYSTEM},{'role':'user','content':f'Context:\\n{ctx}\\n\\nQ:{req.question}'}])\nreturn AskResponse(answer=chat.choices[0].message.content, citations=[Citation(doc_id=c['doc_id'], chunk_index=c['chunk_index'], rerank_score=c['rerank_score']) for c in top], telemetry=Telemetry(**asdict(tele)))",
          "(see reference above)",
        ],
        successFeedback: "Two-stage RAG live behind a typed FastAPI surface with per-stage telemetry. The deployed URL alone is a portfolio piece.",
        failureFeedback: "Common slips: forgot to convert dataclass to Pydantic (TypeError on response_model); used the wrong rerank_score key name; didn't 404 on empty retrieval.",
        portfolioRelevance: "Per-stage latency in the response body is the kind of thing senior AI-engineer interviewers immediately notice — it shows you're thinking about the operational story, not just the happy path.",
        finalExplanation: "Surfacing per-stage telemetry isn't observability theater — it's how product teams understand their latency budget. When a PM says 'why is /ask slow?' you don't need a Grafana board to answer; the response body itself tells the story.",
        misconceptionToWatchFor: "Putting telemetry in response headers instead of the body. Headers don't survive JSON parsing, frontends can't render them, and they're a pain to log.",
      }),
    },
  ],
};
