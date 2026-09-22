CREATE TABLE "lesson_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"lesson_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"status" text DEFAULT 'legacy_unreviewed' NOT NULL,
	"plan_id" text NOT NULL,
	"module_id" text NOT NULL,
	"objective_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"source" text DEFAULT 'authored' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"superseded_at" timestamp with time zone,
	"quarantine_reason" text
);
--> statement-breakpoint
ALTER TABLE "lesson_revisions" ADD CONSTRAINT "lesson_revisions_plan_id_learning_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."learning_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_revisions" ADD CONSTRAINT "lesson_revisions_module_id_learning_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."learning_modules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_revisions" ADD CONSTRAINT "lesson_revisions_objective_id_learning_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."learning_objectives"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_lesson_revisions_lesson_number" ON "lesson_revisions" USING btree ("lesson_id","revision_number");--> statement-breakpoint
CREATE INDEX "idx_lesson_revisions_status" ON "lesson_revisions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_lesson_revisions_plan" ON "lesson_revisions" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_lesson_revisions_published" ON "lesson_revisions" USING btree ("lesson_id") WHERE "lesson_revisions"."status" = 'published';
