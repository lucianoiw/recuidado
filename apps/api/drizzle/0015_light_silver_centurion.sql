ALTER TABLE "members" DROP CONSTRAINT "members_email_unique";--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "emails_delivered" integer DEFAULT 0 NOT NULL;