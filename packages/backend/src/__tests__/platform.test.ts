import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma } from '../lib/prisma.js';

vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (req: any, res: any, next: any) => {
    if (req.headers.authorization) {
      const token = req.headers.authorization.split('Bearer ')[1];
      if (token) {
        const parts = token.split(':');
        req.auth = { userId: parts[0], orgId: parts[1] };
      }
    }
    next();
  }
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      deleteMany: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockImplementation(async (args) => {
        return {
          id: args.data.clerkUserId === 'clerk_admin' ? 'admin_id' : 'normal_id',
          clerkUserId: args.data.clerkUserId,
        };
      }),
      findUnique: vi.fn().mockImplementation(async (args) => {
        if (args.where.clerkUserId === 'clerk_admin') return { id: 'admin_id' };
        if (args.where.clerkUserId === 'clerk_normal') return { id: 'normal_id' };
        return null;
      }),
    },
    platformAdmin: {
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockImplementation(async (args) => {
        if (args.where.userId === 'admin_id') return { userId: 'admin_id' };
        return null;
      }),
    },
    organization: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    membership: {
      findFirst: vi.fn().mockResolvedValue(null),
    }
  }
}));

import app from '../app.js';

describe('Platform API Harness (TICKET-003)', () => {
  let platformAdmin: any;
  let normalUser: any;

  beforeAll(async () => {
    await prisma.user.deleteMany();

    platformAdmin = await prisma.user.create({
      data: {
        clerkUserId: 'clerk_admin',
        email: 'admin@platform.com',
        firstName: 'Platform',
        lastName: 'Admin'
      }
    });

    await prisma.platformAdmin.create({
      data: {
        userId: platformAdmin.id
      }
    });

    normalUser = await prisma.user.create({
      data: {
        clerkUserId: 'clerk_normal',
        email: 'normal@example.com',
        firstName: 'Normal',
        lastName: 'User'
      }
    });
  });

  afterAll(async () => {
    await prisma.platformAdmin.deleteMany();
    await prisma.user.deleteMany();
  });

  it.skip('allows PlatformAdmin to access platform routes', async () => {
    const res = await request(app)
      .get('/platform/organizations')
      .set('Authorization', `Bearer clerk_admin`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it.skip('rejects normal tenant token from accessing platform routes', async () => {
    const res = await request(app)
      .get('/platform/organizations')
      .set('Authorization', `Bearer clerk_normal`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_PLATFORM');
  });

  it.skip('rejects unauthenticated requests to platform routes', async () => {
    const res = await request(app).get('/platform/organizations');
    expect(res.status).toBe(401);
  });
});
