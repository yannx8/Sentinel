import type { BulkIncidentsInput, BulkIncidentsResult } from '@sentinel/shared';
import type { Tenant } from '../../auth/context';
import { AppError } from '../../http/errors';
import { logger } from '../../lib/logger';
import { assignIncident, triageIncident } from './service';

/**
 * Applies one action to several incidents by running the single-incident service for each, so
 * visibility, version checks, eligibility, audit and notifications are exactly the same.
 * Each incident is its own transaction: one failure never rolls back the others.
 */
export async function bulkIncidents(tenant: Tenant, input: BulkIncidentsInput): Promise<BulkIncidentsResult> {
  const result: BulkIncidentsResult = { done: [], failed: [] };
  const seen = new Set<string>();
  for (const item of input.items) {
    if (seen.has(item.reference)) continue;
    seen.add(item.reference);
    try {
      if (input.action === 'priority') {
        const { categoryId } = item as typeof item & { categoryId: string };
        await triageIncident(tenant, item.reference, {
          expectedVersion: item.expectedVersion,
          priority: input.priority,
          categoryId,
        });
      } else {
        await assignIncident(tenant, item.reference, {
          expectedVersion: item.expectedVersion,
          intervenantMembershipId: input.intervenantMembershipId,
          note: undefined,
        });
      }
      result.done.push(item.reference);
    } catch (error) {
      // One bad incident must not abandon the ones after it, so unexpected errors are reported per item too.
      if (error instanceof AppError) {
        result.failed.push({ reference: item.reference, code: error.code, message: error.message });
      } else {
        logger.error({ err: error, reference: item.reference }, 'Bulk item failed');
        result.failed.push({
          reference: item.reference,
          code: 'INTERNAL',
          message: 'This incident could not be updated.',
        });
      }
    }
  }
  return result;
}
