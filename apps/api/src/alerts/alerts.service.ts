import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module.js';
import { alerts, families, members } from '../db/schema.js';
import { EmailService } from '../email/email.service.js';
import { DEMO_FAMILY } from '../family/demo-family.js';
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

/** E-mails of the demo family alerts, from DEMO_ALERT_EMAILS (its caregivers are synthetic and have none). */
export function demoAlertEmails(value: string | undefined): string[] {
  return (value ?? '').split(',').map((e) => e.trim()).filter((e) => e.includes('@'));
}

/** Push and e-mail to every caregiver of a family, and keep the alert for the history screen. */
@Injectable()
export class AlertsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly push: PushService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  /** Returns how many caregivers there are, how many pushes were delivered and how many e-mails were sent. */
  async notifyCaregivers(
    familyId: string,
    alert: CaregiverAlert,
  ): Promise<{ caregivers: number; sent: number; emails: number }> {
    const caregivers = await this.db
      .select({ id: members.id, email: members.email, familyName: families.name })
      .from(members)
      .innerJoin(families, eq(families.id, members.familyId))
      .where(and(eq(members.familyId, familyId), eq(members.role, 'caregiver')));
    const isDemo = caregivers[0]?.familyName === DEMO_FAMILY;
    const addresses = isDemo
      ? demoAlertEmails(this.config.get<string>('DEMO_ALERT_EMAILS'))
      : caregivers.flatMap((c) => (c.email ? [c.email] : []));
    const link = new URL(alert.url, this.config.get<string>('WEB_URL')).toString();
    const [sent, emails] = await Promise.all([
      this.push.sendToMembers(
        caregivers.map((c) => c.id),
        { title: alert.title, body: alert.body, url: alert.url, doseId: alert.doseId },
      ),
      this.email.sendAlert(addresses, { title: alert.title, body: alert.body, link }, alert.kind),
    ]);
    await this.record(familyId, alert, sent, emails);
    return { caregivers: caregivers.length, sent, emails };
  }

  /** Keeps an entry in the history without a push, e.g. the emergency phone call to the first contact. */
  async record(
    familyId: string,
    alert: Omit<CaregiverAlert, 'url'>,
    pushesDelivered = 0,
    emailsDelivered = 0,
  ): Promise<void> {
    await this.db.insert(alerts).values({
      familyId,
      kind: alert.kind,
      title: alert.title,
      body: alert.body,
      doseId: alert.doseId ?? null,
      medicationId: alert.medicationId ?? null,
      pushesDelivered,
      emailsDelivered,
    });
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
        pushesDelivered: alerts.pushesDelivered,
        emailsDelivered: alerts.emailsDelivered,
        createdAt: alerts.createdAt,
      })
      .from(alerts)
      .where(eq(alerts.familyId, familyId))
      .orderBy(desc(alerts.createdAt))
      .limit(limit);
  }
}
