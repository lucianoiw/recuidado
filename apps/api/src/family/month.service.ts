import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { and, asc, eq, gte, lt, ne } from 'drizzle-orm';
import {
  costShares,
  type Database,
  DB,
  doses,
  families,
  localDate,
  localDateTime,
  medications,
  members,
  RotationService,
  rotationParticipants,
  rotationSchedule,
  type SplitMode,
} from '@recuidado/core';
import { FamilyService, freeAccessOf } from './family.service.js';
import { normalizePixKey, pixCopyPaste, pixKeyType, type PixKeyType } from './pix.js';
import { cmedPriceOf, monthlyCostOf } from './pricing.js';

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

// The demo family's synthetic Pix key: example.com is reserved (RFC 2606) and never reaches anyone.
export const DEMO_PIX_KEY = 'ana@example.com';

/** Splits a total in equal parts; the first ones take the leftover cents. */
export function splitEqually(totalCents: number, people: number): number[] {
  if (people <= 0) return [];
  const base = Math.floor(totalCents / people);
  const rest = totalCents - base * people;
  return Array.from({ length: people }, (_, i) => base + (i < rest ? 1 : 0));
}

/** "2026-11" to "novembro de 2026". */
export function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number) as [number, number];
  return `${MONTH_NAMES[m - 1]} de ${year}`;
}

/** "2026-11" and the instants of the first day of this month and of the next one, in São Paulo. */
export function monthRange(now: Date): { month: string; label: string; start: Date; end: Date } {
  const today = localDate(now);
  const [year, month] = today.split('-').map(Number) as [number, number];
  const pad = (n: number) => String(n).padStart(2, '0');
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;
  return {
    month: `${year}-${pad(month)}`,
    label: `${MONTH_NAMES[month - 1]} de ${year}`,
    start: localDateTime(`${year}-${pad(month)}-01`, '00:00')!,
    end: localDateTime(next, '00:00')!,
  };
}

@Injectable()
export class MonthService implements OnApplicationBootstrap {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly family: FamilyService,
    private readonly rotation: RotationService,
  ) {}

  async onApplicationBootstrap() {
    await this.ensureDemoReceiver();
  }

  /**
   * What the family saved and spends on medicines this month, how the cost is split,
   * who already paid, and the doses of the month so far.
   */
  async summary(familyId: string | null | undefined, now = new Date()) {
    const ref = await this.family.resolveFamily(familyId);
    const range = monthRange(now);

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
      .where(eq(medications.patientId, ref.patientId))
      .orderBy(asc(medications.createdAt));

    let priceListDate: string | null = null;
    const items = meds.map((m) => {
      const access = freeAccessOf(m.activeIngredient ?? m.name, m.strength, m.name);
      const price = cmedPriceOf(m.activeIngredient, m.name, m.strength, m.times.length);
      priceListDate ??= price?.listDate ?? null;
      const freeAt = access.freeAt ?? [];
      const free = (m.freeInFarmaciaPopular || freeAt.length > 0) && !m.buyInsteadOfFree;
      return {
        id: m.id,
        name: m.name,
        strength: m.strength,
        monthlyCents: monthlyCostOf(m.monthlyCostCents, price),
        free,
        freeAt: m.freeInFarmaciaPopular && !freeAt.includes('farmacia_popular') ? [...freeAt, 'farmacia_popular'] : freeAt,
        highCost: access.highCost ?? false,
        priced: monthlyCostOf(m.monthlyCostCents, price) > 0,
      };
    });
    const sum = (list: typeof items) => list.reduce((total, i) => total + i.monthlyCents, 0);
    const saved = items.filter((i) => i.free);
    const toBuy = items.filter((i) => !i.free);
    const costCents = sum(toBuy);

    return {
      month: range.month,
      label: range.label,
      savedCents: sum(saved),
      costCents,
      // Bought today but could be free through the Alto Custo program, with the doctor's form.
      highCostPotentialCents: sum(toBuy.filter((i) => i.highCost)),
      saved,
      toBuy,
      unpriced: toBuy.filter((i) => !i.priced).length,
      /** Publication date of the CMED list the prices come from. */
      priceListDate,
      split: await this.split(ref.familyId, ref.isDemo, range, costCents),
      doses: await this.doseCounts(ref.patientId, range.start, now),
    };
  }

  private async split(
    familyId: string,
    isDemo: boolean,
    range: ReturnType<typeof monthRange>,
    costCents: number,
  ) {
    const [family] = await this.db
      .select({ splitMode: families.splitMode, rotationStartMonth: families.rotationStartMonth })
      .from(families)
      .where(eq(families.id, familyId));
    const caregivers = await this.db
      .select({
        id: members.id,
        name: members.name,
        pixKey: members.pixKey,
        rotationOrder: members.rotationOrder,
        splitExcluded: members.splitExcluded,
        splitExcludedReason: members.splitExcludedReason,
        createdAt: members.createdAt,
      })
      .from(members)
      .where(and(eq(members.familyId, familyId), eq(members.role, 'caregiver')))
      .orderBy(asc(members.createdAt));
    const [patient] = await this.db
      .select({ name: members.name, nickname: members.nickname })
      .from(members)
      .where(and(eq(members.familyId, familyId), eq(members.role, 'patient')))
      .limit(1);
    const payments = await this.db
      .select({ memberId: costShares.memberId, paidAt: costShares.paidAt })
      .from(costShares)
      .where(and(eq(costShares.familyId, familyId), eq(costShares.month, range.month)));
    const paidAt = new Map(payments.map((p) => [p.memberId, p.paidAt]));

    const mode: SplitMode = family?.splitMode ?? 'split';
    const participants = rotationParticipants(caregivers);
    const inOrder = new Map(participants.map((p, i) => [p.id, i]));
    // Everyone, the ones in the split or rotation first and in the family's order, the others after.
    const people = [...participants, ...caregivers.filter((c) => !inOrder.has(c.id))].map((c) => ({
      memberId: c.id,
      name: c.name,
      excluded: c.splitExcluded,
      excludedReason: c.splitExcludedReason,
    }));

    if (mode === 'rotation') {
      const schedule = rotationSchedule(participants, family?.rotationStartMonth ?? range.month, range.month, 4);
      const payer = schedule[0]?.member ?? null;
      return {
        mode,
        receiver: null,
        demoPix: isDemo,
        people,
        rotation: {
          payer: payer ? { id: payer.id, name: payer.name } : null,
          schedule: schedule.map((s) => ({
            month: s.month,
            label: monthLabel(s.month),
            memberId: s.member.id,
            name: s.member.name,
          })),
        },
        // Only the one whose month it is pays, the whole cost. "Já comprei" marks it.
        shares: payer
          ? [
              {
                memberId: payer.id,
                name: payer.name,
                amountCents: costCents,
                isReceiver: false,
                paid: Boolean(paidAt.get(payer.id)),
                paidAt: paidAt.get(payer.id) ?? null,
                pix: null,
              },
            ]
          : [],
      };
    }

    // The one with a Pix key buys the medicines and receives the others' shares.
    const receiver = caregivers.find((c) => c.pixKey) ?? null;
    const amounts = splitEqually(costCents, participants.length);
    const who = patient?.nickname?.trim() || patient?.name || '';
    // The receiver stays in the list even when out of the split: they still buy and receive.
    const sharing = receiver && !inOrder.has(receiver.id) ? [receiver, ...participants] : participants;
    return {
      mode,
      receiver: receiver
        ? { id: receiver.id, name: receiver.name, keyType: pixKeyType(receiver.pixKey!), pixKey: receiver.pixKey! }
        : null,
      demoPix: isDemo,
      people,
      rotation: null,
      shares: sharing
        .map((c) => {
          const isReceiver = c.id === receiver?.id;
          const index = inOrder.get(c.id);
          const amountCents = index === undefined ? 0 : (amounts[index] ?? 0);
          return {
            memberId: c.id,
            name: c.name,
            amountCents,
            isReceiver,
            // The receiver paid the pharmacy: their share is settled.
            paid: isReceiver || Boolean(paidAt.get(c.id)),
            paidAt: paidAt.get(c.id) ?? null,
            pix:
              receiver && !isReceiver && amountCents > 0
                ? pixCopyPaste({
                    key: receiver.pixKey!,
                    name: receiver.name,
                    city: 'Brasil',
                    amountCents,
                    description: `Remedios ${who} ${range.label}`,
                    txid: `RECUIDADO${range.month}`,
                  })
                : null,
          };
        })
        // The receiver first: the screen reads "Ana buys, the others pay her".
        .sort((a, b) => Number(b.isReceiver) - Number(a.isReceiver)),
    };
  }

  /** Doses from the first day of the month until now. */
  private async doseCounts(patientId: string, start: Date, now: Date) {
    const rows = await this.db
      .select({ status: doses.status, confirmedVia: doses.confirmedVia })
      .from(doses)
      .innerJoin(medications, eq(doses.medicationId, medications.id))
      .where(
        and(
          eq(medications.patientId, patientId),
          gte(doses.scheduledAt, start),
          lt(doses.scheduledAt, now),
          // Extra doses of the 2 minute demo run would skew the month.
          eq(doses.demo, false),
        ),
      );
    const taken = rows.filter((r) => r.status === 'taken').length;
    return {
      total: rows.length,
      taken,
      missed: rows.filter((r) => r.status === 'missed').length,
      pending: rows.filter((r) => r.status === 'pending').length,
      byVoice: rows.filter((r) => r.status === 'taken' && r.confirmedVia === 'voice').length,
    };
  }

  /** A caregiver marks their share of this month as paid (or not). */
  async setPaid(familyId: string | null | undefined, memberId: string, paid: boolean, now = new Date()) {
    // Allowed on the demo family too: it is a toggle and the visitor can switch it back.
    const ref = await this.family.resolveFamily(familyId);
    const [member] = await this.db
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.familyId, ref.familyId), eq(members.role, 'caregiver')));
    if (!member) throw new NotFoundException('Pessoa não encontrada.');
    const summary = await this.summary(familyId, now);
    const share = summary.split.shares.find((s) => s.memberId === memberId);
    const values = {
      familyId: ref.familyId,
      memberId,
      month: summary.month,
      amountCents: share?.amountCents ?? 0,
      paidAt: paid ? now : null,
    };
    await this.db
      .insert(costShares)
      .values(values)
      .onConflictDoUpdate({
        target: [costShares.familyId, costShares.memberId, costShares.month],
        set: { amountCents: values.amountCents, paidAt: values.paidAt },
      });
  }

  /**
   * How the siblings pay: split by Pix or one per month. `members` is every caregiver in the
   * rotation order, each one in or out of the count. Changing the rotation restarts it this month
   * with the first of the list, and tells the family when the one who buys this month changed.
   * Allowed on the demo family too: the visitor can switch it back.
   */
  async setPayment(
    familyId: string | null | undefined,
    input: { mode: SplitMode; members: { id: string; excluded: boolean; reason?: string | null }[] },
    now = new Date(),
  ) {
    const ref = await this.family.resolveFamily(familyId);
    const caregivers = await this.db
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.familyId, ref.familyId), eq(members.role, 'caregiver')));
    const known = new Set(caregivers.map((c) => c.id));
    if (input.members.some((m) => !known.has(m.id))) throw new NotFoundException('Pessoa não encontrada.');
    const before = await this.rotation.turn(ref.familyId, now);
    await this.db.transaction(async (tx) => {
      for (const [index, m] of input.members.entries()) {
        await tx
          .update(members)
          .set({
            rotationOrder: index,
            splitExcluded: m.excluded,
            splitExcludedReason: m.excluded ? m.reason?.trim() || null : null,
          })
          .where(eq(members.id, m.id));
      }
      await tx
        .update(families)
        .set({ splitMode: input.mode, rotationStartMonth: monthRange(now).month })
        .where(eq(families.id, ref.familyId));
    });
    const after = await this.rotation.turn(ref.familyId, now);
    if (after && after.payer.id !== before?.payer.id) {
      // Not awaited: a slow e-mail should not hold the save.
      void this.rotation.notify(ref.familyId, now).catch(() => false);
    }
  }

  /** The caregiver who buys and receives the Pix. Only one per family: the others' keys are cleared. */
  async setPixKey(
    familyId: string | null | undefined,
    memberId: string,
    input: { type: PixKeyType; key: string } | null,
  ) {
    const ref = await this.family.writableFamily(familyId);
    const key = input ? normalizePixKey(input.type, input.key) : null;
    if (input && !key) throw new BadRequestException('Chave Pix inválida.');
    await this.db.transaction(async (tx) => {
      const [member] = await tx
        .update(members)
        .set({ pixKey: key })
        .where(and(eq(members.id, memberId), eq(members.familyId, ref.familyId), eq(members.role, 'caregiver')))
        .returning({ id: members.id });
      if (!member) throw new NotFoundException('Pessoa não encontrada.');
      if (key) {
        await tx
          .update(members)
          .set({ pixKey: null })
          .where(and(eq(members.familyId, ref.familyId), ne(members.id, memberId)));
      }
    });
  }

  /** Gives the demo family a receiver with a synthetic key, so the Pix screen has something to show. */
  async ensureDemoReceiver(): Promise<void> {
    const { familyId } = await this.family.ensureDemoFamily();
    const caregivers = await this.db
      .select({ id: members.id, pixKey: members.pixKey })
      .from(members)
      .where(and(eq(members.familyId, familyId), eq(members.role, 'caregiver')))
      .orderBy(asc(members.createdAt));
    if (caregivers.length === 0 || caregivers.some((c) => c.pixKey)) return;
    await this.db.update(members).set({ pixKey: DEMO_PIX_KEY }).where(eq(members.id, caregivers[0]!.id));
  }
}
