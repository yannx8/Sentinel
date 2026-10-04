import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import { prisma } from './lib/prisma.js';
import { AppError } from './lib/errors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { contextResolver } from './middleware/contextResolver.js';
import { requireTenant } from './middleware/requireTenant.js';
import { apiLimiter } from './lib/rateLimiter.js';
import platformRoutes from './modules/platform/platform.routes.js';
import siteRoutes from './modules/sites/sites.routes.js';
import responsableRoutes from './modules/responsables/responsables.routes.js';
import incidentRoutes from './modules/incidents/incidents.routes.js';
import assignmentRoutes from './modules/assignments/assignments.routes.js';
import notificationRoutes from './modules/notifications/notifications.routes.js';
import mapRoutes from './modules/map/map.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import attachmentRoutes from './modules/attachments/attachments.routes.js';

const app = express();
app.set('trust proxy', env.TRUST_PROXY);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(self),camera=(),microphone=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: https://*.tile.openstreetmap.org; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'"
  );
  if (env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(
  cors({
    origin: env.WEB_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(apiLimiter);

app.get('/health', (_q, res) => res.json({ status: 'ok', service: 'sentinel' }));
app.get('/ready', async (_q, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready' });
  } catch (e) {
    next(new AppError('NOT_READY', 503, 'Database unavailable'));
  }
});

app.use(contextResolver);

app.use('/platform', platformRoutes);

// Every tenant route requires a resolved user, organization and membership.
const tenant = express.Router();
tenant.use(requireTenant);
tenant.use('/sites', siteRoutes);
tenant.use('/responsables', responsableRoutes);
tenant.use('/incidents', incidentRoutes);
tenant.use('/assignments', assignmentRoutes);
tenant.use('/notifications', notificationRoutes);
tenant.use('/map', mapRoutes);
tenant.use('/dashboard', dashboardRoutes);
tenant.use('/incidents', attachmentRoutes);
app.use(tenant);

app.use(errorHandler);
export default app;
