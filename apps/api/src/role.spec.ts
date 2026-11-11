import { describe, expect, it } from 'vitest';
import { appRole, runsApi, runsWorker } from './role.js';

describe('APP_ROLE', () => {
  it('runs both by default and one side when set', () => {
    expect(appRole({})).toBe('all');
    expect(runsApi({}) && runsWorker({})).toBe(true);
    expect(runsWorker({ APP_ROLE: 'api' })).toBe(false);
    expect(runsApi({ APP_ROLE: 'api' })).toBe(true);
    expect(runsApi({ APP_ROLE: 'worker' })).toBe(false);
    expect(runsWorker({ APP_ROLE: ' Worker ' })).toBe(true);
    expect(appRole({ APP_ROLE: 'other' })).toBe('all');
  });
});
