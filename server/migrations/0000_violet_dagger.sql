-- Phase 2 WS2 (ADR-012): adopt the tables Phase 1 created via the hand-written
-- server/db/schema.sql. Hand-edited to IF NOT EXISTS so this migration is a no-op
-- on databases that already have them and a full create on fresh ones (pglite
-- tests, new deploys). Future `db:generate` diffs the snapshot JSON, not this SQL.

CREATE TABLE IF NOT EXISTS "player_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_stats" (
	"user_id" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "study_answers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"question_id" text NOT NULL,
	"subtheme_id" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"answered_at" timestamp with time zone NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "telemetry_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"event_name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wallet_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"reversal_of" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "wallet_ledger_source_type_source_id_key" UNIQUE("source_type","source_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "question_exclusions" (
	"question_id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "question_overrides" (
	"question_id" text PRIMARY KEY NOT NULL,
	"patch" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"theme_id" text NOT NULL,
	"difficulty" text NOT NULL,
	"topic_node_id" text,
	"source" text DEFAULT 'embedded' NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"actor_auth_source" text,
	"action" text NOT NULL,
	"target" text,
	"result" text NOT NULL,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "migration_records" (
	"user_id" text PRIMARY KEY NOT NULL,
	"source_version" integer DEFAULT 0 NOT NULL,
	"migration_version" integer NOT NULL,
	"submitted_hash" text,
	"accepted" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rejected" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"wallet_opening_entry_id" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_study_answers_user_time" ON "study_answers" USING btree ("user_id","answered_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_telemetry_user_time" ON "telemetry_events" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_wallet_ledger_user_time" ON "wallet_ledger" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_questions_theme_difficulty" ON "questions" USING btree ("theme_id","difficulty");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_questions_topic_node" ON "questions" USING btree ("topic_node_id") WHERE "questions"."topic_node_id" is not null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_log_action_time" ON "audit_log" USING btree ("action","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_log_actor_time" ON "audit_log" USING btree ("actor_user_id","created_at" DESC NULLS LAST);