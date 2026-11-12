import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  alerts,
  type Database,
  doses,
  localDate,
  localDateTime,
  localTime,
  medications,
  members,
  voiceCalls,
} from '@recuidado/core';

/**
 * The fixed story of the demo family (synthetic data, Hack Brasil rule 6.9):
 * Dona Maria, 68, hypertensive and diabetic, with heart failure. Two of her four medicines
 * are free in Farmácia Popular; the statin is not and is almost over; sacubitril valsartana
 * can be free in the Alto Custo and the family is halfway through its checklist. The price
 * comes from CMED at read time, from activeIngredient and strength.
 */
export const DEMO_MEDICATIONS = [
  { name: 'Losartana', activeIngredient: 'Losartana potássica', strength: '50 mg', times: ['08:00', '20:00'], stockUnits: 40 },
  { name: 'Metformina', activeIngredient: 'Cloridrato de metformina', strength: '850 mg', times: ['08:00', '20:00'], stockUnits: 52 },
  { name: 'Rosuvastatina', activeIngredient: 'Rosuvastatina cálcica', strength: '10 mg', times: ['20:00'], stockUnits: 4 },
  { name: 'Sacubitril valsartana', activeIngredient: 'Sacubitril valsartana sódica', strength: '50 mg', times: ['08:00', '20:00'], stockUnits: 30 },
] as const;

/**
 * Alto Custo path of the demo: items the family already has (ids of the SES-SP leaflet in
 * @recuidado/data) and how long ago the doctor filled the LME, so Hoje always shows
 * "Entregar o laudo até" with about 20 days left.
 */
export const DEMO_HIGH_COST = {
  medication: 'Sacubitril valsartana',
  checked: ['lme', 'prescription', 'id_document', 'sus_card'],
  lmeFilledDaysAgo: 70,
} as const;

export const DEMO_PATIENT_PROFILE = { nickname: 'Dona Maria', birthDate: '1958-03-14', cep: '01310100' };
export const DEMO_CAREGIVER_RELATION = 'Filho(a)';

/** Days of past doses kept filled in, besides the doses of today that already passed. */
export const HISTORY_DAYS = 7;

export interface HistoryDose {
  medication: string;
  scheduledAt: Date;
  status: 'taken' | 'missed';
  confirmedVia: 'app' | 'voice' | null;
  confirmedAt: Date | null;
  familyAlertedAt: Date | null;
}

const minutes = (at: Date, n: number) => new Date(at.getTime() + n * 60_000);

/**
 * Past doses of the last HISTORY_DAYS days and of today until now. Almost all taken in the app,
 * two confirmed in the reminder call, one missed with the family alerted. Same result for the same day.
 */
export function demoHistory(now: Date): HistoryDose[] {
  const result: HistoryDose[] = [];
  for (let day = -HISTORY_DAYS; day <= 0; day++) {
    const date = localDate(now, day);
    for (const med of DEMO_MEDICATIONS) {
      for (const time of med.times) {
        const scheduledAt = localDateTime(date, time)!;
        // Leave a little room so the dose of right now stays with the real reminder flow.
        if (scheduledAt.getTime() > now.getTime() - 60 * 60_000) continue;
        if (day === -3 && med.name === 'Metformina' && time === '20:00') {
          result.push({ medication: med.name, scheduledAt, status: 'missed', confirmedVia: null, confirmedAt: null, familyAlertedAt: minutes(scheduledAt, 45) });
        } else if ((day === -2 || day === -5) && med.name === 'Losartana' && time === '08:00') {
          result.push({ medication: med.name, scheduledAt, status: 'taken', confirmedVia: 'voice', confirmedAt: minutes(scheduledAt, 17), familyAlertedAt: null });
        } else {
          // 2 to 12 minutes late, varying by day and time.
          const late = 2 + ((Math.abs(day) * 7 + Number(time.slice(0, 2))) % 11);
          result.push({ medication: med.name, scheduledAt, status: 'taken', confirmedVia: 'app', confirmedAt: minutes(scheduledAt, late), familyAlertedAt: null });
        }
      }
    }
  }
  return result;
}

/** What she says in the synthetic reminder calls of the history. */
function demoTranscript(name: string, medication: string) {
  return [
    { speaker: 'assistant' as const, text: `Oi, ${name}, bom dia! Aqui é a assistente virtual da Recuidado. Como a senhora está?` },
    { speaker: 'patient' as const, text: 'Estou bem, graças a Deus.' },
    { speaker: 'assistant' as const, text: `Que bom! A senhora já tomou a ${medication} das oito da manhã?` },
    { speaker: 'patient' as const, text: 'Tomei sim, agorinha com o café.' },
    { speaker: 'assistant' as const, text: `Obrigada, tchau, ${name}!` },
  ];
}

/**
 * Brings the demo family to its fixed state. Runs on boot and is safe to run again:
 * profile and medicines are set to the values above, the stock count restarts now,
 * and missing history is filled in. The patient's phone is never touched (set by the team).
 */
export async function seedDemoFamily(
  db: Database,
  ids: { familyId: string; patientId: string },
  now = new Date(),
): Promise<string[]> {
  await db
    .update(members)
    .set({ birthDate: DEMO_PATIENT_PROFILE.birthDate, cep: DEMO_PATIENT_PROFILE.cep, prefersVoice: true })
    .where(eq(members.id, ids.patientId));
  await db
    .update(members)
    .set({ nickname: DEMO_PATIENT_PROFILE.nickname })
    .where(and(eq(members.id, ids.patientId), isNull(members.nickname)));
  await db
    .update(members)
    .set({ relation: DEMO_CAREGIVER_RELATION })
    .where(and(eq(members.familyId, ids.familyId), eq(members.role, 'caregiver'), isNull(members.relation)));

  const existing = await db
    .select({ id: medications.id, name: medications.name })
    .from(medications)
    .where(and(eq(medications.patientId, ids.patientId), inArray(medications.name, DEMO_MEDICATIONS.map((m) => m.name)), isNull(medications.stoppedAt)));
  const medIds = new Map<string, string>();
  for (const med of DEMO_MEDICATIONS) {
    const values = {
      activeIngredient: med.activeIngredient,
      strength: med.strength,
      times: [...med.times],
      freeInFarmaciaPopular: false,
      buyInsteadOfFree: false,
      stockUnits: med.stockUnits,
      stockCountedAt: now,
      ...(med.name === DEMO_HIGH_COST.medication
        ? {
            highCostChecked: [...DEMO_HIGH_COST.checked],
            lmeFilledOn: localDate(now, -DEMO_HIGH_COST.lmeFilledDaysAgo),
            highCostSince: null,
          }
        : {}),
    };
    const found = existing.find((m) => m.name === med.name);
    if (found) {
      await db.update(medications).set(values).where(eq(medications.id, found.id));
      medIds.set(med.name, found.id);
    } else {
      const [row] = await db
        .insert(medications)
        .values({ patientId: ids.patientId, name: med.name, ...values })
        .returning({ id: medications.id });
      medIds.set(med.name, row.id);
    }
  }

  const history = demoHistory(now);
  await db
    .insert(doses)
    .values(
      history.map((h) => ({
        medicationId: medIds.get(h.medication)!,
        scheduledAt: h.scheduledAt,
        status: h.status,
        confirmedVia: h.confirmedVia,
        confirmedAt: h.confirmedAt,
        familyAlertedAt: h.familyAlertedAt,
      })),
    )
    .onConflictDoNothing();

  const [patient] = await db
    .select({ name: members.name, nickname: members.nickname })
    .from(members)
    .where(eq(members.id, ids.patientId));
  const callName = patient?.nickname || patient?.name || DEMO_PATIENT_PROFILE.nickname;
  for (const h of history.filter((x) => x.confirmedVia === 'voice' || x.status === 'missed')) {
    const [dose] = await db
      .select({ id: doses.id })
      .from(doses)
      .where(and(eq(doses.medicationId, medIds.get(h.medication)!), eq(doses.scheduledAt, h.scheduledAt)));
    if (!dose) continue;
    if (h.confirmedVia === 'voice') {
      await db
        .insert(voiceCalls)
        .values({
          doseId: dose.id,
          sessionId: `demo-seed-${dose.id}`,
          outcome: 'confirmed',
          confirmed: true,
          feelsUnwell: false,
          transcript: demoTranscript(callName, h.medication),
          durationSeconds: 38,
          endReason: 'goodbye',
          createdAt: h.confirmedAt!,
        })
        .onConflictDoNothing();
    } else {
      const [already] = await db
        .select({ id: alerts.id })
        .from(alerts)
        .where(and(eq(alerts.doseId, dose.id), eq(alerts.kind, 'dose_missed')));
      if (!already) {
        const med = DEMO_MEDICATIONS.find((m) => m.name === h.medication)!;
        await db.insert(alerts).values({
          familyId: ids.familyId,
          kind: 'dose_missed',
          title: `${callName} não confirmou o remédio`,
          body: `${med.name} ${med.strength} das ${localTime(h.scheduledAt)}. Vale ligar para ela.`,
          doseId: dose.id,
          medicationId: medIds.get(h.medication)!,
          createdAt: h.familyAlertedAt!,
        });
      }
    }
  }
  return [...medIds.values()];
}
