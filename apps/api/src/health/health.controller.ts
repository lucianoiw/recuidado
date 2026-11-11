import { Controller, Get, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Pool } from 'pg';
import { PG_POOL } from '../db/db.module.js';

// Coolify checks health often from one address.
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Get()
  async check() {
    await this.pool.query('select 1');
    return { status: 'ok' };
  }
}
