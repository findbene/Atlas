import { pgTable, uuid, text, integer, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userRoleEnum, subscriptionTierEnum } from "./enums";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").unique().notNull(),
  email: text("email").unique().notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  username: text("username").unique(),
  bio: text("bio"),
  role: userRoleEnum("role").default('learner').notNull(),
  subscriptionTier: subscriptionTierEnum("subscription_tier").default('free').notNull(),
  timezone: text("timezone").default('UTC').notNull(),
  revealsUsedTotal: integer("reveals_used_total").default(0).notNull(),
  lastActiveAt: timestamp("last_active_at"),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (t) => [
  index('users_clerk_id_idx').on(t.clerkId),
  uniqueIndex('users_email_idx').on(t.email),
]);

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
