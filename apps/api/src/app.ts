import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { Router } from 'express';
import { env, isProduction } from './env';
import { authenticate, requireTenant, requireUser, requirePlatformAdmin } from './auth/context';
import { authRoutes } from './auth/routes';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { errorHandler, notFoundHandler } from './http/error-handler';
import { apiLimiter } from './http/rate-limit';
import { meRoutes } from './modules/me';
import { registrationRoutes } from './modules/registration';
import { areaLookupRoutes, publicSiteRoutes } from './modules/areas';
import { publicInvitationRoutes } from './modules/people/public-invitations';
import { invitationRoutes, memberRoutes } from './modules/people/routes';
import { incidentRoutes } from './modules/incidents/routes';
import { assignmentRoutes, reassignmentRoutes } from './modules/incidents/assignment-routes';
import { attachmentFileRoutes, incidentAttachmentRoutes } from './modules/attachments';
import { organizationRoutes, membershipRoutes } from './modules/organization';
import { categoryRoutes, siteRoutes, specialtyRoutes } from './modules/catalog';
import { notificationRoutes } from './modules/notifications';
import { dashboardRoutes } from './modules/dashboard';
import { auditRoutes } from './modules/audit';
import { viewRoutes } from './modules/views';
import { eventRoutes } from './modules/events';
import { platformRoutes } from './modules/platform';

export function createApp() {
  const app = express();
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      logger.info(
        { requestId: req.requestId, method: req.method, path: req.path, status: res.statusCode, ms: Math.round(ms) },
        'request',
      );
    });
    next();
  });

  app.use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-Org-Id', 'Idempotency-Key', 'Authorization'],
      exposedHeaders: ['X-Request-Id'],
    }),
  );
  app.use(express.json({ limit: '3mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  const v1 = Router();
  v1.use(apiLimiter, authenticate);

  v1.use('/auth', authRoutes);
  v1.use('/public/organizations', registrationRoutes);
  v1.use('/public/invitations', publicInvitationRoutes);
  v1.use('/public/sites', publicSiteRoutes);
  v1.use('/me', requireUser, meRoutes);
  v1.use('/platform', requireUser, requirePlatformAdmin, platformRoutes);
  // The attachment id names its organization, so this route resolves the tenant itself.
  v1.use('/attachments', requireUser, attachmentFileRoutes);

  const tenant = Router();
  tenant.use(requireUser, requireTenant);
  tenant.use('/incidents/:incidentId/attachments', incidentAttachmentRoutes);
  tenant.use('/incidents', incidentRoutes);
  tenant.use('/assignments', assignmentRoutes);
  tenant.use('/reassignments', reassignmentRoutes);
  tenant.use('/members', memberRoutes);
  tenant.use('/invitations', invitationRoutes);
  tenant.use('/organization', organizationRoutes);
  tenant.use('/membership', membershipRoutes);
  tenant.use('/sites', siteRoutes);
  tenant.use('/areas', areaLookupRoutes);
  tenant.use('/categories', categoryRoutes);
  tenant.use('/specialties', specialtyRoutes);
  tenant.use('/notifications', notificationRoutes);
  tenant.use('/dashboard', dashboardRoutes);
  tenant.use('/audit', auditRoutes);
  tenant.use('/views', viewRoutes);
  tenant.use('/events', eventRoutes);
  v1.use(tenant);

  app.use('/v1', v1);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
