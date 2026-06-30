import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { closePool } from './db/pool';
import { startScheduler, stopScheduler } from './jobs/scheduler';

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info(`Gym MS backend listening on port ${env.port} (${env.nodeEnv})`);
  startScheduler();
});

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, shutting down gracefully...`);
  stopScheduler();
  server.close(async () => {
    await closePool();
    logger.info('Shutdown complete');
    process.exit(0);
  });
  // force exit if it hangs
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => logger.error({ reason }, 'Unhandled rejection'));
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  process.exit(1);
});
