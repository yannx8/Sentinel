import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { assertTransition } from './incident-lifecycle.js';
import { audit } from '../shared/audit.js';
import { createNotification } from '../notifications/notifications.service.js';
import { Incident } from '@prisma/client';

export function incidentScope(a: any) {
  if (a.roles.includes('SUPERVISOR')) return { organizationId: a.orgId };
  if (a.roles.includes('INTERVENANT'))
    return {
      organizationId: a.orgId,
      assignments: { some: { intervenantMembershipId: a.membershipId } }
    };
  return { organizationId: a.orgId, reporterMembershipId: a.membershipId };
}

export function mapIncidentToDTO(incident: any) {
  // We can do a deep mapping if necessary, but returning the mapped object
  return {
    id: incident.id,
    organizationId: incident.organizationId,
    siteId: incident.siteId,
    reporterMembershipId: incident.reporterMembershipId,
    title: incident.title,
    description: incident.description,
    status: incident.status,
    priority: incident.priority,
    category: incident.category,
    latitude: incident.latitude,
    longitude: incident.longitude,
    locationSource: incident.locationSource,
    verifiedAt: incident.verifiedAt,
    resolutionText: incident.resolutionText,
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
    version: incident.version,
    site: incident.site,
    reporter: incident.reporter,
    assignments: incident.assignments,
    progressUpdates: incident.progressUpdates,
    comments: incident.comments,
    attachments: incident.attachments,
    auditEvents: incident.auditEvents,
  };
}

export class IncidentsService {
  static async listIncidents(a: any, filters: any, page: number, limit: number) {
    const where: any = { ...incidentScope(a) };
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.siteId) where.siteId = filters.siteId;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }
    
    const items = await prisma.incident.findMany({
      where,
      include: {
        site: true,
        reporter: true,
        assignments: { include: { intervenant: { include: { user: true } } } }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });
    
    const total = await prisma.incident.count({ where });
    
    return {
      items: items.map(mapIncidentToDTO),
      total,
      page,
      limit
    };
  }

  static async getIncident(id: string, a: any) {
    const i = await prisma.incident.findFirst({
      where: { id, ...incidentScope(a) },
      include: {
        site: true,
        reporter: true,
        assignments: { include: { intervenant: { include: { user: true } } } },
        progressUpdates: { include: { author: true }, orderBy: { createdAt: 'asc' } },
        comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
        attachments: true,
        auditEvents: { include: { actorMembership: true }, orderBy: { createdAt: 'asc' } }
      }
    });
    if (!i) throw new AppError('NOT_FOUND', 404, 'Incident not found');
    return mapIncidentToDTO(i);
  }

  static async createIncident(d: any, a: any) {
    if (!a.role || a.role === 'REPORTER')
      throw new AppError('ACCOUNT_UNVERIFIED', 403, 'Verified account required');
    const site = await prisma.site.findFirst({
      where: { id: d.siteId, organizationId: a.orgId, isActive: true }
    });
    if (!site) throw new AppError('FORBIDDEN_TENANT', 403, 'Site is not available');
    
    const i = await prisma.$transaction(async (tx: any) => {
      const x = await tx.incident.create({
        data: { ...d, latitude: d.latitude ?? 0, longitude: d.longitude ?? 0, locationSource: d.locationSource ?? 'GPS', organizationId: a.orgId, reporterMembershipId: a.membershipId }
      });
      await audit(tx, a.orgId, x.id, a.membershipId, 'CREATED', { status: 'NEW' });
      return x;
    });
    
    return mapIncidentToDTO(i);
  }

  static async triageIncident(id: string, d: any, a: any) {
    const i = await prisma.incident.findFirst({ where: { id, organizationId: a.orgId } });
    if (!i) throw new AppError('FORBIDDEN_TENANT', 403, 'Resource belongs to another tenant');
    if (i.status === 'CLOSED') throw new AppError('CONFLICT_STATE', 409, 'Closed incident is read-only');
    
    const x = await prisma.$transaction(async (tx: any) => {
      const n = await tx.incident.update({ where: { id: i.id }, data: d });
      await audit(tx, a.orgId, i.id, a.membershipId, 'TRIAGE', d);
      return n;
    });
    
    return mapIncidentToDTO(x);
  }

  static async verifyIncident(id: string, a: any) {
    const i = await prisma.incident.findFirst({ where: { id, organizationId: a.orgId } });
    if (!i) throw new AppError('FORBIDDEN_TENANT', 403, 'Resource belongs to another tenant');
    
    const x = await prisma.$transaction(async (tx: any) => {
      const n = await tx.incident.update({ where: { id: i.id }, data: { verifiedAt: new Date() } });
      await audit(tx, a.orgId, i.id, a.membershipId, 'VERIFIED', {});
      return n;
    });
    
    return mapIncidentToDTO(x);
  }

  static async assignIncident(id: string, intervenantMembershipId: string, a: any) {
    const i = await prisma.incident.findFirst({ where: { id, organizationId: a.orgId } });
    if (!i) throw new AppError('FORBIDDEN_TENANT', 403, 'Resource belongs to another tenant');
    if (i.status !== 'NEW') throw new AppError('CONFLICT_STATE', 409, 'Incident must be NEW');
    
    const membership = await prisma.membership.findFirst({
      where: {
        id: intervenantMembershipId,
        organizationId: a.orgId,
        role: 'INTERVENANT',
        status: 'ACTIVE'
      }
    });
    if (!membership) throw new AppError('FORBIDDEN_TENANT', 403, 'Intervenant not found in tenant');
    
    const x = await prisma.$transaction(async (tx: any) => {
      const n = await tx.incident.updateMany({
        where: { id: i.id, version: i.version, status: 'NEW' },
        data: { status: 'ASSIGNED', version: { increment: 1 } }
      });
      if (!n.count) throw new AppError('CONFLICT_CONCURRENT_UPDATE', 409, 'Incident changed concurrently');
      
      const as = await tx.assignment.create({
        data: { incidentId: i.id, organizationId: a.orgId, intervenantMembershipId: membership.id, assignedByMembershipId: a.membershipId }
      });
      
      await audit(tx, a.orgId, i.id, a.membershipId, 'ASSIGNMENT', { intervenantMembershipId: membership.id });
      return as;
    });
    
    createNotification(a.orgId, membership.id, 'ASSIGNED', 'Nouvelle assignation', `Vous avez été assigné à l'incident ${i.title}`, i.id);
    return x;
  }

  static async resolveIncident(id: string, resolutionText: string, a: any) {
    const i = await prisma.incident.findFirst({
      where: {
        id,
        organizationId: a.orgId,
        assignments: { some: { intervenantMembershipId: a.membershipId, status: 'ACCEPTED' } }
      }
    });
    if (!i) throw new AppError('FORBIDDEN_NOT_ASSIGNED', 403, 'Not the active assigned Intervenant');
    
    assertTransition(i.status, 'RESOLVED');
    
    const x = await prisma.$transaction(async (tx: any) => {
      const n = await tx.incident.update({
        where: { id: i.id },
        data: { status: 'RESOLVED', resolutionText, version: { increment: 1 } }
      });
      await audit(tx, a.orgId, i.id, a.membershipId, 'RESOLUTION', { resolutionText });
      return n;
    });
    
    const supervisors = await prisma.membership.findMany({
      where: { organizationId: a.orgId, role: 'SUPERVISOR', status: 'ACTIVE' }
    });
    for (const supervisor of supervisors) {
      createNotification(a.orgId, supervisor.id, 'RESOLVED', 'Résolution soumise', `L'incident ${i.title} attend votre vérification`, i.id);
    }
    
    return mapIncidentToDTO(x);
  }

  static async rejectResolution(id: string, reason: string, a: any) {
    const i = await prisma.incident.findFirst({ where: { id, organizationId: a.orgId } });
    if (!i) throw new AppError('FORBIDDEN_TENANT', 403, 'Resource belongs to another tenant');
    
    assertTransition(i.status, 'IN_PROGRESS');
    
    const x = await prisma.$transaction(async (tx: any) => {
      const n = await tx.incident.update({
        where: { id: i.id },
        data: { status: 'IN_PROGRESS', version: { increment: 1 } }
      });
      await audit(tx, a.orgId, i.id, a.membershipId, 'REJECTED', { reason });
      return n;
    });
    
    const assignment = await prisma.assignment.findFirst({
      where: { incidentId: i.id, status: { in: ['PENDING_ACCEPTANCE', 'ACCEPTED', 'REASSIGNMENT_REQUESTED'] } },
      include: { intervenant: { include: { user: true } } }
    });
    if (assignment) {
      createNotification(a.orgId, assignment.intervenantMembershipId, 'SENT_BACK', 'Résolution rejetée', `La résolution de l'incident ${i.title} a été rejetée: ${reason}`, i.id);
    }
    
    return mapIncidentToDTO(x);
  }

  static async closeIncident(id: string, a: any) {
    const i = await prisma.incident.findFirst({ where: { id, organizationId: a.orgId } });
    if (!i) throw new AppError('FORBIDDEN_TENANT', 403, 'Resource belongs to another tenant');
    
    assertTransition(i.status, 'CLOSED');
    
    const x = await prisma.$transaction(async (tx: any) => {
      const n = await tx.incident.update({
        where: { id: i.id },
        data: { status: 'CLOSED', version: { increment: 1 } }
      });
      await audit(tx, a.orgId, i.id, a.membershipId, 'CLOSED', {});
      return n;
    });
    
    createNotification(a.orgId, i.reporterMembershipId, 'CLOSED', 'Incident clôturé', `Votre incident ${i.title} a été clôturé`, i.id);
    return mapIncidentToDTO(x);
  }

  static async addProgress(id: string, type: any, note: string, a: any) {
    const i = await prisma.incident.findFirst({
      where: {
        id,
        organizationId: a.orgId,
        assignments: { some: { intervenantMembershipId: a.membershipId, status: { in: ['PENDING_ACCEPTANCE', 'ACCEPTED', 'REASSIGNMENT_REQUESTED'] } } }
      }
    });
    if (!i) throw new AppError('FORBIDDEN_NOT_ASSIGNED', 403, 'Not assigned');
    if (i.status === 'CLOSED') throw new AppError('CONFLICT_STATE', 409, 'Closed incident');
    
    if (!['STARTED', 'ON_SITE', 'BLOCKED', 'UPDATE'].includes(type))
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid progress type');
    if (note.length < 1 || note.length > 3000) throw new AppError('VALIDATION_ERROR', 400, 'Invalid progress note');
    
    const p = await prisma.$transaction(async (tx: any) => {
      const x = await tx.progressUpdate.create({
        data: { organizationId: a.orgId, incidentId: i.id, authorMembershipId: a.membershipId, type, note }
      });
      await audit(tx, a.orgId, i.id, a.membershipId, 'PROGRESS', { type });
      return x;
    });
    
    return p;
  }

  static async addComment(id: string, body: string, a: any) {
    const i = await prisma.incident.findFirst({ where: { id, ...incidentScope(a) } });
    if (!i) throw new AppError('NOT_FOUND', 404, 'Incident not found');
    if (i.status === 'CLOSED') throw new AppError('CONFLICT_STATE', 409, 'Closed incident');
    
    const c = await prisma.$transaction(async (tx: any) => {
      const x = await tx.comment.create({
        data: { organizationId: a.orgId, incidentId: i.id, authorMembershipId: a.membershipId, body },
        include: { author: true }
      });
      await audit(tx, a.orgId, i.id, a.membershipId, 'COMMENT', {});
      return x;
    });
    
    return c;
  }

  static async getAudit(id: string, a: any) {
    const i = await prisma.incident.findFirst({ where: { id, ...incidentScope(a) } });
    if (!i) throw new AppError('NOT_FOUND', 404, 'Incident not found');
    return prisma.auditEvent.findMany({ where: { incidentId: i.id }, include: { actorMembership: true }, orderBy: { createdAt: 'asc' } });
  }
}
