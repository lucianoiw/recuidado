import { Controller, Get } from '@nestjs/common';
import { ProgramsService } from '@recuidado/core';

/** Public: the programs the app checks (official lists, not family data), their size and last refresh. */
@Controller('programs')
export class ProgramsController {
  constructor(private readonly programs: ProgramsService) {}

  @Get()
  list() {
    return this.programs.list();
  }
}
