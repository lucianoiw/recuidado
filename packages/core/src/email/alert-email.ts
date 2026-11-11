// The e-mail a caregiver gets for a family alert. Table layout with inline styles, which every mail client
// reads (Gmail drops <style> blocks and web fonts). Same colors as the app (apps/app globals.css).

export type AlertEmailKind = 'dose_missed' | 'unwell' | 'low_stock' | 'emergency' | 'emergency_call' | 'check_in';

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

const C = {
  bg: '#f7f4ee',
  surface: '#ffffff',
  ink: '#16201f',
  muted: '#4a5553',
  line: '#ece7de',
  brand: '#0b5d57',
};

// Label and colors of each kind, the same as the Avisos screen.
const KINDS: Record<AlertEmailKind, { label: string; fg: string; bg: string; button: string }> = {
  dose_missed: { label: 'Dose não confirmada', fg: '#a11d17', bg: '#fce7e5', button: C.brand },
  unwell: { label: 'Disse que não está bem', fg: '#7a4300', bg: '#fff0d6', button: C.brand },
  low_stock: { label: 'Remédio acabando', fg: '#7a4300', bg: '#fff0d6', button: C.brand },
  emergency: { label: 'Emergência', fg: '#ffffff', bg: '#a11d17', button: '#a11d17' },
  emergency_call: { label: 'Ligação para a família', fg: '#a11d17', bg: '#fce7e5', button: C.brand },
  check_in: { label: 'Ligação de volta', fg: C.brand, bg: '#e3f1ee', button: C.brand },
};

const FONT = `'Atkinson Hyperlegible Next','Atkinson Hyperlegible',-apple-system,'Segoe UI',Roboto,Arial,sans-serif`;

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const FOOTER = 'Você recebe este aviso porque cuida de alguém no Recuidado.';
const SAMU = 'Em emergência, ligue 192 (SAMU).';

export function alertEmail({ kind, title, body, link, webUrl }: AlertEmailInput): AlertEmail {
  const k = KINDS[kind];
  const emergency = kind === 'emergency';
  const logo = new URL('/icon-192.png', webUrl).toString();
  const text = [title, '', body, '', ...(emergency ? [SAMU, ''] : []), `Ver no Recuidado: ${link}`, '', FOOTER].join('\n');
  const samu = emergency
    ? `<tr><td style="padding:0 28px 8px"><p style="margin:0;padding:14px 16px;border-radius:14px;background:#fce7e5;color:#a11d17;font-size:16px;line-height:1.4;font-weight:700">${SAMU}</p></td></tr>`
    : '';
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escape(title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:${FONT};color:${C.ink};-webkit-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(body)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}">
    <tr><td align="center" style="padding:28px 12px 36px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
        <tr><td style="padding:0 4px 18px">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle"><img src="${escape(logo)}" width="40" height="40" alt="" style="display:block;border:0;border-radius:12px"></td>
            <td style="vertical-align:middle;padding-left:10px;font-size:22px;font-weight:800;color:${C.brand};letter-spacing:-0.01em">Recuidado</td>
          </tr></table>
        </td></tr>
        <tr><td style="background:${C.surface};border:1px solid ${C.line};border-radius:20px;overflow:hidden">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${emergency ? `<tr><td style="height:6px;background:#a11d17;font-size:0;line-height:0">&nbsp;</td></tr>` : ''}
            <tr><td style="padding:28px 28px 0">
              <span style="display:inline-block;padding:6px 12px;border-radius:999px;background:${k.bg};color:${k.fg};font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase">${k.label}</span>
            </td></tr>
            <tr><td style="padding:16px 28px 0">
              <h1 style="margin:0;font-size:26px;line-height:1.25;font-weight:800;color:${C.ink}">${escape(title)}</h1>
            </td></tr>
            <tr><td style="padding:12px 28px 24px">
              <p style="margin:0;font-size:18px;line-height:1.5;color:${C.muted}">${escape(body)}</p>
            </td></tr>
            ${samu}
            <tr><td style="padding:8px 28px 28px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td align="center" style="border-radius:16px;background:${k.button}">
                  <a href="${escape(link)}" style="display:block;padding:16px 20px;font-size:18px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:16px">Ver no Recuidado</a>
                </td>
              </tr></table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 8px 0;font-size:14px;line-height:1.5;color:${C.muted};text-align:center">
          ${FOOTER}<br>Recuidado cuida do remédio de quem você ama, junto com a família.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { subject: emergency ? `Urgente: ${title.replace(/^Urgente:\s*/, '')}` : title, html, text };
}
