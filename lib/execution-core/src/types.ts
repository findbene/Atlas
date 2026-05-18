/**
 * Framework-agnostic execution contracts for the Atlas learning platform.
 *
 * These types are deliberately UI- and runtime-neutral. They describe WHAT a
 * learner-submitted run looks like and WHAT the platform expects back, without
 * caring whether the runtime is in-browser Pyodide/DuckDB-WASM, a future
 * replay engine, a future local container, a future BYO cloud account, or a
 * future managed sandbox.
 *
 * Adapter implementations live where they can physically run (browser-side
 * adapters in `artifacts/atlas/src/lib/`, future server-side adapters in the
 * api-server). This package owns the contract only.
 */

export type ExecutionMode =
  | "simulated"        // in-browser, deterministic, zero cost (Pyodide / DuckDB-WASM)
  | "replay"           // pre-recorded cloud output, learner code checked against expected
  | "local_container"  // ephemeral container in our infra (future)
  | "byo_cloud"        // learner's own AWS/Snowflake/Databricks via federated creds (future)
  | "managed_sandbox"; // we run real ephemeral cloud workloads (future)

export type SupportedPlatform =
  | "local"
  | "aws"
  | "azure"
  | "gcp"
  | "snowflake"
  | "databricks"
  | "fabric";

/**
 * The honesty-label string the UI surfaces to learners so they always know
 * what kind of environment they're touching. Never lie about this.
 */
export type HonestyLabel =
  | "In-Browser Simulation"
  | "Replay (Pre-Recorded Cloud Output)"
  | "Local Container"
  | "Your Cloud Account"
  | "Atlas-Managed Sandbox";

/**
 * Per-project (or per-step override) execution metadata. Stored as JSONB on
 * `projects.execution_profile` and optionally on `project_steps.execution_override`.
 */
export interface ExecutionProfile {
  mode: ExecutionMode;
  honestyLabel: HonestyLabel;
  supportedPlatforms?: SupportedPlatform[];
  /** Service identifiers a project depends on (e.g. "snowflake.warehouse", "s3.bucket"). */
  requiredServices?: string[];
  /** Plain-English cost expectation. "Free" for simulated/replay. */
  estimatedCost?: string;
  /** Human-readable cleanup instructions; rendered to the learner before they enable cloud modes. */
  cleanupSteps?: string[];
}

export type LanguageKind = "python" | "sql";

/**
 * What an adapter receives when a learner clicks "Run".
 */
export interface RunInput {
  language: LanguageKind;
  code: string;
  /** Names of sample datasets the step expects to be available in the runtime. */
  datasetRefs?: string[];
  /** Adapter-specific overrides (timeouts, memory caps, etc.). */
  options?: Record<string, unknown>;
}

/**
 * What an adapter returns. `rows` is populated for tabular SQL results; `stdout`/`stderr`
 * are populated for stream-y runtimes like Python. Both can be present.
 */
export interface RunResult {
  ok: boolean;
  stdout?: string;
  stderr?: string;
  /** For tabular results, the column names in order. */
  columns?: string[];
  /** For tabular results, rows as arrays aligned to `columns`. */
  rows?: Array<Array<string | number | boolean | null>>;
  durationMs: number;
  /** True if the runtime aborted the run (timeout, OOM, killed). */
  timedOut?: boolean;
  /** Human-readable error message when ok=false. */
  error?: string;
}

/**
 * What the platform compares against to decide pass/fail. All fields optional;
 * adapters and validators inspect only what they understand for the step's
 * language and validation type.
 */
export interface ExpectedOutputs {
  /** Expected rows for tabular validation. Comparison is unordered unless `orderSensitive=true`. */
  rows?: Array<Record<string, string | number | boolean | null>>;
  /** Exact-match stdout (rare — useful for narrow Python checks). */
  stdout?: string;
  /** Regex pattern that stdout must match. */
  stdoutMatches?: string;
  /** Files the runtime is expected to produce, keyed by relative path. */
  files?: Record<string, string>;
  /** Numeric metrics the runtime is expected to produce (e.g. {"accuracy": 0.85}). */
  metrics?: Record<string, number>;
  orderSensitive?: boolean;
}

export interface ValidationInput {
  expected: ExpectedOutputs;
  result: RunResult;
}

export interface ValidationOutcome {
  passed: boolean;
  /** Short headline for the UI. */
  summary: string;
  /** Educational feedback — what's wrong and why, in plain language. */
  feedback?: string;
  /** Structured diff for the UI to render. */
  diff?: {
    missingColumns?: string[];
    extraColumns?: string[];
    missingRowCount?: number;
    extraRowCount?: number;
  };
}

/**
 * The single contract every execution backend implements. Adapter authors
 * receive a RunInput and must return a RunResult. Validation is delegated to
 * the generic `validateExpected` helper unless an adapter has runtime-specific
 * grading needs.
 */
export interface ExecutionAdapter {
  /** Stable identifier — used by the registry for selection and feature-flag gating. */
  readonly id: string;
  readonly mode: ExecutionMode;
  readonly supports: LanguageKind[];
  run(input: RunInput): Promise<RunResult>;
}

/**
 * Adapter is asked to run but its feature flag is disabled. Catchable at the
 * UI layer to render an honest "this mode isn't enabled yet" message.
 */
export class FeatureDisabledError extends Error {
  constructor(public readonly mode: ExecutionMode, message?: string) {
    super(message ?? `Execution mode "${mode}" is not enabled in this build.`);
    this.name = "FeatureDisabledError";
  }
}
