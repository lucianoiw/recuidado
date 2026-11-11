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
  // How the voice call addresses the patient: "a senhora" (female) or "o senhor" (male).
  gender: text().$type<'female' | 'male'>().notNull().default('female'),
  birthDate: date(),
  // Digits only, e.g. "01310100".
  cep: text(),
  // Caregiver relation to the patient, one of the web RELATIONS; free text in relationOther.
  relation: text(),
  relationOther: text(),
  // Set on caregivers added as an invite during onboarding; joinedAt is set when they open the app.
  // Pix key of the caregiver who buys the medicines and receives the others' shares.
  // Normalized: CPF digits, "+55" phone, lowercase e-mail or a random key (EVP).
  pixKey: text(),
  // The one caregiver phoned when she reports an emergency on the call. None set: the oldest caregiver with a phone.
  emergencyContact: boolean().notNull().default(false),
  invitedById: uuid().references((): AnyPgColumn => members.id, { onDelete: 'set null' }),
  joinedAt: timestamp({ withTimezone: true }),
  // LGPD consent of the patient (health data, art. 11): reminders, calls and the family seeing doses.
  // 'patient' when she accepted in her app, 'caregiver' when the family declared it at sign-up.
  consentAt: timestamp({ withTimezone: true }),
  consentSource: text().$type<'patient' | 'caregiver'>(),
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
  // Pills at home when the family last counted (null = not told). One pill per dose time.
  stockUnits: integer(),
  stockCountedAt: timestamp({ withTimezone: true }),
  // Set when the family was told it is running out; cleared when the stock is counted again.
  lowStockAlertedAt: timestamp({ withTimezone: true }),
  // Alto Custo (CEAF) path: ids of the checklist items the family already has.
  highCostChecked: jsonb().$type<string[]>().notNull().default([]),
  // Day the doctor filled the LME form: it is valid for 90 days to ask for the medicine.
  lmeFilledOn: date(),
  // Day the state approved it (or last renewed it): the next renewal counts from here.
  highCostSince: date(),
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
  // Extra dose created by the demo run (POST /demo/run). Telemetry tags its events with demo: true.
  demo: boolean().notNull().default(false),
  // When the API asked apps/voice to call. Counts toward the daily call limits.
  callRequestedAt: timestamp({ withTimezone: true }),
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
  // Emptied after VOICE_TRANSCRIPT_RETENTION_DAYS (see RetentionService).
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
}, (t) => [unique().on(t.familyId, t.memberId, t.month)]);

// emergency: she said it on the call; emergency_call: we phoned the first contact (no push);
// check_in: result of the call back after an emergency.
export const alertKind = pgEnum('alert_kind', [
  'dose_missed',
  'unwell',
  'low_stock',
  'emergency',
  'emergency_call',
  'check_in',
]);

// Every alert sent to the caregivers, for the history screen of the family app.
export const alerts = pgTable('alerts', {
  id: uuid().primaryKey().defaultRandom(),
  familyId: uuid()
    .notNull()
    .references(() => families.id, { onDelete: 'cascade' }),
  kind: alertKind().notNull(),
  title: text().notNull(),
  body: text().notNull(),
  doseId: uuid().references(() => doses.id, { onDelete: 'set null' }),
  medicationId: uuid().references(() => medications.id, { onDelete: 'set null' }),
  pushesDelivered: integer().notNull().default(0),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const pharmacyInquiryStatus = pgEnum('pharmacy_inquiry_status', [
  'calling',
  'answered',
  'unclear',
  'no_answer',
  'failed',
]);

// A voice call to a pharmacy asking stock, price and Farmácia Popular for some medicines.
// The phone dialed is never stored: it comes from PHARMACY_CALL_PHONE (a number the team controls).
export const pharmacyInquiries = pgTable('pharmacy_inquiries', {
  id: uuid().primaryKey().defaultRandom(),
  familyId: uuid()
    .notNull()
    .references(() => families.id, { onDelete: 'cascade' }),
  pharmacyName: text().notNull(),
  // What was asked, e.g. [{ medicationId, name: "Losartana", strength: "50 mg" }].
  medications: jsonb()
    .$type<{ medicationId: string; name: string; strength: string | null }[]>()
    .notNull(),
  status: pharmacyInquiryStatus().notNull().default('calling'),
  sessionId: text().unique(),
  // What the attendant said, one item per medicine. Prices are a phone reference, not an offer.
  answers: jsonb()
    .$type<
      {
        medication: string;
        available: 'yes' | 'no' | 'unknown';
        priceCents: number | null;
        package?: string;
        farmaciaPopular: 'yes' | 'no' | 'unknown';
      }[]
    >()
    .notNull()
    .default([]),
  note: text(),
  keysPressed: jsonb().$type<string[]>().notNull().default([]),
  transcript: jsonb().$type<{ speaker: 'assistant' | 'patient'; text: string }[]>().notNull().default([]),
  durationSeconds: integer(),
  endReason: text(),
  error: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp({ withTimezone: true }),
});
