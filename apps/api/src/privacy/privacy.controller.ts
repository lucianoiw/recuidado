import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { PrivacyService } from './privacy.service.js';

const consentBody = z.object({ accepted: z.boolean() });

/**
 * LGPD rights. There is no login yet: the caregiver id this device saved at sign-up
 * (the same id that restores the sign-up form) is what proves it is the family.
 */
@Controller('privacy')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  /** The patient accepts or takes back reminders, calls and the family seeing her doses. */
  @Put('consent/:patientId')
  @HttpCode(204)
  async consent(@Param('patientId', new ParseUUIDPipe()) patientId: string, @Body() body: unknown) {
    const parsed = consentBody.safeParse(body);
    if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
    await this.privacy.setPatientConsent(patientId, parsed.data.accepted);
  }

  /** All data of the caregiver's family, as a JSON download. */
  @Get('export')
  @Header('Cache-Control', 'no-store')
  @Header('Content-Disposition', 'attachment; filename="recuidado-dados.json"')
  export(@Query('caregiverId', new ParseUUIDPipe()) caregiverId: string) {
    return this.privacy.exportFamily(caregiverId);
  }

  /** Deletes the caregiver's family and everything under it. Cannot be undone. */
  @Delete('family')
  @HttpCode(204)
  async deleteFamily(@Query('caregiverId', new ParseUUIDPipe()) caregiverId: string) {
    await this.privacy.deleteFamily(caregiverId);
  }
}
