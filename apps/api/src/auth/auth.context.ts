import { createParamDecorator, ForbiddenException, type ExecutionContext, UnauthorizedException } from '@nestjs/common';

/** Who is calling, from the Authorization header. Missing: a visitor, who sees the demo family. */
export type AuthContext =
  | {
      kind: 'caregiver';
      sessionId: string;
      email: string;
      /** Empty between the first sign-in and the end of the sign-up. */
      memberId: string | null;
      familyId: string | null;
    }
  | {
      /** Opened the link the family sent to her phone. No sign-up, read and confirm only. */
      kind: 'patient';
      memberId: string;
      familyId: string;
    };

const KEY = Symbol('recuidado.auth');

export function setAuth(req: object, auth: AuthContext | null): void {
  (req as Record<symbol, unknown>)[KEY] = auth;
}

export function authOf(req: object): AuthContext | null {
  return ((req as Record<symbol, unknown>)[KEY] as AuthContext | null | undefined) ?? null;
}

/** The request's AuthContext, or null for a visitor. */
export const Auth = createParamDecorator((_: unknown, ctx: ExecutionContext) => authOf(ctx.switchToHttp().getRequest()));

/**
 * The family the request works on: the signed-in caregiver's, or the patient's from her link.
 * Null means the demo family (visitors). `write: true` refuses the patient link: her app only reads
 * and confirms doses.
 */
export const FamilyId = createParamDecorator((options: { write?: boolean } | undefined, ctx: ExecutionContext) => {
  const auth = authOf(ctx.switchToHttp().getRequest());
  if (!auth) return null;
  if (auth.kind === 'patient' && options?.write) throw new ForbiddenException('Só a família muda isso.');
  return auth.familyId;
});

/** The signed-in caregiver's member id. 401 without a session or before the sign-up ends. */
export const CaregiverId = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const auth = authOf(ctx.switchToHttp().getRequest());
  if (auth?.kind !== 'caregiver' || !auth.memberId) throw new UnauthorizedException('Entre com o seu e-mail.');
  return auth.memberId;
});
