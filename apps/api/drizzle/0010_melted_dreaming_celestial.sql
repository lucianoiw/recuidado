CREATE TYPE "public"."pharmacy_inquiry_status" AS ENUM('calling', 'answered', 'unclear', 'no_answer', 'failed');--> statement-breakpoint
CREATE TABLE "pharmacy_inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"pharmacy_name" text NOT NULL,
	"medications" jsonb NOT NULL,
	"status" "pharmacy_inquiry_status" DEFAULT 'calling' NOT NULL,
	"session_id" text,
	"answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text,
	"keys_pressed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"transcript" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"duration_seconds" integer,
	"end_reason" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "pharmacy_inquiries_sessionId_unique" UNIQUE("session_id")
);
--> statement-breakpoint
ALTER TABLE "pharmacy_inquiries" ADD CONSTRAINT "pharmacy_inquiries_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;