/**
 * Phase 9 — batch-1 upgrade. data-engineering / pgvector semantic search.
 * Synthetic candidate 1559c008-acd5-499b-9fc3-b93b2b9cc72d (source=phase9_upgrade).
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const dataEngineeringVectorDatabaseSearch: AuthoredProject = {
  slug: "data-engineering-vector-database-search",
  candidateId: "1559c008-acd5-499b-9fc3-b93b2b9cc72d",
  title: "Vector Search at Production Scale with pgvector",
  shortDescription:
    "Build production semantic search on Postgres + pgvector: the cosine math from scratch, the HNSW-vs-IVFFlat trade-off, a hybrid BM25+vector ranker that beats either signal alone, and the index-build math.",
  fullDescription:
    "Every modern search box and RAG pipeline rides on the same primitives: embed text, store vectors in a DB that does approximate-nearest-neighbour lookups, and combine that score with keyword relevance. You'll implement cosine similarity correctly (and learn when L2 is faster), reason about HNSW vs IVFFlat trade-offs, design a hybrid ranker, and build a recall@k evaluator so you can MEASURE quality changes instead of guessing.",
  language: "python",
  difficulty: "advanced",
  techStack: ["pgvector", "PostgreSQL", "Python", "numpy", "OpenAI embeddings"],
  tags: ["pgvector", "embeddings", "ann", "semantic-search", "hybrid-ranking", "rag"],
  learningObjectives: [
    "Implement cosine similarity correctly and know when normalised-L2 is equivalent (and faster).",
    "Choose between HNSW and IVFFlat indexes given vector count, write rate, and recall target.",
    "Compose a hybrid ranker that combines keyword (BM25) and vector signals with explicit weighting.",
    "Measure recall@k against a ground-truth set so quality changes are observed, not guessed.",
    "Quantify the build-time / query-time / memory trade-off matrix for each index.",
  ],
  estimatedMinutes: 540,
  xpReward: 700,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "An e-commerce search team currently does keyword-only over 5M product titles. Their conversion drops 12% on misspellings and synonyms. You're asked to add semantic search WITHOUT a separate vector DB — keep ops on the existing Postgres.",
    hiringRelevance2026:
      "pgvector + hybrid ranking is the default 2026 RAG/search stack. Senior interviewers probe HNSW-vs-IVFFlat math and BM25/vector fusion specifically. This project drills both.",
    readmeOutline: [
      "Overview & Scenario", "Math: cosine vs L2",
      "Step 1 similarity from scratch", "Step 2 index recommendation",
      "Step 3 hybrid ranker", "Step 4 recall@k evaluator", "Step 5 query budget tuning",
      "Validation", "Production checklist", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo: PostgreSQL+pgvector docker-compose, a 50k-vector demo dataset, the hybrid ranker + recall@k evaluator, and a Markdown table of HNSW/IVFFlat build-time vs recall vs memory measured on your laptop.",
    portfolioRelevance:
      "Anyone can run `CREATE INDEX ... USING hnsw`. Showing the trade-off table backed by measurements you took is the senior-DE / search-engineering signal.",
    repoUrl: "https://github.com/<your-handle>/pgvector-hybrid-search",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Cosine similarity from scratch",
      instructionMd:
        "Implement `cosine(a, b)` for two equal-length float vectors WITHOUT numpy (you'll know what pgvector is computing under the hood). Then `cosine_norm(a, b)` that assumes both are pre-normalised (skip the divide). Validator drives both with known vector pairs.",
      learningObjective: "Master the math before reaching for a library — pre-normalisation is the production speed win.",
      requiredSkill: "Vector arithmetic + invariants of normalised embeddings",
      starterCode: SRC(`import math

def cosine(a, b):
    if len(a) != len(b):
        raise ValueError('shape mismatch')
    # TODO: dot = sum(x*y for x,y in zip(a,b))
    # TODO: na = math.sqrt(sum(x*x for x in a)); nb = ...
    # TODO: return dot / (na * nb) if na and nb else 0.0
    pass

def cosine_norm(a, b):
    # both already unit length; skip the divide
    # TODO: return sum(x*y for x,y in zip(a,b))
    pass
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Call cosine([1,0,0],[0,1,0]) and confirm the result is 0.0 (±1e-6). Call cosine([1,1,0],[1,0,0]) and confirm the result is ≈0.7071067811865475 (±1e-6). Call cosine([1,0,0],[1,0,0]) and confirm the result is 1.0 (±1e-6). Confirm cosine_norm on the same pre-normalised pairs matches cosine within 1e-6. Verify both functions return 0.0 for a zero-vector input without raising.",
      }),
      expectedOutputs: { passedCases: 3, tolerance: 1e-6 },
      datasetRefs: ["fixtures/cosine_pairs.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Cosine = dot / (||a|| * ||b||). For unit-length vectors the denominator is 1 — skip it.",
          "Zero-vector edge case: return 0.0 (don't divide by zero).",
          "Embeddings from OpenAI ada/3-large are pre-normalised — so production search should use cosine_norm.",
          "For pgvector: <-> is L2 distance, <#> is negative inner product, <=> is cosine distance. Match the operator to the data state.",
          "Reference: na=math.sqrt(sum(x*x for x in a)); nb=math.sqrt(sum(x*x for x in b)); return sum(x*y for x,y in zip(a,b))/(na*nb) if na and nb else 0.0.",
        ],
        successFeedback: "You can now read pgvector query plans and know which operator gives the cheapest answer for your data.",
        failureFeedback: "Common slips: divided unit-length vectors anyway (2x slower with no benefit); didn't handle the zero-vector case (production crash); compared L2 distances and called them cosine.",
        portfolioRelevance: "Knowing the math distinguishes you from candidates who 'just call .similarity()'. Interviewers absolutely ask 'what is cosine doing under the hood?'.",
        finalExplanation: "Cosine similarity is just dot product on unit-length vectors. Two operators, one math identity — saves 30% of query CPU at scale.",
        misconceptionToWatchFor: "Believing cosine and L2 give different rankings. On unit-length vectors they give IDENTICAL ranking — only the absolute scores differ.",
      }),
    },
    {
      stepNumber: 2,
      title: "HNSW vs IVFFlat — pick the right index",
      instructionMd:
        "pgvector ships two ANN indexes with opposite trade-offs. Implement `recommend_index(n_vectors, writes_per_min, target_recall)` returning `'HNSW'`, `'IVFFlat'`, or `'flat_scan'`. Rules: < 50k vectors → flat (no index needed); ≥ 50k AND writes ≤ 10/min AND target_recall ≥ 0.95 → HNSW; otherwise IVFFlat. Validator drives 6 representative scenarios.",
      learningObjective: "Translate workload characteristics into the right ANN index choice with explicit trade-off math.",
      requiredSkill: "Index-trade-off matrices + workload sizing",
      starterCode: SRC(`def recommend_index(n_vectors, writes_per_min, target_recall):
    # TODO: if n_vectors < 50_000: return 'flat_scan'
    # TODO: if writes_per_min <= 10 and target_recall >= 0.95: return 'HNSW'
    # TODO: return 'IVFFlat'
    pass
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Call recommend_index for each scenario and confirm: (1000,0,0.99)→'flat_scan'; (100000,0,0.99)→'HNSW'; (100000,100,0.99)→'IVFFlat'; (10000000,0,0.99)→'HNSW'; (10000000,5000,0.90)→'IVFFlat'; (49000,0,0.99)→'flat_scan'. All 6 must match.",
      }),
      expectedOutputs: { decisions: 6, allCorrect: true },
      datasetRefs: ["fixtures/index_scenarios.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Under 50k vectors a flat scan with SIMD is faster than any ANN index, full stop.",
          "HNSW recall is consistently high (~0.99) but build cost is 10-100x IVFFlat and updates rewrite the graph.",
          "IVFFlat is the choice when writes dominate: cluster centroids update cheaply, and recall is tunable via `probes`.",
          "Memory: HNSW ~2x your raw vector size; IVFFlat ~1.05x. Matters at the 10M+ row scale.",
          "Reference: return 'flat_scan' if n_vectors < 50_000 else ('HNSW' if writes_per_min <= 10 and target_recall >= 0.95 else 'IVFFlat').",
        ],
        successFeedback: "Your recommendation function is the artifact a junior team can use to avoid the wrong-index pitfall.",
        failureFeedback: "Common slips: defaulted to HNSW (death on write-heavy); ignored the < 50k threshold (wasted index memory); had no clear write-rate cutoff (decision-by-vibe).",
        portfolioRelevance: "Recruiters who run vector search at scale ask 'how did you choose your index?'. A function-with-rules-baked-in is the strongest possible answer.",
        finalExplanation: "There's no universally-best ANN index; there's the right index for your (size, write rate, recall) point. Pick deliberately.",
        misconceptionToWatchFor: "Believing 'newer = better' and defaulting to HNSW. HNSW is wonderful for static corpora and catastrophic under high write volume.",
      }),
    },
    {
      stepNumber: 3,
      title: "Hybrid ranker: BM25 + vector",
      instructionMd:
        "Implement `hybrid_rank(candidates, alpha=0.5)` where each candidate is `{id, bm25, vec_sim}` (both signals pre-normalised to [0,1]). Return ids sorted by `alpha*vec_sim + (1-alpha)*bm25` descending. Validator drives with controlled candidates across 3 alpha values.",
      learningObjective: "Compose lexical and semantic signals with explicit weighting — the production search standard.",
      requiredSkill: "Score fusion + min-max normalisation + ranked output",
      starterCode: SRC(`def hybrid_rank(candidates, alpha=0.5):
    if not 0.0 <= alpha <= 1.0:
        raise ValueError('alpha must be in [0,1]')
    # TODO: scored = [(c['id'], alpha*c['vec_sim'] + (1-alpha)*c['bm25']) for c in candidates]
    # TODO: return [id for id, _ in sorted(scored, key=lambda t: t[1], reverse=True)]
    pass
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Using candidates [{id:'a',bm25:0.9,vec_sim:0.1},{id:'b',bm25:0.5,vec_sim:0.5},{id:'c',bm25:0.1,vec_sim:0.9}], call hybrid_rank at alpha=0 and confirm order ['a','b','c']; at alpha=0.5 confirm ['b','a','c']; at alpha=1.0 confirm ['c','b','a']. Verify alpha outside [0,1] raises ValueError.",
      }),
      expectedOutputs: { alphaSweepRankings: 3, allCorrect: true },
      datasetRefs: ["fixtures/hybrid_candidates.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Both inputs must live in the same range before fusion. Min-max normalise per-query if BM25 outputs aren't already bounded.",
          "alpha=0.5 is a reasonable default; tune it against your golden set in step 4.",
          "Use Python's built-in sort with a key — stable, fast, no surprises.",
          "Some teams use Reciprocal Rank Fusion (RRF) instead of weighted sum — simpler, no normalisation needed. Mention it in your README.",
          "Reference: scored = sorted(candidates, key=lambda c: alpha*c['vec_sim'] + (1-alpha)*c['bm25'], reverse=True); return [c['id'] for c in scored].",
        ],
        successFeedback: "You can now A/B alphas against your golden set and ship the best-performing fusion.",
        failureFeedback: "Common slips: forgot to validate alpha is in [0,1] (silent NaN propagation); mixed raw BM25 (unbounded) with cosine [0,1] (vector signal always wins); sorted ascending (worst-first).",
        portfolioRelevance: "Hybrid ranking is the production search default. A simple, tunable fusion you can demo IS the senior search-engineering signal.",
        finalExplanation: "Lexical search excels at exact matches; vector search at synonyms and concepts. Fusion gets you both for the cost of one extra dot product per candidate.",
        misconceptionToWatchFor: "Believing vector-only beats hybrid. It loses on exact-match SKU lookups, model numbers, names. Always hybrid for general-purpose search.",
      }),
    },
    {
      stepNumber: 4,
      title: "Recall@k evaluator",
      instructionMd:
        "Implement `recall_at_k(predicted_ids, ground_truth_ids, k)` returning the fraction of `ground_truth_ids` that appear in `predicted_ids[:k]`. Validator drives with 3 (predicted, truth, k) tuples.",
      learningObjective: "Measure search quality changes against a fixed golden set — the only way to compare variants without bias.",
      requiredSkill: "Set-based recall computation + golden-set discipline",
      starterCode: SRC(`def recall_at_k(predicted_ids, ground_truth_ids, k):
    if k <= 0:
        raise ValueError('k must be > 0')
    if not ground_truth_ids:
        return 1.0  # vacuously perfect
    # TODO: top_k = set(predicted_ids[:k]); hits = len(top_k & set(ground_truth_ids))
    # TODO: return hits / len(ground_truth_ids)
    pass
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Call recall_at_k(['a','b','c','d'],['a','b'],4) and confirm 1.0. Call recall_at_k(['a','x','y','z'],['a','b'],4) and confirm 0.5. Call recall_at_k(['x','y','z','w'],['a','b'],4) and confirm 0.0. Confirm recall_at_k with empty ground_truth returns 1.0. Confirm k≤0 raises ValueError.",
      }),
      expectedOutputs: { evaluatedCases: 3, allCorrect: true },
      datasetRefs: ["fixtures/recall_cases.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Recall@k = |top_k ∩ truth| / |truth|. Set intersection is the cheapest implementation.",
          "Empty truth set: return 1.0 (vacuous truth) so it doesn't crash your sweep.",
          "Use this to evaluate alpha sweeps, index changes, model swaps — anything that affects ranking.",
          "A golden set of 100 queries × 10 relevant docs each is enough to detect 5% recall regressions reliably.",
          "Reference: return len(set(predicted_ids[:k]) & set(ground_truth_ids)) / len(ground_truth_ids) if ground_truth_ids else 1.0.",
        ],
        successFeedback: "You ship the metric most teams skip. Every change to ranking is now measurable, not guessed.",
        failureFeedback: "Common slips: divided by k instead of |truth| (you computed precision@k); didn't slice top-k (used all predicted); crashed on empty truth.",
        portfolioRelevance: "Measurable quality changes are the production search standard. A recall evaluator + alpha sweep is the deliverable that demonstrates senior judgment.",
        finalExplanation: "Search quality without measurement is opinion. Recall@k is the cheapest objective metric that catches real regressions.",
        misconceptionToWatchFor: "Conflating recall@k (right fraction returned) with precision@k (returned fraction that's right). They diverge fast at small k.",
      }),
    },
    {
      stepNumber: 5,
      title: "Index query-time tuning: probes vs ef_search",
      instructionMd:
        "IVFFlat exposes `probes` and HNSW exposes `ef_search` — both trade query time for recall. Implement `recommend_query_param(index_kind, target_recall)` returning the suggested value: IVFFlat → `max(1, min(50, int(target_recall * 50)))`; HNSW → `max(40, min(400, int(target_recall * 400)))`. Validator drives both indexes at 3 recall targets.",
      learningObjective: "Translate a recall target into a concrete query-time parameter for each index.",
      requiredSkill: "Index-internal parameter literacy + bounded scaling",
      starterCode: SRC(`def recommend_query_param(index_kind, target_recall):
    if not 0.0 < target_recall <= 1.0:
        raise ValueError('target_recall must be in (0,1]')
    if index_kind == 'IVFFlat':
        # TODO: return max(1, min(50, int(target_recall * 50)))
        pass
    if index_kind == 'HNSW':
        # TODO: return max(40, min(400, int(target_recall * 400)))
        pass
    raise ValueError(f'unknown index: {index_kind}')
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Call recommend_query_param for each case and confirm: IVFFlat at recall 0.5→25, 0.9→45, 0.99→49; HNSW at recall 0.5→200, 0.9→360, 0.99→396. Confirm an unknown index_kind raises ValueError. Confirm target_recall outside (0,1] raises ValueError.",
      }),
      expectedOutputs: { ivfflatRecommendations: 3, hnswRecommendations: 3, allCorrect: true },
      datasetRefs: ["fixtures/index_param_cases.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "IVFFlat probes: 1 → fastest, lowest recall. Scale linearly toward your target.",
          "HNSW ef_search: 40 is the floor (below it recall collapses); 400 is the practical ceiling on a modern CPU.",
          "Always clamp — silent integer overflow at the extremes ruins the math.",
          "After deploying, REMEASURE recall against your golden set; the formulas here are starting points, not guarantees.",
          "Reference: probes = max(1, min(50, int(target_recall * 50))); ef = max(40, min(400, int(target_recall * 400))).",
        ],
        successFeedback: "You can now hand a junior engineer the recall target and they'll set the right query param without trial and error.",
        failureFeedback: "Common slips: didn't clamp (probes=200 silently degrades to crash); used the same formula for both indexes (HNSW needs much higher numbers); accepted target_recall outside (0,1].",
        portfolioRelevance: "Param-tuning functions are unglamorous but they're what production teams actually ship. Junior code calls SET probes=10 hard-coded; senior code derives it.",
        finalExplanation: "Every ANN index has a quality knob. Knowing which knob and where to set it is the operational maturity.",
        misconceptionToWatchFor: "Believing the index defaults are optimal. They're tuned for the demo, not your workload.",
      }),
    },
  ],
};
