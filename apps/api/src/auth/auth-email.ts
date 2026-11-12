// Sign-in and invite e-mails, with the same look as the family alerts (packages/core email/layout.ts).
import { EMAIL_TAGLINE, emailLayout } from '@recuidado/core';

export interface AuthEmail {
  subject: string;
  html: string;
  text: string;
}

export function signInEmail({ code, link, webUrl }: { code: string; link: string; webUrl: string }): AuthEmail {
  const title = 'Seu código para entrar';
  const body = 'Digite o código no Recuidado ou toque no botão. Ele vale por 15 minutos.';
  const footer = 'Se não foi você que pediu, ignore este e-mail. Ninguém entra sem o código.';
  return {
    subject: `${code} é o seu código do Recuidado`,
    html: emailLayout({ webUrl, title, body, code, button: { label: 'Entrar no Recuidado', link }, footer }),
    text: [title, '', body, '', `Código: ${code}`, '', `Ou entre por aqui: ${link}`, '', footer, EMAIL_TAGLINE].join('\n'),
  };
}

/** A caregiver invited someone to care together. The button signs the person in. */
export function inviteEmail({ from, patient, link, webUrl }: { from: string; patient: string; link: string; webUrl: string }): AuthEmail {
  const title = `${from} chamou você para cuidar de ${patient}`;
  const body = `No Recuidado a família acompanha os remédios de ${patient}, recebe os avisos e divide o custo do que não é grátis.`;
  const footer = 'O link vale por 7 dias. Depois disso, entre com este e-mail em app.recuidado.com.br.';
  return {
    subject: title,
    html: emailLayout({ webUrl, title, body, badge: { label: 'Convite', tone: 'brand' }, button: { label: 'Entrar na família', link }, footer }),
    text: [title, '', body, '', `Entrar: ${link}`, '', footer, EMAIL_TAGLINE].join('\n'),
  };
}
