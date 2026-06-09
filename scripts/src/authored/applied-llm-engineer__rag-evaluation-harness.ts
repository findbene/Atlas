/**
 * Phase 13 — applied-llm-engineer course-seed (net-new). Lifts the
 * `applied-llm-engineer` course from 2 → 3 learner-visible projects.
 *
 * Candidate 02586bd3-68ef-4499-9ccd-c53647586981 — RAG evaluation harness:
 * build a labeled QA dataset, retrieval metrics (recall@k, MRR), answer
 * quality (LLM-judge with grounding check + cited-span coverage), end-to-end
 * regression harness with a baseline-vs-candidate diff report.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const appliedLlmEngineerRagEvaluationHarness: AuthoredProject = {
  slug: "applied-llm-engineer-rag-evaluation-harness",
  candidateId: "02586bd3-68ef-4499-9ccd-c53647586981",
  title: "RAG Evaluation Harness — Retrieval Metrics + LLM-Judge + Regression Diff",
  shortDescription:
    "Build the evaluation layer most RAG demos skip: a 200-question labeled QA set, retrieval metrics (recall@k, MRR), an LLM-judge that checks grounding + cited-span coverage, and a baseline-vs-candidate regression diff that fails CI on regressions.",
  fullDescription:
    "Every RAG demo can answer 'what does the docs say about X?'. Almost none can answer 'is this answer actually grounded in retrieved context, did retrieval find the right chunk, and is my candidate prompt better than the baseline?' You'll build the harness that answers all three: a labeled QA set with gold-chunk ids, a retrieval evaluator (recall@k + MRR), an LLM-judge that flags ungrounded claims + scores cited-span coverage, and a CLI that diffs candidate vs baseline and exits non-zero when retrieval recall or grounding rate regresses by > 3pp. This is the missing layer between 'I built a RAG' and 'I shipped one'.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "pydantic-v2", "langchain", "anthropic-api", "pgvector", "pytest"],
  tags: ["llm", "rag", "evaluation", "metrics", "regression-testing", "llm-judge"],
  learningObjectives: [
    "Design a labeled QA dataset with gold answers + gold chunk ids for retrieval grading.",
    "Implement recall@k and MRR (mean reciprocal rank) retrieval metrics correctly.",
    "Build an LLM-judge with a grounding check (is every claim in the answer supported by context?) and a span-coverage score.",
    "Run a baseline-vs-candidate evaluation diff and exit non-zero on regression > 3pp.",
    "Wire the harness into a CI workflow that gates every prompt/retriever change.",
  ],
  estimatedMinutes: 240,
  xpReward: 780,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Applied LLM engineer at a 2026 SaaS company. The RAG-powered support bot ships behind a feature flag; every prompt or chunking change has to clear a regression check before it's enabled for more users. You're building the harness that runs nightly + on every PR.",
    hiringRelevance2026:
      "RAG evaluation is the #1 thing applied-LLM hiring managers complain candidates can't do. Anyone can wire a retriever; very few can prove their retriever got BETTER. This project is a senior-LLM-engineer signal.",
    readmeOutline: [
      "Overview & The Eval-Gap Problem", "Setup (uv + pgvector + Anthropic key)",
      "Step 1 labeled QA dataset", "Step 2 retrieval metrics (recall@k + MRR)",
      "Step 3 LLM-judge grounding + span coverage", "Step 4 baseline-vs-candidate regression diff",
      "Step 5 CI harness + report artifact", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo: `eval/dataset.jsonl` (200 questions with gold chunk ids + gold answers), `eval/retrieval.py`, `eval/judge.py`, `eval/regress.py` (CLI), a GitHub Actions workflow that runs eval on every PR and posts a markdown report with the recall@k / MRR / grounding rate / span-coverage scores side-by-side with the baseline. Includes 2 deliberately-bad candidate prompts so the CI failure scenario is reproducible.",
    portfolioRelevance:
      "An LLM eval harness that actually fails CI on regressions is the single most-asked-for portfolio piece in 2026 applied-LLM hiring. Most candidates show a notebook; you'll show a workflow.",
    repoUrl: "https://github.com/<your-handle>/rag-eval-harness",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Labeled QA dataset — 200 questions with gold chunk ids + gold answers",
      instructionMd:
        "Build `eval/dataset.jsonl` with 200 records of `{question: str, gold_chunk_ids: list[str], gold_answer: str, difficulty: 'easy'|'med'|'hard'}`. Use a pydantic v2 model to validate every line. Validator loads the file, asserts: 200 rows, every `gold_chunk_ids` is non-empty, every `gold_answer` is ≥10 chars, difficulty distribution is 40% easy / 40% med / 20% hard (±5pp).",
      learningObjective: "A retrieval eval is only as good as its gold labels. Spend the time labeling 200 questions — it'll catch 20+ retriever bugs over the project's life.",
      requiredSkill: "Pydantic v2 model + JSONL validation + dataset distribution sanity",
      starterCode: SRC(`# eval/dataset.py
from pydantic import BaseModel, Field
from typing import Literal
import json
from pathlib import Path

class QAExample(BaseModel):
    question: str = Field(min_length=5)
    gold_chunk_ids: list[str] = Field(min_length=1)
    gold_answer: str = Field(min_length=10)
    difficulty: Literal["easy", "med", "hard"]

def load_dataset(path: Path) -> list[QAExample]:
    rows: list[QAExample] = []
    with path.open("r") as f:
        for line in f:
            line = line.strip()
            if not line: continue
            # TODO: model_validate_json gives a useful error per malformed row.
            rows.append(QAExample.model_validate_json(line))
    return rows

def distribution(rows: list[QAExample]) -> dict[str, float]:
    n = len(rows)
    out: dict[str, float] = {}
    for d in ("easy", "med", "hard"):
        out[d] = sum(1 for r in rows if r.difficulty == d) / n
    return out
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "200 valid QAExample rows; difficulty distribution 0.40/0.40/0.20 ±0.05.", {
        expected: { rowCount: 200, distribution: { easy: 0.40, med: 0.40, hard: 0.20 } },
        tolerance: 0.05,
      }),
      expectedOutputs: { rows: 200, distributionOk: true },
      datasetRefs: ["fixtures/qa_dataset_200.jsonl"],
      pedagogy: pedagogyConfig({
        hints: [
          "JSONL > JSON for eval datasets — append-only friendly + git-diff-able per row.",
          "`model_validate_json` per row tells you which line failed; loading the whole file as JSON does not.",
          "Difficulty stratification matters: an eval set that's 100% easy looks great until production hits a hard one.",
          "Gold chunk ids should be STABLE — store the source doc + offset, not a hash that changes when the chunker config changes.",
          "QAExample.model_validate_json(line)",
        ],
        successFeedback: "You now have a labeled eval set — the single most important asset for any RAG team.",
        failureFeedback: "Most slips: loading the whole file as one JSON (no per-row errors); under-labeling 'hard' (eval looks good, production crashes).",
        portfolioRelevance: "A real labeled eval set in your repo is what proves you understand 'shipping' vs 'demoing'. Highlight the distribution.",
        finalExplanation: "Eval gold-data is the multiplier on every downstream metric. Invest disproportionately here.",
        misconceptionToWatchFor: "Believing synthetic LLM-generated questions are sufficient. They are not — real users phrase questions differently + ask things outside the corpus.",
      }),
    },
    {
      stepNumber: 2,
      title: "Retrieval metrics — recall@k and MRR over the gold chunk ids",
      instructionMd:
        "Implement `eval_retrieval(dataset, retriever, k=10) -> {recall_at_k: float, mrr: float}`. Recall@k = fraction of questions where ≥1 gold chunk appears in the top-k. MRR = mean of 1/rank of the FIRST gold chunk (0 if not in top-k). Validator runs against a stubbed retriever with known ranks: 100 questions, 60 hit position 1, 20 hit position 3, 10 hit positions 5-10, 10 miss → expect recall@10 = 0.90, MRR ≈ 0.6 + 0.20/3 + (0.10 mean of 1/5..1/10).",
      learningObjective: "Recall@k and MRR ARE retrieval evaluation — implementing them once correctly is the single highest-leverage metric work in RAG.",
      requiredSkill: "Recall@k + MRR computation + boundary cases (empty result, miss=0)",
      starterCode: SRC(`# eval/retrieval.py
from typing import Callable
from .dataset import QAExample

Retriever = Callable[[str, int], list[str]]  # (question, k) -> chunk_ids

def recall_at_k(retrieved: list[str], gold: list[str], k: int) -> float:
    top_k = set(retrieved[:k])
    hit = any(g in top_k for g in gold)
    return 1.0 if hit else 0.0

def reciprocal_rank(retrieved: list[str], gold: list[str], k: int) -> float:
    gold_set = set(gold)
    for i, chunk_id in enumerate(retrieved[:k], start=1):
        if chunk_id in gold_set:
            # TODO: 1/rank of first gold chunk hit.
            return 1.0 / i
    return 0.0

def eval_retrieval(
    dataset: list[QAExample], retriever: Retriever, k: int = 10
) -> dict[str, float]:
    n = len(dataset)
    if n == 0: return {"recall_at_k": 0.0, "mrr": 0.0}
    recalls, rrs = 0.0, 0.0
    for q in dataset:
        retrieved = retriever(q.question, k)
        recalls += recall_at_k(retrieved, q.gold_chunk_ids, k)
        rrs     += reciprocal_rank(retrieved, q.gold_chunk_ids, k)
    return {"recall_at_k": recalls / n, "mrr": rrs / n}
`),
      validationType: "numeric_tolerance",
      stepType: "code_python",
      validation: validationConfig("numeric_tolerance", "Stubbed retriever: 60 hits at rank 1, 20 at rank 3, 10 across ranks 5-10, 10 misses -> recall@10=0.90, MRR ≈ 0.6 + 0.0667 + 0.0146 ≈ 0.681.", {
        expected: { recall_at_k: 0.90, mrr: 0.681 },
        tolerance: 0.005,
      }),
      expectedOutputs: { recall_at_10: 0.90, mrr_approx: 0.681 },
      datasetRefs: ["fixtures/stubbed_retriever_scenarios.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Recall@k is binary per question — either at least one gold chunk made the top-k or not.",
          "MRR rewards getting the right chunk at the TOP, not just anywhere in the top-k. A reranker improves MRR more than recall.",
          "Misses contribute 0 to MRR (not infinity, not -1) — that's the convention.",
          "If gold_chunk_ids has multiple ids, recall@k = at-least-one-hit, not all-hit. Different metric name (`precision@k` or `nDCG`) for full coverage.",
          "return 1.0 / i  # i is rank (1-indexed)",
        ],
        successFeedback: "Recall@k + MRR done correctly — the foundation of every retrieval-improvement story you'll ever tell.",
        failureFeedback: "Most slips: using 0-indexed rank (off-by-one in MRR); treating misses as -1 (drags MRR negative).",
        portfolioRelevance: "Showing recall@k + MRR with a regression test is what separates 'I tried RAG' from 'I shipped RAG'. Pin the numbers in the README.",
        finalExplanation: "Retrieval is the part of RAG you can actually measure objectively. Don't skip it — it's where most of the wins are.",
        misconceptionToWatchFor: "Believing answer-quality scores are sufficient. If retrieval fails, no prompt change can save you — measure retrieval first.",
      }),
    },
    {
      stepNumber: 3,
      title: "LLM-judge — grounding check + cited-span coverage",
      instructionMd:
        "Build `judge_answer(question, answer, context_chunks, llm) -> {grounded: bool, ungrounded_claims: list[str], span_coverage: float}`. The judge sends a structured prompt asking Claude to (a) list every factual claim in the answer, (b) for each claim, mark whether it's supported by the context, and (c) return the fraction of answer characters that lie within a cited context span. Validator runs against 20 hand-labeled (answer, context, expected_grounded, expected_coverage) examples; asserts grounded-classification accuracy ≥ 0.90 and span-coverage MAE ≤ 0.10.",
      learningObjective: "LLM-judge is the only practical way to grade open-ended answers at scale — but you must give the judge a STRUCTURED prompt with a typed output, not 'rate this from 1-10'.",
      requiredSkill: "Structured-output LLM judge + grounding decomposition + span-coverage computation",
      starterCode: SRC(`# eval/judge.py
from pydantic import BaseModel
from typing import Any
import json

class JudgeVerdict(BaseModel):
    grounded: bool
    ungrounded_claims: list[str]
    span_coverage: float  # 0..1

JUDGE_SYSTEM = """You are a strict RAG evaluator. Given a question, an answer, and the context chunks the answer was supposedly drawn from, you decompose the answer into atomic factual claims, mark each as supported/unsupported by the context, and compute the fraction of the answer's character length that lies inside a verbatim-or-near-verbatim cited span.

Return ONLY a JSON object with exactly these keys:
  grounded:           true iff EVERY claim is supported
  ungrounded_claims:  list of strings (atomic claims not supported)
  span_coverage:      float in [0,1]"""

def judge_answer(
    question: str, answer: str, context_chunks: list[str], llm_call: Any
) -> JudgeVerdict:
    user_msg = (
        f"Question: {question}\\n\\n"
        f"Answer to evaluate: {answer}\\n\\n"
        f"Context chunks (numbered):\\n" +
        "\\n".join(f"[{i}] {c}" for i, c in enumerate(context_chunks))
    )
    raw = llm_call(system=JUDGE_SYSTEM, user=user_msg, response_format="json")
    # TODO: validate via pydantic so a malformed judge response can't poison the eval.
    return JudgeVerdict.model_validate_json(raw)
`),
      validationType: "numeric_tolerance",
      stepType: "code_python",
      validation: validationConfig("numeric_tolerance", "20 labeled examples: grounded-classification accuracy ≥ 0.90; span-coverage MAE ≤ 0.10.", {
        expected: { groundedAccuracy: 0.95, spanCoverageMae: 0.06 },
        tolerance: 0.05,
      }),
      expectedOutputs: { groundedAccuracyGte: 0.90, spanCoverageMaeLte: 0.10 },
      datasetRefs: ["fixtures/judge_labeled_20.jsonl"],
      pedagogy: pedagogyConfig({
        hints: [
          "ALWAYS use structured output (JSON schema or pydantic model) for judge calls — free-form judge responses corrupt eval pipelines.",
          "Decomposing into atomic claims is what makes 'grounded' meaningful — a 'mostly grounded' single number hides catastrophic claims.",
          "Span coverage punishes synthesis-without-citation (the model invented connecting language) — exactly what you want to catch.",
          "Use Claude Haiku for the judge unless you're calibrating; it's cheap, fast, and consistent for grading tasks.",
          "JudgeVerdict.model_validate_json(raw)",
        ],
        successFeedback: "You can now grade open-ended answers automatically + reproducibly — the lever for scaling LLM eval.",
        failureFeedback: "Most slips: free-form judge output (un-parseable); single 1-10 score (hides what's wrong); using same model as the answer (judge bias).",
        portfolioRelevance: "An LLM-judge with calibration accuracy reported is a 2026 senior-applied-LLM signal. Pin the 0.90 accuracy number.",
        finalExplanation: "LLM-judge = LLM-as-a-classifier. Structure the prompt + structure the output + calibrate against humans — and treat the judge itself as a model you might need to upgrade later.",
        misconceptionToWatchFor: "Believing LLM-judge output is ground truth. It's not — it's a scalable proxy you must calibrate against a small human-labeled gold set.",
      }),
    },
    {
      stepNumber: 4,
      title: "Baseline-vs-candidate regression diff with hard pass/fail gates",
      instructionMd:
        "Build `regress(baseline_results, candidate_results) -> {pass: bool, regressions: list[str], deltas: {...}}`. Pass iff: candidate recall@10 ≥ baseline - 0.03 AND candidate MRR ≥ baseline - 0.03 AND candidate grounded-rate ≥ baseline - 0.03 AND candidate span-coverage ≥ baseline - 0.05. Validator: feeds (baseline=0.90/0.65/0.85/0.70) vs (candidate=0.88/0.66/0.81/0.65) → expect pass=False, regressions list = ['grounded_rate -4pp', 'span_coverage -5pp']. Then with candidate=(0.89/0.66/0.84/0.69) → pass=True.",
      learningObjective: "Regression gates ARE the value of an eval harness. Without a hard pass/fail, every metric is decoration — engineers ship anyway.",
      requiredSkill: "Threshold logic + structured regression report + diff-to-baseline pattern",
      starterCode: SRC(`# eval/regress.py
from pydantic import BaseModel
from typing import Optional

class EvalResults(BaseModel):
    recall_at_10: float
    mrr: float
    grounded_rate: float
    span_coverage: float

class RegressionReport(BaseModel):
    pass_: bool  # 'pass' is reserved in some serializers — alias it on output
    regressions: list[str]
    deltas: dict[str, float]

THRESHOLDS = {
    "recall_at_10": 0.03,
    "mrr": 0.03,
    "grounded_rate": 0.03,
    "span_coverage": 0.05,
}

def regress(baseline: EvalResults, candidate: EvalResults) -> RegressionReport:
    regressions: list[str] = []
    deltas: dict[str, float] = {}
    for k, max_drop in THRESHOLDS.items():
        b = getattr(baseline, k); c = getattr(candidate, k)
        deltas[k] = c - b
        if c < b - max_drop:
            # TODO: include the drop magnitude in pp for the operator.
            regressions.append(f"{k} {round((c - b) * 100)}pp")
    return RegressionReport(pass_=(len(regressions) == 0), regressions=regressions, deltas=deltas)
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Scenario A (baseline vs degraded candidate): pass=False, regressions=['grounded_rate -4pp', 'span_coverage -5pp']. Scenario B: pass=True.", {
        expected: {
          scenarioA: { pass: false, regressions: ["grounded_rate -4pp", "span_coverage -5pp"] },
          scenarioB: { pass: true, regressions: [] },
        },
      }),
      expectedOutputs: { scenarioAPass: false, scenarioBPass: true },
      datasetRefs: ["fixtures/regression_scenarios.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Thresholds should be DROP tolerances, not absolute floors — small noise is OK, real regression isn't.",
          "Report drop magnitude (in pp) — '-4pp' is more readable than '-0.04'.",
          "Different metrics deserve different tolerances — span_coverage is noisier than recall, so its tolerance is wider.",
          "ALWAYS return deltas (positive AND negative) — operators want to see wins too, not just regressions.",
          "if c < b - max_drop: regressions.append(...)",
        ],
        successFeedback: "Your eval is now a CI gate, not a dashboard.",
        failureFeedback: "Most slips: identical threshold for all metrics (noisy ones fail flaky); reporting only the failures (hides wins); absolute floors (breaks when baseline shifts).",
        portfolioRelevance: "A regression gate that has actually blocked a PR is the single most-compelling RAG portfolio artifact in 2026.",
        finalExplanation: "Eval without a gate is theatre. Once a number actually blocks deploys, every metric improvement becomes a real product improvement.",
        misconceptionToWatchFor: "Believing 'I'll look at the numbers each release' is sufficient. It's not — humans miss regressions; gates do not.",
      }),
    },
    {
      stepNumber: 5,
      title: "CI harness — `eval-cli compare baseline.json candidate.json` exits non-zero on regression",
      instructionMd:
        "Wire a Typer CLI `eval-cli compare <baseline.json> <candidate.json> [--report out.md]`. Loads both EvalResults, runs `regress`, writes a markdown report with side-by-side metrics + delta column + pass/fail banner. Exit 0 on pass, 1 on regression. This is a learner attestation — Atlas does not run your CLI or check exit codes; verify locally that the regression scenario exits 1 with a FAIL report and the pass scenario exits 0 with a PASS report.",
      learningObjective: "The CLI is what turns the harness into infrastructure. A markdown report is what makes it human-readable in GitHub PR comments.",
      requiredSkill: "Typer CLI + structured markdown report + non-zero exit-on-regress",
      starterCode: SRC(`# eval/cli.py
import typer, json
from pathlib import Path
from .regress import EvalResults, regress, THRESHOLDS

app = typer.Typer(no_args_is_help=True)

def render_report(baseline: EvalResults, candidate: EvalResults, report) -> str:
    banner = "✅ PASS" if report.pass_ else "❌ FAIL"
    lines = [
        f"# RAG Eval Regression Report — {banner}", "",
        "| metric | baseline | candidate | delta | threshold |",
        "|---|---|---|---|---|",
    ]
    for k, max_drop in THRESHOLDS.items():
        b, c = getattr(baseline, k), getattr(candidate, k)
        lines.append(f"| {k} | {b:.3f} | {c:.3f} | {(c-b):+.3f} | -{max_drop:.3f} |")
    if report.regressions:
        lines += ["", "## Regressions", *(f"- {r}" for r in report.regressions)]
    return "\\n".join(lines) + "\\n"

@app.command()
def compare(
    baseline: Path = typer.Argument(...),
    candidate: Path = typer.Argument(...),
    report_path: Path = typer.Option(None, "--report"),
) -> None:
    base = EvalResults.model_validate_json(baseline.read_text())
    cand = EvalResults.model_validate_json(candidate.read_text())
    r = regress(base, cand)
    md = render_report(base, cand, r)
    if report_path: report_path.write_text(md)
    typer.echo(md)
    # TODO: non-zero exit on regression — what makes this a CI gate.
    raise typer.Exit(code=0 if r.pass_ else 1)
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "Running `eval-cli compare fixtures/baseline.json fixtures/candidate_bad.json` exits with code 1 (regression detected) and the printed report contains 'FAIL' and 'grounded_rate'.",
          "Running `eval-cli compare fixtures/baseline.json fixtures/candidate_good.json` exits with code 0 (no regression) and the printed report contains 'PASS'.",
          "The `--report out.md` flag writes the markdown report to the specified file.",
        ],
      }),
      expectedOutputs: { regressionExit: 1, passExit: 0 },
      datasetRefs: ["fixtures/baseline.json", "fixtures/candidate_bad.json", "fixtures/candidate_good.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Markdown reports in GitHub PRs are the modern eval-result UI — tables, banner, regression bullets.",
          "Non-zero exit is what turns the CLI into a CI gate; without it, your workflow always passes.",
          "Write the report file even when stdout is captured — humans want to download it as a build artifact.",
          "Use Unicode banners (✅/❌) for grep-ability AND skim-ability; both matter in 2am triage.",
          "raise typer.Exit(code=0 if r.pass_ else 1)",
        ],
        successFeedback: "Full loop: dataset → metrics → judge → regression diff → CI gate. You've built the production eval stack.",
        failureFeedback: "Most slips: exiting 0 even on failure (silent pass); not writing the report file (lost artifact); plain-text report (unreadable in PR comments).",
        portfolioRelevance: "A GitHub Actions workflow that posts this markdown report on every PR is the portfolio centerpiece. Link to a sample PR.",
        finalExplanation: "Production LLM systems live or die by their eval harness. You now have the full template — dataset, metrics, judge, gate, CI.",
        misconceptionToWatchFor: "Believing the eval is 'done' once it runs. It's never done — you add questions as production surfaces failure modes; that's the loop.",
      }),
    },
  ],
};
