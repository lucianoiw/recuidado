import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { findFreeAccess, type FreeAccess } from '@recuidado/data';
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module.js';
import { doses, families, medications, members, voiceCalls } from '../db/schema.js';
import { AlertsService } from '../alerts/alerts.service.js';
import { DosesService } from '../doses/doses.service.js';
import { StockService } from '../stock/stock.service.js';
import type { MedicationUpdateBody, OnboardingBody } from './onboarding.schema.js';

// Synthetic demo family (Hack Brasil rule 6.9). Same family name the voice demo uses.
export const DEMO_FAMILY = 'Família Demo';
const DEMO_PATIENT = 'Dona Maria';
const DEMO_CAREGIVERS = ['Ana', 'Carlos'];

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

@Injectable()
export class FamilyService implements OnApplicationBootstrap {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly doses: DosesService,
    private readonly stock: StockService,
    private readonly alerts: AlertsService,
  ) {}

  async onApplicationBootstrap() {
    await this.ensureDemoFamily();
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
        role: members.role,
        relation: members.relation,
        relationOther: members.relationOther,
        phone: members.phone,
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
      })
      .from(medications)
      .where(eq(medications.patientId, patientId))
      .orderBy(asc(medications.createdAt));
    const stock = await this.stock.statusFor(meds);
    // Anyone can open the demo family without logging in: its phones are never sent in full.
    const shown = people.map((p) => ({
      ...p,
      phone: isDemo ? maskPhone(p.phone) : p.phone,
      hasPhone: (p.phone?.replace(/\D/g, '').length ?? 0) >= 10,
    }));
    return {
      familyId,
      isDemo,
      patient: shown.find((p) => p.id === patientId)!,
      caregivers: shown.filter((p) => p.role === 'caregiver'),
      medications: meds.map(({ activeIngredient, stockUnits: _counted, ...med }) => ({
        ...med,
        ...freeAccessOf(activeIngredient ?? med.name, med.strength),
        // Pills left and days they last; null when the family has not counted them.
        stock: stock.get(med.id) ?? null,
      })),
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
      .where(and(eq(medications.id, medicationId), eq(medications.patientId, patientId)));
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

  /** Family stops a medication: it and its doses are removed. */
  async removeMedication(familyId: string | null | undefined, medicationId: string): Promise<void> {
    const { patientId } = await this.writableFamily(familyId);
    const [row] = await this.db
      .delete(medications)
      .where(and(eq(medications.id, medicationId), eq(medications.patientId, patientId)))
      .returning({ id: medications.id });
    if (!row) throw new NotFoundException('Remédio não encontrado.');
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
    return {
      familyId,
      caregiverId,
      caregiver: {
        name: caregiver.name,
        phone: caregiver.phone ?? '',
        relation: caregiver.relation,
        relationOther: caregiver.relationOther ?? '',
      },
      patient: {
        name: patient.name,
        nickname: patient.nickname ?? '',
        phone: patient.phone ?? '',
        birth: patient.birthDate ?? '',
        cep: patient.cep ?? '',
        usesPhone: !patient.prefersVoice,
      },
      invites: people
        .filter((m) => m.invitedById === caregiverId)
        .map((m) => ({
          id: m.id,
          name: m.name,
          relation: m.relation,
          phone: m.phone ?? '',
          joined: m.joinedAt !== null,
        })),
    };
  }

  /**
   * Saves the sign-up answers. A caregiver saved earlier from this device updates their own
   * family; anyone else gets a new family. The demo family is never changed here.
   */
  async saveOnboarding(input: OnboardingBody): Promise<{ caregiverId: string; familyId: string }> {
    const own = input.caregiverId ? await this.ownFamily(input.caregiverId) : null;
    return this.db.transaction(async (tx) => {
      const p = input.patient;
      const patientValues = {
        name: p.name,
        nickname: p.nickname || null,
        phone: p.phone,
        birthDate: p.birth,
        cep: p.cep,
        prefersVoice: !p.usesPhone,
      };
      let familyId: string;
      if (own) {
        familyId = own.familyId;
        await tx.update(members).set(patientValues).where(eq(members.id, own.patientId));
      } else {
        const [family] = await tx
          .insert(families)
          .values({ name: `Família de ${p.nickname || p.name}` })
          .returning({ id: families.id });
        familyId = family.id;
        await tx.insert(members).values({ ...patientValues, familyId, role: 'patient' });
      }

      const c = input.caregiver;
      const caregiverValues = {
        name: c.name,
        phone: c.phone,
        relation: c.relation,
        relationOther: c.relation === 'Outro' ? c.relationOther : null,
      };
      let caregiverId: string | undefined;
      if (own && input.caregiverId) {
        const [updated] = await tx
          .update(members)
          .set(caregiverValues)
          .where(
            and(
              eq(members.id, input.caregiverId),
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
        .select({ id: members.id, name: members.name, joinedAt: members.joinedAt })
        .from(members)
        .where(eq(members.invitedById, caregiverId));
      const key = (n: string) => n.trim().toLocaleLowerCase('pt-BR');
      const wanted = new Map(input.invites.map((i) => [key(i.name), i]));
      const stale = invited.filter((m) => m.joinedAt === null && !wanted.has(key(m.name)));
      if (stale.length > 0) {
        await tx.delete(members).where(inArray(members.id, stale.map((m) => m.id)));
      }
      for (const m of invited) {
        const invite = wanted.get(key(m.name));
        if (!invite) continue;
        await tx.update(members).set({ relation: invite.relation, phone: invite.phone || null }).where(eq(members.id, m.id));
        wanted.delete(key(m.name));
      }
      if (wanted.size > 0) {
        await tx.insert(members).values(
          [...wanted.values()].map((i) => ({
            familyId,
            name: i.name,
            relation: i.relation,
            phone: i.phone || null,
            role: 'caregiver' as const,
            invitedById: caregiverId,
          })),
        );
      }
      return { caregiverId, familyId };
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

  /** Marks an invited caregiver as joined when they pick themselves on a device. */
  async join(familyIdOrDemo: string | null | undefined, memberId: string): Promise<void> {
    const { familyId } = await this.resolveFamily(familyIdOrDemo);
    const [row] = await this.db
      .select({ id: members.id, joinedAt: members.joinedAt })
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.familyId, familyId), eq(members.role, 'caregiver')));
    if (!row) throw new NotFoundException('Pessoa não encontrada.');
    if (!row.joinedAt) {
      await this.db.update(members).set({ joinedAt: new Date() }).where(eq(members.id, memberId));
    }
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
