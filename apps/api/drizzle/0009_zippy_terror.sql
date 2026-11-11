ALTER TABLE "medications" ADD COLUMN "high_cost_checked" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "medications" ADD COLUMN "lme_filled_on" date;--> statement-breakpoint
ALTER TABLE "medications" ADD COLUMN "high_cost_since" date;