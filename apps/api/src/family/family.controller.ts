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
  UnauthorizedException,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { Auth, type AuthContext, CaregiverId, FamilyId } from '../auth/auth.context.js';
import { AuthService } from '../auth/auth.service.js';
import { FamilyService } from './family.service.js';
import { buyChoiceBody, highCostBody, medicationUpdateBody, onboardingBody } from './onboarding.schema.js';

/** Photos of the box or pill. The app shrinks them before sending; this is a ceiling. */
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException(z.prettifyError(result.error));
  return result.data;
}

@Controller('family')
export class FamilyController {
  constructor(
    private readonly family: FamilyService,
    private readonly auth: AuthService,
  ) {}

  /** Patient, caregivers, medications and today's doses of one family (the demo one without familyId). */
  @Get()
  overview(@FamilyId() familyId: string | null) {
    return this.family.overview(familyId);
  }

  /** A short stamp that changes when the doses, medicines or alerts change. Polled every few seconds. */
  @Get('changes')
  async changes(@FamilyId() familyId: string | null) {
    return { stamp: await this.family.changeStamp(familyId) };
  }

  /** Alerts sent to the family (missed dose, not feeling well, running out), newest first. */
  @Get('alerts')
  alerts(@FamilyId() familyId: string | null) {
    return this.family.alertHistory(familyId);
  }

  /** Sign-up answers of the signed-in caregiver. */
  @Get('onboarding')
  getOnboarding(@CaregiverId() caregiverId: string) {
    return this.family.getOnboarding(caregiverId);
  }

  /**
   * Saves the sign-up steps of the signed-in caregiver (e-mail from the session). The first save
   * creates the family and ties the session to the new caregiver. Invites with an e-mail get one.
   */
  @Put('onboarding')
  async saveOnboarding(@Auth() auth: AuthContext | null, @Body() body: unknown) {
    if (auth?.kind !== 'caregiver') throw new UnauthorizedException('Entre com o seu e-mail.');
    const saved = await this.family.saveOnboarding(parse(onboardingBody, body), auth.email, auth.memberId);
    if (!auth.memberId) await this.auth.attach(auth.sessionId, saved.caregiverId);
    for (const invite of saved.newInvites) {
      await this.auth.sendInvite(invite.email, saved.caregiverName, saved.patientName);
    }
    return { caregiverId: saved.caregiverId, familyId: saved.familyId };
  }

  /** The link that opens her app on her phone, without sign-up. `renew` stops the old link. */
  @Post('patient-link')
  @HttpCode(200)
  async patientLink(@FamilyId({ write: true }) familyId: string | null, @Body() body: unknown) {
    const ref = await this.family.writableFamily(familyId);
    const renew = (body as { renew?: unknown } | null)?.renew === true;
    return { token: await this.auth.patientToken(ref.patientId, renew) };
  }

  /** The one caregiver phoned when she reports an emergency on the call. */
  @Put('members/:id/emergency-contact')
  @HttpCode(204)
  async setEmergencyContact(@Param('id', new ParseUUIDPipe()) id: string, @FamilyId({ write: true }) familyId: string | null) {
    await this.family.setEmergencyContact(familyId, id);
  }

  /** "Pegar grátis" or "Comprar" for a medication that is free in Farmácia Popular. */
  @Put('medications/:id/buy-choice')
  @HttpCode(204)
  async setBuyChoice(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @FamilyId({ write: true }) familyId: string | null,
  ) {
    await this.family.setBuyChoice(familyId, id, parse(buyChoiceBody, body).buy);
  }

  /** Family edits the dose or the times of a medication. */
  @Patch('medications/:id')
  @HttpCode(204)
  async updateMedication(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @FamilyId({ write: true }) familyId: string | null,
  ) {
    await this.family.updateMedication(familyId, id, parse(medicationUpdateBody, body));
  }

  /** Alto Custo (CEAF) path of a medication: SES-SP checklist, saved progress and deadlines. */
  @Get('medications/:id/high-cost')
  highCost(@Param('id', new ParseUUIDPipe()) id: string, @FamilyId() familyId: string | null) {
    return this.family.highCost(familyId, id);
  }

  /** Family ticks what it already has and tells the LME and approval dates. */
  @Put('medications/:id/high-cost')
  @HttpCode(204)
  async saveHighCost(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @FamilyId({ write: true }) familyId: string | null,
  ) {
    await this.family.saveHighCost(familyId, id, parse(highCostBody, body));
  }

  /** Photo of the real box or pill (multipart, field "file"). Her screen shows only this photo. */
  @Put('medications/:id/photo')
  @HttpCode(204)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } }))
  async setMedicationPhoto(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
    @FamilyId({ write: true }) familyId: string | null,
  ) {
    if (!file) throw new BadRequestException('Envie a foto no campo "file".');
    if (!PHOTO_TYPES.has(file.mimetype)) throw new UnsupportedMediaTypeException('Envie uma foto JPG, PNG ou WEBP.');
    await this.family.setMedicationPhoto(familyId, id, { data: file.buffer, contentType: file.mimetype });
  }

  /** Removes the photo: her screen shows name, dose and time only. */
  @Delete('medications/:id/photo')
  @HttpCode(204)
  async removeMedicationPhoto(@Param('id', new ParseUUIDPipe()) id: string, @FamilyId({ write: true }) familyId: string | null) {
    await this.family.removeMedicationPhoto(familyId, id);
  }

  /** Family removes a medication from her list. Kept, with its history, as stopped. */
  @Delete('medications/:id')
  @HttpCode(204)
  async removeMedication(@Param('id', new ParseUUIDPipe()) id: string, @FamilyId({ write: true }) familyId: string | null) {
    await this.family.removeMedication(familyId, id);
  }
}
