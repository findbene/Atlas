import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum('user_role', ['learner', 'admin']);
export const subscriptionTierEnum = pgEnum('subscription_tier', ['free', 'pro']);
export const subscriptionPlanEnum = pgEnum('subscription_plan', ['free', 'pro_monthly', 'pro_annual']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'canceled', 'past_due', 'trialing', 'incomplete']);
export const progressStatusEnum = pgEnum('progress_status', ['not_started', 'in_progress', 'completed']);
export const learningModeEnum = pgEnum('learning_mode', ['guided', 'hint', 'independent']);
export const projectLanguageEnum = pgEnum('project_language', ['python', 'sql', 'both']);
export const difficultyEnum = pgEnum('difficulty', ['beginner', 'intermediate', 'advanced']);
export const noteTypeEnum = pgEnum('note_type', ['theory', 'cheatsheet', 'reference', 'quickstart']);
// Phase 5 — curriculum quality governance.
export const qualityStatusEnum = pgEnum('quality_status', [
  'unreviewed', 'approved', 'needs_revision', 'rejected',
]);
export const candidateStatusEnum = pgEnum('candidate_status', [
  'candidate', 'approved', 'needs_revision', 'rejected',
]);

export const validationTypeEnum = pgEnum('validation_type', [
  'exact',
  'regex',
  'contains',
  'numeric_tolerance',
  'csv_set_equal',
  'csv_ordered',
  'json_equal',
  'sql_resultset',
  'self_attest',
]);
