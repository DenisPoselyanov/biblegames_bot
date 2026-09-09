CREATE TABLE "content_set_items" (
	"set_id" text NOT NULL,
	"version" integer NOT NULL,
	"position" integer NOT NULL,
	"question_id" text NOT NULL,
	"revision_id" text NOT NULL,
	CONSTRAINT "content_set_items_set_id_version_position_pk" PRIMARY KEY("set_id","version","position")
);
--> statement-breakpoint
CREATE TABLE "content_set_versions" (
	"set_id" text NOT NULL,
	"version" integer NOT NULL,
	"content_hash" text NOT NULL,
	"question_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_by" text,
	CONSTRAINT "content_set_versions_set_id_version_pk" PRIMARY KEY("set_id","version")
);
--> statement-breakpoint
CREATE TABLE "content_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"filter" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"status" text DEFAULT 'legacy_unreviewed' NOT NULL,
	"theme_id" text NOT NULL,
	"difficulty" text NOT NULL,
	"topic_node_id" text,
	"topic_path" text,
	"text" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_index" integer NOT NULL,
	"explanation_short" text,
	"explanation_deep" text,
	"reference" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"source" text DEFAULT 'legacy' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"superseded_at" timestamp with time zone,
	"quarantine_reason" text
);
--> statement-breakpoint
CREATE TABLE "scripture_references" (
	"revision_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"book" text NOT NULL,
	"chapter" integer NOT NULL,
	"verse_start" integer NOT NULL,
	"verse_end" integer,
	"translation" text,
	CONSTRAINT "scripture_references_revision_id_ordinal_pk" PRIMARY KEY("revision_id","ordinal")
);
--> statement-breakpoint
ALTER TABLE "content_set_versions" ADD CONSTRAINT "content_set_versions_set_id_content_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."content_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scripture_references" ADD CONSTRAINT "scripture_references_revision_id_question_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."question_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_content_set_items_lookup" ON "content_set_items" USING btree ("set_id","version");--> statement-breakpoint
CREATE INDEX "idx_content_sets_kind" ON "content_sets" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_question_revisions_question_number" ON "question_revisions" USING btree ("question_id","revision_number");--> statement-breakpoint
CREATE INDEX "idx_question_revisions_theme_difficulty" ON "question_revisions" USING btree ("theme_id","difficulty");--> statement-breakpoint
CREATE INDEX "idx_question_revisions_status" ON "question_revisions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_question_revisions_topic_node" ON "question_revisions" USING btree ("topic_node_id") WHERE "question_revisions"."topic_node_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_question_revisions_published" ON "question_revisions" USING btree ("question_id") WHERE "question_revisions"."status" = 'published';--> statement-breakpoint
CREATE INDEX "idx_scripture_references_book" ON "scripture_references" USING btree ("book","chapter");