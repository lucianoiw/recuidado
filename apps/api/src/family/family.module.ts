import { Module } from '@nestjs/common';
import { DosesModule } from '../doses/doses.module.js';
import { FamilyController } from './family.controller.js';
import { FamilyService } from './family.service.js';

@Module({
  imports: [DosesModule],
  controllers: [FamilyController],
  providers: [FamilyService],
  exports: [FamilyService],
})
export class FamilyModule {}
