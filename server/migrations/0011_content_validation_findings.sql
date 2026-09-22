CREATE TABLE "content_validation_findings" (
	"id" text PRIMARY KEY NOT NULL,
	"revision_type" text NOT NULL,
	"revision_id" text NOT NULL,
	"kind" text NOT NULL,
	"severity" text NOT NULL,
	"label" text NOT NULL,
	"detail" text NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_content_validation_findings_revision" ON "content_validation_findings" USING btree ("revision_type","revision_id");--> statement-breakpoint
CREATE INDEX "idx_content_validation_findings_severity" ON "content_validation_findings" USING btree ("severity");
