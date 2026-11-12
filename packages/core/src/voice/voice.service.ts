import { InjectQueue } from '@nestjs/bullmq';
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { and, asc, count, desc, eq, gte, isNotNull, ne, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module.js';
import { doses, families, medications, members, pharmacyInquiries, voiceCalls } from '../db/schema.js';
import { DOSES_QUEUE, doseJobId, type DoseJob } from '../doses/doses.queue.js';
import { AlertsService } from '../alerts/alerts.service.js';
import { PlanGate } from '../billing/plan-gate.js';
import { DEMO_FAMILY } from '../family/demo-family.js';
import { mayContact } from '../privacy/consent.js';
import { StockService } from '../stock/stock.service.js';
import { minutesSince } from '../doses/time.js';
import { telemetry } from '../telemetry/telemetry.js';

/** Body that apps/voice posts to /doses/:id/voice-result. */
export interface VoiceResult {
  sessionId: string;
  outcome: 'confirmed' | 'not_taken' | 'unclear' | 'no_answer' | 'failed';
  confirmed: boolean;
  note?: string | null;
  feelsUnwell?: boolean | null;
  /** Fall, chest pain, shortness of breath or fainting: the caregivers also get a phone call. */
  emergency?: boolean | null;
  /** The call back after an emergency: only how she is now, the dose is left as it was. */
  checkIn?: boolean | null;
  /** The second call after she said she had not taken it yet. */
  recall?: boolean | null;
  transcript?: { speaker: 'assistant' | 'patient'; text: string }[];
  durationSeconds?: number | null;
  endReason?: string | null;
  error?: string | null;
}

export const alertJobId = (doseId: string) => doseJobId('alert-family', doseId);

/** After an emergency, Recuidado calls her back at most this many times. */
export const MAX_CHECK_INS = 3;

/** What she said on the call, in her own words (the patient lines of the transcript), else the model's note. */
export function patientWords(result: Pick<VoiceResult, 'transcript' | 'note'>): string | undefined {
  const said = (result.transcript ?? [])
    .filter((l) => l.speaker === 'patient')
    .map((l) => l.text.trim())
    .filter(Boolean)
    .join(' ');
  const words = said || result.note?.trim() || '';
  return words ? words.slice(0, 200) : undefined;
}

/** Her words inside quotes, without the final period, so a sentence never ends in '."."'. */
export function quoted(words: string): string {
  return `"${words.trim().replace(/[.\s]+$/, '')}"`;
}

/**
 * What she reported, retold in the third person for the first contact ("caiu no banheiro"), from the
 * model's note. Her exact words read back by the assistant sounded like mockery, so the call retells them.
 */
export function reported(note?: string | null): string | undefined {
  const s = (note ?? '')
    .trim()
    .replace(/^(ela|ele)\s+(falou|disse)\s+que\s+/i, '')
    .replace(/^(ela|ele|que)\s+/i, '')
    .replace(/[.\s]+$/, '');
  return s ? s.charAt(0).toLowerCase() + s.slice(1, 200) : undefined;
}

/** "ela" or "ele", for text the family reads or hears. */
export const pronoun = (gender?: 'female' | 'male' | null) => (gender === 'male' ? 'ele' : 'ela');

/** Body that apps/voice posts to /doses/:id/alert-call-result when an emergency call to a caregiver ends. */
export interface AlertCallResult {
  sessionId: string;
  memberId: string;
  message: string;
  answered: boolean;
  /** The assistant got to the SAMU line, the end of the message. */
  delivered: boolean;
}

export interface EmergencyContact {
  id: string;
  phone: string;
  name: string;
}

/** The caregivers still to call after `afterId`, in emergency order (all of them when afterId is absent). */
export function contactsAfter<T extends { id: string }>(ordered: T[], afterId?: string): T[] {
  if (!afterId) return ordered;
  const i = ordered.findIndex((c) => c.id === afterId);
  return i < 0 ? [] : ordered.slice(i + 1);
}

/** "Carlos", "Carlos e Ana", "Carlos, Ana e Pedro". */
export function namesList(names: string[]): string {
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

/** Where the caregiver's name goes in a calm message; filled in per caregiver as the call goes down the list. */
export const NAME_SLOT = '{nome}';

/**
 * The calm call after a dose that was not confirmed (no answer, or still not taken after the second call). No
 * alarm and no SAMU: the family is only asked to get in touch with her. Text by Luciano (12/11).
 */
export function missedDoseMessage(
  patientName: string,
  outcome: VoiceResult['outcome'],
  gender: 'female' | 'male' = 'female',
): string {
  const she = pronoun(gender);
  const what =
    outcome === 'not_taken'
      ? `Falei com ${patientName} e ${she} ainda não tomou o medicamento.`
      : `Tentei falar com ${patientName} e não consegui contato.`;
  return `Olá, ${NAME_SLOT}, tudo bem? Aqui é da Recuidado. ${what} Por favor, tente entrar em contato com ${she}. Obrigado.`;
}

export type CaregiverCallReason = 'emergency' | 'still_unwell' | 'no_answer';

/** What the first contact hears: what she reported, retold, and a request to call her. */
export function caregiverMessage(
  name: string,
  reason: CaregiverCallReason,
  summary?: string,
  gender: 'female' | 'male' = 'female',
): string {
  const she = pronoun(gender);
  const intro = 'Olá, aqui é a assistente virtual da Recuidado.';
  const end = `Seria interessante você ligar para ${she} agora. Se for grave, ligue para o SAMU, 192.`;
  if (reason === 'no_answer') return `${intro} Liguei de novo para ${name} e ${she} não atendeu. ${end}`;
  const said = `${she} falou que ${summary ?? 'não está se sentindo bem'}`;
  if (reason === 'still_unwell') return `${intro} Liguei de novo para ${name} e ${said}. ${end}`;
  return `${intro} Eu conversei com ${name} e ${said}. ${end}`;
}

@Injectable()
export class VoiceCallService {
  private readonly logger = new Logger(VoiceCallService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @InjectQueue(DOSES_QUEUE) private readonly queue: Queue<DoseJob>,
    private readonly config: ConfigService,
    private readonly alerts: AlertsService,
    private readonly stock: StockService,
    private readonly plan: PlanGate,
  ) {}

  /** Calls are the paid part: false when this family has no active plan (never for the demo family). */
  callsAllowed(familyId: string, isDemo: boolean): Promise<boolean> {
    return this.plan.callsAllowed(familyId, isDemo);
  }

  /**
   * Asks apps/voice to call the patient. Does nothing if the dose is no longer pending.
   * With checkIn, it is the call back after an emergency: the dose status does not matter.
   */
  async call(
    doseId: string,
    opts: { checkIn?: boolean; callBack?: boolean; recall?: boolean } = {},
  ): Promise<{ callId: string } | null> {
    const checkIn = Boolean(opts.checkIn);
    const voiceUrl = this.config.get<string>('VOICE_URL');
    const token = this.config.get<string>('VOICE_API_TOKEN');
    if (!voiceUrl || !token) {
      throw new ServiceUnavailableException('Ligação indisponível: VOICE_URL ou VOICE_API_TOKEN não configurado.');
    }

    const [row] = await this.db
      .select({
        status: doses.status,
        demo: doses.demo,
        patientId: members.id,
        patientName: sql<string>`coalesce(${members.nickname}, ${members.name})`,
        gender: members.gender,
        scheduledAt: doses.scheduledAt,
        phone: members.phone,
        consentAt: members.consentAt,
        familyId: members.familyId,
        familyName: families.name,
        medication: medications.name,
        strength: medications.strength,
      })
      .from(doses)
      .innerJoin(medications, eq(doses.medicationId, medications.id))
      .innerJoin(members, eq(medications.patientId, members.id))
      .innerJoin(families, eq(members.familyId, families.id))
      .where(eq(doses.id, doseId));
    if (!row) throw new NotFoundException('Dose não encontrada.');
    if (row.status !== 'pending' && !checkIn) {
      this.logger.log(`Dose ${doseId} is ${row.status}; not calling.`);
      return null;
    }
    if (!row.phone) {
      this.logger.warn(`Patient of dose ${doseId} has no phone; not calling.`);
      return null;
    }
    const isDemoFamily = row.familyName === DEMO_FAMILY;
    // The demo phone is a real person's: its daily doses only push, unless DEMO_SCHEDULED_CALLS is on.
    if (isDemoFamily && !row.demo && !this.config.get<boolean>('DEMO_SCHEDULED_CALLS')) {
      telemetry.capture('dose_call_skipped', { dose_id: doseId, reason: 'demo_scheduled' }, row.patientId);
      this.logger.log(`Dose ${doseId} is a scheduled demo dose; push only.`);
      return null;
    }
    if (!mayContact(row.consentAt, row.familyName)) {
      // LGPD: no call before she (or the family for her) agreed. Push and the family alert still work.
      telemetry.capture('dose_call_skipped', { dose_id: doseId, reason: 'no_consent' }, row.patientId);
      this.logger.log(`Patient of dose ${doseId} has not consented; not calling.`);
      return null;
    }
    // The call back after an emergency always goes out, even if the plan ended in between.
    if (!checkIn && !(await this.plan.callsAllowed(row.familyId, isDemoFamily))) {
      telemetry.capture('dose_call_skipped', { dose_id: doseId, reason: 'no_plan' }, row.patientId);
      this.logger.log(`Family of dose ${doseId} has no paid plan; push only.`);
      return null;
    }
    const overLimit = await this.overCallLimit(row.familyId, isDemoFamily);
    if (overLimit) {
      telemetry.capture('dose_call_skipped', { dose_id: doseId, reason: overLimit }, row.patientId);
      this.logger.warn(`Not calling for dose ${doseId}: ${overLimit}.`);
      return null;
    }

    const res = await fetch(new URL('/calls', voiceUrl), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        doseId,
        patientId: row.patientId,
        phone: row.phone,
        patientName: row.patientName,
        medications: [{ name: row.medication, dose: row.strength ?? undefined }],
        checkIn,
        callBack: opts.callBack ?? true,
        gender: row.gender,
        doseTime: row.scheduledAt.toISOString(),
        recall: Boolean(opts.recall),
        // Demo run doses keep the two-minute flow: no second call.
        recallLater: !checkIn && !opts.recall && !row.demo,
      }),
    });
    if (res.status === 403) {
      // apps/voice only calls numbers in CALL_ALLOWED_NUMBERS. Push and the family alert still work.
      telemetry.capture('dose_call_skipped', { dose_id: doseId, reason: 'number_not_allowed' }, row.patientId);
      this.logger.log(`Voice refused the number of dose ${doseId}; push only.`);
      return null;
    }
    if (!res.ok) {
      throw new Error(`Voice service answered ${res.status}: ${await res.text()}`);
    }
    if (!checkIn) await this.db.update(doses).set({ callRequestedAt: new Date() }).where(eq(doses.id, doseId));
    const body = (await res.json()) as { callId: string };
    telemetry.capture(
      checkIn ? 'emergency_checkin_requested' : 'dose_call_requested',
      { dose_id: doseId, call_id: body.callId, demo: row.demo },
      row.patientId,
    );
    this.logger.log(`Calling patient of dose ${doseId} (${body.callId}).`);
    return body;
  }

  /**
   * Why a call must not be made now, or null. Counts calls started in the last 24 hours,
   * per family (not the demo family, used by the team and the judges) and in total.
   */
  async overCallLimit(familyId: string, isDemo: boolean, now = new Date()): Promise<string | null> {
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const total = this.config.get<number>('CALL_DAILY_LIMIT_TOTAL') ?? 20;
    // Pharmacy calls (PharmacyService) share the same limits.
    const [all] = await this.db.select({ n: count() }).from(doses).where(gte(doses.callRequestedAt, since));
    const [allPharmacy] = await this.db
      .select({ n: count() })
      .from(pharmacyInquiries)
      .where(gte(pharmacyInquiries.createdAt, since));
    if (all.n + allPharmacy.n >= total) return 'daily_total_limit';
    if (isDemo) return null;
    const perFamily = this.config.get<number>('CALL_DAILY_LIMIT_PER_FAMILY') ?? 3;
    const [mine] = await this.db
      .select({ n: count() })
      .from(doses)
      .innerJoin(medications, eq(doses.medicationId, medications.id))
      .innerJoin(members, eq(medications.patientId, members.id))
      .where(and(eq(members.familyId, familyId), gte(doses.callRequestedAt, since)));
    const [minePharmacy] = await this.db
      .select({ n: count() })
      .from(pharmacyInquiries)
      .where(and(eq(pharmacyInquiries.familyId, familyId), gte(pharmacyInquiries.createdAt, since)));
    return mine.n + minePharmacy.n >= perFamily ? 'daily_family_limit' : null;
  }

  /** Records the call outcome. A dose not confirmed by voice alerts the family right away. */
  async applyResult(doseId: string, result: VoiceResult): Promise<'taken' | 'missed' | 'ignored'> {
    const [dose] = await this.db
      .select({ status: doses.status, scheduledAt: doses.scheduledAt, demo: doses.demo, patientId: medications.patientId })
      .from(doses)
      .innerJoin(medications, eq(doses.medicationId, medications.id))
      .where(eq(doses.id, doseId));
    if (!dose) throw new NotFoundException('Dose não encontrada.');
    const saved = await this.saveCall(doseId, result);
    if (saved && result.feelsUnwell) {
      // Her own words from the transcript; the model's note can be a summary in the third person.
      await this.alertUnwell(doseId, patientWords(result), Boolean(result.emergency));
      telemetry.capture(
        'patient_reported_unwell',
        { dose_id: doseId, call_id: result.sessionId, demo: dose.demo, emergency: Boolean(result.emergency) },
        dose.patientId,
      );
    }
    if (saved && result.emergency && !result.checkIn) {
      await this.safeCallCaregivers(doseId, 'emergency', reported(result.note));
      await this.scheduleCheckIn(doseId);
    }
    // The call back after an emergency only reports how she is; the dose was already settled.
    if (result.checkIn) {
      if (saved) await this.followCheckIn(doseId, result);
      telemetry.capture(
        'emergency_checkin_result',
        { dose_id: doseId, call_id: result.sessionId, outcome: result.outcome, feels_unwell: Boolean(result.feelsUnwell), demo: dose.demo },
        dose.patientId,
      );
      return 'ignored';
    }
    const props = { dose_id: doseId, call_id: result.sessionId, outcome: result.outcome, demo: dose.demo };
    // Confirmed in the app while the phone was ringing: the app wins.
    if (dose.status === 'taken') {
      telemetry.capture('dose_voice_result', { ...props, applied: 'ignored' }, dose.patientId);
      return 'ignored';
    }

    if (result.confirmed) {
      telemetry.capture('dose_voice_result', { ...props, applied: 'taken' }, dose.patientId);
      telemetry.capture(
        'dose_confirmed',
        { dose_id: doseId, via: 'voice', call_id: result.sessionId, minutes_since_scheduled: minutesSince(dose.scheduledAt), demo: dose.demo },
        dose.patientId,
      );
      this.logger.log(`Dose ${doseId} confirmed by voice (${result.sessionId}).`);
      await this.db
        .update(doses)
        .set({ status: 'taken', confirmedVia: 'voice', confirmedAt: new Date() })
        .where(eq(doses.id, doseId));
      await (await this.queue.getJob(alertJobId(doseId)))?.remove();
      try {
        await this.stock.checkAfterDose(doseId);
      } catch (error) {
        telemetry.captureException(error, { step: 'low_stock_check', dose_id: doseId });
      }
      return 'taken';
    }

    // "Ainda não tomei" on the first call: she was told Recuidado calls again to confirm.
    if (result.outcome === 'not_taken' && !result.recall && !dose.demo) {
      await this.scheduleRecall(doseId);
      telemetry.capture('dose_voice_result', { ...props, applied: 'recall' }, dose.patientId);
      return 'ignored';
    }

    await this.db
      .update(doses)
      .set({ status: 'missed' })
      .where(and(eq(doses.id, doseId), eq(doses.status, 'pending')));
    await this.alertNow(doseId);
    await this.callFamilyAboutDose(doseId, result.outcome);
    telemetry.capture('dose_voice_result', { ...props, applied: 'missed' }, dose.patientId);
    this.logger.log(`Dose ${doseId} not confirmed by voice (${result.outcome}); alerting family.`);
    return 'missed';
  }

  /** Stores the call. apps/voice retries the POST, so the same session is written once. */
  private async saveCall(doseId: string, result: VoiceResult): Promise<boolean> {
    const rows = await this.db
      .insert(voiceCalls)
      .values({
        doseId,
        sessionId: result.sessionId,
        outcome: result.outcome,
        confirmed: result.confirmed,
        note: result.note ?? null,
        feelsUnwell: result.feelsUnwell ?? null,
        transcript: result.transcript ?? [],
        durationSeconds: result.durationSeconds == null ? null : Math.round(result.durationSeconds),
        endReason: result.endReason ?? null,
        error: result.error ?? null,
      })
      .onConflictDoNothing({ target: voiceCalls.sessionId })
      .returning({ id: voiceCalls.id });
    return rows.length > 0;
  }

  /**
   * She said she has not taken it yet and heard "daqui a pouco eu ligo para confirmar": call once more
   * after DOSE_RECALL_MINUTES. The family alert moves after it, as a fallback if that call never reports.
   */
  private async scheduleRecall(doseId: string): Promise<void> {
    const minutes = this.config.get<number>('DOSE_RECALL_MINUTES') ?? 15;
    const alertAfter = this.config.get<number>('DOSE_ALERT_AFTER_MINUTES') ?? 30;
    await this.queue.add('recall', { kind: 'recall', doseId }, { jobId: doseJobId('recall', doseId), delay: minutes * 60_000 });
    const alert = await this.queue.getJob(alertJobId(doseId));
    if (alert && (await alert.isDelayed())) await alert.remove();
    await this.queue.add(
      'alert-family',
      { kind: 'alert-family', doseId },
      { jobId: alertJobId(doseId), delay: (minutes + alertAfter) * 60_000 },
    );
    this.logger.log(`Dose ${doseId}: not taken yet, calling her again in ${minutes} min.`);
  }

  /** She told the assistant it would call back: queue that call (EMERGENCY_CHECKIN_MINUTES). */
  private async scheduleCheckIn(doseId: string, attempt = 1): Promise<void> {
    const minutes = this.config.get<number>('EMERGENCY_CHECKIN_MINUTES') ?? 10;
    await this.queue.add(
      'check-in',
      { kind: 'check-in', doseId, attempt },
      { jobId: `${doseJobId('check-in', doseId)}-${attempt}`, delay: minutes * 60_000 },
    );
    this.logger.log(`Dose ${doseId}: calling her back in ${minutes} min (call back ${attempt}).`);
  }

  /**
   * After a call back: better or with family → tell the family and stop. Still not well, or no answer →
   * tell the first contact what she said and call her again, up to MAX_CHECK_INS call backs.
   */
  private async followCheckIn(doseId: string, result: VoiceResult): Promise<void> {
    const [{ n }] = await this.db.select({ n: count() }).from(voiceCalls).where(eq(voiceCalls.doseId, doseId));
    const done = Math.max(0, n - 1);
    const answered = result.outcome !== 'no_answer' && result.outcome !== 'failed';
    const words = patientWords(result);
    if (answered && result.feelsUnwell === false && !result.emergency) {
      await this.notifyFamily(doseId, (name, she) => ({
        title: `${name} disse que está melhor`,
        body: words ? `Na ligação de volta, ${she} disse: ${quoted(words)}.` : `Na ligação de volta, ${she} disse que está melhor.`,
      }));
      this.logger.log(`Dose ${doseId}: she is better after ${done} call back(s); stopping.`);
      return;
    }
    if (!answered) {
      await this.notifyFamily(doseId, (name, she) => ({
        title: `${name} não atendeu a ligação de volta`,
        body: `Vale ligar para ${she}.`,
      }));
    }
    await this.safeCallCaregivers(doseId, answered ? 'still_unwell' : 'no_answer', reported(result.note));
    if (done < MAX_CHECK_INS) await this.scheduleCheckIn(doseId, done + 1);
  }

  private async notifyFamily(
    doseId: string,
    text: (name: string, she: string) => { title: string; body: string },
  ): Promise<void> {
    const [row] = await this.db
      .select({
        patientName: sql<string>`coalesce(${members.nickname}, ${members.name})`,
        familyId: members.familyId,
        gender: members.gender,
      })
      .from(doses)
      .innerJoin(medications, eq(doses.medicationId, medications.id))
      .innerJoin(members, eq(medications.patientId, members.id))
      .where(eq(doses.id, doseId));
    if (!row) return;
    await this.alerts.notifyCaregivers(row.familyId, { kind: 'check_in', url: '/family/avisos', doseId, ...text(row.patientName, pronoun(row.gender)) });
  }

  private async safeCallCaregivers(doseId: string, reason: CaregiverCallReason, words?: string): Promise<void> {
    try {
      await this.callCaregivers(doseId, reason, words);
    } catch (error) {
      telemetry.captureException(error, { step: 'emergency_call', dose_id: doseId });
    }
  }

  /**
   * Emergency reported on the call: phones the family's first contact (members.emergencyContact, else the
   * oldest caregiver with a phone) with a short recorded-style message. Calling everyone at once causes alarm,
   * so the others are called one at a time only if the one before did not hear the message (applyAlertCallResult).
   * Only numbers in the voice CALL_ALLOWED_NUMBERS get through; the push already went out either way.
   */
  private async callCaregivers(doseId: string, reason: CaregiverCallReason, words?: string): Promise<void> {
    const patient = await this.patientOf(doseId);
    if (!patient) return;
    await this.callNextContact(doseId, caregiverMessage(patient.name, reason, words, patient.gender));
  }

  /**
   * The dose was not confirmed on the call (no answer, or still not taken after the second call): a calm call to
   * the first contact, then the next ones only if nobody heard it, same order as the emergency.
   */
  private async callFamilyAboutDose(doseId: string, outcome: VoiceResult['outcome']): Promise<void> {
    try {
      const patient = await this.patientOf(doseId);
      if (!patient) return;
      await this.callNextContact(doseId, missedDoseMessage(patient.name, outcome, patient.gender));
    } catch (error) {
      telemetry.captureException(error, { step: 'missed_dose_call', dose_id: doseId });
    }
  }

  /** The patient of a dose, with the name the family uses. */
  private async patientOf(doseId: string) {
    const [patient] = await this.db
      .select({
        name: sql<string>`coalesce(${members.nickname}, ${members.name})`,
        familyId: members.familyId,
        gender: members.gender,
      })
      .from(doses)
      .innerJoin(medications, eq(doses.medicationId, medications.id))
      .innerJoin(members, eq(medications.patientId, members.id))
      .where(eq(doses.id, doseId));
    return patient;
  }

  /** Caregivers with a phone, in the order they are called in an emergency: first contact, then the oldest. */
  private emergencyContacts(familyId: string): Promise<EmergencyContact[]> {
    return this.db
      .select({ id: members.id, phone: members.phone, name: sql<string>`coalesce(${members.nickname}, ${members.name})` })
      .from(members)
      .where(and(eq(members.familyId, familyId), eq(members.role, 'caregiver'), isNotNull(members.phone), ne(members.phone, '')))
      .orderBy(desc(members.emergencyContact), asc(members.createdAt)) as Promise<EmergencyContact[]>;
  }

  /**
   * Calls the next caregiver in the emergency order after `afterId` (the first contact when absent). A number
   * outside CALL_ALLOWED_NUMBERS is skipped. When nobody is left after an emergency, the family gets a push saying so.
   * A message with NAME_SLOT is the calm missed-dose call: each caregiver hears their own name.
   */
  async callNextContact(doseId: string, message: string, afterId?: string): Promise<'requested' | 'none_left'> {
    const voiceUrl = this.config.get<string>('VOICE_URL');
    const token = this.config.get<string>('VOICE_API_TOKEN');
    if (!voiceUrl || !token) return 'none_left';
    const patient = await this.patientOf(doseId);
    if (!patient) return 'none_left';
    const all = await this.emergencyContacts(patient.familyId);
    const previous = afterId ? all.find((c) => c.id === afterId) : undefined;
    const calm = message.includes(NAME_SLOT);
    for (const c of contactsAfter(all, afterId)) {
      const res = await fetch(new URL('/alert-calls', voiceUrl), {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ doseId, phone: c.phone, message: message.replace(NAME_SLOT, c.name), template: message, memberId: c.id }),
      });
      const outcome = res.ok ? 'requested' : res.status === 403 ? 'number_not_allowed' : `error_${res.status}`;
      telemetry.capture('emergency_call', { dose_id: doseId, outcome, next: Boolean(afterId), calm }, c.id);
      this.logger.log(`Dose ${doseId}: emergency call to a caregiver ${outcome}.`);
      if (!res.ok) continue;
      await this.alerts.record(patient.familyId, {
        kind: 'emergency_call',
        title: previous ? `${previous.name} não atendeu. Ligamos para ${c.name}` : `Ligamos para ${c.name}, o primeiro contato`,
        body: `Recado: "${message.replace(NAME_SLOT, c.name).replace(/^Olá, aqui é a assistente virtual da Recuidado\. /, '')}"`,
        doseId,
      });
      return 'requested';
    }
    // The missed-dose push already asked the family to call her; only the emergency gets a second push.
    if (previous && !calm) {
      const she = pronoun(patient.gender);
      await this.alerts.notifyCaregivers(patient.familyId, {
        kind: 'emergency',
        title: 'Ninguém da família atendeu a ligação de emergência',
        body: `Ligamos para ${namesList(all.map((c) => c.name))} e ninguém ouviu o recado. Ligue para ${she} agora. Se for grave, ligue para o SAMU, 192.`,
        url: '/family/avisos',
        doseId,
      });
      this.logger.log(`Dose ${doseId}: no caregiver heard the emergency message.`);
    }
    return 'none_left';
  }

  /**
   * apps/voice reports how a call to a caregiver ended. Not heard (no answer, voicemail, cut before the end of
   * the message): the next caregiver is called. The job id is the call id, so a repeated POST calls once.
   */
  async applyAlertCallResult(doseId: string, result: AlertCallResult): Promise<'next' | 'delivered'> {
    telemetry.capture(
      'emergency_call_result',
      { dose_id: doseId, call_id: result.sessionId, answered: result.answered, delivered: result.delivered },
      result.memberId,
    );
    if (result.delivered) return 'delivered';
    await this.queue.add(
      'next-contact',
      { kind: 'next-contact', doseId, afterId: result.memberId, message: result.message },
      { jobId: `next-contact-${result.sessionId.replace(/:/g, '-')}` },
    );
    this.logger.log(`Dose ${doseId}: emergency message not heard; calling the next caregiver.`);
    return 'next';
  }

  private async alertUnwell(doseId: string, words?: string | null, emergency = false): Promise<void> {
    const [row] = await this.db
      .select({
        patientName: sql<string>`coalesce(${members.nickname}, ${members.name})`,
        familyId: members.familyId,
        gender: members.gender,
      })
      .from(doses)
      .innerJoin(medications, eq(doses.medicationId, medications.id))
      .innerJoin(members, eq(medications.patientId, members.id))
      .where(eq(doses.id, doseId));
    if (!row) return;
    const she = pronoun(row.gender);
    const She = she === 'ele' ? 'Ele' : 'Ela';
    const said = words?.trim() ? `${She} disse: ${quoted(words)}.` : `${She} disse que não está bem.`;
    const { sent } = await this.alerts.notifyCaregivers(row.familyId, {
      kind: emergency ? 'emergency' : 'unwell',
      title: emergency ? `Urgente: ${row.patientName} pode precisar de ajuda` : `${row.patientName} não está se sentindo bem`,
      body: `${said} Vale ligar para ${she}.`,
      url: '/family',
      doseId,
    });
    this.logger.log(`Dose ${doseId}: patient reported feeling unwell; ${sent} pushes sent.`);
  }

  /** Calls made for a dose, newest first. */
  listCalls(doseId: string) {
    return this.db.query.voiceCalls.findMany({
      where: eq(voiceCalls.doseId, doseId),
      orderBy: (c, { desc }) => [desc(c.createdAt)],
    });
  }

  private async alertNow(doseId: string): Promise<void> {
    const id = alertJobId(doseId);
    const existing = await this.queue.getJob(id);
    if (existing && (await existing.isDelayed())) {
      await existing.promote();
      return;
    }
    if (!existing) {
      await this.queue.add('alert-family', { kind: 'alert-family', doseId }, { jobId: id });
    }
  }

  /**
   * Demo only: creates a synthetic patient, medication and a pending dose due now, then calls.
   * The phone comes from the request so no real number is ever committed.
   */
  async createDemoDose(input: {
    phone: string;
    patientName: string;
    medication: string;
    strength?: string;
    caregiverPhone?: string;
  }): Promise<string> {
    const familyName = 'Família Demo';
    let [family] = await this.db.select().from(families).where(eq(families.name, familyName));
    if (!family) {
      [family] = await this.db.insert(families).values({ name: familyName }).returning();
    }
    let [patient] = await this.db
      .select()
      .from(members)
      .where(and(eq(members.familyId, family.id), eq(members.role, 'patient'), eq(members.name, input.patientName)));
    if (!patient) {
      [patient] = await this.db
        .insert(members)
        .values({ familyId: family.id, name: input.patientName, role: 'patient', phone: input.phone, prefersVoice: true })
        .returning();
    } else if (patient.phone !== input.phone) {
      await this.db.update(members).set({ phone: input.phone }).where(eq(members.id, patient.id));
    }
    if (input.caregiverPhone) {
      const [caregiver] = await this.db
        .select({ id: members.id })
        .from(members)
        .where(and(eq(members.familyId, family.id), eq(members.role, 'caregiver')))
        // Same pick as callCaregivers, so the demo phone is the one the emergency call goes to.
        .orderBy(desc(members.emergencyContact), asc(members.createdAt))
        .limit(1);
      if (caregiver) await this.db.update(members).set({ phone: input.caregiverPhone }).where(eq(members.id, caregiver.id));
    }
    const [medication] = await this.db
      .insert(medications)
      .values({ patientId: patient.id, name: input.medication, strength: input.strength })
      .returning();
    const [dose] = await this.db
      .insert(doses)
      .values({ medicationId: medication.id, scheduledAt: new Date(), demo: true })
      .returning();
    return dose.id;
  }

  async getDose(doseId: string) {
    const [dose] = await this.db.select().from(doses).where(eq(doses.id, doseId));
    if (!dose) throw new NotFoundException('Dose não encontrada.');
    return dose;
  }
}
