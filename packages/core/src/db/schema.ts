import {
  type AnyPgColumn,
  boolean,
  customType,
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
  // Paid plan (AbacatePay subscription): reminder, emergency and pharmacy calls.
  // null: free plan. 'pending': checkout opened, not paid. 'active': paid or in trial. 'cancelled'.
  subscriptionStatus: text().$type<'pending' | 'active' | 'cancelled'>(),
  // AbacatePay checkout (bill_...) that started it; webhooks find the family by it.
  subscriptionCheckoutId: text(),
  // AbacatePay subscription (subs_...), known after the first webhook.
  subscriptionId: text(),
  subscriptionTrialEndsAt: timestamp({ withTimezone: true }),
  subscriptionUpdatedAt: timestamp({ withTimezone: true }),
  // How the siblings pay what is not free: 'split' (everyone pays a share by Pix to the one who
  // buys) or 'rotation' (each month one caregiver buys it all, in members.rotationOrder).
  splitMode: text().$type<'split' | 'rotation'>().notNull().default('split'),
  // "2026-11": the month the first caregiver of the rotation buys. Set again when the order changes.
  rotationStartMonth: text(),
  // "2026-11": last month the family got the "whose turn it is" alert.
  rotationNotifiedMonth: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const members = pgTable('members', {
  id: uuid().primaryKey().defaultRandom(),
  familyId: uuid()
    .notNull()
    .references(() => families.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  // Caregivers get alerts by e-mail too (Resend). Not unique: the same person may sign up more than one family.
  email: text(),
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
  // Caregiver position in the monthly rotation, from 0 (null: not ordered yet, goes last).
  rotationOrder: integer(),
  // Out of the split and of the rotation, e.g. a brother who pays the health plan instead.
  splitExcluded: boolean().notNull().default(false),
  // Why, shown to the family: "Paga o plano de saúde".
  splitExcludedReason: text(),
  invitedById: uuid().references((): AnyPgColumn => members.id, { onDelete: 'set null' }),
  joinedAt: timestamp({ withTimezone: true }),
  // LGPD consent of the patient (health data, art. 11): reminders, calls and the family seeing doses.
  // 'patient' when she accepted in her app, 'caregiver' when the family declared it at sign-up.
  consentAt: timestamp({ withTimezone: true }),
  consentSource: text().$type<'patient' | 'caregiver'>(),
  // Patient only: the secret in the link the family sends to her phone (/m/<token>). Her app has no
  // sign-up; this link is her login. Kept readable so the family can show the QR code again; a new
  // link replaces it and the old one stops working.
  accessToken: text().unique(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// E-mail sign-in: one row per code sent. The e-mail carries a 6 digit code and a link; only hashes are kept.
export const loginCodes = pgTable('login_codes', {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull(),
  codeHash: text().notNull(),
  linkHash: text().notNull().unique(),
  // Wrong codes typed; after 5 this code stops working.
  attempts: integer().notNull().default(0),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  usedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// A signed-in caregiver on one device. The app keeps the token; the database keeps its hash.
// memberId is empty between the first sign-in and the end of the sign-up.
export const sessions = pgTable('sessions', {
  id: uuid().primaryKey().defaultRandom(),
  tokenHash: text().notNull().unique(),
  email: text().notNull(),
  memberId: uuid().references(() => members.id, { onDelete: 'cascade' }),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
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
  // R2 key of the photo the family took of the real box or pill; her screen shows only this photo.
  photoKey: text(),
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
// check_in: result of the call back after an emergency; rotation_turn: whose month it is to buy.
export const alertKind = pgEnum('alert_kind', [
  'dose_missed',
  'unwell',
  'low_stock',
  'emergency',
  'emergency_call',
  'check_in',
  'rotation_turn',
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
  // E-mails Resend accepted for this alert.
  emailsDelivered: integer().notNull().default(0),
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
  // Calls placed together by one tap ("Perguntar às farmácias"), to compare their prices.
  batchId: uuid(),
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

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

/** One step of a call for the calls panel: what the AI or our code did, and when (ms after the call started). */
export interface CallEvent {
  atMs: number;
  text: string;
}

/**
 * Every phone call (reminder, call back, family member, pharmacy) with its transcript, the steps our code
 * took and the recording made by Asterisk. Shown on the calls panel of the proof of concept.
 * The recording lives in R2 (recordingKey) or, without R2, in this row (recording).
 */
export const callLogs = pgTable('call_logs', {
  id: uuid().primaryKey().defaultRandom(),
  sessionId: text().notNull().unique(),
  kind: text().$type<'reminder' | 'recall' | 'check_in' | 'caregiver' | 'pharmacy'>(),
  familyId: uuid().references(() => families.id, { onDelete: 'cascade' }),
  doseId: uuid().references(() => doses.id, { onDelete: 'cascade' }),
  inquiryId: uuid().references(() => pharmacyInquiries.id, { onDelete: 'cascade' }),
  outcome: text(),
  durationSeconds: integer(),
  // Emptied after VOICE_TRANSCRIPT_RETENTION_DAYS, with events and recording.
  transcript: jsonb().$type<{ speaker: string; text: string }[]>().notNull().default([]),
  events: jsonb().$type<CallEvent[]>().notNull().default([]),
  recordingKey: text(),
  recording: bytea(),
  recordingBytes: integer(),
  startedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
