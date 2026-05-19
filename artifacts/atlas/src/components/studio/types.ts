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
