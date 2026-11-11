import { Module } from '@nestjs/common';
import { MedicationsController } from './medications.controller.js';

@Module({ controllers: [MedicationsController] })
export class MedicationsModule {}
