import { membershipsRepository } from '../modules/billing/memberships.repository';
import { cache, CacheKeys } from '../cache/cache';
import { realtimeBus } from '../realtime/events';
import { logger } from '../config/logger';

/**
 * Lightweight in-process scheduler. Runs membership status maintenance on an
 * interval (no external cron needed). Expires overdue memberships and activates
 * upcoming ones, then invalidates dashboard/report caches and notifies clients.
 */
let timer: NodeJS.Timeout | null = null;

async function tick(): Promise<void> {
  try {
    await membershipsRepository.activateDue();
    const expired = await membershipsRepository.expireOverdue();
    if (expired.length > 0) {
      await Promise.all([
        cache.invalidatePrefix(CacheKeys.dashboard),
        cache.invalidatePrefix(CacheKeys.stats),
        cache.invalidatePrefix(CacheKeys.members),
      ]);
      realtimeBus.emitEvent('membership.expired', { count: expired.length });
      logger.info({ count: expired.length }, 'Expired overdue memberships');
    }
  } catch (err) {
    logger.error({ err }, 'Scheduler tick failed');
  }
}

export function startScheduler(intervalMs = 15 * 60 * 1000): void {
  // run shortly after boot, then on the interval
  setTimeout(tick, 5_000);
  timer = setInterval(tick, intervalMs);
  logger.info(`Scheduler started (interval ${intervalMs}ms)`);
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
}
