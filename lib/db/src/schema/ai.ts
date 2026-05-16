import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { projects, projectSteps } from "./domains";

export const aiTutorMessages = pgTable("ai_tutor_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  stepId: uuid("step_id").references(() => projectSteps.id, { onDelete: "set null" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("ai_tutor_user_project_idx").on(t.userId, t.projectId, t.createdAt),
  index("ai_tutor_user_created_idx").on(t.userId, t.createdAt),
  // GIN index over to_tsvector for full-text search on message content,
  // scoped by user_id at query time. The expression must match the query
  // expression exactly for the planner to use it.
  index("ai_tutor_content_fts_idx").using("gin", sql`to_tsvector('english', content)`),
]);

export type AiTutorMessage = typeof aiTutorMessages.$inferSelect;
