import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
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
