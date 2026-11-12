ALTER TYPE "public"."alert_kind" ADD VALUE 'rotation_turn';--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "split_mode" text DEFAULT 'split' NOT NULL;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "rotation_start_month" text;--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "rotation_notified_month" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "rotation_order" integer;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "split_excluded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "split_excluded_reason" text;