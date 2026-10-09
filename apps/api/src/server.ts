import { createApp } from './app';
import { startJobs, stopJobs } from './jobs/boss';
import { env } from './env';
import { pool } from './lib/db';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';

const server = createApp().listen(env.PORT, () => {
  logger.info(`Sentinel API listening on :${env.PORT}`);
});

startJobs().catch((err) => logger.error({ err }, 'Job queue failed to start'));

function shutdown(signal: string) {
  logger.info(`${signal} received, closing`);
  server.close(() => {
    void stopJobs()
      .then(() => prisma.$disconnect())
      .then(() => pool.end())
      .finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
