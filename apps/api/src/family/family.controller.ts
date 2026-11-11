import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { FamilyService } from './family.service.js';
import { buyChoiceBody, medicationUpdateBody, onboardingBody } from './onboarding.schema.js';

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException(z.prettifyError(result.error));
  return result.data;
}

@Controller('family')
export class FamilyController {
  constructor(private readonly family: FamilyService) {}

  /** Demo family: patient, caregivers, medications and today's doses. No login yet. */
  @Get()
  overview() {
    return this.family.overview();
  }

  /** Alerts sent to the family (missed dose, not feeling well, running out), newest first. */
  @Get('alerts')
  alerts() {
    return this.family.alertHistory();
  }

  /** Sign-up answers saved by one caregiver (the id this device keeps). */
  @Get('onboarding')
  getOnboarding(@Query('caregiverId', new ParseUUIDPipe()) caregiverId: string) {
    return this.family.getOnboarding(caregiverId);
  }

  /** Saves the sign-up steps. Returns the caregiver id for this device to keep. */
  @Put('onboarding')
  saveOnboarding(@Body() body: unknown) {
    return this.family.saveOnboarding(parse(onboardingBody, body));
  }

  @Post('members/:id/join')
  @HttpCode(204)
  async join(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.family.join(id);
  }

  /** "Pegar grátis" or "Comprar" for a medication that is free in Farmácia Popular. */
  @Put('medications/:id/buy-choice')
  @HttpCode(204)
  async setBuyChoice(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    await this.family.setBuyChoice(id, parse(buyChoiceBody, body).buy);
  }

  /** Family edits the dose or the times of a medication. */
  @Patch('medications/:id')
  @HttpCode(204)
  async updateMedication(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    await this.family.updateMedication(id, parse(medicationUpdateBody, body));
  }

  /** Family stops a medication. */
  @Delete('medications/:id')
  @HttpCode(204)
  async removeMedication(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.family.removeMedication(id);
  }
}
