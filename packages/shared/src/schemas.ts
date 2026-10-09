/**
 * Request schemas. The API validates every input with them and the web forms
 * reuse them, so a rule is written once.
 */
import { z } from 'zod';
import {
  availabilities,
  commentVisibilities,
  dismissReasons,
  industries,
  locales,
  membershipRoles,
  plans,
  priorities,
  progressTypes,
  reassignmentReasons,
  sizeBands,
} from './enums';
import { inboxViews } from './domain';

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const emailSchema = z.string().trim().toLowerCase().max(254).regex(z.regexes.email);
export const passwordSchema = z.string().min(10).max(128);
export const uuidSchema = z.uuid();
export const versionSchema = z.number().int().positive();

const timezone = z
  .string()
  .min(1)
  .max(64)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, 'Unknown time zone');

const phone = z
  .string()
  .trim()
  .max(32)
  .regex(/^[+\d][\d\s().-]{5,}$/)
  .optional()
  .or(z.literal('').transform(() => undefined));

const url = z
  .string()
  .trim()
  .max(200)
  .regex(/^https?:\/\/[^\s]+\.[^\s]+$/)
  .optional()
  .or(z.literal('').transform(() => undefined));

/* Auth */

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const totpSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
});
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
export const tokenSchema = z.object({ token: z.string().min(20).max(200) });

/* Organization registration (public) */

export const registerCompanySchema = z.object({
  legalName: text(2, 160),
  displayName: text(2, 80),
  registrationNumber: optionalText(40),
  industry: z.enum(industries),
  sizeBand: z.enum(sizeBands),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/),
  city: optionalText(80),
  timezone,
  defaultLocale: z.enum(locales),
  website: url,
});

export const registerContactSchema = z.object({
  firstName: text(1, 60),
  lastName: text(1, 60),
  email: emailSchema,
  phone,
  password: passwordSchema,
});

export const registerOrganizationSchema = z.object({
  company: registerCompanySchema,
  contact: registerContactSchema,
  acceptTerms: z.literal(true),
});

/* Me */

export const updateProfileSchema = z.object({
  firstName: text(1, 60),
  lastName: text(1, 60),
  phone,
  locale: z.enum(locales),
});

export const availabilitySchema = z.object({ availability: z.enum(availabilities) });

/* Organization */

export const updateOrganizationSchema = z.object({
  displayName: text(2, 80),
  legalName: text(2, 160),
  registrationNumber: optionalText(40),
  timezone,
  defaultLocale: z.enum(locales),
  billingEmail: emailSchema,
  website: url,
  requireResolutionPhoto: z.boolean(),
  showReporterPhone: z.boolean(),
});

export const siteSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{1,12}$/),
  name: text(2, 80),
  address: optionalText(200),
  city: optionalText(80),
  contactName: optionalText(80),
  contactPhone: phone,
  /** The pin. Null clears it on update. */
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  landmark: optionalText(200),
  guestReporting: z.boolean().optional(),
});
export const updateSiteSchema = siteSchema.partial().extend({ isActive: z.boolean().optional() });

export const areaSchema = z.object({ name: text(2, 80) });
export const updateAreaSchema = areaSchema.partial().extend({ isActive: z.boolean().optional() });

export const categorySchema = z.object({
  name: text(2, 60),
  defaultPriority: z.enum(priorities),
  specialtyId: uuidSchema.nullish().transform((v) => v ?? null),
});
export const updateCategorySchema = categorySchema.partial().extend({ isActive: z.boolean().optional() });

export const specialtySchema = z.object({ name: text(2, 60) });

/* People */

export const employeeProfileSchema = z.object({
  employeeCode: optionalText(40),
  jobTitle: optionalText(80),
  department: optionalText(80),
  homeSiteId: uuidSchema.nullish().transform((v) => v ?? null),
});

export const intervenantProfileSchema = z.object({
  companyName: optionalText(120),
  specialtyIds: z.array(uuidSchema).max(50).default([]),
  siteIds: z.array(uuidSchema).max(500).default([]),
});

export const inviteMemberSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('REPORTER'),
    email: emailSchema,
    firstName: text(1, 60),
    lastName: text(1, 60),
    employee: employeeProfileSchema.prefault({}),
  }),
  z.object({
    role: z.literal('INTERVENANT'),
    email: emailSchema,
    firstName: text(1, 60),
    lastName: text(1, 60),
    intervenant: intervenantProfileSchema.prefault({}),
  }),
  z.object({
    role: z.literal('SUPERVISOR'),
    email: emailSchema,
    firstName: text(1, 60),
    lastName: text(1, 60),
  }),
]);

export const updateMemberSchema = z.object({
  employee: employeeProfileSchema.optional(),
  intervenant: intervenantProfileSchema.optional(),
});

export const memberStatusChangeSchema = z.object({ reason: optionalText(500) });

export const listMembersQuery = z.object({
  role: z.enum(membershipRoles).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REVOKED']).optional(),
  q: optionalText(100),
});

export const acceptInvitationSchema = z.object({
  /** Required when the invitation creates a new account. */
  password: passwordSchema.optional(),
  phone,
});

export const importEmployeesSchema = z.object({
  csv: z.string().min(1).max(2_000_000),
  dryRun: z.boolean().default(true),
});

/* Incidents */

export const createIncidentSchema = z.object({
  title: text(3, 120),
  description: z.string().trim().max(4000).default(''),
  siteId: uuidSchema,
  /** From a QR code. */
  areaId: uuidSchema.optional(),
  categoryId: uuidSchema,
  locationDetail: optionalText(200),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  reportedPriority: z.enum(priorities).optional(),
  /** Supervisors only: report on behalf of an employee. */
  onBehalfOfMembershipId: uuidSchema.optional(),
});

export const pushSubscribeSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});
export const pushUnsubscribeSchema = z.object({ endpoint: z.url().max(1000) });

/** A visitor's report through a QR code. `website` is the honeypot: people leave it empty. */
export const guestReportSchema = z.object({
  categoryId: uuidSchema,
  description: z.string().trim().max(4000).default(''),
  locationDetail: optionalText(200),
  guestName: optionalText(80),
  guestPhone: phone,
  /** Required when a phone number is given. */
  consent: z.boolean().default(false),
  website: z.string().max(200).optional(),
});

const csvList = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const items = v.split(',').filter(Boolean);
      for (const item of items) {
        if (!values.includes(item)) {
          ctx.addIssue({ code: 'custom', message: `Unknown value ${item}` });
          return z.NEVER;
        }
      }
      return items as T[number][];
    });

export const listIncidentsQuery = z.object({
  view: z.enum(inboxViews).optional(),
  status: csvList(['NEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  priority: csvList(priorities),
  siteId: uuidSchema.optional(),
  categoryId: uuidSchema.optional(),
  assigneeId: uuidSchema.optional(),
  q: optionalText(100),
  sort: z.enum(['urgency', 'newest', 'oldest', 'updated']).default('urgency'),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const triageSchema = z.object({
  expectedVersion: versionSchema,
  priority: z.enum(priorities),
  categoryId: uuidSchema,
});

export const assignSchema = z.object({
  expectedVersion: versionSchema,
  intervenantMembershipId: uuidSchema,
  priority: z.enum(priorities).optional(),
  categoryId: uuidSchema.optional(),
  note: optionalText(1000),
});

/** The inbox filters a supervisor can save, as they appear in the console URL. */
export const savedViewParams = z
  .object({
    view: z.enum(inboxViews).optional(),
    q: z.string().trim().max(100).optional(),
    priority: z
      .string()
      .max(60)
      .refine((v) => v.split(',').every((p) => (priorities as readonly string[]).includes(p)), 'Unknown priority')
      .optional(),
    site: uuidSchema.optional(),
    category: uuidSchema.optional(),
    assignee: uuidSchema.optional(),
    sort: z.enum(['urgency', 'newest', 'oldest', 'updated']).optional(),
  })
  .strict();
export const savedViewSchema = z.object({ name: text(1, 40), params: savedViewParams });

const bulkItem = z.object({ reference: z.string().trim().min(1).max(40), expectedVersion: versionSchema });
/** Per-incident results: each one is its own transaction and version check. */
export const bulkIncidentsSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('priority'),
    priority: z.enum(priorities),
    items: z
      .array(bulkItem.extend({ categoryId: uuidSchema }))
      .min(1)
      .max(25),
  }),
  z.object({
    action: z.literal('assign'),
    intervenantMembershipId: uuidSchema,
    items: z.array(bulkItem).min(1).max(25),
  }),
]);

export const unassignSchema = z.object({ expectedVersion: versionSchema, reason: optionalText(500) });
export const closeSchema = z.object({ expectedVersion: versionSchema });
export const sendBackSchema = z.object({ expectedVersion: versionSchema, reason: text(10, 500) });
export const dismissSchema = z.object({
  expectedVersion: versionSchema,
  reason: z.enum(dismissReasons),
  note: optionalText(500),
});
export const commentSchema = z.object({ body: text(1, 4000), visibility: z.enum(commentVisibilities) });

/* Assignments */

export const declineSchema = z.object({ reason: text(5, 500) });
export const requestReassignmentSchema = z.object({ reasonCode: z.enum(reassignmentReasons), note: optionalText(500) });
export const progressSchema = z.object({
  progressType: z.enum(progressTypes),
  note: text(1, 2000),
  /** The intervenant's position when arriving (ON_SITE). */
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().min(0).max(100_000).optional(),
});
export const resolveSchema = z.object({ note: text(10, 4000) });
export const rejectReassignmentSchema = z.object({ note: optionalText(500) });

/* Audit and reporting */

export const auditQuery = z.object({
  type: z.string().max(40).optional(),
  incident: z.string().max(40).optional(),
  actorId: uuidSchema.optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/* Platform */

export const suspendOrganizationSchema = z.object({ reason: text(10, 500) });
export const reactivateOrganizationSchema = z.object({ reason: optionalText(500) });
export const updatePlanSchema = z.object({ plan: z.enum(plans), trialEndsAt: z.iso.date().nullish() });

export const cursorQuery = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  q: optionalText(100),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterOrganizationInput = z.infer<typeof registerOrganizationSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type SavedViewInput = z.infer<typeof savedViewSchema>;
export type BulkIncidentsInput = z.infer<typeof bulkIncidentsSchema>;
export type ListIncidentsQuery = z.infer<typeof listIncidentsQuery>;
export type SiteInput = z.infer<typeof siteSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
