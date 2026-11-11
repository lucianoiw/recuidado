// Sign-in and invite e-mails. Same look as the alert e-mail (packages/core alert-email.ts): table
// layout with inline styles, which every mail client reads.

const C = { bg: '#f7f4ee', surface: '#ffffff', ink: '#16201f', muted: '#4a5553', line: '#ece7de', brand: '#0b5d57' };
const FONT = `'Atkinson Hyperlegible Next','Atkinson Hyperlegible',-apple-system,'Segoe UI',Roboto,Arial,sans-serif`;

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface AuthEmail {
  subject: string;
  html: string;
  text: string;
}

function layout(opts: { webUrl: string; title: string; body: string; code?: string; link: string; button: string; footer: string }): string {
  const logo = new URL('/icon-192.png', opts.webUrl).toString();
  const code = opts.code
    ? `<tr><td style="padding:4px 28px 20px"><p style="margin:0;padding:16px;border-radius:16px;background:#e3f1ee;color:${C.brand};font-size:34px;font-weight:800;letter-spacing:0.3em;text-align:center">${opts.code}</p></td></tr>`
    : '';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escape(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:${FONT};color:${C.ink};-webkit-text-size-adjust:100%">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}">
    <tr><td align="center" style="padding:28px 12px 36px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
        <tr><td style="padding:0 4px 18px">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle"><img src="${escape(logo)}" width="40" height="40" alt="" style="display:block;border:0;border-radius:12px"></td>
            <td style="vertical-align:middle;padding-left:10px;font-size:22px;font-weight:800;color:${C.brand}">Recuidado</td>
          </tr></table>
        </td></tr>
        <tr><td style="background:${C.surface};border:1px solid ${C.line};border-radius:20px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:28px 28px 0"><h1 style="margin:0;font-size:26px;line-height:1.25;font-weight:800">${escape(opts.title)}</h1></td></tr>
            <tr><td style="padding:12px 28px 20px"><p style="margin:0;font-size:18px;line-height:1.5;color:${C.muted}">${escape(opts.body)}</p></td></tr>
            ${code}
            <tr><td style="padding:0 28px 28px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td align="center" style="border-radius:16px;background:${C.brand}">
                  <a href="${escape(opts.link)}" style="display:block;padding:16px 20px;font-size:18px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:16px">${escape(opts.button)}</a>
                </td>
              </tr></table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 8px 0;font-size:14px;line-height:1.5;color:${C.muted};text-align:center">${escape(opts.footer)}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Code and link to sign in. The code is for when the e-mail is read on another device. */
export function signInEmail({ code, link, webUrl }: { code: string; link: string; webUrl: string }): AuthEmail {
  const title = 'Seu código para entrar';
  const body = 'Digite o código no Recuidado ou toque no botão. Ele vale por 15 minutos.';
  const footer = 'Se não foi você que pediu, ignore este e-mail. Ninguém entra sem o código.';
  return {
    subject: `${code} é o seu código do Recuidado`,
    html: layout({ webUrl, title, body, code, link, button: 'Entrar no Recuidado', footer }),
    text: [title, '', body, '', `Código: ${code}`, '', `Ou entre por aqui: ${link}`, '', footer].join('\n'),
  };
}

/** A caregiver invited someone to care together. The button signs the person in. */
export function inviteEmail({ from, patient, link, webUrl }: { from: string; patient: string; link: string; webUrl: string }): AuthEmail {
  const title = `${from} chamou você para cuidar de ${patient}`;
  const body = `No Recuidado a família acompanha os remédios de ${patient}, recebe os avisos e divide o custo do que não é grátis.`;
  const footer = 'O link vale por 7 dias. Depois disso, entre com este e-mail em app.recuidado.com.br.';
  return {
    subject: title,
    html: layout({ webUrl, title, body, link, button: 'Entrar na família', footer }),
    text: [title, '', body, '', `Entrar: ${link}`, '', footer].join('\n'),
  };
}
