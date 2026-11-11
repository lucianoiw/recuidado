import { timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/** Accepts only requests carrying `Authorization: Bearer $VOICE_API_TOKEN`. */
@Injectable()
export class VoiceTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('VOICE_API_TOKEN');
    if (!expected) throw new ServiceUnavailableException('VOICE_API_TOKEN não configurado.');
    const header = context.switchToHttp().getRequest<Request>().headers.authorization ?? '';
    const given = Buffer.from(header.replace(/^Bearer\s+/i, ''));
    const want = Buffer.from(expected);
    if (given.length !== want.length || !timingSafeEqual(given, want)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
