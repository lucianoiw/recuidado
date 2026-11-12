import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module.js';
import { families, members } from '../db/schema.js';

/** Lower-cased e-mails from a comma-separated list. */
export function emailList(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Whether a family may get calls. Calls are the paid part of Recuidado: they cost money on every use
 * (phone minutes and the voice model). Everything else is free.
 * A family gets calls when it is the demo family, has an active paid plan, or has a caregiver whose
 * e-mail is in PLAN_INCLUDED_EMAILS (the team's own account, used in the video while nobody can pay).
 */
@Injectable()
export class PlanGate {
  private readonly included: Set<string>;

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: ConfigService,
  ) {
    this.included = emailList(this.config.get<string>('PLAN_INCLUDED_EMAILS'));
  }

  /** The plan comes free with this caregiver e-mail. */
  includesEmail(email: string | null | undefined): boolean {
    return Boolean(email) && this.included.has(email!.trim().toLowerCase());
  }

  /** A caregiver who signed in to this family has an e-mail in PLAN_INCLUDED_EMAILS (a pending invite does not count). */
  async includedFamily(familyId: string): Promise<boolean> {
    if (this.included.size === 0) return false;
    const [row] = await this.db
      .select({ id: members.id })
      .from(members)
      .where(
        and(
          eq(members.familyId, familyId),
          eq(members.role, 'caregiver'),
          isNotNull(members.joinedAt),
          inArray(members.email, [...this.included]),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async callsAllowed(familyId: string, isDemo: boolean): Promise<boolean> {
    if (isDemo) return true;
    const [row] = await this.db
      .select({ status: families.subscriptionStatus })
      .from(families)
      .where(eq(families.id, familyId));
    if (row?.status === 'active') return true;
    return this.includedFamily(familyId);
  }
}
