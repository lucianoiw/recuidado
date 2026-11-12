import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ProgramIndex,
  readProgramFiles,
  seedProgramIndex,
  type BenefitProgramItem,
  type ProgramFile,
} from '@recuidado/data';
import { desc, eq, max, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module.js';
import { benefitProgramItems, benefitPrograms, benefitProgramSyncs } from '../db/schema.js';

/** A new list smaller than this share of the current one is treated as a broken read and not applied. */
export const MIN_KEEP_SHARE = 0.5;
/** How long the API trusts its in-memory index before checking the database for a newer list. */
const INDEX_TTL_MS = 60_000;

export interface SyncResult {
  programId: string;
  status: 'updated' | 'unchanged' | 'rejected' | 'failed';
  added: number;
  removed: number;
  changed: number;
  total: number;
  error: string | null;
}

type ItemRow = typeof benefitProgramItems.$inferSelect;

/** JSON with sorted object keys: Postgres jsonb does not keep the key order. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a.localeCompare(b)))
      : inner,
  );
}

/** The fields that make two versions of an item different. */
function itemSignature(item: BenefitProgramItem | ItemRow): string {
  return stableJson([
    item.name,
    item.activeIngredients,
    item.looseKey,
    item.looseMatchKey,
    item.extendedRelease,
    item.access,
    item.availability,
    item.group,
    item.conditions,
    item.conditionCodes,
    item.rules,
    item.sourceUrl,
  ]);
}

function toItem(row: ItemRow): BenefitProgramItem {
  return {
    programId: row.programId,
    key: row.key,
    name: row.name,
    activeIngredients: row.activeIngredients,
    looseKey: row.looseKey,
    looseMatchKey: row.looseMatchKey,
    extendedRelease: row.extendedRelease,
    access: row.access,
    availability: row.availability,
    group: row.group,
    conditions: row.conditions,
    conditionCodes: row.conditionCodes,
    rules: row.rules,
    sourceUrl: row.sourceUrl,
  };
}

/**
 * The programs that give medicines for free (Farmácia Popular, UBS, Alto Custo...) as kept in Postgres.
 * The API loads the shipped lists on boot and answers from an in-memory index; the worker refreshes the
 * lists from the official sources every month (apply with origin 'source').
 */
@Injectable()
export class ProgramsService {
  private readonly logger = new Logger(ProgramsService.name);
  private cached: { index: ProgramIndex; stamp: string; at: number } | null = null;
  private loading: Promise<ProgramIndex> | null = null;

  constructor(@Inject(DB) private readonly db: Database) {}

  /** API boot: loads each shipped program that is missing, or newer than the one in the database. */
  async loadSeeds(files: ProgramFile[] = readProgramFiles()): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    for (const file of files) {
      const [row] = await this.db
        .select({ version: benefitPrograms.version })
        .from(benefitPrograms)
        .where(eq(benefitPrograms.id, file.program.id));
      if (row && row.version >= file.program.version) continue;
      results.push(await this.apply(file, 'seed'));
    }
    return results;
  }

  /**
   * Replaces a program's items with a new list. Counts what was added, removed and changed, and keeps a
   * row of the run. A list from the source that lost more than half its items is not applied.
   */
  async apply(file: ProgramFile, origin: 'seed' | 'source'): Promise<SyncResult> {
    const startedAt = new Date();
    const { program, items } = file;
    const current = await this.db.select().from(benefitProgramItems).where(eq(benefitProgramItems.programId, program.id));
    const before = new Map(current.map((row) => [row.key, row]));
    const next = new Map(items.map((item) => [item.key, item]));
    const added = items.filter((item) => !before.has(item.key)).length;
    const removed = current.filter((row) => !next.has(row.key)).length;
    const changed = items.filter((item) => {
      const old = before.get(item.key);
      return old && itemSignature(old) !== itemSignature(item);
    }).length;
    const result = (status: SyncResult['status'], error: string | null = null): SyncResult => ({
      programId: program.id,
      status,
      added,
      removed,
      changed,
      total: items.length,
      error,
    });

    const [existing] = await this.db.select().from(benefitPrograms).where(eq(benefitPrograms.id, program.id));
    if (origin === 'source' && current.length > 0 && items.length < current.length * MIN_KEEP_SHARE) {
      const out = result('rejected', `A nova lista tem ${items.length} itens; a atual tem ${current.length}. Mantida a atual.`);
      await this.record(out, origin, program.version, startedAt);
      return out;
    }

    const programRow = {
      id: program.id,
      name: program.name,
      kind: program.kind,
      level: program.level,
      region: program.region,
      channel: program.channel,
      sourceUrl: program.sourceUrl,
      version: program.version,
      documents: program.documents,
      rules: program.rules,
      checkedAt: origin === 'source' ? startedAt : (existing?.checkedAt ?? null),
    };
    const programChanged =
      !existing ||
      stableJson([existing.name, existing.channel, existing.sourceUrl, existing.version, existing.documents, existing.rules]) !==
        stableJson([program.name, program.channel, program.sourceUrl, program.version, program.documents, program.rules]);

    if (existing && !programChanged && added + removed + changed === 0) {
      if (origin === 'source') await this.db.update(benefitPrograms).set({ checkedAt: startedAt }).where(eq(benefitPrograms.id, program.id));
      const out = result('unchanged');
      await this.record(out, origin, program.version, startedAt);
      return out;
    }

    await this.db.transaction(async (tx) => {
      await tx
        .insert(benefitPrograms)
        .values({ ...programRow, updatedAt: startedAt })
        .onConflictDoUpdate({ target: benefitPrograms.id, set: { ...programRow, updatedAt: startedAt } });
      await tx.delete(benefitProgramItems).where(eq(benefitProgramItems.programId, program.id));
      for (let i = 0; i < items.length; i += 200) {
        await tx.insert(benefitProgramItems).values(
          items.slice(i, i + 200).map((item) => ({ ...item, programId: program.id, updatedAt: startedAt })),
        );
      }
    });
    this.cached = null;
    const out = result('updated');
    await this.record(out, origin, program.version, startedAt);
    this.logger.log(`${program.id}: ${items.length} itens (+${added} -${removed} ~${changed}), origem ${origin}.`);
    return out;
  }

  /** The source could not be read: keeps the current list and says why. */
  async recordFailure(programId: string, error: string): Promise<SyncResult> {
    const out: SyncResult = { programId, status: 'failed', added: 0, removed: 0, changed: 0, total: 0, error };
    const [exists] = await this.db.select({ id: benefitPrograms.id }).from(benefitPrograms).where(eq(benefitPrograms.id, programId));
    if (exists) await this.record(out, 'source', null, new Date());
    this.logger.warn(`${programId}: fonte oficial não respondeu: ${error}`);
    return out;
  }

  private async record(result: SyncResult, origin: 'seed' | 'source', version: string | null, startedAt: Date) {
    await this.db.insert(benefitProgramSyncs).values({
      programId: result.programId,
      origin,
      status: result.status,
      version,
      added: result.added,
      removed: result.removed,
      changed: result.changed,
      total: result.total,
      error: result.error,
      startedAt,
      finishedAt: new Date(),
    });
  }

  /** Changes when any program is updated (by this process or the worker). */
  private async stamp(): Promise<string> {
    const [row] = await this.db
      .select({ updated: max(benefitPrograms.updatedAt), count: sql<number>`count(*)::int` })
      .from(benefitPrograms);
    return `${row?.updated?.toISOString() ?? ''}|${row?.count ?? 0}`;
  }

  /** The lookup index, read from the database and kept in memory until a list changes. */
  async index(): Promise<ProgramIndex> {
    const now = Date.now();
    if (this.cached && now - this.cached.at < INDEX_TTL_MS) return this.cached.index;
    this.loading ??= (async () => {
      try {
        const stamp = await this.stamp();
        if (this.cached && this.cached.stamp === stamp) {
          this.cached.at = Date.now();
          return this.cached.index;
        }
        const programs = await this.db.select().from(benefitPrograms);
        const rows = await this.db.select().from(benefitProgramItems);
        const files: ProgramFile[] = programs.map((program) => ({
          program: {
            id: program.id,
            name: program.name,
            kind: program.kind,
            level: program.level,
            region: program.region,
            channel: program.channel,
            sourceUrl: program.sourceUrl,
            version: program.version,
            documents: program.documents,
            rules: program.rules,
          },
          items: rows.filter((row) => row.programId === program.id).map(toItem),
        }));
        const index = new ProgramIndex(files);
        this.cached = { index, stamp, at: Date.now() };
        return index;
      } finally {
        this.loading = null;
      }
    })();
    return this.loading;
  }

  /**
   * The index to answer with: the database copy, or the shipped files while the database has no program
   * yet (first boot, tests) or does not answer. Never throws: a lookup must not take the family screen down.
   */
  async answerIndex(): Promise<ProgramIndex> {
    try {
      const index = await this.index();
      if (index.itemCount > 0) return index;
    } catch (error) {
      this.logger.warn(`Programas do banco indisponíveis, usando os arquivos: ${String(error)}`);
    }
    return seedProgramIndex();
  }

  /** Every program with its size and last refresh, for the sources screen and the README. */
  async list() {
    const programs = await this.db
      .select({
        id: benefitPrograms.id,
        name: benefitPrograms.name,
        kind: benefitPrograms.kind,
        level: benefitPrograms.level,
        region: benefitPrograms.region,
        channel: benefitPrograms.channel,
        sourceUrl: benefitPrograms.sourceUrl,
        version: benefitPrograms.version,
        documents: benefitPrograms.documents,
        checkedAt: benefitPrograms.checkedAt,
        updatedAt: benefitPrograms.updatedAt,
      })
      .from(benefitPrograms)
      .orderBy(benefitPrograms.id);
    const counts = await this.db
      .select({ programId: benefitProgramItems.programId, items: sql<number>`count(*)::int` })
      .from(benefitProgramItems)
      .groupBy(benefitProgramItems.programId);
    const syncs = await this.db.select().from(benefitProgramSyncs).orderBy(desc(benefitProgramSyncs.startedAt)).limit(50);
    return programs.map((program) => ({
      ...program,
      items: counts.find((count) => count.programId === program.id)?.items ?? 0,
      lastSync: syncs.find((sync) => sync.programId === program.id) ?? null,
    }));
  }
}
