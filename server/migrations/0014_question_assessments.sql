CREATE TABLE "question_assessments" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"content_hash" text NOT NULL,
	"source" text NOT NULL,
	"assessor" text NOT NULL,
	"rubric_version" text NOT NULL,
	"verdict" text NOT NULL,
	"criteria" jsonb NOT NULL,
	"suggested_difficulty" text,
	"suggested_topic_node_id" text,
	"suggested_explanation_short" text,
	"suggested_explanation_deep" text,
	"notes" text,
	"confidence" real,
	"risk" integer DEFAULT 0 NOT NULL,
	"subject" jsonb NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"decision" text,
	"decision_note" text,
	"decision_patch" jsonb,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_question_assessments_question" ON "question_assessments" USING btree ("source","question_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_question_assessments_queue" ON "question_assessments" USING btree ("source","risk");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_question_assessments_golden" ON "question_assessments" USING btree ("question_id") WHERE "question_assessments"."source" = 'golden';
