/**
 * Phase 61G — focused check for C2
 * (`analytics-engineer-semantic-layer-with-dbt-and-duckdb`). Guards the 61G
 * contains fix + the server-grade invariant:
 *   - the `contains` step (7) uses the canonical `needles` key the runtime reads
 *     (NOT the dead `mustContainAll`);
 *   - the contains step makes no false server-enforcement claim;
 *   - the server-graded rowset set is unchanged (sql steps 1,2,5 + csv step 3 → [1,2,3,5]).
 *
 * Intentionally does NOT police the C2 `exact` steps (4/6) copy — those are a
 * separately-tracked dead-gate (expected_output NULL → auto-pass) documented as a
 * follow-up in docs/phases/phase-61g-*; fixing `exact` is out of 61G's scope.
 *
 *   pnpm --filter @workspace/scripts run check:authored-c2
 */
import { analyticsEngineerSemanticLayerWithDbtAndDuckdb as P } from "./authored/analytics-engineer__semantic-layer-with-dbt-and-duckdb";

let failures = 0;
function check(name: string, cond: boolean): void {
  if (cond) console.log(`  ok   ${name}`);
  else { console.error(`  FAIL ${name}`); failures++; }
}

const containsStep = P.steps.find((s) => s.validationType === "contains");
check("has a contains step", !!containsStep);

const cSpec = (containsStep?.validation as { spec?: Record<string, unknown> } | undefined)?.spec ?? {};
check("contains step uses canonical 'needles' (not the dead 'mustContainAll')",
  Array.isArray(cSpec["needles"]) && (cSpec["needles"] as unknown[]).length > 0 && cSpec["mustContainAll"] === undefined);

const cInstr = (containsStep?.instructionMd ?? "").toLowerCase();
const FALSE_ENFORCE = ["server-enforced", "server enforced", "commit-grader evaluates"];
const feHits = FALSE_ENFORCE.filter((p) => cInstr.includes(p));
check(`contains step makes no false server-enforcement claim (${feHits.join(", ") || "none"})`, feHits.length === 0);

const serverGraded = P.steps
  .filter((s) => (s.validation as { spec?: { serverGrade?: unknown } }).spec?.serverGrade === true)
  .map((s) => s.stepNumber)
  .sort((a, b) => a - b);
check(`server-graded steps unchanged = [1,2,3,5] (got [${serverGraded.join(",")}])`,
  JSON.stringify(serverGraded) === JSON.stringify([1, 2, 3, 5]));

if (failures > 0) {
  console.error(`\n[check:authored-c2] ${failures} failure(s).`);
  process.exit(1);
}
console.log("\n[check:authored-c2] OK — contains uses needles, no false enforcement claim, server-grade set [1,2,3,5] intact.");
process.exit(0);
