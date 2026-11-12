CREATE TABLE "benefit_program_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"active_ingredients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"loose_key" text,
	"loose_match_key" text,
	"extended_release" boolean DEFAULT false NOT NULL,
	"access" text DEFAULT 'open' NOT NULL,
	"availability" text,
	"group" text,
	"conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"condition_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "benefit_program_items_programId_key_unique" UNIQUE("program_id","key")
);
--> statement-breakpoint
CREATE TABLE "benefit_program_syncs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" text NOT NULL,
	"origin" text NOT NULL,
	"status" text NOT NULL,
	"version" text,
	"added" integer DEFAULT 0 NOT NULL,
	"removed" integer DEFAULT 0 NOT NULL,
	"changed" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "benefit_programs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"level" text NOT NULL,
	"region" text NOT NULL,
	"channel" text NOT NULL,
	"source_url" text NOT NULL,
	"version" text NOT NULL,
	"documents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checked_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "benefit_program_items" ADD CONSTRAINT "benefit_program_items_program_id_benefit_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."benefit_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benefit_program_syncs" ADD CONSTRAINT "benefit_program_syncs_program_id_benefit_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."benefit_programs"("id") ON DELETE cascade ON UPDATE no action;