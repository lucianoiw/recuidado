import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module.js';
import { alerts, members } from '../db/schema.js';
import { PushService } from '../push/push.service.js';

export type AlertKind = (typeof alerts.$inferInsert)['kind'];

export interface CaregiverAlert {
  kind: AlertKind;
  title: string;
  body: string;
  /** Page the push opens. */
  url: string;
  doseId?: string;
  medicationId?: string;
}

/** Push to every caregiver of a family, and keep the alert for the history screen. */
@Injectable()
export class AlertsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly push: PushService,
  ) {}

  /** Returns how many caregivers there are and how many pushes were delivered. */
  async notifyCaregivers(familyId: string, alert: CaregiverAlert): Promise<{ caregivers: number; sent: number }> {
    const caregivers = await this.db
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.familyId, familyId), eq(members.role, 'caregiver')));
    const sent = await this.push.sendToMembers(
      caregivers.map((c) => c.id),
      { title: alert.title, body: alert.body, url: alert.url, doseId: alert.doseId },
    );
    await this.db.insert(alerts).values({
      familyId,
      kind: alert.kind,
      title: alert.title,
      body: alert.body,
      doseId: alert.doseId ?? null,
      medicationId: alert.medicationId ?? null,
      pushesDelivered: sent,
    });
    return { caregivers: caregivers.length, sent };
  }

  /** Newest first. */
  list(familyId: string, limit = 50) {
    return this.db
      .select({
        id: alerts.id,
        kind: alerts.kind,
        title: alerts.title,
        body: alerts.body,
        doseId: alerts.doseId,
        medicationId: alerts.medicationId,
        createdAt: alerts.createdAt,
      })
      .from(alerts)
      .where(eq(alerts.familyId, familyId))
      .orderBy(desc(alerts.createdAt))
      .limit(limit);
  }
}
