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

export {
  toAtlasLearnerMode,
  fromAtlasLearnerMode,
  evaluateHintPolicy,
  hintsUpTo,
  availableHintLevels,
  MAX_HINT_LEVEL,
} from "./pedagogy.js";
export type {
  DbLearningMode,
  AtlasLearnerMode,
  HintPolicyInput,
  HintPolicyOutcome,
  PedagogyConfig,
} from "./pedagogy.js";

export { recommendLearnerMode } from "./learnerMode.js";
export type {
  LearnerModeSignals,
  LearnerModeReasonCode,
  LearnerModeRecommendation,
} from "./learnerMode.js";

export {
  buildTutorContract,
  renderTutorContractForPrompt,
  resolveAdaptiveMode,
} from "./tutorContract.js";
export type {
  TutorContractInput,
  TutorContract,
  HelpBoundary,
} from "./tutorContract.js";

// NOTE: `./runEnvelope.js` is *not* re-exported here on purpose. It imports
// `node:crypto` and the root `index.ts` is consumed by the browser-bundled
// `@workspace/atlas` artifact. Server callers must import the signer / verifier
// from the dedicated subpath:
//
//   import { signRunEnvelope, verifyRunEnvelope } from "@workspace/execution-core/run-envelope";
//
// This keeps the cryptographic primitives reachable to api-server while
// leaving the frontend bundle free of `node:crypto`.
