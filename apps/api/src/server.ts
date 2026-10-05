import app from './app.js';
import { env } from './env.js';
import { prisma } from './lib/prisma.js';
import { logger } from './lib/logger.js';

// Log but don't exit on unhandled rejection to avoid cascading failures during
// transient network issues (DB, external APIs). The process remains usable.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});

// Exit immediately on uncaught exception to avoid undefined/corrupt process state
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { message: err.message, stack: err.stack });
  process.exit(1);
});

const server = app.listen(env.PORT, () =>
  logger.info('Server started', { port: env.PORT, env: env.NODE_ENV })
);

async function shutdown(signal: string) {
  logger.info('Shutdown initiated', { signal });
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Force exit if graceful shutdown hangs (e.g., stuck in-flight requests)
  // unref() prevents the timer from keeping the event loop alive
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
