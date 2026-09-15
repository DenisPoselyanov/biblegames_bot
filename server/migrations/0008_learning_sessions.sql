CREATE TABLE "lesson_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"lesson_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"module_id" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"content_revision" text NOT NULL,
	"checkpoint_block_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "practice_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mode" text NOT NULL,
	"objective_id" text NOT NULL,
	"question_revision_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_index" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lesson_sessions" ADD CONSTRAINT "lesson_sessions_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_objective_id_learning_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."learning_objectives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_lesson_sessions_user_status_activity" ON "lesson_sessions" USING btree ("user_id","status","last_activity_at");--> statement-breakpoint
CREATE INDEX "idx_lesson_sessions_user_lesson" ON "lesson_sessions" USING btree ("user_id","lesson_id");--> statement-breakpoint
CREATE INDEX "idx_practice_sessions_user_status" ON "practice_sessions" USING btree ("user_id","status");
