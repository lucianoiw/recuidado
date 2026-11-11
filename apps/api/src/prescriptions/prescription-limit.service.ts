import { HttpException, HttpStatus, Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { telemetry } from '@recuidado/core';
import { consumeRead, LIMIT_MESSAGES, type CounterStore } from './usage-limit.js';

export const PRESCRIPTION_COUNTERS = Symbol('PRESCRIPTION_COUNTERS');

/** Redis counters in fixed windows: a new key starts at 0 with its expiry, then INCR. */
export class RedisCounterStore implements CounterStore {
  constructor(private readonly redis: Redis) {}

  async get(keys: string[]): Promise<number[]> {
    const values = await this.redis.mget(...keys);
    return values.map((v) => Number(v ?? 0));
  }

  async hit(keys: string[], ttlSeconds: number): Promise<void> {
    const tx = this.redis.multi();
    for (const key of keys) {
      tx.set(key, 0, 'EX', ttlSeconds, 'NX');
      tx.incr(key);
    }
    await tx.exec();
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

/** Caps prescription reads (open endpoint, paid model) per IP, per family and in total. */
@Injectable()
export class PrescriptionLimitService implements OnModuleDestroy {
  constructor(
    @Inject(PRESCRIPTION_COUNTERS) private readonly store: CounterStore,
    private readonly config: ConfigService,
  ) {}

  /** Counts one read, or throws 429 when a limit is reached. */
  async consume(ip: string, familyId?: string | null): Promise<void> {
    const reason = await consumeRead(
      this.store,
      {
        perIp: this.config.getOrThrow<number>('PRESCRIPTION_LIMIT_PER_IP'),
        perFamily: this.config.getOrThrow<number>('PRESCRIPTION_LIMIT_PER_FAMILY'),
        total: this.config.getOrThrow<number>('PRESCRIPTION_LIMIT_TOTAL'),
      },
      { ip, familyId },
    );
    if (!reason) return;
    telemetry.capture('prescription_read_limited', { reason });
    throw new HttpException(LIMIT_MESSAGES[reason], HttpStatus.TOO_MANY_REQUESTS);
  }

  async onModuleDestroy() {
    if (this.store instanceof RedisCounterStore) await this.store.close();
  }
}

export const redisCountersProvider = {
  provide: PRESCRIPTION_COUNTERS,
  inject: [ConfigService],
  useFactory: (config: ConfigService): CounterStore =>
    new RedisCounterStore(new Redis(config.getOrThrow<string>('REDIS_URL'))),
};
