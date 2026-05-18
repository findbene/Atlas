import { z } from "zod";
import type { ExecutionMode, ExecutionProfile, HonestyLabel } from "./types.js";

export const executionModeSchema = z.enum([
  "simulated",
  "replay",
  "local_container",
  "byo_cloud",
  "managed_sandbox",
]);

export const supportedPlatformSchema = z.enum([
  "local",
  "aws",
  "azure",
  "gcp",
  "snowflake",
  "databricks",
  "fabric",
]);

export const honestyLabelSchema = z.enum([
  "In-Browser Simulation",
  "Replay (Pre-Recorded Cloud Output)",
  "Local Container",
  "Your Cloud Account",
  "Atlas-Managed Sandbox",
]);

export const executionProfileSchema = z.object({
  mode: executionModeSchema,
  honestyLabel: honestyLabelSchema,
  supportedPlatforms: supportedPlatformSchema.array().optional(),
  requiredServices: z.string().array().optional(),
  estimatedCost: z.string().optional(),
  cleanupSteps: z.string().array().optional(),
});

export const expectedOutputsSchema = z.object({
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))).optional(),
  stdout: z.string().optional(),
  stdoutMatches: z.string().optional(),
  files: z.record(z.string(), z.string()).optional(),
  metrics: z.record(z.string(), z.number()).optional(),
  orderSensitive: z.boolean().optional(),
});

const HONESTY_BY_MODE: Record<ExecutionMode, HonestyLabel> = {
  simulated: "In-Browser Simulation",
  replay: "Replay (Pre-Recorded Cloud Output)",
  local_container: "Local Container",
  byo_cloud: "Your Cloud Account",
  managed_sandbox: "Atlas-Managed Sandbox",
};

export function honestyLabelFor(mode: ExecutionMode): HonestyLabel {
  return HONESTY_BY_MODE[mode];
}

/** Default profile applied to legacy projects that pre-date execution profiles. */
export const DEFAULT_SIMULATED_PROFILE: ExecutionProfile = {
  mode: "simulated",
  honestyLabel: "In-Browser Simulation",
  supportedPlatforms: ["local"],
  estimatedCost: "Free",
};

/**
 * Best-effort parse of a JSONB blob into an ExecutionProfile.
 * Returns the default profile when input is null/invalid so the UI never
 * crashes on legacy rows.
 */
export function parseExecutionProfile(raw: unknown): ExecutionProfile {
  if (raw == null) return DEFAULT_SIMULATED_PROFILE;
  const parsed = executionProfileSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_SIMULATED_PROFILE;
}
