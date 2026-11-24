import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import type { Database } from '../db/db.module.js';
import { doses, medications } from '../db/schema.js';

/**
 * Doses she takes together: same patient, same scheduled instant, same kind (demo or real). At 8:00 she
 * may take two medicines: one call asks about both, and one family alert names both.
 */
export interface SameTimeDose {
  id: string;
  status: 'pending' | 'taken' | 'missed';
  callRequestedAt: Date | null;
  familyAlertedAt: Date | null;
  name: string;
  strength: string | null;
}

/** The other doses taken at the same time as `doseId` (not the dose itself), oldest medicine first. */
export async function sameTimeDoses(db: Database, doseId: string): Promise<SameTimeDose[]> {
  const [self] = await db
    .select({ patientId: medications.patientId, scheduledAt: doses.scheduledAt, demo: doses.demo })
    .from(doses)
    .innerJoin(medications, eq(doses.medicationId, medications.id))
    .where(eq(doses.id, doseId));
  if (!self) return [];
  return db
    .select({
      id: doses.id,
      status: doses.status,
      callRequestedAt: doses.callRequestedAt,
      familyAlertedAt: doses.familyAlertedAt,
      name: medications.name,
      strength: medications.strength,
    })
    .from(doses)
    .innerJoin(medications, eq(doses.medicationId, medications.id))
    .where(
      and(
        eq(medications.patientId, self.patientId),
        eq(doses.scheduledAt, self.scheduledAt),
        eq(doses.demo, self.demo),
        ne(doses.id, doseId),
        isNull(medications.stoppedAt),
      ),
    )
    .orderBy(medications.createdAt) as Promise<SameTimeDose[]>;
}

/** "Entresto 50 mg e Dapagliflozina 10 mg". */
export function medicationsLabel(items: { name: string; strength: string | null }[]): string {
  const labels = items.map((m) => [m.name, m.strength].filter(Boolean).join(' '));
  return labels.length > 1 ? `${labels.slice(0, -1).join(', ')} e ${labels.at(-1)}` : (labels[0] ?? '');
}

/**
 * Claims the call for a group of doses taken together: true for the first dose whose call job gets here,
 * false when another dose of the group already called. The lock makes two jobs at the same instant agree.
 */
export async function claimGroupCall(db: Database, doseId: string, groupIds: string[], now = new Date()): Promise<boolean> {
  return db.transaction(async (tx) => {
    const ids = [doseId, ...groupIds].sort();
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${ids[0]}))`);
    const claimed = await tx
      .select({ id: doses.id })
      .from(doses)
      .where(and(sql`${doses.id} in (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})`, sql`${doses.callRequestedAt} is not null`));
    if (claimed.length > 0) return false;
    await tx.update(doses).set({ callRequestedAt: now }).where(eq(doses.id, doseId));
    return true;
  });
}
