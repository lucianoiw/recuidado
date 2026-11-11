import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module.js';
import { StockService } from './stock.service.js';

@Module({
  imports: [AlertsModule],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {}
