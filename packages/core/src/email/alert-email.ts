// The e-mail a caregiver gets for a family alert. The look is shared with the sign-in e-mails (layout.ts).
import { EMAIL_TAGLINE, emailLayout, type EmailTone } from './layout.js';

export type AlertEmailKind = 'dose_missed' | 'unwell' | 'low_stock' | 'emergency' | 'emergency_call' | 'check_in' | 'rotation_turn';

export interface AlertEmailInput {
  kind: AlertEmailKind;
  title: string;
  body: string;
  /** Absolute link to the page the alert opens in the family app. */
  link: string;
  /** Origin of the web app, for the logo. */
  webUrl: string;
}

export interface AlertEmail {
  subject: string;
  html: string;
  text: string;
}

// Label, color and button of each kind, as on the canvas page "E-mails".
const KINDS: Record<AlertEmailKind, { label: string; tone: EmailTone; button?: string }> = {
  dose_missed: { label: 'Dose não confirmada', tone: 'danger' },
  unwell: { label: 'Disse que não está bem', tone: 'warn' },
  low_stock: { label: 'Remédio acabando', tone: 'warn', button: 'Ver onde pegar grátis' },
  emergency: { label: 'Emergência', tone: 'urgent' },
  emergency_call: { label: 'Ligação para a família', tone: 'danger' },
  check_in: { label: 'Ligação de volta', tone: 'ok' },
  rotation_turn: { label: 'Vez de comprar', tone: 'brand', button: 'Ver o que comprar' },
};

const FOOTER = 'Você recebe este aviso porque cuida de alguém no Recuidado.';
const SAMU = 'Em emergência, ligue 192 (SAMU).';

export function alertEmail({ kind, title, body, link, webUrl }: AlertEmailInput): AlertEmail {
  const k = KINDS[kind];
  const emergency = kind === 'emergency';
  // The callback that nobody answered is a warning; the one where she says she is better is good news.
  const tone: EmailTone = kind === 'check_in' && /não atendeu/i.test(title) ? 'warn' : k.tone;
  const heading = title.replace(/^Urgente:\s*/, '');
  const button = k.button ?? 'Ver no Recuidado';
  const text = [title, '', body, '', ...(emergency ? [SAMU, ''] : []), `${button}: ${link}`, '', FOOTER, EMAIL_TAGLINE].join('\n');
  const html = emailLayout({
    webUrl,
    title: heading,
    body,
    badge: { label: k.label, tone },
    samu: emergency ? SAMU : undefined,
    button: { label: button, link, danger: emergency },
    footer: FOOTER,
  });
  return { subject: emergency ? `Urgente: ${heading}` : title, html, text };
}
