/**
 * Phase 7 — Wave 1a / applied-llm-engineer (advanced).
 * Candidate 68e53f49-ccce-4c79-a44a-6d9cfb1c24d2 — Planner / Executor Architecture (71.1).
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const appliedLlmPlannerExecutor: AuthoredProject = {
  slug: "applied-llm-planner-executor",
  candidateId: "68e53f49-ccce-4c79-a44a-6d9cfb1c24d2",
  title: "Planner / Executor Agent Architecture with LangGraph",
  shortDescription:
    "Build a two-LLM agent pattern: a planner decomposes the user request into a typed task DAG, an executor runs each leaf with tool-calling, then a synthesizer assembles the answer. Wire it on LangGraph, add cost ceilings, and trace every node to LangSmith.",
  fullDescription:
    "Single-LLM agents fall over on multi-step tasks because the same context window has to hold the plan, the tool outputs, and the final answer. The 2026 production fix is the Planner/Executor split: a planner LLM emits a typed task DAG (Pydantic schema), each leaf is dispatched to an executor LLM with a small, focused tool surface, then a synthesizer composes the final response. You'll build this on LangGraph (stateful agent graph), enforce a per-run cost ceiling, and ship LangSmith tracing so every plan + tool call is observable.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "LangGraph", "LangChain", "OpenAI", "Pydantic", "observability"],
  tags: ["langgraph", "langchain", "agents", "evals", "openai", "observability", "ai-engineering", "applied-llm"],
  learningObjectives: [
    "Architect a planner/executor/synthesizer split and explain its advantages over a single-LLM ReAct loop.",
    "Define a typed task-DAG schema with Pydantic so the planner's output is enforceable, not a JSON guess.",
    "Implement the executor as a LangGraph node that loops on tool-calls until each leaf has an output.",
    "Enforce a per-run cost ceiling that short-circuits when token spend exceeds the budget.",
    "Trace every node to LangSmith and inspect a failing run end-to-end.",
  ],
  estimatedMinutes: 200,
  xpReward: 650,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Customer-success team needs an internal 'analyst bot' that can answer 'why is account ACME's MRR down?' by composing CRM lookups, billing queries, and product analytics. Single-LLM ReAct kept losing track at step 4.",
    hiringRelevance2026:
      "Every 2026 applied-LLM JD says LangGraph or 'stateful agent orchestration'. The planner/executor split + cost ceilings are the EXACT patterns that separate prod-deployed agents from demoware.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (planner → executor → synthesizer)",
      "Step 1 typed plan schema", "Step 2 executor node", "Step 3 LangGraph wiring",
      "Step 4 cost ceiling", "Step 5 LangSmith tracing", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with the LangGraph agent, the typed plan schema, three example tool stubs (CRM, billing, product), the cost-ceiling decorator, a LangSmith link with 10 sample traces, and a pytest suite that exercises planner + executor independently using `dependency_overrides`-style fakes.",
    portfolioRelevance:
      "Recruiters scanning applied-LLM portfolios in 2026 are tired of single-prompt 'agents'. A LangGraph DAG with typed plans + cost ceilings + traces is a senior-IC signal.",
    repoUrl: "https://github.com/<your-handle>/planner-executor-agent",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Typed plan schema (Pydantic + JSON-mode)",
      instructionMd:
        "Define `Plan` and `Task` as Pydantic models. A `Plan` is a list of `Task`s; each `Task` has {id: str, tool: Literal['crm','billing','product'], args: dict, depends_on: list[str]}. The planner LLM call uses `response_format={'type':'json_object'}` + a system prompt that emits valid JSON for this schema. After parsing, validate with `Plan.model_validate(json.loads(content))`. Why typed? Without it, the planner emits free-text and you spend the rest of the project parsing variations. Self-check: run the planner against a fixed prompt with a mocked OpenAI response and confirm the returned Plan has exactly 3 tasks with the expected tool names (crm, billing, product).",
      learningObjective: "Constrain the planner's output to a typed schema so downstream nodes can rely on shape.",
      requiredSkill: "Pydantic v2 + OpenAI JSON mode + structured prompting",
      starterCode: SRC(`# plan_schema.py
from typing import Literal
from pydantic import BaseModel, Field
from openai import AsyncOpenAI

class Task(BaseModel):
    id: str
    tool: Literal["crm", "billing", "product"]
    args: dict
    depends_on: list[str] = Field(default_factory=list)

class Plan(BaseModel):
    tasks: list[Task]

PLANNER_SYSTEM = """Decompose the user's question into a typed task DAG.
Return JSON {"tasks":[{"id","tool","args","depends_on"}]}.
Tools: crm.lookup(account_name), billing.invoices(account_id, last_n_months),
product.usage(account_id, days). depends_on lists task ids whose output you need."""

async def plan(question: str) -> Plan:
    client = AsyncOpenAI()
    # TODO: call chat.completions with response_format={"type":"json_object"},
    # parse content as JSON, validate with Plan.model_validate.
    raise NotImplementedError
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "plan(question) calls OpenAI with response_format={'type':'json_object'} and validates the response with Plan.model_validate(json.loads(...)).",
          "Against the mocked LLM response (3 tasks: crm/billing/product), plan() returns a Plan with exactly 3 Task objects.",
          "A Pydantic ValidationError is raised (not a silent None) if the LLM response has a malformed task.",
        ],
      }),
      expectedOutputs: { taskCount: 3, tools: ["crm", "billing", "product"] },
      datasetRefs: ["fixtures/planner_mock_response.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Why fail loudly on shape? Because the rest of the graph assumes the plan is valid — a silent parse failure becomes a confusing executor crash 3 steps later.",
          "OpenAI JSON mode is enabled with response_format={'type':'json_object'}. The model now MUST emit valid JSON.",
          "Parse with json.loads then Plan.model_validate. The Pydantic ValidationError will tell you exactly which field is wrong.",
          "resp = await client.chat.completions.create(model='gpt-4o-mini', response_format={'type':'json_object'}, messages=[{'role':'system','content':PLANNER_SYSTEM},{'role':'user','content':question}])\nreturn Plan.model_validate(json.loads(resp.choices[0].message.content))",
          "(see reference above)",
        ],
        successFeedback: "Typed plan in hand. Downstream nodes can trust task.tool is one of three literals.",
        failureFeedback: "Common slips: forgot response_format → model returns prose JSON-ish text → JSON parse fails; let depends_on be Optional and downstream code crashed on None.",
        portfolioRelevance: "Every senior applied-LLM interview asks 'how do you constrain LLM output structure?'. Pydantic + JSON-mode is the modern answer; regex parsing is the junior one.",
        finalExplanation: "Typed schemas turn 'the LLM emitted weird text' into a Pydantic ValidationError you can catch and retry. Combined with JSON mode it's a structural guarantee, not hope.",
        misconceptionToWatchFor: "Using ENUM-like docstrings without `Literal[...]`. The model often respects the docstring, but `Literal` is the only way to fail-loud when it doesn't.",
      }),
    },
    {
      stepNumber: 2,
      title: "Executor node with tool-calling loop",
      instructionMd:
        "Implement `executor(task: Task, context: dict) -> dict`. The executor LLM gets the task description + the outputs of `depends_on` tasks (from `context`) + the OpenAI tools schema for the relevant tool. It loops: call LLM → if tool_calls present, execute tool, append result, loop again → else return the final content. Cap iterations at 5 to prevent infinite loops on a confused model. Self-check: mock an LLM that first calls `crm.lookup` then returns text; confirm executor returns the right content string and called the tool exactly once.",
      learningObjective: "Implement an LLM tool-calling loop with a hard iteration cap and dependency-output injection.",
      requiredSkill: "OpenAI tool-calling spec + bounded recursion + JSON tool-result protocol",
      starterCode: SRC(`# executor.py
import json
from openai import AsyncOpenAI
from .plan_schema import Task
from .tools import call_tool, TOOL_SPECS

MAX_ITERS = 5

async def executor(task: Task, context: dict) -> str:
    client = AsyncOpenAI()
    deps_payload = {dep_id: context[dep_id] for dep_id in task.depends_on}
    messages = [
        {"role": "system", "content": "Execute this single task. Use tools as needed. Return only the final result text."},
        {"role": "user", "content": json.dumps({"task": task.model_dump(), "dependency_outputs": deps_payload})},
    ]
    for _ in range(MAX_ITERS):
        # TODO: call chat.completions.create with tools=TOOL_SPECS.
        # If response.choices[0].message.tool_calls: execute each via call_tool(),
        # append each tool result as {"role":"tool","tool_call_id":...,"content":...},
        # and loop. Else return message.content.
        raise NotImplementedError
    raise RuntimeError("executor exceeded MAX_ITERS")
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "With a mocked LLM that first returns a tool_call to crm.lookup and then returns 'ACME account_id=42', executor() calls the tool once and returns the final content string.",
          "The tool result is appended as a 'tool' message with the matching tool_call_id before the next LLM turn.",
          "The loop terminates without raising RuntimeError when the model returns content with no tool_calls.",
        ],
      }),
      expectedOutputs: { toolCalls: 1, finalContent: "ACME account_id=42" },
      datasetRefs: ["fixtures/executor_mock_trace.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Two branches in the loop body: model wants to call a tool (message.tool_calls is truthy) OR model gave you the answer (message.content + no tool_calls).",
          "For tool calls, append the assistant message first (with .tool_calls), then for each tool_call append a 'tool' message with tool_call_id and the stringified tool result.",
          "Cap at MAX_ITERS so a confused model can't loop forever and burn budget.",
          "resp = await client.chat.completions.create(model='gpt-4o-mini', messages=messages, tools=TOOL_SPECS)\nmsg = resp.choices[0].message\nif msg.tool_calls:\n  messages.append(msg)\n  for tc in msg.tool_calls:\n    result = call_tool(tc.function.name, json.loads(tc.function.arguments))\n    messages.append({'role':'tool','tool_call_id':tc.id,'content':json.dumps(result)})\nelse: return msg.content",
          "(see reference above)",
        ],
        successFeedback: "Executor loop ships. Each task is now a bounded, recoverable unit of agent work.",
        failureFeedback: "Common slips: appended the user content again instead of the assistant message (model loses track of its own tool calls); didn't stringify tool result (OpenAI demands str); forgot MAX_ITERS (infinite loops in prod).",
        portfolioRelevance: "Knowing the OpenAI tool-call protocol turn-by-turn is a senior signal — most candidates have only used LangChain helpers and can't explain what's on the wire.",
        finalExplanation: "Tool-calling is a strict turn-taking protocol: assistant message with tool_calls → one 'tool' message per call with matching tool_call_id → next assistant turn. Skip a step and the model has no idea what happened.",
        misconceptionToWatchFor: "Treating the executor as a free-text LLM. The whole point is structured tool I/O — if you let it return prose you're back to single-LLM ReAct.",
      }),
    },
    {
      stepNumber: 3,
      title: "Wire it all on LangGraph",
      instructionMd:
        "Build the LangGraph: nodes = planner, executor (fan-out over Plan.tasks respecting depends_on), synthesizer. State = TypedDict {question, plan, outputs: dict[str,str], answer}. Use `StateGraph(State).add_node(...).add_edge(...).compile()`. Execute the plan in topological order — task A is ready when all its `depends_on` are in `outputs`. Self-check: run the full graph against the mocked trio of tools and confirm the final state.answer is non-empty and outputs has exactly 3 entries.",
      learningObjective: "Compose planner+executor+synthesizer into a stateful LangGraph with proper dependency ordering.",
      requiredSkill: "LangGraph StateGraph + TypedDict state + topological dispatch",
      starterCode: SRC(`# graph.py
from typing import TypedDict
from langgraph.graph import StateGraph, END
from .plan_schema import Plan, plan
from .executor import executor
from openai import AsyncOpenAI

class State(TypedDict):
    question: str
    plan: Plan | None
    outputs: dict[str, str]
    answer: str

async def planner_node(s: State) -> State:
    return {**s, "plan": await plan(s["question"])}

async def executor_node(s: State) -> State:
    outs = dict(s["outputs"])
    # TODO: while not all tasks done, find any task whose depends_on subset(outs.keys())
    # and run executor on it; store outs[task.id] = result.
    raise NotImplementedError

async def synthesizer_node(s: State) -> State:
    client = AsyncOpenAI()
    summary = "\\n".join(f"- {tid}: {out}" for tid, out in s["outputs"].items())
    # TODO: gpt-4o-mini compose final answer from the question + summary.
    raise NotImplementedError

def build_graph():
    g = StateGraph(State)
    g.add_node("planner", planner_node)
    g.add_node("executor", executor_node)
    g.add_node("synthesizer", synthesizer_node)
    g.set_entry_point("planner")
    g.add_edge("planner", "executor")
    g.add_edge("executor", "synthesizer")
    g.add_edge("synthesizer", END)
    return g.compile()
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "graph.ainvoke({'question': ...}) returns a State with a non-empty answer string.",
          "The outputs dict in the final state has exactly 3 entries (one per task: a, b, c).",
          "Tasks are dispatched in dependency order — task b and c only run after task a's output is available in outputs.",
        ],
      }),
      expectedOutputs: { outputsCount: 3, answerNonEmpty: true },
      datasetRefs: ["fixtures/graph_smoke.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Two parts to executor_node: a 'find next runnable' loop + the actual dispatch.",
          "ready = [t for t in s['plan'].tasks if t.id not in outs and set(t.depends_on) <= outs.keys()]",
          "while there are pending tasks, await executor(t, outs) for each ready one (asyncio.gather is fine when independent) and store outs[t.id].",
          "while any(t.id not in outs for t in s['plan'].tasks):\n  ready = [t for t in s['plan'].tasks if t.id not in outs and set(t.depends_on) <= outs.keys()]\n  if not ready: raise RuntimeError('plan cycle')\n  for t in ready: outs[t.id] = await executor(t, outs)\nreturn {**s, 'outputs': outs}",
          "(see reference above)",
        ],
        successFeedback: "Graph composed. Add a node next and the rest of the system doesn't change.",
        failureFeedback: "Common slips: didn't detect cycles (no ready tasks but pending remain → infinite loop); ran all tasks in parallel ignoring depends_on (executor errors because dependency outputs missing).",
        portfolioRelevance: "Composability via LangGraph nodes is the production answer to 'how would you extend this agent?'. New node = new edges, no rewrite.",
        finalExplanation: "LangGraph isn't magic — it's a TypedDict reducer with edges. The win is that EACH node is a pure async function of state, which makes them independently testable.",
        misconceptionToWatchFor: "Reaching for AgentExecutor.from_agent_and_tools(). That's the legacy LangChain pattern; LangGraph is the 2026 default for stateful agents.",
      }),
    },
    {
      stepNumber: 4,
      title: "Cost ceiling that short-circuits at $X",
      instructionMd:
        "Add `@cost_ceiling(usd_max=0.50)` decorator that tallies token usage across all LLM calls in a run and raises `BudgetExceeded` once the running total exceeds the cap. Use OpenAI's usage object from each response (.usage.prompt_tokens, .completion_tokens) + a model-pricing table to compute USD. Persist the tally in a contextvar so it follows the asyncio task tree. Self-check: wrap a run with cost_ceiling(usd_max=0.001), mock 3 calls each costing $0.0005, and confirm BudgetExceeded is raised on call 3.",
      learningObjective: "Enforce a per-run cost ceiling using contextvars + OpenAI usage telemetry.",
      requiredSkill: "Python contextvars + decorators + per-model pricing tables + asyncio task-local state",
      starterCode: SRC(`# cost.py
from contextvars import ContextVar
from functools import wraps

PRICING = {"gpt-4o-mini": {"prompt": 0.15/1_000_000, "completion": 0.60/1_000_000}}
_spend: ContextVar[float] = ContextVar("spend", default=0.0)

class BudgetExceeded(Exception): pass

def record_usage(model: str, prompt: int, completion: int):
    p = PRICING[model]
    cost = prompt * p["prompt"] + completion * p["completion"]
    _spend.set(_spend.get() + cost)

def cost_ceiling(usd_max: float):
    def deco(fn):
        @wraps(fn)
        async def inner(*a, **kw):
            # TODO: reset _spend, run fn, after each accumulation check
            # against usd_max. Easiest: instrument the LLM client to call
            # record_usage + raise BudgetExceeded when _spend.get() > usd_max.
            raise NotImplementedError
        return inner
    return deco
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "With usd_max=0.001 and each mocked call costing $0.0005, BudgetExceeded is raised on the 3rd call (cumulative spend exceeds the cap).",
          "The spend tally lives in a ContextVar so concurrent async runs do not interfere with each other's budgets.",
          "The ContextVar token is reset (via .reset()) in a finally block so the tally does not leak across sequential top-level calls.",
        ],
      }),
      expectedOutputs: { raisedAtCall: 3 },
      datasetRefs: ["fixtures/pricing.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "_spend is a ContextVar so each top-level call gets its own tally that follows the asyncio task tree.",
          "In the decorator: token = _spend.set(0.0); try: return await fn(*a,**kw); finally: _spend.reset(token).",
          "The check belongs in record_usage: after updating, if _spend.get() > usd_max (read from contextvar set by the decorator): raise BudgetExceeded.",
          "_max: ContextVar[float] = ContextVar('max', default=float('inf'))\ndef cost_ceiling(usd_max):\n  def deco(fn):\n    @wraps(fn)\n    async def inner(*a,**kw):\n      mt = _max.set(usd_max); st = _spend.set(0.0)\n      try: return await fn(*a,**kw)\n      finally: _max.reset(mt); _spend.reset(st)\n    return inner\n  return deco\n# in record_usage: if _spend.get() > _max.get(): raise BudgetExceeded(...)",
          "(see reference above)",
        ],
        successFeedback: "Cost ceiling enforced. Runaway agents short-circuit at the budget instead of burning $80 by the time someone notices.",
        failureFeedback: "Common slips: used a module global instead of ContextVar (concurrent runs interfere); checked the budget only at the end (already burned the budget by then); forgot to .reset() the contextvar token (leaks across runs).",
        portfolioRelevance: "Production-LLM JD bullet: 'enforce per-customer cost ceilings'. The contextvar + decorator pattern is exactly the right primitive.",
        finalExplanation: "ContextVars are the only safe way to carry per-run state through deeply-nested async code. Module globals leak across runs; thread-locals break under asyncio.",
        misconceptionToWatchFor: "Trying to thread the budget through every function call. That's noisy and easy to forget. ContextVar is the invisible-correct answer.",
      }),
    },
    {
      stepNumber: 5,
      title: "LangSmith tracing for every node",
      instructionMd:
        "Wrap every node with LangSmith's `@traceable` so each invocation appears in the LangSmith UI with inputs, outputs, and latency. Set `os.environ['LANGCHAIN_TRACING_V2']='true'`, `LANGCHAIN_API_KEY`, `LANGCHAIN_PROJECT`. Then add `@traceable(name='planner_node')` etc. Self-check: run the graph and confirm exactly 3 spans appear in LangSmith (planner_node, executor_node, synthesizer_node) with non-null start_time/end_time.",
      learningObjective: "Add structured tracing to every agent node so production failures are debuggable.",
      requiredSkill: "LangSmith @traceable + observability + env-driven config",
      starterCode: SRC(`# tracing.py
import os
os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
os.environ.setdefault("LANGCHAIN_PROJECT", "planner-executor-agent")
from langsmith import traceable  # pip install langsmith

# TODO: re-export your nodes wrapped with @traceable(name=...)
# from .graph import planner_node as _planner_node, executor_node as _executor_node, synthesizer_node as _synthesizer_node
# planner_node = traceable(name='planner_node')(_planner_node)
# ...
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "Each node (planner_node, executor_node, synthesizer_node) is wrapped with traceable(name=...) and those traced versions are imported in the graph.",
          "Running the graph produces exactly 3 top-level LangSmith spans with names 'planner_node', 'executor_node', and 'synthesizer_node'.",
          "LANGCHAIN_TRACING_V2 and LANGCHAIN_PROJECT env vars are set before any langsmith import.",
        ],
      }),
      expectedOutputs: { spans: ["planner_node", "executor_node", "synthesizer_node"] },
      datasetRefs: ["fixtures/langsmith_spans.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "LangSmith's @traceable is a decorator — apply it to each node function and tracing happens automatically.",
          "Set LANGCHAIN_TRACING_V2=true + LANGCHAIN_API_KEY + LANGCHAIN_PROJECT before importing anything else.",
          "Re-export the wrapped nodes so the rest of the graph file imports the traced versions.",
          "planner_node = traceable(name='planner_node')(_planner_node)\nexecutor_node = traceable(name='executor_node')(_executor_node)\nsynthesizer_node = traceable(name='synthesizer_node')(_synthesizer_node)",
          "(see reference above)",
        ],
        successFeedback: "Every run now appears in LangSmith with input/output/latency per node. Production debugging is now 'open the trace' instead of 'add print statements'.",
        failureFeedback: "Common slips: set env vars AFTER importing langsmith (no-op); decorated the graph object instead of the nodes (one giant span, no detail); forgot LANGCHAIN_PROJECT (everything dumps to 'default').",
        portfolioRelevance: "LangSmith URL in the README → recruiters can click and see traces. That's a level of operational maturity 99% of bootcamp portfolios skip.",
        finalExplanation: "Tracing is the difference between 'the agent failed' and 'the planner emitted an invalid tool name on turn 3 in 240ms'. Without it, debugging async multi-LLM systems is hopeless.",
        misconceptionToWatchFor: "Logging inputs/outputs to stdout instead of using LangSmith. Stdout dies with the process; LangSmith persists + lets you filter/replay.",
      }),
    },
  ],
};
