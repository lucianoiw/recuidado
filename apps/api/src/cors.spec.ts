import { corsOrigins } from './cors.js';

describe('corsOrigins', () => {
  it('allows the apex and the www origin', () => {
    expect(corsOrigins('https://recuidado.com.br')).toEqual([
      'https://recuidado.com.br',
      'https://www.recuidado.com.br',
    ]);
    expect(corsOrigins('https://www.recuidado.com.br/')).toEqual([
      'https://www.recuidado.com.br',
      'https://recuidado.com.br',
    ]);
  });

  it('accepts a comma-separated list and leaves localhost alone', () => {
    expect(corsOrigins('http://localhost:3000, https://a.com.br')).toEqual([
      'http://localhost:3000',
      'https://a.com.br',
      'https://www.a.com.br',
    ]);
  });
});
