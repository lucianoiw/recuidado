ALTER TABLE "members" ADD COLUMN "consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "consent_source" text;