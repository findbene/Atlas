export type {
  ExecutionMode,
  SupportedPlatform,
  HonestyLabel,
  ExecutionProfile,
  LanguageKind,
  RunInput,
  RunResult,
  ExpectedOutputs,
  ValidationInput,
  ValidationOutcome,
  ExecutionAdapter,
} from "./types.js";

export { FeatureDisabledError } from "./types.js";

export {
  executionModeSchema,
  supportedPlatformSchema,
  honestyLabelSchema,
  executionProfileSchema,
  expectedOutputsSchema,
  honestyLabelFor,
  DEFAULT_SIMULATED_PROFILE,
  parseExecutionProfile,
} from "./profile.js";

export { validateExpected } from "./validate.js";
