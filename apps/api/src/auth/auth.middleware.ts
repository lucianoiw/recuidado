import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import { and, eq, gt } from 'drizzle-orm';
import { type Database, DB, members, sessions } from '@recuidado/core';
import { setAuth, type AuthContext } from './auth.context.js';
import { sha256 } from './tokens.js';

/**
 * Reads "Authorization: Bearer <token>". "s." tokens are caregiver sessions, "p." tokens are the
 * patient link. An unknown or expired token counts as a visitor (demo family), never an error,
 * so a stale device still opens.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(@Inject(DB) private readonly db: Database) {}

  async use(req: { headers: Record<string, string | string[] | undefined> }, _res: unknown, next: (e?: unknown) => void) {
    try {
      setAuth(req, await this.resolve(req.headers.authorization));
      next();
    } catch (error) {
      next(error);
    }
  }

  async resolve(header: string | string[] | undefined): Promise<AuthContext | null> {
    const value = Array.isArray(header) ? header[0] : header;
    const token = value?.startsWith('Bearer ') ? value.slice(7).trim() : '';
    if (token.startsWith('s.')) {
      const [row] = await this.db
        .select({ id: sessions.id, email: sessions.email, memberId: sessions.memberId, familyId: members.familyId })
        .from(sessions)
        .leftJoin(members, eq(members.id, sessions.memberId))
        .where(and(eq(sessions.tokenHash, sha256(token.slice(2))), gt(sessions.expiresAt, new Date())));
      if (!row) return null;
      return { kind: 'caregiver', sessionId: row.id, email: row.email, memberId: row.memberId, familyId: row.familyId };
    }
    if (token.startsWith('p.')) {
      const [row] = await this.db
        .select({ id: members.id, familyId: members.familyId })
        .from(members)
        .where(and(eq(members.accessToken, token.slice(2)), eq(members.role, 'patient')));
      if (!row) return null;
      return { kind: 'patient', memberId: row.id, familyId: row.familyId };
    }
    return null;
  }
}
