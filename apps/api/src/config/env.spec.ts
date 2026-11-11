import { validateEnv } from './env.js';

describe('validateEnv', () => {
  const base = {
    DATABASE_URL: 'postgres://u:p@localhost:5432/recuidado',
    REDIS_URL: 'redis://localhost:6379',
  };

  it('applies defaults', () => {
    const env = validateEnv(base);
    expect(env.PORT).toBe(4000);
    expect(env.DOSE_CALL_AFTER_MINUTES).toBe(15);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => validateEnv({ REDIS_URL: base.REDIS_URL })).toThrow(/DATABASE_URL/);
  });
});
