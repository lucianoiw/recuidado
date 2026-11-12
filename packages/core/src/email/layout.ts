// Shared look of every e-mail the Recuidado sends (sign-in, invite and family alerts), as approved on the
// canvas page "E-mails" (12/11/2026): cream background, wordmark, white card, big title, round black button.
// Table layout with inline styles, which every mail client reads. Gmail drops web fonts, so Inter Tight falls
// back to the system font there.

export const EMAIL_COLORS = {
  bg: '#f8f4ef',
  surface: '#ffffff',
  ink: '#161314',
  body: '#3d393b',
  muted: '#57524f',
  line: '#eee8e1',
  accentInk: '#b8125a',
  blush: '#fcebf1',
  danger: '#a11d17',
  dangerSoft: '#fce7e5',
};

export type EmailTone = 'brand' | 'danger' | 'warn' | 'ok' | 'urgent';

const TONES: Record<EmailTone, { bg: string; fg: string }> = {
  brand: { bg: EMAIL_COLORS.blush, fg: EMAIL_COLORS.accentInk },
  danger: { bg: EMAIL_COLORS.dangerSoft, fg: EMAIL_COLORS.danger },
  warn: { bg: '#fff0d6', fg: '#7a4300' },
  ok: { bg: '#e3f2e9', fg: '#1d6b47' },
  urgent: { bg: EMAIL_COLORS.danger, fg: '#ffffff' },
};

const FONT = `'Inter Tight',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;
export const EMAIL_TAGLINE = 'Recuidado cuida do remédio de quem você ama, junto com a família.';

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface EmailLayout {
  /** Origin of the web app, for the logo image. */
  webUrl: string;
  title: string;
  body: string;
  /** Small colored label above the title. */
  badge?: { label: string; tone: EmailTone };
  /** Six-digit sign-in code, shown big. */
  code?: string;
  /** Red box "Em emergência, ligue 192 (SAMU)." */
  samu?: string;
  button: { label: string; link: string; danger?: boolean };
  footer: string;
}

export function emailLayout(o: EmailLayout): string {
  const C = EMAIL_COLORS;
  const logo = new URL('/email-logo.png', o.webUrl).toString();
  const badge = o.badge
    ? `<tr><td style="padding:0 0 18px"><span style="display:inline-block;padding:7px 14px;border-radius:999px;background:${TONES[o.badge.tone].bg};color:${TONES[o.badge.tone].fg};font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase">${escapeHtml(o.badge.label)}</span></td></tr>`
    : '';
  const code = o.code
    ? `<tr><td style="padding:26px 0 0"><p style="margin:0;padding:22px 0;border-radius:20px;background:${C.blush};color:${C.ink};font-size:40px;font-weight:700;letter-spacing:0.3em;text-indent:0.3em;text-align:center">${escapeHtml(o.code)}</p></td></tr>`
    : '';
  const samu = o.samu
    ? `<tr><td style="padding:22px 0 0"><p style="margin:0;padding:16px 18px;border-radius:18px;background:${C.dangerSoft};color:${C.danger};font-size:17px;line-height:1.4;font-weight:700">${escapeHtml(o.samu)}</p></td></tr>`
    : '';
  const button = o.button.danger ? C.danger : C.ink;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(o.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:${FONT};color:${C.ink};-webkit-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(o.body)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}">
    <tr><td align="center" style="padding:36px 14px 36px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:576px">
        <tr><td align="center" style="padding:0 0 26px"><img src="${escapeHtml(logo)}" width="192" height="30" alt="Recuidado" style="display:block;border:0;width:192px;height:30px"></td></tr>
        <tr><td style="background:${C.surface};border-radius:28px;padding:34px 32px 32px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${badge}
            <tr><td><h1 style="margin:0;font-size:32px;line-height:1.1;font-weight:600;letter-spacing:-0.02em;color:${C.ink}">${escapeHtml(o.title)}</h1></td></tr>
            <tr><td style="padding:16px 0 0"><p style="margin:0;font-size:19px;line-height:1.5;color:${C.body}">${escapeHtml(o.body)}</p></td></tr>
            ${code}
            ${samu}
            <tr><td style="padding:28px 0 0">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td align="center" style="border-radius:999px;background:${button}">
                  <a href="${escapeHtml(o.button.link)}" style="display:block;padding:19px 20px;font-size:19px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${escapeHtml(o.button.label)}</a>
                </td>
              </tr></table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:26px 8px 0;font-size:14px;line-height:1.55;color:${C.muted};text-align:center">
          ${escapeHtml(o.footer)}<br><span style="display:inline-block;margin-top:10px;color:${C.accentInk};font-weight:600">${EMAIL_TAGLINE}</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
