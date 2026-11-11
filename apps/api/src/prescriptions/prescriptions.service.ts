import Anthropic from '@anthropic-ai/sdk';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  readPrescription,
  type PrescriptionInput,
  type ReadPrescriptionResult,
} from '@recuidado/prescription-reader';

@Injectable()
export class PrescriptionsService {
  private client: Anthropic | undefined;

  constructor(private readonly config: ConfigService) {}

  /** Reads a prescription photo or PDF and returns structured, normalized data. */
  parse(input: PrescriptionInput): Promise<ReadPrescriptionResult> {
    return readPrescription(input, { client: this.getClient() });
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
