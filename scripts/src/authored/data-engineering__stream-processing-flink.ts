/**
 * Phase 9 — batch-1 upgrade. data-engineering / stream-processing (Flink).
 * Synthetic candidate 01047b6e-bc8c-46dc-8044-e022915f2002 (source=phase9_upgrade).
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const dataEngineeringStreamProcessingFlink: AuthoredProject = {
  slug: "data-engineering-stream-processing-flink",
  candidateId: "01047b6e-bc8c-46dc-8044-e022915f2002",
  title: "Stream Processing Fundamentals — Windows, Watermarks, and Exactly-Once",
  shortDescription:
    "Build the streaming primitives that power Uber, Stripe Sigma, and Netflix Mantis: event-time windows, watermark-driven late-data handling, stateful aggregation, and an explicit exactly-once design.",
  fullDescription:
    "Streaming systems lose data in subtle ways: late events get bucketed wrong, watermarks advance too aggressively, and 'exactly-once' becomes 'at-least-once with extra steps' without a transactional sink. You'll implement each primitive in pure Python (so you understand what PyFlink/Spark Streaming do under the hood), then write the reasoning that distinguishes 'I configured the operator' from 'I designed the contract'.",
  language: "python",
  difficulty: "advanced",
  techStack: ["PyFlink", "Apache Flink", "Kafka", "Python"],
  tags: ["flink", "streaming", "windows", "watermarks", "exactly-once"],
  learningObjectives: [
    "Distinguish event-time vs processing-time and pick the right one per operator.",
    "Bucket events into tumbling and sliding windows by event-time epoch math.",
    "Drive late-data handling with watermarks that trade lateness tolerance for latency.",
    "Build a stateful aggregator that emits windowed results in window-end order.",
    "Reason explicitly about exactly-once across heterogeneous sinks (Kafka + Postgres).",
  ],
  estimatedMinutes: 600,
  xpReward: 700,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "A real-time analytics team has a job that 'works' until the upstream load balancer drops events out of order. Numbers diverge from batch. You're brought in to make the streaming math correct AND explain it to skeptical stakeholders.",
    hiringRelevance2026:
      "Event-time + watermarks + exactly-once are the three concepts every streaming interview drills. Most candidates can 'use' them via the operator; few can defend them. This project drills the defence.",
    readmeOutline: [
      "Overview & Scenario", "Event-time vs processing-time",
      "Step 1 tumbling windows", "Step 2 sliding windows",
      "Step 3 watermarks", "Step 4 stateful aggregation",
      "Step 5 exactly-once writeup",
      "Validation", "Why this matters in interviews", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "GitHub repo: pure-Python implementations of windowing/watermark/stateful-aggregation that match the PyFlink contract one-to-one, plus a 500-word exactly-once design note distinguishing 'Flink-internal' from 'cross-sink' guarantees.",
    portfolioRelevance:
      "Recruiters can run the tests locally (no Flink install) and SEE you understand the primitives. Most CVs claim 'experience with Flink'; a tested algorithm proves it.",
    repoUrl: "https://github.com/<your-handle>/streaming-primitives",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Tumbling windows by event-time",
      instructionMd:
        "Implement `tumbling_window(event_ms, window_ms)` returning the window-start epoch the event belongs to (`event_ms // window_ms * window_ms`). Self-verify by calling the function on 4 events spanning 2 window boundaries and confirming the results.",
      learningObjective: "Bucket events deterministically by event-time so identical events always land in the same window — anywhere, on replay, after a restart.",
      requiredSkill: "Epoch arithmetic + tumbling-window contract",
      starterCode: SRC(`def tumbling_window(event_ms, window_ms):
    if window_ms <= 0:
        raise ValueError('window_ms must be > 0')
    # TODO: return (event_ms // window_ms) * window_ms
    pass
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: [
          "tumbling_window(0, 1000) returns 0 and tumbling_window(999, 1000) returns 0 (both land in the [0, 1000) bucket).",
          "tumbling_window(1000, 1000) returns 1000 and tumbling_window(1999, 1000) returns 1000 (both land in the [1000, 2000) bucket).",
          "tumbling_window(event_ms=0, window_ms=0) raises ValueError (window_ms must be > 0).",
          "The formula is (event_ms // window_ms) * window_ms — integer arithmetic only, no float.",
        ],
      }),
      expectedOutputs: { windows: [0, 0, 1000, 1000] },
      datasetRefs: ["fixtures/tumbling_window_events.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Integer division (`//`) over the event-time gives you the bucket index; multiply back for the start epoch.",
          "Window-start (inclusive) and window-end (exclusive) — `[start, start+window_ms)`. Easy to off-by-one if you flip them.",
          "Use the EVENT timestamp (`event_ms`), not the processing wall clock. That's the whole point of event-time.",
          "For sub-second windows in Python, multiply timestamps to microseconds first to avoid float drift.",
          "Reference: return (event_ms // window_ms) * window_ms.",
        ],
        successFeedback: "Determinism achieved: the same event always lands in the same window on any replica.",
        failureFeedback: "Common slips: used wall-clock time (windows non-deterministic across replicas); inclusive on both ends (a 1000ms boundary event counts twice); float ms (precision loss).",
        portfolioRelevance: "Knowing windows are deterministic by event-time math is the bedrock of every streaming interview answer.",
        finalExplanation: "Event-time windowing makes streaming replay-safe. Re-running the same events produces the same windows, full stop.",
        misconceptionToWatchFor: "Believing tumbling windows are 'wall-clock' buckets. They're event-time buckets — wall-clock has nothing to do with them.",
      }),
    },
    {
      stepNumber: 2,
      title: "Sliding windows",
      instructionMd:
        "Implement `sliding_windows(event_ms, window_ms, slide_ms)` returning the list of window-start epochs the event belongs to. (A 10s window sliding every 1s puts each event in 10 overlapping windows.) Self-check: call sliding_windows(1500, 1000, 200) and confirm the result is [600, 800, 1000, 1200, 1400].",
      learningObjective: "Build overlapping windows so per-event metrics can be reported at sub-window cadence.",
      requiredSkill: "Sliding-window enumeration without leaks",
      starterCode: SRC(`def sliding_windows(event_ms, window_ms, slide_ms):
    if window_ms <= 0 or slide_ms <= 0:
        raise ValueError('positive ms required')
    if window_ms % slide_ms != 0:
        raise ValueError('window_ms must be a multiple of slide_ms')
    # TODO: first_start = ((event_ms - window_ms) // slide_ms + 1) * slide_ms
    # TODO: enumerate starts at slide_ms intervals while start <= event_ms
    # return [start for start in range(first_start, event_ms+1, slide_ms)]
    pass
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Call sliding_windows(1500, 1000, 200) and confirm the result is [600, 800, 1000, 1200, 1400]. Call sliding_windows(0, 1000, 500) and confirm the result is [0]. Verify that a non-divisible (window_ms % slide_ms != 0) call raises ValueError.",
      }),
      expectedOutputs: { case1: [600, 800, 1000, 1200, 1400], case2: [0] },
      datasetRefs: ["fixtures/sliding_window_events.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "An event is in window [start, start+window_ms) when start <= event < start+window_ms.",
          "Reject non-divisible (window_ms % slide_ms != 0) upfront — it leaves gaps Flink users hit weekly.",
          "Window count per event = window_ms / slide_ms exactly when slide divides window. Easy mental check.",
          "Negative event times (clock skew at the source) — return [] or raise; don't silently emit nonsense.",
          "Reference: first_start = ((event_ms - window_ms + slide_ms) // slide_ms) * slide_ms; return list(range(max(0, first_start), event_ms+1, slide_ms)).",
        ],
        successFeedback: "Sliding windows now Just Work and your downstream gets one event per slide_ms regardless of input rate.",
        failureFeedback: "Common slips: allowed non-divisible windows (sparse coverage); forgot to clamp at 0 (negative window starts); included start = event+slide (off-by-one over the right edge).",
        portfolioRelevance: "Sliding-window logic is the heart of every 'moving-average' dashboard. Implementing it cleanly is a clear streaming-DE signal.",
        finalExplanation: "Sliding windows give smoother metrics than tumbling at the cost of N-x state. The slide/window ratio is the tunable.",
        misconceptionToWatchFor: "Believing sliding and tumbling are different operators. Tumbling is just sliding with slide_ms == window_ms.",
      }),
    },
    {
      stepNumber: 3,
      title: "Watermarks for late data",
      instructionMd:
        "Implement `BoundedOutOfOrdernessTracker(allowed_lateness_ms)` with `observe(event_ms)` and `watermark()` (returns max_seen - allowed_lateness, or None before any observations). The watermark advances monotonically (never goes backward, even on a late observation). Self-check: drive your tracker through a sequence including late events — confirm the watermark never moves backward when a late observation arrives.",
      learningObjective: "Implement the standard watermark contract: bounded-out-of-orderness with monotonic advance.",
      requiredSkill: "Streaming watermark semantics + monotonic state",
      starterCode: SRC(`class BoundedOutOfOrdernessTracker:
    def __init__(self, allowed_lateness_ms):
        if allowed_lateness_ms < 0:
            raise ValueError('allowed_lateness_ms must be >= 0')
        self.allowed_lateness_ms = allowed_lateness_ms
        self.max_ts = None
    def observe(self, event_ms):
        # TODO: self.max_ts = event_ms if self.max_ts is None else max(self.max_ts, event_ms)
        pass
    def watermark(self):
        # TODO: return None if self.max_ts is None else self.max_ts - self.allowed_lateness_ms
        pass
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Construct BoundedOutOfOrdernessTracker(allowed_lateness_ms=5000). Confirm watermark() returns None before any observations. Call observe(1000000), observe(900000), observe(1005000) in sequence and confirm watermark() returns 995000, 995000, 1000000 respectively (monotonic — late event does not move the watermark backward).",
      }),
      expectedOutputs: { watermarks: [995000, 995000, 1000000] },
      datasetRefs: ["fixtures/watermark_events.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Track only the MAX event_ms seen. A late event can't move the watermark backward.",
          "Watermark = promise: 'no more events with ts <= W'. allowed_lateness is the slack you give it.",
          "Return None before any observations so the operator knows it has no commitments yet.",
          "Trade-off: higher allowed_lateness = tolerate more late events but slower window-firing.",
          "Reference: self.max_ts = event_ms if self.max_ts is None else max(self.max_ts, event_ms); return None if self.max_ts is None else self.max_ts - self.allowed_lateness_ms.",
        ],
        successFeedback: "Your watermark is monotonic. Windows can fire safely; downstream operators can advance their own state.",
        failureFeedback: "Common slips: let watermark go backward on late event (downstream operators break); used current_ts instead of max_ts (same bug); returned 0 before first observe (downstream fires empty windows).",
        portfolioRelevance: "Watermark semantics are THE concept streaming interviewers probe hardest. A working tracker + correct test cases is the strongest possible answer.",
        finalExplanation: "Watermarks are how you keep streaming honest. Without them, late events silently corrupt your aggregates.",
        misconceptionToWatchFor: "Believing the watermark equals the latest event time. It's intentionally LAGGING by allowed_lateness — that's the whole point.",
      }),
    },
    {
      stepNumber: 4,
      title: "Stateful windowed aggregation",
      instructionMd:
        "Compose the primitives: `stream_aggregate(events, window_ms, allowed_lateness_ms)` accepts an iterable of `(event_ms, key)` tuples and yields `(window_start, count)` for each window as the watermark passes its end. Events past the closed-window watermark are dropped. Self-check: drive your function through the 12-event sequence including 2 late events and confirm the emission order, window counts, and late-event drop count match your manual trace.",
      learningObjective: "Wire windows + watermarks + state into one operator that matches Flink's semantics.",
      requiredSkill: "Stateful streaming operator + emission ordering + late-event drop policy",
      starterCode: SRC(`from collections import defaultdict

def stream_aggregate(events, window_ms, allowed_lateness_ms):
    pending = defaultdict(int)
    closed_through = -1   # largest window-end already emitted
    max_ts = None

    for ev_ms, _key in events:
        wk = (ev_ms // window_ms) * window_ms
        window_end = wk + window_ms

        # TODO: drop events whose window has already closed (window_end <= closed_through)
        # TODO: update max_ts; compute watermark = max_ts - allowed_lateness_ms
        # TODO: count: pending[wk] += 1
        # TODO: yield + remove every window whose end <= watermark, in window-start order

        pass

    for wk in sorted(pending):
        yield wk, pending[wk]
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "Run stream_aggregate with the 12-event sequence ([100,'a'],[200,'b'],[950,'c'],[1100,'d'],[1200,'e'],[2100,'f'],[2300,'g'],[3100,'h'],[3200,'i'],[3300,'j'],[50,'lateA'],[1050,'lateB']), window_ms=1000, allowed_lateness_ms=500. Confirm exactly 3 windows are emitted in window-start order and exactly 2 late events are dropped (not counted into any window). Verify the emitted (window_start, count) tuples match your manual trace.",
      }),
      expectedOutputs: { emittedWindows: 3, droppedEvents: 2 },
      datasetRefs: ["fixtures/stream_agg_sequence.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Maintain `closed_through` so late events for already-emitted windows are dropped explicitly (vs silently incrementing closed buckets).",
          "Emit in window-start order so downstream operators see windows monotonically advance.",
          "Drain pending windows at end-of-stream (the final for-loop) — otherwise the last events vanish.",
          "Defaultdict(int) is the simplest accumulator for counts. Swap for a different reducer if you're computing sums or quantiles.",
          "Reference: if window_end <= closed_through: continue; pending[wk] += 1; max_ts = ...; wm = max_ts - allowed_lateness_ms; for k in sorted(pending): if k + window_ms <= wm: yield k, pending.pop(k); closed_through = k + window_ms.",
        ],
        successFeedback: "Your operator matches Flink's contract: deterministic windows, monotonic watermarks, explicit late-drop. Replay-safe.",
        failureFeedback: "Common slips: counted late events into closed windows (silently wrong); emitted in insertion order, not window order (downstream confused); forgot to drain at end-of-stream (lost final windows).",
        portfolioRelevance: "Writing a stateful streaming operator from scratch — one that you can defend in detail — is the strongest possible streaming-DE signal. Most candidates can configure; few can build.",
        finalExplanation: "Stateful aggregation IS streaming. Once you've built one correctly, every Flink/Spark operator becomes 'this same pattern with more knobs'.",
        misconceptionToWatchFor: "Believing 'use Flink' makes correctness automatic. The operator still has to make the right late-drop and emission-order choices — those are config decisions.",
      }),
    },
    {
      stepNumber: 5,
      title: "Exactly-once across heterogeneous sinks — write the contract",
      instructionMd:
        "Write a 200-400 word Markdown note (return as a Python string) covering: (1) why at-least-once is easier than exactly-once; (2) why the sink must participate in the checkpoint protocol; (3) one concrete scenario where Kafka+Postgres exactly-once is harder than within Flink alone (XA, idempotent upserts, or 2PC tradeoffs). Atlas checks that the required evidence markers are present in your submission — not that the note is otherwise correct, and not your authorship or competence. The word-count range is guidance, not a graded gate. Required markers: 'checkpoint' and 'idempot' (covers idempotent/idempotency) must appear; your note should also reference at least one of Kafka or Postgres to ground the cross-sink discussion, though Atlas does not enforce that last requirement.",
      learningObjective: "Defend an exactly-once design in plain prose — the actual interview test.",
      requiredSkill: "Streaming design literacy + clear technical writing",
      starterCode: SRC(`def exactly_once_note():
    """Return a 200-400 word Markdown note. The validator checks length and key terms."""
    return (
        "## Exactly-once across heterogeneous sinks\\n\\n"
        "TODO — replace this placeholder with a real 200-400 word note covering:\\n"
        "1. Why at-least-once is easier than exactly-once.\\n"
        "2. Why the sink must participate in the checkpoint protocol.\\n"
        "3. One concrete Kafka+Postgres scenario where cross-sink exactly-once is harder than Flink-internal.\\n"
    )
`),
      validationType: "contains",
      stepType: "writeup",
      validation: validationConfig("contains", "Atlas checks that the required evidence markers are present in your submission — not that the note is otherwise correct, and not your authorship or competence. Word-count guidance (200-400 words) and the Kafka/Postgres cross-sink requirement are not enforced by the grader. Markers 'checkpoint' and 'idempot' must both appear.", {
        needles: ["checkpoint", "idempot"],
      }),
      expectedOutputs: { passesWordCount: true, containsRequiredConcepts: true },
      datasetRefs: ["fixtures/exactly_once_rubric.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Start with the contract: 'exactly-once' is a STATE GUARANTEE, not a delivery guarantee.",
          "At-least-once + idempotent sink = exactly-once outcomes. That's the cheap path; spell it out.",
          "Checkpoints freeze operator state durably; transactional sinks commit only when their checkpoint commits. That's the integration story.",
          "For the heterogeneous case: Kafka transactional producer + Postgres COMMIT can't share a 2PC coordinator out of the box. Either you build one, accept idempotent at-least-once, or use a single transactional system.",
          "Reference structure: TL;DR (1 paragraph) → 3 numbered sections (1 para each) → 1 sentence 'in practice we...'.",
        ],
        successFeedback: "Your note holds up to interview pressure. You can defend the design without falling back to 'Flink handles it'.",
        failureFeedback: "Common slips: claimed Flink delivers exactly-once cross-sink out of the box (false); skipped the checkpoint protocol detail; described 2PC without explaining who plays coordinator.",
        portfolioRelevance: "Written communication on streaming guarantees is the rare and most valued senior-DE skill. A 400-word note like this often outperforms a 4-screen diagram.",
        finalExplanation: "Exactly-once is a system-design contract, not a tickbox. Spell it out for each sink or you DON'T have it.",
        misconceptionToWatchFor: "Believing 'exactly-once' is a flag on the job. It's an agreement between the engine and every sink. Disagree → at-least-once.",
      }),
    },
  ],
};
