import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { PushService } from '@recuidado/core';

const subscribeBody = z.object({
  memberId: z.uuid(),
  subscription: z.object({
    endpoint: z.url(),
    keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  }),
});

const endpointBody = z.object({ endpoint: z.url() });
const testBody = z.object({ memberId: z.uuid() });

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException(z.prettifyError(result.error));
  return result.data;
}

@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('public-key')
  publicKey() {
    return { publicKey: this.push.publicKey ?? null };
  }

  @Post('subscriptions')
  @HttpCode(204)
  async subscribe(@Body() body: unknown) {
    const { memberId, subscription } = parse(subscribeBody, body);
    await this.push.subscribe(memberId, subscription);
  }

  @Delete('subscriptions')
  @HttpCode(204)
  async unsubscribe(@Body() body: unknown) {
    await this.push.unsubscribe(parse(endpointBody, body).endpoint);
  }

  /** Sends a test notification to one member, for the demo setup. */
  @Post('test')
  async test(@Body() body: unknown) {
    const { memberId } = parse(testBody, body);
    const sent = await this.push.sendToMembers([memberId], {
      title: 'Recuidado',
      body: 'Notificações ativadas. Você vai ser avisado por aqui.',
      url: '/',
    });
    return { sent };
  }
}
