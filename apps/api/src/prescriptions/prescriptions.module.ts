import { Module } from '@nestjs/common';
import { DosesModule } from '../doses/doses.module.js';
import { PrescriptionsController } from './prescriptions.controller.js';
import { PrescriptionsService } from './prescriptions.service.js';

@Module({
  imports: [DosesModule],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService],
})
export class PrescriptionsModule {}
