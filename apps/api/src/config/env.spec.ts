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

  it('treats an empty VOICE_URL as unset', () => {
    expect(validateEnv({ ...base, VOICE_URL: '' }).VOICE_URL).toBeUndefined();
  });

  it('treats an empty ANTHROPIC_API_KEY as unset', () => {
    expect(
      validateEnv({ ...base, ANTHROPIC_API_KEY: '' }).ANTHROPIC_API_KEY,
    ).toBeUndefined();
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => validateEnv({ REDIS_URL: base.REDIS_URL })).toThrow(
      /DATABASE_URL/,
    );
  });
});
