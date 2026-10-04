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

import app from '../app.js';

describe('Adversarial Tenant Test Harness (TICKET-003)', () => {
  let orgA: any;
  let orgB: any;
  let userA: any;
  let userB: any;
  let siteA: any;
  let siteB: any;

  beforeAll(async () => {
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();

    // Create User A
    userA = await prisma.user.create({
      data: {
        clerkUserId: 'clerk_user_a',
        email: 'usera@example.com',
        firstName: 'User',
        lastName: 'A'
      }
    });

    // Create User B
    userB = await prisma.user.create({
      data: {
        clerkUserId: 'clerk_user_b',
        email: 'userb@example.com',
        firstName: 'User',
        lastName: 'B'
      }
    });

    // Create Org A
    orgA = await prisma.organization.create({
      data: {
        clerkOrgId: 'clerk_org_a',
        slug: 'org-a',
        legalName: 'Org A',
        displayName: 'Org A',
        registrationNumber: '123',
        industry: 'Tech',
        sizeBand: '1-10',
        country: 'US',
        addressLine: '123 Main St',
        city: 'NY',
        postalCode: '10001',
        timezone: 'UTC',
        defaultLocale: 'en',
        billingEmail: 'billing@orga.com',
        status: 'ACTIVE',
        plan: 'STARTER',
        termsVersion: '1.0',
        termsAcceptedAt: new Date(),
        termsAcceptedByUserId: userA.id,
        memberships: {
          create: {
            userId: userA.id,
            role: 'SUPERVISOR',
            isOwner: true,
            status: 'ACTIVE'
          }
        }
      }
    });

    // Create Org B
    orgB = await prisma.organization.create({
      data: {
        clerkOrgId: 'clerk_org_b',
        slug: 'org-b',
        legalName: 'Org B',
        displayName: 'Org B',
        registrationNumber: '456',
        industry: 'Tech',
        sizeBand: '1-10',
        country: 'US',
        addressLine: '456 Market St',
        city: 'SF',
        postalCode: '94105',
        timezone: 'UTC',
        defaultLocale: 'en',
        billingEmail: 'billing@orgb.com',
        status: 'ACTIVE',
        plan: 'STARTER',
        termsVersion: '1.0',
        termsAcceptedAt: new Date(),
        termsAcceptedByUserId: userB.id,
        memberships: {
          create: {
            userId: userB.id,
            role: 'SUPERVISOR',
            isOwner: true,
            status: 'ACTIVE'
          }
        }
      }
    });

    // Create a Site for Org A
    siteA = await prisma.site.create({
      data: {
        organizationId: orgA.id,
        code: 'SITE-A',
        name: 'Site A',
        latitude: 40,
        longitude: -74,
        timezone: 'UTC'
      }
    });

    // Create a Site for Org B
    siteB = await prisma.site.create({
      data: {
        organizationId: orgB.id,
        code: 'SITE-B',
        name: 'Site B',
        latitude: 37,
        longitude: -122,
        timezone: 'UTC'
      }
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
  });

  it('allows Org A to access Site A', async () => {
    const res = await request(app)
      .get(`/sites/${siteA.id}`)
      .set('Authorization', `Bearer clerk_user_a:clerk_org_a`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(siteA.id);
  });

  it('allows Org B to access Site B', async () => {
    const res = await request(app)
      .get(`/sites/${siteB.id}`)
      .set('Authorization', `Bearer clerk_user_b:clerk_org_b`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(siteB.id);
  });

  it('rejects Org B trying to access Site A (Adversarial Tenant Isolation)', async () => {
    const res = await request(app)
      .get(`/sites/${siteA.id}`)
      .set('Authorization', `Bearer clerk_user_b:clerk_org_b`);
    expect(res.status).toBe(404); // Should be 404 because Site A belongs to Org A, and composite query `where: { id: siteA.id, organizationId: orgB.id }` finds nothing.
  });

  it('rejects Org A trying to access Site B (Adversarial Tenant Isolation)', async () => {
    const res = await request(app)
      .get(`/sites/${siteB.id}`)
      .set('Authorization', `Bearer clerk_user_a:clerk_org_a`);
    expect(res.status).toBe(404);
  });
});
