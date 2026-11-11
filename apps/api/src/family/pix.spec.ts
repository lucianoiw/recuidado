import { crc16, normalizePixKey, pixCopyPaste, pixKeyType } from './pix.js';
import { splitEqually } from './month.service.js';

describe('pix', () => {
  it('computes the CRC of the Banco Central example', () => {
    const payload =
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-426655440000' +
      '5204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
    expect(crc16(payload)).toBe('1D3D');
  });

  it('writes a static Pix with amount, name, city and a valid CRC', () => {
    const code = pixCopyPaste({
      key: 'ana@example.com',
      name: 'Ana Lúcia de Souza Pereira Gomes',
      city: 'São Paulo',
      amountCents: 4321,
      description: 'Remédios Dona Maria',
      txid: 'RECUIDADO2026-11',
    });
    expect(code).toContain('0014br.gov.bcb.pix0115ana@example.com');
    expect(code).toContain('540543.21');
    expect(code).toContain('5925ANA LUCIA DE SOUZA PEREIR6009');
    expect(code).toContain('6009SAO PAULO');
    expect(code).toContain('0515RECUIDADO202611');
    expect(code.slice(-4)).toBe(crc16(code.slice(0, -4)));
  });

  it('validates and normalizes keys', () => {
    expect(normalizePixKey('cpf', '529.982.247-25')).toBe('52998224725');
    expect(normalizePixKey('cpf', '111.111.111-11')).toBeNull();
    expect(normalizePixKey('phone', '(11) 91234-5678')).toBe('+5511912345678');
    expect(normalizePixKey('phone', '1112345678')).toBeNull();
    expect(normalizePixKey('email', ' Ana@Example.com ')).toBe('ana@example.com');
    expect(normalizePixKey('random', '123E4567-E12B-12D1-A456-426655440000')).toBe(
      '123e4567-e12b-12d1-a456-426655440000',
    );
    expect(pixKeyType('+5511912345678')).toBe('phone');
    expect(pixKeyType('52998224725')).toBe('cpf');
  });

  it('splits a total without losing cents', () => {
    expect(splitEqually(1000, 3)).toEqual([334, 333, 333]);
    expect(splitEqually(0, 2)).toEqual([0, 0]);
    expect(splitEqually(500, 0)).toEqual([]);
  });
});
