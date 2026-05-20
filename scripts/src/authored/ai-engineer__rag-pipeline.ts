/**
 * Phase 10 batch-2 / ai-engineer (advanced).
 * Candidate 390df952-8a61-4d05-81fa-3e45fa89b606 — Production RAG Pipeline
 * (hybrid retrieval + reranker + eval harness).
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const aiEngineerRagPipeline: AuthoredProject = {
  slug: "ai-engineer-rag-pipeline",
  candidateId: "390df952-8a61-4d05-81fa-3e45fa89b606",
  title: "Production RAG Pipeline — Hybrid Retrieval + Reranker + Eval Harness",
  shortDescription:
    "Build a production RAG pipeline that beats vanilla cosine-similarity by 15+ recall@10 points: token-aware chunking, dense + BM25 hybrid retrieval, a cross-encoder reranker, and a calibrated eval harness (recall@k, MRR, hit rate).",
  fullDescription:
    "Vanilla RAG demos look great until you measure them. You'll build the production stack: token-aware chunking (no semantic boundaries cut mid-thought), pgvector + BM25 hybrid retrieval with reciprocal-rank-fusion, a cross-encoder reranker on the top-50, and an eval harness with real queries + labeled gold passages. Every step has measurable lift — you'll see recall@10 climb from ~52% (vanilla) to ~78% (hybrid+rerank).",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "pgvector", "sentence-transformers", "rank_bm25", "cross-encoder", "FastAPI"],
  tags: ["rag", "retrieval", "embeddings", "pgvector", "bm25", "reranker", "hybrid-search", "evaluation"],
  learningObjectives: [
    "Implement token-aware chunking that preserves semantic boundaries.",
    "Index passages into pgvector + BM25 with a single ingestion pass.",
    "Combine dense + sparse results via reciprocal rank fusion (RRF).",
    "Apply a cross-encoder reranker to the top-50 and measure the lift.",
    "Build an eval harness with labeled gold passages + report recall@k, MRR.",
  ],
  estimatedMinutes: 210,
  xpReward: 700,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Founding AI engineer at a 30-person legal-tech startup. The PoC RAG over case-law has 'feels right' answers but lawyers report missed citations on 1/3 queries. You have one sprint to harden it before the enterprise pilot.",
    hiringRelevance2026:
      "AI-engineer interviews in 2026 specifically ask 'show me an eval harness for your RAG'. Hybrid + reranker + measured lift is the answer that separates seniors.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (chunking + hybrid + rerank + eval)",
      "Step 1 chunking", "Step 2 hybrid index", "Step 3 RRF fusion",
      "Step 4 cross-encoder rerank", "Step 5 eval harness", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with the ingestion pipeline, FastAPI /query endpoint, the eval harness with 200 labeled queries, and a benchmark report showing recall@10 lift across the 4 retrieval modes (dense / BM25 / hybrid / hybrid+rerank).",
    portfolioRelevance:
      "A RAG repo without an eval harness is a demo. With one, it's a credible production-grade artifact — the difference between intern and senior AI-engineer signals.",
    repoUrl: "https://github.com/<your-handle>/rag-pipeline",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Token-aware chunking with overlap",
      instructionMd:
        "Implement `chunk_document(text, max_tokens=512, overlap=64) -> list[Chunk]`. Use `tiktoken.encoding_for_model('gpt-4o')` to count tokens; chunk at sentence boundaries (regex `(?<=[.!?])\\s+`) but never exceed max_tokens; carry `overlap` tokens forward between chunks. Validator runs against a 4200-token fixture document and expects 10 chunks, each ≤512 tokens, each pair overlapping by ≥60 and ≤68 tokens.",
      learningObjective: "Preserve semantic continuity by chunking on sentence boundaries with token-budgeted overlap.",
      requiredSkill: "tiktoken + sliding-window chunking + boundary preservation",
      starterCode: SRC(`# chunking.py
import re
from dataclasses import dataclass
import tiktoken

ENC = tiktoken.encoding_for_model('gpt-4o')

@dataclass
class Chunk:
    text: str
    token_count: int
    start_sentence_idx: int

def chunk_document(text: str, max_tokens: int = 512, overlap: int = 64) -> list[Chunk]:
    sentences = re.split(r'(?<=[.!?])\\s+', text.strip())
    chunks: list[Chunk] = []
    cur: list[str] = []
    cur_tokens = 0
    start_idx = 0
    for i, sent in enumerate(sentences):
        sent_tokens = len(ENC.encode(sent))
        if cur_tokens + sent_tokens > max_tokens and cur:
            chunks.append(Chunk(' '.join(cur), cur_tokens, start_idx))
            # TODO: rewind by 'overlap' tokens worth of trailing sentences,
            #       set start_idx to where we resumed.
            cur, cur_tokens = [], 0
        cur.append(sent)
        cur_tokens += sent_tokens
    if cur:
        chunks.append(Chunk(' '.join(cur), cur_tokens, start_idx))
    return chunks
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Fixture doc (4200 tokens) chunks into exactly 10 chunks; each ≤512 tokens; adjacent overlap ∈ [60, 68] tokens.", {
        expected: { count: 10, maxTokens: 512, overlapMin: 60, overlapMax: 68 },
      }),
      expectedOutputs: { count: 10, max: 512, overlap_range: [60, 68] },
      datasetRefs: ["fixtures/doc_4200tok.txt", "fixtures/expected_chunks.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Splitting on `\\n\\n` (paragraphs) loses sentence-level granularity — use sentence boundaries for retrievable units.",
          "Always re-encode the actual chunk text to count tokens — don't sum estimated per-sentence counts (encoding-context dependent).",
          "Overlap matters most for queries whose answer straddles a chunk boundary — 10–15% of max_tokens is the sweet spot.",
          "Carry the LAST k sentences (not bytes) for overlap — that way the overlap is itself semantically meaningful.",
          "while overlap_carry and len(ENC.encode(' '.join(overlap_carry))) > overlap: overlap_carry.pop(0)  # trim from front; cur = list(overlap_carry); cur_tokens = len(ENC.encode(' '.join(cur)))",
        ],
        successFeedback: "Chunks are semantically clean + token-budgeted. Every downstream stage benefits from this foundation.",
        failureFeedback: "Common slips: split by char count (encoder mismatch → context-overflow at runtime); zero overlap (recall drops 5–10pts on boundary-straddling queries); split mid-sentence (retrieved chunks read like noise).",
        portfolioRelevance: "Chunking is the most under-loved RAG component. Doing it well is a senior signal — most demos botch it.",
        finalExplanation: "Retrieval quality is bounded by chunk quality. No retriever recovers from chunks that don't contain the answer atomically.",
        misconceptionToWatchFor: "Using LangChain's default RecursiveCharacterTextSplitter and shipping. It's a sane default, not a production choice.",
      }),
    },
    {
      stepNumber: 2,
      title: "Index into pgvector + BM25 in one pass",
      instructionMd:
        "Implement `ingest(chunks)` that embeds each chunk with `sentence-transformers/all-MiniLM-L6-v2` (384-d) and writes to `passages(id, text, embedding, bm25_tokens)`. Also build an in-memory `BM25Okapi` index over `bm25_tokens` (lowercase, punctuation-stripped). Validator ingests 100 chunks, asserts 100 rows in DB with 384-d non-null embeddings, and asserts BM25.get_scores('feature store') returns a non-zero array of length 100.",
      learningObjective: "Maintain a single source of chunks indexed in both dense + sparse stores.",
      requiredSkill: "sentence-transformers + pgvector + rank_bm25 + batched embedding",
      starterCode: SRC(`# ingest.py
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi
import re, psycopg

MODEL = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

def tokenize_bm25(text: str) -> list[str]:
    return re.findall(r'[a-z0-9]+', text.lower())

def ingest(chunks, conn) -> BM25Okapi:
    texts = [c.text for c in chunks]
    embeddings = MODEL.encode(texts, batch_size=64, show_progress_bar=False)  # (N, 384)
    bm25_tokens = [tokenize_bm25(t) for t in texts]
    with conn.cursor() as cur:
        for chunk, emb, toks in zip(chunks, embeddings, bm25_tokens):
            # TODO: INSERT INTO passages (text, embedding, bm25_tokens) VALUES (%s, %s::vector, %s)
            pass
    conn.commit()
    return BM25Okapi(bm25_tokens)
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "After ingest of 100 fixture chunks: SELECT COUNT(*) FROM passages == 100; embeddings non-null + dim 384; BM25.get_scores('feature store') returns array of length 100 with at least one >0.", {
        expected: { rowsInserted: 100, embeddingDim: 384, bm25Scored: 100, nonZeroBm25: true },
      }),
      expectedOutputs: { rowsInserted: 100, embeddingDim: 384, bm25Scored: 100 },
      datasetRefs: ["fixtures/sample_chunks.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "MiniLM-L6 is the right default: 22MB model, 384-d, near-MPNet quality at 5x speed.",
          "Always batch encode — single-string .encode() is 30x slower per-chunk than batch=64.",
          "BM25 doesn't get persisted (recompute on startup) — but freeze tokenization rules in code so the in-memory index matches what was indexed.",
          "Use `vector(384)` dtype in pgvector and cast inserts as `%s::vector` — string-typed inserts compile but break on query.",
          "cur.executemany('INSERT INTO passages (text, embedding, bm25_tokens) VALUES (%s, %s::vector, %s)', list(zip(texts, [emb.tolist() for emb in embeddings], bm25_tokens)))",
        ],
        successFeedback: "Dense + sparse indexes are now in lock-step. Hybrid retrieval becomes a 5-line function.",
        failureFeedback: "Common slips: encoded one-at-a-time (slow); used pgvector cosine_ops without HNSW index (10x slower at query time); tokenized differently between ingest + query (silent recall loss).",
        portfolioRelevance: "Co-indexing dense + sparse is the practical hybrid pattern. Most teams build them separately and complicate the consumer.",
        finalExplanation: "Embeddings + lexical tokens model different similarity. A passage about 'IPS' won't be retrieved by 'inverse propensity score' via embeddings alone — BM25 catches it.",
        misconceptionToWatchFor: "Trusting dense embeddings to handle exact-term queries. Acronyms, proper nouns, and product names all need lexical retrieval.",
      }),
    },
    {
      stepNumber: 3,
      title: "Reciprocal rank fusion (RRF) of dense + BM25",
      instructionMd:
        "Implement `hybrid_search(query, k=50) -> list[(passage_id, rrf_score)]` that runs both a pgvector top-50 (cosine) and a BM25 top-50, then fuses via RRF: `score(p) = Σ 1/(60 + rank_in_list(p))`. Validator runs the query 'how do feature stores prevent label leakage' against the 100-passage fixture and asserts the gold passage (id=42) ranks in top-5 after fusion (it ranks 18 in pure-dense and 24 in pure-BM25).",
      learningObjective: "Combine retrievers without normalizing scores by using rank-based fusion.",
      requiredSkill: "Reciprocal rank fusion (Cormack et al. 2009) + pgvector cosine query + BM25 top-k",
      starterCode: SRC(`# hybrid.py
from collections import defaultdict

RRF_K = 60  # standard constant; rarely worth tuning.

def hybrid_search(query: str, k: int, conn, bm25, model) -> list[tuple[int, float]]:
    q_emb = model.encode([query])[0].tolist()
    # Dense: cosine top-k from pgvector.
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM passages ORDER BY embedding <=> %s::vector LIMIT %s",
            (q_emb, k),
        )
        dense_ranked = [r[0] for r in cur.fetchall()]
    # Sparse: BM25 top-k.
    q_toks = [t.lower() for t in query.split() if t.isalnum() or t.replace('-', '').isalnum()]
    scores = bm25.get_scores(q_toks)
    bm25_top = sorted(range(len(scores)), key=lambda i: -scores[i])[:k]
    bm25_ranked = [i + 1 for i in bm25_top]  # passage ids start at 1 in fixture
    # TODO: RRF: for each passage in either list, sum 1/(RRF_K + rank).
    fused: dict[int, float] = defaultdict(float)
    return sorted(fused.items(), key=lambda kv: -kv[1])[:k]
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Query 'how do feature stores prevent label leakage' against the fixture: gold passage id=42 must be in the top-5 after RRF fusion (raw ranks: dense=18, BM25=24).", {
        expected: { goldPassageId: 42, goldRankInTop5: true, maxRankPosition: 5 },
      }),
      expectedOutputs: { goldPassageId: 42, goldRank: 3 },
      datasetRefs: ["fixtures/eval_queries.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "RRF doesn't need score normalization — it uses ranks only. That's the whole point.",
          "k=60 is from the original paper; sensitivity is low between 40–80. Tune only if recall flatlines.",
          "Always fetch the same top-k from both retrievers — uneven k biases the fusion toward whichever you fetched more from.",
          "If you need explainability, store the per-retriever rank too — users want to know WHY a result appeared.",
          "for rank, pid in enumerate(dense_ranked, start=1): fused[pid] += 1.0 / (RRF_K + rank)\\nfor rank, pid in enumerate(bm25_ranked, start=1): fused[pid] += 1.0 / (RRF_K + rank)",
        ],
        successFeedback: "Hybrid retrieval now beats either retriever alone on every metric. The boring algorithm wins.",
        failureFeedback: "Common slips: weighted dense vs BM25 scores arbitrarily (different scales, breaks immediately); used `+ rank` instead of `+ 1/(k+rank)` (no inverse → wrong fusion); fused over different result-set sizes (bias).",
        portfolioRelevance: "RRF is the boring-correct answer to 'how do you combine retrievers?'. Reciting it cold is a senior signal.",
        finalExplanation: "Rank-based fusion is robust precisely because it discards score magnitudes. The two retrievers don't need to agree on what a 'good' score is.",
        misconceptionToWatchFor: "Inventing a custom weighted-sum of dense and BM25 scores. It can work, but RRF is robust + free.",
      }),
    },
    {
      stepNumber: 4,
      title: "Cross-encoder rerank on top-50",
      instructionMd:
        "Implement `rerank(query, candidates) -> list[(passage_id, ce_score)]` using `cross-encoder/ms-marco-MiniLM-L-6-v2`. Score each (query, passage) pair, sort descending, return top-10. Validator runs the same query against the fixture's top-50 hybrid candidates and asserts the gold passage (id=42) rises to top-1 after reranking.",
      learningObjective: "Use a cross-encoder to refine the top-50 with per-pair attention — expensive but worth it post-fusion.",
      requiredSkill: "Sentence-transformers CrossEncoder + batch scoring + reranking budget tradeoffs",
      starterCode: SRC(`# rerank.py
from sentence_transformers import CrossEncoder

CE = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')

def rerank(query: str, candidates: list[tuple[int, str]], top_k: int = 10) -> list[tuple[int, float]]:
    # candidates: list of (passage_id, passage_text), typically 50-100 from hybrid_search.
    pairs = [(query, text) for _, text in candidates]
    scores = CE.predict(pairs, batch_size=32, show_progress_bar=False)  # higher = more relevant
    # TODO: zip back to passage_ids, sort by score desc, return top_k.
    return []
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Reranking the top-50 hybrid candidates: gold passage id=42 ranks #1 after CE rerank (was rank 3 post-RRF).", {
        expected: { goldPassageId: 42, goldRankAfterRerank: 1 },
      }),
      expectedOutputs: { goldPassageId: 42, rankAfterRerank: 1 },
      datasetRefs: ["fixtures/eval_queries.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Cross-encoders process (query, passage) jointly — way better quality than bi-encoders but O(N) per query (no precomputed embeddings).",
          "Cap candidates at 50–100 — reranker latency grows linearly with candidate count.",
          "ms-marco-MiniLM-L-6-v2 is the right starter — ~12MB, runs CPU-fast, good zero-shot quality.",
          "Always rerank AFTER fusion, not before — fusion is cheap, rerank is expensive.",
          "scored = sorted(zip([cid for cid, _ in candidates], scores), key=lambda x: -x[1])\\nreturn scored[:top_k]",
        ],
        successFeedback: "Reranker lift is real + measurable. The 'boring stack' (hybrid + rerank) beats clever single-model tricks.",
        failureFeedback: "Common slips: reranked the full 10k corpus (latency explodes); used the bi-encoder for rerank (defeats the purpose); didn't batch (10x slower).",
        portfolioRelevance: "Knowing when to add a reranker (and when not to) is the 2026 AI-engineer signal. Latency-aware retrieval = senior.",
        finalExplanation: "Hybrid retrieval gets you to good candidates; the reranker gets you to the right answer. Both are required.",
        misconceptionToWatchFor: "Replacing the retriever with the reranker. Cross-encoders can't index the whole corpus — they refine.",
      }),
    },
    {
      stepNumber: 5,
      title: "Eval harness — recall@k, MRR, hit-rate",
      instructionMd:
        "Implement `evaluate(queries, retriever_fn) -> EvalReport` over a 200-query labeled set. Compute recall@10, MRR (reciprocal rank of first gold passage), and hit-rate (% queries with ≥1 gold in top-10). Run it for each of the 4 retrieval modes (dense / BM25 / hybrid / hybrid+rerank). Validator asserts hybrid+rerank achieves recall@10 ≥0.78 and MRR ≥0.62; raw dense ≤0.55.",
      learningObjective: "Build a calibrated eval harness that turns 'feels better' into a measured lift.",
      requiredSkill: "Information-retrieval metrics (recall@k, MRR) + harness design + ablation comparison",
      starterCode: SRC(`# eval.py
from dataclasses import dataclass

@dataclass
class EvalReport:
    recall_at_10: float
    mrr: float
    hit_rate: float
    n_queries: int

def evaluate(queries: list[dict], retriever_fn) -> EvalReport:
    # queries: [{ 'query': str, 'gold_passage_ids': set[int] }, ...]
    recalls, rrs, hits = [], [], 0
    for q in queries:
        results = retriever_fn(q['query'])  # list[(passage_id, score)] top-10
        retrieved_ids = [r[0] for r in results[:10]]
        gold = set(q['gold_passage_ids'])
        # TODO: recall@10 = |retrieved ∩ gold| / |gold|
        # TODO: MRR contribution = 1/(rank of first gold in retrieved), 0 if no gold retrieved
        # TODO: hit = 1 if any gold in retrieved
        recalls.append(0.0); rrs.append(0.0)
    return EvalReport(
        recall_at_10=sum(recalls)/len(recalls),
        mrr=sum(rrs)/len(rrs),
        hit_rate=hits/len(queries),
        n_queries=len(queries),
    )
`),
      validationType: "numeric_tolerance",
      stepType: "code_python",
      validation: validationConfig("numeric_tolerance", "200-query labeled eval: hybrid+rerank recall@10 ≥0.78, MRR ≥0.62; dense-only recall@10 ≤0.55. Tolerance ±0.02.", {
        expected: { hybridRerankRecall: 0.78, hybridRerankMRR: 0.62, denseOnlyRecall: 0.55 },
        tolerance: 0.02,
      }),
      expectedOutputs: { recall: 0.78, mrr: 0.62, hitRate: 0.94 },
      datasetRefs: ["fixtures/eval_queries.json", "fixtures/gold_passages.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Always run all 4 ablations (dense / BM25 / hybrid / hybrid+rerank) — single-number reports hide where the lift came from.",
          "MRR penalizes 'right answer at rank 8' more than recall@10 does — both matter for chat UX.",
          "Gold-set size matters: 200 queries gives ±2pt confidence on recall, 50 gives ±5pt — invest in the labeled set.",
          "Track latency per mode too — hybrid+rerank may add 200ms p95; the answer to 'worth it?' depends on UX budget.",
          "recalls.append(len(set(retrieved_ids) & gold) / max(len(gold), 1))\\nfor rank, pid in enumerate(retrieved_ids, start=1):\\n    if pid in gold: rrs.append(1/rank); hits += 1; break\\nelse: rrs.append(0.0)",
        ],
        successFeedback: "You now have a measured baseline. Every future change (model swap, chunking tweak) can be A/B'd objectively.",
        failureFeedback: "Common slips: averaged recall as bool (binary, hides partial gold); divided MRR by hits not queries (inflates); evaluated on training data (overfit).",
        portfolioRelevance: "Hiring managers explicitly grep RAG repos for /eval. A working harness with 4 ablations is the closer.",
        finalExplanation: "Without eval, RAG is vibes. With it, every change has a measurable verdict. Build the harness FIRST.",
        misconceptionToWatchFor: "Trusting LLM-as-judge for retrieval eval. Retrieval has unambiguous gold; use it.",
      }),
    },
  ],
};
