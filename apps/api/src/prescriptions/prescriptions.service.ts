import Anthropic from '@anthropic-ai/sdk';
import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  readPrescription,
  type PrescriptionInput,
  type ReadPrescriptionResult,
} from '@recuidado/prescription-reader';
import { and, eq } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module.js';
import { medications, members } from '../db/schema.js';
import { DosesService } from '../doses/doses.service.js';
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
  parse(input: PrescriptionInput): Promise<ReadPrescriptionResult> {
    return readPrescription(input, { client: this.getClient() });
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
