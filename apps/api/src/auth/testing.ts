import type { INestApplication } from '@nestjs/common';
import { setAuth, type AuthContext } from './auth.context.js';

/** Tests only: the JSON in the "x-test-auth" header becomes the request's AuthContext. */
export function useFakeAuth(app: INestApplication): void {
  app.use((req: { headers: Record<string, string | undefined> }, _res: unknown, next: () => void) => {
    const raw = req.headers['x-test-auth'];
    setAuth(req, raw ? (JSON.parse(raw) as AuthContext) : null);
    next();
  });
}

export const FAMILY = '0b6f2a4c-9d1e-4f3a-8c2b-5e7d9a1b3c4d';
export const CAREGIVER = '11111111-1111-4111-8111-111111111111';

export const caregiverAuth = (over: Partial<AuthContext> = {}) =>
  JSON.stringify({ kind: 'caregiver', sessionId: 's1', email: 'ana@exemplo.com', memberId: CAREGIVER, familyId: FAMILY, ...over });

export const patientAuth = () => JSON.stringify({ kind: 'patient', memberId: 'p1', familyId: FAMILY });
