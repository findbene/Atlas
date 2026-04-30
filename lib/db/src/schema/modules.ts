import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { difficultyEnum, validationTypeEnum } from "./enums";
import { domains } from "./domains";
import { users } from "./users";

export const masterySections = pgTable("mastery_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  domainId: uuid("domain_id").references(() => domains.id),
  slug: text("slug").unique().notNull(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").default('python_mastery').notNull(),
  isPremium: boolean("is_premium").default(false).notNull(),
  orderIndex: integer("order_index").default(0).notNull(),
});

export const masteryModules = pgTable("mastery_modules", {
  id: uuid("id").primaryKey().defaultRandom(),
  sectionId: uuid("section_id").references(() => masterySections.id).notNull(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  difficultyLevel: difficultyEnum("difficulty_level").notNull(),
  estimatedHours: integer("estimated_hours").default(2),
  lessonCount: integer("lesson_count").default(0).notNull(),
  isPremium: boolean("is_premium").default(false).notNull(),
  orderIndex: integer("order_index").default(0).notNull(),
  learningObjectives: text("learning_objectives").array(),
}, (t) => [
  uniqueIndex('mastery_module_slug_idx').on(t.sectionId, t.slug),
]);

export const masteryLessons = pgTable("mastery_lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  moduleId: uuid("module_id").references(() => masteryModules.id, { onDelete: 'cascade' }).notNull(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  contentMd: text("content_md").notNull(),
  type: text("type").default('reading').notNull(),
  estimatedMinutes: integer("estimated_minutes").default(15).notNull(),
  xpReward: integer("xp_reward").default(15).notNull(),
  orderIndex: integer("order_index").default(0).notNull(),
  videoUrl: text("video_url"),
}, (t) => [
  uniqueIndex('mastery_lesson_slug_idx').on(t.moduleId, t.slug),
]);

export const masteryExercises = pgTable("mastery_exercises", {
  id: uuid("id").primaryKey().defaultRandom(),
  lessonId: uuid("lesson_id").references(() => masteryLessons.id, { onDelete: 'cascade' }).notNull(),
  title: text("title").notNull(),
  question: text("question").notNull(),
  starterCode: text("starter_code"),
  solutionCode: text("solution_code"),
  hint: text("hint"),
  orderIndex: integer("order_index").default(0).notNull(),
  xpReward: integer("xp_reward").default(10).notNull(),
  validationType: validationTypeEnum("validation_type").default('self_attest').notNull(),
  validationConfig: jsonb("validation_config").default(sql`'{}'::jsonb`).notNull(),
});

export const masteryProgress = pgTable("mastery_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  lessonId: uuid("lesson_id").references(() => masteryLessons.id).notNull(),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  xpEarned: integer("xp_earned").default(0).notNull(),
}, (t) => [
  uniqueIndex('mastery_progress_user_lesson_idx').on(t.userId, t.lessonId),
]);

export type MasterySection = typeof masterySections.$inferSelect;
export type MasteryModule = typeof masteryModules.$inferSelect;
export type MasteryLesson = typeof masteryLessons.$inferSelect;
