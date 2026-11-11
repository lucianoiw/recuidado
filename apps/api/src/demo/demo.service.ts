import { InjectQueue } from '@nestjs/bullmq';
import { ConflictException, Inject, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job, Queue } from 'bullmq';
import { asc, desc, eq } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module.js';
import { doses, medications, voiceCalls } from '../db/schema.js';
import { DOSES_QUEUE, doseJobId, type DoseJob } from '../doses/doses.queue.js';
import { FamilyService } from '../family/family.service.js';
import { telemetry } from '../telemetry/telemetry.js';
import { demoSteps, type JobInfo, type JobState } from './demo.steps.js';

const KEEP_FINISHED = { removeOnComplete: { age: 24 * 3600 }, removeOnFail: { age: 24 * 3600 } };
// One run at a time: a second press while a run is going follows the same run.
const RUN_LOCK_MS = 4 * 60 * 1000;

/**
 * Demo run for the jury and the video: one extra dose of the demo patient, due now,
 * goes through the real flow (push, real call by apps/voice, family push) with waits in seconds.
 * Uses the same doses queue and job ids as real doses, so the worker and the schedule are untouched.
 */
@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);
  private current: { doseId: string; until: number } | null = null;

  constructor(
    @Inject(DB) private readonly db: Database,
    @InjectQueue(DOSES_QUEUE) private readonly queue: Queue<DoseJob>,
    private readonly family: FamilyService,
    private readonly config: ConfigService,
  ) {}

  async start(now = new Date()): Promise<{ doseId: string; alreadyRunning: boolean }> {
    if (!this.config.get<boolean>('DEMO_RUN_ENABLED')) {
      throw new ServiceUnavailableException('A demo está desligada neste servidor.');
    }
    if (this.current && this.current.until > now.getTime()) {
      return { doseId: this.current.doseId, alreadyRunning: true };
    }

    const { patientId } = await this.family.ensureDemoFamily();
    const [med] = await this.db
      .select({ id: medications.id, name: medications.name })
      .from(medications)
      .where(eq(medications.patientId, patientId))
      .orderBy(asc(medications.createdAt))
      .limit(1);
    if (!med) throw new ConflictException('Adicione pelo menos um remédio antes de rodar a demo.');

    // Exact instant with milliseconds: never clashes with a scheduled dose (unique medication + time).
    const [dose] = await this.db
      .insert(doses)
      .values({ medicationId: med.id, scheduledAt: now, demo: true })
      .returning({ id: doses.id });
    this.current = { doseId: dose.id, until: now.getTime() + RUN_LOCK_MS };

    const second = 1000;
    await this.queue.add(
      'remind',
      {
        kind: 'remind',
        doseId: dose.id,
        callAfterMs: this.config.getOrThrow<number>('DEMO_CALL_AFTER_SECONDS') * second,
        alertAfterMs: this.config.getOrThrow<number>('DEMO_ALERT_AFTER_SECONDS') * second,
      },
      { jobId: doseJobId('remind', dose.id), ...KEEP_FINISHED },
    );
    telemetry.capture('demo_run_started', { dose_id: dose.id, medication: med.name, demo: true }, patientId);
    this.logger.log(`Demo run started with dose ${dose.id}.`);
    return { doseId: dose.id, alreadyRunning: false };
  }

  /** Where the run is: reminder, call and family alert. */
  async status(doseId: string) {
    const [dose] = await this.db
      .select({
        status: doses.status,
        scheduledAt: doses.scheduledAt,
        confirmedVia: doses.confirmedVia,
        familyAlertedAt: doses.familyAlertedAt,
      })
      .from(doses)
      .where(eq(doses.id, doseId));
    if (!dose) throw new NotFoundException('Demo não encontrada.');
    const [lastCall] = await this.db
      .select({ outcome: voiceCalls.outcome, note: voiceCalls.note, transcript: voiceCalls.transcript })
      .from(voiceCalls)
      .where(eq(voiceCalls.doseId, doseId))
      .orderBy(desc(voiceCalls.createdAt))
      .limit(1);
    const [remind, call, alert] = await Promise.all(
      (['remind', 'call', 'alert-family'] as const).map((kind) => this.jobInfo(doseJobId(kind, doseId))),
    );
    return {
      doseId,
      startedAt: dose.scheduledAt,
      status: dose.status,
      ...demoSteps({ dose, remind, call, alert, lastCall: lastCall ?? null }),
      transcript: lastCall?.transcript ?? [],
    };
  }

  private async jobInfo(jobId: string): Promise<JobInfo> {
    const job = (await this.queue.getJob(jobId)) as Job<DoseJob> | undefined;
    if (!job) return { state: null, runAt: null, returnValue: undefined };
    const state = (await job.getState()) as JobState;
    return {
      state,
      runAt: state === 'delayed' ? job.timestamp + job.delay : null,
      returnValue: job.returnvalue,
    };
  }
}
