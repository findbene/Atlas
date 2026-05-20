/**
 * Phase 11 batch-3 / ai-engineer.
 * Candidate b6a7c1e2-5d34-4f88-9012-1a2b3c4d5e6f — LLM Eval Harness with
 * golden datasets, regression detection, and multi-judge consensus.
 *
 * Legacy: `ai-eng-llm-eval-harness` (5-step skeleton, score 44.2). Replaces it.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const aiEngineerLlmEvalHarness: AuthoredProject = {
  slug: "ai-engineer-llm-eval-harness",
  candidateId: "b6a7c1e2-5d34-4f88-9012-1a2b3c4d5e6f",
  title: "LLM Eval Harness — Golden Sets + Regression Detection + Multi-Judge",
  shortDescription:
    "Build a CI-runnable LLM eval harness: golden-set scoring (exact / contains / numeric), multi-judge consensus (GPT-4o + Claude + Haiku), and a regression-detection gate that fails the build when win-rate drops >2pts vs the last baseline.",
  fullDescription:
    "Eval is the difference between 'feels better' and 'ship it'. You'll build a harness that scores prompts against a 150-example golden set, runs three judge models in parallel with consensus voting, and persists per-prompt scores so CI can compute deltas and fail builds on regression. Every step has a measurable acceptance bar — by the end you have a harness a hiring manager can run in 5 minutes.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "OpenAI", "Anthropic", "FastAPI", "pytest", "evals", "pgvector"],
  tags: ["evals", "openai", "anthropic", "regression", "llm-judge", "ci", "rag"],
  learningObjectives: [
    "Design a golden dataset that survives prompt iteration.",
    "Implement scoring kinds: exact match, contains, numeric tolerance, judge.",
    "Run multi-judge consensus to reduce single-model bias.",
    "Detect regressions: compare win-rates against the last green baseline.",
    "Expose results via FastAPI so CI can gate on them.",
  ],
  estimatedMinutes: 220,
  xpReward: 720,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Founding AI engineer at a 25-person edtech startup. The team ships prompt changes 5x a day; quality regresses silently because no one runs evals. You have one sprint to wire a CI gate before the next enterprise demo.",
    hiringRelevance2026:
      "Every senior AI-engineer interview in 2026 asks 'walk me through your eval setup'. A working multi-judge harness with regression gates is the answer that separates seniors from mids.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (golden set / judges / regression / gate)",
      "Step 1 golden set", "Step 2 scoring kinds", "Step 3 multi-judge",
      "Step 4 regression detection", "Step 5 FastAPI + CI gate", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with the 150-example golden set, the scoring lib (4 kinds + multi-judge), the regression-detection CLI, a FastAPI /evals/run endpoint, and a GitHub Actions workflow that fails on >2pt win-rate drop.",
    portfolioRelevance:
      "AI repos with eval harnesses get 5x more hiring-manager attention than those without. This artifact is the closer.",
    repoUrl: "https://github.com/<your-handle>/llm-eval-harness",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Design the golden dataset schema",
      instructionMd:
        "Define `GoldenExample` (id, prompt, expected, kind, tags). Load 150 examples from `golden_set.jsonl`. Validator parses the file and asserts: 150 rows, 4 distinct `kind` values (exact/contains/numeric/judge), every row has non-empty `tags`, and `id` is unique.",
      learningObjective: "A golden set survives prompt iteration only if its schema is precise + tagged.",
      requiredSkill: "Dataset schema design + JSONL parsing + uniqueness + tag taxonomy",
      starterCode: SRC(`# golden.py
import json
from dataclasses import dataclass

@dataclass(frozen=True)
class GoldenExample:
    id: str
    prompt: str
    expected: str | float | dict
    kind: str  # 'exact' | 'contains' | 'numeric' | 'judge'
    tags: list[str]

def load_golden(path: str) -> list[GoldenExample]:
    examples = []
    with open(path) as f:
        for line in f:
            row = json.loads(line)
            # TODO: build GoldenExample + assert id uniqueness + kind in allowed set
            examples.append(GoldenExample(**row))
    return examples
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Loads 150 examples; 4 distinct kinds; all tags non-empty; ids unique.", {
        expected: { count: 150, distinctKinds: 4, allTagged: true, uniqueIds: true },
      }),
      expectedOutputs: { count: 150, distinctKinds: 4, allTagged: true, uniqueIds: true },
      datasetRefs: ["fixtures/golden_set.jsonl"],
      pedagogy: pedagogyConfig({
        hints: [
          "Tags > free-text categories — they let you slice regressions by use-case (math, citations, refusals).",
          "A frozen dataclass forces a clear schema; let typos fail at load time, not eval time.",
          "Mix kinds: pure exact-match sets are brittle; pure judge sets are slow + noisy.",
          "Generate `id` deterministically (e.g. sha1 of prompt) so re-imports stay stable.",
          "assert len({e.id for e in examples}) == len(examples), 'duplicate ids'",
        ],
        successFeedback: "Golden set is now a typed, taggable corpus. Future regressions can be sliced by tag.",
        failureFeedback: "Common slips: untyped dict-of-dicts (drift); no id stability (eval diffs become noise); single kind (over-fits to that kind).",
        portfolioRelevance: "A typed golden-set loader is the first thing reviewers grep your repo for. Make it obvious.",
        finalExplanation: "Every eval downstream depends on this schema. Get it right once, never touch it again.",
        misconceptionToWatchFor: "Treating the golden set as immutable test data rather than versioned alongside prompts. They drift together.",
      }),
    },
    {
      stepNumber: 2,
      title: "Implement 4 scoring kinds",
      instructionMd:
        "Implement `score(example, response) -> ScoreResult` dispatched by `example.kind`: `exact` (==), `contains` (substring, case-insensitive), `numeric` (parse number, ±tolerance from example.expected['tolerance']), `judge` (defer to step 3 — return placeholder). Validator runs the 4 kinds on 8 fixture responses and asserts the expected pass/fail matrix.",
      learningObjective: "A handful of scoring kinds covers ~90% of real LLM evals.",
      requiredSkill: "Dispatch + numeric tolerance + case-insensitive matching",
      starterCode: SRC(`# scoring.py
import re
from dataclasses import dataclass

@dataclass
class ScoreResult:
    passed: bool
    detail: str

def score(example, response: str) -> ScoreResult:
    if example.kind == 'exact':
        ok = response.strip() == str(example.expected).strip()
        return ScoreResult(ok, f"exact: {'==' if ok else '!='}")
    if example.kind == 'contains':
        ok = str(example.expected).lower() in response.lower()
        return ScoreResult(ok, f"contains: {'yes' if ok else 'no'}")
    if example.kind == 'numeric':
        # TODO: parse first number out of response, compare to example.expected['value']
        # within example.expected['tolerance']
        return ScoreResult(False, 'numeric: not implemented')
    if example.kind == 'judge':
        return ScoreResult(False, 'judge: deferred')
    raise ValueError(f"unknown kind {example.kind}")
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "8 fixture (example, response) pairs — pass/fail matrix matches expected.", {
        expected: { passes: 5, fails: 3, byKind: { exact: 2, contains: 2, numeric: 1, judge: 0 } },
      }),
      expectedOutputs: { passes: 5, fails: 3, byKind: { exact: 2, contains: 2, numeric: 1, judge: 0 } },
      datasetRefs: ["fixtures/scoring_cases.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "`.strip()` before equality — trailing newlines are the most common false-fail.",
          "Case-insensitive contains is the right default for free-text answers.",
          "Numeric tolerance MUST come from the example — '3.14' vs '3.14159' is task-specific.",
          "Defer judge to a separate code path; it has wildly different latency + cost.",
          "m = re.search(r'-?\\d+(?:\\.\\d+)?', response); val = float(m.group()) if m else float('nan')",
        ],
        successFeedback: "Four scoring kinds cover most real evals without the cost of LLM judges.",
        failureFeedback: "Common slips: literal `==` on stripped strings only catches whitespace; ignoring units in numeric (5 vs 5.0%); judge fallback inflates cost 100x.",
        portfolioRelevance: "Knowing when to NOT use an LLM judge is itself a senior signal. Show your dispatch logic.",
        finalExplanation: "Cheap, deterministic scoring kinds run on every commit. LLM-as-judge runs nightly.",
        misconceptionToWatchFor: "Using GPT-4 to grade every response. It's slow, expensive, and inconsistent compared to a regex for half the cases.",
      }),
    },
    {
      stepNumber: 3,
      title: "Multi-judge consensus (GPT-4o + Claude + Haiku)",
      instructionMd:
        "Implement `judge(example, response, judges=['gpt-4o','claude-sonnet-4','claude-haiku-4']) -> JudgeResult` that runs all 3 judges in parallel (asyncio.gather), each returning a 1-5 score with reasoning, then computes consensus = median. Validator mocks the 3 API clients with fixed scores [4, 5, 3] for a fixture pair and asserts consensus=4.",
      learningObjective: "Single-judge scores have ~15% variance across runs; median of 3 cuts it to ~4%.",
      requiredSkill: "asyncio.gather + multi-provider abstractions + consensus voting",
      starterCode: SRC(`# judges.py
import asyncio, statistics
from dataclasses import dataclass

@dataclass
class JudgeResult:
    consensus: float
    per_judge: dict[str, float]
    reasonings: dict[str, str]

JUDGE_PROMPT = """You are grading an LLM response.
Question: {prompt}
Expected (gist): {expected}
Response: {response}
Score 1 (terrible) to 5 (perfect). Reply JSON: {{"score": int, "reasoning": str}}"""

async def call_judge(model: str, example, response: str, client) -> tuple[float, str]:
    # TODO: format JUDGE_PROMPT, call client (OpenAI or Anthropic shape), parse JSON.
    return 3.0, "stub"

async def judge(example, response: str, clients: dict) -> JudgeResult:
    judges = list(clients.keys())
    results = await asyncio.gather(*[call_judge(m, example, response, clients[m]) for m in judges])
    per_judge = {m: r[0] for m, r in zip(judges, results)}
    reasonings = {m: r[1] for m, r in zip(judges, results)}
    # TODO: consensus = statistics.median(per_judge.values())
    return JudgeResult(consensus=0.0, per_judge=per_judge, reasonings=reasonings)
`),
      validationType: "numeric_tolerance",
      stepType: "code_python",
      validation: validationConfig("numeric_tolerance", "Mocked 3 judges return [4, 5, 3]; consensus = median = 4. Tolerance ±0.1.", {
        expected: { consensus: 4.0 },
        tolerance: 0.1,
      }),
      expectedOutputs: { consensus: 4.0, perJudge: { "gpt-4o": 4, "claude-sonnet-4": 5, "claude-haiku-4": 3 } },
      datasetRefs: ["fixtures/judge_mocks.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Median > mean — one rogue judge can't swing the verdict.",
          "Run judges in parallel via asyncio.gather; serial = 3x latency for no signal gain.",
          "Always capture reasoning — half the value of judge scores is the qualitative log.",
          "Pin judge model versions explicitly — `gpt-4o-2024-08-06` not `gpt-4o`, so consensus is reproducible.",
          "consensus = statistics.median(per_judge.values())",
        ],
        successFeedback: "Multi-judge consensus drops variance enough to make eval CI meaningful.",
        failureFeedback: "Common slips: mean instead of median (rogue judge bias); serial calls (3x latency); no model pin (judge drift across versions).",
        portfolioRelevance: "Multi-model orchestration is THE 2026 ai-engineer skill. Show the asyncio.gather + median pattern explicitly.",
        finalExplanation: "Median-of-N is robust to one bad judge in a way mean isn't. The math is simple; the discipline is rare.",
        misconceptionToWatchFor: "Trusting GPT-4 alone to grade GPT-4 outputs. Self-grading is biased upward.",
      }),
    },
    {
      stepNumber: 4,
      title: "Regression detection vs last green baseline",
      instructionMd:
        "Implement `compare_to_baseline(current_results, baseline_path) -> RegressionReport` that loads baseline win-rates per tag from a JSON file and returns deltas. `RegressionReport.failed = True` if any tag drops more than 0.02 (2pts) OR overall drops more than 0.01. Validator feeds current=0.85/baseline=0.88 overall (3pt drop) and asserts failed=True with the offending tag identified.",
      learningObjective: "Per-tag deltas catch regressions that overall win-rate hides.",
      requiredSkill: "Versioned baseline comparison + tag-level slicing + threshold gates",
      starterCode: SRC(`# regression.py
import json
from dataclasses import dataclass

OVERALL_THRESHOLD = 0.01
PER_TAG_THRESHOLD = 0.02

@dataclass
class RegressionReport:
    failed: bool
    overall_delta: float
    offending_tags: list[tuple[str, float]]
    detail: str

def win_rate_by_tag(results: list[dict]) -> dict[str, float]:
    by_tag: dict[str, list[bool]] = {}
    for r in results:
        for tag in r['tags']:
            by_tag.setdefault(tag, []).append(r['passed'])
    return {t: sum(v)/len(v) for t, v in by_tag.items()}

def compare_to_baseline(current: list[dict], baseline_path: str) -> RegressionReport:
    cur_overall = sum(r['passed'] for r in current) / max(len(current), 1)
    cur_by_tag = win_rate_by_tag(current)
    with open(baseline_path) as f:
        baseline = json.load(f)
    overall_delta = cur_overall - baseline['overall']
    # TODO: find tags whose delta < -PER_TAG_THRESHOLD; failed if any OR overall_delta < -OVERALL_THRESHOLD
    return RegressionReport(failed=False, overall_delta=overall_delta, offending_tags=[], detail='stub')
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Current overall=0.85 vs baseline overall=0.88 (-3pts > 1pt threshold): report.failed=True; offending_tags lists the regressed tag(s) with their negative deltas.", {
        expected: { failed: true, overallDelta: -0.03, offendingTagCount: 1 },
      }),
      expectedOutputs: { failed: true, overallDelta: -0.03, offendingTagCount: 1 },
      datasetRefs: ["fixtures/baseline.json", "fixtures/current_run.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Per-tag gates catch regressions overall averages hide — 'math' may tank while 'refusals' improve.",
          "Tighter tag threshold (2pt) > overall (1pt): tag slices are smaller + noisier, so demand more signal.",
          "Always log the offending tag explicitly — devs want to know WHERE it broke, not just THAT it broke.",
          "Persist baselines per-branch in git LFS or S3 — don't blow them away on every CI run.",
          "offending = [(t, cur_by_tag[t] - baseline['by_tag'].get(t, 0)) for t in cur_by_tag if cur_by_tag[t] - baseline['by_tag'].get(t, 0) < -PER_TAG_THRESHOLD]",
        ],
        successFeedback: "CI now has the data it needs to gate prompt changes objectively.",
        failureFeedback: "Common slips: only overall (silent slice regressions); baseline overwritten every run (drift over time); thresholds tuned to make CI green (defeats the point).",
        portfolioRelevance: "Per-tag regression detection is a 2026 senior signal. Most teams don't have it.",
        finalExplanation: "The harness exists to gate; the gate exists to catch real regressions. Tune for signal, not green builds.",
        misconceptionToWatchFor: "Treating one bad run as a regression. Use a 3-run moving average for noisy judge scores.",
      }),
    },
    {
      stepNumber: 5,
      title: "FastAPI endpoint + GitHub Actions gate",
      instructionMd:
        "Build `POST /evals/run` in FastAPI that loads the golden set, runs all examples, calls regression detection, and returns 200 with the report OR 422 with the regression details. Validator hits the endpoint against the fixture set and asserts: 200 when current matches baseline; 422 with offending tags in body when current regresses.",
      learningObjective: "Expose evals as an HTTP endpoint so CI workflows can gate on a single call.",
      requiredSkill: "FastAPI + status-code semantics + CI integration",
      starterCode: SRC(`# main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class EvalRequest(BaseModel):
    golden_set_path: str = 'fixtures/golden_set.jsonl'
    baseline_path: str = 'fixtures/baseline.json'

class EvalReport(BaseModel):
    overall: float
    by_tag: dict[str, float]
    regression: dict

@app.post("/evals/run")
async def run_evals(req: EvalRequest) -> EvalReport:
    # TODO: load golden set, score each example (use mock generator for fixture mode),
    # compute regression, return 200 with report OR raise 422 with report in detail.
    raise HTTPException(status_code=500, detail='not implemented')
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "POST /evals/run against fixture: matching baseline -> 200 with overall ≥0.85; regressing baseline -> 422 with offending_tags populated.", {
        expected: { matchingStatus: 200, regressingStatus: 422, regressingHasOffendingTags: true },
      }),
      expectedOutputs: { matching: 200, regressing: 422 },
      datasetRefs: ["fixtures/golden_set.jsonl", "fixtures/baseline.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "422 (Unprocessable Entity) is the right code for 'data is structurally fine but failed your business rule'.",
          "Return the full report on 422 too — CI logs need the detail without re-running.",
          "Mock the generator in fixture mode; never call real LLMs in CI smoke tests.",
          "Stream progress over SSE for long runs (>30s); CI tail-logs benefit hugely.",
          "if regression.failed: raise HTTPException(status_code=422, detail=report.model_dump())",
        ],
        successFeedback: "Eval is now a single HTTP call CI can gate on. Devs see green/red in seconds.",
        failureFeedback: "Common slips: 500 on regression (signals server bug, not test fail); no detail in response body (CI can't show what broke); real LLM calls in CI (cost + flakes).",
        portfolioRelevance: "Wrapping evals in HTTP + CI gates is the 2026 production-eng pattern. Most teams stop at the notebook.",
        finalExplanation: "Evals only matter if they gate something. The HTTP endpoint is the contract; CI is the gate.",
        misconceptionToWatchFor: "Treating evals as one-off scripts run by hand. They drift to zero usage in a month.",
      }),
    },
  ],
};
