import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, customType, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { difficultyEnum, projectLanguageEnum, noteTypeEnum, validationTypeEnum, qualityStatusEnum, atlasCourseEnum, courseSourceEnum } from "./enums";
import { numeric } from "drizzle-orm/pg-core";
import { projectCandidates } from "./quality";

export const domains = pgTable("domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").unique().notNull(),
  title: text("title").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  iconName: text("icon_name"),
  colorHex: text("color_hex"),
  isAvailable: boolean("is_available").default(false).notNull(),
  comingSoon: boolean("coming_soon").default(true).notNull(),
  totalProjects: integer("total_projects").default(0).notNull(),
  orderIndex: integer("order_index").default(0).notNull(),
});

export const tracks = pgTable("tracks", {
  id: uuid("id").primaryKey().defaultRandom(),
  domainId: uuid("domain_id").references(() => domains.id).notNull(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  difficultyLevel: difficultyEnum("difficulty_level").notNull(),
  estimatedHours: integer("estimated_hours"),
  projectCount: integer("project_count").default(0).notNull(),
  orderIndex: integer("order_index").default(0).notNull(),
  prerequisites: text("prerequisites").array(),
  isPremium: boolean("is_premium").default(false).notNull(),
  // Phase 8 — canonical track per domain. Replaces the legacy `limit(1)`
  // lookup in `resolveDomainAndTrack`. Exactly one track per domain may be
  // marked primary (enforced by the partial unique index below).
  isPrimary: boolean("is_primary").default(false).notNull(),
}, (t) => [
  uniqueIndex('tracks_domain_slug_idx').on(t.domainId, t.slug),
  // At most one primary track per domain.
  uniqueIndex('tracks_domain_primary_idx').on(t.domainId).where(sql`is_primary = true`),
]);

const searchVectorType = customType<{ data: string; driverData: string }>({
  dataType: () => 'tsvector',
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  trackId: uuid("track_id").references(() => tracks.id).notNull(),
  domainId: uuid("domain_id").references(() => domains.id).notNull(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  shortDescription: text("short_description").notNull(),
  fullDescription: text("full_description").notNull(),
  difficultyLevel: difficultyEnum("difficulty_level").notNull(),
  estimatedMinutes: integer("estimated_minutes").default(60).notNull(),
  techStack: text("tech_stack").array().notNull(),
  learningObjectives: text("learning_objectives").array().notNull(),
  prerequisites: text("prerequisites").array(),
  orderIndex: integer("order_index").default(0).notNull(),
  isPremium: boolean("is_premium").default(false).notNull(),
  thumbnailUrl: text("thumbnail_url"),
  starterCodePython: text("starter_code_python"),
  starterCodeSQL: text("starter_code_sql"),
  starterFiles: jsonb("starter_files"),
  language: projectLanguageEnum("language").default('python').notNull(),
  isMultiFile: boolean("is_multi_file").default(false).notNull(),
  isWalkthroughOnly: boolean("is_walkthrough_only").default(false).notNull(),
  totalSteps: integer("total_steps").default(1).notNull(),
  tags: text("tags").array(),
  searchVector: searchVectorType("search_vector"),
  xpReward: integer("xp_reward").default(100).notNull(),
  enrolledCount: integer("enrolled_count").default(0).notNull(),
  completionRate: integer("completion_rate").default(0).notNull(),
  jobOutcomes: jsonb("job_outcomes"),
  // Phase 2: how this project's code is actually executed for the learner.
  // Shape validated by `executionProfileSchema` in @workspace/execution-core.
  // Null on legacy rows; the runtime falls back to DEFAULT_SIMULATED_PROFILE.
  executionProfile: jsonb("execution_profile"),
  // Phase 5: curriculum quality governance. Defaults preserve existing rows
  // as 'unreviewed' so the catalog stays live while the rubric runs.
  qualityStatus: qualityStatusEnum("quality_status").default('unreviewed').notNull(),
  qualityScore: numeric("quality_score", { precision: 5, scale: 2 }),
  qualityBreakdown: jsonb("quality_breakdown"),
  lastQualityAuditAt: timestamp("last_quality_audit_at"),
  // Phase 8 — native 9-course taxonomy. Authored rows get the value from
  // explicit authoring intent; legacy rows are backfilled via mapToCourse
  // (best-effort) and labeled `heuristic_legacy` via `courseSource`.
  // Nullable during initial migration; backfill flips to NOT NULL.
  course: atlasCourseEnum("course").notNull(),
  courseSource: courseSourceEnum("course_source").notNull(),
  // Phase 8 — lineage from candidate → authored project. Null for legacy
  // rows that pre-date the candidate pipeline. ON DELETE SET NULL so the
  // catalog stays live if a candidate row is ever hard-deleted.
  sourceCandidateId: uuid("source_candidate_id").references(() => projectCandidates.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (t) => [
  uniqueIndex('projects_track_slug_idx').on(t.trackId, t.slug),
  index('projects_track_id_idx').on(t.trackId),
  index('projects_domain_id_idx').on(t.domainId),
  index('projects_order_idx').on(t.orderIndex),
  index('projects_course_idx').on(t.course),
  index('projects_source_candidate_idx').on(t.sourceCandidateId),
]);

export const projectSteps = pgTable("project_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  stepNumber: integer("step_number").notNull(),
  title: text("title").notNull(),
  instructionMd: text("instruction_md").notNull(),
  codeContext: text("code_context"),
  expectedOutput: text("expected_output"),
  validationType: validationTypeEnum("validation_type").default('self_attest').notNull(),
  validationConfig: jsonb("validation_config").default(sql`'{}'::jsonb`).notNull(),
  validationHint: text("validation_hint"),
  xpReward: integer("xp_reward").default(25).notNull(),
  starterCode: text("starter_code"),
  type: text("type").default('code_python').notNull(),
  // Phase 2: generic expected outputs (rows, stdout, files, metrics) used by
  // `validateExpected` in @workspace/execution-core for richer grading.
  expectedOutputs: jsonb("expected_outputs"),
  // Phase 2: SQL/DuckDB dataset refs to register before the step runs.
  datasetRefs: jsonb("dataset_refs"),
  // Phase 2: optional per-step override of the project's executionProfile.
  executionOverride: jsonb("execution_override"),
  // Phase 4: pedagogy. All nullable, all optional in API. The legacy `hints`
  // (on the separate projectHints table) and `validationHint` stay as fallbacks
  // for steps that have not yet been enriched.
  learningObjective: text("learning_objective"),
  requiredSkill: text("required_skill"),
  // pedagogy_config holds the rich tutoring payload as a single JSONB blob to
  // keep the table narrow. Shape (all keys optional):
  //   {
  //     misconceptionToWatchFor?: string;
  //     hintLevel1?: string; hintLevel2?: string; hintLevel3?: string;
  //     hintLevel4?: string; hintLevel5?: string;
  //     finalExplanation?: string;
  //     successFeedback?: string;
  //     failureFeedback?: string;
  //     portfolioRelevance?: string;
  //   }
  pedagogyConfig: jsonb("pedagogy_config"),
}, (t) => [
  uniqueIndex('project_step_idx').on(t.projectId, t.stepNumber),
]);

export const projectHints = pgTable("project_hints", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  stepNumber: integer("step_number"),
  hintLevel: integer("hint_level").notNull(),
  hintText: text("hint_text").notNull(),
});

export const projectSolutions = pgTable("project_solutions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: 'cascade' }).unique().notNull(),
  solutionCode: text("solution_code"),
  solutionExplanationMd: text("solution_explanation_md").notNull(),
  fileStructureJson: jsonb("file_structure_json"),
  videoExplanationUrl: text("video_explanation_url"),
});

export const projectNotes = pgTable("project_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id),
  trackId: uuid("track_id").references(() => tracks.id),
  title: text("title").notNull(),
  contentMd: text("content_md").notNull(),
  noteType: noteTypeEnum("note_type").default('theory').notNull(),
  videoUrl: text("video_url"),
  orderIndex: integer("order_index").default(0).notNull(),
});

export const waitlist = pgTable("waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  domainInterest: text("domain_interest"),
  confirmationToken: text("confirmation_token").unique().notNull(),
  isConfirmed: boolean("is_confirmed").default(false).notNull(),
  signedUpAt: timestamp("signed_up_at").defaultNow().notNull(),
  confirmedAt: timestamp("confirmed_at"),
});

export const featureFlags = pgTable("feature_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").unique().notNull(),
  isEnabled: boolean("is_enabled").default(false).notNull(),
  enabledForRoles: text("enabled_for_roles").array().default(sql`ARRAY[]::text[]`).notNull(),
  description: text("description"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: text("updated_by"),
});

export const insertDomainSchema = createInsertSchema(domains).omit({ id: true });
export type InsertDomain = z.infer<typeof insertDomainSchema>;
export type Domain = typeof domains.$inferSelect;

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export const insertProjectStepSchema = createInsertSchema(projectSteps).omit({ id: true });
export type InsertProjectStep = z.infer<typeof insertProjectStepSchema>;
export type ProjectStep = typeof projectSteps.$inferSelect;

export const insertTrackSchema = createInsertSchema(tracks).omit({ id: true });
export type InsertTrack = z.infer<typeof insertTrackSchema>;
export type Track = typeof tracks.$inferSelect;
