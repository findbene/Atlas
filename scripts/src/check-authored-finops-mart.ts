/**
 * Phase 61F — focused authoring check for the net-new
 * `cloud-data-engineer-finops-cost-quality-mart` project. Asserts the
 * task-contract: shape, the 6 rowset candidates ALL DARK (serverGrade:false —
 * 61F flips nothing live), pre-populated columns/expectedRows, integer-only
 * rowset outputs (no floats / tolerance dependence), deterministic ordering on
 * multi-row results, H3 honest-claims, and no expectedRows values leaked into
 * learner-facing instructions/hints. Runs in the scripts tsx-check idiom.
 *
 *   pnpm --filter @workspace/scripts run check:authored-finops-mart
 */
import { cloudDataEngineeringFinopsCostQualityMart as P } from "./authored/cloud-data-engineering__finops-cost-quality-mart";
import { NET_NEW_FOR_SLUG_PHASE61F, COURSE_FOR_AUTHORED_SLUG } from "./authored-lineage";

let failures = 0;
function check(name: string, cond: boolean): void {
  if (cond) console.log(`  ok   ${name}`);
  else { console.error(`  FAIL ${name}`); failures++; }
}

const ROWSET_KINDS = new Set(["sql_resultset", "csv_set_equal"]);
const BANNED = [
  "verified authorship", "tamper-proof", "tamper proof", "cheat-proof", "cheat proof",
  "100% verified", "job guaranteed", "guaranteed job", "no outside help", "certified professional",
];

const course = COURSE_FOR_AUTHORED_SLUG[P.slug];
check("slug starts with its course", !!course && P.slug.startsWith(course));
check("course is cloud-data-engineer", course === "cloud-data-engineer");
check("candidateId matches lineage map", P.candidateId === NET_NEW_FOR_SLUG_PHASE61F[P.slug]);
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
check(">= 5 dark rowset candidates (task floor)", rowset.length >= 5);

// 61F flips NOTHING live — every rowset candidate must be DARK.
let darkCount = 0, liveCount = 0;
for (const s of rowset) {
  const spec = (s.validation as { spec?: Record<string, unknown> }).spec ?? {};
  const cols = spec["columns"] as unknown[] | undefined;
  const rows = spec["expectedRows"] as unknown[][] | undefined;
  const q = String(spec["query"] ?? "").toLowerCase();
  const isServerGrade = spec["serverGrade"] === true;
  if (isServerGrade) liveCount++; else darkCount++;
  check(`step ${s.stepNumber}: serverGrade:false (DARK — 61F flips nothing live)`, !isServerGrade);
  check(`step ${s.stepNumber}: columns non-empty`, Array.isArray(cols) && cols.length > 0);
  check(`step ${s.stepNumber}: expectedRows non-empty + width matches columns`,
    Array.isArray(rows) && rows.length > 0 &&
    rows.every((r) => Array.isArray(r) && r.length === (cols?.length ?? -1)));
  // every rowset cell must be an integer or a string — no floats / tolerance dependence.
  const cellsTypeStable = (rows ?? []).every((r) =>
    r.every((v) => typeof v === "string" || (typeof v === "number" && Number.isInteger(v))));
  check(`step ${s.stepNumber}: expectedRows are integers/strings only (no floats)`, cellsTypeStable);
  // deterministic ordering required when the result is more than one row
  if (Array.isArray(rows) && rows.length > 1) {
    check(`step ${s.stepNumber}: multi-row query has ORDER BY`, q.includes("order by"));
  }
}
check("exactly 0 rowset steps are live serverGrade:true", liveCount === 0);
check("all 6 rowset steps stay dark", darkCount === 6);

// No expectedRows numeric values leaked into learner-facing instructions/hints.
// (The exact expected counts must not appear as the literal answer in the copy.)
const learnerText = P.steps.flatMap((s) => [
  s.instructionMd, ...[
    s.pedagogy.hintLevel1, s.pedagogy.hintLevel2, s.pedagogy.hintLevel3,
    s.pedagogy.hintLevel4, s.pedagogy.hintLevel5,
  ],
]).join("\n");
// Collect every expectedRows numeric value across rowset steps, then ensure none
// of the distinctive (>= 1000) cent totals appears verbatim in the learner copy.
const leakNumbers = new Set<number>();
for (const s of rowset) {
  const rows = ((s.validation as { spec?: { expectedRows?: unknown[][] } }).spec?.expectedRows) ?? [];
  for (const r of rows) for (const v of r) if (typeof v === "number" && v >= 1000) leakNumbers.add(v);
}
const leaked = [...leakNumbers].filter((n) => learnerText.includes(String(n)));
check(`no expectedRows cent-totals leaked into learner copy (${leaked.join(",") || "none"})`, leaked.length === 0);

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

if (failures > 0) {
  console.error(`\n[check:authored-finops-mart] ${failures} failure(s).`);
  process.exit(1);
}
console.log("\n[check:authored-finops-mart] OK — all authoring-contract assertions passed (6 dark candidates).");
process.exit(0);
