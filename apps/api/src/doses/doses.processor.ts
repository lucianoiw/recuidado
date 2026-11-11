import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { VoiceCallService } from '../voice/voice.service.js';
import { telemetry } from '../telemetry/telemetry.js';
import { DOSES_QUEUE, type DoseJob } from './doses.queue.js';
import { DosesService } from './doses.service.js';

/** The only worker of the doses queue: every job kind goes through here. */
@Processor(DOSES_QUEUE)
export class DosesProcessor extends WorkerHost {
  private readonly logger = new Logger(DosesProcessor.name);

  constructor(
    private readonly doses: DosesService,
    private readonly voice: VoiceCallService,
  ) {
    super();
  }

  async process(job: Job<DoseJob>): Promise<void> {
    try {
      await this.run(job);
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

  private async run(job: Job<DoseJob>): Promise<void> {
    const data = job.data;
    switch (data.kind) {
      case 'plan':
        return this.doses.planAll();
      case 'remind':
        return this.doses.remind(data.doseId);
      case 'call':
        try {
          await this.voice.call(data.doseId);
        } catch (error) {
          // The family alert job still runs later.
          telemetry.captureException(error, { job_kind: 'call', dose_id: data.doseId });
          telemetry.capture('dose_call_failed', { dose_id: data.doseId, error: String(error) });
          this.logger.error(`Call for dose ${data.doseId} failed: ${String(error)}`);
        }
        return;
      case 'alert-family':
        return this.doses.alertFamily(data.doseId);
    }
  }
}
