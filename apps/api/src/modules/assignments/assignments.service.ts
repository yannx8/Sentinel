import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { audit } from '../shared/audit.js';
import { Assignment } from '@prisma/client';

export function mapAssignmentToDTO(assignment: Assignment) {
  return {
    id: assignment.id,
    incidentId: assignment.incidentId,
    intervenantMembershipId: assignment.intervenantMembershipId,
    assignedByMembershipId: assignment.assignedByMembershipId,
    status: assignment.status,
    reassignReason: assignment.reassignReason,
    organizationId: assignment.organizationId,
    assignedAt: assignment.assignedAt,
    respondedAt: assignment.respondedAt,
    endedAt: assignment.endedAt,
  };
}

export class AssignmentsService {
  static async acceptAssignment(id: string, membershipId: string, organizationId: string) {
    const as = await prisma.assignment.findFirst({
      where: {
        id,
        status: { in: ['PENDING_ACCEPTANCE', 'ACCEPTED', 'REASSIGNMENT_REQUESTED'] },
        intervenantMembershipId: membershipId,
        organizationId
      },
      include: { incident: true }
    });

    if (!as) throw new AppError('FORBIDDEN_NOT_ASSIGNED', 403, 'Assignment not assigned to you');

    const updatedAssignment = await prisma.$transaction(async (tx: any) => {
      const n = await tx.assignment.update({ where: { id: as.id }, data: { status: 'ACCEPTED' } });
      // Accepting moves the incident from ASSIGNED to IN_PROGRESS. The assignment
      // status and incident status are updated atomically: if either fails, both roll back.
      await tx.incident.update({ where: { id: as.incidentId }, data: { status: 'IN_PROGRESS', version: { increment: 1 } } });
      await audit(tx, organizationId, as.incidentId, membershipId, 'STATUS', { from: 'ASSIGNED', to: 'IN_PROGRESS' });
      return n;
    });

    return mapAssignmentToDTO(updatedAssignment);
  }

  static async requestReassignment(id: string, membershipId: string, organizationId: string, reason: string) {
    const as = await prisma.assignment.findFirst({
      where: {
        id,
        status: { in: ['PENDING_ACCEPTANCE', 'ACCEPTED', 'REASSIGNMENT_REQUESTED'] },
        intervenantMembershipId: membershipId,
        organizationId
      },
      include: { incident: true }
    });

    if (!as) throw new AppError('FORBIDDEN_NOT_ASSIGNED', 403, 'Assignment not assigned to you');

    const updatedAssignment = await prisma.$transaction(async (tx: any) => {
      const n = await tx.assignment.update({
        where: { id: as.id },
        data: { status: 'REASSIGNMENT_REQUESTED', reassignReason: reason }
      });
      await audit(tx, organizationId, as.incidentId, membershipId, 'REASSIGNMENT', { reason });
      return n;
    });

    return mapAssignmentToDTO(updatedAssignment);
  }
}
