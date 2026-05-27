/**
 * Phase 41 — ai-engineer INTERMEDIATE seed (net-new). Closes the
 * Intermediate gap the Phase 41 coverage audit surfaced for AI — the
 * course skews advanced (RAG, multi-judge, eval-harness) with no
 * Intermediate "how do you actually decide a single LLM output is good"
 * module.
 *
 * Candidate e41b9c2d-6f70-4182-9b9c-ae0f12345678 — Deterministic rubric
 * scorer + failure taxonomy on FIXTURE LLM responses (no API key needed).
 * DELIBERATELY distinct from `ai-engineer-llm-eval-harness` (which is the
 * CI/regression/multi-judge infrastructure layer) — this teaches WHAT to
 * score by, dimension-by-dimension: faithfulness (token-overlap against
 * the source), format compliance (JSON-schema validation), failure
 * taxonomy classification, and the corpus-level rollup that becomes the
 * `quality.json` reviewers actually open.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const aiEngineerLlmOutputQualityScoring: AuthoredProject = {
  slug: "ai-engineer-llm-output-quality-scoring",
  candidateId: "e41b9c2d-6f70-4182-9b9c-ae0f12345678",
  title: "LLM Output Quality Scoring — Rubric + Failure Taxonomy (Intermediate AI)",
  shortDescription:
    "Build a deterministic LLM quality scorer that runs on FIXTURE outputs (no API key): a 4-dimension rubric (faithfulness / format / refusal_handling / instruction_following) with weighted scoring, a token-overlap faithfulness check against the source document, JSON-schema format compliance with partial credit, a 6-class failure taxonomy classifier, and a corpus-level `quality.json` rollup. By the end you can answer 'why is this LLM output good or bad' with a structured report instead of vibes.",
  fullDescription:
    "Before you can A/B-test prompts, regress LLM versions, or gate a CI build on win-rate, you need a single answer to 'is this one output good?' — and that answer is a rubric, not a vibe. You'll build a fully-deterministic scoring library against pre-recorded fixture LLM outputs (no API key, no network, byte-reproducible): a `Rubric` with 4 weighted dimensions (faithfulness 0.4, format 0.2, refusal_handling 0.2, instruction_following 0.2), a token-overlap faithfulness scorer that measures grounded coverage against a source document, a JSON-schema format scorer with partial credit for the 'parseable but extra-keys' case, a 6-class failure taxonomy classifier (hallucination / off_format / refused_correctly / over_refusal / instruction_violation / clean), and a corpus-level scorer that emits a `reports/quality.json` with per-prompt scores + mean + p10 + failure histogram. Every dimension is paired with a fixture-test that proves the score is deterministic. The library is the foundation an eval harness or CI gate sits on top of.",
  language: "python",
  difficulty: "intermediate",
  techStack: ["Python", "jsonschema", "dataclasses", "regex"],
  tags: ["ai-engineer", "intermediate", "evals", "rubric", "scoring", "failure-taxonomy", "deterministic"],
  learningObjectives: [
    "Design a typed `Rubric` dataclass with weighted dimensions that sum to 1.0 and `score(output, context) -> RubricScore` dispatch.",
    "Implement a faithfulness scorer using token-overlap against the source document — the canonical 'is this grounded' heuristic.",
    "Implement a JSON-schema format scorer with three return regions: 1.0 (valid + schema-clean), 0.5 (parseable + extra keys), 0.0 (unparseable or missing required).",
    "Build a 6-class failure taxonomy classifier from the rubric subscores using explicit decision rules (no LLM-as-judge — deterministic).",
    "Aggregate per-prompt scores into a corpus-level `quality.json` with mean, p10, and a failure-mode histogram a reviewer can read in 30 seconds.",
  ],
  estimatedMinutes: 210,
  xpReward: 630,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Mid-level AI engineer at a 40-person customer-support SaaS. The team ships prompt changes weekly but quality regresses silently because nobody can answer 'is this specific reply good'. You have one sprint to build the scoring library — fully deterministic, no API key, runs in CI — that the upcoming eval harness will sit on top of.",
    hiringRelevance2026:
      "Every 2026 senior-AI-engineer interview asks 'walk me through how you'd score an LLM output'. A 4-dimension rubric with explicit weights, a token-overlap faithfulness check, a JSON-schema format scorer with partial credit, and a failure-mode classifier is the answer that separates seniors from prompt-engineers.",
    readmeOutline: [
      "Overview — scoring vs. evals (this is the layer below)",
      "Setup (uv install jsonschema)",
      "Step 1 — Rubric dataclass + weighted dispatch",
      "Step 2 — faithfulness via token overlap",
      "Step 3 — JSON-schema format with partial credit",
      "Step 4 — failure taxonomy classifier",
      "Step 5 — corpus rollup + quality.json",
      "Portfolio Hand-off — fixture outputs + sample report",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo: `scoring/rubric.py` (Rubric + RubricScore dataclasses + weights), `scoring/faithfulness.py` (token overlap), `scoring/format.py` (jsonschema partial credit), `scoring/taxonomy.py` (6-class classifier), `scoring/corpus.py` (`score_corpus` → reports/quality.json), `fixtures/outputs.jsonl` (20 pre-recorded LLM outputs with labelled failure modes), `fixtures/source_docs/` (the grounding documents), `tests/` (one per dimension proving determinism), `reports/quality.sample.json`. README must call out the 4 dimension weights + the determinism contract + the partial-credit semantics.",
    portfolioRelevance:
      "A deterministic scoring library with explicit rubric weights + a failure taxonomy is the high-signal mid-AI-engineer artefact. Reviewers who clone, `pytest`, and see byte-reproducible scores + a sample `quality.json` they can read in 30 seconds immediately know you've moved past prompt-tuning into ML engineering.",
    repoUrl: "https://github.com/<your-handle>/llm-output-quality-scoring",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Rubric dataclass + weighted dispatch",
      instructionMd:
        "Write `scoring/rubric.py` exposing a frozen `Rubric` dataclass with `dimensions: dict[str, float]` (the weights) and a `RubricScore` dataclass with `per_dim: dict[str, float]` (each in [0, 1]) + `overall: float` (weighted sum). The default `Rubric.default()` returns dimensions `{faithfulness: 0.4, format: 0.2, refusal_handling: 0.2, instruction_following: 0.2}`. Add `Rubric.__post_init__` asserting the weights sum to 1.0 (within 1e-6) and every weight is in [0, 1]. Add `score(per_dim) -> RubricScore` that computes the weighted sum, asserting `per_dim.keys() == self.dimensions.keys()`.",
      learningObjective:
        "A rubric is a typed, weighted contract — not a dict of magic numbers. Forcing weights to sum to 1.0 and forcing the per-dim keys to match makes the scorer self-documenting and self-validating.",
      requiredSkill: "frozen dataclass + __post_init__ invariants + weighted-sum dispatch + key-set equality assertion",
      starterCode: SRC(`# scoring/rubric.py
from dataclasses import dataclass, field

@dataclass(frozen=True)
class Rubric:
    dimensions: dict[str, float]
    def __post_init__(self) -> None:
        # TODO: assert sum(self.dimensions.values()) == 1.0 (within 1e-6)
        # TODO: assert every weight is in [0, 1]
        pass
    @classmethod
    def default(cls) -> "Rubric":
        return cls(dimensions={
            "faithfulness": 0.4,
            "format": 0.2,
            "refusal_handling": 0.2,
            "instruction_following": 0.2,
        })
    def score(self, per_dim: dict[str, float]) -> "RubricScore":
        # TODO: assert per_dim.keys() == self.dimensions.keys()
        # TODO: overall = weighted sum
        return RubricScore(per_dim=per_dim, overall=0.0)

@dataclass(frozen=True)
class RubricScore:
    per_dim: dict[str, float]
    overall: float
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "Rubric.default() weights sum to 1.0; constructing with weights summing to 0.9 raises; constructing with a negative weight raises; score(per_dim) on the default rubric with per_dim={faithfulness:0.8, format:1.0, refusal_handling:0.5, instruction_following:1.0} returns overall=0.82.", {
        expected: {
          defaultWeightsSumToOne: true,
          rejectsWeightsNotSummingToOne: true,
          rejectsNegativeWeight: true,
          rejectsKeyMismatch: true,
          sampleOverallScore: 0.82,
        },
      }),
      expectedOutputs: { weightsSumChecked: true, sampleOverall: 0.82, dimensionCount: 4 },
      datasetRefs: ["fixtures/rubric_defaults.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Use `math.isclose(sum(self.dimensions.values()), 1.0, abs_tol=1e-6)` — never `== 1.0` on floats.",
          "frozen=True makes the dataclass hashable and prevents accidental in-place weight changes downstream.",
          "Key-set equality (`set(a) == set(b)`) catches typos like 'faithfullness' vs 'faithfulness' at construction time — much cheaper than at score time.",
          "Weighted sum is one line: `sum(per_dim[k] * w for k, w in self.dimensions.items())`.",
          "if not math.isclose(sum(self.dimensions.values()), 1.0, abs_tol=1e-6): raise ValueError(f'weights must sum to 1.0, got {sum(self.dimensions.values())}')",
        ],
        successFeedback: "Rubric is now a typed, validated contract — typos and weight-drift get caught at construction, not at corpus-scoring time.",
        failureFeedback: "Common slips: using `sum == 1.0` (floats); allowing arbitrary keys in per_dim (silent under-counting); making the dataclass mutable (weights drift across runs).",
        portfolioRelevance: "Reviewers grep your scoring code for explicit weight numbers and a sum-to-1.0 assertion. Both visible in a 10-line dataclass is the signal you understand the contract.",
        finalExplanation: "Every other step's score plugs into THIS dispatch. Get the invariants right once; everything downstream is just per-dimension calculations.",
        misconceptionToWatchFor: "Believing weights are 'tuning parameters'. They're product decisions — what does your team care about? Encode the decision, don't tune to a metric.",
      }),
    },
    {
      stepNumber: 2,
      title: "Faithfulness via token overlap against source",
      instructionMd:
        "Write `scoring/faithfulness.py` exposing `faithfulness(output: str, source: str) -> float`. Tokenize both to lowercase word-set (`re.findall(r'\\b[a-z]{3,}\\b', s.lower())`) — words of 3+ letters, ignoring punctuation. Return the fraction of OUTPUT tokens that also appear in SOURCE: `len(output_tokens & source_tokens) / len(output_tokens)` (or 0.0 if output_tokens is empty). Validator runs on 4 fixture (output, source, expected_score) triples covering: fully-grounded (=1.0), half-grounded (~0.5), zero-grounded (=0.0), empty-output (=0.0).",
      learningObjective:
        "Token-overlap is the cheap deterministic faithfulness heuristic. It catches the worst hallucinations (output asserts entities never in source) without an LLM-as-judge round-trip. Calibrated, it correlates ~0.6 with human ratings — enough to flag the worst 20%.",
      requiredSkill: "regex tokenisation + set intersection + edge cases (empty output → 0.0, not div-by-zero)",
      starterCode: SRC(`# scoring/faithfulness.py
import re

WORD_RE = re.compile(r"\\b[a-z]{3,}\\b")

def _tokenise(s: str) -> set[str]:
    return set(WORD_RE.findall(s.lower()))

def faithfulness(output: str, source: str) -> float:
    out_tokens = _tokenise(output)
    src_tokens = _tokenise(source)
    if not out_tokens:
        return 0.0
    # TODO: return |out & src| / |out|
    return 0.0
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "faithfulness scorer on 4 fixture triples: full-grounded output → 1.0; half-grounded → ~0.5 (±0.05); zero-grounded → 0.0; empty output → 0.0.", {
        expected: {
          fullyGrounded: 1.0,
          halfGroundedApprox: 0.5,
          halfGroundedTolerance: 0.05,
          zeroGrounded: 0.0,
          emptyOutput: 0.0,
        },
      }),
      expectedOutputs: { scorerDeterministic: true, edgeCasesHandled: 4 },
      datasetRefs: ["fixtures/faithfulness_triples.jsonl"],
      pedagogy: pedagogyConfig({
        hints: [
          "Tokenise to a SET, not a list — duplicate words shouldn't inflate the overlap.",
          "Filter to length ≥ 3 strips noise words ('the', 'and', 'a') that match anything.",
          "Always guard `len(out_tokens) == 0` first — div-by-zero on an empty output gives NaN, not 0.0.",
          "Be explicit: this scores OUTPUT-side coverage (what fraction of what the LLM said is grounded). The reverse direction (source recall) is a different metric.",
          "return len(out_tokens & src_tokens) / len(out_tokens)",
        ],
        successFeedback: "Faithfulness is now deterministic and cheap. It catches the worst hallucinations (named entities not in source) without an LLM round-trip.",
        failureFeedback: "Common slips: tokenising into a list (duplicate words inflate score); not lowercasing (case-sensitive overlap misses obvious matches); dividing by source size (measures recall, not faithfulness).",
        portfolioRelevance: "A 5-line faithfulness scorer with a 4-row fixture test is the most-replicated 'I understand grounding' artefact. Pin the fixture in the README.",
        finalExplanation: "Token overlap is the floor. Real faithfulness is harder (semantic equivalence, paraphrase tolerance) — but a deterministic floor that catches the worst 20% is more useful than a perfect scorer that nobody actually runs.",
        misconceptionToWatchFor: "Believing 'token overlap is too dumb to ship'. The dumb version that runs in 5ms in CI beats the smart version that needs an API call every prompt.",
      }),
    },
    {
      stepNumber: 3,
      title: "JSON-schema format with three-region partial credit",
      instructionMd:
        "Write `scoring/format.py` exposing `format_score(output: str, schema: dict) -> float`. Try `json.loads(output)`; on JSONDecodeError → return 0.0. On success, validate with `jsonschema.Draft202012Validator(schema).validate(parsed)`: if it passes → 1.0; if it fails, inspect the error — if every error is `extra_keys` (unexpected properties on an object) → 0.5 (parseable + structurally close, just over-spec); any other error → 0.0. Validator runs on 4 fixture outputs against a `{type: object, properties: {name, age}, required: [name, age], additionalProperties: false}` schema: clean output → 1.0; output with extra `nickname` field → 0.5; output missing `age` → 0.0; non-JSON output → 0.0.",
      learningObjective:
        "Three-region format scoring (clean/extra-keys/broken) is the realistic compromise. Binary pass/fail penalises 'almost right' too harshly; floating-point free-form is gameable. The middle 0.5 region encodes 'easy to fix downstream'.",
      requiredSkill: "json.loads exception handling + jsonschema validator iteration + error-class introspection (additionalProperties vs required vs type)",
      starterCode: SRC(`# scoring/format.py
import json
from jsonschema import Draft202012Validator

def format_score(output: str, schema: dict) -> float:
    try:
        parsed = json.loads(output)
    except json.JSONDecodeError:
        return 0.0
    validator = Draft202012Validator(schema)
    errors = list(validator.iter_errors(parsed))
    if not errors:
        return 1.0
    # TODO: if EVERY error is an additionalProperties violation → return 0.5
    # TODO: any other error class (required, type, enum, ...) → return 0.0
    return 0.0
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "format_score on 4 fixture outputs against the {name, age, additionalProperties:false} schema: clean → 1.0; extra-keys-only → 0.5; missing required → 0.0; non-JSON → 0.0.", {
        expected: {
          clean: 1.0,
          extraKeysOnly: 0.5,
          missingRequired: 0.0,
          nonJson: 0.0,
        },
      }),
      expectedOutputs: { regions: 3, fixtureCases: 4 },
      datasetRefs: ["fixtures/format_outputs.jsonl"],
      pedagogy: pedagogyConfig({
        hints: [
          "jsonschema's `iter_errors` returns an iterator — list it once if you need to inspect twice (it's single-use).",
          "Each error has a `.validator` attribute naming the keyword that failed (`'additionalProperties'`, `'required'`, `'type'`, etc.) — that's how you classify.",
          "All-extra-keys: `all(e.validator == 'additionalProperties' for e in errors)`. Any other → 0.0.",
          "Be strict about the partial-credit gate: ONLY additionalProperties qualifies for 0.5; missing required is a real broken contract, deserves 0.0.",
          "if all(e.validator == 'additionalProperties' for e in errors): return 0.5",
        ],
        successFeedback: "Format scoring now distinguishes 'structurally close' from 'actually broken' — the partial-credit signal lets downstream pipelines decide whether to auto-fix vs. reject.",
        failureFeedback: "Common slips: collapsing to binary (loses the 'almost-right' signal); awarding partial credit for type errors (a `string` where `int` is expected is broken, not close); using `validate()` which raises on first error (loses the full error list needed for classification).",
        portfolioRelevance: "Three-region format scoring with an explicit partial-credit rule is the kind of nuanced decision reviewers expect at mid-level. Show the 4-row fixture matrix in the README.",
        finalExplanation: "JSON-schema validation is the cheap, deterministic 'does this output match the contract' check. Partial credit is the encoded judgement about what 'almost right' is worth — make it explicit, document it, and stop arguing about it.",
        misconceptionToWatchFor: "Believing format scoring is 'just regex / JSON.parse'. A real format scorer encodes a partial-credit policy — that policy IS the product decision.",
      }),
    },
    {
      stepNumber: 4,
      title: "Failure taxonomy — 6-class classifier from rubric subscores",
      instructionMd:
        "Write `scoring/taxonomy.py` exposing `classify_failure(per_dim: dict[str, float], expected_refusal: bool, output_text: str) -> str` returning one of: `clean` (every dim ≥ 0.8), `hallucination` (faithfulness < 0.4), `off_format` (format < 0.5), `refused_correctly` (output starts with 'I cannot' AND expected_refusal=True), `over_refusal` (output starts with 'I cannot' AND expected_refusal=False), `instruction_violation` (instruction_following < 0.5 AND none of the above fired). Decision order matters: check `clean` first, then `hallucination`, then `off_format`, then refusal branches, then `instruction_violation`. Validator runs on 6 labelled fixtures covering each class.",
      learningObjective:
        "A deterministic failure-mode classifier (rule-based, NOT LLM-as-judge) turns rubric subscores into actionable categories. The decision-order is the product policy.",
      requiredSkill: "ordered if/elif decision tree + multi-condition branching + edge case for refusal-detection prefix",
      starterCode: SRC(`# scoring/taxonomy.py
REFUSAL_PREFIX = "i cannot"

def _is_refusal(output: str) -> bool:
    return output.strip().lower().startswith(REFUSAL_PREFIX)

def classify_failure(per_dim: dict[str, float], expected_refusal: bool, output_text: str) -> str:
    # TODO order:
    #   1) all(score >= 0.8 for score in per_dim.values()) → 'clean'
    #   2) per_dim['faithfulness'] < 0.4 → 'hallucination'
    #   3) per_dim['format'] < 0.5 → 'off_format'
    #   4) _is_refusal(output_text) and expected_refusal → 'refused_correctly'
    #   5) _is_refusal(output_text) and not expected_refusal → 'over_refusal'
    #   6) per_dim['instruction_following'] < 0.5 → 'instruction_violation'
    #   default → 'clean' (subtly imperfect but no named failure)
    return "clean"
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "On 6 labelled fixtures the classifier returns the expected class for each: clean, hallucination, off_format, refused_correctly, over_refusal, instruction_violation.", {
        expected: {
          fixtureCount: 6,
          allClassesCovered: ["clean", "hallucination", "off_format", "refused_correctly", "over_refusal", "instruction_violation"],
          decisionOrderRespected: true,
        },
      }),
      expectedOutputs: { classes: 6, classifierDeterministic: true },
      datasetRefs: ["fixtures/taxonomy_labelled.jsonl"],
      pedagogy: pedagogyConfig({
        hints: [
          "Decision order is product policy: hallucination beats off_format beats refusal — because hallucination is the worst-case for trust.",
          "Refusal detection on prefix is intentionally cheap. Real systems add canary phrases per model family; this is the floor.",
          "Test EVERY class. A taxonomy with an unreachable branch is a taxonomy with a bug.",
          "`expected_refusal` comes from the prompt's labelled intent — sensitive prompts where refusal IS the right answer.",
          "if all(v >= 0.8 for v in per_dim.values()): return 'clean'\\nif per_dim['faithfulness'] < 0.4: return 'hallucination'",
        ],
        successFeedback: "Failure taxonomy now turns rubric scores into actionable buckets — the histogram across the corpus tells you what to fix next.",
        failureFeedback: "Common slips: checking refusal before hallucination (a hallucinated refusal stays in the wrong bucket); using 'or' instead of explicit if/elif (multiple classes for one output); silently returning None for unhandled cases (lose data).",
        portfolioRelevance: "A README block showing the corpus's failure-mode histogram (e.g. '12% hallucination, 5% off_format, 3% over_refusal') is the closing argument. Reviewers see PRIORITIES, not just scores.",
        finalExplanation: "Scoring tells you HOW MUCH is wrong; taxonomy tells you WHAT is wrong. Without the taxonomy, your team argues about whether the score went up 'because of the right reasons'.",
        misconceptionToWatchFor: "Believing the taxonomy needs an LLM-as-judge. For most cases the deterministic rule-based version is faster, cheaper, and reproducible — and you can always add a judge later for the residual.",
      }),
    },
    {
      stepNumber: 5,
      title: "Corpus rollup — score_corpus → reports/quality.json",
      instructionMd:
        "Write `scoring/corpus.py` exposing `score_corpus(fixtures_path: str, rubric: Rubric, schema: dict, out_path: str) -> dict`. Read `fixtures/outputs.jsonl` (each line has `prompt_id`, `output`, `source_doc_id`, `expected_refusal`, `expected_schema_id`). For each row: score every dimension, compute overall, classify failure mode. Write `out_path` with `{prompts: [...], summary: {count, mean_overall, p10_overall, failure_histogram: {clean: N, hallucination: N, ...}}}`. Return the summary dict. Validator runs on the 20-row fixture and asserts `count=20, mean_overall=0.72, p10_overall=0.31` and the failure_histogram has all 6 keys with the expected per-class counts.",
      learningObjective:
        "Corpus rollup turns per-prompt scores into a one-glance report. Mean is the headline; p10 catches the tail; failure histogram says what to fix. Three numbers + a histogram is a complete signal.",
      requiredSkill: "jsonl iteration + per-row dispatch through the rubric + statistics.quantiles + collections.Counter + structured JSON write",
      starterCode: SRC(`# scoring/corpus.py
import json, statistics
from collections import Counter
from .rubric import Rubric
from .faithfulness import faithfulness
from .format import format_score
from .taxonomy import classify_failure

# Refusal scorer is deterministic too: 1.0 if (refused & expected) or (not refused & not expected), else 0.0.
def refusal_score(output: str, expected_refusal: bool) -> float:
    refused = output.strip().lower().startswith("i cannot")
    return 1.0 if refused == expected_refusal else 0.0

# Instruction-following: 1.0 if output length is in [50, 800] chars, else 0.5.
# A real scorer would parse instruction constraints from the prompt; this is the floor.
def instruction_following(output: str) -> float:
    return 1.0 if 50 <= len(output) <= 800 else 0.5

def score_corpus(fixtures_path: str, rubric: Rubric, schema: dict, out_path: str) -> dict:
    sources: dict[str, str] = json.load(open("fixtures/source_docs/index.json"))
    rows = []
    overalls = []
    failures = Counter()
    with open(fixtures_path) as f:
        for line in f:
            r = json.loads(line)
            source = sources.get(r["source_doc_id"], "")
            per_dim = {
                "faithfulness": faithfulness(r["output"], source),
                "format": format_score(r["output"], schema),
                "refusal_handling": refusal_score(r["output"], r["expected_refusal"]),
                "instruction_following": instruction_following(r["output"]),
            }
            scored = rubric.score(per_dim)
            cls = classify_failure(per_dim, r["expected_refusal"], r["output"])
            rows.append({"prompt_id": r["prompt_id"], "per_dim": per_dim, "overall": scored.overall, "failure_class": cls})
            overalls.append(scored.overall)
            failures[cls] += 1
    summary = {
        "count": len(rows),
        "mean_overall": round(statistics.mean(overalls), 4) if overalls else 0.0,
        "p10_overall": round(statistics.quantiles(overalls, n=10)[0], 4) if len(overalls) >= 10 else 0.0,
        "failure_histogram": dict(failures),
    }
    with open(out_path, "w") as out:
        json.dump({"prompts": rows, "summary": summary}, out, indent=2)
    return summary
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "score_corpus on the 20-row fixture produces summary {count: 20, mean_overall: 0.72, p10_overall: 0.31, failure_histogram: {clean: 12, hallucination: 3, off_format: 2, refused_correctly: 1, over_refusal: 1, instruction_violation: 1}}.", {
        expected: {
          count: 20,
          mean_overall_approx: 0.72,
          mean_overall_tolerance: 0.02,
          p10_overall_approx: 0.31,
          p10_overall_tolerance: 0.05,
          failure_histogram_keys: ["clean", "hallucination", "off_format", "refused_correctly", "over_refusal", "instruction_violation"],
        },
      }),
      expectedOutputs: {
        corpusCount: 20,
        meanOverall: 0.72,
        histogramComplete: true,
      },
      datasetRefs: ["fixtures/outputs.jsonl", "fixtures/source_docs/index.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "`statistics.quantiles(values, n=10)` returns 9 cut-points; index 0 is the p10 (the value below which 10% of the data falls).",
          "`collections.Counter` is the lazy histogram — `Counter()` + `counter[key] += 1` works on first-touch keys without KeyError.",
          "Write with `indent=2` for human-readable diffs in CI — `quality.json` will be reviewed by humans, not just consumed by code.",
          "Include the per-prompt rows AND the summary — the histogram is the headline, the per-prompt rows are the drill-down.",
          "with open(out_path, 'w') as out: json.dump({'prompts': rows, 'summary': summary}, out, indent=2)",
        ],
        successFeedback: "Corpus rollup is now a one-file report a reviewer can open and triage in 30 seconds — mean for the headline, p10 for the tail, histogram for the priorities.",
        failureFeedback: "Common slips: only writing the summary (loses drill-down); only writing per-prompt rows (no rollup, reviewer has to compute mean themselves); using `mean()` without guarding empty list (divides by zero).",
        portfolioRelevance: "Pin the sample `quality.json` in your repo's README. A reviewer who can scan it in 30 seconds and understand 'this scorer surfaced 3 hallucinations + 2 format breaks + 1 over-refusal' is sold on your engineering taste.",
        finalExplanation: "The whole library exists to produce THIS file. Every other piece (rubric, dimension scorers, taxonomy) plugs into the corpus rollup; the rollup is the contract with the rest of the eval / CI stack.",
        misconceptionToWatchFor: "Believing the report is a side effect. The report IS the product — the scoring code exists to produce a reviewable artefact, not to print metrics.",
      }),
    },
  ],
};
