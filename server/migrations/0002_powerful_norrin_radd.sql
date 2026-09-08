CREATE TABLE "rate_limit_counters" (
	"bucket" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_rate_limit_counters_reset" ON "rate_limit_counters" USING btree ("reset_at");