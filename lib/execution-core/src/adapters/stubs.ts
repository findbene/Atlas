import type { ExecutionAdapter, RunInput, RunResult } from "../types.js";
import { FeatureDisabledError } from "../types.js";

/**
 * Adapters for future modes. Each throws FeatureDisabledError until the
 * platform actually wires up the corresponding runtime AND the deploy enables
 * the relevant feature flag. These exist so the registry can return a
 * meaningful, honest error to the UI today.
 */

class StubAdapter implements ExecutionAdapter {
  constructor(
    public readonly id: string,
    public readonly mode: ExecutionAdapter["mode"],
    public readonly supports: ExecutionAdapter["supports"],
  ) {}
  async run(_input: RunInput): Promise<RunResult> {
    throw new FeatureDisabledError(
      this.mode,
      `The "${this.mode}" execution mode is not enabled in this build. Set the VITE_FEATURE_EXEC_* flag and ship the matching adapter.`,
    );
  }
}

export const replayAdapter: ExecutionAdapter = new StubAdapter(
  "stub.replay",
  "replay",
  ["python", "sql"],
);

export const localContainerAdapter: ExecutionAdapter = new StubAdapter(
  "stub.local_container",
  "local_container",
  ["python", "sql"],
);

export const byoCloudAdapter: ExecutionAdapter = new StubAdapter(
  "stub.byo_cloud",
  "byo_cloud",
  ["python", "sql"],
);

export const managedSandboxAdapter: ExecutionAdapter = new StubAdapter(
  "stub.managed_sandbox",
  "managed_sandbox",
  ["python", "sql"],
);
