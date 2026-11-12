import { Module } from '@nestjs/common';
import { RotationService } from '@recuidado/core';
import { AlertsModule } from '../alerts/alerts.module.js';
import { DosesModule } from '../doses/doses.module.js';
import { StockModule } from '../stock/stock.module.js';
import { FamilyController } from './family.controller.js';
import { FamilyService } from './family.service.js';
import { MonthController } from './month.controller.js';
import { MonthService } from './month.service.js';

@Module({
  imports: [DosesModule, StockModule, AlertsModule],
  controllers: [FamilyController, MonthController],
  providers: [FamilyService, MonthService, RotationService],
  exports: [FamilyService],
})
export class FamilyModule {}
