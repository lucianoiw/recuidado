import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, count, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { AlertsService } from '../alerts/alerts.service.js';
import { DB, type Database } from '../db/db.module.js';
import { doses, medications, members } from '../db/schema.js';
import { telemetry } from '../telemetry/telemetry.js';
import { lowStockText, stockStatus, type StockStatus } from './stock.js';

/** Pills at home, how long they last, and the "remédio acabando" alert. */
@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly alerts: AlertsService,
    private readonly config: ConfigService,
  ) {}

  private get lowDays(): number {
    return this.config.get<number>('LOW_STOCK_DAYS') ?? 5;
  }

  /** Stock of each medication that has a count; the others are left out. */
  async statusFor(
    meds: { id: string; times: string[]; stockUnits: number | null }[],
  ): Promise<Map<string, StockStatus>> {
    const counted = meds.filter((m) => m.stockUnits !== null);
    const result = new Map<string, StockStatus>();
    if (counted.length === 0) return result;
    const taken = await this.takenSinceCount(counted.map((m) => m.id));
    for (const m of counted) {
      result.set(
        m.id,
        stockStatus({
          counted: m.stockUnits!,
          takenSince: taken.get(m.id) ?? 0,
          dosesPerDay: m.times.length,
          lowDays: this.lowDays,
        }),
      );
    }
    return result;
  }

  /** The family counted the pills at home (or cleared the count with null). */
  async setCount(medicationId: string, units: number | null, now = new Date()): Promise<void> {
    await this.db
      .update(medications)
      .set({ stockUnits: units, stockCountedAt: units === null ? null : now, lowStockAlertedAt: null })
      .where(eq(medications.id, medicationId));
  }

  /** After a confirmed dose: tells the family once when the pills are about to run out. */
  async checkAfterDose(doseId: string): Promise<void> {
    const [med] = await this.db
      .select({
        id: medications.id,
        name: medications.name,
        strength: medications.strength,
        times: medications.times,
        stockUnits: medications.stockUnits,
        lowStockAlertedAt: medications.lowStockAlertedAt,
        familyId: members.familyId,
        patientId: members.id,
        patientName: sql<string>`coalesce(${members.nickname}, ${members.name})`,
      })
      .from(doses)
      .innerJoin(medications, eq(doses.medicationId, medications.id))
      .innerJoin(members, eq(medications.patientId, members.id))
      .where(eq(doses.id, doseId));
    if (!med || med.stockUnits === null || med.lowStockAlertedAt) return;

    const status = (await this.statusFor([med])).get(med.id);
    if (!status?.low) return;

    // Only one alert per count, even if two confirmations race.
    const [claimed] = await this.db
      .update(medications)
      .set({ lowStockAlertedAt: new Date() })
      .where(and(eq(medications.id, med.id), isNull(medications.lowStockAlertedAt)))
      .returning({ id: medications.id });
    if (!claimed) return;

    const label = [med.name, med.strength].filter(Boolean).join(' ');
    const { caregivers, sent } = await this.alerts.notifyCaregivers(med.familyId, {
      kind: 'low_stock',
      title: status.units === 0 ? `${label} acabou` : `${label} está acabando`,
      body: `${lowStockText(status)} Vale pegar mais para ${med.patientName}.`,
      url: '/family/remedios',
      doseId,
      medicationId: med.id,
    });
    telemetry.capture(
      'low_stock_alerted',
      { medication: label, units_left: status.units, days_left: status.daysLeft, caregivers, pushes_delivered: sent },
      med.patientId,
    );
    this.logger.log(`Low stock of ${med.id}: ${status.units} left (${sent} pushes).`);
  }

  /** Confirmed doses (demo run excluded) since each medication was counted. */
  private async takenSinceCount(medicationIds: string[]): Promise<Map<string, number>> {
    const rows = await this.db
      .select({ medicationId: doses.medicationId, n: count() })
      .from(doses)
      .innerJoin(medications, eq(doses.medicationId, medications.id))
      .where(
        and(
          inArray(doses.medicationId, medicationIds),
          eq(doses.status, 'taken'),
          // Extra doses of the demo run do not use up pills, so repeated runs keep the count.
          eq(doses.demo, false),
          gte(doses.confirmedAt, medications.stockCountedAt),
        ),
      )
      .groupBy(doses.medicationId);
    return new Map(rows.map((r) => [r.medicationId, r.n]));
  }
}

