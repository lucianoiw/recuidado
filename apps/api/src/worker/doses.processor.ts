import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job } from 'bullmq';
import { MAX_CHECK_INS, VoiceCallService } from '../voice/voice.service.js';
import { telemetry } from '../telemetry/telemetry.js';
import { DOSES_QUEUE, type DoseJob } from '../doses/doses.queue.js';
import { DosesService } from '../doses/doses.service.js';

/** The only worker of the doses queue: every job kind goes through here. */
@Processor(DOSES_QUEUE)
export class DosesProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(DosesProcessor.name);

  constructor(
    private readonly doses: DosesService,
    private readonly voice: VoiceCallService,
  ) {
    super();
  }

  /** The hourly dose planner lives with the queue it feeds. */
  async onApplicationBootstrap() {
    await this.doses.schedulePlanner();
  }

  async process(job: Job<DoseJob>): Promise<string | void> {
    try {
      return await this.run(job);
    } catch (error) {
      telemetry.captureException(error, {
        job_kind: job.data.kind,
        job_id: job.id,
        dose_id: 'doseId' in job.data ? job.data.doseId : undefined,
        attempt: job.attemptsMade + 1,
      });
      throw error;
    }
  }

  /** A 'call' job returns 'called', 'skipped' or 'failed' (read by the demo run status). */
  private async run(job: Job<DoseJob>): Promise<string | void> {
    const data = job.data;
    switch (data.kind) {
      case 'plan':
        return this.doses.planAll();
      case 'remind':
        return this.doses.remind(data.doseId, { callAfterMs: data.callAfterMs, alertAfterMs: data.alertAfterMs });
      case 'call':
        try {
          return (await this.voice.call(data.doseId)) ? 'called' : 'skipped';
        } catch (error) {
          // The family alert job still runs later.
          telemetry.captureException(error, { job_kind: 'call', dose_id: data.doseId });
          telemetry.capture('dose_call_failed', { dose_id: data.doseId, error: String(error) });
          this.logger.error(`Call for dose ${data.doseId} failed: ${String(error)}`);
          return 'failed';
        }
      case 'alert-family':
        return this.doses.alertFamily(data.doseId);
      case 'recall':
        try {
          return (await this.voice.call(data.doseId, { recall: true })) ? 'called' : 'skipped';
        } catch (error) {
          // The family alert job still runs later.
          telemetry.captureException(error, { job_kind: 'recall', dose_id: data.doseId });
          return 'failed';
        }
      case 'check-in':
        try {
          return (await this.voice.call(data.doseId, { checkIn: true, callBack: (data.attempt ?? 1) < MAX_CHECK_INS }))
            ? 'called'
            : 'skipped';
        } catch (error) {
          telemetry.captureException(error, { job_kind: 'check-in', dose_id: data.doseId });
          return 'failed';
        }
    }
  }
}
