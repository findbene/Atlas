/**
 * Phase 61K diagnostic (throwaway) — inventory self_attest steps whose
 * instructionMd carries misleading validation language. Report-only; prints
 * each flagged step + the matched phrase + a context snippet so the cleanup +
 * the final lint can be tuned precisely. NOT a gate.
 */
import { AUTHORED_PROJECTS } from "./authored";

// Phrase classes that imply automated/Atlas validation. Each is checked against
// instructionMd; a match is suppressed if a negation word sits within ~24 chars
// before it (so "Atlas does not run/verify/grade" and "Atlas does NOT check" pass).
const MISLEADING: { label: string; re: RegExp }[] = [
  { label: "validator runs/asserts/drives/hits/checks", re: /\bvalidator (runs|asserts|drives|hits|checks|verifies|evaluates|parses|executes)\b/gi },
  { label: "server verifies/confirms/enforces", re: /\bserver[- ](verifies|confirms|enforced|enforces|grades|checks)\b/gi },
  { label: "commit-grader", re: /\bcommit[- ]grader\b/gi },
  { label: "Atlas verifies/grades/checks/validates/confirms/runs", re: /\bAtlas (verifies|grades|validates|confirms|runs|executes|checks)\b/gi },
  { label: "graded/validated by", re: /\b(graded|validated|verified) by (atlas|the (server|grader|validator|commit))\b/gi },
  { label: "automated check/validation/grading", re: /\bautomated (check|validation|grading|grader|test)\b/gi },
  { label: "passes/runs the tests (auto)", re: /\b(the grader|atlas) (runs|passes|executes) (the )?tests\b/gi },
  { label: "asserts/checks that (Atlas-subject)", re: /\b(the )?(grader|validator|server) (asserts|checks|verifies|confirms) that\b/gi },
];

const NEG = /(does not|doesn't|do not|don't|never|no longer|not |n't )\s*$/i;

let flagged = 0;
let scanned = 0;
const perPhrase = new Map<string, number>();
const fileSet = new Set<string>();

const perField = new Map<string, number>();

for (const p of AUTHORED_PROJECTS) {
  for (const s of p.steps) {
    if (s.validation?.kind !== "self_attest") continue;
    scanned++;
    const ped = (s.pedagogy ?? {}) as Record<string, unknown>;
    const fields: [string, string][] = [
      ["instructionMd", s.instructionMd ?? ""],
      ["description", (s.validation?.description ?? "") as string],
      ["successFeedback", String(ped.successFeedback ?? "")],
      ["failureFeedback", String(ped.failureFeedback ?? "")],
      ["finalExplanation", String(ped.finalExplanation ?? "")],
      ["hintLevel5", String(ped.hintLevel5 ?? "")],
    ];
    for (const [field, text] of fields) {
      for (const { label, re } of MISLEADING) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
          const before = text.slice(Math.max(0, m.index - 24), m.index);
          if (NEG.test(before)) continue; // negated/honest → ok
          flagged++;
          fileSet.add(p.slug);
          perPhrase.set(label, (perPhrase.get(label) ?? 0) + 1);
          perField.set(field, (perField.get(field) ?? 0) + 1);
          if (field !== "instructionMd") {
            const ctx = text.slice(Math.max(0, m.index - 24), m.index + m[0].length + 30).replace(/\s+/g, " ");
            console.log(`  ${p.slug} s${s.stepNumber} {${field}} [${label}] …${ctx}…`);
          }
        }
      }
    }
  }
}

console.log(`\n=== Phase 61K self_attest copy diagnostic ===`);
console.log(`self_attest steps scanned: ${scanned}`);
console.log(`flagged matches: ${flagged}   across ${fileSet.size} project(s)`);
console.log(`by phrase class:`);
for (const [k, v] of [...perPhrase.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${v.toString().padStart(3)}  ${k}`);
console.log(`by field:`);
for (const [k, v] of [...perField.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${v.toString().padStart(3)}  ${k}`);
