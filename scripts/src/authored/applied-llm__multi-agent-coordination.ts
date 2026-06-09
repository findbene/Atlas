/**
 * Phase 7 — Wave 1a / applied-llm-engineer (advanced).
 * Candidate cd46a53e-8532-4cdb-b5ee-9db38a3dfbd8 — Multi-Agent Coordination (71.1).
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const appliedLlmMultiAgentCoordination: AuthoredProject = {
  slug: "applied-llm-multi-agent-coordination",
  candidateId: "cd46a53e-8532-4cdb-b5ee-9db38a3dfbd8",
  title: "Multi-Agent Coordination — Supervisor + Specialists with LangGraph",
  shortDescription:
    "Build a supervisor agent that routes requests to three specialist agents (Researcher, Writer, Critic) over a shared blackboard, with deterministic termination, structured handoffs, and LangSmith tracing of every hop.",
  fullDescription:
    "Single agents miss the affordances of specialization. The 2026 production pattern for non-trivial workflows is supervisor-router + specialists: the supervisor reads the shared blackboard state, decides which specialist runs next (or to terminate), and the specialists each have a narrow tool surface + prompt. You'll build it on LangGraph with explicit handoff messages, a deterministic termination predicate (no 'maybe stop' from the supervisor), and full LangSmith tracing.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "LangGraph", "LangChain", "OpenAI", "Pydantic", "observability"],
  tags: ["langgraph", "agents", "multi-agent", "evals", "openai", "observability", "applied-llm"],
  learningObjectives: [
    "Design a supervisor-router topology and reason about when to use it vs single-agent ReAct.",
    "Define a shared blackboard state schema and structured handoff messages.",
    "Make the supervisor's routing decision typed (enum) so termination is deterministic.",
    "Avoid infinite specialist ping-pong with an iteration cap + max-handoffs-per-specialist quota.",
    "Trace every hop to LangSmith so a failing run is debuggable end-to-end.",
  ],
  estimatedMinutes: 190,
  xpReward: 650,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Content team wants an automated 'investigate → draft → critique → revise' workflow for analyst notes. Single-prompt agents conflate the four roles.",
    hiringRelevance2026:
      "Supervisor + specialists is the LangGraph reference architecture for 2026 multi-agent systems. Every applied-LLM senior interview includes 'how do you avoid agents stuck in a loop?' — the typed-router + iteration-cap pattern is the answer.",
    readmeOutline: [
      "Overview", "Topology diagram", "Step 1 blackboard schema", "Step 2 specialists",
      "Step 3 supervisor router", "Step 4 termination + caps", "Step 5 tracing",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with the LangGraph, three specialist prompts as separate files, the typed Router decision schema, pytest covering 'supervisor loops on critic three times then terminates', and a LangSmith link to a sample multi-agent trace.",
    portfolioRelevance:
      "Every recruiter scanning applied-LLM resumes in 2026 has seen 'I built a multi-agent system' on dozens of CVs. The differentiator is showing deterministic termination + LangSmith traces + tests — the operational story 95% of bootcamp projects skip.",
    repoUrl: "https://github.com/<your-handle>/multi-agent-supervisor",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Blackboard state + typed handoff messages",
      instructionMd:
        "Define the shared blackboard as a TypedDict: {question, research_notes: list[str], draft: str|None, critique: str|None, revisions: int, handoffs: list[str]}. Every node reads from state and returns a partial state update — LangGraph reducers merge. Handoffs are explicit strings appended to `handoffs` so traces show the full path. Validator constructs an empty State + runs the researcher node (mocked LLM) and asserts the returned state has research_notes non-empty + handoffs has one entry.",
      learningObjective: "Define a typed blackboard so each specialist's contract is enforced at the type layer.",
      requiredSkill: "TypedDict + Pydantic + LangGraph state reducers",
      starterCode: SRC(`# state.py
from typing import TypedDict

class State(TypedDict):
    question: str
    research_notes: list[str]
    draft: str | None
    critique: str | None
    revisions: int
    handoffs: list[str]

def initial_state(question: str) -> State:
    # TODO: return State with question set and the rest at their empty defaults.
    raise NotImplementedError
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "initial_state('q') returns a TypedDict with exactly 6 keys: question, research_notes (empty list), draft (None), critique (None), revisions (0), handoffs (empty list).",
          "After the researcher node runs on a mocked LLM, the returned partial state has research_notes non-empty and handoffs=['researcher'].",
        ],
      }),
      expectedOutputs: { stateKeys: 6, initialHandoffs: [] },
      datasetRefs: ["fixtures/state_smoke.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Defaults: research_notes=[], draft=None, critique=None, revisions=0, handoffs=[].",
          "return {'question': question, 'research_notes': [], 'draft': None, 'critique': None, 'revisions': 0, 'handoffs': []}",
          "Reducers merge: a node returning {'handoffs': ['researcher']} appends; a node returning {'draft': '...'} overwrites.",
          "TypedDict gives you the type signature; LangGraph supplies the reducer protocol for free.",
          "(see hints above)",
        ],
        successFeedback: "Blackboard ready. Every specialist now has a typed contract for what it reads and what it writes.",
        failureFeedback: "Common slip: returning the entire state from a node instead of a diff. That works but defeats LangGraph's reducer pattern and makes traces noisy.",
        portfolioRelevance: "Typed state contracts are how mature LangGraph codebases stay maintainable as the number of nodes grows. It's a senior signal.",
        finalExplanation: "Blackboard architecture is the oldest agent-coordination pattern (1970s AI). LangGraph just gives it a typed reducer veneer. The win remains the same: specialists communicate through state, not through direct message-passing.",
        misconceptionToWatchFor: "Adding fields to State 'just in case'. Every field is a contract; only add what's necessary for routing decisions or output composition.",
      }),
    },
    {
      stepNumber: 2,
      title: "Three specialist nodes (Researcher, Writer, Critic)",
      instructionMd:
        "Implement three async node functions, each with a focused system prompt + a single tool surface. Researcher uses a `search(query)` tool and writes notes. Writer reads notes + emits a draft (no tools). Critic reads the draft + writes a critique (no tools). Each node appends its name to `state['handoffs']`. Validator runs each in isolation against mocked LLM responses + asserts the expected state mutation.",
      learningObjective: "Implement focused specialist agents with narrow tool surfaces and explicit handoff tracking.",
      requiredSkill: "Async OpenAI client + focused prompts + LangGraph node contract",
      starterCode: SRC(`# specialists.py
from openai import AsyncOpenAI
from .state import State

oai = AsyncOpenAI()

RESEARCHER_SYS = "You are a research analyst. Use search(query) to gather facts. Emit terse notes."
WRITER_SYS = "You are an analyst-note writer. Given research notes, draft a 3-paragraph note."
CRITIC_SYS = "You are a critic. Given a draft, list 1-3 concrete revisions OR say 'approved.'"

async def researcher(s: State) -> State:
    # TODO: call LLM with the search tool spec, accumulate notes into s['research_notes'].
    # Return partial state update: {'research_notes': new_notes, 'handoffs': s['handoffs'] + ['researcher']}.
    raise NotImplementedError

async def writer(s: State) -> State:
    # TODO: prompt with the research_notes; LLM returns the draft text.
    raise NotImplementedError

async def critic(s: State) -> State:
    # TODO: prompt with s['draft']; LLM returns critique text.
    raise NotImplementedError
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "researcher node writes to research_notes and appends 'researcher' to handoffs; returns a partial state diff (not the full state).",
          "writer node writes to draft and appends 'writer' to handoffs.",
          "critic node writes to critique and appends 'critic' to handoffs.",
        ],
      }),
      expectedOutputs: { mutatedFields: ["research_notes", "draft", "critique"] },
      datasetRefs: ["fixtures/specialists_smoke.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Each specialist returns a partial state diff: only the fields it mutated + handoffs append.",
          "researcher: {'research_notes': s['research_notes'] + new_notes, 'handoffs': s['handoffs'] + ['researcher']}",
          "writer: {'draft': content_string, 'handoffs': s['handoffs'] + ['writer']}",
          "critic: {'critique': content_string, 'handoffs': s['handoffs'] + ['critic']}",
          "Don't return s itself — let LangGraph's reducer merge.",
        ],
        successFeedback: "Three focused specialists, each with a small contract. New specialist = new node + same pattern.",
        failureFeedback: "Common slips: gave all three specialists access to all tools (defeats the architecture); returned the FULL state (LangGraph reducer accepts it but traces are unreadable).",
        portfolioRelevance: "Narrow tool surfaces are a hire signal — most candidates over-tool agents and then complain they 'wander'. The fix is structural, not prompt-engineering.",
        finalExplanation: "Specialization works for agents the same way it works for org charts: a 'do everything' agent has too much surface to optimize. Three focused agents are easier to prompt, test, and debug than one omnibus one.",
        misconceptionToWatchFor: "Letting the Writer call search(). Now you have two researchers and the critic has unclear authority. Resist tool sprawl.",
      }),
    },
    {
      stepNumber: 3,
      title: "Supervisor router with a typed decision",
      instructionMd:
        "Implement `supervisor(state)` that returns a `Routing(next: Literal['researcher','writer','critic','END'])` decision. Use OpenAI JSON-mode + a system prompt explaining the state shape + the 4 options. The supervisor NEVER mutates the blackboard — only routes. Validator gives the supervisor three crafted states (empty → research; with notes no draft → write; with critique containing 'approved.' → END) and asserts each routing.",
      learningObjective: "Implement a typed-router supervisor whose only job is to pick the next node deterministically.",
      requiredSkill: "OpenAI JSON mode + Literal Pydantic enum + LangGraph conditional edges",
      starterCode: SRC(`# supervisor.py
import json
from typing import Literal
from pydantic import BaseModel
from openai import AsyncOpenAI
from .state import State

class Routing(BaseModel):
    next: Literal["researcher", "writer", "critic", "END"]
    reason: str

SUPERVISOR_SYS = """You route between researcher/writer/critic/END.
Empty research_notes -> researcher.
Notes present + no draft -> writer.
Draft present + no critique -> critic.
Critique contains 'approved.' -> END.
Otherwise -> writer (revise).
Return JSON {next, reason}."""

oai = AsyncOpenAI()

async def supervisor(state: State) -> Routing:
    summary = {
        "has_notes": bool(state["research_notes"]),
        "has_draft": state["draft"] is not None,
        "critique": state["critique"],
    }
    # TODO: call gpt-4o-mini with JSON mode + the system + summary as user.
    # Parse with Routing.model_validate(json.loads(...)).
    raise NotImplementedError
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "supervisor(empty_state) returns Routing with next='researcher'.",
          "supervisor(state_with_notes_but_no_draft) returns Routing with next='writer'.",
          "supervisor(state_where_critique_contains_'approved.') returns Routing with next='END'.",
          "The supervisor NEVER mutates the blackboard — it only returns a Routing decision.",
        ],
      }),
      expectedOutputs: { routes: ["researcher", "writer", "END"] },
      datasetRefs: ["fixtures/supervisor_scenarios.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "The supervisor's job is one decision, returned as a Literal. Anything else is scope creep.",
          "Use response_format={'type':'json_object'} so the model emits valid JSON.",
          "Parse + validate: Routing.model_validate(json.loads(resp.choices[0].message.content)).",
          "resp = await oai.chat.completions.create(model='gpt-4o-mini', response_format={'type':'json_object'}, messages=[{'role':'system','content':SUPERVISOR_SYS},{'role':'user','content':json.dumps(summary)}])\nreturn Routing.model_validate(json.loads(resp.choices[0].message.content))",
          "(see hints above)",
        ],
        successFeedback: "Supervisor is typed — termination is deterministic, not 'maybe the LLM stops'.",
        failureFeedback: "Common slips: let the supervisor return free text (now you can't conditionally edge); let supervisor mutate state (now you have two writers of the same field — race conditions).",
        portfolioRelevance: "'Typed routing decision' is the textbook 2026 LangGraph pattern. Saying it in an interview signals you've read the LangGraph docs, not just imported it.",
        finalExplanation: "The supervisor pattern works precisely because the routing decision is a tiny, typed scope. Anything more and you reinvent the omnibus agent you were trying to escape.",
        misconceptionToWatchFor: "Letting the supervisor 'do a little research before deciding'. That's how supervisors become specialists and the architecture collapses.",
      }),
    },
    {
      stepNumber: 4,
      title: "Iteration cap + per-specialist quotas",
      instructionMd:
        "Add safeguards: MAX_ITERATIONS=12 (kill the run if the graph hasn't ended), MAX_REVISIONS=3 (after 3 critic→writer cycles, force END). Wire these into the conditional edge function so the graph terminates even when the supervisor is confused. Validator runs a graph where the critic NEVER approves + asserts the graph ends within MAX_ITERATIONS + revisions == MAX_REVISIONS.",
      learningObjective: "Prevent infinite agent loops with hard iteration + per-role quotas.",
      requiredSkill: "LangGraph conditional edges + invariant enforcement",
      starterCode: SRC(`# graph.py
from langgraph.graph import StateGraph, END
from .state import State, initial_state
from .specialists import researcher, writer, critic
from .supervisor import supervisor

MAX_ITERATIONS = 12
MAX_REVISIONS = 3

def route(state: State) -> str:
    if len(state["handoffs"]) >= MAX_ITERATIONS:
        return END
    # TODO: if revisions >= MAX_REVISIONS, return END.
    # else: call supervisor synchronously? No — pre-computed in supervisor_node.
    # Simplest: store the decision on state['next'] in a supervisor_node, and route reads it.
    raise NotImplementedError

async def supervisor_node(s: State) -> State:
    decision = await supervisor(s)
    return {"_next": decision.next, "handoffs": s["handoffs"] + ["supervisor"]}

def build():
    g = StateGraph(State)
    g.add_node("supervisor", supervisor_node)
    g.add_node("researcher", researcher)
    g.add_node("writer", writer)
    g.add_node("critic", critic)
    g.set_entry_point("supervisor")
    g.add_conditional_edges("supervisor", route, {"researcher":"researcher","writer":"writer","critic":"critic", END:END})
    for n in ("researcher","writer","critic"):
        g.add_edge(n, "supervisor")
    return g.compile()
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "When the critic never returns 'approved.', the graph terminates at revisions == MAX_REVISIONS (3) without requiring human intervention.",
          "The graph also terminates if total handoffs reach MAX_ITERATIONS (12), whichever cap fires first.",
          "The route() function enforces both caps deterministically — it does NOT rely on the supervisor to decide to stop.",
        ],
      }),
      expectedOutputs: { terminatedAt: "MAX_REVISIONS" },
      datasetRefs: ["fixtures/never_approve.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "route() reads s['_next'] (set by supervisor_node) and overrides with END if a cap was exceeded.",
          "if len(state['handoffs']) >= MAX_ITERATIONS: return END",
          "if state.get('revisions', 0) >= MAX_REVISIONS: return END",
          "Bump revisions in the critic node: return {'critique': content, 'revisions': s['revisions'] + 1, ...}.",
          "(see hints above)",
        ],
        successFeedback: "Graph now terminates even when the supervisor is wrong. Production-safe.",
        failureFeedback: "Common slips: relied on the supervisor to know when to stop (it won't); incremented revisions in the supervisor (wrong place); used MAX_ITERATIONS only (lets supervisor spin between researcher/writer forever within the iteration budget).",
        portfolioRelevance: "'Hard termination invariants' is a senior-IC signal. The standard interview probe is 'how do you avoid infinite loops?' — the answer is iteration cap + per-role quotas, both deterministic.",
        finalExplanation: "Agent budgets are like circuit breakers. The supervisor MIGHT stop; the cap WILL. Defense in depth.",
        misconceptionToWatchFor: "Setting MAX_ITERATIONS to a huge number to be 'safe'. The point is to fail fast when the agent is confused — a smaller number that occasionally bails is better than one that lets a failure mode burn $200.",
      }),
    },
    {
      stepNumber: 5,
      title: "LangSmith tracing for every hop",
      instructionMd:
        "Wrap each node with `traceable(name=...)` so every supervisor decision + specialist invocation lands in LangSmith. Also emit a custom 'handoff' event from the supervisor with the chosen `next` and the `reason` so the trace timeline is readable. Validator boots the graph + asserts 5+ spans (supervisor × ≥2 + 3 specialists at minimum).",
      learningObjective: "Trace every hop so multi-agent failures are forensically debuggable.",
      requiredSkill: "LangSmith @traceable + custom span attributes",
      starterCode: SRC(`# tracing.py
import os
os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
os.environ.setdefault("LANGCHAIN_PROJECT", "multi-agent-supervisor")
from langsmith import traceable
from .graph import supervisor_node as _sup, route as _route
from .specialists import researcher as _r, writer as _w, critic as _c

# TODO: wrap each with traceable(name=...) and re-export.
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "Each node (supervisor_node, researcher, writer, critic) is wrapped with traceable(name=...) and the traced versions are used in the graph builder.",
          "Running the graph end-to-end produces at least 5 LangSmith spans (≥2 supervisor calls + 3 specialists at minimum for a single full cycle).",
          "Span names in LangSmith include 'supervisor_node', 'researcher', 'writer', and 'critic'.",
        ],
      }),
      expectedOutputs: { spans: ">=5" },
      datasetRefs: ["fixtures/multi_agent_trace.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Same pattern as the Planner/Executor project — wrap each callable with @traceable.",
          "supervisor_node = traceable(name='supervisor_node')(_sup)",
          "researcher = traceable(name='researcher')(_r); writer = traceable(name='writer')(_w); critic = traceable(name='critic')(_c)",
          "Update the graph builder to import the traced versions instead of the raw ones.",
          "(see hints above)",
        ],
        successFeedback: "Every hop traced. A misrouted graph is now a 30-second LangSmith click instead of an hour of print-statement archaeology.",
        failureFeedback: "Common slips: wrapped the compiled graph (one giant span); set env vars after import; forgot LANGCHAIN_PROJECT and traces dump to 'default'.",
        portfolioRelevance: "A LangSmith URL with multi-agent traces in the README is something recruiters can click and immediately appreciate. Most portfolios skip observability entirely.",
        finalExplanation: "Observability for agents isn't optional in production. Without it, debugging a 12-hop multi-agent failure is hopeless.",
        misconceptionToWatchFor: "Treating LangSmith as 'optional add-on'. The pattern only scales if every hop is traced from day one.",
      }),
    },
  ],
};
