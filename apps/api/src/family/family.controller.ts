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
import { buyChoiceBody, highCostBody, medicationUpdateBody, onboardingBody } from './onboarding.schema.js';

// The family this device saved at sign-up. Missing means the demo family.
const familyIdQuery = z.uuid().nullish();

function familyOf(value: unknown): string | null {
  const result = familyIdQuery.safeParse(value || null);
  if (!result.success) throw new BadRequestException('familyId inválido.');
  return result.data ?? null;
}

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException(z.prettifyError(result.error));
  return result.data;
}

@Controller('family')
export class FamilyController {
  constructor(private readonly family: FamilyService) {}

  /** Patient, caregivers, medications and today's doses of one family (the demo one without familyId). */
  @Get()
  overview(@Query('familyId') familyId?: string) {
    return this.family.overview(familyOf(familyId));
  }

  /** Alerts sent to the family (missed dose, not feeling well, running out), newest first. */
  @Get('alerts')
  alerts(@Query('familyId') familyId?: string) {
    return this.family.alertHistory(familyOf(familyId));
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
  async join(@Param('id', new ParseUUIDPipe()) id: string, @Query('familyId') familyId?: string) {
    await this.family.join(familyOf(familyId), id);
  }

  /** The one caregiver phoned when she reports an emergency on the call. */
  @Put('members/:id/emergency-contact')
  @HttpCode(204)
  async setEmergencyContact(@Param('id', new ParseUUIDPipe()) id: string, @Query('familyId') familyId?: string) {
    await this.family.setEmergencyContact(familyOf(familyId), id);
  }

  /** "Pegar grátis" or "Comprar" for a medication that is free in Farmácia Popular. */
  @Put('medications/:id/buy-choice')
  @HttpCode(204)
  async setBuyChoice(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @Query('familyId') familyId?: string,
  ) {
    await this.family.setBuyChoice(familyOf(familyId), id, parse(buyChoiceBody, body).buy);
  }

  /** Family edits the dose or the times of a medication. */
  @Patch('medications/:id')
  @HttpCode(204)
  async updateMedication(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @Query('familyId') familyId?: string,
  ) {
    await this.family.updateMedication(familyOf(familyId), id, parse(medicationUpdateBody, body));
  }

  /** Alto Custo (CEAF) path of a medication: SES-SP checklist, saved progress and deadlines. */
  @Get('medications/:id/high-cost')
  highCost(@Param('id', new ParseUUIDPipe()) id: string, @Query('familyId') familyId?: string) {
    return this.family.highCost(familyOf(familyId), id);
  }

  /** Family ticks what it already has and tells the LME and approval dates. */
  @Put('medications/:id/high-cost')
  @HttpCode(204)
  async saveHighCost(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @Query('familyId') familyId?: string,
  ) {
    await this.family.saveHighCost(familyOf(familyId), id, parse(highCostBody, body));
  }

  /** Family stops a medication. */
  @Delete('medications/:id')
  @HttpCode(204)
  async removeMedication(@Param('id', new ParseUUIDPipe()) id: string, @Query('familyId') familyId?: string) {
    await this.family.removeMedication(familyOf(familyId), id);
  }
}
