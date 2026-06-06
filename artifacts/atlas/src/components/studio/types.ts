export type StepVM = {
  id: string;
  position: number;
  title: string;
  description: string;
  type: string;
  starterCode?: string;
  hints?: string[];
  datasetRefs?: string[];
  expectedOutputs?: unknown;
  executionOverride?: unknown;
  // Phase 4 pedagogy (all optional)
  learningObjective?: string;
  requiredSkill?: string;
  hasPedagogy?: boolean;
  // Phase 57B-prereq — narrow derived flag. True only for a `csv_set_equal`
  // step whose validationConfig opted into server-side grading
  // (`spec.serverGrade === true`). False/absent for every visible row today.
  // No expected rows, hashes, or answer keys are ever exposed alongside it.
  serverGrade?: boolean;
};

export type OutputVM = {
  stdout: string;
  stderr: string;
  exitCode: number;
  columns?: string[];
  rows?: Array<Array<string | number | boolean | null>>;
};

export type GradingResult = {
  status: "passed" | "failed";
  feedback?: string;
  xpEarned?: number;
  attempt?: number;
  isFirstPass?: boolean;
  projectComplete?: boolean;
};

export type RunRow = {
  id: string;
  code: string;
  stdout: string;
  stderr: string;
  ok: boolean;
  createdAt: string;
};

export type SolutionPayload = {
  solutionCode: string | null;
  explanationMd: string;
  videoUrl: string | null;
};
