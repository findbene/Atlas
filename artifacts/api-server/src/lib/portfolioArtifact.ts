/**
 * Phase 60A — Evidence-safe portfolio artifact generator (DARK foundation).
 *
 * A PURE, deterministic generator: given a SAFE input model assembled from
 * existing Atlas completion records + project/step metadata, it returns the
 * text of a small recruiter-readable artifact bundle (README.md,
 * VALIDATION_EVIDENCE.md, LIMITATIONS.md, and two optional files).
 *
 * This module is intentionally a leaf with NO database, network, or env
 * access. The route that gathers data and serves the bundle is deferred to
 * Phase 60B; keeping the generator pure makes the no-leak and honesty
 * properties verifiable by unit tests and keeps the dark→expose discipline
 * the rest of the project follows (57A dark → 57B flip; 58A dark → 58B flip).
 *
 * TWO SAFETY PROPERTIES, by construction:
 *
 * 1. No-leak-by-construction. The input model has NO field that can carry a
 *    validation spec — no `validationConfig`, `expectedRows`,
 *    `expectedRowsHash`, reference query, comparator diagnostics, raw
 *    submission, or secret. The only validation fact per step is the
 *    `validationKind` enum value (e.g. "csv_set_equal") and a derived,
 *    narrow `evidenceStatus` boolean-grade label. There is simply no channel
 *    through which an answer key could reach the output.
 *
 * 2. Honest-claims-by-construction (H3). The generated copy makes exactly one
 *    verification claim — the one Atlas is entitled to make:
 *      "Atlas verified that submitted runtime output or artifacts matched
 *       enabled validation checks."
 *    It NEVER claims independent authorship, that the learner had no outside
 *    assistance, cheat-/tamper-resistance, a job/employment guarantee, or
 *    certified professional competence. LIMITATIONS.md states those
 *    non-claims explicitly, worded to avoid the forbidden phrasings even in
 *    negation, so the honesty audit is a simple substring check.
 */

/**
 * How strongly Atlas can vouch for a single completed step. The label is
 * derived purely from the step's validation kind + whether that kind was
 * opted into server grading — it mirrors the runtime `deriveServerGrade`
 * predicate in routes/projects.ts so the artifact's "server-graded" label
 * corresponds exactly to the rows the server actually re-grades on commit.
 */
export type EvidenceStatus =
  | "server-graded"
  | "client-provisional"
  | "self-attested"
  | "unavailable";

/** The two rowset kinds that can be opted into server grading today. */
const SERVER_GRADABLE_KINDS = new Set(["csv_set_equal", "sql_resultset"]);

/**
 * Classify a step's evidence strength. Single source of truth shared by the
 * generator and (in 60B) the assembly route, so the two cannot drift.
 *
 * - rowset kind AND opted in  -> "server-graded" (Atlas re-grades on the server)
 * - "self_attest"             -> "self-attested" (learner marks done; no check)
 * - anything else             -> "client-provisional" (browser-checked; weaker)
 *
 * `serverGradeFlag` is a plain boolean the CALLER extracts from the step's
 * persisted spec. This function never sees the spec object itself — keeping
 * the validationConfig blob out of this module entirely.
 */
export function classifyEvidenceStatus(
  validationKind: string,
  serverGradeFlag: boolean,
): EvidenceStatus {
  if (serverGradeFlag === true && SERVER_GRADABLE_KINDS.has(validationKind)) {
    return "server-graded";
  }
  if (validationKind === "self_attest") return "self-attested";
  return "client-provisional";
}

export interface PortfolioStepEvidence {
  stepNumber: number;
  title: string;
  /** Safe enum value (e.g. "csv_set_equal"); NEVER a spec or expected output. */
  validationKind: string;
  /**
   * Whether this step was opted into server grading. The CALLER derives this
   * boolean from the persisted spec (`validation_config.spec.serverGrade === true`,
   * mirroring `deriveServerGrade`) — this module never sees the spec object. The
   * generator combines it with the kind via `classifyEvidenceStatus`; a stray
   * flag on a non-rowset kind can never upgrade the step.
   */
  serverGradeFlag: boolean;
  /**
   * Durable /submit pass status. A non-passed step (no durable evidence)
   * renders as `unavailable` rather than claiming any grading strength.
   */
  passed: boolean;
  /** ISO timestamp of the durable completion, or null. */
  completedAt: string | null;
  /** Safe pedagogy field; the skill the step exercises. */
  requiredSkill: string | null;
}

export interface PortfolioArtifactInput {
  project: {
    title: string;
    slug: string;
    /** One of the 9 Atlas courses. */
    course: string;
    /** Top job-outcome role, if known. */
    role: string | null;
    difficulty: "beginner" | "intermediate" | "advanced";
    /** Learner-facing summary (projects.short_description); safe to share. */
    summary: string;
    /** Skills practiced (projects.learning_objectives). */
    skills: string[];
    /** Tools / runtime (projects.tech_stack). */
    tools: string[];
    totalSteps: number;
  };
  completion: {
    /** ISO completion timestamp of the project, or null. */
    completedAt: string | null;
    durationSeconds: number | null;
    stepsCompleted: number;
    totalSteps: number;
    /** Count of passed steps that carry a durable submission evidence hash. */
    evidenceHashCount: number;
    totalXpEarned: number;
    /** user_progress.id — already publicly resolvable via /verify/:certId. */
    certId: string;
    /** Relative public verification URL (/verify/:certId). */
    verifyUrl: string;
  };
  steps: PortfolioStepEvidence[];
  /**
   * Whether the learner's full submitted code is durably retrievable. In 60A
   * this is ALWAYS false (Atlas stores only a truncated excerpt + a one-way
   * hash, not the canonical submission) — it drives the LIMITATIONS copy and
   * is the storage requirement handed to Phase 60B.
   */
  submittedCodeAvailable: boolean;
  /** Whether the learner's submitted runtime output is durably retrievable. */
  submittedOutputAvailable: boolean;
  /**
   * Caller-supplied generation timestamp (ISO). Passed IN rather than computed
   * so the generator stays pure and its output is deterministic for tests.
   */
  generatedAtIso: string;
  /** Optional, safe dataset descriptions. Omit if none are known safely. */
  datasets?: { name: string; description: string }[];
}

export interface PortfolioArtifactBundle {
  "README.md": string;
  "VALIDATION_EVIDENCE.md": string;
  "LIMITATIONS.md": string;
  "DATASET_NOTES.md"?: string;
  "LEARNER_REFLECTION_TEMPLATE.md": string;
}

/**
 * The single verification claim Atlas is entitled to make. Centralised so the
 * exact wording is reused (and asserted) everywhere it appears.
 */
const ATLAS_VERIFIED_CLAIM =
  "Atlas verified that submitted runtime output or artifacts matched the enabled " +
  "validation checks for the steps marked **server-graded** below.";

/** Collapse any internal whitespace/newlines to single spaces. */
function flatten(s: string): string {
  return s.replace(/\s*\r?\n\s*/g, " ").trim();
}

/**
 * Sanitize a value for a Markdown table cell: flatten newlines and escape the
 * column delimiter so an author-authored title/skill containing `|` cannot
 * silently break the table. (These are trusted, author-authored fields — this
 * is rendering robustness, not a security boundary.)
 */
function mdCell(s: string): string {
  return flatten(s).replace(/\|/g, "\\|");
}

/** Sanitize a value used as a Markdown heading: flatten + strip leading `#`. */
function mdHeading(s: string): string {
  return flatten(s).replace(/^#+\s*/, "");
}

function bullets(items: string[], emptyNote: string): string {
  if (items.length === 0) return `- ${emptyNote}`;
  return items.map((s) => `- ${flatten(s)}`).join("\n");
}

function formatDuration(seconds: number | null): string | null {
  if (seconds === null || seconds < 0) return null;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
}

const STATUS_LABEL: Record<EvidenceStatus, string> = {
  "server-graded": "server-graded",
  "client-provisional": "client-provisional",
  "self-attested": "self-attested",
  unavailable: "unavailable",
};

function renderReadme(input: PortfolioArtifactInput): string {
  const { project, completion } = input;
  const roleLine = project.role ?? project.course;
  const duration = formatDuration(completion.durationSeconds);

  const completionLines = [
    `- **Steps completed:** ${completion.stepsCompleted} / ${completion.totalSteps}`,
    `- **Steps with durable evidence hash:** ${completion.evidenceHashCount}`,
    `- **XP earned in Atlas:** ${completion.totalXpEarned}`,
    completion.completedAt
      ? `- **Completed:** ${completion.completedAt}`
      : `- **Completed:** not recorded`,
    duration ? `- **Active time (first step → completion):** ${duration}` : null,
    `- **Verify this completion:** ${completion.verifyUrl}`,
  ].filter((l): l is string => l !== null);

  return `# ${mdHeading(project.title)}

> Portfolio artifact generated by **Atlas**, a project-based learning platform.
> Generated ${input.generatedAtIso} from Atlas completion records.

**Role / path:** ${roleLine} · **Course:** ${project.course} · **Level:** ${project.difficulty}

## Project summary

${project.summary}

## Skills practiced

${bullets(project.skills, "Not recorded for this project.")}

## Tools & runtime

${bullets(project.tools, "Not recorded for this project.")}

## Completion summary

${completionLines.join("\n")}

## What Atlas verified

${ATLAS_VERIFIED_CLAIM} Other steps were checked in the learner's browser
(client-provisional) or self-attested, and are not independently re-verified by
Atlas. See \`VALIDATION_EVIDENCE.md\` for the per-step breakdown and
\`LIMITATIONS.md\` for the full scope of what this record does and does not show.
`;
}

function renderValidationEvidence(input: PortfolioArtifactInput): string {
  const { project, completion, steps } = input;

  const rows =
    steps.length === 0
      ? "_No completed steps were recorded for this project._"
      : [
          "| Step | Title | Validation kind | Skill | Evidence | Completed |",
          "|---|---|---|---|---|---|",
          ...steps.map((s) => {
            // The displayed strength is derived here, not trusted from the
            // caller: a non-passed step has no durable evidence → "unavailable";
            // a passed step is classified by (kind, serverGradeFlag) exactly as
            // the runtime grades it.
            const display: EvidenceStatus = s.passed
              ? classifyEvidenceStatus(s.validationKind, s.serverGradeFlag)
              : "unavailable";
            const skill = s.requiredSkill ? mdCell(s.requiredSkill) : "—";
            const when = s.completedAt ?? "—";
            return `| ${s.stepNumber} | ${mdCell(s.title)} | \`${s.validationKind}\` | ${skill} | ${STATUS_LABEL[display]} | ${when} |`;
          }),
        ].join("\n");

  return `# Validation evidence — ${mdHeading(project.title)}

Each completed step below, the kind of validation check it used, and how Atlas
graded it. ${ATLAS_VERIFIED_CLAIM}

**Evidence source:** durable Atlas completion records (the \`/submit\` path).
Provisional \`/check\` feedback is practice-only and is **not** the basis for
this record.

${rows}

## Legend

- **server-graded** — Atlas re-graded the submitted result on the server against
  the step's enabled check. This is the strongest evidence Atlas produces.
- **client-provisional** — checked in the learner's browser. Weaker than
  server-graded; browser checks can be bypassed, so Atlas does not independently
  re-verify them.
- **self-attested** — the learner marked the step complete; no automated check ran.
- **unavailable** — no durable completion record exists for this step.

## Evidence integrity

- Steps with a durable submission evidence hash: ${completion.evidenceHashCount} of ${completion.stepsCompleted} completed.
  Atlas stores a one-way hash of each server-recorded submission — not the
  submission contents — so a completion can be checked for consistency without
  exposing what was submitted.
- Public verification: ${completion.verifyUrl}
`;
}

function renderLimitations(input: PortfolioArtifactInput): string {
  const { project } = input;

  const dataScope: string[] = [
    `- This export reflects Atlas records at generation time (${input.generatedAtIso}). Activity after that is not included.`,
  ];
  if (!input.submittedCodeAvailable) {
    dataScope.push(
      "- The learner's submitted code is **not included**. Atlas does not yet durably store full submissions, so the code cannot be exported here.",
    );
  }
  if (!input.submittedOutputAvailable) {
    dataScope.push(
      "- The learner's submitted runtime output is **not included**, for the same reason.",
    );
  }
  dataScope.push(
    "- Provisional `/check` feedback is excluded by design; only durable `/submit` completion evidence is reflected.",
  );

  return `# Limitations & honest scope — ${mdHeading(project.title)}

Atlas is a learning platform. This artifact reflects Atlas's records of project
work and nothing more. Read this before presenting the artifact as evidence.

## What this record does NOT establish

- It does **not** prove the learner produced the solution without assistance.
- It does **not** prove the learner worked without external references or collaboration.
- Atlas does **not** prevent or detect every form of cheating, and makes no such claim.
- Atlas cannot guarantee a submission was free of tampering.
- It does **not** guarantee employment, interview success, or that the learner is
  ready for any specific role.
- It does **not** certify the learner's competence for any role.
- It does **not** establish who wrote the code or SQL, or whether it was written unaided.

## What this record DOES reflect

- The learner completed the steps listed in \`VALIDATION_EVIDENCE.md\` within Atlas.
- For steps marked **server-graded**, Atlas verified that the submitted runtime
  output or artifacts matched the step's enabled validation checks.
- Server-graded evidence is stronger than client-provisional evidence. Client-side
  checks run in the browser and can be bypassed; treat them as practice signals,
  not proof.

## Data scope & freshness

${dataScope.join("\n")}
`;
}

function renderDatasetNotes(input: PortfolioArtifactInput): string | undefined {
  const datasets = input.datasets;
  if (!datasets || datasets.length === 0) return undefined;
  const list = datasets
    .map((d) => `### ${mdHeading(d.name)}\n\n${d.description}`)
    .join("\n\n");
  return `# Dataset notes — ${mdHeading(input.project.title)}

The datasets used in this project, as recorded by Atlas. These are practice
fixtures provided by the platform unless noted otherwise.

${list}
`;
}

function renderReflectionTemplate(input: PortfolioArtifactInput): string {
  // Pure boilerplate — no learner data, safe to emit unconditionally. It gives
  // the learner a place to add the context Atlas cannot vouch for (their own
  // reasoning, tradeoffs, what they'd do next), which is what recruiters
  // actually read.
  return `# Reflection — ${mdHeading(input.project.title)}

_Written by the learner. Atlas does not verify the contents of this file; it is
the learner's own account of the work._

## What problem does this project solve?

_Two or three sentences in your own words._

## Key decisions & tradeoffs

- _A design choice you made and why._
- _An alternative you rejected and why._

## What was hardest, and how you worked through it

_Be specific. This is the part interviewers probe._

## What you would do next with more time

- _A concrete extension or improvement._
`;
}

/**
 * Generate the evidence-safe portfolio artifact bundle. Pure and deterministic:
 * the same input always yields byte-identical output.
 */
export function generatePortfolioArtifact(
  input: PortfolioArtifactInput,
): PortfolioArtifactBundle {
  const bundle: PortfolioArtifactBundle = {
    "README.md": renderReadme(input),
    "VALIDATION_EVIDENCE.md": renderValidationEvidence(input),
    "LIMITATIONS.md": renderLimitations(input),
    "LEARNER_REFLECTION_TEMPLATE.md": renderReflectionTemplate(input),
  };
  const datasetNotes = renderDatasetNotes(input);
  if (datasetNotes !== undefined) {
    bundle["DATASET_NOTES.md"] = datasetNotes;
  }
  return bundle;
}
