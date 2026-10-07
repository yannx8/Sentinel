import { createApp } from './app';
import { env } from './env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { purgeExpiredRegistrations } from './modules/platform';

const server = createApp().listen(env.PORT, () => {
  logger.info(`Sentinel API listening on :${env.PORT}`);
});

const purge = () => purgeExpiredRegistrations().catch((err) => logger.error({ err }, 'Registration purge failed'));
void purge();
// ponytail: in-process timer, fine for one API instance; use a lock or external cron if we scale out
const purgeTimer = setInterval(purge, 60 * 60 * 1000);
purgeTimer.unref();

function shutdown(signal: string) {
  logger.info(`${signal} received, closing`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
