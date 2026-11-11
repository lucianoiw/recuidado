import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module.js';
import { families, medications, members } from '../db/schema.js';
import { DosesService } from '../doses/doses.service.js';

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
    const existing = await this.db.select().from(members).where(eq(members.familyId, family.id));
    let patient = existing.find((m) => m.role === 'patient' && m.name === DEMO_PATIENT);
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
      .select({ id: members.id, name: members.name, role: members.role })
      .from(members)
      .where(eq(members.familyId, familyId))
      .orderBy(asc(members.createdAt));
    const meds = await this.db
      .select({
        id: medications.id,
        name: medications.name,
        strength: medications.strength,
        times: medications.times,
        freeInFarmaciaPopular: medications.freeInFarmaciaPopular,
        monthlyCostCents: medications.monthlyCostCents,
      })
      .from(medications)
      .where(eq(medications.patientId, patientId))
      .orderBy(asc(medications.createdAt));
    return {
      familyId,
      patient: people.find((p) => p.id === patientId)!,
      caregivers: people.filter((p) => p.role === 'caregiver'),
      medications: meds,
      today: await this.doses.listForDay(patientId),
    };
  }
}
