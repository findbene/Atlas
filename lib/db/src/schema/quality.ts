/**
 * Phase 5 — Project Quality System.
 *
 * - `project_candidates`: AI-researched / human-proposed projects awaiting
 *   review. Separate from `projects` so unapproved content never reaches
 *   the learner-facing API.
 * - `project_status_history`: audit trail for transitions on BOTH scopes
 *   (production projects and candidates).
 */

import { pgTable, uuid, text, jsonb, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { candidateStatusEnum, difficultyEnum } from "./enums";

export const projectCandidates = pgTable("project_candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposedTitle: text("proposed_title").notNull(),
  proposedCourse: text("proposed_course").notNull(),       // one of the 9 mastery slugs
  targetRoles: text("target_roles").array().default(sql`ARRAY[]::text[]`).notNull(),
  difficulty: difficultyEnum("difficulty").notNull(),
  proposedStack: text("proposed_stack").array().default(sql`ARRAY[]::text[]`).notNull(),
  proposal: jsonb("proposal").notNull(),                   // Zod-validated by lib at write-time
  qualityScore: numeric("quality_score", { precision: 5, scale: 2 }),
  qualityBreakdown: jsonb("quality_breakdown"),
  duplicateCandidates: jsonb("duplicate_candidates"),      // [{slug, similarity, title}, ...]
  status: candidateStatusEnum("status").default('candidate').notNull(),
  reviewerNotes: text("reviewer_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index('project_candidates_status_idx').on(t.status),
  index('project_candidates_course_idx').on(t.proposedCourse),
]);

export const projectStatusHistory = pgTable("project_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  scope: text("scope").notNull(),               // 'project' | 'candidate'
  refId: uuid("ref_id").notNull(),              // projects.id or project_candidates.id
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  reason: text("reason"),
  actor: text("actor").notNull(),               // cli user / 'system' / clerkId
  rubricVersion: text("rubric_version"),
  qualityScore: numeric("quality_score", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index('project_status_history_ref_idx').on(t.scope, t.refId),
  index('project_status_history_actor_idx').on(t.actor),
]);

export const insertProjectCandidateSchema = createInsertSchema(projectCandidates).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertProjectCandidate = z.infer<typeof insertProjectCandidateSchema>;
export type ProjectCandidate = typeof projectCandidates.$inferSelect;
export type ProjectStatusHistory = typeof projectStatusHistory.$inferSelect;
