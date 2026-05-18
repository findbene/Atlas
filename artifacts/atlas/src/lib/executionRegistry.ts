import type {
  ExecutionAdapter,
  ExecutionMode,
  ExecutionProfile,
  LanguageKind,
  RunInput,
  RunResult,
} from "@workspace/execution-core";
import {
  DEFAULT_SIMULATED_PROFILE,
  FeatureDisabledError,
  parseExecutionProfile,
} from "@workspace/execution-core";
import {
  byoCloudAdapter,
  localContainerAdapter,
  managedSandboxAdapter,
  replayAdapter,
} from "@workspace/execution-core/adapters";
import { runPython } from "./pyodideRunner";
import { duckdbAdapter } from "./duckdb/duckdbRunner";

/**
 * Frontend execution registry — picks the right adapter for a project + step
 * and gates future modes behind Vite feature flags.
 *
 * Adapters live here (not in execution-core) because they have a browser
 * runtime dependency. The CONTRACT lives in execution-core.
 */

const FLAG_REPLAY = import.meta.env.VITE_FEATURE_EXEC_REPLAY === "true";
const FLAG_LOCAL = import.meta.env.VITE_FEATURE_EXEC_LOCAL_CONTAINER === "true";
const FLAG_BYO = import.meta.env.VITE_FEATURE_EXEC_BYO_CLOUD === "true";
const FLAG_MANAGED = import.meta.env.VITE_FEATURE_EXEC_MANAGED_SANDBOX === "true";

/** Pyodide wrapped as an ExecutionAdapter so the registry surface is uniform. */
const pyodideAdapter: ExecutionAdapter = {
  id: "browser.pyodide",
  mode: "simulated",
  supports: ["python"],
  async run(input: RunInput): Promise<RunResult> {
    if (input.language !== "python") {
      return {
        ok: false,
        durationMs: 0,
        error: `Pyodide adapter received ${input.language} code; expected python.`,
      };
    }
    const start = performance.now();
    const exec = await runPython(input.code);
    return {
      ok: exec.exitCode === 0,
      stdout: exec.stdout,
      stderr: exec.stderr,
      timedOut: exec.timedOut,
      durationMs: Math.round(performance.now() - start),
      error: exec.exitCode === 0 ? undefined : (exec.stderr || "Run failed.").trim(),
    };
  },
};

function isModeEnabled(mode: ExecutionMode): boolean {
  switch (mode) {
    case "simulated":
      return true;
    case "replay":
      return FLAG_REPLAY;
    case "local_container":
      return FLAG_LOCAL;
    case "byo_cloud":
      return FLAG_BYO;
    case "managed_sandbox":
      return FLAG_MANAGED;
  }
}

function adapterFor(mode: ExecutionMode, language: LanguageKind): ExecutionAdapter {
  if (mode === "simulated") {
    return language === "sql" ? duckdbAdapter : pyodideAdapter;
  }
  // Future modes — stubs throw FeatureDisabledError when run.
  switch (mode) {
    case "replay":
      return replayAdapter;
    case "local_container":
      return localContainerAdapter;
    case "byo_cloud":
      return byoCloudAdapter;
    case "managed_sandbox":
      return managedSandboxAdapter;
  }
}

export interface ResolveOptions {
  /** Project-level profile from `projects.executionProfile`. */
  projectProfile: unknown;
  /** Optional per-step override from `project_steps.executionOverride`. */
  stepOverride?: unknown;
}

/** Pick the effective profile (step override wins) and parse it safely. */
export function resolveProfile(opts: ResolveOptions): ExecutionProfile {
  if (opts.stepOverride != null) {
    return parseExecutionProfile(opts.stepOverride);
  }
  if (opts.projectProfile != null) {
    return parseExecutionProfile(opts.projectProfile);
  }
  return DEFAULT_SIMULATED_PROFILE;
}

/**
 * Run a learner submission through the registry. Throws FeatureDisabledError
 * if the resolved mode's flag is off — callers should render a friendly
 * message instead of crashing.
 */
export async function runViaRegistry(
  input: RunInput,
  opts: ResolveOptions,
): Promise<RunResult> {
  const profile = resolveProfile(opts);
  if (!isModeEnabled(profile.mode)) {
    throw new FeatureDisabledError(profile.mode);
  }
  const adapter = adapterFor(profile.mode, input.language);
  if (!adapter.supports.includes(input.language)) {
    return {
      ok: false,
      durationMs: 0,
      error: `Adapter "${adapter.id}" does not support ${input.language}.`,
    };
  }
  return adapter.run(input);
}
