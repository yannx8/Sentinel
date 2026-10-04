import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const org = await prisma.organization.upsert({
    where: { slug: 'horizon' },
    update: {},
    create: {
      clerkOrgId: 'seed_org_horizon',
      slug: 'horizon',
      legalName: 'Horizon Immobilier SAS',
      displayName: 'Horizon Immobilier',
      registrationNumber: '',
      industry: 'REAL_ESTATE',
      sizeBand: 'SMALL',
      country: 'FR',
      addressLine: '',
      city: '',
      postalCode: '',
      timezone: 'Europe/Paris',
      defaultLocale: 'fr',
      billingEmail: '',
      termsVersion: '1.0',
      termsAcceptedAt: new Date(),
      termsAcceptedByUserId: '00000000-0000-0000-0000-000000000000',
      status: 'ACTIVE',
      plan: 'TRIAL'
    }
  });
  console.log(`Organization: ${org.displayName} (${org.id})`);

  const adminEmail = 'admin@horizon.com';

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  let admin;

  if (existingAdmin) {
    admin = existingAdmin;
    console.log(`Admin already exists: ${admin.email} (${admin.id})`);
  } else {
    admin = await prisma.user.create({
      data: {
        clerkUserId: 'seed_admin_123',
        firstName: 'Admin',
        lastName: 'Nexus',
        email: adminEmail
      }
    });
    console.log(`Admin created: ${admin.email} (${admin.id})`);
  }

  const siteCount = await prisma.site.count({ where: { organizationId: org.id } });
  if (siteCount === 0) {
    await prisma.site.createMany({
      data: [
        { organizationId: org.id, code: 'siege-social', name: 'Siège Social', address: '123 Avenue de la Paix, Douala', latitude: 4.051, longitude: 9.768, timezone: 'UTC' },
        { organizationId: org.id, code: 'entrepot-port', name: 'Entrepôt Port', address: 'Zone Portuaire, Douala', latitude: 4.048, longitude: 9.703, timezone: 'UTC' },
        { organizationId: org.id, code: 'agence-akwa', name: 'Agence Akwa', address: 'Boulevard de la République, Douala', latitude: 4.045, longitude: 9.705, timezone: 'UTC' }
      ]
    });
    console.log('3 sites created');
  }

  console.log('\n--- Seed complete ---');
  console.log(`Admin login: ${adminEmail}`);
  console.log(`Org slug:     horizon`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
