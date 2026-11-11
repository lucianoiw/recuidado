import { describe, expect, it } from 'vitest';
import { demoAlertEmails } from '../alerts/alerts.service.js';
import { alertEmail } from './alert-email.js';

describe('alertEmail', () => {
  it('uses the alert title as subject and links to the family app', () => {
    const e = alertEmail({
      title: 'Dona Maria não confirmou o remédio das 8h',
      body: 'Ligamos e ela não atendeu.',
      link: 'https://recuidado.com.br/family/avisos',
    });
    expect(e.subject).toBe('Dona Maria não confirmou o remédio das 8h');
    expect(e.html).toContain('href="https://recuidado.com.br/family/avisos"');
    expect(e.text).toContain('Ligamos e ela não atendeu.');
  });

  it('escapes HTML from the alert text', () => {
    const e = alertEmail({ title: '<b>x</b>', body: 'a & b', link: 'https://x.test/?a=1&b=2' });
    expect(e.html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(e.html).toContain('a &amp; b');
    expect(e.html).not.toContain('<b>x</b>');
  });
});

describe('demoAlertEmails', () => {
  it('splits the comma-separated list and drops blanks', () => {
    expect(demoAlertEmails(' ana@exemplo.com, ,carlos@exemplo.com ')).toEqual(['ana@exemplo.com', 'carlos@exemplo.com']);
    expect(demoAlertEmails(undefined)).toEqual([]);
  });
});
