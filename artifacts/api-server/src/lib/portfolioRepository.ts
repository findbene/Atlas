/**
 * Phase 60G — GitHub-ready repository export (a THIN layer over the Phase-60A
 * generator).
 *
 * Produces a deterministic map of repo-relative file paths → contents that a
 * learner downloads and MANUALLY uploads to GitHub. No OAuth, no token, no
 * direct push, no public publishing — this module only builds files.
 *
 * It REUSES the Phase-60A generator verbatim for the Markdown evidence files
 * (so the honesty / no-leak logic is never duplicated) and only ADDS:
 *   - `atlas-portfolio.json` — machine-readable, leak-safe metadata.
 *   - `evidence/submission-summary.md` (optional) — emitted only when a durable
 *     submission snapshot exists; a learner-evidence-framed summary that
 *     contains NO raw submission, excerpt, hash, or spec.
 *
 * No-leak posture is INHERITED: the input is the same leak-free-by-construction
 * `PortfolioArtifactInput` (no field can carry a validationConfig / expectedRows
 * / expectedRowsHash / reference query / comparator internal / secret), so the
 * export has no new channel for an answer key. `assertSafeRepoPaths` rejects any
 * unexpected/unsafe file key (defence in depth — paths are fixed constants), and
 * the route runs the canonical H3 banned-claim guard over the whole bundle.
 */
import {
  generatePortfolioArtifact,
  classifyEvidenceStatus,
  ATLAS_VERIFIED_CLAIM,
  type EvidenceStatus,
  type PortfolioArtifactInput,
} from "./portfolioArtifact";

export const REPOSITORY_FORMAT = "github-ready-repository" as const;

export interface PortfolioRepositoryBundle {
  projectSlug: string;
  generatedAt: string;
  format: typeof REPOSITORY_FORMAT;
  /** Repo-relative path → file contents. The learner reconstructs a folder
   *  named `projectSlug` from these and uploads it to GitHub. */
  files: Record<string, string>;
}

/**
 * Defence-in-depth path guard. Every key MUST be a safe, relative repo path:
 * a restricted charset, no leading slash, no backslash, no NUL, and no `.`/`..`
 * path segment (no traversal). Paths in this module are fixed constants and
 * never interpolate a learner/authored value, so this can only ever fire on a
 * programming error — but it is the contract the export tests pin.
 */
export function assertSafeRepoPaths(files: Record<string, string>): void {
  for (const key of Object.keys(files)) {
    const bad =
      key.length === 0 ||
      key.startsWith("/") ||
      key.includes("\\") ||
      key.includes("\0") ||
      !/^[A-Za-z0-9._/-]+$/.test(key) ||
      key.split("/").some((seg) => seg === "" || seg === "." || seg === "..");
    if (bad) {
      throw new Error(`unsafe repository file path: ${JSON.stringify(key)}`);
    }
  }
}

function flattenOneLine(s: string): string {
  return s.replace(/\s*\r?\n\s*/g, " ").trim();
}

/** A short, safe limitations summary for the machine-readable metadata. Mirrors
 *  the honest non-claims in LIMITATIONS.md without restating the full prose. */
const LIMITATIONS_SUMMARY =
  "This record reflects Atlas completion evidence only. It does not prove the " +
  "work was done without assistance, does not establish who wrote the code or " +
  "SQL, does not guarantee employment, and does not certify competence. " +
  "Server-graded evidence is stronger than client-provisional; client-side " +
  "checks can be bypassed.";

/** Manual-upload orientation. Makes the no-OAuth / no-auto-publish boundary
 *  explicit so the artifact is never mistaken for a published repo. */
const MANUAL_UPLOAD_NOTE =
  "This bundle is for MANUAL upload. Create a new GitHub repository named " +
  "after `projectSlug`, add these files, and push them yourself. Atlas does " +
  "not connect to GitHub, does not hold a token, and does not publish on your " +
  "behalf.";

type EvidenceCounts = {
  serverGraded: number;
  clientProvisional: number;
  selfAttested: number;
  unavailable: number;
};

function countEvidence(input: PortfolioArtifactInput): EvidenceCounts {
  const counts: EvidenceCounts = {
    serverGraded: 0,
    clientProvisional: 0,
    selfAttested: 0,
    unavailable: 0,
  };
  for (const s of input.steps) {
    const status: EvidenceStatus = s.passed
      ? classifyEvidenceStatus(s.validationKind, s.serverGradeFlag)
      : "unavailable";
    if (status === "server-graded") counts.serverGraded += 1;
    else if (status === "client-provisional") counts.clientProvisional += 1;
    else if (status === "self-attested") counts.selfAttested += 1;
    else counts.unavailable += 1;
  }
  return counts;
}

/**
 * Build `atlas-portfolio.json` — machine-readable metadata derived ONLY from the
 * safe input model. No validationConfig / expectedRows / hash / spec / secret
 * can appear because none exist in the input.
 */
function buildMetadata(
  input: PortfolioArtifactInput,
  fileList: string[],
): Record<string, unknown> {
  const { project, completion } = input;
  const counts = countEvidence(input);
  return {
    schema: "atlas-portfolio/v1",
    format: REPOSITORY_FORMAT,
    generatedAt: input.generatedAtIso,
    project: {
      slug: project.slug,
      title: project.title,
      course: project.course,
      role: project.role,
      difficulty: project.difficulty,
    },
    files: fileList,
    evidence: {
      stepsCompleted: completion.stepsCompleted,
      totalSteps: completion.totalSteps,
      evidenceHashCount: completion.evidenceHashCount,
      totalXpEarned: completion.totalXpEarned,
      serverGradedSteps: counts.serverGraded,
      clientProvisionalSteps: counts.clientProvisional,
      selfAttestedSteps: counts.selfAttested,
      submittedCodeAvailable: input.submittedCodeAvailable,
      submittedOutputAvailable: input.submittedOutputAvailable,
    },
    verification: ATLAS_VERIFIED_CLAIM,
    limitations: LIMITATIONS_SUMMARY,
    manualUpload: MANUAL_UPLOAD_NOTE,
    verifyUrl: completion.verifyUrl,
  };
}

const STATUS_LABEL: Record<EvidenceStatus, string> = {
  "server-graded": "server-graded",
  "client-provisional": "client-provisional",
  "self-attested": "self-attested",
  unavailable: "unavailable",
};

/**
 * `evidence/submission-summary.md` — a learner-evidence-framed summary. It
 * deliberately includes NO raw submission, clamped excerpt, hash value, or
 * answer key: only the per-step validation kind + the evidence-strength label
 * (the same safe facts as VALIDATION_EVIDENCE.md), explicitly labelled as the
 * LEARNER's own submitted work — never an Atlas reference answer. The full
 * submission stays server-side, which is why nothing here can leak a spec value.
 */
function renderSubmissionSummary(input: PortfolioArtifactInput): string {
  const { project, completion } = input;
  const passed = input.steps.filter((s) => s.passed);
  const rows =
    passed.length === 0
      ? "_No passing submissions are recorded for this project._"
      : [
          "| Step | Title | Validation kind | Evidence | Completed |",
          "|---|---|---|---|---|",
          ...passed.map((s) => {
            const status = classifyEvidenceStatus(s.validationKind, s.serverGradeFlag);
            const when = s.completedAt ?? "—";
            return `| ${s.stepNumber} | ${flattenOneLine(s.title).replace(/\|/g, "\\|")} | \`${s.validationKind}\` | ${STATUS_LABEL[status]} | ${when} |`;
          }),
        ].join("\n");

  return `# Submission evidence — ${flattenOneLine(project.title)}

> **Learner-submitted evidence.** The steps below were completed by submitting
> the learner's OWN work to Atlas. This file is a record of *what the learner
> submitted*, not an Atlas answer key or reference solution.

Atlas stores a one-way hash and a short, server-side clamped excerpt of each
fresh passing submission — it does **not** export the full submission text or
the validation spec. This summary therefore lists which steps carry durable
submission evidence and how Atlas graded them; the raw submitted content and the
grading spec are intentionally **not** included here.

${rows}

## Evidence availability

- Durable submission snapshot — code: **${input.submittedCodeAvailable ? "available" : "not available"}**, runtime output: **${input.submittedOutputAvailable ? "available" : "not available"}**.
- Steps with a durable evidence hash: ${completion.evidenceHashCount} of ${completion.stepsCompleted} completed.
- For steps marked **server-graded**, Atlas re-graded the submitted result on
  the server against the step's enabled check. ${ATLAS_VERIFIED_CLAIM}
- Public verification: ${completion.verifyUrl}
`;
}

/**
 * Generate the GitHub-ready repository bundle. Pure + deterministic: the same
 * input always yields byte-identical output (the generator is pure; the file
 * list is sorted; metadata key order is fixed).
 */
export function generatePortfolioRepository(
  input: PortfolioArtifactInput,
): PortfolioRepositoryBundle {
  // 1) Reuse the Phase-60A Markdown bundle verbatim.
  const files: Record<string, string> = { ...generatePortfolioArtifact(input) };

  // 2) Optional learner-evidence summary, only when a durable snapshot exists.
  if (input.submittedCodeAvailable || input.submittedOutputAvailable) {
    files["evidence/submission-summary.md"] = renderSubmissionSummary(input);
  }

  // 3) Machine-readable metadata — references the FINAL file list (incl itself).
  const fileList = [...Object.keys(files), "atlas-portfolio.json"].sort();
  files["atlas-portfolio.json"] =
    JSON.stringify(buildMetadata(input, fileList), null, 2) + "\n";

  assertSafeRepoPaths(files);

  return {
    projectSlug: input.project.slug,
    generatedAt: input.generatedAtIso,
    format: REPOSITORY_FORMAT,
    files,
  };
}
