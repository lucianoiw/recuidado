import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module.js';
import { families } from '../db/schema.js';

/**
 * Whether a family may get calls. Calls are the paid part of Recuidado: they cost money on every use
 * (phone minutes and the voice model). Only enforced when AbacatePay is configured; the demo family is exempt.
 */
@Injectable()
export class PlanGate {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: ConfigService,
  ) {}

  /** True when families need the paid plan for calls. */
  get enforced(): boolean {
    return Boolean(this.config.get<string>('ABACATEPAY_API_KEY'));
  }

  async callsAllowed(familyId: string, isDemo: boolean): Promise<boolean> {
    if (isDemo || !this.enforced) return true;
    const [row] = await this.db
      .select({ status: families.subscriptionStatus })
      .from(families)
      .where(eq(families.id, familyId));
    return row?.status === 'active';
  }
}
