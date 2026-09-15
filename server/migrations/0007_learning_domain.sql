CREATE TABLE "learning_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"theme_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'legacy_unreviewed' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'topic-tree' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_modules" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"parent_module_id" text,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'legacy_unreviewed' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'topic-tree' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_objectives" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"topic_path" text,
	"status" text DEFAULT 'legacy_unreviewed' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'topic-tree' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"module_id" text NOT NULL,
	"objective_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'legacy_unreviewed' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'topic-tree' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"lesson_id" text NOT NULL,
	"position" integer NOT NULL,
	"block_type" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'legacy_unreviewed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "learning_modules" ADD CONSTRAINT "learning_modules_plan_id_learning_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."learning_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_modules" ADD CONSTRAINT "learning_modules_parent_module_id_learning_modules_id_fk" FOREIGN KEY ("parent_module_id") REFERENCES "public"."learning_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_objectives" ADD CONSTRAINT "learning_objectives_plan_id_learning_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."learning_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_plan_id_learning_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."learning_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_learning_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."learning_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_objective_id_learning_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."learning_objectives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_blocks" ADD CONSTRAINT "lesson_blocks_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_learning_plans_theme" ON "learning_plans" USING btree ("theme_id");--> statement-breakpoint
CREATE INDEX "idx_learning_plans_status" ON "learning_plans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_learning_modules_plan" ON "learning_modules" USING btree ("plan_id","position");--> statement-breakpoint
CREATE INDEX "idx_learning_modules_parent" ON "learning_modules" USING btree ("parent_module_id");--> statement-breakpoint
CREATE INDEX "idx_learning_objectives_plan" ON "learning_objectives" USING btree ("plan_id","position");--> statement-breakpoint
CREATE INDEX "idx_lessons_module" ON "lessons" USING btree ("module_id","position");--> statement-breakpoint
CREATE INDEX "idx_lessons_objective" ON "lessons" USING btree ("objective_id");--> statement-breakpoint
CREATE INDEX "idx_lessons_plan" ON "lessons" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_lesson_blocks_lesson_position" ON "lesson_blocks" USING btree ("lesson_id","position");--> statement-breakpoint
CREATE INDEX "idx_lesson_blocks_type" ON "lesson_blocks" USING btree ("block_type");
