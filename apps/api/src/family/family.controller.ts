import { Controller, Get } from '@nestjs/common';
import { FamilyService } from './family.service.js';

@Controller('family')
export class FamilyController {
  constructor(private readonly family: FamilyService) {}

  /** Demo family: patient, caregivers, medications and today's doses. No login yet. */
  @Get()
  overview() {
    return this.family.overview();
  }
}
