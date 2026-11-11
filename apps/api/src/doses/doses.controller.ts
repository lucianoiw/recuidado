import { Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { DosesService } from './doses.service.js';

@Controller('doses')
export class DosesController {
  constructor(private readonly doses: DosesService) {}

  /** "Tomei" button on the patient screen. */
  @Post(':id/confirm')
  @HttpCode(204)
  async confirm(@Param('id', ParseUUIDPipe) id: string) {
    await this.doses.confirmInApp(id);
  }
}
