ALTER TABLE "medications" ADD COLUMN "buy_instead_of_free" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "nickname" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "cep" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "relation" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "relation_other" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "invited_by_id" uuid;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "joined_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_invited_by_id_members_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;