import { Module } from '@nestjs/common';
import { FamilyModule } from '../family/family.module.js';
import { VoiceModule } from '../voice/voice.module.js';
import { VoiceTokenGuard } from '../voice/voice-token.guard.js';
import { PharmacyController } from './pharmacy.controller.js';
import { PharmacyService } from './pharmacy.service.js';

/** Voice calls to a pharmacy asking stock, price and Farmácia Popular. */
@Module({
  imports: [FamilyModule, VoiceModule],
  controllers: [PharmacyController],
  providers: [PharmacyService, VoiceTokenGuard],
})
export class PharmacyModule {}
