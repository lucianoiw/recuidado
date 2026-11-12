CREATE TABLE "call_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"kind" text,
	"family_id" uuid,
	"dose_id" uuid,
	"inquiry_id" uuid,
	"outcome" text,
	"duration_seconds" integer,
	"transcript" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recording_key" text,
	"recording" "bytea",
	"recording_bytes" integer,
	"started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "call_logs_sessionId_unique" UNIQUE("session_id")
);
--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_dose_id_doses_id_fk" FOREIGN KEY ("dose_id") REFERENCES "public"."doses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_inquiry_id_pharmacy_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."pharmacy_inquiries"("id") ON DELETE cascade ON UPDATE no action;