import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { MonthService } from './month.service.js';

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
  summary(@Query('familyId') familyId?: string) {
    return this.month.summary(familyOf(familyId));
  }

  /** A caregiver's share of this month: paid or not. */
  @Put('shares/:memberId/paid')
  @HttpCode(204)
  async setPaid(
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @Body() body: unknown,
    @Query('familyId') familyId?: string,
  ) {
    await this.month.setPaid(familyOf(familyId), memberId, parse(paidBody, body).paid);
  }

  /** Who buys the medicines and receives the others' shares by Pix. */
  @Put('members/:id/pix')
  @HttpCode(204)
  async setPixKey(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @Query('familyId') familyId?: string,
  ) {
    await this.month.setPixKey(familyOf(familyId), id, parse(pixKeyBody, body).pix);
  }
}
