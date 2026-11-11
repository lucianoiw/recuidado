import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { FamilyId } from '../auth/auth.context.js';
import { z } from 'zod';
import { MonthService } from './month.service.js';


function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException(z.prettifyError(result.error));
  return result.data;
}

export const paidBody = z.object({ paid: z.boolean() });

/** key null removes the Pix key of this caregiver. */
export const pixKeyBody = z.object({
  pix: z
    .object({
      type: z.enum(['cpf', 'phone', 'email', 'random']),
      key: z.string().trim().min(1, 'Informe a chave Pix.').max(80),
    })
    .nullable(),
});

@Controller('family')
export class MonthController {
  constructor(private readonly month: MonthService) {}

  /** Savings, cost, split with Pix and doses of the current month. */
  @Get('month')
  summary(@FamilyId() familyId: string | null) {
    return this.month.summary(familyId);
  }

  /** A caregiver's share of this month: paid or not. */
  @Put('shares/:memberId/paid')
  @HttpCode(204)
  async setPaid(
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @Body() body: unknown,
    @FamilyId({ write: true }) familyId: string | null,
  ) {
    await this.month.setPaid(familyId, memberId, parse(paidBody, body).paid);
  }

  /** Who buys the medicines and receives the others' shares by Pix. */
  @Put('members/:id/pix')
  @HttpCode(204)
  async setPixKey(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @FamilyId({ write: true }) familyId: string | null,
  ) {
    await this.month.setPixKey(familyId, id, parse(pixKeyBody, body).pix);
  }
}
