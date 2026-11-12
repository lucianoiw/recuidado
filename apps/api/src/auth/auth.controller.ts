import { BadRequestException, Body, Controller, Get, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { PlanGate } from '@recuidado/core';
import { Auth, type AuthContext } from './auth.context.js';
import { AuthService } from './auth.service.js';

const email = z.email('E-mail inválido.').trim().toLowerCase().max(120);
const startBody = z.object({ email });
const verifyBody = z.union([
  z.object({ email, code: z.string().trim().regex(/^\d{6}$/, 'O código tem 6 números.') }),
  z.object({ link: z.string().min(16).max(200) }),
]);
const claimBody = z.object({ familyId: z.uuid(), name: z.string().trim().min(1).max(80) });

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException(z.prettifyError(result.error));
  return result.data;
}

function caregiver(auth: AuthContext | null): AuthContext & { kind: 'caregiver' } {
  if (auth?.kind !== 'caregiver') throw new UnauthorizedException('Entre com o seu e-mail.');
  return auth;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly plan: PlanGate,
  ) {}

  /** Sends the e-mail with the code and the link. */
  @Post('start')
  @HttpCode(204)
  @Throttle({ minute: { limit: 5, ttl: 60_000 } })
  async start(@Body() body: unknown) {
    await this.auth.start(parse(startBody, body).email);
  }

  /** Code typed in the app, or the link from the e-mail. Returns the session token. */
  @Post('verify')
  @HttpCode(200)
  @Throttle({ minute: { limit: 10, ttl: 60_000 } })
  verify(@Body() body: unknown) {
    return this.auth.verify(parse(verifyBody, body));
  }

  @Get('me')
  async me(@Auth() auth: AuthContext | null) {
    const me = await this.auth.me(caregiver(auth));
    // Whether this account gets calls (the paid part). Before the sign-up ends there is no family yet.
    const calls = me.familyId ? await this.plan.callsAllowed(me.familyId, false) : this.plan.includesEmail(me.email);
    return { ...me, calls };
  }

  @Post('sign-out')
  @HttpCode(204)
  async signOut(@Auth() auth: AuthContext | null) {
    if (auth?.kind === 'caregiver') await this.auth.signOut(auth.sessionId);
  }

  /** An invite shared by WhatsApp: the signed-in person takes the pending invite with their name. */
  @Post('claim-invite')
  @HttpCode(200)
  claim(@Auth() auth: AuthContext | null, @Body() body: unknown) {
    const { familyId, name } = parse(claimBody, body);
    return this.auth.claimInvite(caregiver(auth), familyId, name);
  }
}
