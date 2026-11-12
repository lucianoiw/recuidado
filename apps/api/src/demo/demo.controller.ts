import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { FamilyId } from '../auth/auth.context.js';
import { DemoService } from './demo.service.js';

/**
 * Demo run button on the family app. Visitors run it on the demo family (no login); a signed-in
 * caregiver runs it on their own family. The call only goes out if the family gets calls (PlanGate).
 */
@Controller('demo/run')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Post()
  @HttpCode(200)
  start(@FamilyId({ write: true }) familyId: string | null) {
    return this.demo.start(familyId);
  }

  /** Stops the run: nothing else is sent, and the button is free for a new run. */
  @Delete(':doseId')
  @HttpCode(204)
  async stop(@Param('doseId', ParseUUIDPipe) doseId: string, @FamilyId({ write: true }) familyId: string | null) {
    await this.demo.stop(familyId, doseId);
  }

  @Get(':doseId')
  status(@Param('doseId', ParseUUIDPipe) doseId: string) {
    return this.demo.status(doseId);
  }
}
