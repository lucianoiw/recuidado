import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module.js';
import { DosesModule } from '../doses/doses.module.js';
import { StockModule } from '../stock/stock.module.js';
import { FamilyController } from './family.controller.js';
import { FamilyService } from './family.service.js';

@Module({
  imports: [DosesModule, StockModule, AlertsModule],
  controllers: [FamilyController],
  providers: [FamilyService],
  exports: [FamilyService],
})
export class FamilyModule {}
