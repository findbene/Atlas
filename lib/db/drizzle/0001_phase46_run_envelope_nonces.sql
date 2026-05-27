CREATE TABLE "run_envelope_nonces" (
	"nonce" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "run_envelope_nonces_expires_at_idx" ON "run_envelope_nonces" USING btree ("expires_at");
