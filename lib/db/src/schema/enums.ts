import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum('user_role', ['learner', 'admin']);
export const subscriptionTierEnum = pgEnum('subscription_tier', ['free', 'pro']);
export const subscriptionPlanEnum = pgEnum('subscription_plan', ['free', 'pro_monthly', 'pro_annual']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'canceled', 'past_due', 'trialing', 'incomplete']);
export const progressStatusEnum = pgEnum('progress_status', ['not_started', 'in_progress', 'completed']);
// Phase 8 — `dynamic_ai_adaptive` is now a first-class enum value. The other
// three remain for back-compat with already-persisted rows. The pedagogy
// mapper in @workspace/execution-core no longer silently aliases
// `dynamic_ai_adaptive` to `guided`.
export const learningModeEnum = pgEnum('learning_mode', ['guided', 'hint', 'independent', 'dynamic_ai_adaptive']);

// Phase 8 — native 9-course taxonomy. Source of truth for `projects.course`.
// Keep in sync with `ALL_COURSES` in @workspace/curriculum-quality.
export const atlasCourseEnum = pgEnum('atlas_course', [
  'data-engineering',
  'ai-engineer',
  'mlops-engineer',
  'data-scientist',
  'analytics-engineer',
  'applied-llm-engineer',
  'cloud-data-engineer',
  'python-libraries',
  'sql',
]);

// Phase 8 — audit field recording how `projects.course` was assigned.
// `authored` rows come from explicit Phase-7+ authoring intent;
// `heuristic_legacy` rows were backfilled via `mapToCourse` and should be
// treated as best-effort until re-authored.
export const courseSourceEnum = pgEnum('course_source', ['authored', 'heuristic_legacy']);
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
