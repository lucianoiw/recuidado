// The e-mail a caregiver gets for a family alert. Plain HTML with inline styles, which every mail client reads.

export interface AlertEmailInput {
  title: string;
  body: string;
  /** Absolute link to the page the alert opens in the family app. */
  link: string;
}

export interface AlertEmail {
  subject: string;
  html: string;
  text: string;
}

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function alertEmail({ title, body, link }: AlertEmailInput): AlertEmail {
  const text = `${title}\n\n${body}\n\nAbrir o Recuidado: ${link}\n\nVocê recebe este e-mail porque cuida de alguém no Recuidado.`;
  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f7f4ee;font-family:Arial,Helvetica,sans-serif;color:#16201f">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4ee;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden">
        <tr><td style="background:#0b5d57;color:#ffffff;padding:16px 24px;font-size:18px;font-weight:bold">Recuidado</td></tr>
        <tr><td style="padding:24px">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">${escape(title)}</h1>
          <p style="margin:0 0 24px;font-size:17px;line-height:1.5">${escape(body)}</p>
          <a href="${escape(link)}" style="display:inline-block;background:#0b5d57;color:#ffffff;text-decoration:none;font-weight:bold;font-size:17px;padding:14px 22px;border-radius:12px">Abrir o Recuidado</a>
        </td></tr>
        <tr><td style="padding:0 24px 24px;font-size:13px;color:#5f6b69">Você recebe este e-mail porque cuida de alguém no Recuidado.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { subject: title, html, text };
}
