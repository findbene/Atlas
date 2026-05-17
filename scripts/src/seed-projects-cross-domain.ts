// Cross-domain curriculum extension (T6). Adds fully-fleshed projects to
// the three previously coming-soon domains: ai-mlops, ai-engineering,
// data-science. Each project has 5 steps with starter code and validation
// hints, mirroring the shape used by seed-projects-extra.ts.

export type CrossDomainStep = {
  stepNumber: number;
  title: string;
  instruction: string;
  starterCode?: string;
  validationHint?: string;
  xpReward: number;
};

export type CrossDomainProject = {
  domainSlug: "ai-mlops" | "ai-engineering" | "data-science";
  slug: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedMinutes: number;
  position: number;
  isPremium: boolean;
  language: "python" | "sql";
  xpReward: number;
  tags: string[];
  learningObjectives: string[];
  techStack: string[];
  steps: CrossDomainStep[];
};

export const crossDomainProjects: CrossDomainProject[] = [
  // ============================================================
  // AI / MLOps — 2 projects
  // ============================================================
  {
    domainSlug: "ai-mlops",
    slug: "mlops-feature-store",
    title: "Build a Minimal Feature Store",
    shortDescription:
      "Engineer a feature store that serves point-in-time correct training features and low-latency online lookups.",
    fullDescription:
      "Feature stores are the missing data layer of production ML. You'll build a tiny but correct one — offline parquet for training, online key-value lookups for inference — and learn why point-in-time joins are the single thing that separates a real feature store from a glorified ETL.",
    difficulty: "intermediate",
    estimatedMinutes: 360,
    position: 1,
    isPremium: false,
    language: "python",
    xpReward: 500,
    tags: ["mlops", "feature-store", "feast", "point-in-time"],
    learningObjectives: [
      "Reason about training/serving skew",
      "Implement a point-in-time join",
      "Serve features with sub-10ms latency",
      "Version features with a schema registry",
    ],
    techStack: ["Python", "Pandas", "Redis", "Parquet"],
    steps: [
      {
        stepNumber: 1,
        title: "Why Feature Stores Exist",
        instruction:
          "## Training/serving skew\n\nThe #1 cause of broken production models is **training/serving skew** — features computed one way offline (in pandas) and a different way online (in a service). A feature store fixes this by being the *single* source of truth.\n\n## Task\n\nWrite `materialize_feature(events, user_id, asof_ts)` that returns the **count of events** for that user **strictly before** `asof_ts`. This is the canonical point-in-time correct aggregation.",
        starterCode:
          "from datetime import datetime\n\ndef materialize_feature(events: list[dict], user_id: str, asof_ts: datetime) -> int:\n    \"\"\"Count of events for user strictly before asof_ts.\"\"\"\n    # TODO: filter events by user_id AND event_ts < asof_ts; return count\n    pass\n\nevents = [\n  {'user_id': 'u1', 'event_ts': datetime(2024,1,1)},\n  {'user_id': 'u1', 'event_ts': datetime(2024,1,5)},\n  {'user_id': 'u1', 'event_ts': datetime(2024,1,10)},\n]\nassert materialize_feature(events, 'u1', datetime(2024,1,6)) == 2\nassert materialize_feature(events, 'u1', datetime(2024,1,5)) == 1  # STRICTLY less\nprint('ok')\n",
        validationHint:
          "Strictly less means `event_ts < asof_ts`, not `<=`. Including the asof row leaks future information into training.",
        xpReward: 80,
      },
      {
        stepNumber: 2,
        title: "Offline Materialization to Parquet",
        instruction:
          "## Materialize the training set\n\nGiven a list of (user_id, label_ts) training pairs, compute the feature for each row and write to a pandas DataFrame.\n\n## Task\n\nImplement `build_training_set(events, training_pairs)` returning a DataFrame with columns `user_id`, `label_ts`, `event_count_pit`.",
        starterCode:
          "import pandas as pd\nfrom datetime import datetime\n\ndef build_training_set(events: list[dict], training_pairs: list[tuple]) -> pd.DataFrame:\n    rows = []\n    for user_id, label_ts in training_pairs:\n        # TODO: count events for user strictly before label_ts\n        count = 0\n        rows.append({'user_id': user_id, 'label_ts': label_ts, 'event_count_pit': count})\n    return pd.DataFrame(rows)\n\nevents = [\n  {'user_id': 'u1', 'event_ts': datetime(2024,1,1)},\n  {'user_id': 'u1', 'event_ts': datetime(2024,1,5)},\n]\ndf = build_training_set(events, [('u1', datetime(2024,1,6))])\nassert df.iloc[0]['event_count_pit'] == 2\nprint('ok')\n",
        validationHint: "Reuse your step 1 function — that's the point of a feature store.",
        xpReward: 90,
      },
      {
        stepNumber: 3,
        title: "Online Store: Key-Value Lookups",
        instruction:
          "## Online serving\n\nFor inference you can't run a join — you need O(1) lookups. The standard pattern is to materialize the *latest* feature value into Redis (here, a dict).\n\n## Task\n\nImplement `materialize_online(events) -> dict` that returns `{user_id: latest_event_count}` — the value you'd serve at inference time.",
        starterCode:
          "from datetime import datetime\n\ndef materialize_online(events: list[dict]) -> dict:\n    # TODO: aggregate count of events per user_id\n    pass\n\nevents = [\n  {'user_id': 'u1', 'event_ts': datetime(2024,1,1)},\n  {'user_id': 'u1', 'event_ts': datetime(2024,1,5)},\n  {'user_id': 'u2', 'event_ts': datetime(2024,1,5)},\n]\nout = materialize_online(events)\nassert out['u1'] == 2 and out['u2'] == 1\nprint('ok')\n",
        validationHint: "A simple dict comprehension over the events list is enough here.",
        xpReward: 90,
      },
      {
        stepNumber: 4,
        title: "Detecting Training/Serving Skew",
        instruction:
          "## Catch the bug before it ships\n\nA classic skew bug: training uses `< asof` but serving uses `<= now`. Write a check that fails loudly.\n\n## Task\n\n`detect_skew(offline_value, online_value, tolerance=0)` returns `True` if values differ by more than `tolerance`. Use this in your CI.",
        starterCode:
          "def detect_skew(offline_value: float, online_value: float, tolerance: float = 0.0) -> bool:\n    # TODO: return True if |offline - online| > tolerance\n    pass\n\nassert detect_skew(5, 5) is False\nassert detect_skew(5, 7, tolerance=1) is True\nassert detect_skew(5, 6, tolerance=1) is False\nprint('ok')\n",
        validationHint: "abs(offline - online) > tolerance — strict greater-than so tolerance=0 with equal values returns False.",
        xpReward: 80,
      },
      {
        stepNumber: 5,
        title: "Versioning & Schema Registry",
        instruction:
          "## Why versioning\n\nIf a feature definition changes (`event_count` → `event_count_7d`), models trained on v1 will silently break when served v2 data. The fix: every feature has a version, and models pin which version they were trained on.\n\n## Task\n\nImplement `register_feature(registry, name, version, fn)` and `lookup_feature(registry, name, version)`. Registry is a `dict[(name, version)] = fn`. Looking up a missing version raises `KeyError`.",
        starterCode:
          "def register_feature(registry: dict, name: str, version: int, fn) -> None:\n    # TODO\n    pass\n\ndef lookup_feature(registry: dict, name: str, version: int):\n    # TODO: raise KeyError if missing\n    pass\n\nreg = {}\nregister_feature(reg, 'event_count', 1, lambda x: x)\nassert lookup_feature(reg, 'event_count', 1)(42) == 42\ntry:\n    lookup_feature(reg, 'event_count', 2)\n    raise AssertionError('should have raised')\nexcept KeyError:\n    pass\nprint('ok')\n",
        validationHint: "Use a tuple key (name, version). Don't catch KeyError — let it propagate.",
        xpReward: 100,
      },
    ],
  },
  {
    domainSlug: "ai-mlops",
    slug: "mlops-model-serving-canary",
    title: "Canary Deploy an ML Model",
    shortDescription:
      "Roll out a new model version safely with traffic splitting, automated rollback, and live A/B metrics.",
    fullDescription:
      "Shipping a new model is one of the highest-risk operations in any ML system. You'll build the serving primitives that make it safe: a router that splits traffic, a metrics collector that watches latency and error rate, and an auto-rollback that fires the second the canary degrades.",
    difficulty: "advanced",
    estimatedMinutes: 420,
    position: 2,
    isPremium: true,
    language: "python",
    xpReward: 600,
    tags: ["mlops", "serving", "canary", "rollback"],
    learningObjectives: [
      "Implement deterministic traffic splitting",
      "Compare model variants with statistical significance",
      "Detect regression with rolling-window metrics",
      "Automate rollback on SLO breach",
    ],
    techStack: ["Python", "FastAPI", "Prometheus"],
    steps: [
      {
        stepNumber: 1,
        title: "Deterministic Traffic Splitting",
        instruction:
          "## Why deterministic\n\nIf you split by `random.random()`, the same user can hit different variants on consecutive requests, polluting your experiment. Use a stable hash of `user_id`.\n\n## Task\n\n`route(user_id, canary_percent)` returns `'canary'` if the hash bucket falls below `canary_percent`, else `'baseline'`. Same user → same decision.",
        starterCode:
          "import hashlib\n\ndef route(user_id: str, canary_percent: int) -> str:\n    # Hash user_id to a 0-99 bucket; if bucket < canary_percent, return 'canary'\n    # TODO\n    pass\n\nassert route('u1', 0) == 'baseline'\nassert route('u1', 100) == 'canary'\n# Stability: same user, same answer\nassert route('u1', 50) == route('u1', 50)\nprint('ok')\n",
        validationHint:
          "int(hashlib.md5(user_id.encode()).hexdigest(), 16) % 100 gives a stable 0-99 bucket.",
        xpReward: 90,
      },
      {
        stepNumber: 2,
        title: "Rolling Error Rate Window",
        instruction:
          "## Why a window\n\nA model that suddenly errors on 50% of requests should trigger rollback in seconds, not after an hour-long average drifts. Maintain a rolling window of recent outcomes per variant.\n\n## Task\n\nImplement `ErrorWindow(maxlen)` with `.record(ok: bool)` and `.error_rate() -> float`. Old entries fall off automatically.",
        starterCode:
          "from collections import deque\n\nclass ErrorWindow:\n    def __init__(self, maxlen: int):\n        # TODO: deque of bool 'ok' values with maxlen cap\n        pass\n    def record(self, ok: bool) -> None:\n        # TODO\n        pass\n    def error_rate(self) -> float:\n        # TODO: fraction of False values; 0.0 if empty\n        pass\n\nw = ErrorWindow(maxlen=4)\nfor ok in [True, True, False, False]:\n    w.record(ok)\nassert w.error_rate() == 0.5\nw.record(True); w.record(True)  # oldest fall off\nassert w.error_rate() == 0.25\nprint('ok')\n",
        validationHint:
          "deque(maxlen=N) handles the rolling automatically. error_rate = sum(not ok) / len(window).",
        xpReward: 100,
      },
      {
        stepNumber: 3,
        title: "Statistical Significance Check",
        instruction:
          "## Don't overreact\n\n3 errors out of 10 looks scary but isn't significant. Use a two-proportion z-test to decide whether the canary's error rate is genuinely worse.\n\n## Task\n\n`is_canary_worse(baseline_errors, baseline_n, canary_errors, canary_n, z_threshold=2.0)` returns True when the canary's error rate is significantly higher.",
        starterCode:
          "import math\n\ndef is_canary_worse(b_err: int, b_n: int, c_err: int, c_n: int, z_threshold: float = 2.0) -> bool:\n    if b_n == 0 or c_n == 0:\n        return False\n    p_b = b_err / b_n\n    p_c = c_err / c_n\n    # Pooled proportion for the z-test\n    p = (b_err + c_err) / (b_n + c_n)\n    if p in (0.0, 1.0):\n        return False\n    se = math.sqrt(p * (1 - p) * (1/b_n + 1/c_n))\n    z = (p_c - p_b) / se if se > 0 else 0\n    # TODO: return True if z > z_threshold (canary error rate higher AND significant)\n    pass\n\n# Tiny sample, big gap, NOT significant\nassert is_canary_worse(1, 10, 3, 10) is False\n# Bigger sample, real regression\nassert is_canary_worse(10, 1000, 80, 1000) is True\nprint('ok')\n",
        validationHint: "Return z > z_threshold. A negative or small z means canary is fine.",
        xpReward: 120,
      },
      {
        stepNumber: 4,
        title: "Auto-Rollback Decision",
        instruction:
          "## The actual rollback\n\nWire your pieces together: given baseline and canary windows, decide whether to roll back.\n\n## Task\n\n`should_rollback(baseline_window, canary_window, min_samples=200)` returns True only if (a) you have ≥ `min_samples` in BOTH windows AND (b) the canary is statistically worse.",
        starterCode:
          "def should_rollback(baseline, canary, min_samples: int = 200) -> bool:\n    # TODO: enforce min_samples on both windows, then call is_canary_worse\n    pass\n\n# Replace with stubs since we're not importing across cells\nclass W:\n    def __init__(self, errs, n): self.errs, self.n = errs, n\n    def error_rate(self): return self.errs/self.n if self.n else 0\n    def __len__(self): return self.n\n\nimport math\ndef is_canary_worse(b_err, b_n, c_err, c_n, z=2.0):\n    if b_n==0 or c_n==0: return False\n    p=(b_err+c_err)/(b_n+c_n)\n    if p in (0,1): return False\n    se=math.sqrt(p*(1-p)*(1/b_n+1/c_n))\n    return ((c_err/c_n - b_err/b_n)/se) > z\n\nassert should_rollback(W(5, 100), W(50, 100), min_samples=200) is False  # not enough samples\nassert should_rollback(W(10, 1000), W(80, 1000), min_samples=200) is True\nprint('ok')\n",
        validationHint:
          "Check `len(baseline) >= min_samples and len(canary) >= min_samples` first, then defer to is_canary_worse.",
        xpReward: 100,
      },
      {
        stepNumber: 5,
        title: "Putting It Together: The Router",
        instruction:
          "## Tying it up\n\nWrite a `Router` class that does deterministic routing, records outcomes per variant, and exposes a `should_rollback()` method using your prior pieces.\n\nThis is the same shape used by Seldon, Vertex AI, and SageMaker Inference internally — minus the YAML.",
        starterCode:
          "class Router:\n    def __init__(self, canary_percent: int, window: int = 1000):\n        self.canary_percent = canary_percent\n        # TODO: two windows, one per variant\n    def route(self, user_id: str) -> str:\n        # TODO: reuse step 1 logic\n        pass\n    def record(self, variant: str, ok: bool) -> None:\n        # TODO\n        pass\n    def should_rollback(self) -> bool:\n        # TODO\n        pass\n\nr = Router(canary_percent=50)\nfor i in range(2000):\n    v = r.route(f'u{i}')\n    r.record(v, ok=(v == 'baseline' or i % 10 != 0))  # canary 10% error\nassert r.should_rollback() is True\nprint('ok')\n",
        validationHint: "Compose step 1, 2, and 4 — no new logic needed.",
        xpReward: 110,
      },
    ],
  },

  // ============================================================
  // AI Engineering — 2 projects
  // ============================================================
  {
    domainSlug: "ai-engineering",
    slug: "ai-eng-rag-pipeline",
    title: "Build a Production-Ready RAG Pipeline",
    shortDescription:
      "Retrieval-augmented generation from scratch: chunking, embedding, retrieval, reranking, and grounded answers.",
    fullDescription:
      "RAG is the workhorse pattern of LLM apps. You'll build every stage yourself so you understand the failure modes — bad chunking, poor recall, hallucinated citations — and the techniques real systems use to fix them.",
    difficulty: "intermediate",
    estimatedMinutes: 360,
    position: 1,
    isPremium: false,
    language: "python",
    xpReward: 550,
    tags: ["rag", "embeddings", "vector-search", "llm"],
    learningObjectives: [
      "Pick chunking strategies that preserve meaning",
      "Implement cosine-similarity retrieval",
      "Use reranking to fix recall vs precision",
      "Ground LLM answers with verifiable citations",
    ],
    techStack: ["Python", "NumPy", "pgvector"],
    steps: [
      {
        stepNumber: 1,
        title: "Chunking: The Hidden Bottleneck",
        instruction:
          "## Most RAG failures are chunking failures\n\nIf chunks are too big you lose precision. Too small and you lose context. Naive 'split every 500 chars' is the worst of both worlds — sentences get cut mid-word.\n\n## Task\n\n`chunk_with_overlap(text, size, overlap)` splits `text` into chunks of `size` chars with `overlap` chars of context bleed. Return a list of strings.",
        starterCode:
          "def chunk_with_overlap(text: str, size: int, overlap: int) -> list[str]:\n    if size <= 0 or overlap >= size:\n        raise ValueError('bad sizes')\n    # TODO: slide window of `size` with `overlap` between chunks\n    pass\n\nchunks = chunk_with_overlap('abcdefghij', size=4, overlap=1)\nassert chunks == ['abcd', 'defg', 'ghij'], chunks\nprint('ok')\n",
        validationHint:
          "Stride is `size - overlap`. Loop `for i in range(0, len(text), stride)` and append `text[i:i+size]` if non-empty.",
        xpReward: 90,
      },
      {
        stepNumber: 2,
        title: "Embedding & Cosine Similarity",
        instruction:
          "## The math is the easy part\n\nReal systems use OpenAI or Cohere embeddings, but the math is trivial. Implement cosine similarity yourself — you'll need it for debugging and you can drop in real embeddings later.",
        starterCode:
          "import math\n\ndef cosine(a: list[float], b: list[float]) -> float:\n    if len(a) != len(b):\n        raise ValueError('dim mismatch')\n    dot = sum(x*y for x,y in zip(a,b))\n    na = math.sqrt(sum(x*x for x in a))\n    nb = math.sqrt(sum(x*x for x in b))\n    if na == 0 or nb == 0:\n        return 0.0\n    # TODO: return dot / (na * nb)\n    pass\n\nassert abs(cosine([1,0,0], [1,0,0]) - 1.0) < 1e-9\nassert abs(cosine([1,0,0], [0,1,0])) < 1e-9\nassert abs(cosine([1,1,0], [1,0,0]) - (1/math.sqrt(2))) < 1e-9\nprint('ok')\n",
        validationHint: "Just return dot / (na * nb). The guards are already there.",
        xpReward: 80,
      },
      {
        stepNumber: 3,
        title: "Top-K Retrieval",
        instruction:
          "## Find the right chunks\n\nGiven a query embedding and a corpus of (chunk, embedding) tuples, return the top-K chunks by cosine similarity.",
        starterCode:
          "import math\n\ndef cosine(a, b):\n    dot = sum(x*y for x,y in zip(a,b))\n    na = math.sqrt(sum(x*x for x in a))\n    nb = math.sqrt(sum(x*x for x in b))\n    return dot/(na*nb) if na and nb else 0\n\ndef top_k(query_emb, corpus: list[tuple], k: int) -> list[tuple]:\n    \"\"\"corpus is [(chunk_text, embedding), ...]. Return top-k by similarity.\"\"\"\n    # TODO: score each, sort descending, take first k. Return [(chunk, score), ...]\n    pass\n\ncorpus = [('apple', [1,0,0]), ('orange', [0,1,0]), ('apple pie', [0.9,0.1,0])]\nresults = top_k([1,0,0], corpus, k=2)\nassert results[0][0] == 'apple'\nassert results[1][0] == 'apple pie'\nprint('ok')\n",
        validationHint: "sorted(scored, key=lambda x: -x[1])[:k]",
        xpReward: 90,
      },
      {
        stepNumber: 4,
        title: "Reranking for Precision",
        instruction:
          "## Why a second pass\n\nEmbedding retrieval is recall-optimized — pull a wide net (top-20) then **rerank** with a more expensive cross-encoder to surface the truly relevant K. We'll simulate the cross-encoder with a keyword-overlap scorer for this exercise.\n\n## Task\n\n`rerank(query, candidates, k)` returns top-K candidates by **keyword overlap with the query** (number of shared lowercase tokens).",
        starterCode:
          "def rerank(query: str, candidates: list[str], k: int) -> list[str]:\n    q_tokens = set(query.lower().split())\n    scored = []\n    for c in candidates:\n        overlap = len(q_tokens & set(c.lower().split()))\n        scored.append((c, overlap))\n    # TODO: sort by overlap descending, take top k, return just the chunk strings\n    pass\n\nresult = rerank('apple pie recipe', ['apple sauce', 'apple pie crust', 'orange juice'], k=2)\nassert 'apple pie crust' in result\nassert 'orange juice' not in result\nprint('ok')\n",
        validationHint: "sorted(scored, key=lambda x: -x[1])[:k], then list-comp to strip scores.",
        xpReward: 100,
      },
      {
        stepNumber: 5,
        title: "Grounded Answers with Citations",
        instruction:
          "## Stop hallucinations cold\n\nThe single highest-leverage RAG technique: force the LLM to cite its sources by chunk ID. If the answer can't be traced back, it's hallucinated.\n\n## Task\n\n`build_prompt(question, chunks)` builds a prompt where each chunk is numbered `[1]`, `[2]`, ... and the question instructs the model to cite chunks like `[1, 2]`. Return the full prompt string.",
        starterCode:
          "def build_prompt(question: str, chunks: list[str]) -> str:\n    # TODO: format as:\n    # Sources:\n    # [1] chunk one\n    # [2] chunk two\n    # ...\n    # Question: <question>\n    # Answer (cite sources like [1] or [1,2]):\n    pass\n\np = build_prompt('What is X?', ['X is foo', 'Y is bar'])\nassert '[1] X is foo' in p\nassert '[2] Y is bar' in p\nassert 'Question: What is X?' in p\nassert 'cite' in p.lower()\nprint('ok')\n",
        validationHint:
          "Build the sources block with enumerate(chunks, 1), then concatenate with the question + citation instruction.",
        xpReward: 90,
      },
    ],
  },
  {
    domainSlug: "ai-engineering",
    slug: "ai-eng-llm-eval-harness",
    title: "Build an LLM Eval Harness",
    shortDescription:
      "Replace 'looks good to me' with a real eval suite: exact-match, semantic similarity, LLM-as-judge, and regression gates.",
    fullDescription:
      "Without evals you cannot ship LLM features safely. Build the evaluation primitives that real teams use — deterministic checks, embedding-based semantic match, LLM-as-judge with rubrics, and a CI gate that blocks PRs when scores regress.",
    difficulty: "intermediate",
    estimatedMinutes: 300,
    position: 2,
    isPremium: true,
    language: "python",
    xpReward: 500,
    tags: ["llm", "evals", "testing", "regression"],
    learningObjectives: [
      "Pick the right eval for the task",
      "Build a deterministic test runner",
      "Implement semantic similarity scoring",
      "Gate releases on regression thresholds",
    ],
    techStack: ["Python", "Pytest"],
    steps: [
      {
        stepNumber: 1,
        title: "Exact Match (and its limits)",
        instruction:
          "## The simplest eval\n\nNormalize both strings (lowercase, strip whitespace) and compare. Useful for classification, useless for free-form answers.",
        starterCode:
          "def exact_match(predicted: str, expected: str) -> bool:\n    # TODO: lower + strip both sides, compare\n    pass\n\nassert exact_match(' Yes ', 'yes') is True\nassert exact_match('No', 'yes') is False\nprint('ok')\n",
        validationHint: "predicted.strip().lower() == expected.strip().lower()",
        xpReward: 60,
      },
      {
        stepNumber: 2,
        title: "Token F1 for Free-Form Answers",
        instruction:
          "## When exact match is too strict\n\nFor short factual answers, token-level F1 rewards partial overlap.\n\n## Task\n\nImplement `token_f1(predicted, expected)` returning F1 of tokens (precision × recall × 2 / (precision + recall)).",
        starterCode:
          "def token_f1(predicted: str, expected: str) -> float:\n    p_tokens = predicted.lower().split()\n    e_tokens = expected.lower().split()\n    if not p_tokens and not e_tokens:\n        return 1.0\n    if not p_tokens or not e_tokens:\n        return 0.0\n    common = set(p_tokens) & set(e_tokens)\n    if not common:\n        return 0.0\n    precision = len(common) / len(set(p_tokens))\n    recall = len(common) / len(set(e_tokens))\n    # TODO: return 2 * p * r / (p + r)\n    pass\n\nassert token_f1('the cat sat', 'the cat sat') == 1.0\nassert token_f1('the cat', 'the dog') == 0.5\nassert token_f1('', 'nothing') == 0.0\nprint('ok')\n",
        validationHint: "Return `2 * precision * recall / (precision + recall)`. Edge cases are pre-handled.",
        xpReward: 100,
      },
      {
        stepNumber: 3,
        title: "LLM-as-Judge with a Rubric",
        instruction:
          "## Why a rubric\n\nFree-form LLM judging is noisy unless you constrain it. Build a prompt that forces a 1-5 score against named criteria, and parse the score out reliably.\n\n## Task\n\n`parse_judge_score(text)` extracts the integer score from a judge response like `'Score: 4\\nReasoning: ...'`. Return None if not parseable.",
        starterCode:
          "import re\n\ndef parse_judge_score(text: str) -> int | None:\n    # TODO: regex 'Score:\\s*(\\d+)' (case-insensitive). Validate 1<=score<=5.\n    pass\n\nassert parse_judge_score('Score: 4\\nReasoning: looks great') == 4\nassert parse_judge_score('score: 5') == 5\nassert parse_judge_score('no score here') is None\nassert parse_judge_score('Score: 99') is None  # out of range\nprint('ok')\n",
        validationHint:
          "re.search(r'score:\\s*(\\d+)', text, re.IGNORECASE), then int() and check 1<=n<=5.",
        xpReward: 110,
      },
      {
        stepNumber: 4,
        title: "Eval Suite Runner",
        instruction:
          "## Run many cases, aggregate one number\n\n`run_eval(cases, metric_fn)` runs `metric_fn(predicted, expected)` for each case and returns the mean. Cases are `[{'predicted': str, 'expected': str}]`.",
        starterCode:
          "def run_eval(cases: list[dict], metric_fn) -> float:\n    if not cases:\n        return 0.0\n    # TODO: average metric_fn(c['predicted'], c['expected']) over all cases\n    pass\n\ndef exact_match(p, e):\n    return 1.0 if p.strip().lower() == e.strip().lower() else 0.0\n\ncases = [\n    {'predicted': 'yes', 'expected': 'yes'},\n    {'predicted': 'no', 'expected': 'yes'},\n    {'predicted': 'yes', 'expected': 'yes'},\n]\nassert abs(run_eval(cases, exact_match) - (2/3)) < 1e-9\nprint('ok')\n",
        validationHint: "sum(metric_fn(...)) / len(cases). One-liner with a generator.",
        xpReward: 90,
      },
      {
        stepNumber: 5,
        title: "Regression Gate for CI",
        instruction:
          "## Block regressions in CI\n\nGiven a baseline score and a new score, decide if the PR should be blocked. Allow a small tolerance so noise doesn't churn.\n\n## Task\n\n`is_regression(baseline, current, tolerance=0.02)` returns True iff `current < baseline - tolerance`.",
        starterCode:
          "def is_regression(baseline: float, current: float, tolerance: float = 0.02) -> bool:\n    # TODO\n    pass\n\nassert is_regression(0.80, 0.79) is False  # within tolerance\nassert is_regression(0.80, 0.76) is True   # genuine drop\nassert is_regression(0.80, 0.85) is False  # improvement\nprint('ok')\n",
        validationHint: "return current < baseline - tolerance",
        xpReward: 80,
      },
    ],
  },

  // ============================================================
  // Data Science — 2 projects
  // ============================================================
  {
    domainSlug: "data-science",
    slug: "ds-ab-test-from-scratch",
    title: "Run an A/B Test from Scratch",
    shortDescription:
      "Power analysis, randomization, p-values, confidence intervals — the full statistical workflow without scipy.",
    fullDescription:
      "A/B tests are how every data-driven org makes product decisions. You'll do every calculation by hand so you understand the math — sample size, two-proportion z-test, confidence interval, and the most common mistake: peeking.",
    difficulty: "intermediate",
    estimatedMinutes: 300,
    position: 1,
    isPremium: false,
    language: "python",
    xpReward: 500,
    tags: ["ab-test", "statistics", "experimentation"],
    learningObjectives: [
      "Compute minimum sample size from desired power",
      "Implement a two-proportion z-test",
      "Build a confidence interval",
      "Avoid the peeking trap",
    ],
    techStack: ["Python", "NumPy"],
    steps: [
      {
        stepNumber: 1,
        title: "Sample Size Calculator",
        instruction:
          "## Don't start without this\n\nThe #1 mistake is starting a test with no idea how long it'll take. For a two-proportion test:\n\n`n ≈ (z_alpha + z_beta)^2 × (p1(1-p1) + p2(1-p2)) / (p1 - p2)^2` per group.\n\n## Task\n\n`min_sample_size(p1, p2, alpha=0.05, power=0.80)` returns the per-group sample size. Use `z_alpha=1.96` and `z_beta=0.84`.",
        starterCode:
          "import math\n\ndef min_sample_size(p1: float, p2: float, alpha: float = 0.05, power: float = 0.80) -> int:\n    if p1 == p2:\n        raise ValueError('no difference to detect')\n    z_alpha, z_beta = 1.96, 0.84\n    # TODO: implement formula above, return math.ceil(...)\n    pass\n\nn = min_sample_size(0.10, 0.12)\nassert 3500 < n < 4500, n  # ~3838\nprint('ok')\n",
        validationHint:
          "Plug the formula directly: ((1.96+0.84)**2 * (p1*(1-p1) + p2*(1-p2))) / (p1-p2)**2 then math.ceil.",
        xpReward: 100,
      },
      {
        stepNumber: 2,
        title: "Deterministic Randomization",
        instruction:
          "## Every assignment must be reproducible\n\nUse a hash of `user_id + experiment_id` so the same user always gets the same bucket across page loads, sessions, and reruns.",
        starterCode:
          "import hashlib\n\ndef assign(user_id: str, experiment_id: str) -> str:\n    key = f'{user_id}:{experiment_id}'\n    bucket = int(hashlib.md5(key.encode()).hexdigest(), 16) % 2\n    # TODO: return 'A' or 'B'\n    pass\n\nassert assign('u1', 'exp_color') == assign('u1', 'exp_color')\n# Different experiments → independent assignment\nassignments = [assign(f'u{i}', 'exp1') for i in range(1000)]\nshare_b = sum(1 for a in assignments if a == 'B') / 1000\nassert 0.4 < share_b < 0.6, share_b\nprint('ok')\n",
        validationHint: "Return 'A' if bucket == 0 else 'B'.",
        xpReward: 80,
      },
      {
        stepNumber: 3,
        title: "Two-Proportion Z-Test",
        instruction:
          "## The actual significance test\n\nGiven conversions and trials per group, compute the z-statistic and a two-sided p-value.\n\nFor p-value from z, use the survival function approximation:\n`p ≈ 2 * (1 - Phi(|z|))`\nwhere `Phi(x) = 0.5 * (1 + erf(x/sqrt(2)))` and `math.erf` is in the stdlib.",
        starterCode:
          "import math\n\ndef phi(x: float) -> float:\n    return 0.5 * (1 + math.erf(x / math.sqrt(2)))\n\ndef z_test(c1: int, n1: int, c2: int, n2: int) -> tuple[float, float]:\n    p1, p2 = c1/n1, c2/n2\n    p = (c1 + c2) / (n1 + n2)\n    se = math.sqrt(p * (1 - p) * (1/n1 + 1/n2))\n    z = (p2 - p1) / se if se > 0 else 0.0\n    # TODO: pvalue = 2 * (1 - phi(abs(z)))\n    pvalue = 0.0\n    return z, pvalue\n\nz, p = z_test(100, 1000, 130, 1000)\nassert p < 0.05, p\nz, p = z_test(100, 1000, 102, 1000)\nassert p > 0.05, p\nprint('ok')\n",
        validationHint: "pvalue = 2 * (1 - phi(abs(z))). That's the whole fix.",
        xpReward: 130,
      },
      {
        stepNumber: 4,
        title: "Confidence Interval for the Lift",
        instruction:
          "## P-values aren't enough\n\nA stakeholder wants to know 'how much did B improve?' with uncertainty. Compute a 95% CI for `p2 - p1`.",
        starterCode:
          "import math\n\ndef ci_for_lift(c1: int, n1: int, c2: int, n2: int) -> tuple[float, float]:\n    p1, p2 = c1/n1, c2/n2\n    se = math.sqrt(p1*(1-p1)/n1 + p2*(1-p2)/n2)\n    diff = p2 - p1\n    # TODO: 95% CI uses z = 1.96. Return (diff - 1.96*se, diff + 1.96*se)\n    pass\n\nlo, hi = ci_for_lift(100, 1000, 130, 1000)\nassert lo > 0 and hi > 0  # CI excludes zero → significant\nlo, hi = ci_for_lift(100, 1000, 102, 1000)\nassert lo < 0 < hi  # CI includes zero → not significant\nprint('ok')\n",
        validationHint: "return (diff - 1.96*se, diff + 1.96*se)",
        xpReward: 100,
      },
      {
        stepNumber: 5,
        title: "Don't Peek (Sequential Testing)",
        instruction:
          "## Why peeking inflates false positives\n\nIf you check the p-value daily and stop the second p<0.05, your true false-positive rate can be 30%+ instead of 5%. The fix is to apply a Bonferroni correction or use a sequential testing framework.\n\n## Task\n\n`peeking_corrected_alpha(num_peeks, base_alpha=0.05)` returns the Bonferroni-corrected alpha you should use at each peek.",
        starterCode:
          "def peeking_corrected_alpha(num_peeks: int, base_alpha: float = 0.05) -> float:\n    if num_peeks < 1:\n        raise ValueError('need at least one peek')\n    # TODO: Bonferroni = base_alpha / num_peeks\n    pass\n\nassert peeking_corrected_alpha(1) == 0.05\nassert abs(peeking_corrected_alpha(5) - 0.01) < 1e-9\nprint('ok')\n",
        validationHint: "Return base_alpha / num_peeks. Bonferroni is the simplest correction.",
        xpReward: 90,
      },
    ],
  },
  {
    domainSlug: "data-science",
    slug: "ds-causal-inference-uplift",
    title: "Causal Inference & Uplift Modeling",
    shortDescription:
      "Estimate causal effect from observational data with propensity scoring, and target the right users with an uplift model.",
    fullDescription:
      "Correlation isn't causation, and your model knows it. You'll fit a propensity score, estimate the average treatment effect (ATE), and build an uplift model that identifies *which* users a treatment actually helps — the difference between 'always recommend' and 'recommend smartly'.",
    difficulty: "advanced",
    estimatedMinutes: 360,
    position: 2,
    isPremium: true,
    language: "python",
    xpReward: 600,
    tags: ["causal-inference", "uplift", "propensity-score"],
    learningObjectives: [
      "Distinguish ATE from observed correlation",
      "Compute and use propensity scores",
      "Estimate uplift per user",
      "Avoid the targeting paradox",
    ],
    techStack: ["Python", "NumPy"],
    steps: [
      {
        stepNumber: 1,
        title: "Naive ATE (and why it's biased)",
        instruction:
          "## The naive estimator\n\n`ATE_naive = mean(y | treated) - mean(y | control)`\n\nThis is biased whenever treatment isn't randomly assigned. We'll quantify the bias in step 3.\n\n## Task\n\nImplement `naive_ate(treated_y, control_y)` — just the difference of means.",
        starterCode:
          "def naive_ate(treated_y: list[float], control_y: list[float]) -> float:\n    if not treated_y or not control_y:\n        raise ValueError('empty group')\n    # TODO\n    pass\n\nassert naive_ate([1,2,3], [0,1,2]) == 1.0\nprint('ok')\n",
        validationHint: "sum(treated_y)/len(treated_y) - sum(control_y)/len(control_y)",
        xpReward: 70,
      },
      {
        stepNumber: 2,
        title: "Propensity Score (Simplified)",
        instruction:
          "## What it is\n\nPropensity = P(treated | features). Once you condition on it, treatment is as-good-as random.\n\nWe'll fit a one-feature logistic model: `p = 1 / (1 + exp(-(a + b*x)))`. For this exercise, assume `a, b` are given.\n\n## Task\n\n`propensity(x, a, b)` returns the logistic probability.",
        starterCode:
          "import math\n\ndef propensity(x: float, a: float, b: float) -> float:\n    # TODO: 1 / (1 + exp(-(a + b*x)))\n    pass\n\nassert abs(propensity(0, 0, 1) - 0.5) < 1e-9\nassert propensity(10, 0, 1) > 0.99\nassert propensity(-10, 0, 1) < 0.01\nprint('ok')\n",
        validationHint: "Use math.exp. Watch out for sign on the exponent.",
        xpReward: 80,
      },
      {
        stepNumber: 3,
        title: "IPW: Inverse Propensity Weighting",
        instruction:
          "## Reweight the data\n\nIPW corrects for selection bias by upweighting under-represented groups.\n\n`ATE_IPW = mean(y * t / p) - mean(y * (1-t) / (1-p))`\n\nwhere `t ∈ {0,1}` is treatment and `p` is the propensity.\n\n## Task\n\nImplement `ipw_ate(rows)` where each row is `{'y': float, 't': 0|1, 'p': float}`. Clip propensities to `[0.05, 0.95]` to avoid blowup.",
        starterCode:
          "def ipw_ate(rows: list[dict]) -> float:\n    treated_sum, control_sum = 0.0, 0.0\n    n = len(rows)\n    for r in rows:\n        p = max(0.05, min(0.95, r['p']))\n        if r['t'] == 1:\n            treated_sum += r['y'] / p\n        else:\n            control_sum += r['y'] / (1 - p)\n    # TODO: return treated_sum/n - control_sum/n\n    pass\n\nrows = [\n    {'y': 1, 't': 1, 'p': 0.5},\n    {'y': 0, 't': 0, 'p': 0.5},\n    {'y': 1, 't': 1, 'p': 0.5},\n    {'y': 0, 't': 0, 'p': 0.5},\n]\nassert ipw_ate(rows) == 1.0\nprint('ok')\n",
        validationHint:
          "return treated_sum/n - control_sum/n. The Horvitz-Thompson estimator is exactly this division-by-N form.",
        xpReward: 130,
      },
      {
        stepNumber: 4,
        title: "Uplift: Two-Model Approach",
        instruction:
          "## ATE is not enough\n\nATE tells you the *average* effect. Uplift tells you the effect **per user**.\n\nThe simplest approach: fit `f_t(x)` on treated and `f_c(x)` on control. Uplift = `f_t(x) - f_c(x)`.\n\n## Task\n\nGiven prediction functions `f_treated(x)` and `f_control(x)`, implement `uplift(x, f_treated, f_control)`.",
        starterCode:
          "def uplift(x, f_treated, f_control) -> float:\n    # TODO: return f_treated(x) - f_control(x)\n    pass\n\nassert uplift(5, lambda v: v*2, lambda v: v) == 5  # 10 - 5\nassert uplift(5, lambda v: v, lambda v: v*2) == -5  # 5 - 10\nprint('ok')\n",
        validationHint: "Just `return f_treated(x) - f_control(x)`. Don't overthink.",
        xpReward: 80,
      },
      {
        stepNumber: 5,
        title: "Target Only Persuadables",
        instruction:
          "## The taxonomy\n\nFor any treatment, users fall into 4 groups:\n\n- **Persuadables** — convert only if treated (positive uplift)\n- **Sure things** — convert anyway (zero uplift)\n- **Lost causes** — never convert (zero uplift)\n- **Sleeping dogs** — convert only if NOT treated (negative uplift)\n\nTargeting all users wastes spend on the last three categories. Real uplift modeling targets only positive-uplift users.\n\n## Task\n\n`should_target(uplift_score, threshold=0.0)` returns True iff `uplift > threshold`.",
        starterCode:
          "def should_target(uplift_score: float, threshold: float = 0.0) -> bool:\n    # TODO\n    pass\n\nassert should_target(0.1) is True\nassert should_target(0.0) is False  # strictly greater\nassert should_target(-0.5) is False  # sleeping dog — never treat\nprint('ok')\n",
        validationHint: "return uplift_score > threshold. The strict greater-than matters — zero-uplift is neutral, not worth the spend.",
        xpReward: 90,
      },
    ],
  },
];
