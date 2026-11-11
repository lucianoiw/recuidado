import {
  type AnyPgColumn,
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// Demo data is always synthetic (Hack Brasil rule 6.9).

export const memberRole = pgEnum('member_role', ['caregiver', 'patient']);
export const doseStatus = pgEnum('dose_status', ['pending', 'taken', 'missed']);
export const confirmationChannel = pgEnum('confirmation_channel', ['app', 'voice']);

export const families = pgTable('families', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const members = pgTable('members', {
  id: uuid().primaryKey().defaultRandom(),
  familyId: uuid()
    .notNull()
    .references(() => families.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  email: text().unique(),
  phone: text(),
  role: memberRole().notNull(),
  // Patients who do not use the app get a voice call instead of a push.
  prefersVoice: boolean().notNull().default(false),
  // How the family calls the patient, e.g. "Dona Maria". Used by screens and the voice call.
  nickname: text(),
  birthDate: date(),
  // Digits only, e.g. "01310100".
  cep: text(),
  // Caregiver relation to the patient, one of the web RELATIONS; free text in relationOther.
  relation: text(),
  relationOther: text(),
  // Set on caregivers added as an invite during onboarding; joinedAt is set when they open the app.
  invitedById: uuid().references((): AnyPgColumn => members.id, { onDelete: 'set null' }),
  joinedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const medications = pgTable('medications', {
  id: uuid().primaryKey().defaultRandom(),
  patientId: uuid()
    .notNull()
    .references(() => members.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  activeIngredient: text(),
  strength: text(),
  // Local times of day, e.g. ["08:00", "20:00"].
  times: jsonb().$type<string[]>().notNull().default([]),
  freeInFarmaciaPopular: boolean().notNull().default(false),
  // Reference monthly cost in cents, capped by the CMED max price.
  monthlyCostCents: integer().notNull().default(0),
  // The family chose to buy it even though it is free in Farmácia Popular.
  buyInsteadOfFree: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const doses = pgTable('doses', {
  id: uuid().primaryKey().defaultRandom(),
  medicationId: uuid()
    .notNull()
    .references(() => medications.id, { onDelete: 'cascade' }),
  scheduledAt: timestamp({ withTimezone: true }).notNull(),
  status: doseStatus().notNull().default('pending'),
  confirmedVia: confirmationChannel(),
  confirmedAt: timestamp({ withTimezone: true }),
  familyAlertedAt: timestamp({ withTimezone: true }),
}, (t) => [unique().on(t.medicationId, t.scheduledAt)]);

// Web Push subscriptions (one per browser). Patients get dose reminders,
// caregivers get alerts when a dose is not confirmed.
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid().primaryKey().defaultRandom(),
  memberId: uuid()
    .notNull()
    .references(() => members.id, { onDelete: 'cascade' }),
  endpoint: text().notNull().unique(),
  p256dh: text().notNull(),
  auth: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const voiceCallOutcome = pgEnum('voice_call_outcome', [
  'confirmed',
  'not_taken',
  'unclear',
  'no_answer',
  'failed',
]);

// Every reminder call made by apps/voice, kept for the family history and debugging.
export const voiceCalls = pgTable('voice_calls', {
  id: uuid().primaryKey().defaultRandom(),
  doseId: uuid()
    .notNull()
    .references(() => doses.id, { onDelete: 'cascade' }),
  sessionId: text().notNull().unique(),
  outcome: voiceCallOutcome().notNull(),
  confirmed: boolean().notNull(),
  // Self-reported in the call ("E a senhora, está bem?"). Not a diagnosis.
  feelsUnwell: boolean(),
  note: text(),
  transcript: jsonb().$type<{ speaker: 'assistant' | 'patient'; text: string }[]>().notNull().default([]),
  durationSeconds: integer(),
  endReason: text(),
  error: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const costShares = pgTable('cost_shares', {
  id: uuid().primaryKey().defaultRandom(),
  familyId: uuid()
    .notNull()
    .references(() => families.id, { onDelete: 'cascade' }),
  memberId: uuid()
    .notNull()
    .references(() => members.id, { onDelete: 'cascade' }),
  // First day of the month, e.g. 2026-11-01.
  month: text().notNull(),
  amountCents: integer().notNull(),
  paidAt: timestamp({ withTimezone: true }),
});
