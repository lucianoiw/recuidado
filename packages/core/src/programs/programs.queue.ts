// Monthly refresh of the free-medicine programs (Farmácia Popular, UBS list, Alto Custo):
// the worker reads the official sources and ProgramsService.apply keeps what changed.
export const PROGRAMS_QUEUE = 'programs';

export type ProgramsJob = { kind: 'sync' };

/** Day 2 of each month, 06:00 in São Paulo: the Ministério publishes the barcode list early in the month. */
export const PROGRAMS_SYNC_CRON = '0 6 2 * *';
export const PROGRAMS_SYNC_TZ = 'America/Sao_Paulo';
