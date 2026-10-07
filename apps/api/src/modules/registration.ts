import type { Industry, Priority } from '@sentinel/shared';
import { forgotPasswordSchema, registerOrganizationSchema, tokenSchema } from '@sentinel/shared';
import { Router } from 'express';
import { z } from 'zod';
import { env, isProduction } from '../env';
import { createSession } from '../auth/sessions';
import { hashPassword, hashToken, newToken } from '../lib/crypto';
import { mail } from '../lib/mailer';
import { prisma, type Tx } from '../lib/prisma';
import { setSessionCookie } from '../http/cookies';
import { AppError, conflict } from '../http/errors';
import { publicLimiter } from '../http/rate-limit';
import { parse } from '../http/validate';
import { buildMe } from './me';

const TERMS_VERSION = '2026-10';
const REGISTRATION_TTL_MS = 24 * 3600 * 1000;
const TRIAL_DAYS = 30;

/** What waits in OrganizationRegistration.payload until the email is verified. */
const pendingPayload = registerOrganizationSchema.shape.company.extend({
  contact: z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    phone: z.string().optional(),
    passwordHash: z.string(),
  }),
});

export const registrationRoutes = Router();

registrationRoutes.post('/', publicLimiter, async (req, res) => {
  const input = parse(registerOrganizationSchema, req.body);
  const { contact, company } = input;
  if (await prisma.user.findUnique({ where: { email: contact.email } })) {
    throw conflict('An account already uses this email. Sign in, or reset your password if you forgot it.', {
      fields: { 'contact.email': ['Already registered'] },
    });
  }

  const token = newToken();
  const passwordHash = await hashPassword(contact.password);
  const registration = await prisma.organizationRegistration.create({
    data: {
      email: contact.email,
      companyName: company.displayName,
      contactName: `${contact.firstName} ${contact.lastName}`,
      payload: {
        ...company,
        contact: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          passwordHash,
        },
      },
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + REGISTRATION_TTL_MS),
    },
  });

  const link = `${env.WEB_ORIGIN}/verify-email?token=${token}`;
  await mail.verifyRegistration(contact.email, company.defaultLocale, contact.firstName, link);
  res.status(202).json({
    data: {
      email: registration.email,
      expiresAt: registration.expiresAt.toISOString(),
      // Local development without SMTP: the link is also returned so the flow can be completed.
      ...(isProduction ? {} : { previewUrl: link }),
    },
  });
});

registrationRoutes.post('/resend', publicLimiter, async (req, res) => {
  const { email } = parse(forgotPasswordSchema, req.body);
  const registration = await prisma.organizationRegistration.findFirst({
    where: { email, verifiedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  let previewUrl: string | undefined;
  if (registration) {
    const token = newToken();
    const payload = pendingPayload.parse(registration.payload);
    await prisma.organizationRegistration.update({
      where: { id: registration.id },
      data: { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + REGISTRATION_TTL_MS) },
    });
    previewUrl = `${env.WEB_ORIGIN}/verify-email?token=${token}`;
    await mail.verifyRegistration(email, payload.defaultLocale, payload.contact.firstName, previewUrl);
  }
  res.status(202).json({ data: { email, ...(isProduction || !previewUrl ? {} : { previewUrl }) } });
});

registrationRoutes.post('/verify', publicLimiter, async (req, res) => {
  const { token } = parse(tokenSchema, req.body);
  const registration = await prisma.organizationRegistration.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!registration) throw new AppError('TOKEN_INVALID', 'This link is not valid. Use the latest email we sent.');
  if (registration.verifiedAt) {
    throw new AppError('TOKEN_INVALID', 'This organization is already active. Sign in to continue.', {
      alreadyVerified: true,
    });
  }
  if (registration.expiresAt < new Date()) {
    throw new AppError('TOKEN_EXPIRED', 'This link has expired. Ask for a new one.', { email: registration.email });
  }
  const payload = pendingPayload.parse(registration.payload);
  if (await prisma.user.findUnique({ where: { email: payload.contact.email } })) {
    throw conflict('An account already uses this email. Sign in instead.');
  }

  const user = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const user = await tx.user.create({
      data: {
        email: payload.contact.email,
        passwordHash: payload.contact.passwordHash,
        firstName: payload.contact.firstName,
        lastName: payload.contact.lastName,
        phone: payload.contact.phone ?? null,
        locale: payload.defaultLocale,
        emailVerifiedAt: now,
        lastLoginAt: now,
      },
    });
    const organization = await tx.organization.create({
      data: {
        slug: await uniqueSlug(tx, payload.displayName),
        legalName: payload.legalName,
        displayName: payload.displayName,
        registrationNumber: payload.registrationNumber ?? null,
        industry: payload.industry,
        sizeBand: payload.sizeBand,
        country: payload.country,
        city: payload.city ?? null,
        timezone: payload.timezone,
        defaultLocale: payload.defaultLocale,
        website: payload.website ?? null,
        billingEmail: payload.contact.email,
        trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * 24 * 3600 * 1000),
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: registration.createdAt,
        termsAcceptedByUserId: user.id,
      },
    });
    await tx.membership.create({
      data: { organizationId: organization.id, userId: user.id, role: 'SUPERVISOR', isOwner: true },
    });
    await seedCatalog(tx, organization.id, payload.industry, payload.defaultLocale);
    await tx.organizationRegistration.update({
      where: { id: registration.id },
      data: { verifiedAt: now, organizationId: organization.id },
    });
    return user;
  });

  const { token: sessionToken, session } = await createSession(user.id, req);
  setSessionCookie(res, sessionToken, session.expiresAt);
  res.status(201).json({ data: await buildMe(user, session) });
});

async function uniqueSlug(tx: Tx, name: string): Promise<string> {
  const base =
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'org';
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${newToken().slice(0, 5).toLowerCase()}`;
    if (!(await tx.organization.findUnique({ where: { slug } }))) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

type CatalogEntry = { en: string; fr: string; priority: Priority; specialty: string | null };

const specialtyNames: Record<string, { en: string; fr: string }> = {
  plumbing: { en: 'Plumbing', fr: 'Plomberie' },
  electrical: { en: 'Electrical', fr: 'Électricité' },
  hvac: { en: 'Heating and cooling', fr: 'Chauffage et climatisation' },
  access: { en: 'Doors and access', fr: 'Portes et accès' },
  cleaning: { en: 'Cleaning', fr: 'Nettoyage' },
  it: { en: 'IT and network', fr: 'Informatique et réseau' },
  general: { en: 'General maintenance', fr: 'Maintenance générale' },
  safety: { en: 'Health and safety', fr: 'Santé et sécurité' },
};

const baseCategories: CatalogEntry[] = [
  { en: 'Water leak', fr: "Fuite d'eau", priority: 'HIGH', specialty: 'plumbing' },
  { en: 'Power outage', fr: 'Coupure de courant', priority: 'CRITICAL', specialty: 'electrical' },
  { en: 'Electrical fault', fr: 'Panne électrique', priority: 'HIGH', specialty: 'electrical' },
  { en: 'Heating or cooling', fr: 'Chauffage ou climatisation', priority: 'MEDIUM', specialty: 'hvac' },
  { en: 'Door, lock or access', fr: 'Porte, serrure ou accès', priority: 'MEDIUM', specialty: 'access' },
  { en: 'Cleaning', fr: 'Nettoyage', priority: 'LOW', specialty: 'cleaning' },
  { en: 'IT or network', fr: 'Informatique ou réseau', priority: 'MEDIUM', specialty: 'it' },
  { en: 'Safety hazard', fr: 'Danger pour la sécurité', priority: 'CRITICAL', specialty: 'safety' },
  { en: 'Damage or repair', fr: 'Dégradation ou réparation', priority: 'MEDIUM', specialty: 'general' },
  { en: 'Other', fr: 'Autre', priority: 'LOW', specialty: null },
];

const industryCategories: Partial<Record<Industry, CatalogEntry>> = {
  HEALTHCARE: { en: 'Medical equipment', fr: 'Équipement médical', priority: 'HIGH', specialty: 'general' },
  RETAIL: { en: 'Point of sale', fr: 'Caisse', priority: 'HIGH', specialty: 'it' },
  MANUFACTURING: { en: 'Machine breakdown', fr: 'Panne machine', priority: 'CRITICAL', specialty: 'general' },
  HOSPITALITY: { en: 'Guest room issue', fr: 'Problème en chambre', priority: 'HIGH', specialty: 'general' },
  EDUCATION: { en: 'Classroom equipment', fr: 'Équipement de salle', priority: 'MEDIUM', specialty: 'it' },
  LOGISTICS: {
    en: 'Dock or handling equipment',
    fr: 'Quai ou matériel de manutention',
    priority: 'HIGH',
    specialty: 'general',
  },
  PROPERTY: { en: 'Lift or elevator', fr: 'Ascenseur', priority: 'HIGH', specialty: 'general' },
};

/** Default specialties and categories for a new organization, in its language. */
export async function seedCatalog(tx: Tx, organizationId: string, industry: Industry, locale: string) {
  const lang = locale === 'fr' ? 'fr' : 'en';
  const specialtyIds = new Map<string, string>();
  for (const [key, names] of Object.entries(specialtyNames)) {
    const specialty = await tx.specialty.create({ data: { organizationId, name: names[lang] } });
    specialtyIds.set(key, specialty.id);
  }
  const extra = industryCategories[industry];
  const entries = extra ? [extra, ...baseCategories] : baseCategories;
  await tx.incidentCategory.createMany({
    data: entries.map((entry) => ({
      organizationId,
      name: entry[lang],
      defaultPriority: entry.priority,
      specialtyId: entry.specialty ? (specialtyIds.get(entry.specialty) ?? null) : null,
    })),
  });
}
