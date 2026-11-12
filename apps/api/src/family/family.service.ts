import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import { findFreeAccess, highCostGuide, type FreeAccess } from '@recuidado/data';
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, ne, sql } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';
import {
  alerts,
  AlertsService,
  type Database,
  DB,
  DEMO_FAMILY,
  doses,
  DosesService,
  families,
  localDate,
  medications,
  members,
  PlanGate,
  rotationParticipants,
  StockService,
  voiceCalls,
} from '@recuidado/core';
import { type R2Bucket, r2FromConfig } from '../calls/r2.js';
import { seedDemoFamily } from './demo-seed.js';
import { highCostStatus, todayInSaoPaulo, type HighCostStatus } from './high-cost.js';
import type { HighCostBody, MedicationUpdateBody, OnboardingBody } from './onboarding.schema.js';
import { cmedPriceOf, monthlyCostOf } from './pricing.js';

// Synthetic demo family (Hack Brasil rule 6.9). Same family name the voice demo uses.
export { DEMO_FAMILY };
const DEMO_PATIENT = 'Dona Maria';
const DEMO_CAREGIVERS = ['Ana', 'Carlos'];
const DEMO_FIRST_CONTACT = 'Carlos';

/** The family a request works on. Without an id it is the demo family. */
export interface FamilyRef {
  familyId: string;
  patientId: string;
  isDemo: boolean;
}

export const DEMO_READ_ONLY =
  'Esta é a família de demonstração e ela não muda. Faça o seu cadastro para testar com a sua família.';

/** "(11) •••••-5678": only the last 4 digits, so it can not be called or copied. */
export function maskPhone(phone: string | null): string | null {
  let digits = phone?.replace(/\D/g, '') ?? '';
  if (digits.length >= 12 && digits.startsWith('55')) digits = digits.slice(2);
  if (digits.length < 4) return null;
  const ddd = digits.length >= 10 ? `(${digits.slice(0, 2)}) ` : '';
  return `${ddd}•••••-${digits.slice(-4)}`;
}

/**
 * Marks the one caregiver the emergency call goes to, the same rule as VoiceCallService.callCaregivers:
 * the chosen one with a phone, else the oldest caregiver with a phone. Caregivers come oldest first.
 */
export function withFirstContact<T extends { emergencyContact: boolean; hasPhone: boolean }>(caregivers: T[]): T[] {
  const first = caregivers.find((c) => c.emergencyContact && c.hasPhone) ?? caregivers.find((c) => c.hasPhone);
  return caregivers.map((c) => ({ ...c, emergencyContact: c === first }));
}

@Injectable()
export class FamilyService implements OnApplicationBootstrap {
  private readonly logger = new Logger(FamilyService.name);
  private readonly r2?: R2Bucket;

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly doses: DosesService,
    private readonly stock: StockService,
    private readonly alerts: AlertsService,
    private readonly config: ConfigService,
    private readonly plan: PlanGate,
  ) {
    this.r2 = r2FromConfig(config);
  }

  async onApplicationBootstrap() {
    const ids = await this.ensureDemoFamily();
    await this.resetDemoFirstContact(ids.familyId);
    await this.clearDemoAlerts(ids.familyId);
    if (this.config.get<boolean>('DEMO_SEED_ENABLED')) {
      try {
        // Fixed story of Dona Maria: three medicines, times, stock and a week of history.
        const medIds = await seedDemoFamily(this.db, ids);
        for (const id of medIds) await this.doses.scheduleForMedication(id);
        this.logger.log('Demo family seeded.');
      } catch (error) {
        // The app works without the demo story; never block the boot on it.
        this.logger.error(`Demo family seed failed: ${String(error)}`);
      }
    }
    await this.seedDemoPhoto(ids.patientId);
  }

  /** Deletes the demo family alerts older than DEMO_CLEAR_ALERTS_BEFORE (test calls), before the seed adds its history back. */
  private async clearDemoAlerts(familyId: string): Promise<void> {
    const before = this.config.get<string>('DEMO_CLEAR_ALERTS_BEFORE');
    if (!before) return;
    const removed = await this.db
      .delete(alerts)
      .where(and(eq(alerts.familyId, familyId), lt(alerts.createdAt, new Date(before))))
      .returning({ id: alerts.id });
    if (removed.length) this.logger.log(`Demo family: ${removed.length} alerts before ${before} deleted.`);
  }

  /** Carlos is the demo family's first contact in an emergency, set again on every API boot. */
  private async resetDemoFirstContact(familyId: string): Promise<void> {
    await this.db
      .update(members)
      .set({ emergencyContact: sql`${members.name} = ${DEMO_FIRST_CONTACT}` })
      .where(and(eq(members.familyId, familyId), eq(members.role, 'caregiver')));
  }

  /** Creates the demo family if missing. Returns its id and the patient id. */
  async ensureDemoFamily(): Promise<{ familyId: string; patientId: string }> {
    let [family] = await this.db.select().from(families).where(eq(families.name, DEMO_FAMILY));
    if (!family) {
      [family] = await this.db.insert(families).values({ name: DEMO_FAMILY }).returning();
    }
    const existing = await this.db
      .select()
      .from(members)
      .where(eq(members.familyId, family.id))
      .orderBy(asc(members.createdAt));
    // By role, not name: onboarding may rename the patient.
    let patient = existing.find((m) => m.role === 'patient');
    if (!patient) {
      [patient] = await this.db
        .insert(members)
        .values({ familyId: family.id, name: DEMO_PATIENT, role: 'patient' })
        .returning();
    }
    const missing = DEMO_CAREGIVERS.filter(
      (name) => !existing.some((m) => m.role === 'caregiver' && m.name === name),
    );
    if (missing.length > 0) {
      await this.db
        .insert(members)
        .values(missing.map((name) => ({ familyId: family.id, name, role: 'caregiver' as const })));
    }
    return { familyId: family.id, patientId: patient.id };
  }

  /**
   * The family of this device (the id the web keeps), or the demo family when there is none.
   * Families are separate: nothing here reads or writes another family.
   */
  async resolveFamily(familyId?: string | null): Promise<FamilyRef> {
    if (!familyId) return { ...(await this.ensureDemoFamily()), isDemo: true };
    const [row] = await this.db
      .select({ familyId: families.id, name: families.name, patientId: members.id })
      .from(families)
      .innerJoin(members, and(eq(members.familyId, families.id), eq(members.role, 'patient')))
      .where(eq(families.id, familyId))
      .orderBy(asc(members.createdAt))
      .limit(1);
    if (!row) throw new NotFoundException('Família não encontrada.');
    return { familyId: row.familyId, patientId: row.patientId, isDemo: row.name === DEMO_FAMILY };
  }

  /** Same as resolveFamily, but refuses changes to the demo family. */
  async writableFamily(familyId?: string | null): Promise<FamilyRef> {
    const ref = await this.resolveFamily(familyId);
    if (ref.isDemo) throw new ForbiddenException(DEMO_READ_ONLY);
    return ref;
  }

  /** True when this patient belongs to the demo family. */
  async isDemoPatient(patientId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ name: families.name })
      .from(members)
      .innerJoin(families, eq(members.familyId, families.id))
      .where(eq(members.id, patientId));
    return row?.name === DEMO_FAMILY;
  }

  /** Everything the family and patient screens show. */
  async overview(familyId?: string | null, now = new Date()) {
    const ref = await this.resolveFamily(familyId);
    return this.overviewOf(ref, now);
  }

  private async overviewOf({ familyId, patientId, isDemo }: FamilyRef, now: Date) {
    const people = await this.db
      .select({
        id: members.id,
        name: members.name,
        nickname: members.nickname,
        gender: members.gender,
        role: members.role,
        relation: members.relation,
        relationOther: members.relationOther,
        phone: members.phone,
        emergencyContact: members.emergencyContact,
        consentAt: members.consentAt,
        consentSource: members.consentSource,
        // Added as an invite by another caregiver (only the one who signed up exports or deletes).
        invited: isNotNull(members.invitedById).mapWith(Boolean),
        // Added as an invite and not opened the app yet.
        pending: and(isNotNull(members.invitedById), isNull(members.joinedAt))!.mapWith(Boolean),
      })
      .from(members)
      .where(eq(members.familyId, familyId))
      .orderBy(asc(members.createdAt));
    const meds = await this.db
      .select({
        id: medications.id,
        name: medications.name,
        activeIngredient: medications.activeIngredient,
        strength: medications.strength,
        times: medications.times,
        freeInFarmaciaPopular: medications.freeInFarmaciaPopular,
        monthlyCostCents: medications.monthlyCostCents,
        buyInsteadOfFree: medications.buyInsteadOfFree,
        stockUnits: medications.stockUnits,
        highCostChecked: medications.highCostChecked,
        lmeFilledOn: medications.lmeFilledOn,
        highCostSince: medications.highCostSince,
        photoKey: medications.photoKey,
      })
      .from(medications)
      .where(and(eq(medications.patientId, patientId), isNull(medications.stoppedAt)))
      .orderBy(asc(medications.createdAt));
    const stopped = await this.db
      .select({ id: medications.id, name: medications.name, strength: medications.strength, createdAt: medications.createdAt, stoppedAt: medications.stoppedAt })
      .from(medications)
      .where(and(eq(medications.patientId, patientId), isNotNull(medications.stoppedAt)))
      .orderBy(desc(medications.stoppedAt));
    const stock = await this.stock.statusFor(meds);
    const photoUrls = new Map<string, string>();
    for (const m of meds) {
      // Signing is local (no request to R2); 12 h covers a screen left open all day.
      if (m.photoKey && this.r2) photoUrls.set(m.id, await this.r2.signedUrl(m.photoKey, 12 * 60 * 60));
    }
    // Anyone can open the demo family without logging in: its phones are never sent in full.
    const shown = people.map((p) => ({
      ...p,
      phone: isDemo ? maskPhone(p.phone) : p.phone,
      hasPhone: (p.phone?.replace(/\D/g, '').length ?? 0) >= 10,
    }));
    return {
      familyId,
      isDemo,
      // Calls are the paid part: false on the free plan, and the screens say "plano pago, em breve".
      calls: await this.plan.callsAllowed(familyId, isDemo),
      patient: shown.find((p) => p.id === patientId)!,
      caregivers: withFirstContact(shown.filter((p) => p.role === 'caregiver')),
      medications: meds.map(
        ({ activeIngredient, stockUnits: _counted, highCostChecked, lmeFilledOn, highCostSince, photoKey: _key, ...med }) => {
          const access = freeAccessOf(activeIngredient ?? med.name, med.strength);
          const price = cmedPriceOf(activeIngredient, med.name, med.strength, med.times.length);
          return {
            ...med,
            ...access,
            // Saved price, else the CMED ceiling of the cheapest pack for a month of doses.
            monthlyCostCents: monthlyCostOf(med.monthlyCostCents, price),
            price,
            // Pills left and days they last; null when the family has not counted them.
            stock: stock.get(med.id) ?? null,
            // Photo of the real box or pill taken by the family; null when there is none.
            photoUrl: photoUrls.get(med.id) ?? null,
            // Where the family is in the Alto Custo path, for the reminders.
            highCostPath: access.highCost
              ? highCostPathOf(activeIngredient ?? med.name, {
                  checked: highCostChecked,
                  lmeFilledOn,
                  since: highCostSince,
                }, now)
              : null,
          };
        },
      ),
      // Removed from her list: kept to show what she took and until when.
      stoppedMedications: stopped,
      today: await this.doses.listForDay(patientId),
      unwellReports: await this.unwellReports(patientId, now),
    };
  }

  /** What she said in the calls of the last 24 hours when she reported not feeling well. */
  private unwellReports(patientId: string, now: Date) {
    return this.db
      .select({ at: voiceCalls.createdAt, note: voiceCalls.note, doseId: voiceCalls.doseId })
      .from(voiceCalls)
      .innerJoin(doses, eq(voiceCalls.doseId, doses.id))
      .innerJoin(medications, eq(doses.medicationId, medications.id))
      .where(
        and(
          eq(medications.patientId, patientId),
          eq(voiceCalls.feelsUnwell, true),
          gte(voiceCalls.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
        ),
      )
      .orderBy(desc(voiceCalls.createdAt));
  }

  /** Alerts sent to the caregivers, newest first. */
  async alertHistory(familyId?: string | null) {
    const ref = await this.resolveFamily(familyId);
    return this.alerts.list(ref.familyId);
  }

  /**
   * Family changes the dose text, the times or the pills at home.
   * New times replace the pending future doses.
   */
  async updateMedication(
    familyId: string | null | undefined,
    medicationId: string,
    input: MedicationUpdateBody,
    now = new Date(),
  ): Promise<void> {
    const { patientId } = await this.writableFamily(familyId);
    const changes = {
      ...(input.strength !== undefined ? { strength: input.strength || null } : {}),
      ...(input.times !== undefined ? { times: [...new Set(input.times)].sort() } : {}),
    };
    const [row] = await this.db
      .select({ id: medications.id })
      .from(medications)
      .where(and(eq(medications.id, medicationId), eq(medications.patientId, patientId), isNull(medications.stoppedAt)));
    if (!row) throw new NotFoundException('Remédio não encontrado.');
    if (Object.keys(changes).length > 0) {
      await this.db.update(medications).set(changes).where(eq(medications.id, medicationId));
    }
    if (input.stockUnits !== undefined) await this.stock.setCount(medicationId, input.stockUnits, now);
    if (input.times !== undefined) {
      // Queued jobs of removed doses find no dose and do nothing.
      await this.db
        .delete(doses)
        .where(and(eq(doses.medicationId, medicationId), eq(doses.status, 'pending'), gte(doses.scheduledAt, now)));
      await this.doses.scheduleForMedication(medicationId, now);
    }
  }

  /** Checklist, deadlines and nearest steps to get one medication from the Alto Custo. */
  async highCost(familyId: string | null | undefined, medicationId: string, now = new Date()) {
    const { patientId } = await this.resolveFamily(familyId);
    const [med] = await this.db
      .select()
      .from(medications)
      .where(and(eq(medications.id, medicationId), eq(medications.patientId, patientId)));
    if (!med) throw new NotFoundException('Remédio não encontrado.');
    const ingredient = med.activeIngredient ?? med.name;
    const guide = highCostGuide(ingredient);
    return {
      medication: {
        id: med.id,
        name: med.name,
        strength: med.strength,
        monthlyCostCents: med.monthlyCostCents,
        highCost: freeAccessOf(ingredient, med.strength).highCost ?? false,
      },
      guide,
      status: highCostStatus(
        { checked: med.highCostChecked, lmeFilledOn: med.lmeFilledOn, since: med.highCostSince },
        guide,
        todayInSaoPaulo(now),
      ),
    };
  }

  /** Family ticks checklist items or tells the LME and approval dates. */
  async saveHighCost(familyId: string | null | undefined, medicationId: string, input: HighCostBody): Promise<void> {
    const { patientId } = await this.writableFamily(familyId);
    const [row] = await this.db
      .update(medications)
      .set({
        ...(input.checked !== undefined ? { highCostChecked: [...new Set(input.checked)] } : {}),
        ...(input.lmeFilledOn !== undefined ? { lmeFilledOn: input.lmeFilledOn } : {}),
        ...(input.since !== undefined ? { highCostSince: input.since } : {}),
      })
      .where(and(eq(medications.id, medicationId), eq(medications.patientId, patientId)))
      .returning({ id: medications.id });
    if (!row) throw new NotFoundException('Remédio não encontrado.');
  }

  /**
   * Family saves a photo of the real box or pill. Her screen shows this photo and never a
   * generic one, so she does not take the wrong pill. A new photo replaces the old one.
   */
  async setMedicationPhoto(
    familyId: string | null | undefined,
    medicationId: string,
    photo: { data: Buffer; contentType: string },
  ): Promise<void> {
    const { familyId: family, patientId } = await this.writableFamily(familyId);
    if (!this.r2) throw new ServiceUnavailableException('Foto indisponível agora. Tente mais tarde.');
    const old = await this.medicationPhotoKey(medicationId, patientId);
    const ext = photo.contentType === 'image/png' ? 'png' : photo.contentType === 'image/webp' ? 'webp' : 'jpg';
    const key = `medication-photos/${family}/${medicationId}/${randomUUID()}.${ext}`;
    await this.r2.put(key, photo.data, photo.contentType);
    await this.db.update(medications).set({ photoKey: key }).where(eq(medications.id, medicationId));
    if (old) await this.r2.delete(old).catch((e) => this.logger.warn(`Old photo ${old} not deleted: ${e}`));
  }

  /** Family removes the photo: her screen goes back to name, dose and time only. */
  async removeMedicationPhoto(familyId: string | null | undefined, medicationId: string): Promise<void> {
    const { patientId } = await this.writableFamily(familyId);
    const old = await this.medicationPhotoKey(medicationId, patientId);
    await this.db.update(medications).set({ photoKey: null }).where(eq(medications.id, medicationId));
    if (old && this.r2) await this.r2.delete(old).catch((e) => this.logger.warn(`Photo ${old} not deleted: ${e}`));
  }

  private async medicationPhotoKey(medicationId: string, patientId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ photoKey: medications.photoKey })
      .from(medications)
      .where(and(eq(medications.id, medicationId), eq(medications.patientId, patientId)));
    if (!row) throw new NotFoundException('Remédio não encontrado.');
    return row.photoKey;
  }

  /**
   * Photo of the Losartana box in the demo family, so the video shows her screen with the
   * family's photo. Synthetic image (generated, no real brand). Sent to R2 on every boot.
   */
  private async seedDemoPhoto(patientId: string): Promise<void> {
    if (!this.r2) return;
    try {
      const key = 'demo/losartana.jpg';
      const file = await readFile(join(import.meta.dirname, '..', '..', 'assets', 'demo-losartana.jpg'));
      await this.r2.put(key, file, 'image/jpeg');
      await this.db
        .update(medications)
        .set({ photoKey: key })
        .where(and(eq(medications.patientId, patientId), eq(medications.name, 'Losartana')));
    } catch (error) {
      this.logger.error(`Demo photo seed failed: ${String(error)}`);
    }
  }

  /** Family stops a medication: it and its doses are removed. */
  /**
   * Takes it off her list without erasing it: the doses she already took or missed stay in the history.
   * Upcoming doses are deleted (their queued jobs find no dose) and reminders of earlier pending ones
   * see the stop and do nothing. Taking it again later is a new medication, so nothing clashes.
   */
  async removeMedication(familyId: string | null | undefined, medicationId: string, now = new Date()): Promise<void> {
    const { patientId } = await this.writableFamily(familyId);
    const [row] = await this.db
      .update(medications)
      .set({ stoppedAt: now })
      .where(and(eq(medications.id, medicationId), eq(medications.patientId, patientId), isNull(medications.stoppedAt)))
      .returning({ id: medications.id });
    if (!row) throw new NotFoundException('Remédio não encontrado.');
    await this.db
      .delete(doses)
      .where(and(eq(doses.medicationId, medicationId), eq(doses.status, 'pending'), gte(doses.scheduledAt, now)));
  }

  /** Saved onboarding answers of one caregiver, to restore the sign-up form. */
  async getOnboarding(caregiverId: string) {
    const [found] = await this.db
      .select({ familyId: members.familyId })
      .from(members)
      .where(and(eq(members.id, caregiverId), eq(members.role, 'caregiver')));
    if (!found) throw new NotFoundException('Cadastro não encontrado.');
    const { familyId, patientId, isDemo } = await this.resolveFamily(found.familyId);
    // Sign-ups made before families were separate live in the demo family: start a new one.
    if (isDemo) throw new NotFoundException('Cadastro não encontrado.');
    const people = await this.db
      .select()
      .from(members)
      .where(eq(members.familyId, familyId))
      .orderBy(asc(members.createdAt));
    const caregiver = people.find((m) => m.id === caregiverId)!;
    const patient = people.find((m) => m.id === patientId)!;
    const [family] = await this.db
      .select({ splitMode: families.splitMode })
      .from(families)
      .where(eq(families.id, familyId));
    return {
      familyId,
      caregiverId,
      caregiver: {
        name: caregiver.name,
        phone: caregiver.phone ?? '',
        email: caregiver.email ?? '',
        relation: caregiver.relation,
        relationOther: caregiver.relationOther ?? '',
      },
      patient: {
        name: patient.name,
        nickname: patient.nickname ?? '',
        gender: patient.gender,
        phone: patient.phone ?? '',
        birth: patient.birthDate ?? '',
        cep: patient.cep ?? '',
        usesPhone: !patient.prefersVoice,
        consent: patient.consentAt !== null,
      },
      invites: people
        .filter((m) => m.invitedById === caregiverId)
        .map((m) => ({
          id: m.id,
          name: m.name,
          relation: m.relation,
          phone: m.phone ?? '',
          email: m.email ?? '',
          joined: m.joinedAt !== null,
        })),
      payment: {
        mode: family?.splitMode ?? 'split',
        people: [
          ...rotationParticipants(people.filter((m) => m.role === 'caregiver')),
          ...people.filter((m) => m.role === 'caregiver' && m.splitExcluded),
        ].map((m) => ({ name: m.name, excluded: m.splitExcluded })),
      },
    };
  }

  /**
   * Saves the sign-up answers of the signed-in caregiver. With a caregiver already (a later edit) it
   * updates their family; on the first save it creates a new family. The demo family is never changed.
   * Returns the invites that got an e-mail now, for the caller to send.
   */
  async saveOnboarding(
    input: OnboardingBody,
    email: string,
    signedInCaregiverId: string | null,
  ): Promise<{
    caregiverId: string;
    familyId: string;
    caregiverName: string;
    patientName: string;
    newInvites: { name: string; email: string }[];
  }> {
    const own = signedInCaregiverId ? await this.ownFamily(signedInCaregiverId) : null;
    return this.db.transaction(async (tx) => {
      const p = input.patient;
      const patientValues = {
        name: p.name,
        nickname: p.nickname || null,
        gender: p.gender,
        phone: p.phone,
        birthDate: p.birth,
        cep: p.cep,
        prefersVoice: !p.usesPhone,
      };
      let familyId: string;
      let patientId: string;
      if (own) {
        familyId = own.familyId;
        patientId = own.patientId;
        await tx.update(members).set(patientValues).where(eq(members.id, patientId));
      } else {
        const [family] = await tx
          .insert(families)
          .values({ name: `Família de ${p.nickname || p.name}` })
          .returning({ id: families.id });
        familyId = family.id;
        const [patient] = await tx
          .insert(members)
          .values({ ...patientValues, familyId, role: 'patient' })
          .returning({ id: members.id });
        patientId = patient.id;
      }
      // Her own "Aceito" in the app wins; the caregiver's declaration only fills an empty consent.
      if (p.consent) {
        await tx
          .update(members)
          .set({ consentAt: new Date(), consentSource: 'caregiver' })
          .where(and(eq(members.id, patientId), isNull(members.consentAt)));
      }

      const c = input.caregiver;
      const caregiverValues = {
        name: c.name,
        phone: c.phone,
        email,
        relation: c.relation,
        relationOther: c.relation === 'Outro' ? c.relationOther : null,
      };
      let caregiverId: string | undefined;
      if (own && signedInCaregiverId) {
        const [updated] = await tx
          .update(members)
          .set(caregiverValues)
          .where(
            and(
              eq(members.id, signedInCaregiverId),
              eq(members.familyId, familyId),
              eq(members.role, 'caregiver'),
            ),
          )
          .returning({ id: members.id });
        caregiverId = updated?.id;
      }
      if (!caregiverId) {
        const [created] = await tx
          .insert(members)
          .values({ ...caregiverValues, familyId, role: 'caregiver', joinedAt: new Date() })
          .returning({ id: members.id });
        caregiverId = created.id;
      }

      // Invites are matched by name. Pending ones no longer in the list are removed;
      // people who already opened the app stay.
      const invited = await tx
        .select({ id: members.id, name: members.name, email: members.email, joinedAt: members.joinedAt })
        .from(members)
        .where(eq(members.invitedById, caregiverId));
      const newInvites: { name: string; email: string }[] = [];
      const key = (n: string) => n.trim().toLocaleLowerCase('pt-BR');
      const wanted = new Map(input.invites.map((i) => [key(i.name), i]));
      const stale = invited.filter((m) => m.joinedAt === null && !wanted.has(key(m.name)));
      if (stale.length > 0) {
        await tx.delete(members).where(inArray(members.id, stale.map((m) => m.id)));
      }
      for (const m of invited) {
        const invite = wanted.get(key(m.name));
        if (!invite) continue;
        const inviteEmail = invite.email || m.email || null;
        await tx
          .update(members)
          .set({ relation: invite.relation, phone: invite.phone || null, email: inviteEmail })
          .where(eq(members.id, m.id));
        if (invite.email && invite.email !== m.email && !m.joinedAt) newInvites.push({ name: m.name, email: invite.email });
        wanted.delete(key(m.name));
      }
      if (wanted.size > 0) {
        await tx.insert(members).values(
          [...wanted.values()].map((i) => ({
            familyId,
            name: i.name,
            relation: i.relation,
            phone: i.phone || null,
            email: i.email || null,
            role: 'caregiver' as const,
            invitedById: caregiverId,
          })),
        );
        for (const i of wanted.values()) if (i.email) newInvites.push({ name: i.name, email: i.email });
      }

      if (input.payment) {
        const caregivers = await tx
          .select({ id: members.id, name: members.name })
          .from(members)
          .where(and(eq(members.familyId, familyId), eq(members.role, 'caregiver')));
        const byName = new Map(caregivers.map((m) => [key(m.name), m.id]));
        for (const [index, person] of input.payment.people.entries()) {
          const id = byName.get(key(person.name));
          if (!id) continue;
          await tx
            .update(members)
            .set({ rotationOrder: index, splitExcluded: person.excluded })
            .where(eq(members.id, id));
        }
        const [family] = await tx
          .select({ splitMode: families.splitMode })
          .from(families)
          .where(eq(families.id, familyId));
        // The rotation starts this month with the first of the list; the worker tells the family.
        await tx
          .update(families)
          .set({
            splitMode: input.payment.mode,
            ...(family?.splitMode !== input.payment.mode || input.payment.mode === 'rotation'
              ? { rotationStartMonth: localDate(new Date()).slice(0, 7), rotationNotifiedMonth: null }
              : {}),
          })
          .where(eq(families.id, familyId));
      }
      return {
        caregiverId,
        familyId,
        caregiverName: c.name,
        patientName: p.nickname || p.name,
        newInvites,
      };
    });
  }

  /** The non-demo family of a caregiver, or null (unknown id or a sign-up kept in the demo family). */
  private async ownFamily(caregiverId: string): Promise<FamilyRef | null> {
    const [row] = await this.db
      .select({ familyId: members.familyId })
      .from(members)
      .where(and(eq(members.id, caregiverId), eq(members.role, 'caregiver')));
    if (!row) return null;
    const ref = await this.resolveFamily(row.familyId).catch(() => null);
    return ref && !ref.isDemo ? ref : null;
  }

  /**
   * The one caregiver phoned when she reports an emergency on the call; the others get only the push.
   * Allowed on the demo family too, so the choice can be shown; the API boot sets Carlos again.
   */
  async setEmergencyContact(familyIdOrDemo: string | null | undefined, memberId: string): Promise<void> {
    const { familyId } = await this.resolveFamily(familyIdOrDemo);
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(members)
        .set({ emergencyContact: true })
        .where(and(eq(members.id, memberId), eq(members.familyId, familyId), eq(members.role, 'caregiver')))
        .returning({ id: members.id });
      if (!row) throw new NotFoundException('Pessoa não encontrada.');
      await tx
        .update(members)
        .set({ emergencyContact: false })
        .where(and(eq(members.familyId, familyId), ne(members.id, memberId)));
    });
  }

  /** Free in Farmácia Popular, but the family chose to buy it (buy = true) or to get it free. */
  async setBuyChoice(familyId: string | null | undefined, medicationId: string, buy: boolean): Promise<void> {
    // Allowed on the demo family too: it is a toggle and the visitor can switch it back.
    const { patientId } = await this.resolveFamily(familyId);
    const [row] = await this.db
      .update(medications)
      .set({ buyInsteadOfFree: buy })
      .where(and(eq(medications.id, medicationId), eq(medications.patientId, patientId)))
      .returning({ id: medications.id });
    if (!row) throw new NotFoundException('Remédio não encontrado.');
  }
}

/**
 * Where the medicine is free (Farmácia Popular, UBS) and whether it is in the
 * Alto Custo list, from the public lists in @recuidado/data. Never throws: a
 * missing seed file only hides the badges.
 */
export function freeAccessOf(activeIngredient: string, strength: string | null): Partial<FreeAccess> {
  try {
    return findFreeAccess(activeIngredient, strength);
  } catch {
    return {};
  }
}

/** Alto Custo status for GET /family. Never throws: a missing seed file only hides the reminder. */
export function highCostPathOf(ingredient: string, saved: Parameters<typeof highCostStatus>[0], now: Date): HighCostStatus | null {
  try {
    return highCostStatus(saved, highCostGuide(ingredient), todayInSaoPaulo(now));
  } catch {
    return null;
  }
}
