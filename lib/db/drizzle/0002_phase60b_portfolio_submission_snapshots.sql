CREATE TABLE "portfolio_submission_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"step_id" uuid NOT NULL,
	"step_number" integer NOT NULL,
	"validation_kind" text NOT NULL,
	"is_server_graded" boolean DEFAULT false NOT NULL,
	"passed" boolean NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"submission_sha256" text,
	"submission_excerpt" text,
	"runtime_output_sha256" text,
	"runtime_output_excerpt" text,
	"source" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portfolio_submission_snapshots" ADD CONSTRAINT "portfolio_submission_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "portfolio_submission_snapshots" ADD CONSTRAINT "portfolio_submission_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "portfolio_submission_snapshots" ADD CONSTRAINT "portfolio_submission_snapshots_step_id_project_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."project_steps"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_snapshot_user_project_step_idx" ON "portfolio_submission_snapshots" USING btree ("user_id","project_id","step_id");
--> statement-breakpoint
CREATE INDEX "portfolio_snapshot_user_project_idx" ON "portfolio_submission_snapshots" USING btree ("user_id","project_id");
