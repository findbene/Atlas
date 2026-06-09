/**
 * Phase 61B/61C — focused authoring check for the net-new
 * `data-engineering-saas-usage-revenue-quality-mart` project. Asserts the
 * task-contract: shape, the 6 rowset candidates, the EXACT Phase 61D flip set
 * (all six rowset steps 1-6 serverGrade:true; zero dark) with no accidental flips,
 * pre-populated columns/expectedRows, H3 honest-claims, and deterministic
 * ordering for multi-row results. Runs in the scripts package's tsx-check idiom.
 *
 *   pnpm --filter @workspace/scripts run check:authored-saas-mart
 */
import { dataEngineeringSaasUsageRevenueQualityMart as P } from "./authored/data-engineering__saas-usage-revenue-quality-mart";
import { NET_NEW_FOR_SLUG_PHASE61B, COURSE_FOR_AUTHORED_SLUG } from "./authored-lineage";

let failures = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    console.error(`  FAIL ${name}`);
    failures++;
  }
}

const ROWSET_KINDS = new Set(["sql_resultset", "csv_set_equal"]);
// H3 honest-claims ceiling — none of these may appear in learner-facing copy.
const BANNED = [
  "verified authorship", "tamper-proof", "tamper proof", "cheat-proof", "cheat proof",
  "100% verified", "job guaranteed", "guaranteed job", "no outside help", "certified professional",
];

const course = COURSE_FOR_AUTHORED_SLUG[P.slug];
check("slug starts with its course", !!course && P.slug.startsWith(course));
check("candidateId matches lineage map", P.candidateId === NET_NEW_FOR_SLUG_PHASE61B[P.slug]);
check("difficulty is intermediate", P.difficulty === "intermediate");
check("7 steps, sequential 1..7",
  P.steps.length === 7 && P.steps.every((s, i) => s.stepNumber === i + 1));

const rowset = P.steps.filter((s) => ROWSET_KINDS.has(s.validationType));
const sql = P.steps.filter((s) => s.validationType === "sql_resultset");
const csv = P.steps.filter((s) => s.validationType === "csv_set_equal");
const contains = P.steps.filter((s) => s.validationType === "contains");
check("6 rowset candidate steps", rowset.length === 6);
check("5 sql_resultset + 1 csv_set_equal", sql.length === 5 && csv.length === 1);
check("1 contains step", contains.length === 1);
check(">= 4 future rowset candidates (task floor)", rowset.length >= 4);

// Phase 61D — ALL SIX rowset steps are now live server-graded. 61C flipped 1/2/5/6;
// 61D closed the two 61C deferrals: step 3 (clean, capped by the 61C max-4 budget)
// and step 4 (HUGEINT deferral fixed by casting the SUM to BIGINT, re-verified).
const FLIPPED = new Set([1, 2, 3, 4, 5, 6]);
let flippedCount = 0;
let darkCount = 0;
for (const s of rowset) {
  const spec = (s.validation as { spec?: Record<string, unknown> }).spec ?? {};
  const cols = spec["columns"] as unknown[] | undefined;
  const rows = spec["expectedRows"] as unknown[][] | undefined;
  const q = String(spec["query"] ?? "").toLowerCase();
  const isServerGrade = spec["serverGrade"] === true;
  if (isServerGrade) flippedCount++; else darkCount++;
  if (FLIPPED.has(s.stepNumber)) {
    check(`step ${s.stepNumber}: serverGrade:true (live server-grade flip)`, isServerGrade);
  } else {
    check(`step ${s.stepNumber}: serverGrade dark (deferred)`, !isServerGrade);
  }
  check(`step ${s.stepNumber}: columns non-empty`, Array.isArray(cols) && cols.length > 0);
  check(`step ${s.stepNumber}: expectedRows non-empty + width matches columns`,
    Array.isArray(rows) && rows.length > 0 &&
    rows.every((r) => Array.isArray(r) && r.length === (cols?.length ?? -1)));
  // deterministic ordering required when the result is more than one row
  if (Array.isArray(rows) && rows.length > 1) {
    check(`step ${s.stepNumber}: multi-row query has ORDER BY`, q.includes("order by"));
  }
}
check("all 6 rowset steps flipped to serverGrade:true", flippedCount === 6);
check("zero rowset steps remain dark", darkCount === 0);

// H3 honest-claims across all learner-facing text.
const text = [
  P.title, P.shortDescription, P.fullDescription,
  ...P.learningObjectives,
  ...P.steps.flatMap((s) => [
    s.title, s.instructionMd, s.learningObjective,
    s.pedagogy.hintLevel1, s.pedagogy.hintLevel2, s.pedagogy.hintLevel3,
    s.pedagogy.hintLevel4, s.pedagogy.hintLevel5,
    s.pedagogy.successFeedback, s.pedagogy.failureFeedback,
    s.pedagogy.finalExplanation, s.pedagogy.portfolioRelevance,
  ]),
].join("\n").toLowerCase();
const hits = BANNED.filter((b) => text.includes(b));
check(`no H3 banned claims in learner-facing copy (${hits.join(", ") || "none"})`, hits.length === 0);

// Phase 61G — the runbook `contains` step must use the canonical `needles` key the
// runtime reads (NOT the dead `mustContainAll`), and no step may falsely claim the
// commit-grader semantically enforces it. (Note: the honest live-rowset copy "on
// Submit the server re-grades your captured result rows" is NOT a false claim — it
// is true for the serverGrade:true steps — so it is deliberately not scanned here.)
const containsStep = P.steps.find((s) => s.validationType === "contains");
const cSpec = (containsStep?.validation as { spec?: Record<string, unknown> } | undefined)?.spec ?? {};
check("contains step uses canonical 'needles' (not the dead 'mustContainAll')",
  Array.isArray(cSpec["needles"]) && (cSpec["needles"] as unknown[]).length > 0 && cSpec["mustContainAll"] === undefined);
const FALSE_ENFORCE = ["server-enforced", "server enforced", "commit-grader evaluates"];
const feHits = FALSE_ENFORCE.filter((p) => text.includes(p));
check(`no false server-enforcement claims (${feHits.join(", ") || "none"})`, feHits.length === 0);

if (failures > 0) {
  console.error(`\n[check:authored-saas-mart] ${failures} failure(s).`);
  process.exit(1);
}
console.log("\n[check:authored-saas-mart] OK — all authoring-contract assertions passed.");
process.exit(0);
