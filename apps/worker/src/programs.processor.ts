import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { fetchOfficialPrograms } from '@recuidado/data';
import {
  PROGRAMS_QUEUE,
  PROGRAMS_SYNC_CRON,
  PROGRAMS_SYNC_TZ,
  ProgramsService,
  telemetry,
  type ProgramsJob,
  type SyncResult,
} from '@recuidado/core';

/**
 * Monthly refresh of the free-medicine programs: reads the official lists again (Farmácia Popular,
 * REMUME, Alto Custo via Remédio SP) and keeps what changed. A source that fails keeps its last list.
 */
@Processor(PROGRAMS_QUEUE)
export class ProgramsProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProgramsProcessor.name);

  constructor(
    private readonly programs: ProgramsService,
    @InjectQueue(PROGRAMS_QUEUE) private readonly queue: Queue<ProgramsJob>,
  ) {
    super();
  }

  async onApplicationBootstrap() {
    await this.queue.upsertJobScheduler(
      'sync-programs',
      { pattern: PROGRAMS_SYNC_CRON, tz: PROGRAMS_SYNC_TZ },
      { name: 'sync', data: { kind: 'sync' }, opts: { removeOnComplete: 24, removeOnFail: 24 } },
    );
    // Once per month also right after a deploy, so a new install does not wait for day 2. The job id
    // repeats within the month, so restarts do not read the sources again. Retries wait for the API's
    // migrations on a first boot.
    await this.queue.add(
      'sync',
      { kind: 'sync' },
      {
        jobId: `sync-programs-${new Date().toISOString().slice(0, 7)}`,
        delay: 2 * 60_000,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5 * 60_000 },
        removeOnComplete: 24,
        removeOnFail: 24,
      },
    );
  }

  async process(_job: Job<ProgramsJob>): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    for (const fetched of await fetchOfficialPrograms()) {
      const result = fetched.file
        ? await this.programs.apply(fetched.file, 'source')
        : await this.programs.recordFailure(fetched.programId, fetched.error ?? 'sem resposta');
      for (const warning of fetched.warnings) this.logger.warn(`${fetched.programId}: ${warning}`);
      telemetry.capture('programs_synced', { program: result.programId, status: result.status, added: result.added, removed: result.removed, changed: result.changed, total: result.total });
      results.push(result);
    }
    this.logger.log(results.map((r) => `${r.programId} ${r.status} (+${r.added} -${r.removed} ~${r.changed})`).join(', '));
    return results;
  }
}
