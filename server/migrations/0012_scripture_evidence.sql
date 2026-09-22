CREATE TABLE "scripture_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"revision_type" text NOT NULL,
	"revision_id" text NOT NULL,
	"raw_reference" text NOT NULL,
	"book_id" integer,
	"chapter" integer,
	"verse_start" integer,
	"verse_end" integer,
	"translation" text NOT NULL,
	"verdict" text NOT NULL,
	"quoted_text" text,
	"source_text" text,
	"adapter_version" text NOT NULL,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewer_decision" text
);
--> statement-breakpoint
CREATE INDEX "idx_scripture_evidence_revision" ON "scripture_evidence" USING btree ("revision_type","revision_id");--> statement-breakpoint
CREATE INDEX "idx_scripture_evidence_verdict" ON "scripture_evidence" USING btree ("verdict");
