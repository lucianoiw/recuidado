CREATE TYPE "public"."voice_call_outcome" AS ENUM('confirmed', 'not_taken', 'unclear', 'no_answer', 'failed');--> statement-breakpoint
CREATE TABLE "voice_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dose_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"outcome" "voice_call_outcome" NOT NULL,
	"confirmed" boolean NOT NULL,
	"note" text,
	"transcript" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"duration_seconds" integer,
	"end_reason" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "voice_calls_sessionId_unique" UNIQUE("session_id")
);
--> statement-breakpoint
ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_dose_id_doses_id_fk" FOREIGN KEY ("dose_id") REFERENCES "public"."doses"("id") ON DELETE cascade ON UPDATE no action;