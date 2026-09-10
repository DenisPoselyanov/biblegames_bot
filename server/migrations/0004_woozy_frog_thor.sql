CREATE TABLE "achievement_grants" (
	"user_id" text NOT NULL,
	"achievement_id" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "achievement_grants_user_id_achievement_id_pk" PRIMARY KEY("user_id","achievement_id")
);
--> statement-breakpoint
CREATE TABLE "player_theme_stats" (
	"user_id" text NOT NULL,
	"theme_id" text NOT NULL,
	"total_points" bigint DEFAULT 0 NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_theme_stats_user_id_theme_id_pk" PRIMARY KEY("user_id","theme_id")
);
--> statement-breakpoint
CREATE TABLE "progression_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"rank_tier" text DEFAULT 'baby' NOT NULL,
	"rank_plaque" integer DEFAULT 7 NOT NULL,
	"wisdom_points" integer DEFAULT 0 NOT NULL,
	"rank_unlocked_tier" text DEFAULT 'child' NOT NULL,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"last_active_at" timestamp with time zone,
	"millionaire_wins" integer DEFAULT 0 NOT NULL,
	"millionaire_max_level" integer DEFAULT 0 NOT NULL,
	"survival_high_score" integer DEFAULT 0 NOT NULL,
	"completed_levels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"theme_points" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"practice_tracks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"study_mastery" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progression_backfill_records" (
	"user_id" text PRIMARY KEY NOT NULL,
	"source_profile_updated_at" timestamp with time zone,
	"snapshot_hash" text NOT NULL,
	"achievements_granted" integer DEFAULT 0 NOT NULL,
	"entitlements_granted" integer DEFAULT 0 NOT NULL,
	"theme_stat_rows" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "achievement_grants" ADD CONSTRAINT "achievement_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_theme_stats" ADD CONSTRAINT "player_theme_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progression_state" ADD CONSTRAINT "progression_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;