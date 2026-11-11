/**
 * Static Pix "copia e cola" (BR Code, EMV QR Code MPM) as defined by the
 * Banco Central "Manual de Padrões para Iniciação do Pix". No bank or PSP is
 * involved: the app only writes the text the payer pastes in their bank app.
 */

export type PixKeyType = 'cpf' | 'phone' | 'email' | 'random';

const EVP = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  const check = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(digits[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

/** The key as the Pix network expects it, or null when it is not valid for its type. */
export function normalizePixKey(type: PixKeyType, raw: string): string | null {
  const text = raw.trim();
  switch (type) {
    case 'cpf': {
      const digits = text.replace(/\D/g, '');
      return validCpf(digits) ? digits : null;
    }
    case 'phone': {
      let digits = text.replace(/\D/g, '');
      if (digits.length >= 12 && digits.startsWith('55')) digits = digits.slice(2);
      // DDD + 9 digit mobile number.
      return /^[1-9]{2}9\d{8}$/.test(digits) ? `+55${digits}` : null;
    }
    case 'email': {
      const email = text.toLowerCase();
      return email.length <= 77 && EMAIL.test(email) ? email : null;
    }
    case 'random': {
      const key = text.toLowerCase();
      return EVP.test(key) ? key : null;
    }
  }
}

/** Kind of a normalized key, for the screens. */
export function pixKeyType(key: string): PixKeyType {
  if (key.startsWith('+55')) return 'phone';
  if (key.includes('@')) return 'email';
  if (/^\d{11}$/.test(key)) return 'cpf';
  return 'random';
}

/** Uppercase ASCII without accents, as banks print the receiver name. */
function plain(text: string, max: number): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, max)
    .trim();
}

function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

/** CRC16-CCITT-FALSE (poly 0x1021, init 0xFFFF), 4 uppercase hex digits. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(payload, 'utf8')) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface PixInput {
  key: string;
  /** Receiver name; cut to 25 characters. */
  name: string;
  /** Receiver city; cut to 15 characters. */
  city: string;
  amountCents: number;
  /** Shown in the payer's bank app, e.g. "Remedios novembro". */
  description?: string;
  /** Up to 25 letters and digits; "***" when none. */
  txid?: string;
}

/** The "copia e cola" text of a static Pix with a fixed amount. */
export function pixCopyPaste(input: PixInput): string {
  const description = input.description ? plain(input.description, 40) : '';
  const base = field('00', 'br.gov.bcb.pix') + field('01', input.key);
  // The merchant account field holds at most 99 characters: the description goes first.
  const withDescription = description ? base + field('02', description) : base;
  const account = withDescription.length <= 99 ? withDescription : base;
  const txid = (input.txid ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const payload =
    field('00', '01') +
    field('26', account) +
    field('52', '0000') +
    field('53', '986') +
    (input.amountCents > 0 ? field('54', (input.amountCents / 100).toFixed(2)) : '') +
    field('58', 'BR') +
    field('59', plain(input.name, 25) || 'RECEBEDOR') +
    field('60', plain(input.city, 15) || 'BRASIL') +
    field('62', field('05', txid)) +
    '6304';
  return payload + crc16(payload);
}
