CREATE TYPE "public"."atlas_course" AS ENUM('data-engineering', 'ai-engineer', 'mlops-engineer', 'data-scientist', 'analytics-engineer', 'applied-llm-engineer', 'cloud-data-engineer', 'python-libraries', 'sql');--> statement-breakpoint
CREATE TYPE "public"."candidate_status" AS ENUM('candidate', 'approved', 'needs_revision', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."course_source" AS ENUM('authored', 'heuristic_legacy');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."learning_mode" AS ENUM('guided', 'hint', 'independent', 'dynamic_ai_adaptive');--> statement-breakpoint
CREATE TYPE "public"."note_type" AS ENUM('theory', 'cheatsheet', 'reference', 'quickstart');--> statement-breakpoint
CREATE TYPE "public"."progress_status" AS ENUM('not_started', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."project_language" AS ENUM('python', 'sql', 'both');--> statement-breakpoint
CREATE TYPE "public"."quality_status" AS ENUM('unreviewed', 'approved', 'needs_revision', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan" AS ENUM('free', 'pro_monthly', 'pro_annual');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'canceled', 'past_due', 'trialing', 'incomplete');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('free', 'pro');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('learner', 'admin');--> statement-breakpoint
CREATE TYPE "public"."validation_type" AS ENUM('exact', 'regex', 'contains', 'numeric_tolerance', 'csv_set_equal', 'csv_ordered', 'json_equal', 'sql_resultset', 'self_attest');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"username" text,
	"bio" text,
	"role" "user_role" DEFAULT 'learner' NOT NULL,
	"subscription_tier" "subscription_tier" DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"reveals_used_total" integer DEFAULT 0 NOT NULL,
	"last_active_at" timestamp,
	"ai_tutor_last_read_at" timestamp with time zone,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "processed_webhook_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan" "subscription_plan" NOT NULL,
	"status" "subscription_status" NOT NULL,
	"current_period_end" timestamp,
	"cancel_at_period_end" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"tagline" text,
	"description" text,
	"icon_name" text,
	"color_hex" text,
	"is_available" boolean DEFAULT false NOT NULL,
	"coming_soon" boolean DEFAULT true NOT NULL,
	"total_projects" integer DEFAULT 0 NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "domains_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"enabled_for_roles" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"description" text,
	"notes" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "feature_flags_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "project_hints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"step_number" integer,
	"hint_level" integer NOT NULL,
	"hint_text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"track_id" uuid,
	"title" text NOT NULL,
	"content_md" text NOT NULL,
	"note_type" "note_type" DEFAULT 'theory' NOT NULL,
	"video_url" text,
	"order_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_solutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"solution_code" text,
	"solution_explanation_md" text NOT NULL,
	"file_structure_json" jsonb,
	"video_explanation_url" text,
	CONSTRAINT "project_solutions_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "project_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"step_number" integer NOT NULL,
	"title" text NOT NULL,
	"instruction_md" text NOT NULL,
	"code_context" text,
	"expected_output" text,
	"validation_type" "validation_type" DEFAULT 'self_attest' NOT NULL,
	"validation_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"validation_hint" text,
	"xp_reward" integer DEFAULT 25 NOT NULL,
	"starter_code" text,
	"type" text DEFAULT 'code_python' NOT NULL,
	"expected_outputs" jsonb,
	"dataset_refs" jsonb,
	"execution_override" jsonb,
	"learning_objective" text,
	"required_skill" text,
	"pedagogy_config" jsonb
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"domain_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"short_description" text NOT NULL,
	"full_description" text NOT NULL,
	"difficulty_level" "difficulty" NOT NULL,
	"estimated_minutes" integer DEFAULT 60 NOT NULL,
	"tech_stack" text[] NOT NULL,
	"learning_objectives" text[] NOT NULL,
	"prerequisites" text[],
	"order_index" integer DEFAULT 0 NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL,
	"thumbnail_url" text,
	"starter_code_python" text,
	"starter_code_sql" text,
	"starter_files" jsonb,
	"language" "project_language" DEFAULT 'python' NOT NULL,
	"is_multi_file" boolean DEFAULT false NOT NULL,
	"is_walkthrough_only" boolean DEFAULT false NOT NULL,
	"total_steps" integer DEFAULT 1 NOT NULL,
	"tags" text[],
	"search_vector" "tsvector",
	"xp_reward" integer DEFAULT 100 NOT NULL,
	"enrolled_count" integer DEFAULT 0 NOT NULL,
	"completion_rate" integer DEFAULT 0 NOT NULL,
	"job_outcomes" jsonb,
	"execution_profile" jsonb,
	"quality_status" "quality_status" DEFAULT 'unreviewed' NOT NULL,
	"quality_score" numeric(5, 2),
	"quality_breakdown" jsonb,
	"last_quality_audit_at" timestamp,
	"course" "atlas_course" NOT NULL,
	"course_source" "course_source" NOT NULL,
	"source_candidate_id" uuid,
	"learner_visible" boolean DEFAULT true NOT NULL,
	"replace_candidate_slug" text,
	"is_anchor" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "projects_replace_candidate_no_self" CHECK (replace_candidate_slug IS NULL OR replace_candidate_slug <> slug)
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"difficulty_level" "difficulty" NOT NULL,
	"estimated_hours" integer,
	"project_count" integer DEFAULT 0 NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"prerequisites" text[],
	"is_premium" boolean DEFAULT false NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"domain_interest" text,
	"confirmation_token" text NOT NULL,
	"is_confirmed" boolean DEFAULT false NOT NULL,
	"signed_up_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email"),
	CONSTRAINT "waitlist_confirmation_token_unique" UNIQUE("confirmation_token")
);
--> statement-breakpoint
CREATE TABLE "ai_chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"messages_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_code_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"step_id" uuid,
	"code" text NOT NULL,
	"stdout" text DEFAULT '' NOT NULL,
	"stderr" text DEFAULT '' NOT NULL,
	"ok" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_code_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"files" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"language" "project_language" DEFAULT 'python' NOT NULL,
	"saved_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "progress_status" DEFAULT 'not_started' NOT NULL,
	"current_step" integer DEFAULT 1 NOT NULL,
	"learning_mode" "learning_mode" DEFAULT 'guided' NOT NULL,
	"hints_used" integer DEFAULT 0 NOT NULL,
	"revealed_answer" boolean DEFAULT false NOT NULL,
	"completion_percent" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"last_updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_project_step_hints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"step_id" uuid NOT NULL,
	"hint_level" integer DEFAULT 0 NOT NULL,
	"last_offered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_step_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"step_number" integer NOT NULL,
	"passed" boolean NOT NULL,
	"validation_output" text,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	"submission_excerpt" text,
	"submission_sha256" text
);
--> statement-breakpoint
CREATE TABLE "user_streaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_activity_date" date,
	"freezes_available" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_streaks_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_xp" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"current_level_xp" integer DEFAULT 0 NOT NULL,
	"xp_to_next_level" integer DEFAULT 100 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_xp_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "xp_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mastery_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"title" text NOT NULL,
	"question" text NOT NULL,
	"starter_code" text,
	"solution_code" text,
	"hint" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"xp_reward" integer DEFAULT 10 NOT NULL,
	"validation_type" "validation_type" DEFAULT 'self_attest' NOT NULL,
	"validation_config" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mastery_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"content_md" text NOT NULL,
	"type" text DEFAULT 'reading' NOT NULL,
	"estimated_minutes" integer DEFAULT 15 NOT NULL,
	"xp_reward" integer DEFAULT 15 NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"video_url" text
);
--> statement-breakpoint
CREATE TABLE "mastery_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"difficulty_level" "difficulty" NOT NULL,
	"estimated_hours" integer DEFAULT 2,
	"lesson_count" integer DEFAULT 0 NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"learning_objectives" text[]
);
--> statement-breakpoint
CREATE TABLE "mastery_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	"xp_earned" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mastery_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'python_mastery' NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "mastery_sections_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ai_tutor_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"step_id" uuid,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposed_title" text NOT NULL,
	"proposed_course" text NOT NULL,
	"target_roles" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"difficulty" "difficulty" NOT NULL,
	"proposed_stack" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"proposal" jsonb NOT NULL,
	"quality_score" numeric(5, 2),
	"quality_breakdown" jsonb,
	"duplicate_candidates" jsonb,
	"status" "candidate_status" DEFAULT 'candidate' NOT NULL,
	"reviewer_notes" text,
	"source" text,
	"promoted_project_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"ref_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"reason" text,
	"actor" text NOT NULL,
	"rubric_version" text,
	"quality_score" numeric(5, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_hints" ADD CONSTRAINT "project_hints_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_notes" ADD CONSTRAINT "project_notes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_notes" ADD CONSTRAINT "project_notes_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_solutions" ADD CONSTRAINT "project_solutions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_steps" ADD CONSTRAINT "project_steps_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_source_candidate_id_project_candidates_id_fk" FOREIGN KEY ("source_candidate_id") REFERENCES "public"."project_candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat_sessions" ADD CONSTRAINT "ai_chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat_sessions" ADD CONSTRAINT "ai_chat_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_code_runs" ADD CONSTRAINT "user_code_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_code_runs" ADD CONSTRAINT "user_code_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_code_sessions" ADD CONSTRAINT "user_code_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_code_sessions" ADD CONSTRAINT "user_code_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_project_step_hints" ADD CONSTRAINT "user_project_step_hints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_project_step_hints" ADD CONSTRAINT "user_project_step_hints_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_project_step_hints" ADD CONSTRAINT "user_project_step_hints_step_id_project_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."project_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_step_completions" ADD CONSTRAINT "user_step_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_step_completions" ADD CONSTRAINT "user_step_completions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_streaks" ADD CONSTRAINT "user_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_xp" ADD CONSTRAINT "user_xp_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_exercises" ADD CONSTRAINT "mastery_exercises_lesson_id_mastery_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."mastery_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_lessons" ADD CONSTRAINT "mastery_lessons_module_id_mastery_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."mastery_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_modules" ADD CONSTRAINT "mastery_modules_section_id_mastery_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."mastery_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_progress" ADD CONSTRAINT "mastery_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_progress" ADD CONSTRAINT "mastery_progress_lesson_id_mastery_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."mastery_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_sections" ADD CONSTRAINT "mastery_sections_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_tutor_messages" ADD CONSTRAINT "ai_tutor_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_tutor_messages" ADD CONSTRAINT "ai_tutor_messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_tutor_messages" ADD CONSTRAINT "ai_tutor_messages_step_id_project_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."project_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_candidates" ADD CONSTRAINT "project_candidates_promoted_project_id_projects_id_fk" FOREIGN KEY ("promoted_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_clerk_id_idx" ON "users" USING btree ("clerk_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "sub_stripe_customer_idx" ON "subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "sub_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sub_stripe_sub_id_idx" ON "subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_step_idx" ON "project_steps" USING btree ("project_id","step_number");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_track_slug_idx" ON "projects" USING btree ("track_id","slug");--> statement-breakpoint
CREATE INDEX "projects_track_id_idx" ON "projects" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "projects_domain_id_idx" ON "projects" USING btree ("domain_id");--> statement-breakpoint
CREATE INDEX "projects_order_idx" ON "projects" USING btree ("order_index");--> statement-breakpoint
CREATE INDEX "projects_course_idx" ON "projects" USING btree ("course");--> statement-breakpoint
CREATE INDEX "projects_source_candidate_idx" ON "projects" USING btree ("source_candidate_id");--> statement-breakpoint
CREATE INDEX "projects_learner_visible_idx" ON "projects" USING btree ("learner_visible");--> statement-breakpoint
CREATE UNIQUE INDEX "tracks_domain_slug_idx" ON "tracks" USING btree ("domain_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "tracks_domain_primary_idx" ON "tracks" USING btree ("domain_id") WHERE is_primary = true;--> statement-breakpoint
CREATE INDEX "audit_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "user_code_runs_user_step_idx" ON "user_code_runs" USING btree ("user_id","step_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "code_user_project_idx" ON "user_code_sessions" USING btree ("user_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "progress_user_project_idx" ON "user_progress" USING btree ("user_id","project_id");--> statement-breakpoint
CREATE INDEX "progress_user_id_idx" ON "user_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "progress_project_id_idx" ON "user_progress" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_step_hints_uniq" ON "user_project_step_hints" USING btree ("user_id","step_id");--> statement-breakpoint
CREATE INDEX "user_step_hints_user_idx" ON "user_project_step_hints" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "step_completion_idx" ON "user_step_completions" USING btree ("user_id","project_id","step_number");--> statement-breakpoint
CREATE INDEX "xp_transactions_user_idx" ON "xp_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mastery_lesson_slug_idx" ON "mastery_lessons" USING btree ("module_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "mastery_module_slug_idx" ON "mastery_modules" USING btree ("section_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "mastery_progress_user_lesson_idx" ON "mastery_progress" USING btree ("user_id","lesson_id");--> statement-breakpoint
CREATE INDEX "ai_tutor_user_project_idx" ON "ai_tutor_messages" USING btree ("user_id","project_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_tutor_user_created_idx" ON "ai_tutor_messages" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_tutor_content_fts_idx" ON "ai_tutor_messages" USING gin (to_tsvector('english', content));--> statement-breakpoint
CREATE INDEX "project_candidates_status_idx" ON "project_candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_candidates_course_idx" ON "project_candidates" USING btree ("proposed_course");--> statement-breakpoint
CREATE INDEX "project_candidates_promoted_project_idx" ON "project_candidates" USING btree ("promoted_project_id");--> statement-breakpoint
CREATE INDEX "project_candidates_source_idx" ON "project_candidates" USING btree ("source");--> statement-breakpoint
CREATE INDEX "project_status_history_ref_idx" ON "project_status_history" USING btree ("scope","ref_id");--> statement-breakpoint
CREATE INDEX "project_status_history_actor_idx" ON "project_status_history" USING btree ("actor");