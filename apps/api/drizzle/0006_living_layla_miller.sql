CREATE TYPE "public"."alert_kind" AS ENUM('dose_missed', 'unwell', 'low_stock');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"kind" "alert_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"dose_id" uuid,
	"medication_id" uuid,
	"pushes_delivered" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "medications" ADD COLUMN "stock_units" integer;--> statement-breakpoint
ALTER TABLE "medications" ADD COLUMN "stock_counted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "medications" ADD COLUMN "low_stock_alerted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_dose_id_doses_id_fk" FOREIGN KEY ("dose_id") REFERENCES "public"."doses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_medication_id_medications_id_fk" FOREIGN KEY ("medication_id") REFERENCES "public"."medications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Backfill the history with the alerts sent before this table existed.
INSERT INTO "alerts" ("family_id", "kind", "title", "body", "dose_id", "created_at")
SELECT p."family_id", 'dose_missed',
  coalesce(p."nickname", p."name") || ' não confirmou o remédio',
  concat_ws(' ', med."name", med."strength") || ' das ' || to_char(d."scheduled_at" AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || '. Vale ligar para ela.',
  d."id", d."family_alerted_at"
FROM "doses" d
JOIN "medications" med ON med."id" = d."medication_id"
JOIN "members" p ON p."id" = med."patient_id"
WHERE d."family_alerted_at" IS NOT NULL;--> statement-breakpoint
INSERT INTO "alerts" ("family_id", "kind", "title", "body", "dose_id", "created_at")
SELECT p."family_id", 'unwell',
  coalesce(p."nickname", p."name") || ' não está se sentindo bem',
  CASE WHEN coalesce(trim(c."note"), '') = '' THEN 'Ela disse que não está bem.' ELSE 'Ela disse: "' || trim(c."note") || '".' END || ' Vale ligar para ela.',
  d."id", c."created_at"
FROM "voice_calls" c
JOIN "doses" d ON d."id" = c."dose_id"
JOIN "medications" med ON med."id" = d."medication_id"
JOIN "members" p ON p."id" = med."patient_id"
WHERE c."feels_unwell" = true;
