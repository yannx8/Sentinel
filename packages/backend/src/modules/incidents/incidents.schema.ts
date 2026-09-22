import { z } from 'zod';

/** Canonical list of incident categories. Kept as a const tuple so Zod enums
 *  derive from a single source of truth and the DB enum stays in sync. */
export const categories = [
  'LIGHTING',
  'PLUMBING',
  'SECURITY',
  'FURNITURE',
  'ROAD',
  'EQUIPMENT',
  'HVAC',
  'OTHER'
] as const;

/** Schema for creating or triaging an incident. Partial() is applied downstream
 *  (triage endpoint) to allow updating only category/priority without touching
 *  other fields. Latitude/longitude are required at creation because incidents
 *  must have a physical location for site-based assignment routing. */
export const createIncident = z.object({
  title: z.string().trim().min(5).max(150),
  description: z.string().trim().min(10).max(5000),
  category: z.enum(categories),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  siteId: z.string().uuid(),

  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  locationSource: z.enum(['GPS', 'SITE_FALLBACK', 'MANUAL_PIN']).optional().default('GPS')
});

/** Body schema for adding a free-text comment to an incident thread. */
export const comment = z.object({
  body: z.string().trim().min(1).max(2000)
});

/** Schema for the RESOLVED resolution text. Minimum 10 chars forces the
 *  responsable to provide a meaningful explanation before the incident
 *  enters the review queue for administrators. */
export const resolution = z.object({
  resolutionText: z.string().trim().min(10).max(3000)
});

/** Schema for rejecting a resolution. The reason is sent to the responsable
 *  via notification, so the minimum length ensures useful feedback. */
export const reject = z.object({
  reason: z.string().trim().min(5).max(500)
});
