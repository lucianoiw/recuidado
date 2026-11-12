import { Global, Injectable, Logger, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { ProgramsService } from '@recuidado/core';
import { ProgramsController } from './programs.controller.js';

/** Loads the shipped program lists into the database on boot (new or newer ones only). */
@Injectable()
export class ProgramsSeed implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProgramsSeed.name);

  constructor(private readonly programs: ProgramsService) {}

  async onApplicationBootstrap() {
    try {
      for (const result of await this.programs.loadSeeds()) {
        this.logger.log(`Programa ${result.programId}: ${result.status}, ${result.total} itens.`);
      }
    } catch (error) {
      // The answers fall back to the shipped files; the API must still start.
      this.logger.error(`Não carregou os programas no banco: ${String(error)}`);
    }
  }
}

@Global()
@Module({
  controllers: [ProgramsController],
  providers: [ProgramsService, ProgramsSeed],
  exports: [ProgramsService],
})
export class ProgramsModule {}
