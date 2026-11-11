import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_MODEL,
  PrescriptionReadError,
  readPrescription,
  type PrescriptionInput,
  type ReadPrescriptionResult,
} from '@recuidado/prescription-reader';
import { and, eq } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module.js';
import { medications, members } from '../db/schema.js';
import { DosesService } from '../doses/doses.service.js';
import { telemetry } from '../telemetry/telemetry.js';
import type { ConfirmPrescriptionBody } from './confirm.schema.js';

@Injectable()
export class PrescriptionsService {
  private client: Anthropic | undefined;

  constructor(
    private readonly config: ConfigService,
    @Inject(DB) private readonly db: Database,
    private readonly doses: DosesService,
  ) {}

  /** Reads a prescription photo or PDF and returns structured, normalized data. */
  async parse(input: PrescriptionInput): Promise<ReadPrescriptionResult> {
    const client = this.getClient();
    const traceId = randomUUID();
    const started = performance.now();
    const kind = input.mediaType === 'application/pdf' ? 'PDF' : 'foto';
    const base = {
      traceId,
      spanName: 'prescription_read',
      provider: 'anthropic',
      // The image itself is not sent to PostHog, only what it was.
      input: [{ role: 'user', content: `[${kind} da receita, ${Math.round(input.data.byteLength / 1024)} KB]` }],
      properties: { media_type: input.mediaType, bytes: input.data.byteLength },
    };
    try {
      const result = await readPrescription(input, { client });
      const latencySeconds = (performance.now() - started) / 1000;
      telemetry.llmGeneration({
        ...base,
        model: result.model,
        latencySeconds,
        inputTokens: result.usage.input_tokens,
        outputTokens: result.usage.output_tokens,
        output: [{ role: 'assistant', content: JSON.stringify(result.reading) }],
      });
      telemetry.capture('prescription_read', {
        $ai_trace_id: traceId,
        model: result.model,
        items: result.reading.items.length,
        latency_seconds: Math.round(latencySeconds * 10) / 10,
        input_tokens: result.usage.input_tokens,
        output_tokens: result.usage.output_tokens,
      });
      return result;
    } catch (error) {
      const code = error instanceof PrescriptionReadError ? error.code : 'api_error';
      telemetry.llmGeneration({
        ...base,
        model: DEFAULT_MODEL,
        latencySeconds: (performance.now() - started) / 1000,
        isError: true,
        error: String(error),
        properties: { ...base.properties, error_code: code },
      });
      telemetry.capture('prescription_read_failed', { $ai_trace_id: traceId, error_code: code });
      if (!(error instanceof PrescriptionReadError)) telemetry.captureException(error, { $ai_trace_id: traceId });
      throw error;
    }
  }

  /**
   * Saves the medicines the family confirmed and schedules their doses.
   * Times are stored exactly as confirmed; nothing is changed clinically.
   */
  async confirm(body: ConfirmPrescriptionBody) {
    const [patient] = await this.db
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.id, body.patientId), eq(members.role, 'patient')));
    if (!patient) throw new NotFoundException('Paciente não encontrado.');

    const saved = await this.db
      .insert(medications)
      .values(
        body.items.map((item) => ({
          patientId: patient.id,
          name: item.name,
          activeIngredient: item.activeIngredient,
          strength: item.strength,
          times: [...new Set(item.times)].sort(),
        })),
      )
      .returning({
        id: medications.id,
        name: medications.name,
        activeIngredient: medications.activeIngredient,
        strength: medications.strength,
        times: medications.times,
      });

    for (const medication of saved) {
      if (medication.times.length > 0)
        await this.doses.scheduleForMedication(medication.id);
    }
    telemetry.capture(
      'prescription_confirmed',
      { medications: saved.length, daily_doses: saved.reduce((n, m) => n + m.times.length, 0) },
      patient.id,
    );
    return { medications: saved };
  }

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
      if (!apiKey) {
        throw new ServiceUnavailableException(
          'Leitura de receita indisponível: ANTHROPIC_API_KEY não configurada.',
        );
      }
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }
}
