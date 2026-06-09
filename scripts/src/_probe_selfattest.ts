import { AUTHORED_PROJECTS } from "./authored";

// Independent adversarial scan: phrases that imply automated grading on a self_attest step.
const PATTERNS: [string, RegExp][] = [
  ["Validator <verb>", /\bvalidator\s+(runs|asserts|drives|hits|checks|verifies|evaluates|parses|executes)\b/i],
  ["Atlas <grades>", /\bAtlas\s+(checks|verifies|grades|validates|confirms|runs|executes|asserts|evaluates|enforces|drives)\b/i],
  ["server-enforced/...", /\bserver[- ](verifies|confirms|enforced|enforces|grades|checks|runs)\b/i],
  ["commit-grader", /\bcommit[- ]grader\b/i],
  ["automated validation", /\bautomated\s+(check|validation|grading|grader)\b/i],
  ["graded/validated by", /\b(graded|validated|verified)\s+by\s+(atlas|the\s+(server|grader|commit|validator))\b/i],
  ["the grader <verb>", /\bthe\s+grader\s+(runs|asserts|checks|verifies|evaluates|executes)\b/i],
  ["we run/check your", /\bwe\s+(run|check|verify|grade|execute|validate)\b/i],
  ["this is checked/graded", /\b(is|will be)\s+(checked|graded|verified|validated|enforced)\s+(automatically|by|on submit|server)/i],
];

let total = 0, flaggedSteps = 0;
for (const p of AUTHORED_PROJECTS) {
  for (const s of (p as any).steps ?? []) {
    if (s.validation?.kind !== "self_attest") continue;
    total++;
    const text = (s.instructionMd ?? "") + "\n[DESC]" + (s.validation?.description ?? "");
    const hits: string[] = [];
    for (const [name, re] of PATTERNS) {
      const m = text.match(re);
      if (m) hits.push(`${name}::${m[0]}`);
    }
    if (hits.length) {
      flaggedSteps++;
      console.log(`FLAG ${p.slug} step${s.stepNumber}: ${hits.join(" | ")}`);
    }
  }
}
console.log(`\nself_attest steps scanned: ${total}; flagged by adversarial scan: ${flaggedSteps}`);
