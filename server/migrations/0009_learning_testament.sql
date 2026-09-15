ALTER TABLE "learning_plans" ADD COLUMN "testament" text;--> statement-breakpoint
ALTER TABLE "learning_objectives" ADD COLUMN "testament" text;--> statement-breakpoint
CREATE INDEX "idx_learning_plans_testament" ON "learning_plans" USING btree ("testament");--> statement-breakpoint
CREATE INDEX "idx_learning_objectives_testament" ON "learning_objectives" USING btree ("testament");
