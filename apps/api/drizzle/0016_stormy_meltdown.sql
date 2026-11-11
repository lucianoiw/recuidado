ALTER TABLE "families" ADD COLUMN "subscription_status" text;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "subscription_checkout_id" text;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "subscription_id" text;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "subscription_trial_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "subscription_updated_at" timestamp with time zone;