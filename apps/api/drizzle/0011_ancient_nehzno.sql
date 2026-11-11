ALTER TABLE "members" ADD COLUMN "pix_key" text;--> statement-breakpoint
ALTER TABLE "cost_shares" ADD CONSTRAINT "cost_shares_familyId_memberId_month_unique" UNIQUE("family_id","member_id","month");