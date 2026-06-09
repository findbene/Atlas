/**
 * Phase 11 batch-3 / ai-engineer.
 * Candidate c7b8d2f3-6e45-4a99-9123-2b3c4d5e6f70 — LLM Model Serving Canary
 * (FastAPI + traffic-split + eval-gated rollback).
 *
 * Legacy: `mlops-model-serving-canary` (5-step skeleton, score 44.7).
 * Recategorized as ai-engineer per Phase 11 plan — focus shifts to LLM-
 * specific concerns: prompt regression, judge-gated rollback, latency p95.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const aiEngineerModelServingCanary: AuthoredProject = {
  slug: "ai-engineer-model-serving-canary",
  candidateId: "c7b8d2f3-6e45-4a99-9123-2b3c4d5e6f70",
  title: "LLM Canary Deploy — FastAPI Traffic Split + Eval-Gated Rollback",
  shortDescription:
    "Roll out a new prompt or model with a weighted FastAPI traffic split (5% → 25% → 100%), an in-flight eval harness that scores live traffic against golden judges, and automatic rollback when win-rate drops or p95 latency breaches the SLO.",
  fullDescription:
    "Shipping a new prompt without a canary is shipping a regression. You'll build a FastAPI router that hashes user_id to deterministic buckets, mirrors a fraction of traffic to the candidate, scores responses with cheap judges in real time, and auto-promotes / auto-rolls-back based on a live SLO. Every step is measurable — by the end you have a deploy mechanism a hiring manager can run locally.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "FastAPI", "OpenAI", "Anthropic", "evals", "pgvector", "observability"],
  tags: ["canary", "deploy", "fastapi", "rollback", "evals", "slo", "llm-judge"],
  learningObjectives: [
    "Implement deterministic user-bucketing for weighted canary traffic splits.",
    "Mirror live traffic to a candidate model without affecting user latency.",
    "Score live traffic with cheap async judges and aggregate per-bucket win-rates.",
    "Define SLOs (win-rate floor, p95 latency ceiling) and enforce them.",
    "Auto-promote on green or rollback on red without manual intervention.",
  ],
  estimatedMinutes: 230,
  xpReward: 740,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "AI platform engineer at a 60-person fintech. Marketing wants daily prompt experiments; eng wants a safety net. You're owning the canary deploy + rollback infra so the team can ship 3x prompt variants per week without 3am pages.",
    hiringRelevance2026:
      "Canary + auto-rollback for LLM endpoints is the 2026 production-AI signal. The mechanics are the same as model rollouts; the eval is what makes it LLM-specific.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (router / mirror / judge / SLO / control loop)",
      "Step 1 deterministic bucketing", "Step 2 async mirroring", "Step 3 live judging",
      "Step 4 SLO definition", "Step 5 promote/rollback loop", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with the FastAPI router (deterministic bucketing + traffic mirror), the live-judge async pipeline, a 200-RPS load-test script that demonstrates promote-on-green and rollback-on-red in a single 5-minute run, and a Grafana-style dashboard JSON of per-bucket metrics.",
    portfolioRelevance:
      "A working canary + rollback demo is rare in AI repos. Run-able in 5 minutes = hiring manager actually runs it.",
    repoUrl: "https://github.com/<your-handle>/llm-canary-deploy",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Deterministic user-bucketing for canary splits",
      instructionMd:
        "Implement `assign_bucket(user_id, candidate_weight) -> 'baseline' | 'candidate'` using `int(sha256(user_id).hexdigest(), 16) % 100 < candidate_weight * 100`. Verify manually: run 10000 user_ids through with weight=0.05 and confirm the same assignment on re-call (deterministic) and that the candidate share is between 4.5% and 5.5%. This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.",
      learningObjective: "Sticky bucketing means a user sees the same variant on every request — required for honest evals.",
      requiredSkill: "Deterministic hashing + uniform distribution + weight semantics",
      starterCode: SRC(`# routing.py
import hashlib

def assign_bucket(user_id: str, candidate_weight: float) -> str:
    if not 0.0 <= candidate_weight <= 1.0:
        raise ValueError('weight must be in [0,1]')
    h = hashlib.sha256(user_id.encode()).hexdigest()
    bucket_value = int(h, 16) % 10000
    # TODO: return 'candidate' if bucket_value < candidate_weight * 10000 else 'baseline'
    return 'baseline'
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "Learner attests the bucketing is correct.", {
        attestationCriteria: [
          "assign_bucket uses sha256(user_id) % 10000 and returns 'candidate' when bucket_value < candidate_weight * 10000.",
          "The same user_id always returns the same bucket (deterministic — verified by calling twice and comparing).",
          "With weight=0.05 and 10000 user_ids, the candidate share is between 4.5% and 5.5%.",
          "assign_bucket raises ValueError when candidate_weight is outside [0, 1].",
        ],
      }),
      expectedOutputs: { deterministic: true, share: 0.05, tolerance: 0.005 },
      datasetRefs: ["fixtures/user_ids.txt"],
      pedagogy: pedagogyConfig({
        hints: [
          "`random()` per request = a user sees different variants on different calls. Useless for evals.",
          "sha256 + modulo 10000 gives uniform distribution at 0.01% granularity — way finer than you need.",
          "Always validate the weight bound up front; silent clipping is a debugging nightmare.",
          "Bucket logic belongs in middleware, not handlers, so it's applied uniformly.",
          "return 'candidate' if bucket_value < int(candidate_weight * 10000) else 'baseline'",
        ],
        successFeedback: "Deterministic + uniform = trustworthy A/B. Eval results are meaningful from here.",
        failureFeedback: "Common slips: random() per request (non-sticky); modulo on small space (clustering); not bounds-checking weight (silent broken splits).",
        portfolioRelevance: "Sticky bucketing is the foundation of every honest experiment. Get this wrong, nothing downstream is trustworthy.",
        finalExplanation: "Hash-based bucketing is to A/B what UUIDs are to identity: boring, correct, never re-derived.",
        misconceptionToWatchFor: "Storing per-user assignments in a DB. Hash-based assignment is stateless + faster.",
      }),
    },
    {
      stepNumber: 2,
      title: "Async traffic mirror to candidate model",
      instructionMd:
        "In FastAPI, implement `POST /chat` that always returns the BASELINE response to the user, and ALSO fires the same prompt at the candidate model via `asyncio.create_task` so user latency is unaffected. Persist `(request_id, baseline_response, candidate_response)` to an in-memory store. Verify manually: hit the endpoint 50 times with weight=1.0 and confirm user-facing responses return quickly and all 50 candidate responses are captured asynchronously. This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.",
      learningObjective: "Mirror traffic without coupling user latency to candidate latency.",
      requiredSkill: "asyncio.create_task fire-and-forget + FastAPI + non-blocking observation",
      starterCode: SRC(`# server.py
import asyncio, time, uuid
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()
MIRROR_STORE: dict[str, dict] = {}

class ChatRequest(BaseModel):
    user_id: str
    prompt: str

async def call_model(model: str, prompt: str) -> str:
    # Pretend-LLM: latency 20ms baseline, 60ms candidate (heavier reranker).
    await asyncio.sleep(0.02 if 'baseline' in model else 0.06)
    return f"[{model}] {prompt[:30]}"

async def mirror_to_candidate(request_id: str, prompt: str) -> None:
    resp = await call_model('candidate-v2', prompt)
    MIRROR_STORE[request_id]['candidate_response'] = resp
    MIRROR_STORE[request_id]['candidate_completed_at'] = time.time()

@app.post('/chat')
async def chat(req: ChatRequest) -> dict:
    request_id = uuid.uuid4().hex
    baseline_response = await call_model('baseline-v1', req.prompt)
    MIRROR_STORE[request_id] = {'baseline_response': baseline_response, 'candidate_response': None}
    # TODO: fire-and-forget the candidate call so user latency stays at baseline.
    return {'request_id': request_id, 'response': baseline_response}
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "Learner attests the async mirror is correct.", {
        attestationCriteria: [
          "POST /chat always returns the baseline response immediately without awaiting the candidate call.",
          "The candidate call is fired with asyncio.create_task (not await) so user-facing latency equals baseline latency only.",
          "All mirrored responses are captured in MIRROR_STORE keyed by request_id.",
          "After sending 50 requests, all 50 MIRROR_STORE entries eventually contain non-None candidate_response values.",
        ],
      }),
      expectedOutputs: { userP95Ms: 35, candidatesCaptured: 50 },
      datasetRefs: ["fixtures/load_50.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "`asyncio.create_task` returns immediately — that's the whole point.",
          "`await mirror_to_candidate(...)` would couple user latency to candidate latency — defeats mirroring.",
          "Always tag the mirrored task with the request_id so the result joins back correctly.",
          "In production, replace the in-memory store with Redis/Kafka so mirror data survives restarts.",
          "asyncio.create_task(mirror_to_candidate(request_id, req.prompt))",
        ],
        successFeedback: "User latency stays at baseline; candidate runs in the background. The pattern scales to mirror to N candidates simultaneously.",
        failureFeedback: "Common slips: awaited mirror call (user p95 explodes); store keyed by user_id (collisions across concurrent requests); leaked tasks (no cleanup).",
        portfolioRelevance: "Async mirror is a senior-eng pattern. Show the await/create_task contrast explicitly.",
        finalExplanation: "Mirroring is observation, not part of the response path. Decoupling them is the whole point.",
        misconceptionToWatchFor: "Sending both responses to the user 'just to compare'. Now you have two different user experiences and your A/B is broken.",
      }),
    },
    {
      stepNumber: 3,
      title: "Live judging on mirrored traffic",
      instructionMd:
        "Implement `score_pair(prompt, baseline, candidate, judge_client) -> JudgeVerdict` that asks a cheap judge model 'which response is better?' returning `'baseline' | 'candidate' | 'tie'` + reasoning. Run it over the store; compute the **candidate win-rate** = wins / (wins + losses), excluding ties. Atlas checks that the submitted numeric win-rate value is within the configured tolerance.",
      learningObjective: "Pairwise judging on live traffic gives a continuous signal — no need to wait for offline evals.",
      requiredSkill: "Pairwise LLM judging + win-rate math + tie handling",
      starterCode: SRC(`# judging.py
from dataclasses import dataclass

@dataclass
class JudgeVerdict:
    winner: str  # 'baseline' | 'candidate' | 'tie'
    reasoning: str

JUDGE_PROMPT = """Compare two responses to a user prompt.
Prompt: {prompt}
Response A (baseline): {baseline}
Response B (candidate): {candidate}
Which is better? Reply JSON: {{"winner": "A"|"B"|"tie", "reasoning": str}}"""

async def score_pair(prompt: str, baseline: str, candidate: str, judge_client) -> JudgeVerdict:
    # TODO: format prompt, call judge_client (mocked in tests), parse JSON.
    return JudgeVerdict(winner='tie', reasoning='stub')

def candidate_win_rate(verdicts: list[JudgeVerdict]) -> float:
    wins = sum(1 for v in verdicts if v.winner == 'candidate')
    losses = sum(1 for v in verdicts if v.winner == 'baseline')
    decisive = wins + losses
    if decisive == 0:
        return 0.5  # all ties — no signal.
    return wins / decisive
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "score_pair() calls the judge client and returns a JudgeVerdict with winner in {'baseline','candidate','tie'} and non-empty reasoning.",
          "candidate_win_rate() counts only decisive verdicts (wins + losses), excluding ties from the denominator.",
          "For 30 mocked verdicts (18 candidate wins, 8 baseline wins, 4 ties): decisive=26, win_rate = 18/26 ≈ 0.692.",
          "When decisive=0 (all ties), candidate_win_rate returns 0.5 (no-signal fallback).",
          "win_rate is computed as wins / max(wins + losses, 1) to avoid division by zero.",
        ],
      }),
      expectedOutputs: { winRate: 0.692, decisive: 26, ties: 4 },
      datasetRefs: ["fixtures/judge_verdicts.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Pairwise judging is more reliable than absolute scoring — 'A vs B' is easier than 'rate B from 1-5'.",
          "Always randomize which is shown as 'A' vs 'B' to avoid position bias.",
          "Excluding ties from the denominator is the convention — ties are noise, not signal.",
          "Cap judge concurrency to avoid hitting provider rate limits during traffic spikes.",
          "win_rate = wins / max(wins + losses, 1)",
        ],
        successFeedback: "You now have a real-time signal on whether the candidate is better. No offline eval needed.",
        failureFeedback: "Common slips: including ties in denominator (deflates true win-rate); not randomizing position (judges prefer first); single judge (high variance).",
        portfolioRelevance: "Live pairwise judging is the 2026 prod-AI pattern. Most teams batch-eval nightly; you're doing it on every request.",
        finalExplanation: "Pairwise + ties-excluded is the standard. Anything else needs justification.",
        misconceptionToWatchFor: "Treating ties as a vote for baseline. That biases the canary downward and stalls promotions.",
      }),
    },
    {
      stepNumber: 4,
      title: "SLO definition — win-rate floor + latency ceiling",
      instructionMd:
        "Define `CanarySLO(win_rate_floor=0.55, p95_latency_ceiling_ms=120)` and `evaluate_slo(metrics) -> SLOResult` returning `'pass' | 'fail'` + which SLO breached. Verify manually on 4 cases: (win_rate=0.62, p95=95ms) → pass; (win_rate=0.48, p95=95ms) → fail [win_rate]; (win_rate=0.62, p95=140ms) → fail [latency]; (win_rate=0.48, p95=140ms) → fail [both]. This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.",
      learningObjective: "Explicit SLOs convert 'gut feel' into a deploy gate.",
      requiredSkill: "SLO definition + multi-dimensional thresholds + clear breach reporting",
      starterCode: SRC(`# slo.py
from dataclasses import dataclass

@dataclass
class CanarySLO:
    win_rate_floor: float = 0.55
    p95_latency_ceiling_ms: float = 120.0

@dataclass
class SLOResult:
    status: str  # 'pass' | 'fail'
    breached: list[str]
    detail: dict

def evaluate_slo(metrics: dict, slo: CanarySLO = CanarySLO()) -> SLOResult:
    breached = []
    # TODO: if metrics['win_rate'] < slo.win_rate_floor: breached.append('win_rate')
    # TODO: if metrics['p95_latency_ms'] > slo.p95_latency_ceiling_ms: breached.append('latency')
    status = 'pass' if not breached else 'fail'
    return SLOResult(status=status, breached=breached, detail=metrics)
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "Learner attests the SLO evaluator is correct.", {
        attestationCriteria: [
          "evaluate_slo returns status='pass' and breached=[] when win_rate ≥ win_rate_floor AND p95_latency_ms ≤ p95_latency_ceiling_ms.",
          "evaluate_slo appends 'win_rate' to breached when metrics['win_rate'] < slo.win_rate_floor.",
          "evaluate_slo appends 'latency' to breached when metrics['p95_latency_ms'] > slo.p95_latency_ceiling_ms.",
          "All breaches are reported — both 'win_rate' and 'latency' can appear together in the same result.",
          "Tested on 4 cases: pass, fail[win_rate], fail[latency], fail[win_rate,latency].",
        ],
      }),
      expectedOutputs: { case1: "pass", case2: "fail[win_rate]", case3: "fail[latency]", case4: "fail[win_rate,latency]" },
      datasetRefs: ["fixtures/slo_cases.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Win-rate floor of 0.55 is the standard for 'candidate is at least as good as baseline'.",
          "p95 latency, not mean — mean hides the tail that actually angers users.",
          "Surface every breach, not just the first — devs need full picture.",
          "Pin SLO values in config, not code — they change per deploy environment.",
          "if metrics['win_rate'] < slo.win_rate_floor: breached.append('win_rate')\\nif metrics['p95_latency_ms'] > slo.p95_latency_ceiling_ms: breached.append('latency')",
        ],
        successFeedback: "Explicit SLOs make promote/rollback decisions automatic.",
        failureFeedback: "Common slips: mean latency (tail hidden); first-breach-wins (incomplete picture); SLO in code (re-deploy to change).",
        portfolioRelevance: "Multi-dimensional SLOs are a senior signal. Most repos check one metric and miss the other axis.",
        finalExplanation: "An SLO is a contract with users. If you can't write it down, you can't deploy against it.",
        misconceptionToWatchFor: "Setting SLOs after the canary starts. They're the prerequisite, not the conclusion.",
      }),
    },
    {
      stepNumber: 5,
      title: "Promote/rollback control loop",
      instructionMd:
        "Implement `control_loop(state, metrics_history, slo)` that steps the canary weight: pass for 3 consecutive 5-minute windows → next stage (5% → 25% → 100%); fail any single window → rollback to 0% and emit alert. Verify manually: simulate 5 windows (3 green, then 1 red) and confirm state.stage_idx=1 (25%) after 3 passes, then rolled_back=True and weight=0.0 after the fail. This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.",
      learningObjective: "Wrap the SLO + bucketing + judging in an automatic state machine.",
      requiredSkill: "State machine + multi-window confirmation + rollback semantics",
      starterCode: SRC(`# control.py
from dataclasses import dataclass

STAGES = [0.05, 0.25, 1.00]
PASS_WINDOWS_TO_ADVANCE = 3

@dataclass
class CanaryState:
    stage_idx: int = 0  # 0 → 5%, 1 → 25%, 2 → 100%
    consecutive_passes: int = 0
    rolled_back: bool = False
    alert: str | None = None

def control_step(state: CanaryState, slo_result, slo) -> CanaryState:
    if state.rolled_back:
        return state
    if slo_result.status == 'fail':
        # TODO: rollback - set stage_idx=-1 conceptually OR weight 0; emit alert.
        state.rolled_back = True
        state.alert = f"rollback: {slo_result.breached}"
        return state
    # TODO: pass — increment counter; if hits PASS_WINDOWS_TO_ADVANCE, bump stage; reset counter.
    return state

def current_weight(state: CanaryState) -> float:
    if state.rolled_back:
        return 0.0
    return STAGES[state.stage_idx]
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "Learner attests the control loop is correct.", {
        attestationCriteria: [
          "After 3 consecutive PASS windows, state.stage_idx advances from 0 to 1 (from 5% to 25%).",
          "After any single FAIL window, rolled_back is set to True and current_weight returns 0.0.",
          "state.alert is set to a string containing 'rollback' after a FAIL.",
          "Once rolled_back=True, further control_step calls do not change state.",
        ],
      }),
      expectedOutputs: { stageAfterPasses: 1, rolledBack: true, weight: 0.0 },
      datasetRefs: ["fixtures/control_windows.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "3-window confirmation avoids promoting on a lucky single window.",
          "Any single fail = rollback — don't retry. Trust the SLO.",
          "Persist state externally (Redis, Postgres) so a server restart doesn't reset the canary.",
          "Emit alerts to PagerDuty/Slack on rollback — not just logs. Humans need to know.",
          "if state.consecutive_passes >= PASS_WINDOWS_TO_ADVANCE and state.stage_idx < len(STAGES) - 1: state.stage_idx += 1; state.consecutive_passes = 0",
        ],
        successFeedback: "You have a complete canary loop: bucket → mirror → judge → SLO → promote/rollback. Production-grade.",
        failureFeedback: "Common slips: single-window promotion (flaky promotes); retry on fail (delays rollback); state in process memory (lost on deploy).",
        portfolioRelevance: "An end-to-end canary demo run-able in 5 minutes is rare. This is your hiring-manager moment.",
        finalExplanation: "Canary deploys exist to make rollback automatic. If a human has to decide, you don't have a canary.",
        misconceptionToWatchFor: "Hand-waving the rollback. The rollback PATH is the whole point — most outages happen during rollback, not deploy.",
      }),
    },
  ],
};
