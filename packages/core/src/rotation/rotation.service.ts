import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull, ne, or } from 'drizzle-orm';
import { AlertsService } from '../alerts/alerts.service.js';
import { DB, type Database } from '../db/db.module.js';
import { families, members } from '../db/schema.js';
import { localDate } from '../doses/time.js';
import { telemetry } from '../telemetry/telemetry.js';
import { rotationParticipants, rotationSchedule, rotationTurnText } from './rotation.js';

/** "2026-11" in São Paulo. */
export function currentMonth(now: Date): string {
  return localDate(now).slice(0, 7);
}

/** Tells the family, once a month, whose turn it is to buy the medicines. */
@Injectable()
export class RotationService {
  private readonly logger = new Logger(RotationService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly alerts: AlertsService,
  ) {}

  /** Who buys this month and next, or null when the family does not rotate or has nobody in it. */
  async turn(familyId: string, now = new Date()) {
    const [family] = await this.db
      .select({ splitMode: families.splitMode, rotationStartMonth: families.rotationStartMonth })
      .from(families)
      .where(eq(families.id, familyId));
    if (family?.splitMode !== 'rotation') return null;
    const caregivers = await this.db
      .select({
        id: members.id,
        name: members.name,
        rotationOrder: members.rotationOrder,
        splitExcluded: members.splitExcluded,
        createdAt: members.createdAt,
      })
      .from(members)
      .where(and(eq(members.familyId, familyId), eq(members.role, 'caregiver')));
    const month = currentMonth(now);
    const [current, next] = rotationSchedule(
      rotationParticipants(caregivers),
      family.rotationStartMonth ?? month,
      month,
      2,
    );
    return current ? { month, payer: current.member, next: next?.member ?? null } : null;
  }

  /** Hourly, from the dose planner: the alert of the month for every rotating family not told yet. */
  async notifyAll(now = new Date()): Promise<void> {
    const month = currentMonth(now);
    const due = await this.db
      .select({ id: families.id })
      .from(families)
      .where(
        and(
          eq(families.splitMode, 'rotation'),
          or(isNull(families.rotationNotifiedMonth), ne(families.rotationNotifiedMonth, month)),
        ),
      );
    for (const family of due) {
      try {
        await this.notify(family.id, now);
      } catch (error) {
        telemetry.captureException(error, { job_kind: 'rotation', family_id: family.id });
        this.logger.error(`Rotation alert for family ${family.id} failed: ${String(error)}`);
      }
    }
  }

  /** Push and e-mail to every caregiver: "In November, Ana buys the medicines". */
  async notify(familyId: string, now = new Date()): Promise<boolean> {
    const turn = await this.turn(familyId, now);
    // Marked even without anybody in the rotation, so the planner does not try every hour.
    await this.db
      .update(families)
      .set({ rotationNotifiedMonth: currentMonth(now) })
      .where(eq(families.id, familyId));
    if (!turn) return false;
    const [patient] = await this.db
      .select({ name: members.name, nickname: members.nickname })
      .from(members)
      .where(and(eq(members.familyId, familyId), eq(members.role, 'patient')))
      .limit(1);
    const text = rotationTurnText({
      month: turn.month,
      payer: turn.payer.name,
      next: turn.next?.name ?? null,
      patient: patient?.nickname?.trim() || patient?.name || 'ela',
    });
    await this.alerts.notifyCaregivers(familyId, { kind: 'rotation_turn', ...text, url: '/family/comprar' });
    telemetry.capture('rotation_turn_notified', { family_id: familyId, month: turn.month });
    return true;
  }
}
