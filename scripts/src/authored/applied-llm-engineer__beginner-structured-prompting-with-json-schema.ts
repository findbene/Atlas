/**
 * Phase 19 — applied-llm-engineer beginner seed (net-new). Closes the
 * Start Here gap for one of the four zero-beginner courses surfaced by
 * Phase 18.
 *
 * Candidate a19e5f8b-2c3d-4e4f-8a6b-7c8d9e0f1234 — the foundational
 * applied-LLM move: take an unstructured task ("extract product fields
 * from a review") and turn it into a STRUCTURED, validated, evaluable
 * pipeline. Five steps: (1) define a Pydantic schema, (2) write a
 * one-shot prompt, (3) call the model + parse JSON (using a deterministic
 * fixture-mock so this project runs with ZERO API credentials), (4)
 * validate parsed output against the schema + route rejects, (5) score
 * against a 10-row gold-labelled eval set and write a tiny report.md.
 *
 * The "credential-free" choice is deliberate: it lets a beginner internalise
 * the schema → prompt → validate → eval loop before adding the moving part
 * of "and now your provider rate-limited you". Swapping the mock for a real
 * Anthropic / OpenAI call is a one-line change in step 3, called out in the
 * README.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const appliedLlmEngineerBeginnerStructuredPromptingWithJsonSchema: AuthoredProject = {
  slug: "applied-llm-engineer-beginner-structured-prompting-with-json-schema",
  candidateId: "a19e5f8b-2c3d-4e4f-8a6b-7c8d9e0f1234",
  title: "Structured Prompting with JSON Schema (Beginner Applied-LLM) — Schema → Prompt → Validate → Eval",
  shortDescription:
    "Build the foundational applied-LLM loop: define a Pydantic schema for the output you want, write a one-shot prompt that requests JSON matching that schema, parse + validate the model response (routing failures to rejects), then score the whole pipeline against a 10-row gold-labelled eval set and write a report.md. Runs with ZERO API credentials — a deterministic fixture-mock LLM ships with the project; swapping in Anthropic / OpenAI is a one-line edit.",
  fullDescription:
    "The single move that turns 'I prompted ChatGPT' into 'I shipped an LLM pipeline' is making the output STRUCTURED, VALIDATED, and EVALUABLE. This project teaches that move on the canonical applied-LLM task: extract product fields (name, brand, rating_out_of_5, sentiment) from a free-form product review. You'll write a Pydantic schema for the output, a one-shot prompt that requests JSON matching that schema, a tolerant JSON parser that survives stray markdown fences, a validator that splits valid outputs from rejects, and a tiny eval harness that scores against a 10-row gold-labelled fixture and writes a `report.md`. The whole project runs with ZERO API credentials — a deterministic fixture-mock LLM ships in `src/llm_mock.py`. Swapping it for a real Anthropic / OpenAI call is a one-line change, called out in the README. This is the foundational beginner-applied-LLM artefact: short enough to ship in an afternoon, structured enough that a reviewer immediately knows you understand the schema → prompt → validate → eval loop.",
  language: "python",
  difficulty: "beginner",
  techStack: ["Python", "Pydantic", "JSON Schema"],
  tags: ["applied-llm-engineer", "beginner", "structured-output", "pydantic", "json-schema", "eval"],
  learningObjectives: [
    "Define a Pydantic v2 `BaseModel` for an LLM's structured output (name, brand, rating, sentiment) and emit its JSON schema with `.model_json_schema()`.",
    "Write a one-shot prompt with system + user + a single `{schema}` placeholder; understand why one-shot beats zero-shot for JSON adherence.",
    "Parse a model response tolerantly: strip ```json fences, attempt `json.loads`, surface failures as parse errors (not exceptions).",
    "Validate parsed JSON against the Pydantic schema; route valid → results, route invalid → rejects with `reason`.",
    "Score the full pipeline against a 10-row gold-labelled eval fixture (accuracy per field + exact-match) and write a `report.md`.",
  ],
  estimatedMinutes: 165,
  xpReward: 495,
  isMultiFile: false,
  meta: projectMeta({
    scenario:
      "Junior applied-LLM candidate at a 2026 e-commerce platform. The product team wants to extract structured attributes (brand, rating, sentiment) from free-text product reviews so the search team can facet on them. You build the canonical extraction pipeline — schema → prompt → validate → eval — entirely locally with a deterministic fixture-mock LLM, prove the loop end-to-end against a 10-row gold set, and the same code swaps to a real provider with a 1-line edit.",
    hiringRelevance2026:
      "Structured-output extraction with schema validation + a tiny eval harness is *the* foundational applied-LLM screen in 2026. Reviewers want to see the four-piece loop (schema, prompt, validator, eval) in a small, runnable repo with NO API key in the README — that proves you've internalised the discipline, not just played with a UI.",
    readmeOutline: [
      "Overview — schema/prompt/validate/eval loop",
      "Setup (uv or pip install pydantic)",
      "Step 1: define the Pydantic output schema",
      "Step 2: write the one-shot prompt with {schema}",
      "Step 3: call the mock LLM + parse JSON tolerantly",
      "Step 4: validate against schema + route rejects",
      "Step 5: 10-row gold eval + report.md",
      "Portfolio Hand-off (swap mock → real provider in 1 line)",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo: `src/schema.py` (Pydantic ReviewExtract model), `src/prompt.py` (system+user template with {schema}), `src/llm_mock.py` (deterministic fixture-mock; returns canned JSON keyed by review hash), `src/pipeline.py` (parse + validate + reject routing), `src/eval.py` (10-row scoring + report writer), `fixtures/reviews_gold.jsonl`, `fixtures/mock_responses.json`, `report_expected.md`, `tests/test_pipeline.py`. README must call out the one-line mock→real swap.",
    portfolioRelevance:
      "The strongest beginner applied-LLM portfolio piece is a small, RUNNABLE, eval-backed pipeline — not a notebook of curl commands. A reviewer who clones and runs `pytest` and sees a green eval report in 30 seconds (no API key required) immediately trusts the rest of your applied-LLM judgement.",
    repoUrl: "https://github.com/<your-handle>/applied-llm-beginner-structured-prompting",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Define the output schema — Pydantic v2 BaseModel",
      instructionMd:
        "Write `src/schema.py` with a Pydantic v2 `ReviewExtract(BaseModel)` model: `name: str`, `brand: str`, `rating_out_of_5: float = Field(ge=0, le=5)`, `sentiment: Literal['positive','neutral','negative']`. Then expose `ReviewExtract.model_json_schema()` (Pydantic v2 method — emits a JSON Schema dict). Why: the schema is the contract the LLM must satisfy AND the contract your downstream code can rely on — one definition, two consumers.",
      learningObjective:
        "Pydantic v2 model = your single source of truth for output structure. `.model_json_schema()` turns it into the JSON-Schema dict the prompt + validator both consume.",
      requiredSkill: "Pydantic v2 BaseModel + Field constraints + Literal + model_json_schema()",
      starterCode: SRC(`# src/schema.py
from typing import Literal
from pydantic import BaseModel, Field

class ReviewExtract(BaseModel):
    # TODO: name: str, brand: str
    # TODO: rating_out_of_5: float = Field(ge=0, le=5)
    # TODO: sentiment: Literal['positive', 'neutral', 'negative']
    pass

def output_json_schema() -> dict:
    # TODO: return ReviewExtract.model_json_schema()
    return {}
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "ReviewExtract has the 4 required fields with correct types; rating_out_of_5 has ge=0/le=5 constraints; sentiment is a Literal of {positive, neutral, negative}; model_json_schema() returns a dict with 'properties' for all 4 fields.", {
        expected: {
          requiredFields: ["name", "brand", "rating_out_of_5", "sentiment"],
          ratingRangeEnforced: true,
          sentimentIsEnum: true,
          schemaHasAllProperties: true,
        },
      }),
      expectedOutputs: { schemaDefined: true, constraintsPresent: true },
      datasetRefs: [],
      pedagogy: pedagogyConfig({
        hints: [
          "Pydantic v2: `from pydantic import BaseModel, Field` then `class X(BaseModel):` with type-annotated class attributes.",
          "Range constraints: `Field(ge=0, le=5)` (greater-equal / less-equal). These also appear in the emitted JSON Schema so the LLM sees them.",
          "`Literal['a','b','c']` from `typing` becomes an `enum` in the emitted JSON Schema — far cleaner than a free-form `str`.",
          "Pydantic v2 uses `.model_json_schema()` (NOT v1's `.schema()`). If the call errors, you're on v1 — `pip install -U pydantic`.",
          "rating_out_of_5: float = Field(ge=0, le=5)",
        ],
        successFeedback:
          "Schema defined with constraints + enum — one source of truth for both the prompt instruction and the downstream validator.",
        failureFeedback:
          "Most common slips: forgetting `Field(ge=, le=)` (LLM happily returns rating=7.5 and your validator passes it); using `str` instead of `Literal` for sentiment (LLM returns 'mixed' and your validator passes it); calling `.schema()` (Pydantic v1 method, removed in v2).",
        portfolioRelevance:
          "A Pydantic schema file in your repo is the first thing a reviewer opens — strong typing + explicit constraints there sets the tone for the rest of the project.",
        finalExplanation:
          "Schema-first design = the contract is explicit, the LLM gets a precise spec, the validator gets a precise spec, and they're literally the same spec. This is the foundational discipline of applied-LLM work.",
        misconceptionToWatchFor:
          "Believing 'the LLM will figure out a reasonable structure on its own'. It might — for one example. By example 100 it will have invented 3 incompatible structures.",
      }),
    },
    {
      stepNumber: 2,
      title: "Write the one-shot prompt — system + user + {schema} placeholder",
      instructionMd:
        "Write `src/prompt.py` exposing `build_prompt(review_text: str, schema: dict) -> tuple[str, str]` returning `(system_msg, user_msg)`. System message: terse instruction (\"You extract structured fields. Return ONLY a JSON object matching the schema. No prose, no markdown fences.\"). User message: the schema (as `json.dumps(schema, indent=2)`), then a one-shot example (a SHORT review + the JSON answer it should produce), then the actual review. Why one-shot not zero-shot: a single demonstration of a parseable JSON answer dramatically improves JSON-adherence on small models and costs almost nothing.",
      learningObjective:
        "Prompt structure: (1) terse system role, (2) the schema verbatim in the user message, (3) one-shot example, (4) the input. This four-block structure is the boring-but-reliable starting point.",
      requiredSkill: "Multi-line f-string prompt template + json.dumps formatting + one-shot example pattern",
      starterCode: SRC(`# src/prompt.py
import json

SYSTEM_MSG = (
    "You extract structured fields from product reviews. "
    "Return ONLY a JSON object matching the schema. "
    "No prose, no markdown fences, no explanation."
)

ONE_SHOT_REVIEW = "Loved the Acme Pro headphones — 5 stars, super comfortable!"
ONE_SHOT_ANSWER = {
    "name": "Pro headphones",
    "brand": "Acme",
    "rating_out_of_5": 5.0,
    "sentiment": "positive",
}

def build_prompt(review_text: str, schema: dict) -> tuple[str, str]:
    # TODO: user_msg includes (1) json.dumps(schema, indent=2),
    #       (2) the one-shot example as "Review: ... -> JSON: ...",
    #       (3) the actual review_text under "Now extract from this review:"
    user_msg = ""
    return SYSTEM_MSG, user_msg
`),
      validationType: "contains",
      stepType: "code_python",
      validation: validationConfig("contains", "build_prompt returns (system_msg, user_msg) where user_msg contains the formatted schema, the one-shot example, AND the review_text. system_msg explicitly forbids markdown fences.", {
        userMsgMustContain: ["properties", "Acme", "Now extract"],
        systemMsgMustContain: ["JSON object", "No prose"],
        returnsTuple: true,
      }),
      expectedOutputs: { promptBuilt: true, oneShotIncluded: true, schemaEmbedded: true },
      datasetRefs: [],
      pedagogy: pedagogyConfig({
        hints: [
          "Two-string return: `return SYSTEM_MSG, user_msg` — system stays constant, user is built per call.",
          "Embed the schema verbatim with `json.dumps(schema, indent=2)` — readable for the model AND for you when debugging.",
          "One-shot = exactly ONE example. Two-shot is fine but rapidly overfit. Zero-shot drops JSON-adherence on small models.",
          "Anti-markdown-fence in system msg is a real defence — models love to wrap JSON in ```json...``` even when told not to.",
          'f"""Schema:\\n{json.dumps(schema, indent=2)}\\n\\nExample:\\nReview: {ONE_SHOT_REVIEW}\\nJSON: {json.dumps(ONE_SHOT_ANSWER)}\\n\\nNow extract from this review:\\n{review_text}"""',
        ],
        successFeedback:
          "Four-block prompt: system + schema + one-shot + input. Boring, reliable, debuggable.",
        failureFeedback:
          "Most common slips: skipping the one-shot (JSON-adherence drops on smaller models); forgetting the anti-markdown-fence instruction (model wraps your JSON, parser breaks); embedding the schema as a description (lose precision — embed the actual JSON Schema dict).",
        portfolioRelevance:
          "A `prompt.py` with a clear 4-block template + a comment explaining each block is one of the most-screened files in a reviewer's first 5 minutes — it shows you think about prompts as code, not as art.",
        finalExplanation:
          "Prompts are templates with structure. The structure isn't ceremony — every block does a specific job, and skipping one degrades a specific failure mode.",
        misconceptionToWatchFor:
          "Believing prompt engineering is 'just rephrasing the question'. The reliability gains come from structure (one-shot, schema embedding, anti-fence guard), not from clever phrasing.",
      }),
    },
    {
      stepNumber: 3,
      title: "Call the mock LLM + tolerant JSON parsing",
      instructionMd:
        "Write `src/llm_mock.py` exposing `call_llm(system_msg: str, user_msg: str) -> str` that returns a canned response keyed by a SHA1 of `user_msg` (looking up `fixtures/mock_responses.json`). This is deterministic — same input, same output, no API key. Then write `src/pipeline.py::parse_response(raw: str) -> tuple[dict | None, str | None]`: tolerantly parse a model response — strip leading/trailing whitespace, strip ```json ... ``` fences if present, attempt `json.loads`. Return `(parsed_dict, None)` on success or `(None, error_msg)` on failure. NEVER raise — bad JSON is data, not an exception.",
      learningObjective:
        "Tolerant parsing = strip predictable wrappers (whitespace, code fences), attempt parse, return errors as values (not exceptions).",
      requiredSkill: "Tolerant string preprocessing + json.loads + tuple-of-(value, error) error handling",
      starterCode: SRC(`# src/llm_mock.py
import hashlib, json
from pathlib import Path

_RESPONSES = json.loads(Path("fixtures/mock_responses.json").read_text())

def call_llm(system_msg: str, user_msg: str) -> str:
    key = hashlib.sha1(user_msg.encode("utf-8")).hexdigest()
    # Deterministic: look up the canned response by user_msg hash.
    # Real providers would replace this with an HTTP call.
    return _RESPONSES.get(key, '{"_error": "no_mock_for_this_input"}')


# src/pipeline.py
import json, re

_FENCE_RE = re.compile(r"^\\s*\`\`\`(?:json)?\\s*|\\s*\`\`\`\\s*$", re.MULTILINE)

def parse_response(raw: str) -> tuple[dict | None, str | None]:
    # TODO: strip whitespace; strip \`\`\`json ... \`\`\` fences if present;
    #       json.loads; return (dict, None) or (None, "bad_json: <msg>")
    return None, "not_implemented"
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "parse_response strips code fences and whitespace; valid JSON returns (dict, None); invalid JSON returns (None, 'bad_json: ...'); NEVER raises.", {
        expected: {
          parsesPlainJson: true,
          parsesFencedJson: true,
          returnsErrorOnBadJson: true,
          neverRaises: true,
        },
      }),
      expectedOutputs: { mockCallable: true, parseTolerant: true },
      datasetRefs: ["fixtures/mock_responses.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "SHA1-of-prompt as the mock key makes the mock deterministic AND prompt-sensitive — change the prompt, get a different response (or a 'no_mock' marker).",
          "Strip fences with a regex applied at start AND end: `^\\s*```(?:json)?\\s*|\\s*```\\s*$` (multiline). Models love ```json``` wrappers.",
          "Always wrap `json.loads(s)` in try/except and return `(None, f'bad_json: {e}')` — bad JSON is expected data, not an exceptional event.",
          "Tuple-of-(value, error) is the boring-and-correct way to surface parse failures up the stack without using exceptions for control flow.",
          "try: return json.loads(_FENCE_RE.sub('', raw).strip()), None  except json.JSONDecodeError as e: return None, f'bad_json: {e}'",
        ],
        successFeedback:
          "Mock LLM is deterministic and parsing is tolerant — your pipeline now has a reproducible LLM substrate and a parse layer that doesn't blow up on the most-common failure modes.",
        failureFeedback:
          "Most common slips: letting json.loads raise (your eval harness crashes on the first bad response); not stripping code fences (the model's most-common 'helpful' addition breaks every parse); using a non-deterministic mock (your tests flake).",
        portfolioRelevance:
          "The combination of (deterministic mock) + (tolerant parser) is the difference between a demo that works once and a pipeline a reviewer can clone and trust. Pin both files in the README.",
        finalExplanation:
          "Two disciplines fuse here: deterministic LLM substrate (so tests are reproducible) and tolerant parsing (so the most-common failure mode is data, not crash). Both are required for an applied pipeline; neither is optional.",
        misconceptionToWatchFor:
          "Believing 'the LLM will return clean JSON if I ask nicely'. It mostly will. The mostly is what kills production pipelines.",
      }),
    },
    {
      stepNumber: 4,
      title: "Validate against schema + route rejects",
      instructionMd:
        "Extend `src/pipeline.py` with `extract(review_text: str) -> tuple[dict | None, str | None]`: builds the prompt, calls `call_llm`, parses, then validates against `ReviewExtract`. Returns `(valid_dict, None)` on success (where `valid_dict` is the Pydantic model's `.model_dump()`). On any failure — bad JSON or schema-validation failure — returns `(None, reason)` where reason is one of `'bad_json: ...'` or `'schema_invalid: ...'`. Then `run_batch(reviews: list[str]) -> tuple[list[dict], list[dict]]` returns `(results, rejects)` where each reject is `{'review': '...', 'reason': '...'}`. Why: this two-list-output is the exact same pattern as a CSV cleanup pipeline — valid rows + reject rows + a reason.",
      learningObjective:
        "Schema validation = Pydantic `ReviewExtract.model_validate(d)` inside try/except. Reject routing = same pattern as Phase-14 CSV pipeline (valid + reject + reason).",
      requiredSkill: "Pydantic model_validate inside try/except + tuple-of-lists batch return",
      starterCode: SRC(`# src/pipeline.py (continued)
from pydantic import ValidationError
from src.schema import ReviewExtract, output_json_schema
from src.prompt import build_prompt
from src.llm_mock import call_llm

def extract(review_text: str) -> tuple[dict | None, str | None]:
    sys_msg, user_msg = build_prompt(review_text, output_json_schema())
    raw = call_llm(sys_msg, user_msg)
    parsed, parse_err = parse_response(raw)
    if parse_err:
        return None, parse_err
    # TODO: try ReviewExtract.model_validate(parsed); on ValidationError return ("schema_invalid: <msg>")
    return None, "not_implemented"

def run_batch(reviews: list[str]) -> tuple[list[dict], list[dict]]:
    results, rejects = [], []
    for r in reviews:
        out, err = extract(r)
        if err:
            rejects.append({"review": r, "reason": err})
        else:
            results.append(out)
    return results, rejects
`),
      validationType: "json_equal",
      stepType: "code_python",
      validation: validationConfig("json_equal", "extract returns (model_dump, None) on success; returns (None, 'schema_invalid: ...') on a parsed-but-invalid response (e.g. rating=7.5); run_batch partitions a list exhaustively into results + rejects with reasons.", {
        expected: {
          extractReturnsModelDump: true,
          extractReturnsSchemaInvalidOnBadField: true,
          runBatchPartitionExhaustive: true,
          rejectHasReason: true,
        },
      }),
      expectedOutputs: { validatorWired: true, rejectRoutingWorks: true },
      datasetRefs: ["fixtures/reviews_gold.jsonl"],
      pedagogy: pedagogyConfig({
        hints: [
          "`ReviewExtract.model_validate(d)` (Pydantic v2) parses + validates a dict; raises `ValidationError` on failure.",
          "On `ValidationError as e`, return `(None, f'schema_invalid: {e.errors()[0][\"msg\"]}')` — take only the first error for a short reason string.",
          "On success, return `(model.model_dump(), None)` — convert the Pydantic instance back to a plain dict for uniform downstream handling.",
          "run_batch is just a loop — keep it dumb. The intelligence lives in `extract`, which already returns the (value, error) tuple.",
          "try: m = ReviewExtract.model_validate(parsed); return m.model_dump(), None  except ValidationError as e: return None, f'schema_invalid: {e.errors()[0][\"msg\"]}'",
        ],
        successFeedback:
          "Validation + reject routing — your pipeline now produces both a results list (clean) and a rejects list (with reason). This is what separates an LLM pipeline from an LLM script.",
        failureFeedback:
          "Most common slips: forgetting try/except around `model_validate` (one bad response crashes the whole batch); silently dropping rejects (no audit trail when accuracy drops next week); returning the Pydantic INSTANCE instead of `.model_dump()` (downstream JSON serialisation surprises).",
        portfolioRelevance:
          "A README screenshot showing both `results.json` AND `rejects.json` with reasons — same pattern reviewers know from data-cleaning pipelines — is hiring-manager catnip.",
        finalExplanation:
          "An applied-LLM pipeline produces two streams: valid structured outputs (for downstream systems) and reject records with reasons (for the humans who maintain it). Anything else is data loss.",
        misconceptionToWatchFor:
          "Believing 'if it parses as JSON, it's valid'. Schema validation is a separate discipline — JSON validity says the shape is parseable; schema validity says the semantics match.",
      }),
    },
    {
      stepNumber: 5,
      title: "10-row gold eval + report.md",
      instructionMd:
        "Write `src/eval.py::run_eval()` that: (1) loads `fixtures/reviews_gold.jsonl` (10 rows of `{review, expected}`), (2) calls `run_batch` on the reviews, (3) for each (predicted, expected) computes per-field exact-match (name, brand, rating_out_of_5 within ±0.5, sentiment exact), (4) writes `report.md` with: total cases, # rejects (with reasons), per-field accuracy as a markdown table, and exact-match-row count. Why a 10-row gold eval at the beginner tier: small enough to hand-label, large enough to spot a regression, big enough to compute meaningful per-field accuracy.",
      learningObjective:
        "A tiny gold-labelled eval set + a per-field accuracy report = the difference between 'I changed the prompt and it feels better' and 'I changed the prompt and accuracy went 70%→85% on the 10-row gold'.",
      requiredSkill: "JSONL parse + per-field scoring + numeric tolerance + markdown report writer",
      starterCode: SRC(`# src/eval.py
import json
from pathlib import Path
from src.pipeline import run_batch

GOLD = Path("fixtures/reviews_gold.jsonl")
REPORT = Path("report.md")
RATING_TOL = 0.5

def _score_row(pred: dict, exp: dict) -> dict:
    return {
        "name_match":      pred["name"]      == exp["name"],
        "brand_match":     pred["brand"]     == exp["brand"],
        "rating_match":    abs(pred["rating_out_of_5"] - exp["rating_out_of_5"]) <= RATING_TOL,
        "sentiment_match": pred["sentiment"] == exp["sentiment"],
    }

def run_eval() -> dict:
    rows = [json.loads(l) for l in GOLD.read_text().splitlines() if l.strip()]
    reviews  = [r["review"]   for r in rows]
    expected = [r["expected"] for r in rows]
    results, rejects = run_batch(reviews)
    # TODO: compute per-field accuracy across the rows that landed in results;
    #       compute exact-match row count (all 4 fields match);
    #       write report.md with rejects + per-field accuracy table + exact-match;
    #       return a small dict summary for tests.
    return {"total": len(rows), "rejects": len(rejects), "results": len(results)}

if __name__ == "__main__":
    print(run_eval())
`),
      validationType: "contains",
      stepType: "code_python",
      validation: validationConfig("contains", "run_eval() reads 10 rows; writes report.md containing total cases, reject count, per-field accuracy markdown table, and exact-match count. Returned summary dict has total + rejects + results + per_field_accuracy + exact_match_count.", {
        reportMustContain: ["Total cases", "Rejects", "Per-field accuracy", "name", "brand", "rating_out_of_5", "sentiment", "Exact-match"],
        returnDictMustHave: ["total", "rejects", "results", "per_field_accuracy", "exact_match_count"],
      }),
      expectedOutputs: { evalRan: true, reportWritten: true, perFieldAccuracyComputed: true },
      datasetRefs: ["fixtures/reviews_gold.jsonl", "fixtures/mock_responses.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "JSONL parse: `[json.loads(l) for l in path.read_text().splitlines() if l.strip()]` — one JSON object per non-blank line.",
          "Per-field accuracy: `correct / total_results` where total_results = the rows that DIDN'T reject (rejects already have a separate count).",
          "Numeric tolerance: `abs(pred - exp) <= 0.5` — never use `==` on floats from a model.",
          "Exact-match row count: a row where all 4 per-field booleans are True. Useful as a single 'wholly-correct' headline metric.",
          "REPORT.write_text(f'# Eval Report\\n\\nTotal cases: {total}\\nRejects: {len(rejects)}\\n\\n## Per-field accuracy\\n\\n| field | accuracy |\\n|---|---|\\n| name | {acc.name:.0%} |\\n...')",
        ],
        successFeedback:
          "End-to-end eval loop is closed — gold set → batch → score → report.md. You can now answer 'did my prompt change help?' with a number, not a vibe.",
        failureFeedback:
          "Most common slips: scoring rating with `==` (one decimal-place mismatch becomes a regression); counting rejects in the accuracy denominator (artificially deflates accuracy); skipping the report.md write (no artefact, no review).",
        portfolioRelevance:
          "A `report.md` checked into the repo with a per-field accuracy table + exact-match count is the single highest-signal applied-LLM artefact at the beginner tier. A reviewer reads it in 30 seconds and immediately knows the loop is closed.",
        finalExplanation:
          "Eval closes the applied-LLM loop. Without it you're guessing. With it — even with a tiny 10-row gold set — every prompt or schema change becomes an objective question with a number for an answer.",
        misconceptionToWatchFor:
          "Believing 'eval is what you do later when the project is big'. It's the OPPOSITE — you start the eval at row 10 so you can defend every decision from row 11 onward.",
      }),
    },
  ],
};
