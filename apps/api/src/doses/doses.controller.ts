import { Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { DosesService } from '@recuidado/core';

@Controller('doses')
export class DosesController {
  constructor(private readonly doses: DosesService) {}

  /** "Tomei" button on the patient screen. */
  @Post(':id/confirm')
  @HttpCode(204)
  async confirm(@Param('id', ParseUUIDPipe) id: string) {
    await this.doses.confirmInApp(id);
  }

  /** "Não tomei" on the patient screen, for a dose of earlier today. */
  @Post(':id/not-taken')
  @HttpCode(204)
  async notTaken(@Param('id', ParseUUIDPipe) id: string) {
    await this.doses.notTakenInApp(id);
  }
}
