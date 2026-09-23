CREATE TABLE "content_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"revision_id" text,
	"reporter_user_id" text NOT NULL,
	"category" text NOT NULL,
	"comment" text,
	"session_id" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution_note" text,
	"resolved_revision_id" text,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_option_picks" (
	"revision_id" text NOT NULL,
	"question_id" text NOT NULL,
	"option_index" integer NOT NULL,
	"option_count" integer NOT NULL,
	"picks" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_option_picks_revision_id_option_index_pk" PRIMARY KEY("revision_id","option_index")
);
--> statement-breakpoint
CREATE INDEX "idx_content_reports_entity" ON "content_reports" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_content_reports_status" ON "content_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_content_reports_reporter" ON "content_reports" USING btree ("reporter_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_content_reports_open_per_reporter" ON "content_reports" USING btree ("reporter_user_id","entity_type","entity_id","category") WHERE "content_reports"."status" = 'open';--> statement-breakpoint
CREATE INDEX "idx_question_option_picks_question" ON "question_option_picks" USING btree ("question_id");
