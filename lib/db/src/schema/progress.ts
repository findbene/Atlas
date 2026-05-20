import { pgTable, uuid, text, integer, boolean, timestamp, date, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { progressStatusEnum, learningModeEnum, projectLanguageEnum } from "./enums";
import { users } from "./users";
import { projects } from "./domains";

export const userProgress = pgTable("user_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  projectId: uuid("project_id").references(() => projects.id).notNull(),
  status: progressStatusEnum("status").default('not_started').notNull(),
  currentStep: integer("current_step").default(1).notNull(),
  learningMode: learningModeEnum("learning_mode").default('guided').notNull(),
  hintsUsed: integer("hints_used").default(0).notNull(),
  revealedAnswer: boolean("revealed_answer").default(false).notNull(),
  completionPercent: integer("completion_percent").default(0).notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex('progress_user_project_idx').on(t.userId, t.projectId),
  index('progress_user_id_idx').on(t.userId),
  index('progress_project_id_idx').on(t.projectId),
]);

export const userStepCompletions = pgTable("user_step_completions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  projectId: uuid("project_id").references(() => projects.id).notNull(),
  stepNumber: integer("step_number").notNull(),
  passed: boolean("passed").notNull(),
  validationOutput: text("validation_output"),
  attemptCount: integer("attempt_count").default(1).notNull(),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex('step_completion_idx').on(t.userId, t.projectId, t.stepNumber),
]);

export const userCodeSessions = pgTable("user_code_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  projectId: uuid("project_id").references(() => projects.id).notNull(),
  files: jsonb("files").default(sql`'{}'::jsonb`).notNull(),
  language: projectLanguageEnum("language").default('python').notNull(),
  savedAt: timestamp("saved_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex('code_user_project_idx').on(t.userId, t.projectId),
]);

export const aiChatSessions = pgTable("ai_chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  projectId: uuid("project_id").references(() => projects.id),
  messagesJson: jsonb("messages_json").default(sql`'[]'::jsonb`).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userXp = pgTable("user_xp", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).unique().notNull(),
  totalXp: integer("total_xp").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  currentLevelXp: integer("current_level_xp").default(0).notNull(),
  xpToNextLevel: integer("xp_to_next_level").default(100).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const xpTransactions = pgTable("xp_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index('xp_transactions_user_idx').on(t.userId),
]);

export const userStreaks = pgTable("user_streaks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).unique().notNull(),
  currentStreak: integer("current_streak").default(0).notNull(),
  longestStreak: integer("longest_streak").default(0).notNull(),
  lastActivityDate: date("last_activity_date"),
  freezesAvailable: integer("freezes_available").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  action: text("action").notNull(),
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index('audit_user_idx').on(t.userId),
  index('audit_action_idx').on(t.action),
]);

// Per-step code run history. Keeps the last N runs (pruned by the api-server's
// background sweep) so learners can revisit prior attempts. Ok/stdout/stderr
// are captured client-side from the Pyodide runner — see project-workspace.tsx.
export const userCodeRuns = pgTable("user_code_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  stepId: uuid("step_id"),
  code: text("code").notNull(),
  stdout: text("stdout").default('').notNull(),
  stderr: text("stderr").default('').notNull(),
  ok: boolean("ok").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index('user_code_runs_user_step_idx').on(t.userId, t.stepId, t.createdAt),
]);

// Phase 4: per-learner per-step progressive hint state. One row per
// (user, step). Capped 0..5 by application logic, never auto-spoils.
export const userProjectStepHints = pgTable("user_project_step_hints", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  stepId: uuid("step_id").notNull(),
  hintLevel: integer("hint_level").default(0).notNull(),
  lastOfferedAt: timestamp("last_offered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex('user_step_hints_uniq').on(t.userId, t.stepId),
  index('user_step_hints_user_idx').on(t.userId),
]);

export const insertUserProgressSchema = createInsertSchema(userProgress).omit({ id: true });
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
export type UserProgress = typeof userProgress.$inferSelect;
export type UserProjectStepHints = typeof userProjectStepHints.$inferSelect;
