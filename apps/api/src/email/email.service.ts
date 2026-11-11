import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { telemetry } from '../telemetry/telemetry.js';
import { alertEmail, type AlertEmailInput } from './alert-email.js';

/** Family alerts by e-mail, sent with Resend. Without RESEND_API_KEY nothing is sent. */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('RESEND_API_KEY');
    this.resend = key ? new Resend(key) : null;
  }

  /** One e-mail per address, so nobody sees the others. Returns how many Resend accepted. */
  async sendAlert(to: string[], alert: AlertEmailInput, kind: string): Promise<number> {
    const addresses = [...new Set(to.map((a) => a.trim().toLowerCase()).filter(Boolean))];
    if (addresses.length === 0) return 0;
    if (!this.resend) {
      this.logger.log(`RESEND_API_KEY not set: skipped ${addresses.length} alert e-mail(s)`);
      return 0;
    }
    const from = this.config.get<string>('EMAIL_FROM')!;
    const email = alertEmail(alert);
    try {
      const { data, error } = await this.resend.batch.send(
        addresses.map((address) => ({ from, to: [address], subject: email.subject, html: email.html, text: email.text })),
      );
      if (error) throw new Error(error.message);
      const sent = data?.data.length ?? 0;
      telemetry.capture('alert_email_sent', { kind, emails: sent });
      return sent;
    } catch (e) {
      // An e-mail failure never stops the push or the history entry.
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`Alert e-mails not sent: ${message}`);
      telemetry.capture('alert_email_failed', { kind, error: message });
      return 0;
    }
  }
}
