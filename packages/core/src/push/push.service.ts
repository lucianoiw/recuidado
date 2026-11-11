import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, inArray } from 'drizzle-orm';
import { sendNotification, WebPushError } from 'web-push';
import { DB, type Database } from '../db/db.module.js';
import { pushSubscriptions } from '../db/schema.js';
import { telemetry } from '../telemetry/telemetry.js';

/** What the service worker (apps/web/public/sw.js) reads from a push. */
export interface PushPayload {
  title: string;
  body: string;
  url: string;
  doseId?: string;
}

export interface SubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: ConfigService,
  ) {}

  get publicKey(): string | undefined {
    return this.config.get<string>('VAPID_PUBLIC_KEY');
  }

  async subscribe(memberId: string, sub: SubscriptionInput): Promise<void> {
    const values = {
      memberId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    };
    await this.db
      .insert(pushSubscriptions)
      .values(values)
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values });
    telemetry.capture('push_subscribed', { push_service: URL.parse(sub.endpoint)?.host }, memberId);
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await this.db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));
  }

  /** Sends to every browser of these members. Returns how many pushes were delivered. */
  async sendToMembers(memberIds: string[], payload: PushPayload): Promise<number> {
    if (memberIds.length === 0) return 0;
    const publicKey = this.publicKey;
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    if (!publicKey || !privateKey) {
      this.logger.warn(`VAPID keys missing, push skipped: ${payload.title}`);
      return 0;
    }
    const subs = await this.db
      .select()
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.memberId, memberIds));

    const results = await Promise.all(
      subs.map(async (sub) => {
        try {
          await sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(payload),
            {
              TTL: 60 * 60,
              urgency: 'high',
              vapidDetails: {
                subject: this.config.getOrThrow<string>('VAPID_SUBJECT'),
                publicKey,
                privateKey,
              },
            },
          );
          return true;
        } catch (error) {
          // 404/410: the browser dropped the subscription.
          if (
            error instanceof WebPushError &&
            (error.statusCode === 404 || error.statusCode === 410)
          ) {
            await this.unsubscribe(sub.endpoint);
          } else {
            this.logger.error(`Push failed for ${sub.id}: ${String(error)}`);
          }
          return false;
        }
      }),
    );
    return results.filter(Boolean).length;
  }
}
