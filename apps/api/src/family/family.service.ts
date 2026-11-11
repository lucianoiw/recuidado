import { Inject, Injectable, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { findFreeAccess, type FreeAccess } from '@recuidado/data';
import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module.js';
import { families, medications, members } from '../db/schema.js';
import { DosesService } from '../doses/doses.service.js';
import type { OnboardingBody } from './onboarding.schema.js';

// Synthetic demo family (Hack Brasil rule 6.9). Same family name the voice demo uses.
export const DEMO_FAMILY = 'Família Demo';
const DEMO_PATIENT = 'Dona Maria';
const DEMO_CAREGIVERS = ['Ana', 'Carlos'];

@Injectable()
export class FamilyService implements OnApplicationBootstrap {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly doses: DosesService,
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

  /** Everything the family and patient screens show. */
  async overview() {
    const { familyId, patientId } = await this.ensureDemoFamily();
    const people = await this.db
      .select({
        id: members.id,
        name: members.name,
        nickname: members.nickname,
        role: members.role,
        relation: members.relation,
        relationOther: members.relationOther,
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
      })
      .from(medications)
      .where(eq(medications.patientId, patientId))
      .orderBy(asc(medications.createdAt));
    return {
      familyId,
      patient: people.find((p) => p.id === patientId)!,
      caregivers: people.filter((p) => p.role === 'caregiver'),
      medications: meds.map(({ activeIngredient, ...med }) => ({
        ...med,
        ...freeAccessOf(activeIngredient ?? med.name, med.strength),
      })),
      today: await this.doses.listForDay(patientId),
    };
  }

  /** Saved onboarding answers of one caregiver, to restore the sign-up form. */
  async getOnboarding(caregiverId: string) {
    const { familyId, patientId } = await this.ensureDemoFamily();
    const people = await this.db
      .select()
      .from(members)
      .where(eq(members.familyId, familyId))
      .orderBy(asc(members.createdAt));
    const caregiver = people.find((m) => m.id === caregiverId && m.role === 'caregiver');
    if (!caregiver) throw new NotFoundException('Cadastro não encontrado.');
    const patient = people.find((m) => m.id === patientId)!;
    return {
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
        .map((m) => ({ id: m.id, name: m.name, relation: m.relation, joined: m.joinedAt !== null })),
    };
  }

  /**
   * Saves the sign-up answers into the demo family (no login in the demo):
   * updates the patient, creates or updates the caregiver and syncs their pending invites.
   */
  async saveOnboarding(input: OnboardingBody): Promise<{ caregiverId: string }> {
    const { familyId, patientId } = await this.ensureDemoFamily();
    return this.db.transaction(async (tx) => {
      const p = input.patient;
      await tx
        .update(members)
        .set({
          name: p.name,
          nickname: p.nickname || null,
          phone: p.phone,
          birthDate: p.birth,
          cep: p.cep,
          prefersVoice: !p.usesPhone,
        })
        .where(eq(members.id, patientId));

      const c = input.caregiver;
      const caregiverValues = {
        name: c.name,
        phone: c.phone,
        relation: c.relation,
        relationOther: c.relation === 'Outro' ? c.relationOther : null,
      };
      let caregiverId: string | undefined;
      if (input.caregiverId) {
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
        await tx.update(members).set({ relation: invite.relation }).where(eq(members.id, m.id));
        wanted.delete(key(m.name));
      }
      if (wanted.size > 0) {
        await tx.insert(members).values(
          [...wanted.values()].map((i) => ({
            familyId,
            name: i.name,
            relation: i.relation,
            role: 'caregiver' as const,
            invitedById: caregiverId,
          })),
        );
      }
      return { caregiverId };
    });
  }

  /** Marks an invited caregiver as joined when they pick themselves on a device. */
  async join(memberId: string): Promise<void> {
    const { familyId } = await this.ensureDemoFamily();
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
  async setBuyChoice(medicationId: string, buy: boolean): Promise<void> {
    const { patientId } = await this.ensureDemoFamily();
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
